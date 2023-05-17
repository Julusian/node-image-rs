#![deny(clippy::all)]

use image::{imageops::FilterType, DynamicImage, RgbImage, RgbaImage};
use napi::{
  bindgen_prelude::{AsyncTask, FromNapiValue, ToNapiValue, Uint8Array},
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

#[napi]
#[derive(PartialEq)]
pub enum ResizeAlgorithm {
  /// Nearest Neighbor
  Nearest,

  /// Linear Filter
  Triangle,

  /// Cubic Filter
  CatmullRom,

  /// Gaussian Filter
  Gaussian,

  /// Lanczos with window 3
  Lanczos3,
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

fn resize_image(
  img: &DynamicImage,
  width: u32,
  height: u32,
  mode: &ResizeMode,
  algorithm: &ResizeAlgorithm,
) -> DynamicImage {
  let filter = match algorithm {
    &ResizeAlgorithm::Nearest => FilterType::Nearest,
    &ResizeAlgorithm::Triangle => FilterType::Triangle,
    &ResizeAlgorithm::CatmullRom => FilterType::CatmullRom,
    &ResizeAlgorithm::Gaussian => FilterType::Gaussian,
    &ResizeAlgorithm::Lanczos3 => FilterType::Lanczos3,
  };
  match mode {
    ResizeMode::Exact => img.resize_exact(width, height, filter),
    ResizeMode::Fill => img.resize_to_fill(width, height, filter),
    ResizeMode::Fit => img.resize(width, height, filter),
  }
}

fn encode_image(img: DynamicImage, format: &PixelFormat) -> Vec<u8> {
  match format {
    PixelFormat::Rgba => img.into_rgba8().into_vec(),
    PixelFormat::Rgb => img.into_rgb8().into_vec(),
  }
}

pub struct AsyncTransform {
  spec: TransformSpec,
  target_format: PixelFormat,
}

impl napi::Task for AsyncTransform {
  type Output = Vec<u8>;
  type JsValue = Uint8Array;

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
        TransformOps::Scale(op) => resize_image(&img, op.width, op.height, &op.mode, &op.algorithm),
        TransformOps::FlipV => img.flipv(),
        TransformOps::FlipH => img.fliph(),
        TransformOps::Rotate(mode) => match mode {
          RotationMode::CW90 => img.rotate90(),
          RotationMode::CW180 => img.rotate180(),
          RotationMode::CW270 => img.rotate270(),
        },
      };
    }

    let encoded = encode_image(img, &self.target_format);

    Ok(encoded)
  }

  fn resolve(&mut self, _env: napi::Env, output: Self::Output) -> napi::Result<Self::JsValue> {
    Ok(Uint8Array::from(output))
  }
}

#[derive(Clone)]
pub struct ScaleOp {
  width: u32,
  height: u32,
  mode: ResizeMode,
  algorithm: ResizeAlgorithm,
}

#[derive(Clone)]
pub enum TransformOps {
  Scale(ScaleOp),
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

#[napi]
pub struct ImageTransformer {
  transformer: TransformSpec,
}
#[napi]
impl ImageTransformer {
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

  #[napi]
  pub fn scale(
    &mut self,
    width: u32,
    height: u32,
    mode: Option<ResizeMode>,
    algorithm: Option<ResizeAlgorithm>,
  ) -> napi::Result<&Self> {
    if width == 0 || height == 0 {
      Err(Error::new(Status::GenericFailure, "Invalid dimensions"))
    } else {
      self.transformer.ops.push(TransformOps::Scale(ScaleOp {
        width,
        height,
        mode: mode.unwrap_or(ResizeMode::Exact),
        algorithm: algorithm.unwrap_or(ResizeAlgorithm::Lanczos3),
      }));

      Ok(self)
    }
  }

  #[napi]
  pub fn flip_vertical(&mut self) -> &Self {
    self.transformer.ops.push(TransformOps::FlipV);

    self
  }

  #[napi]
  pub fn flip_horizontal(&mut self) -> &Self {
    self.transformer.ops.push(TransformOps::FlipH);

    self
  }

  #[napi]
  pub fn rotate(&mut self, rotation: RotationMode) -> &Self {
    self.transformer.ops.push(TransformOps::Rotate(rotation));

    self
  }

  #[napi]
  pub fn to_buffer_sync(&self, env: Env, format: PixelFormat) -> napi::Result<Uint8Array> {
    let mut task = AsyncTransform {
      spec: self.transformer.clone(),
      target_format: format,
    };

    let output = task.compute()?;

    task.resolve(env, output)
  }

  #[napi(ts_return_type = "Promise<Uint8Array>")]
  pub fn to_buffer(&mut self, format: PixelFormat) -> napi::Result<AsyncTask<AsyncTransform>> {
    let task = AsyncTransform {
      spec: self.transformer.clone(),
      target_format: format,
    };

    Ok(AsyncTask::new(task))
  }
}
