/**
 * Test utilities for image testing
 */

/**
 * Generate a solid color image buffer
 */
export function generateSolidColorImage(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a: number = 255,
  format: "rgba" | "rgb" = "rgba"
): Buffer {
  const channels = format === "rgba" ? 4 : 3;
  const buffer = new Uint8Array(width * height * channels);

  for (let i = 0; i < width * height; i++) {
    const offset = i * channels;
    buffer[offset] = r;
    buffer[offset + 1] = g;
    buffer[offset + 2] = b;
    if (format === "rgba") {
      buffer[offset + 3] = a;
    }
  }

  return Buffer.from(buffer);
}

/**
 * Generate a gradient image buffer (horizontal red to blue gradient)
 */
export function generateGradientImage(
  width: number,
  height: number,
  format: "rgba" | "rgb" = "rgba"
): Buffer {
  const channels = format === "rgba" ? 4 : 3;
  const buffer = new Uint8Array(width * height * channels);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const offset = i * channels;
      const ratio = x / (width - 1);

      buffer[offset] = Math.round(255 * (1 - ratio)); // Red decreases
      buffer[offset + 1] = 0; // Green stays 0
      buffer[offset + 2] = Math.round(255 * ratio); // Blue increases
      if (format === "rgba") {
        buffer[offset + 3] = 255; // Alpha
      }
    }
  }

  return Buffer.from(buffer);
}

/**
 * Generate a checkerboard pattern
 */
export function generateCheckerboardImage(
  width: number,
  height: number,
  squareSize: number = 8,
  format: "rgba" | "rgb" = "rgba"
): Buffer {
  const channels = format === "rgba" ? 4 : 3;
  const buffer = new Uint8Array(width * height * channels);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const offset = i * channels;

      const squareX = Math.floor(x / squareSize);
      const squareY = Math.floor(y / squareSize);
      const isBlack = (squareX + squareY) % 2 === 0;

      const value = isBlack ? 0 : 255;
      buffer[offset] = value;
      buffer[offset + 1] = value;
      buffer[offset + 2] = value;
      if (format === "rgba") {
        buffer[offset + 3] = 255;
      }
    }
  }

  return Buffer.from(buffer);
}

/**
 * Generate a simple pattern with different colors in each quadrant
 */
export function generateQuadrantImage(
  width: number,
  height: number,
  format: "rgba" | "rgb" = "rgba"
): Buffer {
  const channels = format === "rgba" ? 4 : 3;
  const buffer = new Uint8Array(width * height * channels);
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const offset = i * channels;

      let r: number, g: number, b: number;
      if (x < halfWidth && y < halfHeight) {
        // Top-left: Red
        r = 255;
        g = 0;
        b = 0;
      } else if (x >= halfWidth && y < halfHeight) {
        // Top-right: Green
        r = 0;
        g = 255;
        b = 0;
      } else if (x < halfWidth && y >= halfHeight) {
        // Bottom-left: Blue
        r = 0;
        g = 0;
        b = 255;
      } else {
        // Bottom-right: Yellow
        r = 255;
        g = 255;
        b = 0;
      }

      buffer[offset] = r;
      buffer[offset + 1] = g;
      buffer[offset + 2] = b;
      if (format === "rgba") {
        buffer[offset + 3] = 255;
      }
    }
  }

  return Buffer.from(buffer);
}

interface PixelDifference {
  different: boolean;
  difference: number;
  maxDiff: number;
  totalDiff: number;
  differentPixels: number;
  percentDifferent: number;
}

/**
 * Simple pixel difference calculation for image comparison
 */
export function calculatePixelDifference(
  buffer1: Buffer,
  buffer2: Buffer,
  width: number,
  height: number,
  format: "rgba" | "rgb" = "rgba"
): PixelDifference {
  if (buffer1.length !== buffer2.length) {
    return {
      different: true,
      difference: Infinity,
      maxDiff: 255,
      totalDiff: Infinity,
      differentPixels: width * height,
      percentDifferent: 100,
    };
  }

  const channels = format === "rgba" ? 4 : 3;
  let totalDiff = 0;
  let maxDiff = 0;
  let differentPixels = 0;

  for (let i = 0; i < width * height; i++) {
    const offset = i * channels;
    let pixelDiff = 0;

    for (let c = 0; c < channels; c++) {
      const diff = Math.abs(buffer1[offset + c] - buffer2[offset + c]);
      pixelDiff += diff;
      maxDiff = Math.max(maxDiff, diff);
    }

    if (pixelDiff > 0) {
      differentPixels++;
    }
    totalDiff += pixelDiff;
  }

  const avgDiff = totalDiff / (width * height * channels);
  const percentDifferent = (differentPixels / (width * height)) * 100;

  return {
    different: totalDiff > 0,
    difference: avgDiff,
    maxDiff,
    totalDiff,
    differentPixels,
    percentDifferent,
  };
}

/**
 * Assert that two images are similar within a tolerance
 */
export function assertImagesSimilar(
  actual: Buffer,
  expected: Buffer,
  width: number,
  height: number,
  format: "rgba" | "rgb" = "rgba",
  tolerance: number = 1
): void {
  const diff = calculatePixelDifference(
    actual,
    expected,
    width,
    height,
    format
  );

  if (diff.maxDiff > tolerance) {
    throw new Error(
      `Images differ by more than tolerance. Max difference: ${diff.maxDiff}, Average: ${diff.difference.toFixed(2)}, ${diff.percentDifferent.toFixed(2)}% of pixels different`
    );
  }
}

/**
 * Create a test image with specific dimensions filled with a pattern
 */
export function createTestPattern(
  width: number,
  height: number,
  format: "rgba" | "rgb" = "rgba"
): Buffer {
  const channels = format === "rgba" ? 4 : 3;
  const buffer = new Uint8Array(width * height * channels);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const offset = i * channels;

      // Create a pattern based on position
      buffer[offset] = (x * 255) / width; // Red gradient horizontally
      buffer[offset + 1] = (y * 255) / height; // Green gradient vertically
      buffer[offset + 2] = ((x + y) * 127) / (width + height); // Blue diagonal
      if (format === "rgba") {
        buffer[offset + 3] = 255; // Full alpha
      }
    }
  }

  return Buffer.from(buffer);
}
