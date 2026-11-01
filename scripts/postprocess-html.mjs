/**
 * Post-build HTML fixes for the prerendered pages.
 *
 * `vite-react-ssg` injects the Helmet output at the very start of `<head>`,
 * which pushes `<meta charset>` past the first 1024 bytes. Chrome then has to
 * re-parse the document (Lighthouse's `charset` audit fails) and the late
 * charset can cause a re-layout. Moving a single charset declaration to the
 * first position inside `<head>` fixes both.
 */
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');

const walk = (directory) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
  });
};

const charsetTag = '<meta charset="utf-8">';
let changed = 0;
let processed = 0;

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

  if (html !== original) {
    fs.writeFileSync(filePath, html, 'utf8');
    changed += 1;
  }
}

console.log(`[html] charset normalised in ${changed}/${processed} prerendered pages`);
