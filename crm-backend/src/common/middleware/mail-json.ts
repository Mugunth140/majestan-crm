import { json, type RequestHandler } from 'express';

const parseMail = json({ limit: '1mb' });
// Email bodies and templates can exceed Express's 100kb default. Distinct handler
// name: Nest detects an existing `jsonParser` by name and would skip its own.
export const mailJsonParser: RequestHandler = (request, response, next) => parseMail(request, response, next);
