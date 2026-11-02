/**
 * Generates the social preview card and the small icon set.
 *
 * `og:image` used to point at `/title.png`, a 200x200 logo. Every major
 * consumer (X, Facebook, LinkedIn, Slack, Discord, Google Discover) requires at
 * least 1200x630 for a large card, so shares rendered as a tiny thumbnail. This
 * script composes a real 1200x630 card from the existing logo and writes it to
 * `public/` (so `vite` copies it) and to `dist/` (so a rebuild-only run still
 * ships it).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.resolve(projectRoot, 'public');
const distDir = path.resolve(projectRoot, 'dist');

const WIDTH = 1200;
const HEIGHT = 630;
const LOGO_SOURCE = path.resolve(publicDir, 'title.png');

const backgroundSvg = `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#120a33"/>
      <stop offset="55%" stop-color="#030014"/>
      <stop offset="100%" stop-color="#1b1040"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="18%" r="60%">
      <stop offset="0%" stop-color="#7c5dda" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#7c5dda" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  <circle cx="1050" cy="90" r="180" fill="#a855f7" fill-opacity="0.12"/>
  <circle cx="120" cy="560" r="200" fill="#6366f1" fill-opacity="0.14"/>
  <text x="50%" y="470" text-anchor="middle" font-family="DejaVu Sans, Verdana, Helvetica, Arial, sans-serif"
        font-size="76" font-weight="bold" fill="#ffffff" letter-spacing="2">FILM POINT</text>
  <text x="50%" y="525" text-anchor="middle" font-family="DejaVu Sans, Verdana, Helvetica, Arial, sans-serif"
        font-size="30" fill="#c7b8ff">Movie discovery, ratings and watchlists</text>
</svg>
`;

const ensureDirectory = (directory) => {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
};

const writeTo = async (buffer, fileName) => {
  ensureDirectory(publicDir);
  fs.writeFileSync(path.resolve(publicDir, fileName), buffer);

  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.resolve(distDir, fileName), buffer);
  }
};

const buildOgImage = async () => {
  const background = Buffer.from(backgroundSvg);
  const logo = fs.existsSync(LOGO_SOURCE)
    ? await sharp(LOGO_SOURCE).resize(260, 260, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    : null;

  const composites = [{ input: background, top: 0, left: 0 }];
  if (logo) composites.push({ input: logo, top: 140, left: Math.round((WIDTH - 260) / 2) });

  const card = await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 4, background: { r: 3, g: 0, b: 20, alpha: 1 } },
  })
    .composite(composites)
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  await writeTo(card, 'og-default.png');
  console.log(`[og] og-default.png ${WIDTH}x${HEIGHT} (${Math.round(card.length / 1024)} KB)`);
};

const buildIcons = async () => {
  if (!fs.existsSync(LOGO_SOURCE)) {
    console.warn('[og] public/title.png is missing — skipping icon generation.');
    return;
  }

  const sizes = [
    { size: 32, name: 'favicon-32.png' },
    { size: 16, name: 'favicon-16.png' },
    { size: 180, name: 'apple-touch-icon.png' },
  ];

  for (const { size, name } of sizes) {
    const buffer = await sharp(LOGO_SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 3, g: 0, b: 20, alpha: 1 } })
      .png({ compressionLevel: 9 })
      .toBuffer();

    await writeTo(buffer, name);
    console.log(`[icons] ${name} ${size}x${size}`);
  }
};

const main = async () => {
  try {
    await buildOgImage();
    await buildIcons();
  } catch (error) {
    // Never fail the build over a social image: the site still ships, and the
    // build-info file reports the missing asset.
    console.warn('[og] Could not generate social images:', error.message);
  }
};

main();
