/* tslint:disable */
/* eslint-disable */

/* auto-generated by NAPI-RS */

export const enum PixelFormat {
  Rgba = 0,
  Rgb = 1
}
export const enum ResizeMode {
  Exact = 0,
  Fill = 1,
  Fit = 2
}
export interface ImageInfo {
  format: PixelFormat
  width: number
  height: number
}
export const enum RotationMode {
  CW90 = 0,
  CW180 = 1,
  CW270 = 2
}
export interface TransformOptions {
  scaleMode?: ResizeMode
  flipH?: boolean
  flipV?: boolean
  rotation?: RotationMode
}
export class ImageTransformer {
  static fromBuffer(buffer: Uint8Array, width: number, height: number, format: PixelFormat): ImageTransformer
  scale(width: number, height: number, mode?: ResizeMode | undefined | null): this
  flipVertical(): this
  flipHorizontal(): this
  rotate(rotation: RotationMode): this
  toBufferSync(format: PixelFormat): Uint8Array
  toBuffer(format: PixelFormat): Promise<unknown>
}
