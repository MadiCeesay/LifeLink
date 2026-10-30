import * as service from '../services/adminService.js';
import { listAuditLogs } from '../services/auditService.js';
export const account = async (req, res) => res.json({ success: true, data: await service.setAccountStatus(req.user._id, req.params.userId, req.body) });
export const permissions = async (req, res) => res.json({ success: true, data: await service.setStaffPermissions(req.user._id, req.params.facilityId, req.params.userId, req.body) });
export const stats = async (req, res) => res.json({ success: true, data: await service.platformStats(req.user._id) });
export const audits = async (req, res) => res.json({ success: true, data: await listAuditLogs(req.user._id, req.query) });
