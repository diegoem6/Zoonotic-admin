/**
 * Run this script once to generate your admin password hash.
 * Usage: node scripts/createAdmin.js
 * Then copy the output into your .env as ADMIN_PASSWORD_HASH
 */
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Enter admin password: ', async (password) => {
  if (!password || password.length < 6) {
    console.error('❌ Password must be at least 6 characters');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  console.log('\n✅ Add this to your .env file:\n');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log(`ADMIN_USERNAME=admin`);
  console.log(`JWT_SECRET=${require('crypto').randomBytes(32).toString('hex')}`);
  console.log('');
  rl.close();
});
