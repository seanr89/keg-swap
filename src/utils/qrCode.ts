/**
 * Lightweight, zero-dependency ISO/IEC 18004 QR Code matrix & SVG path generator.
 * Encodes UTF-8 strings in Byte mode with Reed-Solomon Error Correction (Level L, Versions 1–6).
 */

interface VersionSpec {
  version: number;
  totalDataCodewords: number;
  ecCodewordsPerBlock: number;
  numBlocks: number;
  alignmentCoords: number[];
}

const VERSION_SPECS: VersionSpec[] = [
  { version: 1, totalDataCodewords: 19, ecCodewordsPerBlock: 7, numBlocks: 1, alignmentCoords: [] },
  { version: 2, totalDataCodewords: 34, ecCodewordsPerBlock: 10, numBlocks: 1, alignmentCoords: [6, 18] },
  { version: 3, totalDataCodewords: 55, ecCodewordsPerBlock: 15, numBlocks: 1, alignmentCoords: [6, 22] },
  { version: 4, totalDataCodewords: 80, ecCodewordsPerBlock: 20, numBlocks: 1, alignmentCoords: [6, 26] },
  { version: 5, totalDataCodewords: 108, ecCodewordsPerBlock: 26, numBlocks: 1, alignmentCoords: [6, 30] },
  { version: 6, totalDataCodewords: 136, ecCodewordsPerBlock: 18, numBlocks: 2, alignmentCoords: [6, 34] },
];

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let result = new Uint8Array([1]);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(result.length + 1);
    for (let j = 0; j < result.length; j++) {
      next[j] ^= result[j];
      next[j + 1] ^= gfMultiply(result[j], root);
    }
    result = next;
    root = gfMultiply(root, 0x02);
  }
  // Return coefficients excluding the leading x^degree term
  return result.slice(1);
}

function rsComputeRemainder(data: Uint8Array, degree: number): Uint8Array {
  const divisor = rsGeneratorPoly(degree);
  const result = new Uint8Array(degree);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ result[0];
    result.copyWithin(0, 1);
    result[degree - 1] = 0;
    for (let j = 0; j < degree; j++) {
      result[j] ^= gfMultiply(divisor[j], factor);
    }
  }
  return result;
}

function encodeDataCodewords(utf8Bytes: Uint8Array, spec: VersionSpec): Uint8Array {
  const bitBuffer: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bitBuffer.push((val >>> i) & 1);
    }
  };

  // Byte mode indicator (0100) + 8-bit length (versions 1-9)
  pushBits(0b0100, 4);
  pushBits(utf8Bytes.length, 8);
  for (let i = 0; i < utf8Bytes.length; i++) {
    pushBits(utf8Bytes[i], 8);
  }

  const capacityBits = spec.totalDataCodewords * 8;
  const terminatorLen = Math.min(4, capacityBits - bitBuffer.length);
  pushBits(0, terminatorLen);

  while (bitBuffer.length % 8 !== 0) {
    bitBuffer.push(0);
  }

  const dataBytes = new Uint8Array(spec.totalDataCodewords);
  for (let i = 0; i < bitBuffer.length / 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bitBuffer[i * 8 + b];
    }
    dataBytes[i] = byte;
  }

  let padIndex = bitBuffer.length / 8;
  let toggle = true;
  while (padIndex < spec.totalDataCodewords) {
    dataBytes[padIndex++] = toggle ? 0xec : 0x11;
    toggle = !toggle;
  }

  // Compute Reed-Solomon blocks and interleave
  const blockDataSize = spec.totalDataCodewords / spec.numBlocks;
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];

  for (let b = 0; b < spec.numBlocks; b++) {
    const block = dataBytes.slice(b * blockDataSize, (b + 1) * blockDataSize);
    dataBlocks.push(block);
    ecBlocks.push(rsComputeRemainder(block, spec.ecCodewordsPerBlock));
  }

  const finalCodewords = new Uint8Array(
    spec.totalDataCodewords + spec.ecCodewordsPerBlock * spec.numBlocks
  );
  let offset = 0;
  for (let i = 0; i < blockDataSize; i++) {
    for (let b = 0; b < spec.numBlocks; b++) {
      finalCodewords[offset++] = dataBlocks[b][i];
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (let b = 0; b < spec.numBlocks; b++) {
      finalCodewords[offset++] = ecBlocks[b][i];
    }
  }

  return finalCodewords;
}

function computeFormatBits(mask: number): number {
  // Error Correction Level L = 01
  const data = (0b01 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function applyMaskCondition(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

/**
 * Generates a 2D boolean matrix (`true` = dark module, `false` = light module)
 * representing an ISO/IEC 18004 QR code for `text`.
 */
export function generateQrMatrix(text: string): boolean[][] {
  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(text);

  const spec =
    VERSION_SPECS.find((s) => utf8Bytes.length + 2 <= s.totalDataCodewords) ||
    VERSION_SPECS[VERSION_SPECS.length - 1];

  const size = 17 + 4 * spec.version;
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunctionModule = (r: number, c: number, isDark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = isDark;
    isFunction[r][c] = true;
  };

  // 1. Finder patterns + separators
  const drawFinder = (topR: number, leftC: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const isSeparator = dr === -1 || dr === 7 || dc === -1 || dc === 7;
        const isOuterRing = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const isInnerSquare = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunctionModule(topR + dr, leftC + dc, !isSeparator && (isOuterRing || isInnerSquare));
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  // 3. Alignment patterns
  const coords = spec.alignmentCoords;
  for (let i = 0; i < coords.length; i++) {
    for (let j = 0; j < coords.length; j++) {
      // Skip corners that overlap finder patterns
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === coords.length - 1) ||
        (i === coords.length - 1 && j === 0)
      ) {
        continue;
      }
      const centerR = coords[i];
      const centerC = coords[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunctionModule(centerR + dr, centerC + dc, dist !== 1);
        }
      }
    }
  }

  // 4. Dark module & reserve format information slots
  setFunctionModule(4 * spec.version + 9, 8, true);
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      isFunction[8][i] = true;
      isFunction[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunction[8][size - 1 - i] = true;
  }
  for (let i = 0; i < 7; i++) {
    isFunction[size - 1 - i][8] = true;
  }

  // 5. Place data and EC bits in 2-column zig-zag
  const codewords = encodeDataCodewords(utf8Bytes, spec);
  let bitIndex = 0;
  const totalBits = codewords.length * 8;

  let upward = true;
  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5; // Skip vertical timing pattern
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc++) {
        const c = rightCol - dc;
        if (!isFunction[r][c]) {
          let isDark = false;
          if (bitIndex < totalBits) {
            const byteIdx = bitIndex >>> 3;
            const bitShift = 7 - (bitIndex & 7);
            isDark = ((codewords[byteIdx] >>> bitShift) & 1) === 1;
            bitIndex++;
          }
          modules[r][c] = isDark;
        }
      }
    }
    upward = !upward;
  }

  // 6. Apply Mask 0 and write Format Information bits
  const mask = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFunction[r][c] && applyMaskCondition(mask, r, c)) {
        modules[r][c] = !modules[r][c];
      }
    }
  }

  const formatBits = computeFormatBits(mask);
  const getFormatBit = (bitPos: number) => ((formatBits >>> bitPos) & 1) === 1;

  // Top-left format copy (bits 14..0)
  const topLeftRowCols = [0, 1, 2, 3, 4, 5, 7, 8];
  for (let i = 0; i < 8; i++) {
    modules[8][topLeftRowCols[i]] = getFormatBit(14 - i);
  }
  const topLeftColRows = [7, 5, 4, 3, 2, 1, 0];
  for (let i = 0; i < 7; i++) {
    modules[topLeftColRows[i]][8] = getFormatBit(6 - i);
  }

  // Split format copy (bottom-left col 8 bits 14..8 + top-right row 8 bits 7..0)
  for (let i = 0; i < 7; i++) {
    modules[size - 1 - i][8] = getFormatBit(14 - i);
  }
  for (let i = 0; i < 8; i++) {
    modules[8][size - 8 + i] = getFormatBit(7 - i);
  }

  return modules;
}

/**
 * Converts a QR matrix into an SVG `<path d="...">` string and viewBox dimensions
 * including a 4-module quiet zone.
 */
export function buildQrSvgPath(matrix: boolean[][], quietZone = 4): {
  pathData: string;
  viewBoxSize: number;
} {
  const size = matrix.length;
  const viewBoxSize = size + quietZone * 2;
  const segments: string[] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        const x = c + quietZone;
        const y = r + quietZone;
        segments.push(`M${x},${y}h1v1h-1z`);
      }
    }
  }

  return {
    pathData: segments.join(''),
    viewBoxSize,
  };
}
