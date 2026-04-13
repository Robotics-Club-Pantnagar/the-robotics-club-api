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
const API_DESCRIPTION = [
  'API for the college robotics club management platform.',
  '',
  '## Response Envelope',
  'Successful JSON responses follow this shape:',
  '',
  '```json',
  '{',
  '  "success": true,',
  '  "data": {}',
  '}',
  '```',
  '',
  'Generated response data DTOs are emitted as separate schemas in components.schemas using the pattern <Operation>_<Status>Data.',
  '',
  '## Pagination',
  'Paginated endpoints accept query params `limit` and `offset`.',
  'Their `data` object follows the shared `CommonPaginatedData` structure: `items`, `total`, `limit`, and `offset`.',
  '',
  '## Common Error Response',
  'Errors follow this shape:',
  '',
  '```json',
  '{',
  '  "success": false,',
  '  "error": {',
  '    "code": "VALIDATION_ERROR",',
  '    "message": "Invalid data provided",',
  '    "details": {}',
  '  }',
  '}',
  '```',
  '',
  'Reusable error schemas and response templates are available in components.schemas and components.responses.',
].join('\n');

type JsonObject = Record<string, unknown>;
type ResourceSchemaMap = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function ensureObjectProperty(target: JsonObject, key: string): JsonObject {
  const current = target[key];
  if (isObject(current)) {
    return current;
  }

  const created: JsonObject = {};
  target[key] = created;
  return created;
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

function getOrCreateComponentSchemas(document: JsonObject): JsonObject {
  const components = ensureObjectProperty(document, 'components');
  return ensureObjectProperty(components, 'schemas');
}

function getOrCreateComponentResponses(document: JsonObject): JsonObject {
  const components = ensureObjectProperty(document, 'components');
  return ensureObjectProperty(components, 'responses');
}

function toSchemaNameSegment(rawValue: string): string {
  const sanitized = rawValue
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (sanitized.length === 0) {
    return 'Operation';
  }

  return /^[A-Za-z_]/.test(sanitized) ? sanitized : `_${sanitized}`;
}

function getOperationSchemaBaseName(
  pathKey: string,
  method: string,
  statusCode: string,
  operation: JsonObject,
): string {
  const operationId =
    typeof operation.operationId === 'string' &&
    operation.operationId.length > 0
      ? operation.operationId
      : `${method}_${pathKey}`;

  return toSchemaNameSegment(`${operationId}_${statusCode}`);
}

function createSuccessResponseSchemaFromDataRef(
  dataSchemaRef: string,
): JsonObject {
  return {
    allOf: [
      { $ref: '#/components/schemas/CommonSuccessEnvelope' },
      {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            $ref: dataSchemaRef,
          },
        },
      },
    ],
  };
}

function extractDataSchemaFromResponseSchema(schemaValue: unknown): unknown {
  if (!isObject(schemaValue)) {
    return undefined;
  }

  const properties = schemaValue.properties;
  if (isObject(properties) && properties.data !== undefined) {
    return deepClone(properties.data);
  }

  const allOf = schemaValue.allOf;
  if (Array.isArray(allOf)) {
    for (const part of allOf) {
      const extracted = extractDataSchemaFromResponseSchema(part);
      if (extracted !== undefined) {
        return extracted;
      }
    }
  }

  return undefined;
}

function isSuccessEnvelopeSchema(schemaValue: unknown): boolean {
  if (!isObject(schemaValue)) {
    return false;
  }

  const properties = schemaValue.properties;
  if (isObject(properties)) {
    return properties.success !== undefined && properties.data !== undefined;
  }

  const allOf = schemaValue.allOf;
  if (Array.isArray(allOf)) {
    return allOf.some((part) => isSuccessEnvelopeSchema(part));
  }

  return false;
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

function createPaginatedDataSchemaFromCommon(itemSchema?: unknown): JsonObject {
  return {
    allOf: [
      {
        $ref: '#/components/schemas/CommonPaginatedData',
      },
      {
        type: 'object',
        required: ['items'],
        properties: {
          items: createArraySchema(itemSchema),
        },
      },
    ],
  };
}

function ensureOperationItemSchema(
  componentSchemas: JsonObject,
  schemaName: string,
  itemSchema?: unknown,
): JsonObject {
  componentSchemas[schemaName] =
    itemSchema !== undefined
      ? deepClone(itemSchema)
      : createDefaultItemSchema();

  return {
    $ref: `#/components/schemas/${schemaName}`,
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

    const baseResource = getBaseResource(pathKey);
    if (!baseResource || map[baseResource] !== undefined) {
      continue;
    }

    const candidateOperations = [
      pathItemValue.post,
      pathItemValue.patch,
      pathItemValue.put,
    ];

    let requestBodySchema: unknown;
    for (const candidateOperation of candidateOperations) {
      if (!isObject(candidateOperation)) {
        continue;
      }

      requestBodySchema = getRequestBodySchema(candidateOperation, document);
      if (requestBodySchema !== undefined) {
        break;
      }
    }

    if (requestBodySchema === undefined) {
      continue;
    }

    map[baseResource] = deepClone(requestBodySchema);
  }

  return map;
}

function ensureSharedDocumentationComponents(document: JsonObject): void {
  const schemas = getOrCreateComponentSchemas(document);
  const responses = getOrCreateComponentResponses(document);

  schemas.CommonSuccessEnvelope = {
    type: 'object',
    required: ['success'],
    properties: {
      success: {
        type: 'boolean',
        example: true,
      },
    },
    description: 'Shared success envelope for JSON responses.',
  };

  const paginatedDataSchema = createPaginatedDataSchema();
  paginatedDataSchema.description =
    'Shared pagination object used under the `data` key for paginated endpoints.';
  schemas.CommonPaginatedData = paginatedDataSchema;

  schemas.CommonErrorDetails = {
    type: 'object',
    additionalProperties: true,
    description: 'Optional extra error context.',
  };

  schemas.CommonErrorBody = {
    type: 'object',
    required: ['code', 'message'],
    properties: {
      code: {
        type: 'string',
        example: 'VALIDATION_ERROR',
      },
      message: {
        type: 'string',
        example: 'Invalid data provided',
      },
      details: {
        $ref: '#/components/schemas/CommonErrorDetails',
      },
    },
  };

  schemas.CommonErrorEnvelope = {
    type: 'object',
    required: ['success', 'error'],
    properties: {
      success: {
        type: 'boolean',
        example: false,
      },
      error: {
        $ref: '#/components/schemas/CommonErrorBody',
      },
    },
  };

  const commonErrorResponseContent = {
    'application/json': {
      schema: {
        $ref: '#/components/schemas/CommonErrorEnvelope',
      },
    },
  };

  responses.CommonBadRequest = {
    description: 'Validation error or malformed request.',
    content: {
      ...commonErrorResponseContent,
      'application/json': {
        ...commonErrorResponseContent['application/json'],
        example: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid data provided',
          },
        },
      },
    },
  };

  responses.CommonUnauthorized = {
    description: 'Authentication required or token invalid.',
    content: {
      ...commonErrorResponseContent,
      'application/json': {
        ...commonErrorResponseContent['application/json'],
        example: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
          },
        },
      },
    },
  };

  responses.CommonForbidden = {
    description: 'Authenticated but missing required permissions.',
    content: {
      ...commonErrorResponseContent,
      'application/json': {
        ...commonErrorResponseContent['application/json'],
        example: {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Forbidden resource',
          },
        },
      },
    },
  };

  responses.CommonNotFound = {
    description: 'Requested resource not found.',
    content: {
      ...commonErrorResponseContent,
      'application/json': {
        ...commonErrorResponseContent['application/json'],
        example: {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Record not found',
          },
        },
      },
    },
  };

  responses.CommonConflict = {
    description: 'Conflict with existing data or state.',
    content: {
      ...commonErrorResponseContent,
      'application/json': {
        ...commonErrorResponseContent['application/json'],
        example: {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'A record with this value already exists',
          },
        },
      },
    },
  };

  responses.CommonRateLimited = {
    description: 'Too many requests in a short period.',
    content: {
      ...commonErrorResponseContent,
      'application/json': {
        ...commonErrorResponseContent['application/json'],
        example: {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
          },
        },
      },
    },
  };

  responses.CommonInternalError = {
    description: 'Unexpected server-side failure.',
    content: {
      ...commonErrorResponseContent,
      'application/json': {
        ...commonErrorResponseContent['application/json'],
        example: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        },
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
  const componentSchemas = getOrCreateComponentSchemas(document);
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
  const shouldGenerateAutoExample = !pathKey.startsWith('/members');

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
    const operationSchemaBaseName = getOperationSchemaBaseName(
      pathKey,
      method,
      statusCode,
      operation,
    );
    const responseSchemaName = `${operationSchemaBaseName}Response`;
    const itemSchemaName = `${operationSchemaBaseName}Item`;
    const shouldUseExistingSchema = hasMeaningfulSchema(jsonMedia.schema);

    if (shouldUseExistingSchema) {
      const normalizedResponseSchema = deepClone(jsonMedia.schema);
      const extractedDataSchema = isSuccessEnvelopeSchema(
        normalizedResponseSchema,
      )
        ? extractDataSchemaFromResponseSchema(normalizedResponseSchema)
        : undefined;

      if (extractedDataSchema !== undefined) {
        componentSchemas[responseSchemaName] = normalizedResponseSchema;
        componentSchemas[`${operationSchemaBaseName}Data`] =
          extractedDataSchema;
      } else {
        const dataSchemaName = `${operationSchemaBaseName}Data`;
        componentSchemas[dataSchemaName] = normalizedResponseSchema;
        componentSchemas[responseSchemaName] =
          createSuccessResponseSchemaFromDataRef(
            `#/components/schemas/${dataSchemaName}`,
          );
      }

      jsonMedia.schema = {
        $ref: `#/components/schemas/${responseSchemaName}`,
      };

      if (
        shouldGenerateAutoExample &&
        jsonMedia.example === undefined &&
        jsonMedia.examples === undefined
      ) {
        const example = generateExampleFromSchema(jsonMedia.schema, document);
        if (example !== undefined) {
          jsonMedia.example = example;
        }
      }

      continue;
    }

    let responseDataSchema =
      requestBodySchema !== undefined
        ? deepClone(requestBodySchema)
        : undefined;

    if (responseDataSchema === undefined) {
      const inferredSchema = getInferredResourceSchema(
        pathKey,
        resourceSchemas,
      );

      if (isPaginatedOperation(method, operation)) {
        const itemSchemaRef = ensureOperationItemSchema(
          componentSchemas,
          itemSchemaName,
          inferredSchema,
        );
        responseDataSchema = createPaginatedDataSchemaFromCommon(itemSchemaRef);
      } else if (isListOperation(pathKey, method, operation)) {
        const itemSchemaRef = ensureOperationItemSchema(
          componentSchemas,
          itemSchemaName,
          inferredSchema,
        );
        responseDataSchema = createArraySchema(itemSchemaRef);
      } else if (
        method === 'get' &&
        isSimpleResourcePath(pathKey) &&
        inferredSchema !== undefined
      ) {
        responseDataSchema = inferredSchema;
      }
    }

    const normalizedDataSchema =
      responseDataSchema !== undefined
        ? responseDataSchema
        : {
            type: 'object',
            additionalProperties: true,
          };

    const dataSchemaName = `${operationSchemaBaseName}Data`;
    componentSchemas[dataSchemaName] = normalizedDataSchema;
    componentSchemas[responseSchemaName] =
      createSuccessResponseSchemaFromDataRef(
        `#/components/schemas/${dataSchemaName}`,
      );

    jsonMedia.schema = {
      $ref: `#/components/schemas/${responseSchemaName}`,
    };

    if (
      shouldGenerateAutoExample &&
      jsonMedia.example === undefined &&
      jsonMedia.examples === undefined
    ) {
      const example = generateExampleFromSchema(jsonMedia.schema, document);
      if (example !== undefined) {
        jsonMedia.example = example;
      }
    }
  }
}

function addResponseRefIfMissing(
  responses: JsonObject,
  statusCode: string,
  componentResponseName: string,
): void {
  if (responses[statusCode] !== undefined) {
    return;
  }

  responses[statusCode] = {
    $ref: `#/components/responses/${componentResponseName}`,
  };
}

function hasOperationSecurity(operation: JsonObject): boolean {
  return Array.isArray(operation.security) && operation.security.length > 0;
}

function ensureCommonErrorResponses(
  pathKey: string,
  method: string,
  operation: JsonObject,
): void {
  const currentResponses = operation.responses;
  const responses: JsonObject = isObject(currentResponses)
    ? currentResponses
    : {};
  operation.responses = responses;

  addResponseRefIfMissing(responses, '400', 'CommonBadRequest');
  addResponseRefIfMissing(responses, '429', 'CommonRateLimited');
  addResponseRefIfMissing(responses, '500', 'CommonInternalError');

  if (hasOperationSecurity(operation)) {
    addResponseRefIfMissing(responses, '401', 'CommonUnauthorized');
    addResponseRefIfMissing(responses, '403', 'CommonForbidden');
  }

  if (pathKey.includes('{')) {
    addResponseRefIfMissing(responses, '404', 'CommonNotFound');
  }

  if (method === 'post' || method === 'put' || method === 'patch') {
    addResponseRefIfMissing(responses, '409', 'CommonConflict');
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

  ensureSharedDocumentationComponents(document);

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
      ensureCommonErrorResponses(pathKey, method, operation);
    }
  }

  removeComponentSchemasIfUnused(document);
}

async function generateDocs() {
  // Create a minimal app instance (no listening)
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  // Load package.json version
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(
    fs.readFileSync(packageJsonPath, 'utf-8'),
  ) as Record<string, unknown>;
  const apiVersion = (packageJson.version as string) || '1.0.0';

  // Build OpenAPI document configuration
  const config = new DocumentBuilder()
    .setTitle('The Robotics Club API')
    .setDescription(API_DESCRIPTION)
    .setVersion(apiVersion)
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

  const hasExistingYaml = fs.existsSync(YAML_PATH);

  if (newHash === existingHash && hasExistingYaml) {
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
