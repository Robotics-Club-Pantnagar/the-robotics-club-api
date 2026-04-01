import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus() as HttpStatus;
    const exceptionResponse = exception.getResponse() as unknown;

    let message: string;
    let details: Record<string, unknown> | undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const obj = exceptionResponse as Record<string, unknown>;
      const msg = obj.message;

      if (Array.isArray(msg) && msg.every((m) => typeof m === 'string')) {
        message = msg[0] ?? exception.message;
        details = { errors: msg };
      } else if (typeof msg === 'string') {
        message = msg;
      } else {
        message = exception.message;
      }
    } else {
      message = exception.message;
    }

    const errorCode = this.getErrorCode(status);

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        ...(details && { details }),
      },
    };

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: HttpStatus): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
