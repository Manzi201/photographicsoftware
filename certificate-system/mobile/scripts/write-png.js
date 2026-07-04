/**
 * Pure Node.js PNG writer — no external dependencies.
 * Generates the app icon as a real PNG file using raw PNG encoding.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── Minimal PNG encoder ───────────────────────────────────────
function createPNG(width, height, drawFn) {
  // RGBA pixel buffer
  const pixels = new Uint8Array(width * height * 4);

  const setPixel = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = (y * width + x) * 4;
    // Alpha blend over existing
    const srcA = a / 255;
    const dstA = pixels[i + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA === 0) return;
    pixels[i]     = Math.round((r * srcA + pixels[i]     * dstA * (1 - srcA)) / outA);
    pixels[i + 1] = Math.round((g * srcA + pixels[i + 1] * dstA * (1 - srcA)) / outA);
    pixels[i + 2] = Math.round((b * srcA + pixels[i + 2] * dstA * (1 - srcA)) / outA);
    pixels[i + 3] = Math.round(outA * 255);
  };

  // Filled circle
  const fillCircle = (cx, cy, radius, r, g, b, a = 255) => {
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist <= radius) {
          const edge = Math.max(0, Math.min(1, radius - dist + 0.5));
          setPixel(x, y, r, g, b, Math.round(a * edge));
        }
      }
    }
  };

  // Filled rounded rectangle
  const fillRoundRect = (x, y, w, h, rx, r, g, b, a = 255) => {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        let inside = true;
        if (px < x + rx && py < y + rx) {
          inside = Math.sqrt((px - (x + rx)) ** 2 + (py - (y + rx)) ** 2) <= rx;
        } else if (px > x + w - rx && py < y + rx) {
          inside = Math.sqrt((px - (x + w - rx)) ** 2 + (py - (y + rx)) ** 2) <= rx;
        } else if (px < x + rx && py > y + h - rx) {
          inside = Math.sqrt((px - (x + rx)) ** 2 + (py - (y + h - rx)) ** 2) <= rx;
        } else if (px > x + w - rx && py > y + h - rx) {
          inside = Math.sqrt((px - (x + w - rx)) ** 2 + (py - (y + h - rx)) ** 2) <= rx;
        }
        if (inside) setPixel(px, py, r, g, b, a);
      }
    }
  };

  // Filled rectangle
  const fillRect = (x, y, w, h, r, g, b, a = 255) => {
    for (let py = Math.max(0, y); py < Math.min(height, y + h); py++) {
      for (let px = Math.max(0, x); px < Math.min(width, x + w); px++) {
        setPixel(px, py, r, g, b, a);
      }
    }
  };

  // Filled polygon (scanline)
  const fillPolygon = (points, r, g, b, a = 255) => {
    const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p[1]))));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(...points.map(p => p[1]))));
    for (let y = minY; y <= maxY; y++) {
      const intersects = [];
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i], p2 = points[(i + 1) % points.length];
        if ((p1[1] <= y && p2[1] > y) || (p2[1] <= y && p1[1] > y)) {
          const x = p1[0] + (y - p1[1]) * (p2[0] - p1[0]) / (p2[1] - p1[1]);
          intersects.push(x);
        }
      }
      intersects.sort((a, b) => a - b);
      for (let i = 0; i < intersects.length - 1; i += 2) {
        const x1 = Math.max(0, Math.floor(intersects[i]));
        const x2 = Math.min(width - 1, Math.ceil(intersects[i + 1]));
        for (let x = x1; x <= x2; x++) setPixel(x, y, r, g, b, a);
      }
    }
  };

  // Thick line
  const drawLine = (x1, y1, x2, y2, thickness, r, g, b, a = 255) => {
    const steps = Math.ceil(Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      fillCircle(px, py, thickness / 2, r, g, b, a);
    }
  };

  // Gradient fill background (linear, top-left to bottom-right)
  const fillGradient = (x1r, x1g, x1b, x2r, x2g, x2b) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = (x + y) / (width + height);
        const r = Math.round(x1r + (x2r - x1r) * t);
        const g = Math.round(x1g + (x2g - x1g) * t);
        const b = Math.round(x1b + (x2b - x1b) * t);
        setPixel(x, y, r, g, b, 255);
      }
    }
  };

  // Run draw function
  drawFn({ setPixel, fillCircle, fillRect, fillRoundRect, fillPolygon, drawLine, fillGradient, width, height });

  // Encode PNG
  return encodePNG(pixels, width, height);
}

function encodePNG(pixels, width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([typeBytes, data]));
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc >>> 0);
    return Buffer.concat([len, typeBytes, data, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB (we'll handle alpha by premultiplying with white bg)
  // Actually use RGBA: color type 6
  ihdr[9] = 6;
  const ihdrChunk = chunk('IHDR', ihdr);

  // IDAT — convert pixel buffer to filtered scanlines
  const scanlines = Buffer.alloc((1 + width * 4) * height);
  for (let y = 0; y < height; y++) {
    scanlines[y * (width * 4 + 1)] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const si = y * (width * 4 + 1) + 1 + x * 4;
      const pi = (y * width + x) * 4;
      scanlines[si]     = pixels[pi];
      scanlines[si + 1] = pixels[pi + 1];
      scanlines[si + 2] = pixels[pi + 2];
      scanlines[si + 3] = pixels[pi + 3];
    }
  }
  const compressed = zlib.deflateSync(scanlines, { level: 6 });
  const idatChunk = chunk('IDAT', compressed);

  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32
function crc32(buf) {
  let c = 0xFFFFFFFF;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── ICON DRAW FUNCTION ────────────────────────────────────────
function drawIcon({ fillGradient, fillRoundRect, fillRect, fillCircle, fillPolygon, drawLine, width: W, height: H }) {
  const s = W;

  // Background gradient: deep blue
  fillGradient(30, 58, 138, 30, 64, 175);  // #1e3a8a → #1e40af

  // Rounded rect mask (simulate rounded corners by overdrawing corners with bg color)
  // We'll just draw directly — icon corners handled by Android

  // ── Certificate document ──────────────────────────────────
  // White paper background
  fillRoundRect(
    Math.round(s*0.16), Math.round(s*0.22),
    Math.round(s*0.68), Math.round(s*0.55),
    Math.round(s*0.03),
    248, 250, 252, 240
  );

  // Gold header band
  fillRoundRect(
    Math.round(s*0.16), Math.round(s*0.22),
    Math.round(s*0.68), Math.round(s*0.115),
    Math.round(s*0.03),
    251, 191, 36, 255   // #fbbf24
  );
  // Cover bottom-radius of gold band
  fillRect(Math.round(s*0.16), Math.round(s*0.30), Math.round(s*0.68), Math.round(s*0.04), 251, 191, 36, 255);

  // Star in gold band
  const cx = Math.round(s * 0.50), cy = Math.round(s * 0.265), starR = Math.round(s * 0.038);
  const starPoints = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI / 5) - Math.PI / 2;
    const r = i % 2 === 0 ? starR : starR * 0.42;
    starPoints.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  fillPolygon(starPoints, 30, 64, 175, 200);

  // Horizontal lines (certificate text lines)
  const lineColor = [148, 163, 184, 180]; // slate-400
  const lineColor2 = [30, 58, 138, 160];  // blue-900
  fillRoundRect(Math.round(s*0.26), Math.round(s*0.41), Math.round(s*0.48), Math.round(s*0.022), Math.round(s*0.008), ...lineColor);
  fillRoundRect(Math.round(s*0.22), Math.round(s*0.455), Math.round(s*0.56), Math.round(s*0.028), Math.round(s*0.008), ...lineColor2);
  fillRoundRect(Math.round(s*0.26), Math.round(s*0.50), Math.round(s*0.48), Math.round(s*0.018), Math.round(s*0.006), ...lineColor);
  fillRoundRect(Math.round(s*0.30), Math.round(s*0.535), Math.round(s*0.40), Math.round(s*0.015), Math.round(s*0.005), ...lineColor);

  // Seal circle (bottom right of cert)
  fillCircle(Math.round(s*0.695), Math.round(s*0.665), Math.round(s*0.072), 30, 58, 138, 35);
  // Seal ring
  const sealX = Math.round(s*0.695), sealY = Math.round(s*0.665), sealR = Math.round(s*0.065);
  for (let t = 0; t < Math.PI * 2; t += 0.05) {
    const px = sealX + Math.cos(t) * sealR;
    const py = sealY + Math.sin(t) * sealR;
    fillCircle(px, py, Math.round(s*0.007), 30, 58, 138, 90);
  }

  // ── Graduation Cap ────────────────────────────────────────
  const capCY = Math.round(s * 0.215);
  const capHalfW = Math.round(s * 0.24);
  const capH = Math.round(s * 0.09);

  // Mortarboard flat top (diamond shape)
  fillPolygon([
    [Math.round(s*0.50), capCY - capH],
    [Math.round(s*0.50) + capHalfW, capCY],
    [Math.round(s*0.50), capCY + capH],
    [Math.round(s*0.50) - capHalfW, capCY],
  ], 251, 191, 36, 255);

  // Cap shadow (right side darker)
  fillPolygon([
    [Math.round(s*0.50), capCY + capH],
    [Math.round(s*0.50) + capHalfW, capCY],
    [Math.round(s*0.50) + capHalfW, capCY + Math.round(s*0.03)],
    [Math.round(s*0.50), capCY + capH + Math.round(s*0.03)],
  ], 180, 120, 10, 200);

  // Cap stem (vertical part)
  fillRect(
    Math.round(s*0.477), capCY,
    Math.round(s*0.046), Math.round(s*0.10),
    200, 130, 15, 230
  );

  // Tassel cord (right side)
  const tassX = Math.round(s*0.50) + capHalfW;
  drawLine(tassX, capCY, tassX, Math.round(s*0.39), Math.round(s*0.012), 251, 191, 36, 255);
  fillCircle(tassX, Math.round(s*0.39), Math.round(s*0.022), 251, 191, 36, 255);

  // Tassel strands
  drawLine(tassX, Math.round(s*0.41), Math.round(tassX - s*0.025), Math.round(s*0.46), Math.round(s*0.008), 245, 158, 11, 220);
  drawLine(tassX, Math.round(s*0.41), tassX, Math.round(s*0.47), Math.round(s*0.008), 245, 158, 11, 220);
  drawLine(tassX, Math.round(s*0.41), Math.round(tassX + s*0.025), Math.round(s*0.46), Math.round(s*0.008), 245, 158, 11, 220);

  // ── Bottom accent dots ────────────────────────────────────
  fillCircle(Math.round(s*0.35), Math.round(s*0.82), Math.round(s*0.018), 251, 191, 36, 200);
  fillCircle(Math.round(s*0.50), Math.round(s*0.84), Math.round(s*0.024), 251, 191, 36, 255);
  fillCircle(Math.round(s*0.65), Math.round(s*0.82), Math.round(s*0.018), 251, 191, 36, 200);
}

// ── Generate icons ─────────────────────────────────────────────
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

console.log('Generating icon.png (1024×1024)...');
const iconPNG = createPNG(1024, 1024, drawIcon);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), iconPNG);
console.log('✅ assets/icon.png written (' + Math.round(iconPNG.length / 1024) + ' KB)');

console.log('Generating adaptive-icon.png (1024×1024)...');
// Adaptive: same icon but without rounded corners (Android handles shape)
const adaptivePNG = createPNG(1024, 1024, drawIcon);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), adaptivePNG);
console.log('✅ assets/adaptive-icon.png written');

console.log('Generating splash.png (2048×2048)...');
const splashPNG = createPNG(2048, 2048, ({ fillGradient, fillRoundRect, fillCircle, fillPolygon, fillRect, drawLine, width: W, height: H }) => {
  const s = W;
  fillGradient(30, 58, 138, 30, 64, 175);
  // Center logo — same icon scaled to center
  drawIcon({ fillGradient: () => {}, fillRoundRect, fillRect, fillCircle, fillPolygon, drawLine, width: W, height: H });
});
fs.writeFileSync(path.join(assetsDir, 'splash.png'), splashPNG);
console.log('✅ assets/splash.png written');

console.log('');
console.log('🎉 All icons generated successfully!');
