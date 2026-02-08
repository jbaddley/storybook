# PDF Font Experiments

This document lists **concrete experiments** to try so the PDF export honors the selected body font size and family. Run the test script, then the verifier; if the verifier passes, port the change into the app.

## Quick loop

1. **Run test:** `BODY_FONT_SIZE=20 node scripts/pdf-export-test.js`
2. **Verify:** `node scripts/verify-pdf-font.js scripts/output/test-export.pdf 20`
3. If **PASS:** port the same change into `src/main/ipc-handlers.ts` (and `src/renderer/services/exportService.ts` if needed), then export from the app and verify that PDF too.
4. If **FAIL:** try the next strategy below (change only what the strategy says, then repeat steps 1–2).

---

## Strategy 1: Baseline (repro)

**Goal:** Confirm the standalone test reproduces the issue or passes.

- **Change:** None. Use the test script as-is (zero margin, no header/footer, scale 1, inline overrides).
- **Run:** `BODY_FONT_SIZE=20 node scripts/pdf-export-test.js` then `node scripts/verify-pdf-font.js scripts/output/test-export.pdf 20`
- **Success:** Verifier exits 0. If it already passes, the minimal HTML path honors font size; the app’s HTML or flow may differ.

---

## Strategy 2: Puppeteer `scale`

**Goal:** See if scaling the PDF output compensates for Chromium shrinking content.

- **Change (test script only):** In `scripts/pdf-export-test.js`, in the `pdfOptions` object, set `scale: Math.min(2, Math.max(0.5, BODY_FONT_SIZE / 12))` instead of `scale: 1`. (Or set `STRATEGY=scale` when running the script; the script already supports this.)
- **Run:** `STRATEGY=scale BODY_FONT_SIZE=20 node scripts/pdf-export-test.js` then `node scripts/verify-pdf-font.js scripts/output/test-export.pdf 20`
- **Success:** Verifier exits 0. If so, in the app set `scale: bodyFontSizePt / 12` (capped) in `page.pdf()` in `src/main/ipc-handlers.ts`.

---

## Strategy 3: Viewport = content area

**Goal:** Match viewport to the PDF content area so Chromium doesn’t scale the page.

- **Change (test script only):** In `scripts/pdf-export-test.js`, set viewport width/height to the “content” size (page size in px minus margins in px). Use `STRATEGY=viewport-content` (script already supports this).
- **Run:** `STRATEGY=viewport-content BODY_FONT_SIZE=20 node scripts/pdf-export-test.js` then verify.
- **Success:** Verifier exits 0. If so, in `src/main/ipc-handlers.ts` in `generatePdfBuffer`, set the viewport to the same content-area dimensions before `setContent`.

---

## Strategy 4: `preferCSSPageSize: true`

**Goal:** Let CSS `@page` drive page size so layout isn’t scaled by the driver.

- **Change (test script only):** In `scripts/pdf-export-test.js`, set `STRATEGY=prefer-css-page` and in `pdfOptions` set `preferCSSPageSize: true`. (Add this strategy to the script if not present.)
- **Run:** `STRATEGY=prefer-css-page BODY_FONT_SIZE=20 node scripts/pdf-export-test.js` then verify.
- **Success:** Verifier exits 0. If so, in the app set `preferCSSPageSize: true` in `page.pdf()` and rely on `@page` in the HTML.

---

## Strategy 5: Electron `webContents.printToPDF`

**Goal:** Compare Electron’s print path to Puppeteer’s.

- **Change:** Add a small Node/Electron script (or a test mode in the app) that: creates a hidden `BrowserWindow`, loads the same test HTML via `loadURL('data:text/html;base64,...')`, calls `webContents.printToPDF()` with the same options (no header/footer, zero margin), writes the buffer to `scripts/output/electron-print-test.pdf`.
- **Run:** Run that script, then `node scripts/verify-pdf-font.js scripts/output/electron-print-test.pdf 20`.
- **Success:** Verifier exits 0. If so, consider switching the app’s PDF export to use `webContents.printToPDF()` instead of Puppeteer (e.g. from a hidden window with the export HTML).

---

## Strategy 6: Generate PDF with pdf-lib (no Chromium)

**Goal:** Confirm the verifier and expected size are correct; optional fallback export path.

- **Change:** Add a script that uses `pdf-lib` to create a one-page PDF with a single line of text at exactly 20pt (embedded or standard font). Write to `scripts/output/pdf-lib-test.pdf`.
- **Run:** Run that script, then `node scripts/verify-pdf-font.js scripts/output/pdf-lib-test.pdf 20`.
- **Success:** Verifier exits 0. Then the verifier is validated. Optionally, add a separate “PDF (experimental)” path in the app that builds the manuscript with pdf-lib and explicit font sizes.

---

## Agent workflow (keep trying until it works)

1. **Repro**
   - Run: `BODY_FONT_SIZE=20 node scripts/pdf-export-test.js`
   - Run: `node scripts/verify-pdf-font.js scripts/output/test-export.pdf 20`
   - If the verifier **fails**, the repro is confirmed.

2. **Iterate**
   - For each strategy in this document, in order (1 → 6):
     - Apply **only** the change described (in the test script or the listed file).
     - Run the test script, then the verifier.
     - If **PASS:** Port the same change into the real app (`src/main/ipc-handlers.ts`, and if needed `src/renderer/services/exportService.ts`). Run the app, export a real PDF (e.g. with body font 20pt), save it, then run `node scripts/verify-pdf-font.js <path-to-saved-pdf> 20`. If that passes, treat the issue as fixed.
     - If **FAIL:** Revert that strategy and go to the next one.

3. **If all Puppeteer-based strategies fail**
   - Treat Strategy 6 (pdf-lib) as the fallback: design a minimal path that renders the manuscript (or settings page + one chapter) with pdf-lib and explicit font sizes, and wire it behind a feature flag or a separate menu item (e.g. “Export PDF (experimental)”) until it’s stable.

---

## In-app test export (optional)

If the env var `PDF_EXPORT_TEST=1` is set when the app runs, the main process can write the generated PDF buffer to `scripts/output/app-export-test.pdf` in addition to (or instead of) showing the save dialog. Then you can run:

`node scripts/verify-pdf-font.js scripts/output/app-export-test.pdf 20`

after each export from the app to verify the real export path.
