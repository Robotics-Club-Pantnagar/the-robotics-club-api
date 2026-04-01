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
const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
] as const;

type JsonObject = Record<string, unknown>;
type ResourceSchemaMap = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolveRef(document: JsonObject, ref: string): unknown {
  if (!ref.startsWith('#/')) {
    return null;
  }

  const segments = ref.slice(2).split('/').map(decodePointerSegment);
  let current: unknown = document;

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (Number.isNaN(index)) {
        return null;
      }
      current = current[index];
      continue;
    }

    if (!isObject(current)) {
      return null;
    }

    current = current[segment];
  }

  return current ?? null;
}

function inlineSchemaRefs(
  value: unknown,
  document: JsonObject,
  seenRefs = new Set<string>(),
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => inlineSchemaRefs(item, document, seenRefs));
  }

  if (!isObject(value)) {
    return value;
  }

  const ref = value.$ref;
  if (typeof ref === 'string') {
    if (seenRefs.has(ref)) {
      return { $ref: ref };
    }

    const resolved = resolveRef(document, ref);
    if (resolved !== null) {
      const nextSeen = new Set(seenRefs);
      nextSeen.add(ref);

      const inlined = inlineSchemaRefs(deepClone(resolved), document, nextSeen);

      const siblingEntries = Object.entries(value).filter(
        ([key]) => key !== '$ref',
      );
      if (siblingEntries.length === 0) {
        return inlined;
      }

      if (!isObject(inlined)) {
        return inlined;
      }

      const merged: JsonObject = { ...inlined };
      for (const [key, nested] of siblingEntries) {
        merged[key] = inlineSchemaRefs(nested, document, nextSeen);
      }

      return merged;
    }

    return value;
  }

  const result: JsonObject = {};
  for (const [key, nested] of Object.entries(value)) {
    result[key] = inlineSchemaRefs(nested, document, seenRefs);
  }

  return result;
}

function generateExampleFromSchema(
  schemaValue: unknown,
  document: JsonObject,
  seenRefs = new Set<string>(),
  depth = 0,
): unknown {
  if (depth > 10 || !isObject(schemaValue)) {
    return undefined;
  }

  const schema = schemaValue;

  if (schema.example !== undefined) {
    return schema.example;
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  const ref = schema.$ref;
  if (typeof ref === 'string') {
    if (seenRefs.has(ref)) {
      return undefined;
    }

    const resolved = resolveRef(document, ref);
    if (resolved !== null) {
      const nextSeen = new Set(seenRefs);
      nextSeen.add(ref);
      return generateExampleFromSchema(resolved, document, nextSeen, depth + 1);
    }
  }

  const enumValues = schema.enum;
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    return enumValues[0];
  }

  const oneOf = schema.oneOf;
  if (Array.isArray(oneOf) && oneOf.length > 0) {
    return generateExampleFromSchema(oneOf[0], document, seenRefs, depth + 1);
  }

  const anyOf = schema.anyOf;
  if (Array.isArray(anyOf) && anyOf.length > 0) {
    return generateExampleFromSchema(anyOf[0], document, seenRefs, depth + 1);
  }

  const allOf = schema.allOf;
  if (Array.isArray(allOf) && allOf.length > 0) {
    const merged: JsonObject = {};
    for (const part of allOf) {
      const partial = generateExampleFromSchema(
        part,
        document,
        seenRefs,
        depth + 1,
      );
      if (isObject(partial)) {
        Object.assign(merged, partial);
      }
    }

    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  const type = schema.type;

  if (type === 'string') {
    const format = schema.format;
    if (format === 'date-time') return '2026-01-01T10:00:00.000Z';
    if (format === 'date') return '2026-01-01';
    if (format === 'email') return 'user@example.com';
    if (format === 'uuid') return '00000000-0000-0000-0000-000000000000';
    if (format === 'uri') return 'https://example.com/resource';
    return 'string';
  }

  if (type === 'number' || type === 'integer') {
    const minimum = schema.minimum;
    return typeof minimum === 'number' ? minimum : 1;
  }

  if (type === 'boolean') {
    return true;
  }

  if (type === 'array') {
    const itemExample = generateExampleFromSchema(
      schema.items,
      document,
      seenRefs,
      depth + 1,
    );
    return itemExample === undefined ? [] : [itemExample];
  }

  if (type === 'object' || isObject(schema.properties)) {
    const properties = isObject(schema.properties) ? schema.properties : null;
    if (!properties) {
      return {};
    }

    const requiredValues = Array.isArray(schema.required)
      ? schema.required.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];

    const allKeys = Object.keys(properties);
    const requiredSet = new Set(requiredValues);
    const keys = [
      ...requiredValues,
      ...allKeys.filter((key) => !requiredSet.has(key)),
    ];

    const output: JsonObject = {};
    for (const key of keys) {
      const fieldSchema = properties[key];
      const fieldExample = generateExampleFromSchema(
        fieldSchema,
        document,
        seenRefs,
        depth + 1,
      );
      if (fieldExample !== undefined) {
        output[key] = fieldExample;
      }
    }

    return output;
  }

  return undefined;
}

function getResolvedObject(
  value: unknown,
  document: JsonObject,
): JsonObject | null {
  if (!isObject(value)) {
    return null;
  }

  const ref = value.$ref;
  if (typeof ref !== 'string') {
    return value;
  }

  const resolved = resolveRef(document, ref);
  if (!isObject(resolved)) {
    return null;
  }

  return deepClone(resolved);
}

function getJsonMedia(content: unknown): JsonObject | null {
  if (!isObject(content)) {
    return null;
  }

  const jsonMedia = content['application/json'];
  return isObject(jsonMedia) ? jsonMedia : null;
}

function getOrCreateJsonMedia(content: JsonObject): JsonObject {
  const current = content['application/json'];
  if (isObject(current)) {
    return current;
  }

  const created: JsonObject = {};
  content['application/json'] = created;
  return created;
}

function getRequestBodySchema(
  operation: JsonObject,
  document: JsonObject,
): unknown {
  const requestBody = getResolvedObject(operation.requestBody, document);
  if (!requestBody) {
    return undefined;
  }

  const jsonMedia = getJsonMedia(requestBody.content);
  if (!jsonMedia) {
    return undefined;
  }

  return jsonMedia.schema;
}

function getPathSegments(pathKey: string): string[] {
  return pathKey.split('/').filter((segment) => segment.length > 0);
}

function isPathParam(segment: string): boolean {
  return /^\{[^}]+\}$/.test(segment);
}

function getBaseResource(pathKey: string): string | undefined {
  const [base] = getPathSegments(pathKey);
  return base;
}

function isSimpleResourcePath(pathKey: string): boolean {
  const segments = getPathSegments(pathKey);
  if (segments.length === 1) {
    return true;
  }

  return segments.length === 2 && isPathParam(segments[1]);
}

function isListOperation(
  pathKey: string,
  method: string,
  operation: JsonObject,
): boolean {
  if (method !== 'get') {
    return false;
  }

  const summary =
    typeof operation.summary === 'string'
      ? operation.summary.toLowerCase()
      : '';

  if (summary.startsWith('list ') || summary.includes(' list ')) {
    return true;
  }

  const segments = getPathSegments(pathKey);
  return segments.length === 1;
}

function hasQueryParameter(
  operation: JsonObject,
  parameterName: string,
): boolean {
  const parameters = operation.parameters;
  if (!Array.isArray(parameters)) {
    return false;
  }

  return parameters.some((param) => {
    if (!isObject(param)) {
      return false;
    }

    return param.in === 'query' && param.name === parameterName;
  });
}

function isPaginatedOperation(method: string, operation: JsonObject): boolean {
  if (method !== 'get') {
    return false;
  }

  return (
    hasQueryParameter(operation, 'limit') &&
    hasQueryParameter(operation, 'offset')
  );
}

function getCollectionResourceKey(pathKey: string): string | undefined {
  const staticSegments = getPathSegments(pathKey).filter(
    (segment) => !isPathParam(segment),
  );

  if (staticSegments.length === 0) {
    return undefined;
  }

  return staticSegments[staticSegments.length - 1];
}

function createDefaultItemSchema(): JsonObject {
  return {
    type: 'object',
    additionalProperties: true,
  };
}

function createArraySchema(itemSchema?: unknown): JsonObject {
  return {
    type: 'array',
    items: itemSchema !== undefined ? itemSchema : createDefaultItemSchema(),
  };
}

function createPaginatedDataSchema(itemSchema?: unknown): JsonObject {
  return {
    type: 'object',
    required: ['items', 'total', 'limit', 'offset'],
    properties: {
      items: createArraySchema(itemSchema),
      total: {
        type: 'number',
        example: 1,
      },
      limit: {
        type: 'number',
        example: 20,
      },
      offset: {
        type: 'number',
        example: 0,
      },
    },
  };
}

function getInferredResourceSchema(
  pathKey: string,
  resourceSchemas: ResourceSchemaMap,
): unknown {
  const key = getCollectionResourceKey(pathKey);
  if (!key) {
    return undefined;
  }

  const schema = resourceSchemas[key];
  return schema !== undefined ? deepClone(schema) : undefined;
}

function buildResourceSchemaMap(
  paths: JsonObject,
  document: JsonObject,
): ResourceSchemaMap {
  const map: ResourceSchemaMap = {};

  for (const [pathKey, pathItemValue] of Object.entries(paths)) {
    if (!isObject(pathItemValue) || !isSimpleResourcePath(pathKey)) {
      continue;
    }

    const postOperation = pathItemValue.post;
    if (!isObject(postOperation)) {
      continue;
    }

    const requestBodySchema = getRequestBodySchema(postOperation, document);
    if (requestBodySchema === undefined) {
      continue;
    }

    const baseResource = getBaseResource(pathKey);
    if (!baseResource) {
      continue;
    }

    map[baseResource] = inlineSchemaRefs(requestBodySchema, document);
  }

  return map;
}

function createDefaultSuccessSchema(dataSchema?: unknown): JsonObject {
  return {
    type: 'object',
    required: ['success', 'data'],
    properties: {
      success: {
        type: 'boolean',
        example: true,
      },
      data:
        dataSchema !== undefined
          ? dataSchema
          : {
              type: 'object',
              additionalProperties: true,
            },
    },
  };
}

function hasMeaningfulSchema(schemaValue: unknown): boolean {
  if (!isObject(schemaValue)) {
    return false;
  }

  if (typeof schemaValue.$ref === 'string') {
    return true;
  }

  if (Array.isArray(schemaValue.oneOf) && schemaValue.oneOf.length > 0) {
    return true;
  }

  if (Array.isArray(schemaValue.anyOf) && schemaValue.anyOf.length > 0) {
    return true;
  }

  if (Array.isArray(schemaValue.allOf) && schemaValue.allOf.length > 0) {
    return true;
  }

  if (isObject(schemaValue.properties)) {
    return Object.keys(schemaValue.properties).length > 0;
  }

  if (schemaValue.items !== undefined) {
    return true;
  }

  if (schemaValue.additionalProperties !== undefined) {
    return true;
  }

  if (Array.isArray(schemaValue.required) && schemaValue.required.length > 0) {
    return true;
  }

  const type = schemaValue.type;
  return typeof type === 'string' && type !== 'object';
}

function isCertificatePdfOperation(pathKey: string, method: string): boolean {
  return (
    method === 'get' &&
    pathKey === '/certificates/event/{eventId}/participant/{collegeIdNo}'
  );
}

function enrichRequestBody(operation: JsonObject, document: JsonObject): void {
  const resolvedRequestBody = getResolvedObject(
    operation.requestBody,
    document,
  );
  if (!resolvedRequestBody) {
    return;
  }

  operation.requestBody = resolvedRequestBody;

  const jsonMedia = getJsonMedia(resolvedRequestBody.content);
  if (!jsonMedia) {
    return;
  }

  if (jsonMedia.schema !== undefined) {
    jsonMedia.schema = inlineSchemaRefs(jsonMedia.schema, document);
  }

  if (jsonMedia.example === undefined && jsonMedia.examples === undefined) {
    const example = generateExampleFromSchema(jsonMedia.schema, document);
    if (example !== undefined) {
      jsonMedia.example = example;
    }
  }
}

function ensureSuccessResponses(
  pathKey: string,
  method: string,
  operation: JsonObject,
  document: JsonObject,
  resourceSchemas: ResourceSchemaMap,
): void {
  const currentResponses = operation.responses;
  const responses: JsonObject = isObject(currentResponses)
    ? currentResponses
    : {};
  operation.responses = responses;

  const successCodes = Object.keys(responses).filter((statusCode) =>
    /^2\d\d$/.test(statusCode),
  );

  if (successCodes.length === 0) {
    const defaultCode = method === 'post' ? '201' : '200';
    responses[defaultCode] = { description: '' };
    successCodes.push(defaultCode);
  }

  const requestBodySchema = getRequestBodySchema(operation, document);

  for (const statusCode of successCodes) {
    const resolvedResponse = getResolvedObject(responses[statusCode], document);
    const response = resolvedResponse ?? { description: '' };
    responses[statusCode] = response;

    if (response.description === undefined) {
      response.description = '';
    }

    const content = isObject(response.content) ? response.content : {};
    response.content = content;

    if (isCertificatePdfOperation(pathKey, method)) {
      const pdfMedia = isObject(content['application/pdf'])
        ? content['application/pdf']
        : {};

      if (!isObject(pdfMedia.schema)) {
        pdfMedia.schema = {
          type: 'string',
          format: 'binary',
        };
      }

      content['application/pdf'] = pdfMedia;
      continue;
    }

    const jsonMedia = getOrCreateJsonMedia(content);

    let responseDataSchema =
      requestBodySchema !== undefined
        ? inlineSchemaRefs(requestBodySchema, document)
        : undefined;

    if (responseDataSchema === undefined) {
      const inferredSchema = getInferredResourceSchema(
        pathKey,
        resourceSchemas,
      );

      if (isPaginatedOperation(method, operation)) {
        responseDataSchema = createPaginatedDataSchema(inferredSchema);
      } else if (isListOperation(pathKey, method, operation)) {
        responseDataSchema = createArraySchema(inferredSchema);
      } else if (
        isSimpleResourcePath(pathKey) &&
        inferredSchema !== undefined
      ) {
        responseDataSchema = inferredSchema;
      }
    }

    const shouldUseExistingSchema = hasMeaningfulSchema(jsonMedia.schema);

    if (shouldUseExistingSchema) {
      jsonMedia.schema = inlineSchemaRefs(jsonMedia.schema, document);
    } else {
      jsonMedia.schema = createDefaultSuccessSchema(responseDataSchema);
    }

    if (jsonMedia.example === undefined && jsonMedia.examples === undefined) {
      const example = generateExampleFromSchema(jsonMedia.schema, document);
      if (example !== undefined) {
        jsonMedia.example = example;
      }
    }
  }
}

function removeComponentSchemasIfUnused(document: JsonObject): void {
  const hasSchemaRefs = JSON.stringify(document).includes(
    '#/components/schemas/',
  );
  if (hasSchemaRefs) {
    return;
  }

  const components = document.components;
  if (!isObject(components) || !isObject(components.schemas)) {
    return;
  }

  delete components.schemas;
  if (Object.keys(components).length === 0) {
    delete document.components;
  }
}

function postProcessDocument(document: JsonObject): void {
  const paths = document.paths;
  if (!isObject(paths)) {
    return;
  }

  const resourceSchemas = buildResourceSchemaMap(paths, document);

  for (const [pathKey, pathItemValue] of Object.entries(paths)) {
    if (!isObject(pathItemValue)) {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const operation = pathItemValue[method];
      if (!isObject(operation)) {
        continue;
      }

      enrichRequestBody(operation, document);
      ensureSuccessResponses(
        pathKey,
        method,
        operation,
        document,
        resourceSchemas,
      );
    }
  }

  removeComponentSchemasIfUnused(document);
}

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

  // Keep request params intact and enrich success responses without global error injection.
  postProcessDocument(document as unknown as JsonObject);

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
