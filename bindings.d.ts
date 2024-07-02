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
export declare class ImageTransformer {
  /**
   * Create an `ImageTransformer` from a `Buffer` or `Uint8Array`
   *
   * @param buffer - The image to transform
   * @param width - Width of the image
   * @param height - Height of the image
   * @param format - Pixel format of the buffer
   */
  static fromBuffer(buffer: Uint8Array, width: number, height: number, format: PixelFormat): ImageTransformer
  /**
   * Add a scale step to the transform sequence
   *
   * @param width - Target width for the image
   * @param height - Target height for the image
   * @param mode - Method to use when source and target aspect ratios do not match
   */
  scale(width: number, height: number, mode?: ResizeMode | undefined | null): this
  /**
   * Add a crop step to the transform sequence
   *
   * @param x - X offset for the crop
   * @param y - Y offset for the crop
   * @param width - Target width for the image
   * @param height - Target height for the image
   */
  crop(x: number, y: number, width: number, height: number): this
  /**
   * Add a center crop step to the transform sequence
   *
   * @param width - Target width for the image
   * @param height - Target height for the image
   */
  cropCenter(width: number, height: number): this
  /** Add a vertical flip step to the transform sequence */
  flipVertical(): this
  /** Add a horizontal flip step to the transform sequence */
  flipHorizontal(): this
  /**
   * Add a rotation step to the transform sequence
   *
   * @param rotation - The amount to rotate by
   */
  rotate(rotation: RotationMode): this
  /**
   * Convert the transformed image to a Buffer
   *
   * Danger: This is performed synchronously on the main thread, which can become a performance bottleneck. It is advised to use `toBuffer` whenever possible
   *
   * @param format - The pixel format to pack into the buffer
   */
  toBufferSync(format: PixelFormat): Buffer
  /**
   * Asynchronously convert the transformed image to a Buffer
   *
   * @param format - The pixel format to pack into the buffer
   */
  toBuffer(format: PixelFormat): Promise<Buffer>
}
