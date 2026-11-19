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
export async function initializeDatabase() {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('Phase 2 requires MongoDB transactions: use a replica set or sharded cluster');
  await Promise.all([User.init(), Facility.init(), VerificationEvent.init(), AdminBootstrap.init(), BloodRequest.init(), Notification.init(), Broadcast.init(), DonorResponse.init(), Donation.init(), AuditLog.init(), OtpCode.init(), PushSubscription.init()]);
}
