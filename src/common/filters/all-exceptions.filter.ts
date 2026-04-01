import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
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

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Check for DB trigger exceptions (PostgreSQL RAISE EXCEPTION)
    if (this.isDbTriggerException(exception)) {
      const message = this.extractTriggerMessage(exception);
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

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
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
