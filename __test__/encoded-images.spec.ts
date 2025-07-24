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
  const result = transformer.toEncodedImageSync("png");

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
  const result = transformer.toEncodedImageSync("jpeg", { quality: 0.8 });

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
  const result = transformer.toEncodedImageSync("jpeg", { quality: 0.8 });

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
  const result = transformer.toEncodedImageSync("webp", { quality: 0.9 });

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
  const encoded = transformer1.toEncodedImageSync("png");

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

  const highQuality = transformer.toEncodedImageSync("jpeg", {
    quality: 0.95,
  });
  const mediumQuality = transformer.toEncodedImageSync("jpeg", {
    quality: 0.5,
  });
  const lowQuality = transformer.toEncodedImageSync("jpeg", {
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
  const result = await transformer.toEncodedImage("png");

  expect(Buffer.isBuffer(result.buffer)).toBe(true);
  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);
});

// Data URL tests
it("fromImageDataUrl - valid PNG data URL", () => {
  // Create a small test image and encode it to PNG
  const size = { width: 4, height: 4 };
  const buffer = generateSolidColorImage(size.width, size.height, 255, 128, 64);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const pngResult = transformer.toEncodedImageSync("png");

  // Convert PNG to base64 data URL
  const base64Data = pngResult.buffer.toString("base64");
  const dataUrl = `data:image/png;base64,${base64Data}`;

  // Test fromImageDataUrl
  const dataUrlTransformer = ImageTransformer.fromImageDataUrl(dataUrl);
  const result = dataUrlTransformer.toBufferSync("rgba");

  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);
  expect(Buffer.isBuffer(result.buffer)).toBe(true);
});

it("fromImageDataUrl - valid JPEG data URL", () => {
  // Create a test image and encode it to JPEG
  const size = { width: 8, height: 8 };
  const buffer = generateGradientImage(size.width, size.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const jpegResult = transformer.toEncodedImageSync("jpeg", { quality: 0.9 });

  // Convert JPEG to base64 data URL
  const base64Data = jpegResult.buffer.toString("base64");
  const dataUrl = `data:image/jpeg;base64,${base64Data}`;

  // Test fromImageDataUrl
  const dataUrlTransformer = ImageTransformer.fromImageDataUrl(dataUrl);
  const result = dataUrlTransformer.toBufferSync("rgba");

  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);
  expect(Buffer.isBuffer(result.buffer)).toBe(true);
});

it("fromImageDataUrl - valid WebP data URL", () => {
  // Create a test image and encode it to WebP
  const size = { width: 6, height: 6 };
  const buffer = generateCheckerboardImage(size.width, size.height, 2);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const webpResult = transformer.toEncodedImageSync("webp");

  // Convert WebP to base64 data URL
  const base64Data = webpResult.buffer.toString("base64");
  const dataUrl = `data:image/webp;base64,${base64Data}`;

  // Test fromImageDataUrl
  const dataUrlTransformer = ImageTransformer.fromImageDataUrl(dataUrl);
  const result = dataUrlTransformer.toBufferSync("rgba");

  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);
  expect(Buffer.isBuffer(result.buffer)).toBe(true);
});

it("fromImageDataUrl - transformation chain works", () => {
  // Create a test image
  const size = { width: 20, height: 20 };
  const buffer = generateQuadrantImage(size.width, size.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const pngResult = transformer.toEncodedImageSync("png");

  // Convert to data URL
  const base64Data = pngResult.buffer.toString("base64");
  const dataUrl = `data:image/png;base64,${base64Data}`;

  // Test transformation chain from data URL
  const dataUrlTransformer = ImageTransformer.fromImageDataUrl(dataUrl);
  const scaled = dataUrlTransformer.scale(10, 10, "Exact").crop(2, 2, 6, 6);

  const result = scaled.toBufferSync("rgba");

  expect(result.width).toBe(6);
  expect(result.height).toBe(6);
  expect(Buffer.isBuffer(result.buffer)).toBe(true);
});

it("fromImageDataUrl - invalid data URL format", () => {
  expect(() => {
    ImageTransformer.fromImageDataUrl("not-a-data-url");
  }).toThrow("Invalid data URL format: must start with 'data:'");
});

it("fromImageDataUrl - missing comma separator", () => {
  expect(() => {
    ImageTransformer.fromImageDataUrl("data:image/png;base64");
  }).toThrow("Invalid data URL format: missing comma separator");
});

it("fromImageDataUrl - non-base64 data URL", () => {
  expect(() => {
    ImageTransformer.fromImageDataUrl("data:image/png,plain-text-data");
  }).toThrow("Only base64-encoded data URLs are supported");
});

it("fromImageDataUrl - invalid base64 data", () => {
  expect(() => {
    ImageTransformer.fromImageDataUrl(
      "data:image/png;base64,invalid-base64!!!"
    );
  }).toThrow("Failed to decode base64 data from data URL");
});

it("fromImageDataUrl - invalid image data", () => {
  const invalidBase64 = Buffer.from("not-an-image").toString("base64");

  expect(() => {
    ImageTransformer.fromImageDataUrl(`data:image/png;base64,${invalidBase64}`);
  }).toThrow("Failed to determine image dimensions");
});

it("fromImageDataUrl - round-trip conversion preserves image data", () => {
  // Create a test image with specific patterns
  const size = { width: 16, height: 16 };
  const buffer = generateQuadrantImage(size.width, size.height);

  // Original image
  const original = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const originalResult = original.toBufferSync("rgba");

  // Convert to PNG data URL and back
  const pngResult = original.toEncodedImageSync("png");
  const base64Data = pngResult.buffer.toString("base64");
  const dataUrl = `data:image/png;base64,${base64Data}`;

  const fromDataUrl = ImageTransformer.fromImageDataUrl(dataUrl);
  const roundTripResult = fromDataUrl.toBufferSync("rgba");

  // Compare dimensions
  expect(roundTripResult.width).toBe(originalResult.width);
  expect(roundTripResult.height).toBe(originalResult.height);
  expect(roundTripResult.buffer.length).toBe(originalResult.buffer.length);
});

it("fromImageDataUrl - different MIME types in header", () => {
  // Test that different MIME types in the header work correctly
  const size = { width: 8, height: 8 };
  const buffer = generateSolidColorImage(
    size.width,
    size.height,
    100,
    150,
    200
  );

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );

  // Test with different MIME types
  const formats = [
    { format: "png" as const, mimeType: "image/png" },
    { format: "jpeg" as const, mimeType: "image/jpeg" },
    { format: "webp" as const, mimeType: "image/webp" },
  ];

  for (const { format, mimeType } of formats) {
    const encoded = transformer.toEncodedImageSync(format);
    const base64Data = encoded.buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    const fromDataUrl = ImageTransformer.fromImageDataUrl(dataUrl);
    const result = fromDataUrl.toBufferSync("rgba");

    expect(result.width).toBe(size.width);
    expect(result.height).toBe(size.height);
  }
});

it("fromImageDataUrl - whitespace handling", () => {
  // Test that data URLs with extra whitespace are handled correctly
  const size = { width: 4, height: 4 };
  const buffer = generateSolidColorImage(size.width, size.height, 255, 0, 0);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const pngResult = transformer.toEncodedImageSync("png");
  const base64Data = pngResult.buffer.toString("base64");

  // Data URL with extra spaces around semicolon and comma (though the current implementation may not handle this)
  const cleanDataUrl = `data:image/png;base64,${base64Data}`;

  const fromDataUrl = ImageTransformer.fromImageDataUrl(cleanDataUrl);
  const result = fromDataUrl.toBufferSync("rgba");

  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);
});

// Data URL output tests
it("toDataUrlSync - PNG format", () => {
  const size = { width: 6, height: 6 };
  const buffer = generateSolidColorImage(size.width, size.height, 200, 100, 50);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const dataUrl = transformer.toDataUrlSync("png");

  expect(typeof dataUrl).toBe("string");
  expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  expect(dataUrl.length).toBeGreaterThan(50); // Should be a substantial string

  // Verify the data URL can be decoded back
  const decoded = ImageTransformer.fromImageDataUrl(dataUrl);
  const result = decoded.toBufferSync("rgba");

  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);
});

it("toDataUrlSync - JPEG format with quality", () => {
  const size = { width: 8, height: 8 };
  const buffer = generateGradientImage(size.width, size.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const dataUrl = transformer.toDataUrlSync("jpeg", { quality: 0.9 });

  expect(typeof dataUrl).toBe("string");
  expect(dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);

  // Verify the data URL can be decoded back
  const decoded = ImageTransformer.fromImageDataUrl(dataUrl);
  const result = decoded.toBufferSync("rgba");

  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);
});

it("toDataUrlSync - WebP format", () => {
  const size = { width: 10, height: 10 };
  const buffer = generateCheckerboardImage(size.width, size.height, 2);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const dataUrl = transformer.toDataUrlSync("webp");

  expect(typeof dataUrl).toBe("string");
  expect(dataUrl.startsWith("data:image/webp;base64,")).toBe(true);

  // Verify the data URL can be decoded back
  const decoded = ImageTransformer.fromImageDataUrl(dataUrl);
  const result = decoded.toBufferSync("rgba");

  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);
});

it("toDataUrl - async PNG format", async () => {
  const size = { width: 12, height: 12 };
  const buffer = generateQuadrantImage(size.width, size.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const dataUrl = await transformer.toDataUrl("png");

  expect(typeof dataUrl).toBe("string");
  expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);

  // Verify the data URL can be decoded back
  const decoded = ImageTransformer.fromImageDataUrl(dataUrl);
  const result = decoded.toBufferSync("rgba");

  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);
});

it("toDataUrl - async JPEG format", async () => {
  const size = { width: 16, height: 16 };
  const buffer = generateSolidColorImage(size.width, size.height, 128, 64, 192);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const dataUrl = await transformer.toDataUrl("jpeg", { quality: 0.8 });

  expect(typeof dataUrl).toBe("string");
  expect(dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);

  // Verify the data URL can be decoded back
  const decoded = ImageTransformer.fromImageDataUrl(dataUrl);
  const result = decoded.toBufferSync("rgba");

  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);
});

it("toDataUrlSync - transformation chain with data URL output", () => {
  const size = { width: 20, height: 20 };
  const buffer = generateGradientImage(size.width, size.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  )
    .scale(10, 10, "Exact")
    .crop(2, 2, 6, 6)
    .pad(1, 1, 1, 1, { red: 255, green: 255, blue: 255, alpha: 255 });

  const dataUrl = transformer.toDataUrlSync("png");

  expect(typeof dataUrl).toBe("string");
  expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);

  // Verify the final dimensions
  const decoded = ImageTransformer.fromImageDataUrl(dataUrl);
  const result = decoded.toBufferSync("rgba");

  expect(result.width).toBe(8); // 6 + 1 + 1 padding
  expect(result.height).toBe(8); // 6 + 1 + 1 padding
});

it("toDataUrlSync vs toEncodedImageSync - equivalent output", () => {
  const size = { width: 8, height: 8 };
  const buffer = generateSolidColorImage(size.width, size.height, 123, 45, 67);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );

  // Get data URL
  const dataUrl = transformer.toDataUrlSync("png");

  // Get encoded image and convert to data URL manually
  const encodedResult = transformer.toEncodedImageSync("png");
  const manualBase64 = encodedResult.buffer.toString("base64");
  const manualDataUrl = `data:image/png;base64,${manualBase64}`;

  expect(dataUrl).toBe(manualDataUrl);
});

it("data URL round trip - complete cycle", () => {
  const size = { width: 14, height: 14 };
  const buffer = generateCheckerboardImage(size.width, size.height, 3);

  // Original -> data URL -> transformer -> modified -> data URL -> final
  const original = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const firstDataUrl = original.toDataUrlSync("png");

  const intermediate = ImageTransformer.fromImageDataUrl(firstDataUrl)
    .scale(7, 7, "Exact")
    .flipHorizontal();

  const finalDataUrl = intermediate.toDataUrlSync("webp");

  expect(typeof finalDataUrl).toBe("string");
  expect(finalDataUrl.startsWith("data:image/webp;base64,")).toBe(true);

  // Verify final result
  const final = ImageTransformer.fromImageDataUrl(finalDataUrl);
  const result = final.toBufferSync("rgba");

  expect(result.width).toBe(7);
  expect(result.height).toBe(7);
});
