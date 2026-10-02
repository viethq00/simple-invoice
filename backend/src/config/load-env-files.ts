import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// For the migration and seed scripts. Same precedence as ConfigModule: variables already set win.
export function loadEnvFiles(cwd: string = process.cwd()): void {
  for (const file of ['.env', '../.env']) {
    const path = resolve(cwd, file);
    if (existsSync(path)) process.loadEnvFile(path);
  }
}
