import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { json, RequestHandler } from 'express';
const parse = json({ limit: '512kb' });
/** Body parser for property-portal pushes (99acres, Magicbricks). */
export const portalJsonParser: RequestHandler = (req, res, next) => parse(req, res, error => {
  // The global exception filter handles Nest HttpExceptions, not body-parser's raw errors.
  if (error?.type === 'entity.too.large') return next(new PayloadTooLargeException('Request exceeds 512 KB'));
  if (error?.type === 'entity.parse.failed') return next(new BadRequestException('Invalid JSON body'));
  return next(error);
});
