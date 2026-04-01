import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../app.module';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'js-yaml';

// Use process.cwd() to always resolve from project root
const DOCS_DIR = path.join(process.cwd(), 'docs');
const YAML_PATH = path.join(DOCS_DIR, 'openapi.yaml');
const HASH_PATH = path.join(DOCS_DIR, '.openapi.hash');

async function generateDocs() {
  // Create a minimal app instance (no listening)
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  // Build OpenAPI document configuration
  const config = new DocumentBuilder()
    .setTitle('The Robotics Club API')
    .setDescription('API for the college robotics club management platform')
    .setVersion('1.0.0')
    .addServer('http://localhost:3000', 'Local Development')
    .addServer('https://api.roboticsclub.example.com', 'Production')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Clerk JWT token for participants (external users)',
      },
      'user-auth',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Clerk JWT token for club members/admins',
      },
      'team-auth',
    )
    .addTag('Colleges', 'College management endpoints')
    .addTag('Departments', 'Department management endpoints')
    .addTag('Events', 'Event management and registration endpoints')
    .addTag('Participants', 'External participant management endpoints')
    .addTag('Teams', 'Event team management endpoints')
    .addTag('Members', 'Club member management endpoints')
    .addTag('Positions', 'Member position management endpoints')
    .addTag('Projects', 'Project portfolio management endpoints')
    .addTag('Blogs', 'Blog post management endpoints')
    .addTag('Certificates', 'Certificate generation endpoints')
    .build();

  // Generate OpenAPI document
  const document = SwaggerModule.createDocument(app, config);

  // Convert to JSON string for hashing
  const jsonContent = JSON.stringify(document, null, 2);

  // Compute SHA256 hash
  const newHash = crypto.createHash('sha256').update(jsonContent).digest('hex');

  // Ensure docs directory exists
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  // Check existing hash
  let existingHash = '';
  if (fs.existsSync(HASH_PATH)) {
    existingHash = fs.readFileSync(HASH_PATH, 'utf-8').trim();
  }

  if (newHash === existingHash) {
    console.log('✓ No API changes detected. Skipping regeneration.');
    await app.close();
    process.exit(0);
  }

  // Convert to YAML and write
  const yamlContent = yaml.dump(document, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });

  fs.writeFileSync(YAML_PATH, yamlContent, 'utf-8');
  fs.writeFileSync(HASH_PATH, newHash, 'utf-8');

  console.log('✓ OpenAPI specification regenerated successfully!');
  console.log(`  Output: ${YAML_PATH}`);
  console.log(`  Hash: ${newHash.substring(0, 16)}...`);

  await app.close();
  process.exit(0);
}

generateDocs().catch((error) => {
  console.error('Failed to generate API documentation:', error);
  process.exit(1);
});
