import * as service from '../services/donationService.js';
export const confirm = async (req, res) => res.json({ success: true, data: await service.confirmDonation(req.user._id, req.params.requestId, req.body) });
export const own = async (req, res) => res.json({ success: true, data: await service.ownDonations(req.user._id, req.query) });
export const requestHistory = async (req, res) => res.json({ success: true, data: await service.requestDonations(req.user._id, req.params.requestId, req.query) });
export const adminHistory = async (req, res) => res.json({ success: true, data: await service.adminDonations(req.user._id, req.query) });
