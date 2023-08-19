import test from "ava";

import { PixelFormat, ImageTransformer } from "../index.js";

test("crude test", (t) => {
  t.notThrows(() =>
    ImageTransformer.fromBuffer(
      Buffer.alloc(72 * 72 * 4),
      72,
      72,
      PixelFormat.Rgba
    )
      .scale(10, 10)
      .toBufferSync(PixelFormat.Rgba, false)
  );
  t.throws(() =>
    ImageTransformer.fromBuffer(
      Buffer.alloc(72 * 72 * 3),
      72,
      72,
      PixelFormat.Rgba
    )
      .scale(10, 10)
      .toBufferSync(PixelFormat.Rgba, false)
  );
});
