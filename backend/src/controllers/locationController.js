import * as service from '../services/locationService.js';
export const createLocationController = config => ({
  get: async (req, res) => res.json({ success: true, data: await service.getOwnLocation(req.user._id, config) }),
  availability: async (req, res) => res.json({ success: true, data: await service.setAvailability(req.user._id, req.body, config) }),
  sharing: async (req, res) => res.json({ success: true, data: await service.setLocationSharing(req.user._id, req.body, config) }),
  update: async (req, res) => res.json({ success: true, data: await service.updateOwnLocation(req.user._id, req.body, config) }),
  clear: async (req, res) => res.json({ success: true, data: await service.clearOwnLocation(req.user._id, req.body, config) }),
});
