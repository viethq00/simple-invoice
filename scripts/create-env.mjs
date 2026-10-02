// npm run setup: create .env from .env.example with random secrets. Never overwrites .env.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const SECRETS = ['POSTGRES_PASSWORD', 'JWT_SECRET'];

if (existsSync('.env')) {
  console.log('.env already exists; leaving it unchanged.');
} else {
  const env = readFileSync('.env.example', 'utf8').replace(
    new RegExp(`^(${SECRETS.join('|')})=\\r?$`, 'gm'),
    (_line, key) => `${key}=${randomBytes(32).toString('hex')}`,
  );
  writeFileSync('.env', env, { flag: 'wx', mode: 0o600 });
  console.log(`Created .env with random ${SECRETS.join(' and ')}.`);
}
