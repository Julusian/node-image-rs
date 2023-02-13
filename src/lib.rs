#![deny(clippy::all)]

use image::{DynamicImage, RgbImage, RgbaImage};
use napi::{
  bindgen_prelude::Uint8Array,
  bindgen_prelude::{AsyncTask, ToNapiValue},
  Env, Error, Status, Task,
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
  None,
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

fn load_image(source_buffer: &Uint8Array, source_info: &ImageInfo) -> Option<DynamicImage> {
  match source_info.format {
    PixelFormat::Rgba => RgbaImage::from_raw(
      source_info.width,
      source_info.height,
      source_buffer.to_vec(),
    )
    .and_then(|img| Some(DynamicImage::from(img))),
    // PixelFormat::Argb => todo!(),
    PixelFormat::Rgb => RgbImage::from_raw(
      source_info.width,
      source_info.height,
      source_buffer.to_vec(),
    )
    .and_then(|img| Some(DynamicImage::from(img))),
  }
}

fn resize_image(img: &DynamicImage, target_info: &ImageInfo, mode: &ResizeMode) -> DynamicImage {
  match mode {
    ResizeMode::Exact => img.resize_exact(
      target_info.width,
      target_info.height,
      image::imageops::FilterType::Lanczos3,
    ),
    ResizeMode::Fill => img.resize_to_fill(
      target_info.width,
      target_info.height,
      image::imageops::FilterType::Lanczos3,
    ),
    ResizeMode::Fit => img.resize(
      target_info.width,
      target_info.height,
      image::imageops::FilterType::Lanczos3,
    ),
  }
}

fn encode_image(img: DynamicImage, format: &PixelFormat) -> Vec<u8> {
  match format {
    PixelFormat::Rgba => img.into_rgba8().into_vec(),
    PixelFormat::Rgb => img.into_rgb8().into_vec(),
  }
}

fn validate(target_info: &ImageInfo) -> napi::Result<()> {
  if target_info.width == 0 || target_info.height == 0 {
    return Err(Error::new(
      Status::GenericFailure,
      "Invalid target dimensions",
    ));
  }

  Ok(())
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

#[napi]
pub fn transform(
  env: Env,
  source_buffer: Uint8Array,
  source_info: ImageInfo,
  target_info: ImageInfo,
  options: TransformOptions,
) -> napi::Result<Uint8Array> {
  validate(&target_info)?;

  if should_return_self(&source_info, &target_info, &options) {
    return Ok(source_buffer);
  }

  let mut task = AsyncTransform {
    source_buffer,
    source_info,
    target_info,
    options,
  };

  let output = task.compute()?;

  task.resolve(env, output)
}

#[napi]
pub fn transform_async(
  source_buffer: Uint8Array,
  source_info: ImageInfo,
  target_info: ImageInfo,
  options: TransformOptions,
) -> napi::Result<AsyncTask<AsyncTransform>> {
  validate(&target_info)?;

  if should_return_self(&source_info, &target_info, &options) {
    // return Ok(source_buffer);
    // TODO
  }

  let task = AsyncTransform {
    source_buffer,
    source_info,
    target_info,
    options,
  };

  Ok(AsyncTask::new(task))
}

pub struct AsyncTransform {
  source_buffer: Uint8Array,
  source_info: ImageInfo,
  target_info: ImageInfo,
  options: TransformOptions,
}

impl napi::Task for AsyncTransform {
  type Output = Vec<u8>;
  type JsValue = Uint8Array;

  fn compute(&mut self) -> napi::Result<Self::Output> {
    let mut img = load_image(&self.source_buffer, &self.source_info)
      .ok_or_else(|| Error::new(Status::GenericFailure, "Invalid pixel buffer"))?;

    // Do resize
    if self.source_info.width != self.target_info.width
      || self.source_info.height != self.target_info.height
    {
      img = resize_image(
        &img,
        &self.target_info,
        &self.options.scale_mode.unwrap_or(ResizeMode::Exact),
      );
    }

    // Rotate
    img = match self.options.rotation.unwrap_or(RotationMode::None) {
      RotationMode::None => img,
      RotationMode::CW90 => img.rotate90(),
      RotationMode::CW180 => img.rotate180(),
      RotationMode::CW270 => img.rotate270(),
    };

    // Do flips
    if self.options.flip_h.unwrap_or(false) {
      img = img.fliph();
    }
    if self.options.flip_v.unwrap_or(false) {
      img = img.flipv();
    }

    let encoded = encode_image(img, &self.target_info.format);

    Ok(encoded)
  }

  fn resolve(&mut self, _env: napi::Env, output: Self::Output) -> napi::Result<Self::JsValue> {
    Ok(Uint8Array::from(output))
    // _env.create_uint32(99)
  }
}
