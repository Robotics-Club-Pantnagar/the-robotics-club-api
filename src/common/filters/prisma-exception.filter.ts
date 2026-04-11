import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { status, errorCode, message } = this.mapPrismaError(exception);

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        details: {
          prismaCode: exception.code,
        },
      },
    };

    this.logger.warn(
      `[${request.method}] ${request.originalUrl || request.url} Prisma known error ${exception.code}: ${message}`,
    );

    response.status(status).json(errorResponse);
  }

  private mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    errorCode: string;
    message: string;
  } {
    switch (exception.code) {
      case 'P2002': {
        const target = exception.meta?.target;
        const fields = Array.isArray(target)
          ? target.filter((t) => typeof t === 'string').join(', ')
          : typeof target === 'string'
            ? target
            : undefined;
        return {
          status: HttpStatus.CONFLICT,
          errorCode: 'CONFLICT',
          message: `A record with this ${fields || 'value'} already exists`,
        };
      }
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          errorCode: 'NOT_FOUND',
          message: 'Record not found',
        };
      case 'P2003': {
        const fieldName =
          typeof exception.meta?.field_name === 'string'
            ? exception.meta.field_name
            : undefined;
        return {
          status: HttpStatus.BAD_REQUEST,
          errorCode: 'VALIDATION_ERROR',
          message: `Invalid reference: ${fieldName || 'foreign key constraint failed'}`,
        };
      }
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          errorCode: 'INTERNAL_ERROR',
          message: 'An unexpected database error occurred',
        };
    }
  }
}

@Catch(Prisma.PrismaClientUnknownRequestError)
export class PrismaUnknownExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaUnknownExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientUnknownRequestError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Check if this is a PostgreSQL trigger RAISE EXCEPTION
    const errorMessage = exception.message;
    const isValidationTriggerError =
      this.isValidationTriggerError(errorMessage);
    const triggerMatch = this.extractTriggerMessage(errorMessage);

    if (triggerMatch && isValidationTriggerError) {
      this.logger.warn(
        `[${request.method}] ${request.originalUrl || request.url} Prisma validation trigger: ${triggerMatch}`,
      );
      const errorResponse: ErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: triggerMatch,
        },
      };
      response.status(HttpStatus.BAD_REQUEST).json(errorResponse);
      return;
    }

    if (triggerMatch) {
      this.logger.warn(
        `[${request.method}] ${request.originalUrl || request.url} Prisma conflict trigger: ${triggerMatch}`,
      );
      const errorResponse: ErrorResponse = {
        success: false,
        error: {
          code: 'CONFLICT',
          message: triggerMatch,
        },
      };
      response.status(HttpStatus.CONFLICT).json(errorResponse);
      return;
    }

    // Generic unknown error
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected database error occurred',
      },
    };

    this.logger.error(
      `[${request.method}] ${request.originalUrl || request.url} Prisma unknown error`,
      exception.stack || exception.message,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
  }

  private isValidationTriggerError(message: string): boolean {
    const validationPatterns = [
      /SQLSTATE\s*22023/i,
      /Tag cannot be empty after normalization/i,
    ];

    return validationPatterns.some((pattern) => pattern.test(message));
  }

  private extractTriggerMessage(message: string): string | null {
    // PostgreSQL RAISE EXCEPTION messages appear in the error message
    // Pattern: "ERROR: <message>"
    const patterns = [
      /ERROR:\s*(.+?)(?:\n|$)/i,
      /A team with the same name already exists in this event/i,
      /This name update conflicts with another team's name/i,
      /Member already has a position during this time period/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    return null;
  }
}

@Catch(Prisma.PrismaClientValidationError)
export class PrismaValidationFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaValidationFilter.name);

  catch(exception: Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    this.logger.warn(
      `[${request.method}] ${request.originalUrl || request.url} Prisma validation error: ${exception.message}`,
    );

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid data provided',
      },
    };

    response.status(HttpStatus.BAD_REQUEST).json(errorResponse);
  }
}
