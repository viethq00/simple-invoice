import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  type ArgumentsHost,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { AllExceptionsFilter, toErrorBody } from './all-exceptions.filter';

describe('toErrorBody', () => {
  it('keeps the documented 404 shape', () => {
    expect(toErrorBody(new NotFoundException('Invoice not found'))).toEqual({
      statusCode: 404,
      message: 'Invoice not found',
      error: 'Not Found',
    });
  });

  it('keeps validation message arrays', () => {
    expect(
      toErrorBody(new BadRequestException(['dueDate must be on or after invoiceDate'])),
    ).toEqual({
      statusCode: 400,
      message: ['dueDate must be on or after invoiceDate'],
      error: 'Bad Request',
    });
  });

  it('fills in the reason phrase when the exception has none', () => {
    expect(toErrorBody(new UnauthorizedException())).toEqual({
      statusCode: 401,
      message: 'Unauthorized',
      error: 'Unauthorized',
    });
    expect(toErrorBody(new HttpException('Slow down', HttpStatus.TOO_MANY_REQUESTS))).toEqual({
      statusCode: 429,
      message: 'Slow down',
      error: 'Too Many Requests',
    });
  });

  it('maps throttling to a 429 in the same shape', () => {
    expect(toErrorBody(new ThrottlerException('Too many login attempts'))).toEqual({
      statusCode: 429,
      message: 'Too many login attempts',
      error: 'Too Many Requests',
    });
  });

  it('passes through intentional 5xx HTTP exceptions', () => {
    expect(toErrorBody(new ServiceUnavailableException('Database unavailable'))).toEqual({
      statusCode: 503,
      message: 'Database unavailable',
      error: 'Service Unavailable',
    });
  });

  it('maps client errors raised by Express middleware (e.g. body-parser)', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      expose: true,
    });
    expect(toErrorBody(tooLarge)).toEqual({
      statusCode: 413,
      message: 'request entity too large',
      error: 'Payload Too Large',
    });
  });

  it('hides the details of unexpected errors', () => {
    expect(toErrorBody(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=hunter2'))).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
    expect(toErrorBody('boom')).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  });

  it('uses the response object message for conflicts', () => {
    expect(toErrorBody(new ConflictException('Invoice number already exists'))).toEqual({
      statusCode: 409,
      message: 'Invoice number already exists',
      error: 'Conflict',
    });
  });
});

describe('AllExceptionsFilter', () => {
  const hostFor = (response: { status: jest.Mock; json: jest.Mock }): ArgumentsHost =>
    ({
      switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({}) }),
    }) as unknown as ArgumentsHost;

  const mockResponse = () => {
    const response = { status: jest.fn(), json: jest.fn() };
    response.status.mockReturnValue(response);
    return response;
  };

  it('writes the error body with the matching status code', () => {
    const response = mockResponse();
    new AllExceptionsFilter().catch(new NotFoundException('Invoice not found'), hostFor(response));
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Invoice not found',
      error: 'Not Found',
    });
  });

  it('logs unexpected errors with their stack', () => {
    const response = mockResponse();
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    new AllExceptionsFilter().catch(new Error('database exploded'), hostFor(response));
    expect(response.status).toHaveBeenCalledWith(500);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('database exploded'));
    log.mockRestore();
  });
});
