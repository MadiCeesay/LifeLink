import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { parseEnv } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initializeDatabase.js';
import { bootstrapAdmin } from '../src/services/bootstrapService.js';
async function run() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run this command in an interactive terminal');
  const config = parseEnv(process.env);
  const prompts = createInterface({ input: process.stdin, output: process.stdout });
  let name, email, phone;
  try {
    name = await prompts.question('Admin name: ');
    email = await prompts.question('Admin email: ');
    phone = await prompts.question('Admin phone: ');
  } finally { prompts.close(); }
  const muted = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const secretPrompt = createInterface({ input: process.stdin, output: muted, terminal: true });
  let password, confirm;
  try {
    process.stdout.write('Admin password (hidden): ');
    password = await secretPrompt.question('');
    process.stdout.write('\nConfirm password (hidden): ');
    confirm = await secretPrompt.question('');
    process.stdout.write('\n');
  } finally { secretPrompt.close(); }
  if (password !== confirm) throw new Error('Passwords do not match');
  try {
    await connectDatabase(config.MONGODB_URI);
    await initializeDatabase();
    await bootstrapAdmin({ name, email, phone, password });
    console.log('Initial administrator created. Log in through /api/v1/auth/login.');
  } finally { await disconnectDatabase(); }
}
run().catch(error => {
  console.error(error.code === 'VALIDATION_ERROR' ? 'Invalid account details. Check name, email, phone and password requirements.' : error.message.startsWith('Invalid environment') || String(error.code ?? '').startsWith('BOOTSTRAP') || error.message === 'Passwords do not match' || error.message === 'Run this command in an interactive terminal' ? error.message : 'Bootstrap failed. Check configuration and replica-set database availability.');
  process.exitCode = 1;
});
