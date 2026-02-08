#!/usr/bin/env node
/**
 * Standalone PDF export test harness.
 * Generates a minimal one-page PDF with configurable body font size/family
 * using the same Puppeteer path as the app. Writes to scripts/output/test-export.pdf.
 *
 * Usage:
 *   BODY_FONT_SIZE=20 BODY_FONT="EB Garamond" node scripts/pdf-export-test.js
 *   STRATEGY=scale BODY_FONT_SIZE=20 node scripts/pdf-export-test.js
 *
 * Env:
 *   BODY_FONT_SIZE  (default 20) - body font size in pt
 *   BODY_FONT       (default "serif") - body font family
 *   STRATEGY        (default "default") - "default" | "scale" | "viewport-content" | "prefer-css-page"
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const BODY_FONT_SIZE = Math.max(1, Math.round(Number(process.env.BODY_FONT_SIZE) || 20));
const BODY_FONT = (process.env.BODY_FONT || 'serif').trim();
const STRATEGY = (process.env.STRATEGY || 'default').toLowerCase();

const OUT_DIR = path.join(__dirname, 'output');
const OUT_PATH = path.join(OUT_DIR, 'test-export.pdf');

function findChromeExecutable() {
  const platform = process.platform;
  const fsSync = require('fs');

  if (platform === 'darwin') {
    const possiblePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    ];
    for (const chromePath of possiblePaths) {
      try {
        if (fsSync.existsSync(chromePath)) return chromePath;
      } catch (_) {}
    }
  } else if (platform === 'win32') {
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const chromePath of possiblePaths) {
      try {
        if (fsSync.existsSync(chromePath)) return chromePath;
      } catch (_) {}
    }
  } else if (platform === 'linux') {
    const cmds = ['google-chrome', 'chromium', 'chromium-browser', 'google-chrome-stable'];
    for (const cmd of cmds) {
      try {
        execSync(`which ${cmd}`, { stdio: 'ignore' });
        return cmd;
      } catch (_) {}
    }
  }
  return undefined;
}

function buildTestHtml() {
  const bodyFontCss = BODY_FONT.includes(' ') ? `"${BODY_FONT}", serif` : `${BODY_FONT}, serif`;
  const bodyFontSizePx = Math.round((BODY_FONT_SIZE * 96) / 72);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PDF font test</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: 8.5in 11in; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body {
      padding: 1in;
      width: 100%;
      font-family: ${bodyFontCss};
      font-size: ${BODY_FONT_SIZE}pt;
      line-height: 1.5;
      color: #000;
    }
    p { margin-bottom: 0.5em; }
    #calibration-body {
      font-family: ${bodyFontCss};
      font-size: ${BODY_FONT_SIZE}pt;
    }
  </style>
</head>
<body>
  <p>Body paragraph at manuscript body font/size.</p>
  <p id="calibration-body">The quick brown fox jumps over the lazy dog. 0123456789.</p>
</body>
</html>`;
}

async function main() {
  const executablePath = findChromeExecutable();
  if (!executablePath) {
    console.error('Chrome or Chromium not found. Install Google Chrome or Chromium.');
    process.exit(1);
  }

  const puppeteer = require('puppeteer-core');
  let html = buildTestHtml();

  const bodyFontSizePx = Math.round((BODY_FONT_SIZE * 96) / 72);
  const bodyFontFamily = BODY_FONT.includes(' ') ? `"${BODY_FONT}"` : BODY_FONT;
  const fontOverrideStyle = `<style id="pdf-font-override">body,p,#calibration-body{font-size:${bodyFontSizePx}px !important;font-family:${bodyFontFamily},serif !important;}</style>`;
  html = html.replace(/\s*<\/head\s*>/i, fontOverrideStyle + '\n</head>');

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const w = 8.5;
  const h = 11;
  const topIn = '0in';
  const bottomIn = '0in';
  const leftIn = '0in';
  const rightIn = '0in';

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.emulateMediaType('print');

    const viewportWidth = Math.round(w * 96);
    const viewportHeight = Math.round(h * 96);
    if (STRATEGY === 'viewport-content') {
      const marginPx = 0;
      await page.setViewport({
        width: Math.max(400, viewportWidth - marginPx * 2),
        height: Math.max(600, viewportHeight - marginPx * 2),
        deviceScaleFactor: 1,
      });
    } else {
      await page.setViewport({
        width: viewportWidth,
        height: viewportHeight,
        deviceScaleFactor: 1,
      });
    }

    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.evaluate(
      (args) => {
        document.querySelectorAll('body, p, #calibration-body').forEach((el) => {
          el.style.setProperty('font-size', args.sizePx + 'px', 'important');
          el.style.setProperty('font-family', args.fontFamily + ', serif', 'important');
        });
      },
      { sizePx: bodyFontSizePx, fontFamily: bodyFontFamily }
    );

    const pdfOptions = {
      printBackground: true,
      width: w + 'in',
      height: h + 'in',
      preferCSSPageSize: STRATEGY === 'prefer-css-page',
      displayHeaderFooter: false,
      margin: { top: topIn, bottom: bottomIn, left: leftIn, right: rightIn },
    };

    if (STRATEGY === 'scale') {
      pdfOptions.scale = Math.min(2, Math.max(0.5, BODY_FONT_SIZE / 12));
    } else {
      pdfOptions.scale = 1;
    }

    const pdfBuffer = await page.pdf(pdfOptions);
    fs.writeFileSync(OUT_PATH, pdfBuffer);
    console.log('Wrote', OUT_PATH, '| BODY_FONT_SIZE=' + BODY_FONT_SIZE, 'BODY_FONT=' + BODY_FONT, 'STRATEGY=' + STRATEGY);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
