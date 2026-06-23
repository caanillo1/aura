import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

const PRISMA_MESSAGES: Record<string, string> = {
  P2002: 'Ya existe un registro con ese valor (duplicado).',
  P2003: 'No se puede realizar la operación porque hay datos relacionados.',
  P2014: 'La relación requerida no existe.',
  P2025: 'No se encontró el registro a actualizar o eliminar.',
  P2034: 'Conflicto de escritura simultánea. Intente de nuevo.',
};

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientUnknownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientUnknownRequestError, host: ArgumentsHost) {
    const ctx  = host.switchToHttp();
    const res  = ctx.getResponse<Response>();

    let status  = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error de base de datos.';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const custom = PRISMA_MESSAGES[exception.code];
      if (custom) {
        message = custom;
        status  = HttpStatus.UNPROCESSABLE_ENTITY;
      }
      this.logger.error(`Prisma ${exception.code}: ${exception.message}`);
    } else {
      this.logger.error(`Prisma unknown: ${exception.message}`);
    }

    res.status(status).json({ statusCode: status, message });
  }
}
