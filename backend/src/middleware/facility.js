import { requireFacilityStaff } from '../services/authorizationService.js';
export const approvedFacility = async (req, _res, next) => {
  req.facilityContext = await requireFacilityStaff(req.user._id);
  next();
};
