import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators';
import { ErrorResponseDto } from '../common/error-response.dto';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Health check (API + database connectivity)' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } },
  })
  @ApiServiceUnavailableResponse({ type: ErrorResponseDto, description: 'Database unavailable.' })
  async check(): Promise<{ status: 'ok' }> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
    return { status: 'ok' };
  }
}
