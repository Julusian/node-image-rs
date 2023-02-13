import test from "ava";

import { transform } from "../index.js";
import { PixelFormat } from "../index.js";
import { ResizeMode } from "../index.js";

// test('sum from native', (t) => {
//   t.is(sum(1, 2), 3)
// })

// console.log(PixelFormat, ResizeMode)

test("crude test", (t) => {
  t.notThrows(() =>
    transform(
      Buffer.alloc(72 * 72 * 4),
      {
        width: 72,
        height: 72,
        format: PixelFormat.Rgba,
      },
      {
        width: 10,
        height: 10,
        format: PixelFormat.Rgba,
      },
      {}
    )
  );
  t.throws(() =>
    transform(
      Buffer.alloc(72 * 72 * 3),
      {
        width: 72,
        height: 72,
        format: PixelFormat.Rgba,
      },
      {
        width: 10,
        height: 10,
        format: PixelFormat.Rgba,
      },
      {}
    )
  );
});
