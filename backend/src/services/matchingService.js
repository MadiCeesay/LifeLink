import { User } from '../models/User.js';
import { parseInput } from '../utils/parseInput.js';
import { candidateSearchSchema, progressiveSearchSchema, matchingConfigSchema, matchingTimeSchema } from '../validators/matching.js';
import { buildCandidatePipeline } from './matchingQuery.js';
export function createMatchingService(config, { clock = () => new Date() } = {}) {
  const { maxAgeMinutes, radiusStagesKm, donationPauseDays } = parseInput(matchingConfigSchema, {
    donationPauseDays: config?.DONATION_MATCHING_PAUSE_DAYS,
    maxAgeMinutes: config?.DONOR_LOCATION_MAX_AGE_MINUTES,
    radiusStagesKm: config?.MATCH_RADIUS_STAGES_KM,
  }, 'matching configuration');
  async function search(input) {
    const candidates = await User.aggregate(buildCandidatePipeline(input, maxAgeMinutes, donationPauseDays));
    return { candidates, candidateCount: candidates.length, radiusUsedKm: input.radiusKm };
  }
  function searchTime(now) {
    // Clone the trusted clock value so callers cannot mutate it during an async search.
    return new Date(parseInput(matchingTimeSchema, now ?? clock(), 'matching time').getTime());
  }
  return {
    async findCandidates(input) {
      const data = parseInput(candidateSearchSchema, input);
      return search({ ...data, now: searchTime(data.now) });
    },
    async findCandidatesProgressively(input) {
      const data = parseInput(progressiveSearchSchema, input);
      const now = searchTime(data.now);
      const stagesSearched = [];
      let result;
      for (const radiusKm of radiusStagesKm) {
        // Replace the previous cumulative result: never union potentially revoked donors.
        result = await search({ recipientBloodType: data.recipientBloodType, requestLocation: data.requestLocation, radiusKm, limit: data.desiredCandidates, now, excludedDonorIds: data.excludedDonorIds });
        stagesSearched.push({ radiusKm, candidateCount: result.candidateCount });
        if (result.candidateCount >= data.desiredCandidates) break;
      }
      return { ...result, targetReached: result.candidateCount >= data.desiredCandidates, stagesSearched };
    },
  };
}
