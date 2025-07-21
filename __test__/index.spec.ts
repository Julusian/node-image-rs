import { describe, it, expect } from "vitest";
import { ImageTransformer } from "../index.js";
import {
  generateSolidColorImage,
  generateGradientImage,
  generateCheckerboardImage,
  generateQuadrantImage,
  createTestPattern,
  assertImagesSimilar,
} from "./test-utils.js";

// Test data constants
const TEST_SIZES = {
  small: { width: 10, height: 10 },
  medium: { width: 100, height: 100 },
  large: { width: 500, height: 300 },
  rect: { width: 200, height: 100 },
} as const;

// Basic functionality tests
it("ImageTransformer.fromBuffer - valid RGBA buffer", () => {
  const { width, height } = TEST_SIZES.small;
  const buffer = generateSolidColorImage(width, height, 255, 0, 0, 255, "rgba");

  expect(() => {
    const transformer = ImageTransformer.fromBuffer(
      buffer,
      width,
      height,
      "rgba"
    );
    const result = transformer.toBufferSync("rgba");
    expect(result.width).toBe(width);
    expect(result.height).toBe(height);
  }).not.toThrow();
});

it("ImageTransformer.fromBuffer - valid RGB buffer", () => {
  const { width, height } = TEST_SIZES.small;
  const buffer = generateSolidColorImage(width, height, 255, 0, 0, 255, "rgb");

  expect(() => {
    const transformer = ImageTransformer.fromBuffer(
      buffer,
      width,
      height,
      "rgb"
    );
    const result = transformer.toBufferSync("rgb");
    expect(result.width).toBe(width);
    expect(result.height).toBe(height);
  }).not.toThrow();
});

it("ImageTransformer.fromBuffer - invalid buffer size", () => {
  const { width, height } = TEST_SIZES.small;
  // Create buffer that's too small (missing pixels)
  const buffer = Buffer.alloc(width * height * 3); // RGB size for RGBA format

  expect(() => {
    ImageTransformer.fromBuffer(buffer, width, height, "rgba").toBufferSync(
      "rgba"
    );
  }).toThrow();
});

// Scaling tests
it("scale - upscale exact", () => {
  const original = TEST_SIZES.small;
  const target = { width: 20, height: 20 };
  const buffer = generateSolidColorImage(
    original.width,
    original.height,
    255,
    0,
    0
  );

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    original.width,
    original.height,
    "rgba"
  );
  const result = transformer
    .scale(target.width, target.height, "Exact")
    .toBufferSync("rgba");

  expect(result.width).toBe(target.width);
  expect(result.height).toBe(target.height);

  // Check that the color is preserved (should still be red)
  const expected = generateSolidColorImage(
    target.width,
    target.height,
    255,
    0,
    0
  );
  assertImagesSimilar(
    result.buffer,
    expected,
    target.width,
    target.height,
    "rgba",
    5
  );
});

it("scale - downscale exact", () => {
  const original = TEST_SIZES.medium;
  const target = TEST_SIZES.small;
  const buffer = generateSolidColorImage(
    original.width,
    original.height,
    0,
    255,
    0
  );

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    original.width,
    original.height,
    "rgba"
  );
  const result = transformer
    .scale(target.width, target.height, "Exact")
    .toBufferSync("rgba");

  expect(result.width).toBe(target.width);
  expect(result.height).toBe(target.height);

  // Check that the color is preserved (should still be green)
  const expected = generateSolidColorImage(
    target.width,
    target.height,
    0,
    255,
    0
  );
  assertImagesSimilar(
    result.buffer,
    expected,
    target.width,
    target.height,
    "rgba",
    5
  );
});

it("scale - aspect ratio modes", () => {
  const original = { width: 100, height: 50 }; // 2:1 ratio
  const target = { width: 60, height: 60 }; // 1:1 ratio
  const buffer = generateQuadrantImage(original.width, original.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    original.width,
    original.height,
    "rgba"
  );

  // Test different resize modes
  const exactResult = transformer
    .scale(target.width, target.height, "Exact")
    .toBufferSync("rgba");
  expect(exactResult.width).toBe(target.width);
  expect(exactResult.height).toBe(target.height);

  // Reset transformer for next test
  const transformer2 = ImageTransformer.fromBuffer(
    buffer,
    original.width,
    original.height,
    "rgba"
  );
  const fitResult = transformer2
    .scale(target.width, target.height, "Fit")
    .toBufferSync("rgba");

  // Fit mode should maintain aspect ratio and fit within bounds
  // Original is 100x50 (2:1), target is 60x60
  // To fit within 60x60 while maintaining 2:1 ratio: 60x30
  expect(fitResult.width).toBe(60);
  expect(fitResult.height).toBe(30);
});

// Cropping tests
it("crop - center region", () => {
  const original = TEST_SIZES.medium;
  const cropSize = { width: 50, height: 50 };
  const buffer = generateQuadrantImage(original.width, original.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    original.width,
    original.height,
    "rgba"
  );
  const result = transformer
    .crop(25, 25, cropSize.width, cropSize.height)
    .toBufferSync("rgba");

  expect(result.width).toBe(cropSize.width);
  expect(result.height).toBe(cropSize.height);
});

it("cropCenter - center crop", () => {
  const original = TEST_SIZES.medium;
  const cropSize = { width: 50, height: 50 };
  const buffer = generateSolidColorImage(
    original.width,
    original.height,
    128,
    128,
    128
  );

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    original.width,
    original.height,
    "rgba"
  );
  const result = transformer
    .cropCenter(cropSize.width, cropSize.height)
    .toBufferSync("rgba");

  expect(result.width).toBe(cropSize.width);
  expect(result.height).toBe(cropSize.height);

  // Should still be the same color
  const expected = generateSolidColorImage(
    cropSize.width,
    cropSize.height,
    128,
    128,
    128
  );
  assertImagesSimilar(
    result.buffer,
    expected,
    cropSize.width,
    cropSize.height,
    "rgba",
    2
  );
});

// Flip tests
it("flipHorizontal - horizontal flip", () => {
  const size = TEST_SIZES.small;
  const buffer = generateGradientImage(size.width, size.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = transformer.flipHorizontal().toBufferSync("rgba");

  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);

  // Check that the first pixel (should now be blue from the gradient)
  // and last pixel (should now be red) are swapped
  const resultData = new Uint8Array(result.buffer);
  const originalData = new Uint8Array(buffer);

  // First pixel of result should match last pixel of original (horizontally)
  expect(resultData[0]).toBe(originalData[(size.width - 1) * 4]); // Red component
});

it("flipVertical - vertical flip", () => {
  const size = TEST_SIZES.small;
  const buffer = createTestPattern(size.width, size.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = transformer.flipVertical().toBufferSync("rgba");

  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);

  // Verify the flip by checking that top row matches original bottom row
  const resultData = new Uint8Array(result.buffer);
  const originalData = new Uint8Array(buffer);

  // First row of result should match last row of original
  const firstRowResult = resultData.slice(0, size.width * 4);
  const lastRowOriginal = originalData.slice(
    (size.height - 1) * size.width * 4,
    size.height * size.width * 4
  );

  expect(Array.from(firstRowResult)).toStrictEqual(Array.from(lastRowOriginal));
});

// Rotation tests
it("rotate - 90 degrees clockwise", () => {
  const size = { width: 10, height: 20 }; // Rectangular to test rotation
  const buffer = generateQuadrantImage(size.width, size.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = transformer.rotate("CW90").toBufferSync("rgba");

  // After 90° rotation, width and height should swap
  expect(result.width).toBe(size.height);
  expect(result.height).toBe(size.width);
});

it("rotate - 180 degrees", () => {
  const size = TEST_SIZES.small;
  const buffer = generateGradientImage(size.width, size.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = transformer.rotate("CW180").toBufferSync("rgba");

  // Dimensions should remain the same
  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);
});

it("rotate - 270 degrees clockwise", () => {
  const size = { width: 15, height: 10 };
  const buffer = createTestPattern(size.width, size.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = transformer.rotate("CW270").toBufferSync("rgba");

  // After 270° rotation, width and height should swap
  expect(result.width).toBe(size.height);
  expect(result.height).toBe(size.width);
});

// Padding tests
it("pad - add padding around image", () => {
  const original = TEST_SIZES.small;
  const padding = { left: 5, right: 10, top: 3, bottom: 7 };
  const paddingColor = { red: 255, green: 255, blue: 0, alpha: 255 }; // Yellow
  const buffer = generateSolidColorImage(
    original.width,
    original.height,
    255,
    0,
    0
  ); // Red

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    original.width,
    original.height,
    "rgba"
  );
  const result = transformer
    .pad(padding.left, padding.right, padding.top, padding.bottom, paddingColor)
    .toBufferSync("rgba");

  const expectedWidth = original.width + padding.left + padding.right;
  const expectedHeight = original.height + padding.top + padding.bottom;

  expect(result.width).toBe(expectedWidth);
  expect(result.height).toBe(expectedHeight);
});

// Chain multiple operations
it("complex transformation chain", () => {
  const original = TEST_SIZES.medium;
  const buffer = generateCheckerboardImage(original.width, original.height, 10);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    original.width,
    original.height,
    "rgba"
  );
  const result = transformer
    .scale(50, 50, "Exact")
    .flipHorizontal()
    .rotate("CW90")
    .cropCenter(30, 30)
    .toBufferSync("rgba");

  expect(result.width).toBe(30);
  expect(result.height).toBe(30);
});

// Format conversion tests
it("format conversion - RGBA to RGB", () => {
  const size = TEST_SIZES.small;
  const buffer = generateSolidColorImage(
    size.width,
    size.height,
    255,
    128,
    64,
    255,
    "rgba"
  );

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = transformer.toBufferSync("rgb");

  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);
  expect(result.buffer.length).toBe(size.width * size.height * 3); // RGB format

  // Check color preservation (first pixel)
  const resultData = new Uint8Array(result.buffer);
  expect(resultData[0]).toBe(255); // Red
  expect(resultData[1]).toBe(128); // Green
  expect(resultData[2]).toBe(64); // Blue
});

it("format conversion - RGB to RGBA", () => {
  const size = TEST_SIZES.small;
  const buffer = generateSolidColorImage(
    size.width,
    size.height,
    255,
    128,
    64,
    255,
    "rgb"
  );

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgb"
  );
  const result = transformer.toBufferSync("rgba");

  expect(result.width).toBe(size.width);
  expect(result.height).toBe(size.height);
  expect(result.buffer.length).toBe(size.width * size.height * 4); // RGBA format

  // Check color preservation and alpha (first pixel)
  const resultData = new Uint8Array(result.buffer);
  expect(resultData[0]).toBe(255); // Red
  expect(resultData[1]).toBe(128); // Green
  expect(resultData[2]).toBe(64); // Blue
  expect(resultData[3]).toBe(255); // Alpha should be 255
});

// Async operations tests
it("toBuffer - async version", async () => {
  const size = TEST_SIZES.small;
  const buffer = generateSolidColorImage(size.width, size.height, 100, 200, 50);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = await transformer.scale(20, 20).toBuffer("rgba");

  expect(result.width).toBe(20);
  expect(result.height).toBe(20);
  expect(Buffer.isBuffer(result.buffer)).toBe(true);
});

// getCurrentDimensions tests
it("getCurrentDimensions - track size changes", () => {
  const original = TEST_SIZES.rect;
  const buffer = generateSolidColorImage(
    original.width,
    original.height,
    255,
    255,
    255
  );

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    original.width,
    original.height,
    "rgba"
  );

  // Check initial dimensions
  let dims = transformer.getCurrentDimensions();
  expect(dims.width).toBe(original.width);
  expect(dims.height).toBe(original.height);

  // After scaling
  transformer.scale(100, 50);
  dims = transformer.getCurrentDimensions();
  expect(dims.width).toBe(100);
  expect(dims.height).toBe(50);

  // After cropping
  transformer.crop(10, 10, 30, 20);
  dims = transformer.getCurrentDimensions();
  expect(dims.width).toBe(30);
  expect(dims.height).toBe(20);
});

// Edge cases and error handling
it("edge case - zero dimensions", () => {
  const buffer = generateSolidColorImage(10, 10, 255, 255, 255);
  const transformer = ImageTransformer.fromBuffer(buffer, 10, 10, "rgba");

  expect(() => {
    transformer.scale(0, 10).toBufferSync("rgba");
  }).toThrow();

  expect(() => {
    transformer.scale(10, 0).toBufferSync("rgba");
  }).toThrow();
});

it("edge case - crop out of bounds", () => {
  const size = TEST_SIZES.small;
  const buffer = generateSolidColorImage(
    size.width,
    size.height,
    255,
    255,
    255
  );
  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );

  expect(() => {
    transformer.crop(15, 15, 5, 5).toBufferSync("rgba"); // Crop beyond image bounds
  }).toThrow();
});

// Test padding color verification
it("pad - padding color correctness", () => {
  const original = { width: 5, height: 5 };
  const padding = { left: 2, right: 3, top: 1, bottom: 2 };
  const paddingColor = { red: 128, green: 64, blue: 192, alpha: 255 };
  const buffer = generateSolidColorImage(
    original.width,
    original.height,
    255,
    255,
    255
  ); // White center

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    original.width,
    original.height,
    "rgba"
  );
  const result = transformer
    .pad(padding.left, padding.right, padding.top, padding.bottom, paddingColor)
    .toBufferSync("rgba");

  const expectedWidth = original.width + padding.left + padding.right;
  const expectedHeight = original.height + padding.top + padding.bottom;

  expect(result.width).toBe(expectedWidth);
  expect(result.height).toBe(expectedHeight);

  const resultData = new Uint8Array(result.buffer);

  // Check top-left corner (should be padding color)
  expect(resultData[0]).toBe(paddingColor.red);
  expect(resultData[1]).toBe(paddingColor.green);
  expect(resultData[2]).toBe(paddingColor.blue);
  expect(resultData[3]).toBe(paddingColor.alpha);

  // Check center pixel (should be original white)
  const centerX = padding.left + Math.floor(original.width / 2);
  const centerY = padding.top + Math.floor(original.height / 2);
  const centerOffset = (centerY * expectedWidth + centerX) * 4;
  expect(resultData[centerOffset]).toBe(255); // White
  expect(resultData[centerOffset + 1]).toBe(255);
  expect(resultData[centerOffset + 2]).toBe(255);
  expect(resultData[centerOffset + 3]).toBe(255);
});

// Test rotation correctness with asymmetric pattern
it("rotate - rotation correctness verification", () => {
  const size = { width: 4, height: 3 };
  // Create a simple pattern: top row red, bottom rows blue
  const buffer = new Uint8Array(size.width * size.height * 4);
  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      const offset = (y * size.width + x) * 4;
      if (y === 0) {
        // Top row: red
        buffer[offset] = 255;
        buffer[offset + 1] = 0;
        buffer[offset + 2] = 0;
        buffer[offset + 3] = 255;
      } else {
        // Other rows: blue
        buffer[offset] = 0;
        buffer[offset + 1] = 0;
        buffer[offset + 2] = 255;
        buffer[offset + 3] = 255;
      }
    }
  }

  const transformer = ImageTransformer.fromBuffer(
    Buffer.from(buffer),
    size.width,
    size.height,
    "rgba"
  );
  const result = transformer.rotate("CW90").toBufferSync("rgba");

  // After 90° CW rotation: width=3, height=4
  // The original top row (red) becomes the rightmost column
  expect(result.width).toBe(size.height);
  expect(result.height).toBe(size.width);

  const resultData = new Uint8Array(result.buffer);
  // Check rightmost column (should be red, was top row)
  for (let y = 0; y < result.height; y++) {
    const offset = (y * result.width + (result.width - 1)) * 4;
    expect(resultData[offset]).toBe(255); // Red
    expect(resultData[offset + 1]).toBe(0);
    expect(resultData[offset + 2]).toBe(0);
  }
});

// Test format consistency - round trip conversions
it("format consistency - RGBA->RGB->RGBA round trip", () => {
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

  expect(rgbaResult.width).toBe(size.width);
  expect(rgbaResult.height).toBe(size.height);

  // Check that RGB values are preserved (alpha will be 255)
  const resultData = new Uint8Array(rgbaResult.buffer);
  expect(resultData[0]).toBe(200); // Red
  expect(resultData[1]).toBe(100); // Green
  expect(resultData[2]).toBe(50); // Blue
  expect(resultData[3]).toBe(255); // Alpha should be 255
});

// Test specific resize mode behaviors
it("resize modes - Fill vs Fit vs Exact behavior verification", () => {
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
  expect(exactResult.width).toBe(target.width);
  expect(exactResult.height).toBe(target.height);

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
  expect(fitResult.width).toBe(40);
  expect(fitResult.height).toBe(20);

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
  expect(fillResult.width).toBe(target.width);
  expect(fillResult.height).toBe(target.height);
});

// Test crop boundary conditions
it("crop - boundary validation", () => {
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
  expect(result1.width).toBe(size.width);
  expect(result1.height).toBe(size.height);

  const transformer2 = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result2 = transformer2.crop(5, 5, 5, 5).toBufferSync("rgba");
  expect(result2.width).toBe(5);
  expect(result2.height).toBe(5);

  // Edge case: 1x1 crop
  const transformer3 = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result3 = transformer3.crop(9, 9, 1, 1).toBufferSync("rgba");
  expect(result3.width).toBe(1);
  expect(result3.height).toBe(1);
});

// Test chaining operation correctness
it("operation chain - order dependency", () => {
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
  expect(result1.width).toBe(3); // After scale(4,3) then rotate90: 3x4
  expect(result1.height).toBe(4);

  // Chain 2: Rotate then scale
  const transformer2 = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result2 = transformer2.rotate("CW90").scale(4, 3).toBufferSync("rgba");
  expect(result2.width).toBe(4); // After rotate90(6x8) then scale: 4x3
  expect(result2.height).toBe(3);

  // Results should have different dimensions due to order
  expect(result1.width).not.toBe(result2.width);
  expect(result1.height).not.toBe(result2.height);
});

// Test format handling edge cases
it("format edge cases - buffer size validation", () => {
  const size = { width: 4, height: 4 };

  // Correct RGBA buffer size
  const rgbaBuffer = Buffer.alloc(size.width * size.height * 4);
  expect(() => {
    ImageTransformer.fromBuffer(rgbaBuffer, size.width, size.height, "rgba");
  }).not.toThrow();

  // Correct RGB buffer size
  const rgbBuffer = Buffer.alloc(size.width * size.height * 3);
  expect(() => {
    ImageTransformer.fromBuffer(rgbBuffer, size.width, size.height, "rgb");
  }).not.toThrow();

  // Wrong buffer size for RGBA
  const wrongRgbaBuffer = Buffer.alloc(size.width * size.height * 3);
  expect(() => {
    ImageTransformer.fromBuffer(
      wrongRgbaBuffer,
      size.width,
      size.height,
      "rgba"
    ).toBufferSync("rgba");
  }).toThrow();

  // Wrong buffer size for RGB
  const wrongRgbBuffer = Buffer.alloc(size.width * size.height * 2);
  expect(() => {
    ImageTransformer.fromBuffer(
      wrongRgbBuffer,
      size.width,
      size.height,
      "rgb"
    ).toBufferSync("rgb");
  }).toThrow();
});

// Overlay operation tests
describe("Overlay operations", () => {
  it("should overlay with basic alpha blending", () => {
    const size = { width: 50, height: 50 };

    // Create base image (solid red)
    const baseBuffer = generateSolidColorImage(
      size.width,
      size.height,
      255,
      0,
      0,
      255,
      "rgba"
    );
    const baseTransformer = ImageTransformer.fromBuffer(
      baseBuffer,
      size.width,
      size.height,
      "rgba"
    );

    // Create overlay image (semi-transparent blue)
    const overlayBuffer = generateSolidColorImage(
      size.width,
      size.height,
      0,
      0,
      255,
      128,
      "rgba"
    );
    const overlayTransformer = ImageTransformer.fromBuffer(
      overlayBuffer,
      size.width,
      size.height,
      "rgba"
    );

    // Overlay overlay onto base at origin
    const result = baseTransformer
      .overlay(overlayTransformer, 0, 0)
      .toBufferSync("rgba");

    expect(result.width).toBe(size.width);
    expect(result.height).toBe(size.height);

    const pixels = result.buffer;
    // Should be a blend of red and blue with 50% alpha
    expect(pixels[0]).toBeGreaterThan(100); // Should have some red
    expect(pixels[2]).toBeGreaterThan(100); // Should have some blue
    expect(pixels[1]).toBe(0); // Green should remain 0
  });

  it("should overlay at different positions", () => {
    const size = { width: 100, height: 100 };

    // Create base image (solid green)
    const baseBuffer = generateSolidColorImage(
      size.width,
      size.height,
      0,
      255,
      0,
      255,
      "rgba"
    );
    const baseTransformer = ImageTransformer.fromBuffer(
      baseBuffer,
      size.width,
      size.height,
      "rgba"
    );

    // Create smaller overlay image (solid red, 20x20)
    const overlaySize = { width: 20, height: 20 };
    const overlayBuffer = generateSolidColorImage(
      overlaySize.width,
      overlaySize.height,
      255,
      0,
      0,
      255,
      "rgba"
    );
    const overlayTransformer = ImageTransformer.fromBuffer(
      overlayBuffer,
      overlaySize.width,
      overlaySize.height,
      "rgba"
    );

    // Overlay at position (40, 40) - center area
    const result = baseTransformer
      .overlay(overlayTransformer, 40, 40)
      .toBufferSync("rgba");

    const pixels = result.buffer;

    // Check that top-left corner is still green (base image)
    expect(pixels[0]).toBe(0); // Red
    expect(pixels[1]).toBe(255); // Green
    expect(pixels[2]).toBe(0); // Blue

    // Check center area where overlay should be (red)
    const centerOffset = (50 * size.width + 50) * 4;
    expect(pixels[centerOffset]).toBe(255); // Red
    expect(pixels[centerOffset + 1]).toBe(0); // Green
    expect(pixels[centerOffset + 2]).toBe(0); // Blue
  });

  it("should handle multiple overlay layers", () => {
    const size = { width: 80, height: 80 };

    // Create base image (solid black)
    const baseBuffer = generateSolidColorImage(
      size.width,
      size.height,
      0,
      0,
      0,
      255,
      "rgba"
    );
    const baseTransformer = ImageTransformer.fromBuffer(
      baseBuffer,
      size.width,
      size.height,
      "rgba"
    );

    // Create first overlay (red with 50% alpha, 40x40)
    const overlay1Buffer = generateSolidColorImage(
      40,
      40,
      255,
      0,
      0,
      128,
      "rgba"
    );
    const overlay1Transformer = ImageTransformer.fromBuffer(
      overlay1Buffer,
      40,
      40,
      "rgba"
    );

    // Create second overlay (green with 50% alpha, 40x40)
    const overlay2Buffer = generateSolidColorImage(
      40,
      40,
      0,
      255,
      0,
      128,
      "rgba"
    );
    const overlay2Transformer = ImageTransformer.fromBuffer(
      overlay2Buffer,
      40,
      40,
      "rgba"
    );

    // Create third overlay (blue with 50% alpha, 40x40)
    const overlay3Buffer = generateSolidColorImage(
      40,
      40,
      0,
      0,
      255,
      128,
      "rgba"
    );
    const overlay3Transformer = ImageTransformer.fromBuffer(
      overlay3Buffer,
      40,
      40,
      "rgba"
    );

    // Apply multiple overlays at different positions
    const result = baseTransformer
      .overlay(overlay1Transformer, 0, 0) // Top-left
      .overlay(overlay2Transformer, 20, 20) // Center-left overlap
      .overlay(overlay3Transformer, 40, 40) // Bottom-right
      .toBufferSync("rgba");

    expect(result.width).toBe(size.width);
    expect(result.height).toBe(size.height);

    const pixels = result.buffer;

    // Check top-left corner (should be red from first overlay)
    expect(pixels[0]).toBeGreaterThan(100); // Red
    expect(pixels[1]).toBeLessThan(50); // Green
    expect(pixels[2]).toBeLessThan(50); // Blue

    // Check overlap area (30,30) - should have red and green mixed
    const overlapOffset = (30 * size.width + 30) * 4;
    expect(pixels[overlapOffset]).toBeGreaterThan(50); // Some red
    expect(pixels[overlapOffset + 1]).toBeGreaterThan(50); // Some green

    // Check bottom-right area (60,60) - should be blue from third overlay
    const bottomRightOffset = (60 * size.width + 60) * 4;
    expect(pixels[bottomRightOffset + 2]).toBeGreaterThan(100); // Blue
  });

  it("should handle partial overlay positioning", () => {
    const size = { width: 50, height: 50 };

    // Create base image (solid white)
    const baseBuffer = generateSolidColorImage(
      size.width,
      size.height,
      255,
      255,
      255,
      255,
      "rgba"
    );
    const baseTransformer = ImageTransformer.fromBuffer(
      baseBuffer,
      size.width,
      size.height,
      "rgba"
    );

    // Create overlay (solid red, 30x30)
    const overlayBuffer = generateSolidColorImage(
      30,
      30,
      255,
      0,
      0,
      255,
      "rgba"
    );
    const overlayTransformer = ImageTransformer.fromBuffer(
      overlayBuffer,
      30,
      30,
      "rgba"
    );

    // Position overlay so it extends beyond the base image bounds
    const result = baseTransformer
      .overlay(overlayTransformer, 35, 35)
      .toBufferSync("rgba");

    const pixels = result.buffer;

    // Check that the visible part of the overlay is overlaid
    const visibleOverlayOffset = (40 * size.width + 40) * 4;
    expect(pixels[visibleOverlayOffset]).toBe(255); // Red
    expect(pixels[visibleOverlayOffset + 1]).toBe(0); // Green
    expect(pixels[visibleOverlayOffset + 2]).toBe(0); // Blue

    // Check that areas outside overlay remain white
    const outsideOffset = (10 * size.width + 10) * 4;
    expect(pixels[outsideOffset]).toBe(255); // Red
    expect(pixels[outsideOffset + 1]).toBe(255); // Green
    expect(pixels[outsideOffset + 2]).toBe(255); // Blue
  });

  it("should reject overlays completely outside bounds", () => {
    const size = { width: 50, height: 50 };

    const baseBuffer = generateSolidColorImage(
      size.width,
      size.height,
      255,
      255,
      255,
      255,
      "rgba"
    );
    const baseTransformer = ImageTransformer.fromBuffer(
      baseBuffer,
      size.width,
      size.height,
      "rgba"
    );

    const overlayBuffer = generateSolidColorImage(
      20,
      20,
      255,
      0,
      0,
      255,
      "rgba"
    );
    const overlayTransformer = ImageTransformer.fromBuffer(
      overlayBuffer,
      20,
      20,
      "rgba"
    );

    // Position overlay completely outside bounds
    expect(() => {
      baseTransformer.overlay(overlayTransformer, 100, 100);
    }).toThrow();

    expect(() => {
      baseTransformer.overlay(overlayTransformer, -50, -50);
    }).toThrow();
  });

  it("should work with transformed overlays", () => {
    const size = { width: 60, height: 60 };

    // Create base image (solid blue)
    const baseBuffer = generateSolidColorImage(
      size.width,
      size.height,
      0,
      0,
      255,
      255,
      "rgba"
    );
    const baseTransformer = ImageTransformer.fromBuffer(
      baseBuffer,
      size.width,
      size.height,
      "rgba"
    );

    // Create overlay and apply transformations
    const overlayBuffer = generateSolidColorImage(
      size.width,
      size.height,
      255,
      0,
      0,
      255,
      "rgba"
    );
    const overlayTransformer = ImageTransformer.fromBuffer(
      overlayBuffer,
      size.width,
      size.height,
      "rgba"
    )
      .scale(30, 30, "Exact") // Scale down
      .rotate("CW90"); // Rotate

    // Overlay transformed overlay
    const result = baseTransformer
      .overlay(overlayTransformer, 15, 15)
      .toBufferSync("rgba");

    expect(result.width).toBe(size.width);
    expect(result.height).toBe(size.height);

    const pixels = result.buffer;

    // Check that the transformed overlay is overlaid
    const centerOffset = (30 * size.width + 30) * 4;
    expect(pixels[centerOffset]).toBe(255); // Red from overlay
    expect(pixels[centerOffset + 2]).toBe(0); // Blue should be replaced
  });
});
