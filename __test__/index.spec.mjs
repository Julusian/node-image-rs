import test from "ava";
import { ImageTransformer } from "../index.js";
import {
  generateSolidColorImage,
  generateGradientImage,
  generateCheckerboardImage,
  generateQuadrantImage,
  createTestPattern,
  assertImagesSimilar,
  calculatePixelDifference,
} from "./test-utils.mjs";

// Test data constants
const TEST_SIZES = {
  small: { width: 10, height: 10 },
  medium: { width: 100, height: 100 },
  large: { width: 500, height: 300 },
  rect: { width: 200, height: 100 },
};

// Basic functionality tests
test("ImageTransformer.fromBuffer - valid RGBA buffer", (t) => {
  const { width, height } = TEST_SIZES.small;
  const buffer = generateSolidColorImage(width, height, 255, 0, 0, 255, "rgba");

  t.notThrows(() => {
    const transformer = ImageTransformer.fromBuffer(
      buffer,
      width,
      height,
      "rgba"
    );
    const result = transformer.toBufferSync("rgba");
    t.is(result.width, width);
    t.is(result.height, height);
  });
});

test("ImageTransformer.fromBuffer - valid RGB buffer", (t) => {
  const { width, height } = TEST_SIZES.small;
  const buffer = generateSolidColorImage(width, height, 255, 0, 0, 255, "rgb");

  t.notThrows(() => {
    const transformer = ImageTransformer.fromBuffer(
      buffer,
      width,
      height,
      "rgb"
    );
    const result = transformer.toBufferSync("rgb");
    t.is(result.width, width);
    t.is(result.height, height);
  });
});

test("ImageTransformer.fromBuffer - invalid buffer size", (t) => {
  const { width, height } = TEST_SIZES.small;
  // Create buffer that's too small (missing pixels)
  const buffer = Buffer.alloc(width * height * 3); // RGB size for RGBA format

  t.throws(() => {
    ImageTransformer.fromBuffer(buffer, width, height, "rgba").toBufferSync(
      "rgba"
    );
  });
});

// Scaling tests
test("scale - upscale exact", (t) => {
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

  t.is(result.width, target.width);
  t.is(result.height, target.height);

  // Check that the color is preserved (should still be red)
  const expected = generateSolidColorImage(
    target.width,
    target.height,
    255,
    0,
    0
  );
  assertImagesSimilar(
    t,
    result.buffer,
    expected,
    target.width,
    target.height,
    "rgba",
    5
  );
});

test("scale - downscale exact", (t) => {
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

  t.is(result.width, target.width);
  t.is(result.height, target.height);

  // Check that the color is preserved (should still be green)
  const expected = generateSolidColorImage(
    target.width,
    target.height,
    0,
    255,
    0
  );
  assertImagesSimilar(
    t,
    result.buffer,
    expected,
    target.width,
    target.height,
    "rgba",
    5
  );
});

test("scale - aspect ratio modes", (t) => {
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
  t.is(exactResult.width, target.width);
  t.is(exactResult.height, target.height);

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
  t.is(fitResult.width, 60);
  t.is(fitResult.height, 30);
});

// Cropping tests
test("crop - center region", (t) => {
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

  t.is(result.width, cropSize.width);
  t.is(result.height, cropSize.height);
});

test("cropCenter - center crop", (t) => {
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

  t.is(result.width, cropSize.width);
  t.is(result.height, cropSize.height);

  // Should still be the same color
  const expected = generateSolidColorImage(
    cropSize.width,
    cropSize.height,
    128,
    128,
    128
  );
  assertImagesSimilar(
    t,
    result.buffer,
    expected,
    cropSize.width,
    cropSize.height,
    "rgba",
    2
  );
});

// Flip tests
test("flipHorizontal - horizontal flip", (t) => {
  const size = TEST_SIZES.small;
  const buffer = generateGradientImage(size.width, size.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = transformer.flipHorizontal().toBufferSync("rgba");

  t.is(result.width, size.width);
  t.is(result.height, size.height);

  // Check that the first pixel (should now be blue from the gradient)
  // and last pixel (should now be red) are swapped
  const resultData = new Uint8Array(result.buffer);
  const originalData = new Uint8Array(buffer);

  // First pixel of result should match last pixel of original (horizontally)
  t.is(resultData[0], originalData[(size.width - 1) * 4]); // Red component
});

test("flipVertical - vertical flip", (t) => {
  const size = TEST_SIZES.small;
  const buffer = createTestPattern(size.width, size.height);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = transformer.flipVertical().toBufferSync("rgba");

  t.is(result.width, size.width);
  t.is(result.height, size.height);

  // Verify the flip by checking that top row matches original bottom row
  const resultData = new Uint8Array(result.buffer);
  const originalData = new Uint8Array(buffer);

  // First row of result should match last row of original
  const firstRowResult = resultData.slice(0, size.width * 4);
  const lastRowOriginal = originalData.slice(
    (size.height - 1) * size.width * 4,
    size.height * size.width * 4
  );

  t.deepEqual(Array.from(firstRowResult), Array.from(lastRowOriginal));
});

// Rotation tests
test("rotate - 90 degrees clockwise", (t) => {
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
  t.is(result.width, size.height);
  t.is(result.height, size.width);
});

test("rotate - 180 degrees", (t) => {
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
  t.is(result.width, size.width);
  t.is(result.height, size.height);
});

test("rotate - 270 degrees clockwise", (t) => {
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
  t.is(result.width, size.height);
  t.is(result.height, size.width);
});

// Padding tests
test("pad - add padding around image", (t) => {
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

  t.is(result.width, expectedWidth);
  t.is(result.height, expectedHeight);
});

// Chain multiple operations
test("complex transformation chain", (t) => {
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

  t.is(result.width, 30);
  t.is(result.height, 30);
});

// Format conversion tests
test("format conversion - RGBA to RGB", (t) => {
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

  t.is(result.width, size.width);
  t.is(result.height, size.height);
  t.is(result.buffer.length, size.width * size.height * 3); // RGB format

  // Check color preservation (first pixel)
  const resultData = new Uint8Array(result.buffer);
  t.is(resultData[0], 255); // Red
  t.is(resultData[1], 128); // Green
  t.is(resultData[2], 64); // Blue
});

test("format conversion - RGB to RGBA", (t) => {
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

  t.is(result.width, size.width);
  t.is(result.height, size.height);
  t.is(result.buffer.length, size.width * size.height * 4); // RGBA format

  // Check color preservation and alpha (first pixel)
  const resultData = new Uint8Array(result.buffer);
  t.is(resultData[0], 255); // Red
  t.is(resultData[1], 128); // Green
  t.is(resultData[2], 64); // Blue
  t.is(resultData[3], 255); // Alpha should be 255
});

// Async operations tests
test("toBuffer - async version", async (t) => {
  const size = TEST_SIZES.small;
  const buffer = generateSolidColorImage(size.width, size.height, 100, 200, 50);

  const transformer = ImageTransformer.fromBuffer(
    buffer,
    size.width,
    size.height,
    "rgba"
  );
  const result = await transformer.scale(20, 20).toBuffer("rgba");

  t.is(result.width, 20);
  t.is(result.height, 20);
  t.true(Buffer.isBuffer(result.buffer));
});

// getCurrentDimensions tests
test("getCurrentDimensions - track size changes", (t) => {
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
  t.is(dims.width, original.width);
  t.is(dims.height, original.height);

  // After scaling
  transformer.scale(100, 50);
  dims = transformer.getCurrentDimensions();
  t.is(dims.width, 100);
  t.is(dims.height, 50);

  // After cropping
  transformer.crop(10, 10, 30, 20);
  dims = transformer.getCurrentDimensions();
  t.is(dims.width, 30);
  t.is(dims.height, 20);
});

// Edge cases and error handling
test("edge case - zero dimensions", (t) => {
  const buffer = generateSolidColorImage(10, 10, 255, 255, 255);
  const transformer = ImageTransformer.fromBuffer(buffer, 10, 10, "rgba");

  t.throws(() => {
    transformer.scale(0, 10).toBufferSync("rgba");
  });

  t.throws(() => {
    transformer.scale(10, 0).toBufferSync("rgba");
  });
});

test("edge case - crop out of bounds", (t) => {
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

  t.throws(() => {
    transformer.crop(15, 15, 5, 5).toBufferSync("rgba"); // Crop beyond image bounds
  });
});

// Test padding color verification
test("pad - padding color correctness", (t) => {
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

  t.is(result.width, expectedWidth);
  t.is(result.height, expectedHeight);

  const resultData = new Uint8Array(result.buffer);

  // Check top-left corner (should be padding color)
  t.is(resultData[0], paddingColor.red);
  t.is(resultData[1], paddingColor.green);
  t.is(resultData[2], paddingColor.blue);
  t.is(resultData[3], paddingColor.alpha);

  // Check center pixel (should be original white)
  const centerX = padding.left + Math.floor(original.width / 2);
  const centerY = padding.top + Math.floor(original.height / 2);
  const centerOffset = (centerY * expectedWidth + centerX) * 4;
  t.is(resultData[centerOffset], 255); // White
  t.is(resultData[centerOffset + 1], 255);
  t.is(resultData[centerOffset + 2], 255);
  t.is(resultData[centerOffset + 3], 255);
});

// Test rotation correctness with asymmetric pattern
test("rotate - rotation correctness verification", (t) => {
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
  t.is(result.width, size.height);
  t.is(result.height, size.width);

  const resultData = new Uint8Array(result.buffer);
  // Check rightmost column (should be red, was top row)
  for (let y = 0; y < result.height; y++) {
    const offset = (y * result.width + (result.width - 1)) * 4;
    t.is(resultData[offset], 255); // Red
    t.is(resultData[offset + 1], 0);
    t.is(resultData[offset + 2], 0);
  }
});
