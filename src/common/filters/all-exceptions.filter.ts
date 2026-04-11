import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as unknown;
      const { message, details } = this.extractHttpExceptionMessage(
        exception,
        exceptionResponse,
      );

      this.logger.warn(
        `[${request.method}] ${request.originalUrl || request.url} HttpException ${status}: ${message}`,
      );

      const errorResponse: ErrorResponse = {
        success: false,
        error: {
          code: this.getHttpErrorCode(status),
          message,
          ...(details && { details }),
        },
      };

      response.status(status).json(errorResponse);
      return;
    }

    // Check for DB trigger exceptions (PostgreSQL RAISE EXCEPTION)
    if (this.isDbTriggerException(exception)) {
      const message = this.extractTriggerMessage(exception);
      this.logger.warn(
        `[${request.method}] ${request.originalUrl || request.url} DB trigger conflict: ${message}`,
      );
      const errorResponse: ErrorResponse = {
        success: false,
        error: {
          code: 'CONFLICT',
          message,
        },
      };
      response.status(HttpStatus.CONFLICT).json(errorResponse);
      return;
    }

    // Generic fallback
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    };

    if (process.env.NODE_ENV === 'development') {
      console.error('Unhandled exception:', exception);
    }

    this.logger.error(
      `[${request.method}] ${request.originalUrl || request.url} Unhandled exception`,
      this.getExceptionStack(exception),
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
  }

  private getExceptionStack(exception: unknown): string {
    if (exception instanceof Error) {
      return exception.stack || exception.message;
    }

    if (typeof exception === 'object' && exception !== null) {
      try {
        return JSON.stringify(exception);
      } catch {
        return 'Non-serializable exception object';
      }
    }

    return String(exception);
  }

  private extractHttpExceptionMessage(
    exception: HttpException,
    exceptionResponse: unknown,
  ): { message: string; details?: Record<string, unknown> } {
    if (typeof exceptionResponse === 'string') {
      return { message: exceptionResponse };
    }

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const obj = exceptionResponse as Record<string, unknown>;
      const msg = obj.message;

      if (Array.isArray(msg) && msg.every((item) => typeof item === 'string')) {
        return {
          message: msg[0] || exception.message,
          details: { errors: msg },
        };
      }

      if (typeof msg === 'string') {
        return { message: msg };
      }
    }

    return { message: exception.message };
  }

  private getHttpErrorCode(status: number): string {
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

  private isDbTriggerException(exception: unknown): boolean {
    if (exception && typeof exception === 'object') {
      const err = exception as Record<string, unknown>;
      // PostgreSQL trigger exceptions typically have code P0001 (raise_exception)
      return err.code === 'P0001' || err.code === '23514';
    }
    return false;
  }

  private extractTriggerMessage(exception: unknown): string {
    if (exception && typeof exception === 'object') {
      const err = exception as Record<string, unknown>;
      if (typeof err.message === 'string') {
        return err.message;
      }
    }
    return 'A database constraint was violated';
  }
}
