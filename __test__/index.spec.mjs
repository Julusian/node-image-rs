import test from 'ava'

import { resize } from '../index.js'
import { PixelFormat } from '../index.js'
import { ResizeMode } from '../index.js'

// test('sum from native', (t) => {
//   t.is(sum(1, 2), 3)
// })

console.log(PixelFormat, ResizeMode)

test('aaa', (t) => {
  t.notThrows(() => resize(72, 72, Buffer.alloc(72*72*4), 10, 10))
  t.throws(() => resize(72, 72, Buffer.alloc(72*72*3), 10, 10))
})