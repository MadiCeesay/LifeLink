import mongoose from 'mongoose';
// A singleton marker prevents concurrent initial-admin provisioning.
const schema = new mongoose.Schema({ _id: String, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, createdAt: { type: Date, default: Date.now } }, { versionKey: false });
export const AdminBootstrap = mongoose.model('AdminBootstrap', schema);
