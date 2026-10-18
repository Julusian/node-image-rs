import { it, expect } from "vitest";
import { ImageTransformer, decodeFrames } from "../index.js";
import { generateSolidColorImage } from "./test-utils.js";

// The animated formats are covered by the Rust unit tests, this checks the binding itself
function makePng(width: number, height: number): Buffer {
  const buffer = generateSolidColorImage(width, height, 255, 128, 64);
  return ImageTransformer.fromBuffer(
    buffer,
    width,
    height,
    "rgba",
  ).toEncodedImageSync("png").buffer;
}

it("decodeFrames - static image from a buffer", async () => {
  const result = await decodeFrames(makePng(8, 4), { sampleIntervalMs: 100 });

  expect(result.width).toBe(8);
  expect(result.height).toBe(4);
  expect(result.frameCount).toBe(1);
  expect(result.frameStartMs).toEqual([0]);
  expect(result.durationMs).toBe(0);
  expect(result.buffer.length).toBe(8 * 4 * 4);
  expect([...result.buffer.subarray(0, 4)]).toEqual([255, 128, 64, 255]);
});

it("decodeFrames - static image from a data url, downscaled", async () => {
  const dataUrl = `data:image/png;base64,${makePng(16, 8).toString("base64")}`;
  const result = await decodeFrames(dataUrl, { maxWidth: 4, maxHeight: 4 });

  expect(result.width).toBe(4);
  expect(result.height).toBe(2);
  expect(result.buffer.length).toBe(4 * 2 * 4);
});

it("decodeFrames - rejects invalid input", async () => {
  await expect(decodeFrames(Buffer.from("not an image"))).rejects.toThrow();
  await expect(decodeFrames("not a data url")).rejects.toThrow();
});
