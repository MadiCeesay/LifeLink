import SwaggerParser from '@apidevtools/swagger-parser';
import { readFileSync } from 'node:fs';
const spec = JSON.parse(readFileSync(new URL('../docs/openapi.json', import.meta.url), 'utf8'));
await SwaggerParser.validate(spec);
console.log('OpenAPI validation passed.');
