import mongoose from 'mongoose';
export async function connectDatabase(uri) {
  // Indexes are built explicitly in initializeDatabase(), after one-time migrations run.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: false });
}
export async function disconnectDatabase() { await mongoose.disconnect(); }
export function databaseReady() { return mongoose.connection.readyState === 1; }
