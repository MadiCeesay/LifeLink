import { AuditLog } from '../models/AuditLog.js';
import { Donation } from '../models/Donation.js';
import { Notification } from '../models/Notification.js';
import { Broadcast } from '../models/Broadcast.js';
import { DonorResponse } from '../models/DonorResponse.js';
import { BloodRequest } from '../models/BloodRequest.js';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Facility } from '../models/Facility.js';
import { VerificationEvent } from '../models/VerificationEvent.js';
import { AdminBootstrap } from '../models/AdminBootstrap.js';
import { OtpCode } from '../models/OtpCode.js';
import { PushSubscription } from '../models/PushSubscription.js';
// Older versions required an email on every account (non-sparse unique index). Phone-only donors
// need a sparse index, so replace the old one once if it is still there.
async function migrateEmailIndex() {
  const users = mongoose.connection.db.collection('users');
  const indexes = await users.indexes().catch(() => []);
  const old = indexes.find(i => i.name === 'email_1' && !i.sparse);
  if (old) await users.dropIndex('email_1');
}
export async function initializeDatabase() {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('Phase 2 requires MongoDB transactions: use a replica set or sharded cluster');
  await migrateEmailIndex();
  const models = [User, Facility, VerificationEvent, AdminBootstrap, BloodRequest, Notification, Broadcast, DonorResponse, Donation, AuditLog, OtpCode, PushSubscription];
  await Promise.all(models.map(m => m.init()));
  await Promise.all(models.map(m => m.createIndexes()));
}
