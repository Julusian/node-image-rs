/* auto-generated by NAPI-RS */
/* eslint-disable */
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
   * Create an `ImageTransformer` from a `Buffer` or `Uint8Array` containing an encoded image
   *
   * @param image - The encoded image to decode
   * @returns An `ImageTransformer` instance
   * This method does not require width or height, as it will be determined from reading the image
   */
  static fromEncodedImage(image: Uint8Array): ImageTransformer
  /**
   * Create an `ImageTransformer` from a data URL string (e.g., "data:image/png;base64,...")
   *
   * @param data_url - The data URL string containing the encoded image
   * @returns An `ImageTransformer` instance
   * This method parses the data URL, extracts the base64 data, and decodes the image
   */
  static fromImageDataUrl(dataUrl: string): ImageTransformer
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
  /**
   * Pad the image by the specified amount
   *
   * @param left - Amount to pad on the left
   * @param right - Amount to pad on the right
   * @param top - Amount to pad on the top
   * @param bottom - Amount to pad on the bottom
   * @param color - RGBA color to use for padding
   */
  pad(left: number, right: number, top: number, bottom: number, color: RgbaValue): this
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
   * Overlay another image on top of the current image
   *
   * @param other - The other image transformer to draw from
   * @param x - X coordinate where to place the overlay
   * @param y - Y coordinate where to place the overlay
   */
  overlay(other: ImageTransformer, x: number, y: number): this
  /** Get the current dimensions of the transformed image */
  getCurrentDimensions(): ImageInfo
  /**
   * Convert the transformed image to a Buffer
   *
   * Danger: This is performed synchronously on the main thread, which can become a performance bottleneck. It is advised to use `toBuffer` whenever possible
   *
   * @param format - The pixel format to pack into the buffer
   */
  toBufferSync(format: PixelFormat): ComputedImage
  /**
   * Asynchronously convert the transformed image to a Buffer
   *
   * @param format - The pixel format to pack into the buffer
   */
  toBuffer(format: PixelFormat): Promise<ComputedImage>
  /**
   * Convert the transformed image to an encoded image Buffer
   *
   * Danger: This is performed synchronously on the main thread, which can become a performance bottleneck. It is advised to use `toBuffer` whenever possible
   *
   * @param format - The image format to pack into the buffer
   * @param options - Optional encoding options
   */
  toEncodedImageSync(format: ImageFormat, options?: EncodingOptions | undefined | null): ComputedImage
  /**
   * Asynchronously convert the transformed image to an encoded image Buffer
   *
   * @param format - The image format to pack into the buffer
   * @param options - Optional encoding options
   */
  toEncodedImage(format: ImageFormat, options?: EncodingOptions | undefined | null): Promise<ComputedImage>
  /**
   * Convert the transformed image to a data URL string
   *
   * Danger: This is performed synchronously on the main thread, which can become a performance bottleneck. It is advised to use `toDataUrl` whenever possible
   *
   * @param format - The image format to encode
   * @param options - Optional encoding options
   */
  toDataUrlSync(format: ImageFormat, options?: EncodingOptions | undefined | null): string
  /**
   * Asynchronously convert the transformed image to a data URL string
   *
   * @param format - The image format to encode
   * @param options - Optional encoding options
   */
  toDataUrl(format: ImageFormat, options?: EncodingOptions | undefined | null): Promise<string>
}

export interface ComputedImage {
  buffer: Buffer
  width: number
  height: number
}

export interface EncodingOptions {
  quality?: number
}

export type ImageFormat =  'jpeg'|
'webp'|
'png';

export interface ImageInfo {
  width: number
  height: number
}

export type PixelFormat =  'rgba'|
'rgb';

export type ResizeMode =  'Exact'|
'Fill'|
'Fit';

export interface RgbaValue {
  red: number
  green: number
  blue: number
  alpha: number
}

export type RotationMode =  'CW90'|
'CW180'|
'CW270';

export interface TransformOptions {
  scaleMode?: ResizeMode
  flipH?: boolean
  flipV?: boolean
  rotation?: RotationMode
}
