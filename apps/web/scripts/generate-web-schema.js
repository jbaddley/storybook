#!/usr/bin/env node
/**
 * Writes prisma/schema.web.prisma with only the clientWeb generator (and datasource + models).
 * Used on Vercel so "prisma generate" only runs one generator and PRISMA_GENERATE_SKIP_AUTOINSTALL works.
 */
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../../../prisma/schema.prisma');
const outPath = path.join(__dirname, '../../../prisma/schema.web.prisma');

let content = fs.readFileSync(schemaPath, 'utf8');

// Remove the first generator block (generator client { provider = "prisma-client-js" })
content = content.replace(
  /generator client \{\s*provider = "prisma-client-js"\s*\}\s*\n\s*\n/,
  ''
);

fs.writeFileSync(outPath, content, 'utf8');
console.log('Wrote', outPath);
