import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const localAppData = process.env.LOCALAPPDATA;
const nortonCa = localAppData
  ? join(localAppData, 'forest-sense-certs', 'norton-web-shield.pem')
  : '';
const env = { ...process.env };

if (nortonCa && existsSync(nortonCa)) {
  env.NODE_EXTRA_CA_CERTS = nortonCa;
}

const expoCli = join(process.cwd(), 'node_modules', 'expo', 'bin', 'cli');
const child = spawn(process.execPath, [expoCli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  windowsHide: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
