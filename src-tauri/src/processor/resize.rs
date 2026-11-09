use image::imageops::FilterType;
use image::{DynamicImage, RgbaImage};

use super::ProcessOptions;

pub(super) fn target_size(width: u32, height: u32, options: &ProcessOptions) -> (u32, u32) {
    if width == 0 || height == 0 {
        return (width.max(1), height.max(1));
    }

    let mut target_width = width as f32;
    let mut target_height = height as f32;

    match options.resize_mode.as_str() {
        "percent" => {
            let scale = options.percent.clamp(10.0, 200.0) / 100.0;
            target_width = width as f32 * scale;
            target_height = height as f32 * scale;
        }
        "fixed" => {
            let width = options.width.max(1) as f32;
            let height = options.height.max(1) as f32;
            if options.keep_ratio {
                let scale = (width / target_width).min(height / target_height);
                target_width *= scale;
                target_height *= scale;
            } else {
                target_width = width;
                target_height = height;
            }
        }
        "max" => {
            let limit = options.max_side.max(1) as f32;
            let scale = (limit / target_width.max(target_height)).min(1.0);
            target_width *= scale;
            target_height *= scale;
        }
        _ => {}
    }

    let target_width = target_width.round().clamp(1.0, 8000.0) as u32;
    let target_height = target_height.round().clamp(1.0, 8000.0) as u32;
    (target_width, target_height)
}

pub(super) fn resize_image(image: DynamicImage, width: u32, height: u32) -> DynamicImage {
    if !image.color().has_alpha() {
        return image.resize_exact(width, height, FilterType::Triangle);
    }

    // 透明图先预乘 alpha 再缩放，避免边缘颜色渗入导致线条变细或发黑
    let mut source: RgbaImage = image.to_rgba8();
    for pixel in source.pixels_mut() {
        let alpha = pixel[3] as u16;
        pixel[0] = ((pixel[0] as u16 * alpha) / 255) as u8;
        pixel[1] = ((pixel[1] as u16 * alpha) / 255) as u8;
        pixel[2] = ((pixel[2] as u16 * alpha) / 255) as u8;
    }

    let mut resized = image::imageops::resize(&source, width, height, FilterType::Triangle);
    for pixel in resized.pixels_mut() {
        let alpha = pixel[3];
        if alpha == 0 {
            pixel[0] = 0;
            pixel[1] = 0;
            pixel[2] = 0;
            continue;
        }
        let alpha = alpha as u32;
        pixel[0] = ((pixel[0] as u32 * 255) / alpha).min(255) as u8;
        pixel[1] = ((pixel[1] as u32 * 255) / alpha).min(255) as u8;
        pixel[2] = ((pixel[2] as u32 * 255) / alpha).min(255) as u8;
    }

    DynamicImage::ImageRgba8(resized)
}
