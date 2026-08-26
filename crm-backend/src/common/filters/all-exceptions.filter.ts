import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const reqId = (request as any).id;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error(`[ReqID: ${reqId}] Unhandled Exception:`, exception);
    } else if (status >= 400 && status < 500) {
      console.warn(`[ReqID: ${reqId}] ${request.method} ${request.url} -> ${status}`, typeof message === 'string' ? message : JSON.stringify(message));
    }

    response.status(status).json({
      success: false,
      error: typeof message === 'string' ? message : (message as any)?.message || message,
      reqId,
    });
  }
}
