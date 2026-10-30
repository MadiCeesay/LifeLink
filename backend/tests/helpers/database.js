import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet, MongoMemoryServer } from 'mongodb-memory-server';
export async function createTestDatabase() {
  const localBinary = fileURLToPath(new URL('../../.test-tools/mongod.exe', import.meta.url));
  return MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: [{ launchTimeout: 60000 }],
    binary: existsSync(localBinary) ? { systemBinary: localBinary } : {},
  });
}

export async function createStandaloneTestDatabase() {
  const localBinary = fileURLToPath(new URL('../../.test-tools/mongod.exe', import.meta.url));
  return MongoMemoryServer.create({ instance: { launchTimeout: 60000 }, binary: existsSync(localBinary) ? { systemBinary: localBinary } : {} });
}
