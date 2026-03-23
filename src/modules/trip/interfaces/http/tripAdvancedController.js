import PDFDocument from 'pdfkit';
import { sendSuccess, sendCreated } from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import tripAdvancedRepository from '../../infrastructure/repositories/TripAdvancedRepository.js';

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateShort(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(timeValue) {
  if (!timeValue) return null;
  const d = new Date(timeValue);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatCurrency(amount, currency) {
  if (amount == null) return null;
  const num = Number(amount);
  if (isNaN(num)) return null;
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || 'USD'}`;
}

function sanitizeFilename(title) {
  return title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60);
}

function generatePdfBuffer(trip) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(24).font('Helvetica-Bold').text(trip.title, {
      align: 'center',
    });
    doc.moveDown(0.5);

    const subParts = [
      `${formatDateShort(trip.startDate)} - ${formatDateShort(trip.endDate)}`,
      `${trip.travelersCount} traveler${trip.travelersCount !== 1 ? 's' : ''}`,
    ];
    if (trip.budgetTotal != null) {
      subParts.push(
        `Budget: ${formatCurrency(trip.budgetTotal, trip.budgetCurrency)}`
      );
    }
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#555555')
      .text(subParts.join(' | '), { align: 'center' });
    doc.moveDown(0.5);

    if (trip.description) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#333333')
        .text(trip.description, { align: 'center' });
      doc.moveDown(1);
    }

    doc
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .strokeColor('#cccccc')
      .stroke();
    doc.moveDown(1);

    for (const day of trip.itinerary_days) {
      if (doc.y > doc.page.height - 120) {
        doc.addPage();
      }

      const dayLabel = day.cityName
        ? `Day ${day.dayNumber}: ${formatDate(day.date)} - ${day.cityName}`
        : `Day ${day.dayNumber}: ${formatDate(day.date)}`;

      doc.fontSize(14).font('Helvetica-Bold').fillColor('#222222').text(dayLabel);
      doc.moveDown(0.3);

      doc
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .strokeColor('#dddddd')
        .stroke();
      doc.moveDown(0.4);

      if (!day.activities || day.activities.length === 0) {
        doc
          .fontSize(10)
          .font('Helvetica-Oblique')
          .fillColor('#999999')
          .text('No activities planned');
        doc.moveDown(0.8);
        continue;
      }

      for (const activity of day.activities) {
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
        }

        const timeStr = formatTime(activity.startTime);
        const prefix = timeStr ? `${timeStr}  ` : '';

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#333333')
          .text(`${prefix}${activity.name}`);

        if (activity.description) {
          doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor('#555555')
            .text(activity.description, { indent: 15 });
        }

        const address = activity.customAddress;
        if (address) {
          doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor('#777777')
            .text(`Location: ${address}`, { indent: 15 });
        }

        const costStr = formatCurrency(
          activity.estimatedCost,
          activity.currency
        );
        if (costStr) {
          doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor('#777777')
            .text(`Cost: ${costStr}`, { indent: 15 });
        }

        doc.moveDown(0.5);
      }

      doc.moveDown(0.5);
    }

    doc.end();
  });
}

const duplicateTrip = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const userId = req.user.id;

  const newTrip = await tripAdvancedRepository.duplicateTrip(tripId, userId);

  return sendCreated(
    res,
    { trip: newTrip },
    'Trip duplicated successfully'
  );
});

const archiveTrip = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const userId = req.user.id;

  const trip = await tripAdvancedRepository.archiveTrip(tripId, userId);

  return sendSuccess(res, { trip }, 'Trip archived successfully');
});

const restoreTrip = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const userId = req.user.id;

  const trip = await tripAdvancedRepository.restoreTrip(tripId, userId);

  return sendSuccess(res, { trip }, 'Trip restored successfully');
});

const getStatusHistory = asyncHandler(async (req, res) => {
  const { tripId } = req.params;

  const history = await tripAdvancedRepository.getStatusHistory(tripId);

  return sendSuccess(res, { history });
});

const exportPdf = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const userId = req.user.id;

  const trip = await tripAdvancedRepository.getTripForExport(tripId);

  if (trip.ownerId !== userId) {
    throw AppError.forbidden(
      'You do not have permission to export this trip'
    );
  }

  const pdfBuffer = await generatePdfBuffer(trip);

  const exportRecord = await tripAdvancedRepository.createExportRecord(
    tripId,
    'PDF',
    null,
    null
  );

  const filename = `trip-${sanitizeFilename(trip.title)}.pdf`;

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': pdfBuffer.length,
    'X-Export-Id': exportRecord.id,
  });

  return res.send(pdfBuffer);
});

const getExports = asyncHandler(async (req, res) => {
  const { tripId } = req.params;

  const exports = await tripAdvancedRepository.getExports(tripId);

  return sendSuccess(res, { exports });
});

export default {
  duplicateTrip,
  archiveTrip,
  restoreTrip,
  getStatusHistory,
  exportPdf,
  getExports,
};
