#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawn } = require('child_process');

// Ensure Next runs from apps/web so it finds app/ and all routes
const appDir = path.resolve(__dirname);
const env = { ...process.env, CHOKIDAR_USEPOLLING: '1' };

const isWindows = process.platform === 'win32';

if (isWindows) {
  const next = path.join(appDir, 'node_modules', '.bin', 'next.cmd');
  const child = spawn(next, ['dev', '-p', '4050'], {
    stdio: 'inherit',
    shell: true,
    env,
    cwd: appDir,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  // On macOS/Linux: run in a shell that raises ulimit then execs next, so the
  // Next process inherits the higher limit and can watch all files (avoids EMFILE → 404s)
  const nextBin = path.join(appDir, 'node_modules', '.bin', 'next');
  const child = spawn('/bin/sh', ['-c', `ulimit -n 65536 2>/dev/null || true; exec "${nextBin}" dev -p 4050`], {
    stdio: 'inherit',
    env,
    cwd: appDir,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}
