import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Simple health check endpoint (fast)' })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy',
    schema: {
      example: {
        status: 'healthy',
        timestamp: '2026-04-13T10:00:00.000Z',
        uptime: 12345.67,
        environment: 'production',
      },
    },
  })
  getSimpleHealth() {
    return this.healthService.getSimpleHealth();
  }

  @Get('deep')
  @ApiOperation({
    summary: 'Deep health check endpoint (includes database connectivity)',
  })
  @ApiResponse({
    status: 200,
    description: 'Application and database are healthy',
    schema: {
      example: {
        status: 'healthy',
        timestamp: '2026-04-13T10:00:00.000Z',
        uptime: 12345.67,
        database: {
          status: 'connected',
          message: 'Database connection is healthy',
        },
        environment: 'production',
      },
    },
  })
  async getDeepHealth() {
    return this.healthService.getDeepHealth();
  }
}
