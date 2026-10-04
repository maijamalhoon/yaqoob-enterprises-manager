const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function generatePng(size) {
  const width = size;
  const height = size;

  // Raw image data with filter byte 0 at start of each scanline
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  const radius = size * 0.22;
  const center = size / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Rounded rectangle check for badge background
      const margin = size * 0.05;
      const innerW = width - 2 * margin;
      const innerH = height - 2 * margin;
      const cornerR = radius;

      const dx = Math.max(0, Math.abs(x - center) - (innerW / 2 - cornerR));
      const dy = Math.max(0, Math.abs(y - center) - (innerH / 2 - cornerR));
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= cornerR) {
        // Gradient from Emerald (#059669) to Indigo (#4F46E5)
        const t = (x + y) / (width + height);
        const r = Math.round(5 * (1 - t) + 79 * t);
        const g = Math.round(150 * (1 - t) + 70 * t);
        const b = Math.round(105 * (1 - t) + 229 * t);

        // Check if pixel is part of stylized 'Y' symbol
        const relX = (x - center) / (size * 0.38);
        const relY = (y - center) / (size * 0.38);

        // Draw 'Y' symbol: left arm, right arm, and stem
        const inLeftArm = Math.abs(relX + relY * 0.8) < 0.22 && relY < 0.05 && relY > -0.85;
        const inRightArm = Math.abs(relX - relY * 0.8) < 0.22 && relY < 0.05 && relY > -0.85;
        const inStem = Math.abs(relX) < 0.16 && relY >= -0.05 && relY < 0.85;

        if (inLeftArm || inRightArm || inStem) {
          // White symbol
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 255;
          rawData[pxOffset + 2] = 255;
          rawData[pxOffset + 3] = 255;
        } else {
          rawData[pxOffset] = r;
          rawData[pxOffset + 1] = g;
          rawData[pxOffset + 2] = b;
          rawData[pxOffset + 3] = 255;
        }
      } else {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  // Compress IDAT
  const compressed = zlib.deflateSync(rawData, { level: 9 });

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT
  const idatChunk = createChunk('IDAT', compressed);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const outDir = path.resolve(__dirname, '../public/assets');
fs.writeFileSync(path.join(outDir, 'icon-192.png'), generatePng(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), generatePng(512));
console.log('Generated icon-192.png and icon-512.png successfully!');
