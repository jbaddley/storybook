#!/usr/bin/env node
/**
 * Writes apps/web/prisma/schema.web.prisma with only the clientWeb generator.
 * Schema lives inside apps/web so "prisma generate" runs in the same dir as node_modules
 * and can resolve @prisma/client without triggering the internal "npm i prisma" that fails on Vercel.
 */
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../../../prisma/schema.prisma');
const outDir = path.join(__dirname, '../prisma');
const outPath = path.join(outDir, 'schema.web.prisma');

let content = fs.readFileSync(schemaPath, 'utf8');

// Remove the first generator block (generator client { provider = "prisma-client-js" })
content = content.replace(
  /generator client \{\s*provider = "prisma-client-js"\s*\}\s*\n\s*\n/,
  ''
);

// Output path relative to apps/web/prisma -> apps/web/node_modules/.prisma/client
content = content.replace(
  /output\s*=\s*"\.\.\/apps\/web\/node_modules\/\.prisma\/client"/,
  'output          = "../node_modules/.prisma/client"'
);

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, content, 'utf8');
console.log('Wrote', outPath);
