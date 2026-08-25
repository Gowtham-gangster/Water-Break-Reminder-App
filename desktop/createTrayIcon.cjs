// Generates valid PNG icons for EyeFlow Windows App and System Tray
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPngBuffer(width, height, drawPixel) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8 bits per channel
  ihdrData.writeUInt8(6, 9); // RGBA color type
  ihdrData.writeUInt8(0, 10); // Compression
  ihdrData.writeUInt8(0, 11); // Filter
  ihdrData.writeUInt8(0, 12); // Interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Scanlines with filter byte 0
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const lineOffset = y * scanlineLength;
    rawData[lineOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = lineOffset + 1 + x * 4;
      const [r, g, b, a] = drawPixel(x, y, width, height);
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const idatCompressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', idatCompressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const buffer = Buffer.alloc(8 + length + 4);
  buffer.writeUInt32BE(length, 0);
  buffer.write(type, 4, 4, 'ascii');
  data.copy(buffer, 8);

  const crc = crc32(buffer.subarray(4, 8 + length));
  buffer.writeUInt32BE(crc >>> 0, 8 + length);
  return buffer;
}

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }

  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

// 1. Generate 256x256 high-resolution App Icon (Required for Windows EXE and NSIS)
const appIconBuf = createPngBuffer(256, 256, (x, y, w, h) => {
  const cx = w / 2 - 0.5;
  const cy = h / 2 - 0.5;
  const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
  const maxR = 116;

  if (dist <= maxR) {
    // Smooth anti-aliased edge
    const edgeAlpha = dist > maxR - 2 ? Math.floor((maxR - dist) * 127.5) : 255;
    // Iris / pupil center
    const innerDist = Math.sqrt((x - cx) * (x - cx) + (y - (cy + 10)) * (y - (cy + 10)));
    if (innerDist <= 32) {
      return [255, 255, 255, edgeAlpha]; // White center
    }
    if (dist <= maxR - 16) {
      return [14, 165, 233, edgeAlpha]; // Vibrant Cyan/Sky Blue (#0ea5e9)
    }
    return [2, 132, 199, edgeAlpha]; // Ocean Blue (#0284c7)
  }
  return [0, 0, 0, 0];
});

// 2. Generate 32x32 Tray Icon
const trayIconBuf = createPngBuffer(32, 32, (x, y, w, h) => {
  const cx = w / 2 - 0.5;
  const cy = h / 2 - 0.5;
  const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
  if (dist <= 14) {
    const innerDist = Math.sqrt((x - cx) * (x - cx) + (y - (cy + 1)) * (y - (cy + 1)));
    if (innerDist <= 4) return [255, 255, 255, 255];
    if (dist <= 12) return [14, 165, 233, 255];
    return [2, 132, 199, 255];
  }
  return [0, 0, 0, 0];
});

const appIconPath = path.join(__dirname, 'appIcon.png');
const trayIconPath = path.join(__dirname, 'trayIcon.png');

fs.writeFileSync(appIconPath, appIconBuf);
fs.writeFileSync(trayIconPath, trayIconBuf);

console.log('App icon (256x256) created at:', appIconPath, 'Size:', appIconBuf.length, 'bytes');
console.log('Tray icon (32x32) created at:', trayIconPath, 'Size:', trayIconBuf.length, 'bytes');
