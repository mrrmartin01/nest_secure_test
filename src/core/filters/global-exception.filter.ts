import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from '@shared/constants';
import type { ApiErrorResponse } from '@shared/types/api-response.types';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = request.headers[CORRELATION_ID_HEADER] as string | undefined;
    const { status, message } = this.resolveException(exception);

    if (status >= 500) {
      this.logger.error(
        { err: exception, correlationId, path: request.url, method: request.method },
        'Unhandled server error',
      );
    } else if (status >= 400) {
      this.logger.warn({ correlationId, path: request.url, status, message }, 'Client error');
    }

    const errorResponse: ApiErrorResponse = {
      statusCode: status,
      message,
      error: (HttpStatus as unknown as Record<number, string>)[status] ?? 'Unknown',
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }

  private resolveException(exception: unknown): { status: number; message: string | string[] } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      const message =
        typeof res === 'object' && res !== null && 'message' in res
          ? (res as { message: string | string[] }).message
          : exception.message;
      return { status: exception.getStatus(), message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Invalid request data' };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }

  private resolvePrismaError(err: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
  } {
    switch (err.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'A record with these details already exists',
        };
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'Record not found' };
      case 'P2003':
        return { status: HttpStatus.BAD_REQUEST, message: 'Related record not found' };
      case 'P2014':
        return { status: HttpStatus.BAD_REQUEST, message: 'Relation constraint violation' };
      default:
        return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Database error' };
    }
  }
}
