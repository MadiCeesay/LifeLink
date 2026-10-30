import { recordAudit } from './auditService.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { AdminBootstrap } from '../models/AdminBootstrap.js';
import { identityShape } from '../validators/account.js';
import { parseInput } from '../utils/parseInput.js';
import { AppError } from '../utils/errors.js';
const schema = z.object(identityShape).strict();
export async function bootstrapAdmin(input) {
  const data = parseInput(schema, input);
  const password = await bcrypt.hash(data.password, 12);
  try {
    return await mongoose.connection.transaction(async session => {
      if (await User.exists({ role: 'ADMIN' }).session(session)) throw new AppError(409, 'BOOTSTRAP_DISABLED', 'An administrator already exists');
      const id = new mongoose.Types.ObjectId();
      await AdminBootstrap.create([{ _id: 'initial-admin', createdBy: id }], { session });
      const [admin] = await User.create([{ _id: id, name: data.name, email: data.email, phone: data.phone, password, role: 'ADMIN' }], { session });
      await recordAudit(session, admin._id, 'ADMIN_BOOTSTRAPPED', 'User', admin._id);
      return { id: admin.id, email: admin.email };
    });
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, 'BOOTSTRAP_CONFLICT', 'Bootstrap is already complete or the email is in use');
    throw error;
  }
}
