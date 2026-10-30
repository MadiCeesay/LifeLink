import { publicUser } from '../models/User.js';
export const createAuthController = service => ({
  register: async (req, res) => res.status(201).json({ success: true, data: await service.register(req.body) }),
  login: async (req, res) => res.json({ success: true, data: await service.login(req.body) }),
  me: (req, res) => res.json({ success: true, data: { user: publicUser(req.user) } }),
});
