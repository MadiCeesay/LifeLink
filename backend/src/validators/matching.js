import { z } from 'zod';
import { objectId } from './facility.js';
import { BLOOD_TYPES } from '../config/domain.js';
import { MATCHING_LIMITS } from '../config/matching.js';
import { geoPointSchema } from './location.js';
export const bloodTypeSchema = z.enum(BLOOD_TYPES);
export const radiusSchema = z.number().finite().positive().max(MATCHING_LIMITS.maxRadiusKm);
export const radiusStagesSchema = z.array(radiusSchema).min(1).max(MATCHING_LIMITS.maxStages).refine(values => values.every((radius, i) => i === 0 || radius > values[i - 1]), 'Radius stages must be unique and strictly ascending');
export const radiusStagesEnvSchema = z.string().default('5,10,20,40')
  .transform(value => value.split(',').map(token => token.trim()))
  .pipe(z.array(z.string().regex(/^(?:\d+(?:\.\d+)?|\.\d+)$/, 'Use comma-separated positive decimal radii').transform(Number)))
  .pipe(radiusStagesSchema);
const candidateLimit = z.number().int().min(1).max(MATCHING_LIMITS.maxCandidates);
const common = { excludedDonorIds: z.array(objectId).max(1000).default([]), recipientBloodType: bloodTypeSchema, requestLocation: geoPointSchema, now: z.date().optional() };
export const candidateSearchSchema = z.object({ ...common, radiusKm: radiusSchema, limit: candidateLimit.default(MATCHING_LIMITS.defaultCandidates) }).strict();
export const progressiveSearchSchema = z.object({ ...common, desiredCandidates: candidateLimit.default(MATCHING_LIMITS.defaultCandidates) }).strict();
export const matchingConfigSchema = z.object({ donationPauseDays: z.number().int().min(1).max(365).default(56), maxAgeMinutes: z.number().int().min(1).max(10080), radiusStagesKm: radiusStagesSchema }).strict();
export const matchingTimeSchema = z.date();
export const compatibilityPairSchema = z.object({ donorBloodType: bloodTypeSchema, recipientBloodType: bloodTypeSchema }).strict();
