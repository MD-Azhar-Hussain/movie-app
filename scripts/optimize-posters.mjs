/**
 * Generates the optimized landing-gallery posters used by the home page.
 *
 * The source posters in `public/newposters/` are print-quality (one is ~1 MB)
 * but the marquee renders them at ~150 px wide, so the raw files were shipping
 * ~4 MB per page view. This writes 400 px-wide WebP variants (~20 KB each) to
 * `public/newposters/optimized/`, which the Vite manifest plugin prefers when
 * present.
 *
 * Run after adding or replacing a poster:  npm run posters:optimize
 * The generated files are committed, so deploys and CI do not need sharp.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const GALLERY_WIDTH = 400;
const WEBP_QUALITY = 72;

const projectRoot = process.cwd();
const sourceDir = path.resolve(projectRoot, 'public', 'newposters');
const outputDir = path.join(sourceDir, 'optimized');
const IMAGE_PATTERN = /\.(avif|gif|jpe?g|png|webp)$/i;

if (!fs.existsSync(sourceDir)) {
  console.error(`[posters] Source directory not found: ${sourceDir}`);
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

const sourceFiles = fs
  .readdirSync(sourceDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && IMAGE_PATTERN.test(entry.name))
  .map((entry) => entry.name);

let bytesBefore = 0;
let bytesAfter = 0;

for (const fileName of sourceFiles) {
  const sourcePath = path.join(sourceDir, fileName);
  const outputName = `${path
    .parse(fileName)
    .name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}.webp`;
  const outputPath = path.join(outputDir, outputName);

  bytesBefore += fs.statSync(sourcePath).size;

  await sharp(sourcePath)
    .resize({ width: GALLERY_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toFile(outputPath);

  bytesAfter += fs.statSync(outputPath).size;
  console.log(`[posters] ${fileName} -> optimized/${outputName}`);
}

// Remove stale variants for posters that no longer exist.
const expected = new Set(
  sourceFiles.map(
    (fileName) =>
      `${path.parse(fileName).name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.webp`
  )
);

for (const entry of fs.readdirSync(outputDir)) {
  if (entry.endsWith('.webp') && !expected.has(entry)) {
    fs.rmSync(path.join(outputDir, entry));
    console.log(`[posters] removed stale optimized/${entry}`);
  }
}

console.log(
  `\n[posters] ${sourceFiles.length} images: ${(bytesBefore / 1024 / 1024).toFixed(2)} MB -> ${(
    bytesAfter / 1024
  ).toFixed(0)} KB (${Math.round((1 - bytesAfter / bytesBefore) * 100)}% smaller)`
);
