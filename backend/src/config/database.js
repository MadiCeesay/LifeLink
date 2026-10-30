import mongoose from 'mongoose';
export async function connectDatabase(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}
export async function disconnectDatabase() { await mongoose.disconnect(); }
export function databaseReady() { return mongoose.connection.readyState === 1; }
