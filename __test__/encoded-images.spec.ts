import { it, expect } from "vitest";
import { ImageTransformer } from "../index.js";
import {
  generateSolidColorImage,
  generateGradientImage,
  generateCheckerboardImage,
  generateQuadrantImage,
} from "./test-utils.js";
import fs from "fs/promises";
import path from "path";

it("toEncodedImageSync - PNG format verification", () => {
  const size = { width: 8, height: 8 };
  const buffer = generateSolidColorImage(size.width, size.height, 255, 128, 64);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = transformer.toEncodedImageSync("Png");

  expect(Buffer.isBuffer(result.buffer)).toBe(true);
  expect(result.buffer.length).toBeGreaterThan(0);
  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);

  // Check PNG header signature
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < pngSignature.length; i++) {
    expect(result.buffer[i]).toBe(pngSignature[i]);
  }
});

it("toEncodedImageSync - JPEG format with RGBA", () => {
  const size = { width: 16, height: 16 };
  const buffer = generateGradientImage(size.width, size.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );

  // Library should handle RGBA->RGB conversion internally for JPEG
  const result = transformer.toEncodedImageSync("Jpeg", { quality: 0.8 });

  expect(Buffer.isBuffer(result.buffer)).toBe(true);
  expect(result.buffer.length).toBeGreaterThan(0);
  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);

  // Check JPEG header (SOI marker)
  expect(result.buffer[0]).toBe(0xff);
  expect(result.buffer[1]).toBe(0xd8);
});

it("toEncodedImageSync - JPEG format verification with RGB", () => {
  const size = { width: 16, height: 16 };
  const buffer = generateGradientImage(size.width, size.height, "rgb");

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgb"
  );
  const result = transformer.toEncodedImageSync("Jpeg", { quality: 0.8 });

  expect(Buffer.isBuffer(result.buffer)).toBe(true);
  expect(result.buffer.length).toBeGreaterThan(0);
  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);

  // Check JPEG header (SOI marker)
  expect(result.buffer[0]).toBe(0xff);
  expect(result.buffer[1]).toBe(0xd8);
});

it("toEncodedImageSync - WebP format verification", () => {
  const size = { width: 12, height: 12 };
  const buffer = generateCheckerboardImage(size.width, size.height, 3);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = transformer.toEncodedImageSync("WebP", { quality: 0.9 });

  expect(Buffer.isBuffer(result.buffer)).toBe(true);
  expect(result.buffer.length).toBeGreaterThan(0);
  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);

  // Check WebP RIFF header
  expect(result.buffer[0]).toBe(0x52); // 'R'
  expect(result.buffer[1]).toBe(0x49); // 'I'
  expect(result.buffer[2]).toBe(0x46); // 'F'
  expect(result.buffer[3]).toBe(0x46); // 'F'
  // Check WebP signature
  expect(result.buffer[8]).toBe(0x57); // 'W'
  expect(result.buffer[9]).toBe(0x45); // 'E'
  expect(result.buffer[10]).toBe(0x42); // 'B'
  expect(result.buffer[11]).toBe(0x50); // 'P'
});

it("encoded image round trip - PNG", () => {
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

  expect(decoded.width).toBe(size.width);
  expect(decoded.height).toBe(size.height);

  // Check first pixel (top-left quadrant should be red)
  expect(decoded.buffer[0]).toBe(original[0]); // Red
  expect(decoded.buffer[1]).toBe(original[1]); // Green
  expect(decoded.buffer[2]).toBe(original[2]); // Blue
  expect(decoded.buffer[3]).toBe(original[3]); // Alpha
});

it("JPEG quality levels produce different file sizes", () => {
  const size = { width: 32, height: 32 };
  const buffer = generateGradientImage(size.width, size.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );

  const highQuality = transformer.toEncodedImageSync("Jpeg", {
    quality: 0.95,
  });
  const mediumQuality = transformer.toEncodedImageSync("Jpeg", {
    quality: 0.5,
  });
  const lowQuality = transformer.toEncodedImageSync("Jpeg", {
    quality: 0.1,
  });

  // Higher quality should generally produce larger files
  expect(highQuality.buffer.length).toBeGreaterThan(
    mediumQuality.buffer.length
  );
  expect(mediumQuality.buffer.length).toBeGreaterThan(lowQuality.buffer.length);

  // All should have same dimensions
  expect(highQuality.width).toBe(size.width);
  expect(mediumQuality.width).toBe(size.width);
  expect(lowQuality.width).toBe(size.width);
});

it("toEncodedImage - async PNG encoding", async () => {
  const size = { width: 30, height: 30 };
  const buffer = generateCheckerboardImage(size.width, size.height, 5);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = await transformer.toEncodedImage("Png");

  expect(Buffer.isBuffer(result.buffer)).toBe(true);
  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);
});
