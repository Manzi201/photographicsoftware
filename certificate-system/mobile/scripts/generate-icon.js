/**
 * Generates app icons for the Certificate System mobile app.
 * Creates: assets/icon.png (1024x1024), assets/adaptive-icon.png (1024x1024), assets/splash-icon.png (200x200)
 * Uses only built-in Node.js modules — no external dependencies.
 */

const fs = require("fs");
const path = require("path");

// ── SVG definitions ────────────────────────────────────────────

// Main icon SVG (1024x1024) — dark blue background, gold graduation cap + certificate ribbon
function makeIconSVG(size) {
    const s = size;
    const r = Math.round(s * 0.18); // corner radius
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3a8a"/>
      <stop offset="100%" style="stop-color:#1e40af"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#fbbf24"/>
      <stop offset="100%" style="stop-color:#f59e0b"/>
    </linearGradient>
    <linearGradient id="cert" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.95"/>
      <stop offset="100%" style="stop-color:#e0e7ff;stop-opacity:0.95"/>
    </linearGradient>
  </defs>

  <!-- Background rounded rect -->
  <rect width="${s}" height="${s}" rx="${r}" ry="${r}" fill="url(#bg)"/>

  <!-- Subtle pattern overlay -->
  <rect width="${s}" height="${s}" rx="${r}" ry="${r}" fill="url(#bg)" opacity="0.3"/>

  <!-- Certificate document body -->
  <rect x="${s * 0.18}" y="${s * 0.22}" width="${s * 0.64}" height="${
        s * 0.52
    }" rx="${s * 0.04}" ry="${s * 0.04}" fill="url(#cert)"/>

  <!-- Certificate top ribbon bar -->
  <rect x="${s * 0.18}" y="${s * 0.22}" width="${s * 0.64}" height="${
        s * 0.11
    }" rx="${s * 0.04}" ry="${s * 0.04}" fill="url(#gold)"/>
  <!-- Cover bottom corners of ribbon -->
  <rect x="${s * 0.18}" y="${s * 0.29}" width="${s * 0.64}" height="${
        s * 0.04
    }" fill="url(#gold)"/>

  <!-- Certificate lines (text placeholders) -->
  <rect x="${s * 0.28}" y="${s * 0.41}" width="${s * 0.44}" height="${
        s * 0.025
    }" rx="${s * 0.01}" fill="#cbd5e1" opacity="0.9"/>
  <rect x="${s * 0.32}" y="${s * 0.46}" width="${s * 0.36}" height="${
        s * 0.02
    }" rx="${s * 0.01}" fill="#94a3b8" opacity="0.7"/>
  <rect x="${s * 0.25}" y="${s * 0.52}" width="${s * 0.50}" height="${
        s * 0.025
    }" rx="${s * 0.01}" fill="#1e3a8a" opacity="0.7"/>
  <rect x="${s * 0.25}" y="${s * 0.57}" width="${s * 0.50}" height="${
        s * 0.015
    }" rx="${s * 0.01}" fill="#cbd5e1" opacity="0.6"/>
  <rect x="${s * 0.30}" y="${s * 0.61}" width="${s * 0.40}" height="${
        s * 0.015
    }" rx="${s * 0.01}" fill="#cbd5e1" opacity="0.5"/>

  <!-- Seal circle bottom-right -->
  <circle cx="${s * 0.70}" cy="${s * 0.66}" r="${
        s * 0.085
    }" fill="#1e3a8a" opacity="0.15"/>
  <circle cx="${s * 0.70}" cy="${s * 0.66}" r="${
        s * 0.07
    }" fill="none" stroke="#1e3a8a" stroke-width="${s * 0.008}" opacity="0.4"/>

  <!-- Graduation cap on top of certificate -->
  <!-- Cap board (mortarboard top) -->
  <polygon points="${s * 0.50},${s * 0.14} ${s * 0.72},${s * 0.24} ${
        s * 0.50
    },${s * 0.34} ${s * 0.28},${s * 0.24}" fill="url(#gold)"/>
  <!-- Cap shadow -->
  <polygon points="${s * 0.50},${s * 0.34} ${s * 0.72},${s * 0.24} ${
        s * 0.72
    },${s * 0.27} ${s * 0.50},${s * 0.37}" fill="#d97706" opacity="0.6"/>
  <!-- Cap stem -->
  <rect x="${s * 0.472}" y="${s * 0.24}" width="${s * 0.056}" height="${
        s * 0.10
    }" rx="${s * 0.01}" fill="#d97706"/>
  <!-- Tassel string -->
  <line x1="${s * 0.72}" y1="${s * 0.24}" x2="${s * 0.72}" y2="${
        s * 0.38
    }" stroke="#fbbf24" stroke-width="${s * 0.012}" stroke-linecap="round"/>
  <circle cx="${s * 0.72}" cy="${s * 0.38}" r="${s * 0.022}" fill="#fbbf24"/>
  <!-- Tassel bottom strands -->
  <line x1="${s * 0.72}" y1="${s * 0.40}" x2="${s * 0.705}" y2="${
        s * 0.46
    }" stroke="#f59e0b" stroke-width="${s * 0.007}" stroke-linecap="round"/>
  <line x1="${s * 0.72}" y1="${s * 0.40}" x2="${s * 0.72}" y2="${
        s * 0.47
    }" stroke="#f59e0b" stroke-width="${s * 0.007}" stroke-linecap="round"/>
  <line x1="${s * 0.72}" y1="${s * 0.40}" x2="${s * 0.735}" y2="${
        s * 0.46
    }" stroke="#f59e0b" stroke-width="${s * 0.007}" stroke-linecap="round"/>

  <!-- Star on ribbon -->
  <text x="${s * 0.50}" y="${s * 0.315}" text-anchor="middle" font-size="${
        s * 0.07
    }" fill="#1e3a8a" font-family="Arial" font-weight="bold" opacity="0.6">★</text>

  <!-- Bottom decorative dots -->
  <circle cx="${s * 0.38}" cy="${s * 0.80}" r="${
        s * 0.018
    }" fill="#fbbf24" opacity="0.8"/>
  <circle cx="${s * 0.50}" cy="${s * 0.82}" r="${s * 0.022}" fill="#fbbf24"/>
  <circle cx="${s * 0.62}" cy="${s * 0.80}" r="${
        s * 0.018
    }" fill="#fbbf24" opacity="0.8"/>
</svg>`;
}

// Adaptive icon foreground (transparent bg, centered logo)
function makeAdaptiveSVG(size) {
    const s = size;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gold2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#fbbf24"/>
      <stop offset="100%" style="stop-color:#f59e0b"/>
    </linearGradient>
  </defs>

  <!-- Certificate document -->
  <rect x="${s * 0.22}" y="${s * 0.28}" width="${s * 0.56}" height="${
        s * 0.46
    }" rx="${s * 0.04}" fill="white" opacity="0.95"/>
  <rect x="${s * 0.22}" y="${s * 0.28}" width="${s * 0.56}" height="${
        s * 0.10
    }" rx="${s * 0.04}" fill="url(#gold2)"/>
  <rect x="${s * 0.22}" y="${s * 0.34}" width="${s * 0.56}" height="${
        s * 0.04
    }" fill="url(#gold2)"/>

  <!-- Lines -->
  <rect x="${s * 0.30}" y="${s * 0.44}" width="${s * 0.40}" height="${
        s * 0.022
    }" rx="${s * 0.01}" fill="#94a3b8"/>
  <rect x="${s * 0.28}" y="${s * 0.49}" width="${s * 0.44}" height="${
        s * 0.022
    }" rx="${s * 0.01}" fill="#1e3a8a" opacity="0.6"/>
  <rect x="${s * 0.30}" y="${s * 0.54}" width="${s * 0.40}" height="${
        s * 0.015
    }" rx="${s * 0.01}" fill="#cbd5e1"/>

  <!-- Graduation cap -->
  <polygon points="${s * 0.50},${s * 0.18} ${s * 0.70},${s * 0.27} ${
        s * 0.50
    },${s * 0.36} ${s * 0.30},${s * 0.27}" fill="url(#gold2)"/>
  <polygon points="${s * 0.50},${s * 0.36} ${s * 0.70},${s * 0.27} ${
        s * 0.70
    },${s * 0.30} ${s * 0.50},${s * 0.39}" fill="#d97706" opacity="0.7"/>
  <rect x="${s * 0.475}" y="${s * 0.275}" width="${s * 0.05}" height="${
        s * 0.09
    }" fill="#d97706"/>
  <line x1="${s * 0.70}" y1="${s * 0.27}" x2="${s * 0.70}" y2="${
        s * 0.38
    }" stroke="#fbbf24" stroke-width="${s * 0.012}" stroke-linecap="round"/>
  <circle cx="${s * 0.70}" cy="${s * 0.38}" r="${s * 0.02}" fill="#fbbf24"/>
  <line x1="${s * 0.70}" y1="${s * 0.40}" x2="${s * 0.688}" y2="${
        s * 0.45
    }" stroke="#f59e0b" stroke-width="${s * 0.007}" stroke-linecap="round"/>
  <line x1="${s * 0.70}" y1="${s * 0.40}" x2="${s * 0.70}" y2="${
        s * 0.46
    }" stroke="#f59e0b" stroke-width="${s * 0.007}" stroke-linecap="round"/>
  <line x1="${s * 0.70}" y1="${s * 0.40}" x2="${s * 0.712}" y2="${
        s * 0.45
    }" stroke="#f59e0b" stroke-width="${s * 0.007}" stroke-linecap="round"/>
</svg>`;
}

// ── Write SVG files ────────────────────────────────────────────
const assetsDir = path.join(__dirname, "..", "assets");
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const iconSVG = makeIconSVG(1024);
const adaptiveSVG = makeAdaptiveSVG(1024);

fs.writeFileSync(path.join(assetsDir, "icon.svg"), iconSVG);
fs.writeFileSync(path.join(assetsDir, "adaptive-icon.svg"), adaptiveSVG);

console.log("✅ SVG icons written to assets/");
console.log("");
console.log("Next step: convert SVGs to PNGs using one of:");
console.log("  npx svg2png-many  (if available)");
console.log("  OR use the svg-to-png converter script below");
console.log("");
console.log("SVG files are ready at:");
console.log("  assets/icon.svg          → convert to icon.png (1024x1024)");
console.log(
    "  assets/adaptive-icon.svg → convert to adaptive-icon.png (1024x1024)",
);
