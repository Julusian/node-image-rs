import { it, expect } from "vitest";
import { ImageTransformer, decodeFrames } from "../index.js";
import { generateSolidColorImage } from "./test-utils.js";

// The animated formats are covered by the Rust unit tests, this checks the binding itself

// 64x32 GIF with red, green and blue frames, 100ms each
const ANIMATED_GIF = Buffer.from(
  "R0lGODlhQAAgAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAQAAgAAAISwABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDihxJsqTJkyhTqlzJsqXLlzBjypxJs6bNmzhz6tzJs6fPnyADAgAh+QQBCgABACwAAAAAQAAgAIEA/wAAAAAAAAAAAAAISwABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDihxJsqTJkyhTqlzJsqXLlzBjypxJs6bNmzhz6tzJs6fPnyADAgAh+QQBCgABACwAAAAAQAAgAIEAAP8AAAAAAAAAAAAISwABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDihxJsqTJkyhTqlzJsqXLlzBjypxJs6bNmzhz6tzJs6fPnyADAgA7",
  "base64",
);

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
  const result = (await decodeFrames(makePng(8, 4), {
    sampleIntervalMs: 100,
  }))!;

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
  const result = (await decodeFrames(dataUrl, { maxWidth: 4, maxHeight: 4 }))!;

  expect(result.width).toBe(4);
  expect(result.height).toBe(2);
  expect(result.buffer.length).toBe(4 * 2 * 4);
});

it("decodeFrames - rejects invalid input", async () => {
  await expect(decodeFrames(Buffer.from("not an image"))).rejects.toThrow();
  await expect(decodeFrames("not a data url")).rejects.toThrow();
});

it("decodeFrames - animation within maxBytes", async () => {
  const maxBytes = 3 * 64 * 32 * 4 - 1;
  const result = (await decodeFrames(ANIMATED_GIF, {
    sampleIntervalMs: 100,
    maxBytes,
  }))!;

  expect(result.frameCount).toBe(3);
  expect(result.frameStartMs).toEqual([0, 100, 200]);
  expect(result.durationMs).toBe(300);
  expect(result.width).toBeLessThan(64);
  expect(Math.abs(result.width - result.height * 2)).toBeLessThanOrEqual(1);
  expect(result.buffer.length).toBe(3 * result.width * result.height * 4);
  expect(result.buffer.length).toBeLessThanOrEqual(maxBytes);
});

it("decodeFrames - static image within maxBytes, from a data url", async () => {
  const dataUrl = `data:image/png;base64,${makePng(64, 32).toString("base64")}`;
  const result = (await decodeFrames(dataUrl, { maxBytes: 2000 }))!;

  expect(result.frameCount).toBe(1);
  expect(result.buffer.length).toBeLessThanOrEqual(2000);
  expect(result.buffer.length).toBe(result.width * result.height * 4);
});

it("decodeFrames - animatedOnly gives null for a static image", async () => {
  expect(await decodeFrames(makePng(8, 4), { animatedOnly: true })).toBeNull();

  const dataUrl = `data:image/png;base64,${makePng(8, 4).toString("base64")}`;
  expect(await decodeFrames(dataUrl, { animatedOnly: true })).toBeNull();
});

it("decodeFrames - animatedOnly keeps an animation", async () => {
  const dataUrl = `data:image/gif;base64,${ANIMATED_GIF.toString("base64")}`;
  const result = await decodeFrames(dataUrl, {
    sampleIntervalMs: 100,
    animatedOnly: true,
  });

  expect(result).not.toBeNull();
  expect(result!.frameCount).toBe(3);
  expect([...result!.buffer.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
});

it("decodeFrames - animatedOnly gives null when sampling leaves one frame", async () => {
  expect(
    await decodeFrames(ANIMATED_GIF, {
      sampleIntervalMs: 1000,
      animatedOnly: true,
    }),
  ).toBeNull();
});
