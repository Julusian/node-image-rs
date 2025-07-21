import test from "ava";
import { ImageTransformer } from "../index.js";
import {
  generateSolidColorImage,
  generateGradientImage,
  generateCheckerboardImage,
  generateQuadrantImage,
  assertImagesSimilar,
  calculatePixelDifference,
} from "./test-utils.mjs";
import fs from "fs/promises";
import path from "path";

// Test encoded image functionality
test("fromEncodedImage - PNG decoding", async (t) => {
  // Skip this test if we don't have a test PNG file
  try {
    const pngPath = path.join(process.cwd(), "change.png");
    const pngBuffer = await fs.readFile(pngPath);

    t.notThrows(() => {
      const transformer = ImageTransformer.fromEncodedImage(pngBuffer);
      const dims = transformer.getCurrentDimensions();
      t.true(dims.width > 0);
      t.true(dims.height > 0);
    });
  } catch (error) {
    t.pass("PNG file not available for testing");
  }
});

test("toEncodedImageSync - PNG format verification", (t) => {
  const size = { width: 8, height: 8 };
  const buffer = generateSolidColorImage(size.width, size.height, 255, 128, 64);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = transformer.toEncodedImageSync("Png");

  t.true(Buffer.isBuffer(result.buffer));
  t.true(result.buffer.length > 0);
  t.is(result.width, size.width);
  t.is(result.height, size.height);

  // Check PNG header signature
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < pngSignature.length; i++) {
    t.is(result.buffer[i], pngSignature[i]);
  }
});

test("toEncodedImageSync - JPEG format verification", (t) => {
  const size = { width: 16, height: 16 };
  const buffer = generateGradientImage(size.width, size.height);

  // JPEG doesn't support RGBA, so convert to RGB first
  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const rgbResult = transformer.toBufferSync("rgb");

  // Now encode the RGB data as JPEG
  const rgbTransformer = ImageTransformer.fromBuffer(
    rgbResult.buffer,
    size.width,
    size.height,
    "rgb"
  );
  const result = rgbTransformer.toEncodedImageSync("Jpeg", 0.8);

  t.true(Buffer.isBuffer(result.buffer));
  t.true(result.buffer.length > 0);
  t.is(result.width, size.width);
  t.is(result.height, size.height);

  // Check JPEG header (SOI marker)
  t.is(result.buffer[0], 0xff);
  t.is(result.buffer[1], 0xd8);
});

test("toEncodedImageSync - WebP format verification", (t) => {
  const size = { width: 12, height: 12 };
  const buffer = generateCheckerboardImage(size.width, size.height, 3);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = transformer.toEncodedImageSync("WebP", 0.9);

  t.true(Buffer.isBuffer(result.buffer));
  t.true(result.buffer.length > 0);
  t.is(result.width, size.width);
  t.is(result.height, size.height);

  // Check WebP RIFF header
  t.is(result.buffer[0], 0x52); // 'R'
  t.is(result.buffer[1], 0x49); // 'I'
  t.is(result.buffer[2], 0x46); // 'F'
  t.is(result.buffer[3], 0x46); // 'F'
  // Check WebP signature
  t.is(result.buffer[8], 0x57); // 'W'
  t.is(result.buffer[9], 0x45); // 'E'
  t.is(result.buffer[10], 0x42); // 'B'
  t.is(result.buffer[11], 0x50); // 'P'
});

test("encoded image round trip - PNG", (t) => {
  const size = { width: 4, height: 4 };
  const original = generateQuadrantImage(size.width, size.height);

  // Encode to PNG
  const transformer1 = ImageTransformer.fromBuffer(
    original,
    size.width,
    size.height,
    "rgba"
  );
  const encoded = transformer1.toEncodedImageSync("Png");

  // Decode from PNG
  const transformer2 = ImageTransformer.fromEncodedImage(encoded.buffer);
  const decoded = transformer2.toBufferSync("rgba");

  t.is(decoded.width, size.width);
  t.is(decoded.height, size.height);

  // PNG is lossless, so colors should be exactly preserved
  const originalData = new Uint8Array(original);
  const decodedData = new Uint8Array(decoded.buffer);

  // Check first pixel (top-left quadrant should be red)
  t.is(decodedData[0], originalData[0]); // Red
  t.is(decodedData[1], originalData[1]); // Green
  t.is(decodedData[2], originalData[2]); // Blue
  t.is(decodedData[3], originalData[3]); // Alpha
});

test("JPEG quality levels produce different file sizes", (t) => {
  const size = { width: 32, height: 32 };
  const buffer = generateGradientImage(size.width, size.height);

  // Convert to RGB first since JPEG doesn't support RGBA
  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const rgbResult = transformer.toBufferSync("rgb");

  const rgbTransformer = ImageTransformer.fromBuffer(
    rgbResult.buffer,
    size.width,
    size.height,
    "rgb"
  );

  const highQuality = rgbTransformer.toEncodedImageSync("Jpeg", 0.95);
  const mediumQuality = rgbTransformer.toEncodedImageSync("Jpeg", 0.5);
  const lowQuality = rgbTransformer.toEncodedImageSync("Jpeg", 0.1);

  // Higher quality should generally produce larger files
  t.true(highQuality.buffer.length > mediumQuality.buffer.length);
  t.true(mediumQuality.buffer.length > lowQuality.buffer.length);

  // All should have same dimensions
  t.is(highQuality.width, size.width);
  t.is(mediumQuality.width, size.width);
  t.is(lowQuality.width, size.width);
});

test("toEncodedImage - async PNG encoding", async (t) => {
  const size = { width: 30, height: 30 };
  const buffer = generateCheckerboardImage(size.width, size.height, 5);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = await transformer.toEncodedImage("Png");

  t.true(Buffer.isBuffer(result.buffer));
  t.is(result.width, size.width);
  t.is(result.height, size.height);
});

// Test memory and buffer management
test("buffer management - large operations", (t) => {
  const size = { width: 200, height: 150 };
  const buffer = generateSolidColorImage(size.width, size.height, 128, 64, 192);

  t.notThrows(() => {
    const transformer = ImageTransformer.fromBuffer(
      buffer,
      size.width,
      size.height,
      "rgba"
    );
    const result = transformer
      .scale(100, 75)
      .flipHorizontal()
      .flipVertical()
      .toBufferSync("rgba");

    t.is(result.width, 100);
    t.is(result.height, 75);
  });
});

// Test format consistency - round trip conversions
test("format consistency - RGBA->RGB->RGBA round trip", (t) => {
  const size = { width: 6, height: 6 };
  const original = generateSolidColorImage(
    size.width,
    size.height,
    200,
    100,
    50,
    255
  );

  const transformer = ImageTransformer.fromBuffer(
    original,
    size.width,
    size.height,
    "rgba"
  );
  const rgbResult = transformer.toBufferSync("rgb");

  // Create new transformer from RGB data
  const transformer2 = ImageTransformer.fromBuffer(
    rgbResult.buffer,
    size.width,
    size.height,
    "rgb"
  );
  const rgbaResult = transformer2.toBufferSync("rgba");

  t.is(rgbaResult.width, size.width);
  t.is(rgbaResult.height, size.height);

  // Check that RGB values are preserved (alpha will be 255)
  const resultData = new Uint8Array(rgbaResult.buffer);
  t.is(resultData[0], 200); // Red
  t.is(resultData[1], 100); // Green
  t.is(resultData[2], 50); // Blue
  t.is(resultData[3], 255); // Alpha should be 255
});

// Test specific resize mode behaviors
test("resize modes - Fill vs Fit vs Exact behavior verification", (t) => {
  const original = { width: 60, height: 30 }; // 2:1 aspect ratio
  const target = { width: 40, height: 40 }; // 1:1 aspect ratio
  const buffer = generateQuadrantImage(original.width, original.height);

  // Exact mode - should distort to exact dimensions
  const exactTransformer = ImageTransformer.fromBuffer(
    buffer,
    original.width,
    original.height,
    "rgba"
  );
  const exactResult = exactTransformer
    .scale(target.width, target.height, "Exact")
    .toBufferSync("rgba");
  t.is(exactResult.width, target.width);
  t.is(exactResult.height, target.height);

  // Fit mode - should maintain aspect ratio, fit within bounds
  // Original 60x30 (2:1) into 40x40 target -> should be 40x20 (maintains 2:1 ratio)
  const fitTransformer = ImageTransformer.fromBuffer(
    buffer,
    original.width,
    original.height,
    "rgba"
  );
  const fitResult = fitTransformer
    .scale(target.width, target.height, "Fit")
    .toBufferSync("rgba");
  t.is(fitResult.width, 40);
  t.is(fitResult.height, 20);

  // Fill mode - should maintain aspect ratio, fill bounds (may crop)
  const fillTransformer = ImageTransformer.fromBuffer(
    buffer,
    original.width,
    original.height,
    "rgba"
  );
  const fillResult = fillTransformer
    .scale(target.width, target.height, "Fill")
    .toBufferSync("rgba");
  t.is(fillResult.width, target.width);
  t.is(fillResult.height, target.height);
});

// Test crop boundary conditions
test("crop - boundary validation", (t) => {
  const size = { width: 10, height: 10 };
  const buffer = generateSolidColorImage(
    size.width,
    size.height,
    100,
    150,
    200
  );

  // Valid crops
  const transformer1 = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result1 = transformer1
    .crop(0, 0, size.width, size.height)
    .toBufferSync("rgba");
  t.is(result1.width, size.width);
  t.is(result1.height, size.height);

  const transformer2 = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result2 = transformer2.crop(5, 5, 5, 5).toBufferSync("rgba");
  t.is(result2.width, 5);
  t.is(result2.height, 5);

  // Edge case: 1x1 crop
  const transformer3 = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result3 = transformer3.crop(9, 9, 1, 1).toBufferSync("rgba");
  t.is(result3.width, 1);
  t.is(result3.height, 1);
});

// Test chaining operation correctness
test("operation chain - order dependency", (t) => {
  const size = { width: 8, height: 6 };
  const buffer = generateQuadrantImage(size.width, size.height);

  // Chain 1: Scale then rotate
  const transformer1 = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result1 = transformer1.scale(4, 3).rotate("CW90").toBufferSync("rgba");
  t.is(result1.width, 3); // After scale(4,3) then rotate90: 3x4
  t.is(result1.height, 4);

  // Chain 2: Rotate then scale
  const transformer2 = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result2 = transformer2.rotate("CW90").scale(4, 3).toBufferSync("rgba");
  t.is(result2.width, 4); // After rotate90(6x8) then scale: 4x3
  t.is(result2.height, 3);

  // Results should have different dimensions due to order
  t.not(result1.width, result2.width);
  t.not(result1.height, result2.height);
});

// Test format handling edge cases
test("format edge cases - buffer size validation", (t) => {
  const size = { width: 4, height: 4 };

  // Correct RGBA buffer size
  const rgbaBuffer = Buffer.alloc(size.width * size.height * 4);
  t.notThrows(() => {
    ImageTransformer.fromBuffer(rgbaBuffer, size.width, size.height, "rgba");
  });

  // Correct RGB buffer size
  const rgbBuffer = Buffer.alloc(size.width * size.height * 3);
  t.notThrows(() => {
    ImageTransformer.fromBuffer(rgbBuffer, size.width, size.height, "rgb");
  });

  // Wrong buffer size for RGBA
  const wrongRgbaBuffer = Buffer.alloc(size.width * size.height * 3);
  t.throws(() => {
    ImageTransformer.fromBuffer(
      wrongRgbaBuffer,
      size.width,
      size.height,
      "rgba"
    ).toBufferSync("rgba");
  });

  // Wrong buffer size for RGB
  const wrongRgbBuffer = Buffer.alloc(size.width * size.height * 2);
  t.throws(() => {
    ImageTransformer.fromBuffer(
      wrongRgbBuffer,
      size.width,
      size.height,
      "rgb"
    ).toBufferSync("rgb");
  });
});
