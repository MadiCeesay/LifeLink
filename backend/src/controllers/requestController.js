import * as service from '../services/requestService.js';
export const createRequestController = config => ({
  create: async (req, res) => res.status(201).json({ success: true, data: await service.createBloodRequest(req.user._id, req.body, config) }),
  list: async (req, res) => res.json({ success: true, data: await service.listBloodRequests(req.user._id, req.query) }),
  get: async (req, res) => res.json({ success: true, data: await service.getBloodRequest(req.user._id, req.params.requestId) }),
  cancel: async (req, res) => res.json({ success: true, data: await service.cancelBloodRequest(req.user._id, req.params.requestId, req.body) }),
});
