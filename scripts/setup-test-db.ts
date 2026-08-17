import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';

// bunx/prisma don't reliably pick up Bun's NODE_ENV-based .env.<env> auto-loading,
// so load .env.test explicitly and let it win over any values from .env.
config({ path: '.env.test', override: true, quiet: true });

function run(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('docker', ['compose', '--profile', 'test', 'up', '-d', '--wait', 'test-db']);
run('bunx', ['prisma', 'migrate', 'deploy']);
