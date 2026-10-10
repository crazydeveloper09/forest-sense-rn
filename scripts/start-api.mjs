import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = existsSync('.env') ? ['--env-file=.env', 'api/server.mjs'] : ['api/server.mjs'];
const child = spawn(process.execPath, args, { stdio: 'inherit' });

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
