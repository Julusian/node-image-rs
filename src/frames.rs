// Decoding of animated images (GIF, APNG, animated WebP) into a sequence of frames

use std::io::Cursor;

use image::codecs::gif::GifDecoder;
use image::codecs::png::PngDecoder;
use image::codecs::webp::WebPDecoder;
use image::imageops::{FilterType, resize};
use image::{AnimationDecoder, Frames, ImageFormat, ImageReader, RgbaImage};

use crate::image_rs_copy;

pub struct DecodeFramesSpec {
  pub max_width: Option<u32>,
  pub max_height: Option<u32>,
  /// Resample the animation onto a fixed grid of this many ms. When None, every frame is kept
  pub sample_interval_ms: Option<u32>,
  pub max_duration_ms: Option<u32>,
}

#[derive(Debug)]
pub struct DecodedFramesData {
  pub width: u32,
  pub height: u32,
  pub frame_start_ms: Vec<u32>,
  /// Length of one loop of the animation. 0 for a static image
  pub duration_ms: u32,
  /// Every frame as rgba, one after another
  pub buffer: Vec<u8>,
}

// Browsers treat very short delays as 100ms, as many GIFs in the wild rely on this
fn effective_delay_ms(delay_ms: f64) -> f64 {
  if delay_ms <= 10.0 { 100.0 } else { delay_ms }
}

#[derive(Debug, PartialEq)]
pub(crate) enum Sample {
  /// Keep the frame, starting at this tick
  Keep(u64),
  /// The frame is never on screen at a tick
  Skip,
  /// The maximum duration has been reached, no more frames are needed
  Stop,
}

// Sample-and-hold of the source frames onto a grid of ticks: each tick shows whichever frame is on screen
// at that moment. Frames of a fast source which fall between ticks are dropped without changing the timing
// of the rest, while slow frames are held for several ticks.
// Every time is rounded up to a tick, so the loop is a whole number of ticks.
pub(crate) struct FrameSampler {
  tick_ms: f64,
  max_ticks: Option<u64>,
  elapsed_ms: f64,
}

impl FrameSampler {
  pub fn new(tick_ms: u32, max_duration_ms: Option<u32>) -> Self {
    let tick_ms = tick_ms.max(1);
    FrameSampler {
      tick_ms: tick_ms as f64,
      max_ticks: max_duration_ms.map(|max| (max / tick_ms).max(1) as u64),
      elapsed_ms: 0.0,
    }
  }

  // The first tick at or after a time. Fractional delays (eg 1/30s) accumulate float error, which must not
  // push an exact tick time over to the next one
  fn to_ticks(&self, ms: f64) -> u64 {
    (ms / self.tick_ms - 1e-6).ceil().max(0.0) as u64
  }

  /// Decide what to do with the next source frame, which is shown for `delay_ms`
  pub fn next(&mut self, delay_ms: f64) -> Sample {
    let start_tick = self.to_ticks(self.elapsed_ms);
    if let Some(max_ticks) = self.max_ticks
      && start_tick >= max_ticks
    {
      return Sample::Stop;
    }

    self.elapsed_ms += effective_delay_ms(delay_ms);

    if self.to_ticks(self.elapsed_ms) > start_tick {
      Sample::Keep(start_tick)
    } else {
      Sample::Skip
    }
  }

  /// The length of the loop, in whole ticks
  pub fn loop_ticks(&self) -> u64 {
    let ticks = self.to_ticks(self.elapsed_ms).max(1);
    match self.max_ticks {
      Some(max_ticks) => ticks.min(max_ticks),
      None => ticks,
    }
  }
}

// The size to scale an image to, so it fits within the limits. Images are never upscaled
fn target_size(
  width: u32,
  height: u32,
  max_width: Option<u32>,
  max_height: Option<u32>,
) -> (u32, u32) {
  let max_width = max_width.unwrap_or(width).max(1);
  let max_height = max_height.unwrap_or(height).max(1);
  if width <= max_width && height <= max_height {
    (width, height)
  } else {
    image_rs_copy::resize_dimensions(width, height, max_width, max_height, false)
  }
}

fn scale_frame(img: RgbaImage, width: u32, height: u32) -> RgbaImage {
  if img.width() == width && img.height() == height {
    img
  } else {
    resize(&img, width, height, FilterType::Lanczos3)
  }
}

fn animation_frames(data: &[u8], format: ImageFormat) -> Result<Option<Frames<'_>>, String> {
  let map_err = |e: image::ImageError| format!("Failed to decode image: {e}");

  match format {
    ImageFormat::Gif => Ok(Some(
      GifDecoder::new(Cursor::new(data))
        .map_err(map_err)?
        .into_frames(),
    )),
    ImageFormat::Png => {
      let decoder = PngDecoder::new(Cursor::new(data)).map_err(map_err)?;
      if decoder.is_apng().map_err(map_err)? {
        Ok(Some(decoder.apng().map_err(map_err)?.into_frames()))
      } else {
        Ok(None)
      }
    }
    ImageFormat::WebP => {
      let decoder = WebPDecoder::new(Cursor::new(data)).map_err(map_err)?;
      if decoder.has_animation() {
        Ok(Some(decoder.into_frames()))
      } else {
        Ok(None)
      }
    }
    _ => Ok(None),
  }
}

fn decode_static(data: &[u8], spec: &DecodeFramesSpec) -> Result<DecodedFramesData, String> {
  let img = ImageReader::new(Cursor::new(data))
    .with_guessed_format()
    .map_err(|_e| "Failed to determine image format".to_string())?
    .decode()
    .map_err(|_e| "Failed to decode image from buffer".to_string())?
    .into_rgba8();

  let (width, height) = target_size(img.width(), img.height(), spec.max_width, spec.max_height);
  let img = scale_frame(img, width, height);

  Ok(DecodedFramesData {
    width,
    height,
    frame_start_ms: vec![0],
    duration_ms: 0,
    buffer: img.into_raw(),
  })
}

pub(crate) fn decode_frames(
  data: &[u8],
  spec: &DecodeFramesSpec,
) -> Result<DecodedFramesData, String> {
  let format =
    image::guess_format(data).map_err(|_e| "Failed to determine image format".to_string())?;

  let Some(frames) = animation_frames(data, format)? else {
    return decode_static(data, spec);
  };

  let tick_ms = spec.sample_interval_ms.unwrap_or(1).max(1);
  let mut sampler = FrameSampler::new(tick_ms, spec.max_duration_ms);

  let mut size: Option<(u32, u32)> = None;
  let mut frame_start_ms: Vec<u32> = Vec::new();
  let mut buffer: Vec<u8> = Vec::new();

  for frame in frames {
    let frame = match frame {
      Ok(frame) => frame,
      // Like browsers, show what could be decoded of a truncated or corrupt animation
      Err(_) if !frame_start_ms.is_empty() => break,
      Err(e) => return Err(format!("Failed to decode image: {e}")),
    };

    let (numer, denom) = frame.delay().numer_denom_ms();
    let delay_ms = numer as f64 / denom.max(1) as f64;

    let start_tick = match sampler.next(delay_ms) {
      Sample::Keep(start_tick) => start_tick,
      Sample::Skip => continue,
      Sample::Stop => break,
    };

    let img = frame.into_buffer();
    let (width, height) = *size.get_or_insert_with(|| {
      target_size(img.width(), img.height(), spec.max_width, spec.max_height)
    });
    let img = scale_frame(img, width, height);

    frame_start_ms.push((start_tick * tick_ms as u64) as u32);
    buffer.extend_from_slice(img.as_raw());
  }

  let Some((width, height)) = size else {
    return Err("Image contains no frames".to_string());
  };

  Ok(DecodedFramesData {
    width,
    height,
    frame_start_ms,
    duration_ms: (sampler.loop_ticks() * tick_ms as u64) as u32,
    buffer,
  })
}

#[cfg(test)]
mod tests {
  use super::*;
  use image::codecs::gif::{GifEncoder, Repeat};
  use image::codecs::webp::WebPEncoder;
  use image::{Delay, Frame, ImageEncoder, Rgba};

  // Run the sampler over a sequence of delays, giving the kept frames (by source index) and their start ticks
  fn sample(
    tick_ms: u32,
    max_duration_ms: Option<u32>,
    delays: &[f64],
  ) -> (Vec<(usize, u64)>, u64) {
    let mut sampler = FrameSampler::new(tick_ms, max_duration_ms);
    let mut kept: Vec<(usize, u64)> = Vec::new();
    for (i, delay) in delays.iter().enumerate() {
      match sampler.next(*delay) {
        Sample::Keep(start_tick) => kept.push((i, start_tick)),
        Sample::Skip => {}
        Sample::Stop => break,
      }
    }
    (kept, sampler.loop_ticks())
  }

  #[test]
  fn sampling_exact_ticks() {
    let (kept, loop_ticks) = sample(100, None, &[100.0, 200.0, 100.0]);
    assert_eq!(kept, vec![(0, 0), (1, 1), (2, 3)]);
    assert_eq!(loop_ticks, 4);
  }

  #[test]
  fn sampling_fast_source_drops_frames() {
    // 30ms frames start at 0,30,60,90,120,150,180,210,240,270
    // Ticks at 0,100,200 show the frames on screen then: 0, 3 (90-120) and 6 (180-210)
    let (kept, loop_ticks) = sample(100, None, &[30.0; 10]);
    assert_eq!(kept, vec![(0, 0), (3, 1), (6, 2)]);
    assert_eq!(loop_ticks, 3);
  }

  #[test]
  fn sampling_fast_source_keeps_real_duration() {
    let (kept, loop_ticks) = sample(100, None, &[40.0; 50]);
    assert_eq!(kept.len(), 20);
    assert_eq!(loop_ticks, 20);
  }

  #[test]
  fn sampling_slow_frames_are_held() {
    // Starts at 0, 500, 750 and ends at 1000. 750 rounds up to tick 8
    let (kept, loop_ticks) = sample(100, None, &[500.0, 250.0, 250.0]);
    assert_eq!(kept, vec![(0, 0), (1, 5), (2, 8)]);
    assert_eq!(loop_ticks, 10);
  }

  #[test]
  fn sampling_loop_rounds_up_to_whole_ticks() {
    let (kept, loop_ticks) = sample(100, None, &[150.0, 170.0]);
    assert_eq!(kept, vec![(0, 0), (1, 2)]);
    assert_eq!(loop_ticks, 4);
  }

  #[test]
  fn sampling_short_delays_count_as_100ms() {
    // 0 and 10 become 100, 20 stays: starts at 0, 100, 200, 220
    let (kept, loop_ticks) = sample(100, None, &[0.0, 10.0, 20.0, 100.0]);
    assert_eq!(kept, vec![(0, 0), (1, 1), (2, 2), (3, 3)]);
    assert_eq!(loop_ticks, 4);
  }

  #[test]
  fn sampling_fractional_delays_do_not_drift() {
    // 30fps: 3 frames per 100ms, so every third frame lands exactly on a tick
    let (kept, loop_ticks) = sample(100, None, &[1000.0 / 30.0; 30]);
    let expected: Vec<(usize, u64)> = (0..10).map(|t| (t * 3, t as u64)).collect();
    assert_eq!(kept, expected);
    assert_eq!(loop_ticks, 10);
  }

  #[test]
  fn sampling_tiny_animation_lasts_one_tick() {
    let (kept, loop_ticks) = sample(100, None, &[20.0]);
    assert_eq!(kept, vec![(0, 0)]);
    assert_eq!(loop_ticks, 1);
  }

  #[test]
  fn sampling_truncates_at_max_duration() {
    // Starts at 0, 300, 600, 900, then 1200 is past the end
    let (kept, loop_ticks) = sample(100, Some(1000), &[300.0; 10]);
    assert_eq!(kept, vec![(0, 0), (1, 3), (2, 6), (3, 9)]);
    assert_eq!(loop_ticks, 10);
  }

  #[test]
  fn sampling_unsampled_keeps_every_frame() {
    let (kept, loop_ticks) = sample(1, None, &[30.0, 30.5, 40.0]);
    assert_eq!(kept, vec![(0, 0), (1, 30), (2, 61)]);
    assert_eq!(loop_ticks, 101);
  }

  #[test]
  fn target_size_never_upscales() {
    assert_eq!(target_size(100, 50, Some(200), Some(200)), (100, 50));
    assert_eq!(target_size(100, 50, None, None), (100, 50));
    assert_eq!(target_size(400, 200, Some(100), Some(100)), (100, 50));
    assert_eq!(target_size(400, 200, None, Some(100)), (200, 100));
  }

  // Distinct solid colour for each test frame
  fn colour(i: usize) -> Rgba<u8> {
    Rgba([(i * 40) as u8, 255 - (i * 40) as u8, 128, 255])
  }

  fn solid(width: u32, height: u32, i: usize) -> RgbaImage {
    RgbaImage::from_pixel(width, height, colour(i))
  }

  fn frame_pixel(result: &DecodedFramesData, frame: usize) -> [u8; 4] {
    let offset = frame * (result.width * result.height * 4) as usize;
    result.buffer[offset..offset + 4].try_into().unwrap()
  }

  fn spec(sample_interval_ms: Option<u32>) -> DecodeFramesSpec {
    DecodeFramesSpec {
      max_width: None,
      max_height: None,
      sample_interval_ms,
      max_duration_ms: None,
    }
  }

  fn make_gif(delays_ms: &[u32]) -> Vec<u8> {
    let mut bytes = Vec::new();
    {
      let mut encoder = GifEncoder::new(&mut bytes);
      encoder.set_repeat(Repeat::Infinite).unwrap();
      for (i, delay) in delays_ms.iter().enumerate() {
        let frame = Frame::from_parts(solid(8, 4, i), 0, 0, Delay::from_numer_denom_ms(*delay, 1));
        encoder.encode_frame(frame).unwrap();
      }
    }
    bytes
  }

  fn make_apng(delays_ms: &[u16]) -> Vec<u8> {
    let mut bytes = Vec::new();
    {
      let mut encoder = png::Encoder::new(&mut bytes, 8, 4);
      encoder.set_color(png::ColorType::Rgba);
      encoder.set_depth(png::BitDepth::Eight);
      encoder.set_animated(delays_ms.len() as u32, 0).unwrap();
      let mut writer = encoder.write_header().unwrap();
      for (i, delay) in delays_ms.iter().enumerate() {
        writer.set_frame_delay(*delay, 1000).unwrap();
        writer.write_image_data(solid(8, 4, i).as_raw()).unwrap();
      }
      writer.finish().unwrap();
    }
    bytes
  }

  fn riff_chunk(fourcc: &[u8; 4], payload: &[u8]) -> Vec<u8> {
    let mut chunk = fourcc.to_vec();
    chunk.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    chunk.extend_from_slice(payload);
    if payload.len() % 2 == 1 {
      chunk.push(0);
    }
    chunk
  }

  fn u24(value: u32) -> [u8; 3] {
    let b = value.to_le_bytes();
    [b[0], b[1], b[2]]
  }

  // There is no animated WebP encoder available, so assemble one from lossless single frames
  fn make_animated_webp(delays_ms: &[u32]) -> Vec<u8> {
    let (width, height) = (8u32, 4u32);

    let mut vp8x = vec![0x10 | 0x02, 0, 0, 0]; // alpha + animation
    vp8x.extend_from_slice(&u24(width - 1));
    vp8x.extend_from_slice(&u24(height - 1));

    let mut anim = vec![0, 0, 0, 0]; // background colour
    anim.extend_from_slice(&0u16.to_le_bytes()); // loop forever

    let mut body = b"WEBP".to_vec();
    body.extend(riff_chunk(b"VP8X", &vp8x));
    body.extend(riff_chunk(b"ANIM", &anim));

    for (i, delay) in delays_ms.iter().enumerate() {
      let mut still = Vec::new();
      WebPEncoder::new_lossless(&mut still)
        .write_image(
          solid(width, height, i).as_raw(),
          width,
          height,
          image::ExtendedColorType::Rgba8,
        )
        .unwrap();
      // Skip the RIFF header and WEBP fourcc, leaving the VP8L chunk
      let image_chunk = &still[12..];

      let mut anmf = Vec::new();
      anmf.extend_from_slice(&u24(0)); // x
      anmf.extend_from_slice(&u24(0)); // y
      anmf.extend_from_slice(&u24(width - 1));
      anmf.extend_from_slice(&u24(height - 1));
      anmf.extend_from_slice(&u24(*delay));
      anmf.push(0x02); // don't blend, don't dispose
      anmf.extend_from_slice(image_chunk);
      body.extend(riff_chunk(b"ANMF", &anmf));
    }

    riff_chunk(b"RIFF", &body)
  }

  fn assert_three_frames(result: &DecodedFramesData) {
    assert_eq!((result.width, result.height), (8, 4));
    assert_eq!(result.frame_start_ms, vec![0, 100, 300]);
    assert_eq!(result.duration_ms, 400);
    assert_eq!(result.buffer.len(), 3 * 8 * 4 * 4);
    for i in 0..3 {
      assert_eq!(frame_pixel(result, i), colour(i).0);
    }
  }

  #[test]
  fn decode_gif() {
    let data = make_gif(&[100, 200, 100]);
    assert_three_frames(&decode_frames(&data, &spec(None)).unwrap());
    assert_three_frames(&decode_frames(&data, &spec(Some(100))).unwrap());
  }

  #[test]
  fn decode_apng() {
    let data = make_apng(&[100, 200, 100]);
    assert_three_frames(&decode_frames(&data, &spec(None)).unwrap());
    assert_three_frames(&decode_frames(&data, &spec(Some(100))).unwrap());
  }

  #[test]
  fn decode_animated_webp() {
    let data = make_animated_webp(&[100, 200, 100]);
    assert_three_frames(&decode_frames(&data, &spec(None)).unwrap());
    assert_three_frames(&decode_frames(&data, &spec(Some(100))).unwrap());
  }

  #[test]
  fn decode_samples_fast_gif() {
    // GIF delays are in units of 10ms
    let data = make_gif(&[30; 10]);

    let all = decode_frames(&data, &spec(None)).unwrap();
    assert_eq!(all.frame_start_ms.len(), 10);
    assert_eq!(all.duration_ms, 300);

    let sampled = decode_frames(&data, &spec(Some(100))).unwrap();
    assert_eq!(sampled.frame_start_ms, vec![0, 100, 200]);
    assert_eq!(sampled.duration_ms, 300);
    assert_eq!(frame_pixel(&sampled, 1), colour(3).0);
    assert_eq!(frame_pixel(&sampled, 2), colour(6).0);
  }

  #[test]
  fn decode_truncates_and_scales() {
    let data = make_apng(&[300; 6]);
    let result = decode_frames(
      &data,
      &DecodeFramesSpec {
        max_width: Some(4),
        max_height: Some(4),
        sample_interval_ms: Some(100),
        max_duration_ms: Some(1000),
      },
    )
    .unwrap();
    assert_eq!((result.width, result.height), (4, 2));
    assert_eq!(result.frame_start_ms, vec![0, 300, 600, 900]);
    assert_eq!(result.duration_ms, 1000);
    assert_eq!(result.buffer.len(), 4 * 4 * 2 * 4);
  }

  #[test]
  fn decode_static_png() {
    let mut data = Vec::new();
    image::codecs::png::PngEncoder::new(&mut data)
      .write_image(
        solid(8, 4, 1).as_raw(),
        8,
        4,
        image::ExtendedColorType::Rgba8,
      )
      .unwrap();

    let result = decode_frames(&data, &spec(Some(100))).unwrap();
    assert_eq!((result.width, result.height), (8, 4));
    assert_eq!(result.frame_start_ms, vec![0]);
    assert_eq!(result.duration_ms, 0);
    assert_eq!(frame_pixel(&result, 0), colour(1).0);
  }

  #[test]
  fn decode_static_webp() {
    let mut data = Vec::new();
    WebPEncoder::new_lossless(&mut data)
      .write_image(
        solid(8, 4, 2).as_raw(),
        8,
        4,
        image::ExtendedColorType::Rgba8,
      )
      .unwrap();

    let result = decode_frames(&data, &spec(None)).unwrap();
    assert_eq!(result.frame_start_ms, vec![0]);
    assert_eq!(result.duration_ms, 0);
    assert_eq!(frame_pixel(&result, 0), colour(2).0);
  }

  #[test]
  fn decode_rejects_garbage() {
    assert!(decode_frames(b"not an image", &spec(None)).is_err());
  }
}
