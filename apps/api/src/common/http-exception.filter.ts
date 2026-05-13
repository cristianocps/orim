import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    if (exception instanceof ZodError) {
      response.status(HttpStatus.BAD_REQUEST).send({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Validation failed',
        details: exception.issues,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any)?.message ?? exception.message
        : 'Internal server error';

    response.status(status).send({
      statusCode: status,
      error: typeof message === 'string' ? message : message[0] ?? 'Error',
      timestamp: new Date().toISOString(),
    });
  }
}
