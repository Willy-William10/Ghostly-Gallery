const QR_VERSION = 2;
const QR_SIZE = 17 + QR_VERSION * 4;
const DATA_CODEWORDS = 34;
const ECC_CODEWORDS = 10;

export function drawQrCode(canvas, text) {
  if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError("A canvas is required to draw a QR code.");
  const matrix = createQrMatrix(text);
  const quiet = 4;
  const modules = matrix.length + quiet * 2;
  const resolution = 330;
  const unit = resolution / modules;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas is not available in this browser.");
  canvas.width = resolution;
  canvas.height = resolution;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, resolution, resolution);
  context.fillStyle = "#100b1d";
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) context.fillRect(Math.round((x + quiet) * unit), Math.round((y + quiet) * unit), Math.ceil(unit), Math.ceil(unit));
  }));
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Locally generated QR code for your Ghostly account ID");
  return matrix;
}

export function createQrMatrix(text) {
  const bytes = new TextEncoder().encode(String(text));
  if (bytes.length > 32) throw new RangeError("This local QR encoder supports account IDs up to 32 bytes.");
  const bits = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  const capacity = DATA_CODEWORDS * 8;
  for (let i = 0; i < Math.min(4, capacity - bits.length); i += 1) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  for (let pad = 0; data.length < DATA_CODEWORDS; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11);
  const codewords = data.concat(reedSolomon(data, ECC_CODEWORDS));
  const codewordBits = [];
  codewords.forEach((word) => appendBits(codewordBits, word, 8));

  const base = makeFunctionPatterns();
  const candidates = [];
  for (let mask = 0; mask < 8; mask += 1) {
    const modules = base.modules.map((row) => row.slice());
    placeData(modules, base.functionModules, codewordBits, mask);
    writeFormatBits(modules, base.functionModules, mask);
    candidates.push({ matrix: modules, penalty: scoreMatrix(modules) });
  }
  candidates.sort((a, b) => a.penalty - b.penalty);
  return candidates[0].matrix;
}

function appendBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
}

function reedSolomon(data, degree) {
  let generator = [1];
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    const next = Array(generator.length + 1).fill(0);
    generator.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= gfMultiply(coefficient, root);
    });
    generator = next;
    root = gfMultiply(root, 2);
  }
  const remainder = data.concat(Array(degree).fill(0));
  for (let i = 0; i < data.length; i += 1) {
    const factor = remainder[i];
    if (factor) generator.forEach((coefficient, j) => { remainder[i + j] ^= gfMultiply(coefficient, factor); });
  }
  return remainder.slice(data.length);
}

function gfMultiply(left, right) {
  let result = 0;
  for (let i = 7; i >= 0; i -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((right >>> i) & 1) * left;
  }
  return result;
}

function makeFunctionPatterns() {
  const modules = Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(false));
  const functionModules = Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(false));
  const set = (x, y, value) => {
    if (x >= 0 && y >= 0 && x < QR_SIZE && y < QR_SIZE) {
      modules[y][x] = Boolean(value);
      functionModules[y][x] = true;
    }
  };
  const finder = (centerX, centerY) => {
    for (let dy = -4; dy <= 4; dy += 1) for (let dx = -4; dx <= 4; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      set(centerX + dx, centerY + dy, distance !== 2 && distance !== 4);
    }
  };
  finder(3, 3);
  finder(QR_SIZE - 4, 3);
  finder(3, QR_SIZE - 4);
  for (let i = 0; i < 5; i += 1) for (let j = 0; j < 5; j += 1) {
    set(QR_SIZE - 7 + j, QR_SIZE - 7 + i, Math.max(Math.abs(i - 2), Math.abs(j - 2)) !== 1);
  }
  for (let i = 8; i < QR_SIZE - 8; i += 1) {
    set(i, 6, i % 2 === 0);
    set(6, i, i % 2 === 0);
  }
  writeFormatBits(modules, functionModules, 0);
  return { modules, functionModules };
}

function writeFormatBits(modules, functionModules, mask) {
  const size = modules.length;
  const data = (0b01 << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i += 1) remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
  const bits = ((data << 10) | remainder) ^ 0x5412;
  const set = (x, y, value) => {
    modules[y][x] = Boolean(value);
    functionModules[y][x] = true;
  };
  for (let i = 0; i <= 5; i += 1) set(8, i, (bits >>> i) & 1);
  set(8, 7, (bits >>> 6) & 1);
  set(8, 8, (bits >>> 7) & 1);
  set(7, 8, (bits >>> 8) & 1);
  for (let i = 9; i < 15; i += 1) set(14 - i, 8, (bits >>> i) & 1);
  for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, (bits >>> i) & 1);
  for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, (bits >>> i) & 1);
  set(8, size - 8, true);
}

function placeData(modules, functionModules, bits, mask) {
  const size = modules.length;
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const upward = ((right + 1) & 2) === 0;
      const y = upward ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (functionModules[y][x]) continue;
        const raw = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        modules[y][x] = raw !== maskCondition(mask, x, y);
        bitIndex += 1;
      }
    }
  }
}

function maskCondition(mask, x, y) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return (x * y) % 2 + (x * y) % 3 === 0;
    case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
    default: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
  }
}

function scoreMatrix(matrix) {
  const size = matrix.length;
  let score = 0;
  const lines = [];
  for (let y = 0; y < size; y += 1) lines.push(matrix[y]);
  for (let x = 0; x < size; x += 1) lines.push(matrix.map((row) => row[x]));
  for (const line of lines) {
    let runColor = line[0];
    let runLength = 1;
    for (let i = 1; i < line.length; i += 1) {
      if (line[i] === runColor) runLength += 1;
      else { if (runLength >= 5) score += runLength - 2; runColor = line[i]; runLength = 1; }
    }
    if (runLength >= 5) score += runLength - 2;
    const pattern = line.map((bit) => bit ? "1" : "0").join("");
    for (let i = 0; i <= pattern.length - 7; i += 1) if (pattern.slice(i, i + 7) === "1011101") {
      if (pattern.slice(Math.max(0, i - 4), i) === "0000" || pattern.slice(i + 7, i + 11) === "0000") score += 40;
    }
  }
  for (let y = 0; y < size - 1; y += 1) for (let x = 0; x < size - 1; x += 1) {
    const value = matrix[y][x];
    if (matrix[y][x + 1] === value && matrix[y + 1][x] === value && matrix[y + 1][x + 1] === value) score += 3;
  }
  const dark = matrix.reduce((total, row) => total + row.filter(Boolean).length, 0);
  score += Math.floor(Math.abs((dark * 100 / (size * size)) - 50) / 5) * 10;
  return score;
}
