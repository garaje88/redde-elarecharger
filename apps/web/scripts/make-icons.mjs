// Renders the app icons (PWA manifest, Apple touch icon) from the logo SVG with Playwright's
// Chromium. Run with `node apps/web/scripts/make-icons.mjs` after changing the logo.
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../public/icons/", import.meta.url));

// Maskable icons keep the bolt inside the central 80 % safe zone.
const svg = ({ size, maskable }) => {
  const scale = maskable ? 0.5 : 0.62;
  const radius = maskable ? 0 : size * 0.22;
  const bolt = size * scale;
  const offset = (size - bolt) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#34d399"/>
  <svg x="${offset}" y="${offset}" width="${bolt}" height="${bolt}" viewBox="0 0 24 24" fill="none" stroke="#111418" stroke-width="2" stroke-linejoin="round">
    <path d="M13 2L4 14h7l-1 8 9-12h-7z"/>
  </svg>
</svg>`;
};

const icons = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "maskable-512.png", size: 512, maskable: true },
  { name: "apple-touch-icon.png", size: 180, maskable: true },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const icon of icons) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(`<body style="margin:0">${svg(icon)}</body>`);
  await page
    .locator("svg")
    .first()
    .screenshot({ path: `${out}${icon.name}`, omitBackground: true });
}
await browser.close();
