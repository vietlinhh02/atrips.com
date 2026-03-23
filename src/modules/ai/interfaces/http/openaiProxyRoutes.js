/**
 * OpenAI-Compatible Proxy Routes
 * Provides /v1/chat/completions, /v1/responses, and /v1/models endpoints
 */

import { Router } from 'express';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import aiService from '../../infrastructure/services/AIService.js';

const router = Router();

const OAI_PROXY_API_KEY = process.env.OAI_PROXY_API_KEY || '';

/**
 * Authenticate proxy requests
 */
function authenticateProxy(req, res, next) {
  // If no API key is set, allow all requests
  if (!OAI_PROXY_API_KEY) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        message: 'Missing or invalid Authorization header',
        type: 'invalid_request_error',
        code: 'invalid_api_key',
      },
    });
  }

  const token = authHeader.slice(7);
  if (token !== OAI_PROXY_API_KEY) {
    return res.status(401).json({
      error: {
        message: 'Invalid API key',
        type: 'invalid_request_error',
        code: 'invalid_api_key',
      },
    });
  }

  next();
}

/**
 * @route POST /v1/chat/completions
 * @desc OpenAI-compatible chat completions
 */
router.post('/chat/completions', authenticateProxy, asyncHandler(async (req, res) => {
  const {
    model,
    messages,
    temperature = 0.7,
    max_tokens,
    stream = false,
    top_p,
    frequency_penalty,
    presence_penalty,
    stop,
    n = 1,
    user,
  } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new AppError('Messages array is required and must not be empty', 400);
  }

  if (stream) {
    // Streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const chatId = `chatcmpl-${generateId()}`;
    const created = Math.floor(Date.now() / 1000);

    try {
      const streamGen = aiService.chatStream(messages, {
        model,
        temperature,
        maxTokens: max_tokens,
        topP: top_p,
        frequencyPenalty: frequency_penalty,
        presencePenalty: presence_penalty,
        stop,
        n,
        user,
      });

      for await (const chunk of streamGen) {
        if (chunk.type === 'content') {
          const sseData = {
            id: chatId,
            object: 'chat.completion.chunk',
            created,
            model: model || aiService.model,
            choices: [
              {
                index: 0,
                delta: { content: chunk.content },
                finish_reason: null,
              },
            ],
          };
          res.write(`data: ${JSON.stringify(sseData)}\n\n`);
        } else if (chunk.type === 'finish') {
          const sseData = {
            id: chatId,
            object: 'chat.completion.chunk',
            created,
            model: model || aiService.model,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: chunk.reason || 'stop',
              },
            ],
          };
          res.write(`data: ${JSON.stringify(sseData)}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      const errorData = {
        error: {
          message: error.message,
          type: 'server_error',
        },
      };
      res.write(`data: ${JSON.stringify(errorData)}\n\n`);
      res.end();
    }
  } else {
    // Non-streaming response
    const result = await aiService.chat(messages, {
      model,
      temperature,
      maxTokens: max_tokens,
      topP: top_p,
      frequencyPenalty: frequency_penalty,
      presencePenalty: presence_penalty,
      stop,
      n,
      user,
    });

    const response = {
      id: `chatcmpl-${generateId()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: result.model || model || aiService.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.content,
          },
          finish_reason: result.finishReason || 'stop',
        },
      ],
      usage: {
        prompt_tokens: result.usage?.prompt_tokens || 0,
        completion_tokens: result.usage?.completion_tokens || 0,
        total_tokens: result.usage?.total_tokens || 0,
      },
    };

    return res.json(response);
  }
}));

/**
 * @route POST /v1/responses
 * @desc OpenAI Responses API format (always streaming SSE)
 */
router.post('/responses', authenticateProxy, asyncHandler(async (req, res) => {
  const {
    model,
    input,
    instructions,
    temperature,
    max_output_tokens,
    top_p,
    stream = true,
  } = req.body;

  if (!input) {
    throw new AppError('input is required', 400);
  }

  // Convert input to messages array
  const messages = [];
  if (instructions) {
    messages.push({ role: 'system', content: instructions });
  }
  if (typeof input === 'string') {
    messages.push({ role: 'user', content: input });
  } else if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === 'string') {
        messages.push({ role: 'user', content: item });
      } else if (item.role && item.content) {
        messages.push({ role: item.role, content: item.content });
      }
    }
  }

  const respId = `resp_chatcmpl-${generateId()}`;
  const msgId = `msg_${respId}_0`;
  const createdAt = Math.floor(Date.now() / 1000);
  const resolvedModel = model || aiService.model;

  const sendSSE = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  if (!stream) {
    // Non-streaming: collect full response then return JSON
    const result = await aiService.chat(messages, {
      model,
      temperature,
      maxTokens: max_output_tokens,
      topP: top_p,
    });

    return res.json({
      id: respId,
      object: 'response',
      created_at: createdAt,
      status: 'completed',
      model: result.model || resolvedModel,
      output: [{
        id: msgId,
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'output_text',
          text: result.content,
          annotations: [],
        }],
      }],
      usage: {
        input_tokens: result.usage?.prompt_tokens || 0,
        output_tokens: result.usage?.completion_tokens || 0,
        total_tokens: result.usage?.total_tokens || 0,
      },
    });
  }

  // Streaming SSE response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let seq = 0;
  const nextSeq = () => ++seq;

  // response.created
  sendSSE('response.created', {
    type: 'response.created',
    response: {
      id: respId, object: 'response', created_at: createdAt,
      status: 'in_progress', model: resolvedModel,
      background: false, error: null, output: [],
    },
    sequence_number: nextSeq(),
  });

  // response.in_progress
  sendSSE('response.in_progress', {
    type: 'response.in_progress',
    response: {
      id: respId, object: 'response',
      created_at: createdAt, status: 'in_progress',
    },
    sequence_number: nextSeq(),
  });

  // output_item.added (message)
  sendSSE('response.output_item.added', {
    type: 'response.output_item.added',
    output_index: 0,
    item: {
      id: msgId, type: 'message', content: [], role: 'assistant',
    },
    sequence_number: nextSeq(),
  });

  // content_part.added
  sendSSE('response.content_part.added', {
    type: 'response.content_part.added',
    item_id: msgId, output_index: 0, content_index: 0,
    part: { type: 'output_text', annotations: [], text: '' },
    sequence_number: nextSeq(),
  });

  let fullText = '';

  try {
    const streamGen = aiService.chatStream(messages, {
      model,
      temperature,
      maxTokens: max_output_tokens,
      topP: top_p,
    });

    for await (const chunk of streamGen) {
      if (chunk.type === 'content') {
        fullText += chunk.content;
        sendSSE('response.output_text.delta', {
          type: 'response.output_text.delta',
          item_id: msgId, output_index: 0, content_index: 0,
          delta: chunk.content,
          sequence_number: nextSeq(),
        });
      } else if (chunk.type === 'finish') {
        // output_text.done
        sendSSE('response.output_text.done', {
          type: 'response.output_text.done',
          item_id: msgId, output_index: 0, content_index: 0,
          text: fullText,
          sequence_number: nextSeq(),
        });

        // content_part.done
        sendSSE('response.content_part.done', {
          type: 'response.content_part.done',
          item_id: msgId, output_index: 0, content_index: 0,
          part: {
            type: 'output_text', annotations: [], text: fullText,
          },
          sequence_number: nextSeq(),
        });

        // output_item.done
        sendSSE('response.output_item.done', {
          type: 'response.output_item.done',
          output_index: 0,
          item: {
            id: msgId, type: 'message', role: 'assistant',
            content: [{
              type: 'output_text', annotations: [], text: fullText,
            }],
          },
          sequence_number: nextSeq(),
        });

        // response.completed
        sendSSE('response.completed', {
          type: 'response.completed',
          response: {
            id: respId, object: 'response', created_at: createdAt,
            status: 'completed', model: resolvedModel,
            background: false, error: null,
          },
          sequence_number: nextSeq(),
        });
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    sendSSE('response.failed', {
      type: 'response.failed',
      response: {
        id: respId, object: 'response', created_at: createdAt,
        status: 'failed',
        error: { type: 'server_error', message: error.message },
      },
      sequence_number: nextSeq(),
    });
    res.write('data: [DONE]\n\n');
    res.end();
  }
}));

/**
 * @route GET /v1/models
 * @desc List available models (OpenAI format)
 */
router.get('/models', authenticateProxy, asyncHandler(async (req, res) => {
  const models = await aiService.getModels();
  return res.json(models);
}));

/**
 * @route GET /v1/models/:model
 * @desc Get single model info
 */
router.get('/models/:model', authenticateProxy, asyncHandler(async (req, res) => {
  const { model } = req.params;
  const models = await aiService.getModels();
  const found = models.data?.find(m => m.id === model);

  if (!found) {
    return res.status(404).json({
      error: {
        message: `The model '${model}' does not exist`,
        type: 'invalid_request_error',
        param: 'model',
        code: 'model_not_found',
      },
    });
  }

  return res.json(found);
}));

/**
 * Generate random ID for responses
 */
function generateId(length = 29) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default router;
