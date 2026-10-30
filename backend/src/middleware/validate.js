import { parseInput } from '../utils/parseInput.js';
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const data = parseInput(schema, req[source], source === 'body' ? 'request body' : source);
  req.validated ??= {};
  req.validated[source] = data;
  if (source === 'body') req.body = data;
  next();
};
