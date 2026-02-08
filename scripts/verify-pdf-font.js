#!/usr/bin/env node
/**
 * Verify that a PDF's body text honors the expected font size (and optionally family).
 * Uses pdfjs-dist to extract text items and their transform matrices.
 *
 * Usage:
 *   node scripts/verify-pdf-font.js <path-to-pdf> <expected-body-font-size-pt> [expected-font-family]
 *
 * Exit code: 0 if body font size matches (within tolerance), non-zero otherwise.
 * Output: One line "PASS: ..." or "FAIL: ..."
 */

const path = require('path');
const fs = require('fs');

const pdfPath = process.argv[2];
const expectedSizePt = Math.round(Number(process.argv[3]) || 20);
const expectedFamily = process.argv[4] || null;
const TOLERANCE = 0.15; // 15% tolerance

if (!pdfPath || !fs.existsSync(pdfPath)) {
  console.error('Usage: node scripts/verify-pdf-font.js <pdf-path> <expected-font-size-pt> [expected-font-family]');
  process.exit(2);
}

function effectiveFontSizeFromTransform(transform) {
  if (!transform || !Array.isArray(transform)) return null;
  const [a, b, c, d] = transform;
  if (a == null || d == null) return null;
  const scaleY = Math.abs(d);
  const scaleX = Math.abs(a);
  return Math.max(scaleY, scaleX);
}

async function run() {
  let pdfjsLib;
  try {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (_) {
    pdfjsLib = await import('pdfjs-dist');
  }
  if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const items = content.items;

  const sizes = [];
  let fontName = null;
  for (const item of items) {
    if (item.str && String(item.str).trim().length > 0) {
      const size = effectiveFontSizeFromTransform(item.transform);
      if (size != null && size > 0) sizes.push(size);
      if (item.fontName) fontName = item.fontName;
    }
  }
  if (sizes.length === 0) {
    console.log('FAIL: no text items with transform found in PDF');
    process.exit(1);
  }
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  const withinTolerance =
    avgSize >= expectedSizePt * (1 - TOLERANCE) && avgSize <= expectedSizePt * (1 + TOLERANCE);
  const familyOk = !expectedFamily || (fontName && fontName.toLowerCase().includes(expectedFamily.toLowerCase().replace(/\s/g, '')));
  if (withinTolerance && familyOk) {
    console.log('PASS: body font size ~' + Math.round(avgSize) + 'pt (expected ' + expectedSizePt + 'pt)');
    process.exit(0);
  }
  console.log(
    'FAIL: body font size ' +
      Math.round(avgSize) +
      'pt (expected ' +
      expectedSizePt +
      'pt, range ' +
      Math.round(min) +
      '-' +
      Math.round(max) +
      'pt)'
  );
  process.exit(1);
}

run().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
