/**
 * File Process Worker
 * Handles async processing of uploaded files:
 * - Images: resolve public URL + variant URLs
 * - Documents: download from R2 and extract text (PDF, DOCX, XLSX/CSV)
 */

import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import R2StorageService from '../../../image/infrastructure/services/R2StorageService.js';
import FileUploadRepository from '../repositories/FileUploadRepository.js';

const MAX_TEXT_LENGTH = 50000;

function truncateText(text) {
  if (text.length <= MAX_TEXT_LENGTH) {
    return { text, truncated: false };
  }
  return {
    text: text.slice(0, MAX_TEXT_LENGTH)
      + '\n[Content truncated at 50,000 characters]',
    truncated: true,
  };
}

async function extractPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const { text, truncated } = truncateText(result.text);
  return {
    extractedText: text,
    extractionMeta: {
      pageCount: result.total,
      charCount: result.text.length,
      truncated,
    },
  };
}

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  const { text, truncated } = truncateText(result.value);
  return {
    extractedText: text,
    extractionMeta: {
      charCount: result.value.length,
      truncated,
      warnings: result.messages.length,
    },
  };
}

function extractSpreadsheet(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheets = [];
  let fullText = '';

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    sheets.push(sheetName);
    fullText += `[Sheet: ${sheetName}]\n${csv}\n\n`;
  }

  const { text, truncated } = truncateText(fullText);
  return {
    extractedText: text,
    extractionMeta: {
      sheetNames: sheets,
      sheetCount: sheets.length,
      charCount: fullText.length,
      truncated,
    },
  };
}

async function processImageFile(job) {
  const { fileUploadId, r2Key } = job.data;
  await FileUploadRepository.updateStatus(fileUploadId, 'PROCESSING');

  const publicUrl = R2StorageService.getPublicUrl(r2Key);
  const variants = R2StorageService.getVariantUrls(r2Key);

  await FileUploadRepository.updateStatus(fileUploadId, 'READY', {
    publicUrl,
    variants,
  });
}

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function processDocumentFile(job) {
  const { fileUploadId, r2Key, mimeType } = job.data;
  await FileUploadRepository.updateStatus(fileUploadId, 'PROCESSING');

  const buffer = await R2StorageService.download(r2Key);

  let result;
  if (mimeType === 'application/pdf') {
    result = await extractPdf(buffer);
  } else if (mimeType === DOCX_MIME) {
    result = await extractDocx(buffer);
  } else if (mimeType === XLSX_MIME || mimeType === 'text/csv') {
    result = extractSpreadsheet(buffer);
  } else {
    throw new Error(
      `Unsupported mime type for extraction: ${mimeType}`
    );
  }

  await FileUploadRepository.updateStatus(fileUploadId, 'READY', {
    extractedText: result.extractedText,
    extractionMeta: result.extractionMeta,
  });
}

export async function processFileJob(job) {
  const { fileType } = job.data;

  if (fileType === 'IMAGE') {
    return processImageFile(job);
  }
  if (fileType === 'DOCUMENT') {
    return processDocumentFile(job);
  }

  throw new Error(`Unknown file type: ${fileType}`);
}
