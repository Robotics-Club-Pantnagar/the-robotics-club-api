import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy',
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
  getHealth() {
    return this.healthService.getHealth();
  }
}
