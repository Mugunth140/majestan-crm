import { json, type RequestHandler } from 'express';

const parseImport = json({ limit: '1mb' });
// Keep a distinct handler name: Nest detects an existing `jsonParser` by name
// and would otherwise skip installing its parser for all the other routes.
export const hrImportJsonParser: RequestHandler = (request, response, next) => parseImport(request, response, next);
