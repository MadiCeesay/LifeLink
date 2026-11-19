import { publicUser } from '../models/User.js';
export const createAuthController = service => ({
  options: (_req, res) => res.json({ success: true, data: service.options() }),
  register: async (req, res) => res.status(201).json({ success: true, data: await service.register(req.body) }),
  login: async (req, res) => res.json({ success: true, data: await service.login(req.body) }),
  requestCode: async (req, res) => res.json({ success: true, data: await service.requestCode(req.body) }),
  verifyCode: async (req, res) => res.json({ success: true, data: await service.verifyCode(req.body) }),
  completeSignup: async (req, res) => res.status(201).json({ success: true, data: await service.completeSignup(req.body) }),
  resetPassword: async (req, res) => res.json({ success: true, data: await service.resetPassword(req.body) }),
  me: (req, res) => res.json({ success: true, data: { user: publicUser(req.user) } }),
});
