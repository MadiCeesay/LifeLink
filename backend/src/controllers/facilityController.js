import * as service from '../services/facilityService.js';
export const create = async (req, res) => res.status(201).json({ success: true, data: await service.createFacility(req.user._id, req.body) });
export const list = async (req, res) => res.json({ success: true, data: await service.listFacilities(req.user._id, req.validated.query) });
export const get = async (req, res) => res.json({ success: true, data: await service.getFacility(req.user._id, req.params.facilityId) });
export const transition = action => async (req, res) => res.json({ success: true, data: await service.transitionFacility(req.user._id, req.params.facilityId, action, req.body) });
export const provision = async (req, res) => res.status(201).json({ success: true, data: await service.provisionStaff(req.user._id, req.params.facilityId, req.body) });
export const own = async (req, res) => res.json({ success: true, data: await service.ownFacility(req.user._id) });
export const location = async (req, res) => res.json({ success: true, data: await service.setFacilityLocation(req.user._id, req.params.facilityId, req.body) });
