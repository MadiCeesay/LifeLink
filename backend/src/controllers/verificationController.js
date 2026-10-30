import * as service from '../services/verificationService.js';
export const own = async (req, res) => res.json({ success: true, data: await service.ownVerification(req.user._id) });
export const lookup = async (req, res) => res.json({ success: true, data: await service.donorForVerification(req.user._id, req.params.donorId) });
export const verify = async (req, res) => res.json({ success: true, data: await service.verifyDonor(req.user._id, req.params.donorId, req.body) });
export const changeStatus = async (req, res) => res.json({ success: true, data: await service.changeVerificationStatus(req.user._id, req.params.donorId, req.body) });
export const history = async (req, res) => res.json({ success: true, data: await service.verificationHistory(req.user._id, req.params.donorId, req.validated.query) });
