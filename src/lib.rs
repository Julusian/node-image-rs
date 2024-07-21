#![deny(clippy::all)]

use image::{
  DynamicImage, GenericImage, ImageBuffer, ImageResult, Pixel, RgbImage, Rgba, RgbaImage,
};
use napi::{
  bindgen_prelude::{AsyncTask, Uint8Array},
  Env, Error, JsBuffer, JsObject, JsString, Status, Task,
};

#[macro_use]
extern crate napi_derive;

#[napi]
#[derive(PartialEq)]
pub enum PixelFormat {
  Rgba,
  Rgb,
  // Argb,
}

#[napi]
#[derive(PartialEq)]
pub enum ResizeMode {
  Exact,
  Fill,
  Fit,
}

#[napi(object)]
pub struct ImageInfo {
  pub format: PixelFormat,
  pub width: u32,
  pub height: u32,
}

#[napi]
#[derive(PartialEq)]
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
  source_buffer: &Uint8Array,
  width: u32,
  height: u32,
  format: PixelFormat,
) -> Option<DynamicImage> {
  match format {
    PixelFormat::Rgba => RgbaImage::from_raw(width, height, source_buffer.to_vec())
      .and_then(|img| Some(DynamicImage::from(img))),
    // PixelFormat::Argb => todo!(),
    PixelFormat::Rgb => RgbImage::from_raw(width, height, source_buffer.to_vec())
      .and_then(|img| Some(DynamicImage::from(img))),
  }
}

fn resize_image(img: &DynamicImage, width: u32, height: u32, mode: &ResizeMode) -> DynamicImage {
  match mode {
    ResizeMode::Exact => img.resize_exact(width, height, image::imageops::FilterType::Lanczos3),
    ResizeMode::Fill => img.resize_to_fill(width, height, image::imageops::FilterType::Lanczos3),
    ResizeMode::Fit => img.resize(width, height, image::imageops::FilterType::Lanczos3),
  }
}

fn crop_image(
  img: &DynamicImage,
  width: u32,
  height: u32,
  offset: Option<(u32, u32)>,
) -> DynamicImage {
  let offset = offset.unwrap_or_else(|| ((img.width() - width) / 2, (img.height() - height) / 2));
  img.crop_imm(offset.0, offset.1, width, height)
}

fn pad_image(
  img: &DynamicImage,
  target_format: PixelFormat,
  left: u32,
  right: u32,
  top: u32,
  bottom: u32,
  fill_color: Rgba<u8>,
) -> ImageResult<DynamicImage> {
  let width = img.width() + left + right;
  let height = img.height() + top + bottom;

  let mut padded = match target_format {
    PixelFormat::Rgba => {
      DynamicImage::from(ImageBuffer::from_pixel(width, height, fill_color.to_rgba()))
    }
    PixelFormat::Rgb => {
      DynamicImage::from(ImageBuffer::from_pixel(width, height, fill_color.to_rgb()))
    }
  };

  // let mut padded = DynamicImage::new_rgba8(img.width() + left + right, img.height() + top + bottom);
  padded.copy_from(img, left, top)?;
  Ok(padded)
}

fn encode_image(img: DynamicImage, format: &PixelFormat) -> Vec<u8> {
  match format {
    PixelFormat::Rgba => img.into_rgba8().into_vec(),
    PixelFormat::Rgb => img.into_rgb8().into_vec(),
  }
}

fn is_electron(env: napi::Env) -> napi::Result<bool> {
  let version = env
    .get_global()?
    .get_named_property::<JsObject>("process")?
    .get_named_property::<JsObject>("versions")?
    .get_named_property::<JsString>("electron")?
    .into_utf8();

  match version {
    Err(_) => Ok(false),
    Ok(_) => Ok(true),
  }
}

fn should_return_self(
  source_info: &ImageInfo,
  target_info: &ImageInfo,
  options: &TransformOptions,
) -> bool {
  if source_info.width != target_info.width
    || source_info.height != target_info.height
    || source_info.format != target_info.format
  {
    // Image is different size
    false
  } else if options.flip_v.unwrap_or(false) || options.flip_h.unwrap_or(false) {
    false
  } else {
    true
  }
}

pub struct AsyncTransform {
  spec: TransformSpec,
  target_format: PixelFormat,
  copy_buffer: bool,
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
    let mut img = load_image(
      &self.spec.buffer,
      self.spec.width,
      self.spec.height,
      self.spec.format,
    )
    .ok_or_else(|| Error::new(Status::GenericFailure, "Invalid pixel buffer"))?;

    for op in self.spec.ops.iter() {
      img = match op {
        TransformOps::Scale(op) => resize_image(&img, op.width, op.height, &op.mode),
        TransformOps::Crop(op) => crop_image(&img, op.width, op.height, Some((op.x, op.y))),
        TransformOps::CropCenter(op) => crop_image(&img, op.width, op.height, None),
        TransformOps::Pad(op) => pad_image(
          &img,
          self.target_format,
          op.left,
          op.right,
          op.top,
          op.bottom,
          op.fill_color,
        )
        .or_else(|_e| {
          Err(Error::new(
            Status::GenericFailure,
            "Failed to perform pixel copy",
          ))
        })?,
        TransformOps::FlipV => img.flipv(),
        TransformOps::FlipH => img.fliph(),
        TransformOps::Rotate(mode) => match mode {
          RotationMode::CW90 => img.rotate90(),
          RotationMode::CW180 => img.rotate180(),
          RotationMode::CW270 => img.rotate270(),
        },
      };
    }

    let width = img.width();
    let height = img.height();

    Ok(AsyncTransformResult {
      pixels: encode_image(img, &self.target_format),
      width,
      height,
    })
  }

  fn resolve(&mut self, env: napi::Env, output: Self::Output) -> napi::Result<Self::JsValue> {
    if self.copy_buffer {
      Ok(ComputedImage {
        buffer: env
          .create_buffer_copy(output.pixels)
          .map(|o| o.into_raw())?,
        width: output.width,
        height: output.height,
      })
    } else {
      Ok(ComputedImage {
        buffer: env
          .create_buffer_with_data(output.pixels)
          .map(|o| o.into_raw())?,
        width: output.width,
        height: output.height,
      })
    }
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
}

#[derive(Clone)]
pub struct TransformSpec {
  buffer: Uint8Array, // TODO - is this safe to Clone?
  width: u32,
  height: u32,
  format: PixelFormat,

  ops: Vec<TransformOps>,
}
impl TransformSpec {
  fn get_current_size(&self) -> (u32, u32) {
    let mut size = (self.width, self.height);

    for op in self.ops.iter() {
      size = match op {
        TransformOps::Scale(op) => (op.width, op.height),
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
      };
    }

    size
  }
}

#[napi(object)]
pub struct ComputedImage {
  pub buffer: JsBuffer,
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
        buffer,
        width,
        height,
        format,
        ops: Vec::new(),
      },
    }
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

  /// Convert the transformed image to a Buffer
  ///
  /// Danger: This is performed synchronously on the main thread, which can become a performance bottleneck. It is advised to use `toBuffer` whenever possible
  ///
  /// @param format - The pixel format to pack into the buffer
  #[napi]
  pub fn to_buffer_sync(&self, env: Env, format: PixelFormat) -> napi::Result<ComputedImage> {
    let copy_buffer = is_electron(env).unwrap_or(false);

    println!("debug copy: {}", copy_buffer);

    let mut task = AsyncTransform {
      spec: self.transformer.clone(),
      target_format: format,
      copy_buffer,
    };

    let output = task.compute()?;

    task.resolve(env, output)
  }

  /// Asynchronously convert the transformed image to a Buffer
  ///
  /// @param format - The pixel format to pack into the buffer
  #[napi(ts_return_type = "Promise<ComputedImage>")]
  pub fn to_buffer(
    &self,
    env: Env,
    format: PixelFormat,
  ) -> napi::Result<AsyncTask<AsyncTransform>> {
    let copy_buffer = is_electron(env).unwrap_or(false);

    let task = AsyncTransform {
      spec: self.transformer.clone(),
      target_format: format,
      copy_buffer,
    };

    Ok(AsyncTask::new(task))
  }
}
