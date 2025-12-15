import { it, expect } from "vitest";
import { ImageTransformer } from "../index.js";
import { generateSolidColorImage } from "./test-utils.js";

// Test padding and byte order for BGR output when source is RGBA
it("pad + format conversion - RGBA input -> BGR output preserves padding color in BGR order", () => {
  const width = 4;
  const height = 3;
  // Red center image (RGBA)
  const src = generateSolidColorImage(width, height, 255, 0, 0, 255, "rgba");

  // Padding amounts
  const left = 2;
  const right = 1;
  const top = 1;
  const bottom = 2;

  // Padding color (R,G,B,A)
  const padColor = { red: 10, green: 20, blue: 30, alpha: 255 };

  const transformer = ImageTransformer.fromBuffer(src, width, height, "rgba");
  const result = transformer
    .pad(left, right, top, bottom, padColor)
    .toBufferSync("bgr");

  const expectedWidth = width + left + right;
  const expectedHeight = height + top + bottom;

  expect(result.width).toBe(expectedWidth);
  expect(result.height).toBe(expectedHeight);

  // BGR has 3 channels per pixel
  const data = new Uint8Array(result.buffer);

  // Top-left pixel should be padding color, but in BGR order
  expect(data[0]).toBe(padColor.blue); // Blue
  expect(data[1]).toBe(padColor.green); // Green
  expect(data[2]).toBe(padColor.red); // Red

  // Check a center pixel that comes from the original red RGBA image
  const centerX = left + Math.floor(width / 2);
  const centerY = top + Math.floor(height / 2);
  const centerOffset = (centerY * expectedWidth + centerX) * 3; // 3 channels

  // Original was pure red (255,0,0). In BGR that becomes (0,0,255)
  expect(data[centerOffset]).toBe(0); // Blue
  expect(data[centerOffset + 1]).toBe(0); // Green
  expect(data[centerOffset + 2]).toBe(255); // Red
});

// Test padding and byte order for BGRA output when source is RGB
it("pad + format conversion - RGB input -> BGRA output preserves padding color and alpha", () => {
  const width = 3;
  const height = 3;
  // Green center image (RGB)
  const src = generateSolidColorImage(width, height, 0, 255, 0, 255, "rgb");

  const left = 1;
  const right = 2;
  const top = 2;
  const bottom = 1;

  // Use a padding color with non-default alpha to ensure alpha is written
  const padColor = { red: 7, green: 14, blue: 21, alpha: 128 };

  const transformer = ImageTransformer.fromBuffer(src, width, height, "rgb");
  const result = transformer
    .pad(left, right, top, bottom, padColor)
    .toBufferSync("bgra");

  const expectedWidth = width + left + right;
  const expectedHeight = height + top + bottom;

  expect(result.width).toBe(expectedWidth);
  expect(result.height).toBe(expectedHeight);

  // BGRA has 4 channels per pixel
  const data = new Uint8Array(result.buffer);

  // Top-left pixel should be padding color in BGRA order
  expect(data[0]).toBe(padColor.blue); // Blue
  expect(data[1]).toBe(padColor.green); // Green
  expect(data[2]).toBe(padColor.red); // Red
  expect(data[3]).toBe(padColor.alpha); // Alpha

  // Check a center pixel from original green RGB image
  const centerX = left + Math.floor(width / 2);
  const centerY = top + Math.floor(height / 2);
  const centerOffset = (centerY * expectedWidth + centerX) * 4; // 4 channels

  // Original was pure green (0,255,0). In BGRA that becomes (0,255,0,255)
  expect(data[centerOffset]).toBe(0); // Blue
  expect(data[centerOffset + 1]).toBe(255); // Green
  expect(data[centerOffset + 2]).toBe(0); // Red
  expect(data[centerOffset + 3]).toBe(255); // Alpha (should be 255 for converted RGB)
});

  // fromBuffer tests for BGR and BGRA input
  it("fromBuffer - accepts BGR input and converts to RGBA correctly", () => {
    const width = 2;
    const height = 2;

    // Define pixels in RGB for clarity, we'll store them in BGR order
    // TL: Red (255,0,0), TR: Green (0,255,0), BL: Blue (0,0,255), BR: White (255,255,255)
    const rgbPixels = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 255],
    ];

    // Create BGR buffer (3 channels)
    const bgr = new Uint8Array(width * height * 3);
    for (let i = 0; i < rgbPixels.length; i++) {
      const [r, g, b] = rgbPixels[i];
      const off = i * 3;
      bgr[off] = b; // Blue
      bgr[off + 1] = g; // Green
      bgr[off + 2] = r; // Red
    }

    const transformer = ImageTransformer.fromBuffer(bgr, width, height, "bgr");
    const out = transformer.toBufferSync("rgba");
    expect(out.width).toBe(width);
    expect(out.height).toBe(height);

    const data = new Uint8Array(out.buffer);
    // Verify each pixel was converted back to RGBA (alpha should be 255)
    for (let i = 0; i < rgbPixels.length; i++) {
      const [r, g, b] = rgbPixels[i];
      const off = i * 4;
      expect(data[off]).toBe(r);
      expect(data[off + 1]).toBe(g);
      expect(data[off + 2]).toBe(b);
      expect(data[off + 3]).toBe(255);
    }
  });

  it("fromBuffer - accepts BGRA input and converts to RGBA correctly (preserves alpha)", () => {
    const width = 2;
    const height = 2;

    // Pixels as RGBA tuples for clarity
    const rgbaPixels = [
      [10, 20, 30, 128],
      [40, 50, 60, 200],
      [70, 80, 90, 0],
      [255, 255, 255, 255],
    ];

    // Create BGRA buffer (4 channels in BGRA order)
    const bgra = new Uint8Array(width * height * 4);
    for (let i = 0; i < rgbaPixels.length; i++) {
      const [r, g, b, a] = rgbaPixels[i];
      const off = i * 4;
      bgra[off] = b; // Blue
      bgra[off + 1] = g; // Green
      bgra[off + 2] = r; // Red
      bgra[off + 3] = a; // Alpha
    }

    const transformer = ImageTransformer.fromBuffer(bgra, width, height, "bgra");
    const out = transformer.toBufferSync("rgba");
    expect(out.width).toBe(width);
    expect(out.height).toBe(height);

    const data = new Uint8Array(out.buffer);
    // Verify conversion to RGBA preserved values
    for (let i = 0; i < rgbaPixels.length; i++) {
      const [r, g, b, a] = rgbaPixels[i];
      const off = i * 4;
      expect(data[off]).toBe(r);
      expect(data[off + 1]).toBe(g);
      expect(data[off + 2]).toBe(b);
      expect(data[off + 3]).toBe(a);
    }
  });

  // fromBuffer + pad: BGR input -> pad -> BGR output
  it("fromBuffer + pad - BGR input retains padding color when output as BGR", () => {
    const width = 2;
    const height = 1;

    // Single row: two pixels (red, green) stored as BGR
    const bgr = new Uint8Array([0, 0, 255, 0, 255, 0]);

    const padColor = { red: 11, green: 22, blue: 33, alpha: 255 };
    const left = 1;
    const right = 1;
    const top = 1;
    const bottom = 1;

    const transformer = ImageTransformer.fromBuffer(bgr, width, height, "bgr");
    const result = transformer.pad(left, right, top, bottom, padColor).toBufferSync("bgr");

    const expectedWidth = width + left + right;
    const expectedHeight = height + top + bottom;

    expect(result.width).toBe(expectedWidth);
    expect(result.height).toBe(expectedHeight);

    const data = new Uint8Array(result.buffer);
    // Top-left padding pixel should be padColor in BGR order
    expect(data[0]).toBe(padColor.blue);
    expect(data[1]).toBe(padColor.green);
    expect(data[2]).toBe(padColor.red);
  });

  // fromBuffer + pad: BGRA input -> pad -> BGRA output (check alpha preserved)
  it("fromBuffer + pad - BGRA input retains padding color and alpha when output as BGRA", () => {
    const width = 1;
    const height = 1;

    // Single pixel white with alpha 255 in BGRA order
    const bgra = new Uint8Array([255, 255, 255, 255]);

    const padColor = { red: 2, green: 4, blue: 6, alpha: 128 };
    const left = 1;
    const right = 0;
    const top = 0;
    const bottom = 1;

    const transformer = ImageTransformer.fromBuffer(bgra, width, height, "bgra");
    const result = transformer.pad(left, right, top, bottom, padColor).toBufferSync("bgra");

    const expectedWidth = width + left + right;
    const expectedHeight = height + top + bottom;

    expect(result.width).toBe(expectedWidth);
    expect(result.height).toBe(expectedHeight);

    const data = new Uint8Array(result.buffer);
    // Top-left pixel is padding color in BGRA order
    expect(data[0]).toBe(padColor.blue);
    expect(data[1]).toBe(padColor.green);
    expect(data[2]).toBe(padColor.red);
    expect(data[3]).toBe(padColor.alpha);
  });
