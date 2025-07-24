#![deny(clippy::all)]

mod image_rs_copy;

use std::io::Cursor;
use std::sync::Arc;

use image::{
  DynamicImage, GenericImage, ImageBuffer, ImageReader, ImageResult, Pixel, RgbImage, Rgba,
  RgbaImage, imageops::overlay,
};
use napi::{Env, Error, Status, bindgen_prelude::*};

#[macro_use]
extern crate napi_derive;

#[napi(string_enum)]
#[derive(PartialEq, Clone, Copy)]
pub enum PixelFormat {
  #[allow(non_camel_case_types)]
  rgba,
  #[allow(non_camel_case_types)]
  rgb,
  // Argb,
}

#[napi(string_enum)]
#[derive(PartialEq, Clone, Copy)]
pub enum ImageFormat {
  #[allow(non_camel_case_types)]
  jpeg,
  #[allow(non_camel_case_types)]
  webp,
  #[allow(non_camel_case_types)]
  png,
}

#[napi(string_enum)]
#[derive(PartialEq, Clone, Copy)]
pub enum ResizeMode {
  Exact,
  Fill,
  Fit,
}

#[napi(object)]
pub struct ImageInfo {
  // pub format: PixelFormat,
  pub width: u32,
  pub height: u32,
}

#[napi(string_enum)]
#[derive(PartialEq, Clone, Copy)]
pub enum RotationMode {
  CW90,
  CW180,
  CW270,
}

#[napi(object)]
pub struct TransformOptions {
  pub scale_mode: Option<ResizeMode>,
  pub flip_h: Option<bool>,
  pub flip_v: Option<bool>,
  pub rotation: Option<RotationMode>,
}

fn load_image(
  source_buffer: &Vec<u8>,
  width: u32,
  height: u32,
  format: Option<PixelFormat>,
) -> Result<DynamicImage> {
  match format {
    Some(PixelFormat::rgba) => RgbaImage::from_raw(width, height, source_buffer.clone())
      .map(DynamicImage::from)
      .ok_or_else(|| Error::new(Status::GenericFailure, "Invalid pixel buffer")),
    // PixelFormat::Argb => todo!(),
    Some(PixelFormat::rgb) => RgbImage::from_raw(width, height, source_buffer.clone())
      .map(DynamicImage::from)
      .ok_or_else(|| Error::new(Status::GenericFailure, "Invalid pixel buffer")),

    None => {
      let reader = ImageReader::new(Cursor::new(source_buffer))
        .with_guessed_format()
        .map_err(|_e| Error::new(Status::GenericFailure, "Failed to determine image format"))?;

      let image = reader
        .decode()
        .map_err(|_e| Error::new(Status::GenericFailure, "Failed to decode image from buffer"))?;

      if image.width() != width || image.height() != height {
        Err(Error::new(
          Status::GenericFailure,
          "Image dimensions do not match specified width and height",
        ))
      } else {
        Ok(image)
      }
    }
  }
}

fn resize_image(
  img: &DynamicImage,
  width: u32,
  height: u32,
  mode: &ResizeMode,
) -> Option<DynamicImage> {
  if img.width() == width && img.height() == height {
    return None;
  }

  match mode {
    ResizeMode::Exact => {
      Some(img.resize_exact(width, height, image::imageops::FilterType::Lanczos3))
    }
    ResizeMode::Fill => {
      Some(img.resize_to_fill(width, height, image::imageops::FilterType::Lanczos3))
    }
    ResizeMode::Fit => Some(img.resize(width, height, image::imageops::FilterType::Lanczos3)),
  }
}

fn crop_image(
  img: &DynamicImage,
  width: u32,
  height: u32,
  offset: Option<(u32, u32)>,
) -> napi::Result<Option<DynamicImage>> {
  if img.width() == width && img.height() == height {
    return Ok(None);
  }

  let offset = offset.unwrap_or_else(|| ((img.width() - width) / 2, (img.height() - height) / 2));

  if width + offset.0 > img.width() || height + offset.1 > img.height() {
    return Err(Error::new(
      Status::GenericFailure,
      "Crop dimensions exceed image size",
    ));
  }

  Ok(Some(img.crop_imm(offset.0, offset.1, width, height)))
}

fn pad_image(
  img: &DynamicImage,
  target_format: &TargetFormat,
  left: u32,
  right: u32,
  top: u32,
  bottom: u32,
  fill_color: Rgba<u8>,
) -> ImageResult<Option<DynamicImage>> {
  if left == 0 && right == 0 && top == 0 && bottom == 0 {
    // No padding required
    return Ok(None);
  }

  let width = img.width() + left + right;
  let height = img.height() + top + bottom;

  // Create the padded image in target_format space, in the hope that we can avoid an extra conversion
  let mut padded = match target_format {
    TargetFormat::PixelBuffer(PixelFormat::rgb) => {
      DynamicImage::from(ImageBuffer::from_pixel(width, height, fill_color.to_rgb()))
    }
    TargetFormat::PixelBuffer(PixelFormat::rgba) => {
      DynamicImage::from(ImageBuffer::from_pixel(width, height, fill_color.to_rgba()))
    }
    TargetFormat::EncodedImage(_) => {
      // For encoded images, we create a blank RGBA image and convert it later
      DynamicImage::from(ImageBuffer::from_pixel(width, height, fill_color.to_rgba()))
    }
  };

  // let mut padded = DynamicImage::new_rgba8(img.width() + left + right, img.height() + top + bottom);
  padded.copy_from(img, left, top)?;
  Ok(Some(padded))
}

fn overlay_image(
  mut img: DynamicImage,
  other: &TransformSpec,
  x: i64,
  y: i64,
) -> napi::Result<DynamicImage> {
  // Recursively render the overlay image
  let other_img = render_image(other)?;

  // No resizing - use the overlay image as-is and place it at the specified coordinates
  overlay(&mut img, &other_img, x, y);

  Ok(img)
}

fn encode_image(img: DynamicImage, format: &TargetFormat) -> Result<Vec<u8>> {
  match format {
    TargetFormat::PixelBuffer(PixelFormat::rgba) => Ok(img.into_rgba8().into_vec()),
    TargetFormat::PixelBuffer(PixelFormat::rgb) => Ok(img.into_rgb8().into_vec()),
    TargetFormat::EncodedImage((format, quality)) => {
      let mut bytes: Vec<u8> = Vec::new();
      let mut cursor = Cursor::new(&mut bytes);

      match format {
        ImageFormat::png => {
          img.write_with_encoder(image::codecs::png::PngEncoder::new(&mut cursor))
        }
        ImageFormat::jpeg => {
          let quality_u8 = quality
            .map(|q| (q * 100.0) as u8)
            .unwrap_or(75)
            .clamp(0, 100); // Default quality is 75%

          // The jpeg encoder does not support Rgba8 format
          let encode_img = if img.color() != image::ColorType::Rgb8 {
            DynamicImage::from(img.to_rgb8())
          } else {
            img
          };

          encode_img.write_with_encoder(image::codecs::jpeg::JpegEncoder::new_with_quality(
            &mut cursor,
            quality_u8,
          ))
        }
        ImageFormat::webp => {
          img.write_with_encoder(image::codecs::webp::WebPEncoder::new_lossless(&mut cursor))
        }
      }
      .map_err(|e| {
        Error::new(
          Status::GenericFailure,
          format!("Failed to encode image: {e}"),
        )
      })?;

      Ok(bytes)
    }
  }
}

// fn should_return_self(
//   source_info: &ImageInfo,
//   target_info: &ImageInfo,
//   options: &TransformOptions,
// ) -> bool {
//   if source_info.width != target_info.width
//     || source_info.height != target_info.height
//     || source_info.format != target_info.format
//   {
//     // Image is different size
//     false
//   } else if options.flip_v.unwrap_or(false) || options.flip_h.unwrap_or(false) {
//     false
//   } else {
//     true
//   }
// }

fn render_image(spec: &TransformSpec) -> napi::Result<DynamicImage> {
  if spec.buffer.is_empty() {
    return Err(Error::new(Status::GenericFailure, "No image data provided"));
  }

  let mut img = load_image(spec.buffer.as_ref(), spec.width, spec.height, spec.format)?;

  for op in spec.ops.iter() {
    img = match op {
      TransformOps::Scale(op) => resize_image(&img, op.width, op.height, &op.mode).unwrap_or(img),
      TransformOps::Crop(op) => {
        crop_image(&img, op.width, op.height, Some((op.x, op.y)))?.unwrap_or(img)
      }
      TransformOps::CropCenter(op) => crop_image(&img, op.width, op.height, None)?.unwrap_or(img),
      TransformOps::Pad(op) => pad_image(
        &img,
        &TargetFormat::PixelBuffer(PixelFormat::rgba), // Use RGBA for intermediate compositing
        op.left,
        op.right,
        op.top,
        op.bottom,
        op.fill_color,
      )
      .map_err(|_e| Error::new(Status::GenericFailure, "Failed to perform pixel copy"))?
      .unwrap_or(img),
      TransformOps::FlipV => img.flipv(),
      TransformOps::FlipH => img.fliph(),
      TransformOps::Rotate(mode) => match mode {
        RotationMode::CW90 => img.rotate90(),
        RotationMode::CW180 => img.rotate180(),
        RotationMode::CW270 => img.rotate270(),
      },
      TransformOps::Overlay((other, x, y)) => overlay_image(img, other, *x, *y).map_err(|e| {
        Error::new(
          Status::GenericFailure,
          format!("Failed to overlay image: {e}"),
        )
      })?,
    };
  }

  Ok(img)
}

enum TargetFormat {
  PixelBuffer(PixelFormat),
  EncodedImage((ImageFormat, Option<f64>)),
}

pub struct AsyncTransform {
  spec: TransformSpec,
  target_format: TargetFormat,
}

pub struct AsyncTransformResult {
  pub pixels: Vec<u8>,
  pub width: u32,
  pub height: u32,
}

impl napi::Task for AsyncTransform {
  type Output = AsyncTransformResult;
  type JsValue = ComputedImage;

  fn compute(&mut self) -> napi::Result<Self::Output> {
    let img = render_image(&self.spec)?;

    let width = img.width();
    let height = img.height();

    let pixels = encode_image(img, &self.target_format)?;

    Ok(AsyncTransformResult {
      pixels,
      width,
      height,
    })
  }

  fn resolve(&mut self, _env: napi::Env, output: Self::Output) -> napi::Result<Self::JsValue> {
    Ok(ComputedImage {
      buffer: output.pixels.into(),
      width: output.width,
      height: output.height,
    })
  }
}

#[derive(Clone)]
pub struct ScaleOp {
  width: u32,
  height: u32,
  mode: ResizeMode,
}

#[derive(Clone)]
pub struct CropCenterOp {
  width: u32,
  height: u32,
}

#[derive(Clone)]
pub struct CropOp {
  width: u32,
  height: u32,
  x: u32,
  y: u32,
}

#[derive(Clone)]
pub struct PadOp {
  left: u32,
  right: u32,
  top: u32,
  bottom: u32,
  fill_color: Rgba<u8>,
}

#[derive(Clone)]
pub enum TransformOps {
  Scale(ScaleOp),
  Crop(CropOp),
  CropCenter(CropCenterOp),
  Pad(PadOp),
  FlipV,
  FlipH,
  Rotate(RotationMode),
  Overlay((TransformSpec, i64, i64)), // TransformSpec, x, y coordinates
}

#[derive(Clone)]
pub struct TransformSpec {
  buffer: Arc<Vec<u8>>,
  width: u32,
  height: u32,
  format: Option<PixelFormat>, // None means not a raw pixel buffer

  ops: Vec<TransformOps>,
}
impl TransformSpec {
  fn get_current_size(&self) -> (u32, u32) {
    let mut size = (self.width, self.height);

    for op in self.ops.iter() {
      size = match op {
        TransformOps::Scale(op) => match op.mode {
          ResizeMode::Exact => (op.width, op.height),
          ResizeMode::Fill => {
            image_rs_copy::resize_dimensions(size.0, size.1, op.width, op.height, true)
          }
          ResizeMode::Fit => {
            image_rs_copy::resize_dimensions(size.0, size.1, op.width, op.height, false)
          }
        },
        TransformOps::Crop(op) => (op.width, op.height),
        TransformOps::CropCenter(op) => (op.width, op.height),
        TransformOps::Pad(op) => (size.0 + op.left + op.right, size.1 + op.top + op.bottom),
        TransformOps::FlipV => size,
        TransformOps::FlipH => size,
        TransformOps::Rotate(mode) => match mode {
          RotationMode::CW90 => (size.1, size.0),
          RotationMode::CW180 => size,
          RotationMode::CW270 => (size.1, size.0),
        },
        TransformOps::Overlay(_op) => size,
      };
    }

    size
  }
}

#[napi(object)]
pub struct ComputedImage {
  pub buffer: Buffer,
  pub width: u32,
  pub height: u32,
}

#[napi(object)]
pub struct RgbaValue {
  pub red: u8,
  pub green: u8,
  pub blue: u8,
  pub alpha: u8,
}

#[napi(object)]
pub struct EncodingOptions {
  pub quality: Option<f64>,
}

#[napi]
pub struct ImageTransformer {
  transformer: TransformSpec,
}
#[napi]
impl ImageTransformer {
  /// Create an `ImageTransformer` from a `Buffer` or `Uint8Array`
  ///
  /// @param buffer - The image to transform
  /// @param width - Width of the image
  /// @param height - Height of the image
  /// @param format - Pixel format of the buffer
  #[napi(factory)]
  pub fn from_buffer(buffer: Uint8Array, width: u32, height: u32, format: PixelFormat) -> Self {
    ImageTransformer {
      transformer: TransformSpec {
        buffer: Arc::new(buffer.to_vec()),
        width,
        height,
        format: Some(format),
        ops: Vec::new(),
      },
    }
  }

  /// Create an `ImageTransformer` from a `Buffer` or `Uint8Array` containing an encoded image
  ///
  /// @param image - The encoded image to decode
  /// @returns An `ImageTransformer` instance
  /// This method does not require width or height, as it will be determined from reading the image
  #[napi(factory)]
  pub fn from_encoded_image(image: Uint8Array) -> napi::Result<Self> {
    let reader = ImageReader::new(Cursor::new(&image))
      .with_guessed_format()
      .map_err(|_e| Error::new(Status::GenericFailure, "Failed to determine image format"))?;

    let dimensions = reader.into_dimensions().map_err(|_e| {
      Error::new(
        Status::GenericFailure,
        "Failed to determine image dimensions",
      )
    })?;

    Ok(ImageTransformer {
      transformer: TransformSpec {
        buffer: Arc::new(image.to_vec()),
        width: dimensions.0,
        height: dimensions.1,
        format: None,
        ops: Vec::new(),
      },
    })
  }

  /// Add a scale step to the transform sequence
  ///
  /// @param width - Target width for the image
  /// @param height - Target height for the image
  /// @param mode - Method to use when source and target aspect ratios do not match
  #[napi]
  pub fn scale(
    &mut self,
    width: u32,
    height: u32,
    mode: Option<ResizeMode>,
  ) -> napi::Result<&Self> {
    if width == 0 || height == 0 {
      Err(Error::new(Status::GenericFailure, "Invalid dimensions"))
    } else {
      self.transformer.ops.push(TransformOps::Scale(ScaleOp {
        width,
        height,
        mode: mode.unwrap_or(ResizeMode::Exact),
      }));

      Ok(self)
    }
  }

  /// Add a crop step to the transform sequence
  ///
  /// @param x - X offset for the crop
  /// @param y - Y offset for the crop
  /// @param width - Target width for the image
  /// @param height - Target height for the image
  #[napi]
  pub fn crop(&mut self, x: u32, y: u32, width: u32, height: u32) -> napi::Result<&Self> {
    let current_size = self.transformer.get_current_size();

    if width == 0 || height == 0 || (width + x) > current_size.0 || (height + y) > current_size.1 {
      Err(Error::new(Status::GenericFailure, "Invalid dimensions"))
    } else {
      self.transformer.ops.push(TransformOps::Crop(CropOp {
        x,
        y,
        width,
        height,
      }));

      Ok(self)
    }
  }

  /// Add a center crop step to the transform sequence
  ///
  /// @param width - Target width for the image
  /// @param height - Target height for the image
  #[napi]
  pub fn crop_center(&mut self, width: u32, height: u32) -> napi::Result<&Self> {
    let current_size = self.transformer.get_current_size();

    if width == 0 || height == 0 || width > current_size.0 || height > current_size.1 {
      Err(Error::new(Status::GenericFailure, "Invalid dimensions"))
    } else {
      self
        .transformer
        .ops
        .push(TransformOps::CropCenter(CropCenterOp { width, height }));

      Ok(self)
    }
  }

  /// Pad the image by the specified amount
  ///
  /// @param left - Amount to pad on the left
  /// @param right - Amount to pad on the right
  /// @param top - Amount to pad on the top
  /// @param bottom - Amount to pad on the bottom
  /// @param color - RGBA color to use for padding
  #[napi]
  pub fn pad(&mut self, left: u32, right: u32, top: u32, bottom: u32, color: RgbaValue) -> &Self {
    self.transformer.ops.push(TransformOps::Pad(PadOp {
      left,
      right,
      top,
      bottom,
      fill_color: Rgba([color.red, color.green, color.blue, color.alpha]),
    }));

    self
  }

  /// Add a vertical flip step to the transform sequence
  #[napi]
  pub fn flip_vertical(&mut self) -> &Self {
    self.transformer.ops.push(TransformOps::FlipV);

    self
  }

  /// Add a horizontal flip step to the transform sequence
  #[napi]
  pub fn flip_horizontal(&mut self) -> &Self {
    self.transformer.ops.push(TransformOps::FlipH);

    self
  }

  /// Add a rotation step to the transform sequence
  ///
  /// @param rotation - The amount to rotate by
  #[napi]
  pub fn rotate(&mut self, rotation: RotationMode) -> &Self {
    self.transformer.ops.push(TransformOps::Rotate(rotation));

    self
  }

  /// Overlay another image on top of the current image
  ///
  /// @param other - The other image transformer to draw from
  /// @param x - X coordinate where to place the overlay
  /// @param y - Y coordinate where to place the overlay
  #[napi]
  pub fn overlay(&mut self, other: &ImageTransformer, x: i64, y: i64) -> napi::Result<&Self> {
    let current_size = self.transformer.get_current_size();

    // Check if the overlay would be completely outside the base image bounds
    if x >= current_size.0 as i64 || y >= current_size.1 as i64 || x < 0 || y < 0 {
      return Err(Error::new(
        Status::GenericFailure,
        "Overlay image is completely outside the bounds of the base image",
      ));
    }

    self
      .transformer
      .ops
      .push(TransformOps::Overlay((other.transformer.clone(), x, y)));

    Ok(self)
  }

  /// Get the current dimensions of the transformed image
  #[napi]
  pub fn get_current_dimensions(&self) -> ImageInfo {
    let (width, height) = self.transformer.get_current_size();

    ImageInfo { width, height }
  }

  /// Convert the transformed image to a Buffer
  ///
  /// Danger: This is performed synchronously on the main thread, which can become a performance bottleneck. It is advised to use `toBuffer` whenever possible
  ///
  /// @param format - The pixel format to pack into the buffer
  #[napi]
  pub fn to_buffer_sync(&self, _env: Env, format: PixelFormat) -> napi::Result<ComputedImage> {
    let img = render_image(&self.transformer)?;

    let width = img.width();
    let height = img.height();

    let pixels = encode_image(img, &TargetFormat::PixelBuffer(format))?;

    Ok(ComputedImage {
      buffer: pixels.into(),
      width,
      height,
    })
  }

  /// Asynchronously convert the transformed image to a Buffer
  ///
  /// @param format - The pixel format to pack into the buffer
  #[napi(ts_return_type = "Promise<ComputedImage>")]
  pub fn to_buffer(
    &self,
    _env: Env,
    format: PixelFormat,
  ) -> napi::Result<AsyncTask<AsyncTransform>> {
    let task = AsyncTransform {
      spec: self.transformer.clone(),
      target_format: TargetFormat::PixelBuffer(format),
    };

    Ok(AsyncTask::new(task))
  }

  /// Convert the transformed image to an encoded image Buffer
  ///
  /// Danger: This is performed synchronously on the main thread, which can become a performance bottleneck. It is advised to use `toBuffer` whenever possible
  ///
  /// @param format - The image format to pack into the buffer
  /// @param options - Optional encoding options
  #[napi]
  pub fn to_encoded_image_sync(
    &self,
    _env: Env,
    format: ImageFormat,
    options: Option<EncodingOptions>,
  ) -> napi::Result<ComputedImage> {
    let quality = options.as_ref().and_then(|opts| opts.quality);

    let img = render_image(&self.transformer)?;

    let width = img.width();
    let height = img.height();

    let pixels = encode_image(img, &TargetFormat::EncodedImage((format, quality)))?;

    Ok(ComputedImage {
      buffer: pixels.into(),
      width,
      height,
    })
  }

  /// Asynchronously convert the transformed image to an encoded image Buffer
  ///
  /// @param format - The image format to pack into the buffer
  /// @param options - Optional encoding options
  #[napi(ts_return_type = "Promise<ComputedImage>")]
  pub fn to_encoded_image(
    &self,
    _env: Env,
    format: ImageFormat,
    options: Option<EncodingOptions>,
  ) -> napi::Result<AsyncTask<AsyncTransform>> {
    let quality = options.as_ref().and_then(|opts| opts.quality);
    let task = AsyncTransform {
      spec: self.transformer.clone(),
      target_format: TargetFormat::EncodedImage((format, quality)),
    };

    Ok(AsyncTask::new(task))
  }
}
