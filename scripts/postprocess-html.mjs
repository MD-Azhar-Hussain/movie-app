/**
 * Post-build HTML fixes for the prerendered pages.
 *
 * 1. `<meta charset>` — `vite-react-ssg` injects the Helmet output at the very
 *    start of `<head>`, pushing the charset past the first 1024 bytes. Chrome
 *    then re-parses the document (Lighthouse `charset` audit fails) and can
 *    re-layout.
 *
 * 2. `async` on the entry module script — the module was executing before the
 *    inline `window.__VITE_REACT_SSG_HASH__` assignment at the end of <body>,
 *    so hydration requested `static-loader-data-manifest-undefined.json` (404).
 *    Module scripts are deferred by default; removing `async` restores the
 *    documented order.
 *
 * 3. `lang` on <html> — required for a valid `hreflang`/language signal; the
 *    prerenderer occasionally emits `<html>` without it.
 *
 * Finally it writes `dist/build-info.json` (see `scripts/build-info.mjs`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeBuildInfo } from './build-info.mjs';

const distDir = path.resolve(process.cwd(), 'dist');
const siteUrl = (process.env.SITE_URL || 'https://filmpoint.vercel.app').replace(/\/+$/, '');

const charsetTag = '<meta charset="utf-8">';
let changed = 0;
let processed = 0;

const walk = (directory) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
  });
};

for (const filePath of walk(distDir)) {
  processed += 1;
  const original = fs.readFileSync(filePath, 'utf8');

  let html = original
    // Drop every existing charset declaration (any casing/quoting).
    .replace(/<meta[^>]+charset[^>]*>/gi, '')
    // Re-insert exactly one, as the first child of <head>.
    .replace(/<head([^>]*)>/i, (match, attributes) => `<head${attributes}>${charsetTag}`);

  // Collapse the whitespace the removal may have left behind.
  html = html.replace(/(<head[^>]*>\s*)\s+/i, '$1');

  // Remove `async` from the entry module script so it stays deferred.
  html = html.replace(/(<script\b[^>]*\btype="module"[^>]*?)\s+async(?:="[^"]*")?/gi, '$1');
  html = html.replace(/(<script\b[^>]*?)\s+async(?:="[^"]*")?([^>]*\btype="module")/gi, '$1$2');

  // Guarantee a language declaration on <html>.
  if (/<html\b(?![^>]*\blang=)/i.test(html)) {
    html = html.replace(/<html\b/i, '<html lang="en"');
  }

  if (html !== original) {
    fs.writeFileSync(filePath, html, 'utf8');
    changed += 1;
  }
}

console.log(`[html] charset/lang normalised in ${changed}/${processed} prerendered pages`);

writeBuildInfo({ distDir, siteUrl });

