import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    const dbCheck = await this.checkDatabase();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbCheck,
      environment: process.env.NODE_ENV || 'development',
    };
  }

  private async checkDatabase() {
    try {
      // Simple query to verify database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'connected',
        message: 'Database connection is healthy',
      };
    } catch (error) {
      return {
        status: 'disconnected',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
