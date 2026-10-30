import { describe, it, expect } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import { createMatchingService } from '../src/services/matchingService.js';
const env = { MONGODB_URI: 'mongodb://127.0.0.1/test', JWT_SECRET: 'phase-four-test-secret-at-least-32-characters' };
const valid = { recipientBloodType: 'O+', requestLocation: { type: 'Point', coordinates: [-16.6769, 13.4549] }, radiusKm: 5 };
describe('matching environment configuration', () => {
  it('uses validated ascending defaults', () => { expect(parseEnv(env).MATCH_RADIUS_STAGES_KM).toEqual([5, 10, 20, 40]); });
  it.each([['1,5,10', [1, 5, 10]], [' 0.5, 5.25, 500 ', [0.5, 5.25, 500]], ['500', [500]]])('parses valid stages %s', (input, expected) => {
    expect(parseEnv({ ...env, MATCH_RADIUS_STAGES_KM: input }).MATCH_RADIUS_STAGES_KM).toEqual(expected);
  });
  it.each(['', ' ', '0,5', '-1,5', '5,5', '5,5.0', '10,5', '5,,10', ',5', '5,', '5,hello', 'NaN', 'Infinity', '501', '5,1000', '[5,10]', '5;10', '0x10', '1e1', '1,2,3,4,5,6,7,8,9,10,11'])('rejects malformed/unsafe stages: %s', value => {
    expect(() => parseEnv({ ...env, MATCH_RADIUS_STAGES_KM: value })).toThrow('Invalid environment configuration: MATCH_RADIUS_STAGES_KM');
  });
  it('retains location freshness configuration and its validation', () => {
    expect(parseEnv({ ...env, DONOR_LOCATION_MAX_AGE_MINUTES: '15' }).DONOR_LOCATION_MAX_AGE_MINUTES).toBe(15);
    expect(() => parseEnv({ ...env, DONOR_LOCATION_MAX_AGE_MINUTES: '0' })).toThrow('DONOR_LOCATION_MAX_AGE_MINUTES');
  });
});
describe('internal engine validates input before touching MongoDB', () => {
  const engine = createMatchingService(parseEnv(env));
  it.each([0, -1, 501, NaN, Infinity, '5', null])('rejects unsafe radius: %s', radiusKm => {
    return expect(engine.findCandidates({ ...valid, radiusKm })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it.each([0, -1, 1.5, 101, Infinity, '5', null])('rejects unsafe limit: %s', limit => {
    return expect(engine.findCandidates({ ...valid, limit })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it.each([0, -1, 1.5, 101, Infinity, '5', null])('rejects unsafe progressive target: %s', desiredCandidates => {
    return expect(engine.findCandidatesProgressively({ recipientBloodType: valid.recipientBloodType, requestLocation: valid.requestLocation, desiredCandidates })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it.each([
    { recipientBloodType: 'UNKNOWN' }, { recipientBloodType: null }, { now: new Date('invalid') }, { now: '2026-10-30' },
    { requestLocation: { type: 'Point', coordinates: [181, 13] } },
    { requestLocation: { type: 'Point', coordinates: [-16, 91] } },
    { requestLocation: { type: 'Point', coordinates: ['-16', 13] } },
    { requestLocation: { type: 'Point', coordinates: [-16, NaN] } },
    { requestLocation: { type: 'Point', coordinates: [-16, Infinity] } },
    { requestLocation: { type: 'Point', coordinates: [-16, 13, 1] } },
    { requestLocation: { coordinates: [-16, 13] } }, { donorId: 'forged' },
  ])('rejects invalid search input %#', patch => {
    return expect(engine.findCandidates({ ...valid, ...patch })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('validates an injected clock value', async () => {
    const invalidClock = createMatchingService(parseEnv(env), { clock: () => new Date('invalid') });
    await expect(invalidClock.findCandidates(valid)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it.each([[5, 5], [10, 5], [0, 5], [-1, 5], [501], [], ['5', 10]].map(stages => ({ stages })))('validates direct factory configuration %#', ({ stages }) => {
    expect(() => createMatchingService({ DONOR_LOCATION_MAX_AGE_MINUTES: 60, MATCH_RADIUS_STAGES_KM: stages })).toThrow();
  });
});
