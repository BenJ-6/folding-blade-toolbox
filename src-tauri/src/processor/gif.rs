use std::io::Cursor;

use image::codecs::gif::{GifDecoder, GifEncoder, Repeat};
use image::{AnimationDecoder, DynamicImage, Frame};

use super::ProcessOptions;
use super::resize::{resize_image, target_size};

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
                resize_image(
                    DynamicImage::ImageRgba8(buffer),
                    target_width,
                    target_height,
                )
                .to_rgba8()
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
