import { AppError } from './errors.js';
export function parseInput(schema, input, source = 'input') {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError(400, 'VALIDATION_ERROR', `Invalid ${source}`, result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
  return result.data;
}
