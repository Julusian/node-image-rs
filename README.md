# @julusian/image-rs

[![Node CI](https://github.com/Julusian/node-image-rs/workflows/CI/badge.svg)](https://github.com/Julusian/node-image-rs/workflows/CI/badge.svg)
[![npm version](https://img.shields.io/npm/v/@julusian/image-rs.svg)](https://www.npmjs.com/package/@julusian/image-rs)
[![npm downloads](https://img.shields.io/npm/dm/@julusian/image-rs.svg)](https://www.npmjs.com/package/@julusian/image-rs)
[![MIT license](https://img.shields.io/npm/l/@julusian/image-rs.svg)](./LICENSE)

**@julusian/image-rs** provides a minimal and performant wrapper around the [rust image](https://github.com/image-rs/image) library.

Please ask if you need more methods exposed.

## Requirements

All versions of Node still in [_active_ Long-term Support](https://github.com/nodejs/LTS#lts-schedule) and the current development version are supported. Older versions may or may not work; they are not and will not be supported.

We provide prebuilds for many platforms. If your platform is not supported, open an issue and hopefully it can be enabled. If you need to build from source, you will require a rust toolchain to be available.

## Installation

Make sure you've got the [requirements](#requirements) installed first.

Using [yarn](https://yarnpkg.com/):

```sh
yarn add @julusian/image-rs
```

Using [npm](https://www.npmjs.com/):

```sh
npm install --save @julusian/image-rs
```

## API

All image operations are performed via the `ImageTransformer` class. Transforms are chained and executed lazily when you call one of the output methods.

### Creating an `ImageTransformer`

#### `ImageTransformer.fromBuffer(buffer, width, height, format)`

Creates an `ImageTransformer` from a raw pixel buffer.

```ts
import { ImageTransformer } from '@julusian/image-rs'

const transformer = ImageTransformer.fromBuffer(rawPixelBuffer, 1920, 1080, 'rgba')
```

**Parameters:**
- `buffer: Uint8Array` — Raw pixel data
- `width: number` — Width of the image in pixels
- `height: number` — Height of the image in pixels
- `format: PixelFormat` — Pixel layout of the buffer (`'rgba'`, `'rgb'`, `'bgra'`, or `'bgr'`)

---

#### `ImageTransformer.fromEncodedImage(image)`

Creates an `ImageTransformer` from a buffer containing an encoded image (e.g. a JPEG or PNG file read from disk). Width and height are determined automatically.

```ts
import fs from 'fs'
import { ImageTransformer } from '@julusian/image-rs'

const fileBuffer = fs.readFileSync('photo.jpg')
const transformer = ImageTransformer.fromEncodedImage(fileBuffer)
```

**Parameters:**
- `image: Uint8Array` — Encoded image bytes

---

#### `ImageTransformer.fromImageDataUrl(dataUrl)`

Creates an `ImageTransformer` from a data URL string such as `data:image/png;base64,...`.

```ts
const transformer = ImageTransformer.fromImageDataUrl('data:image/png;base64,...')
```

**Parameters:**
- `dataUrl: string` — A data URL containing the encoded image

---

### Transform methods

Transforms are chained on the `ImageTransformer` instance and applied in the order they are added.

#### `.scale(width, height, mode?)`

Scales the image to the given dimensions.

```ts
transformer.scale(640, 480, 'Fit')
```

**Parameters:**
- `width: number` — Target width
- `height: number` — Target height
- `mode?: ResizeMode` — How to handle aspect ratio mismatches (see [`ResizeMode`](#resizemode))

---

#### `.crop(x, y, width, height)`

Crops a region from the image.

```ts
transformer.crop(100, 50, 640, 480)
```

**Parameters:**
- `x: number` — Left offset of the crop region
- `y: number` — Top offset of the crop region
- `width: number` — Width of the crop region
- `height: number` — Height of the crop region

---

#### `.cropCenter(width, height)`

Crops a region of the given size from the centre of the image.

```ts
transformer.cropCenter(640, 480)
```

**Parameters:**
- `width: number` — Width of the crop region
- `height: number` — Height of the crop region

---

#### `.pad(left, right, top, bottom, color)`

Adds padding around the image in the given RGBA colour.

```ts
transformer.pad(10, 10, 10, 10, { red: 0, green: 0, blue: 0, alpha: 255 })
```

**Parameters:**
- `left: number` — Pixels to add on the left
- `right: number` — Pixels to add on the right
- `top: number` — Pixels to add on the top
- `bottom: number` — Pixels to add on the bottom
- `color: RgbaValue` — Fill colour (see [`RgbaValue`](#rgbavalue))

---

#### `.flipVertical()`

Flips the image vertically (top-to-bottom).

```ts
transformer.flipVertical()
```

---

#### `.flipHorizontal()`

Flips the image horizontally (left-to-right).

```ts
transformer.flipHorizontal()
```

---

#### `.rotate(rotation)`

Rotates the image clockwise.

```ts
transformer.rotate('CW90')
```

**Parameters:**
- `rotation: RotationMode` — One of `'CW90'`, `'CW180'`, or `'CW270'`

---

#### `.overlay(other, x, y)`

Composites another image on top of the current image at the given position.

```ts
const watermark = ImageTransformer.fromEncodedImage(watermarkBytes)
transformer.overlay(watermark, 20, 20)
```

**Parameters:**
- `other: ImageTransformer` — The image to draw on top
- `x: number` — X coordinate for the top-left corner of the overlay
- `y: number` — Y coordinate for the top-left corner of the overlay

---

#### `.getCurrentDimensions()`

Returns the current width and height after the transforms applied so far, without executing the full pipeline.

```ts
const { width, height } = transformer.getCurrentDimensions()
```

**Returns:** `ImageInfo` — `{ width: number, height: number }`

---

### Output methods

#### `.toBuffer(format)` / `.toBufferSync(format)`

Executes the transform pipeline and returns a raw pixel buffer.

```ts
const result = await transformer.toBuffer('rgba')
// result.buffer — Buffer of raw pixel data
// result.width  — Width of the output image
// result.height — Height of the output image
```

> ⚠️ `toBufferSync` runs on the main thread and can block the event loop. Prefer `toBuffer` in production.

**Parameters:**
- `format: PixelFormat` — Desired pixel layout of the output buffer

**Returns:** `Promise<ComputedImage>` (`toBuffer`) or `ComputedImage` (`toBufferSync`)

---

#### `.toEncodedImage(format, options?)` / `.toEncodedImageSync(format, options?)`

Executes the transform pipeline and encodes the result as JPEG, WebP, or PNG.

```ts
const result = await transformer.toEncodedImage('jpeg', { quality: 85 })
fs.writeFileSync('output.jpg', result.buffer)
```

> ⚠️ `toEncodedImageSync` runs on the main thread and can block the event loop. Prefer `toEncodedImage` in production.

**Parameters:**
- `format: ImageFormat` — `'jpeg'`, `'webp'`, or `'png'`
- `options?: EncodingOptions` — Optional encoding settings (see [`EncodingOptions`](#encodingoptions))

**Returns:** `Promise<ComputedImage>` (`toEncodedImage`) or `ComputedImage` (`toEncodedImageSync`)

---

#### `.toDataUrl(format, options?)` / `.toDataUrlSync(format, options?)`

Executes the transform pipeline and returns the result as a base64 data URL string.

```ts
const dataUrl = await transformer.toDataUrl('png')
// "data:image/png;base64,..."
```

> ⚠️ `toDataUrlSync` runs on the main thread and can block the event loop. Prefer `toDataUrl` in production.

**Parameters:**
- `format: ImageFormat` — `'jpeg'`, `'webp'`, or `'png'`
- `options?: EncodingOptions` — Optional encoding settings

**Returns:** `Promise<string>` (`toDataUrl`) or `string` (`toDataUrlSync`)

---

### Types

#### `PixelFormat`

The memory layout of raw pixel buffers.

```ts
type PixelFormat = 'rgba' | 'rgb' | 'bgra' | 'bgr'
```

#### `ImageFormat`

Supported encoded image formats.

```ts
type ImageFormat = 'jpeg' | 'webp' | 'png'
```

#### `ResizeMode`

How to handle aspect ratio mismatches when scaling.

```ts
type ResizeMode = 'Exact' | 'Fill' | 'Fit'
```

- `'Exact'` — Stretch/squash to exactly the target dimensions, ignoring aspect ratio
- `'Fill'` — Scale and crop to fill the target dimensions while preserving aspect ratio
- `'Fit'` — Scale to fit within the target dimensions while preserving aspect ratio (may leave empty space)

#### `RotationMode`

Clockwise rotation amounts.

```ts
type RotationMode = 'CW90' | 'CW180' | 'CW270'
```

#### `RgbaValue`

An RGBA colour with channels in the range 0–255.

```ts
interface RgbaValue {
  red: number
  green: number
  blue: number
  alpha: number
}
```

#### `ComputedImage`

The result of an output operation.

```ts
interface ComputedImage {
  buffer: Buffer
  width: number
  height: number
}
```

#### `EncodingOptions`

Options for encoded image output.

```ts
interface EncodingOptions {
  quality?: number  // 0–100, applies to JPEG and WebP
}
```

#### `ImageInfo`

Basic image dimensions.

```ts
interface ImageInfo {
  width: number
  height: number
}
```

---

### Example: resize and encode

```ts
import fs from 'fs'
import { ImageTransformer } from '@julusian/image-rs'

const input = fs.readFileSync('input.png')

const result = await ImageTransformer
  .fromEncodedImage(input)
  .scale(320, 240, 'Fit')
  .toEncodedImage('jpeg', { quality: 80 })

fs.writeFileSync('output.jpg', result.buffer)
```

## License

See [LICENSE](./LICENSE).

Copyright © Julian Waller. All Rights Reserved.
