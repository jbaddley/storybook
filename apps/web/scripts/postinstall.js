#!/usr/bin/env node
// Skip prisma generate on Vercel; the build step runs it. Avoids postinstall npm i prisma failure.
if (process.env.VERCEL === '1') return;
const { execSync } = require('child_process');
execSync('prisma generate --schema=../../prisma/schema.prisma', { stdio: 'inherit' });
