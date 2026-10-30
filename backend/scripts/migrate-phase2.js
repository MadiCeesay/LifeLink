import { pathToFileURL } from 'node:url';
import { User } from '../src/models/User.js';
import { parseEnv } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initializeDatabase.js';
export async function backfillDonorVerification() {
  return User.updateMany({ role: 'DONOR', donorVerification: { $exists: false } }, { $set: { donorVerification: { status: 'UNVERIFIED', revision: 0 } } });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await import('dotenv/config');
    const config = parseEnv(process.env);
    await connectDatabase(config.MONGODB_URI);
    await initializeDatabase();
    const result = await backfillDonorVerification();
    console.log(`Backfilled ${result.modifiedCount} donor account(s) as UNVERIFIED.`);
  } catch { console.error('Migration failed. Check configuration and replica-set database availability.'); process.exitCode = 1; }
  finally { await disconnectDatabase(); }
}
