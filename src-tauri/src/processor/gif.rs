use std::io::Cursor;

use image::codecs::gif::{GifDecoder, GifEncoder, Repeat};
use image::{AnimationDecoder, DynamicImage, Frame};

use super::ProcessOptions;
use super::resize::{resize_crop, resize_image, target_size};

/// 取 GIF 首帧作为普通位图，用于转换为静态格式
pub(super) fn first_frame(data: &[u8]) -> Result<DynamicImage, String> {
    let frame = GifDecoder::new(Cursor::new(data))
        .map_err(|error| format!("GIF 解码失败：{error}"))?
        .into_frames()
        .next()
        .ok_or_else(|| "GIF 缺少可用帧".to_string())?
        .map_err(|error| format!("GIF 解码失败：{error}"))?;

    Ok(DynamicImage::ImageRgba8(frame.into_buffer()))
}

pub(super) fn process_gif(data: &[u8], options: &ProcessOptions) -> Result<Vec<u8>, String> {
    let frames = GifDecoder::new(Cursor::new(data))
        .map_err(|error| format!("GIF 解码失败：{error}"))?
        .into_frames()
        .collect_frames()
        .map_err(|error| format!("GIF 解码失败：{error}"))?;

    let Some(first) = frames.first() else {
        return Err("GIF 缺少可用帧".to_string());
    };
    let (width, height) = (first.buffer().width(), first.buffer().height());
    let (target_width, target_height) = target_size(width, height, options);
    let resized = (target_width, target_height) != (width, height);
    let crop = options.resize_mode == "crop";

    let mut buffer = Vec::new();
    {
        let mut encoder = GifEncoder::new(&mut buffer);
        encoder
            .set_repeat(Repeat::Infinite)
            .map_err(|error| format!("GIF 编码失败：{error}"))?;

        for frame in frames {
            let delay = frame.delay();
            let buffer = frame.into_buffer();
            let image = if resized {
                let source = DynamicImage::ImageRgba8(buffer);
                let resized = if crop {
                    resize_crop(source, target_width, target_height)
                } else {
                    resize_image(source, target_width, target_height)
                };
                resized.to_rgba8()
            } else {
                buffer
            };

            encoder
                .encode_frame(Frame::from_parts(image, 0, 0, delay))
                .map_err(|error| format!("GIF 编码失败：{error}"))?;
        }
    }

    if !resized && buffer.len() >= data.len() {
        return Ok(data.to_vec());
    }

    Ok(buffer)
}
