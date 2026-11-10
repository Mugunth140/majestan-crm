import { json, type RequestHandler } from 'express';

// Meta signs the exact bytes it sends, so keep them for the signature check.
const parseWebhook = json({
  limit: '1mb',
  verify: (request, _response, buffer) => {
    (request as typeof request & { rawBody?: Buffer }).rawBody =
      Buffer.from(buffer);
  },
});
// Distinct handler name: Nest detects an existing `jsonParser` by name and would skip its own.
export const whatsappJsonParser: RequestHandler = (request, response, next) =>
  parseWebhook(request, response, next);
