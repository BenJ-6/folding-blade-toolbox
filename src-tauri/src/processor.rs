use std::fs;
use std::io::{BufReader, Cursor};

use image::imageops::FilterType;
use image::{DynamicImage, ImageFormat, ImageReader, Rgb, RgbImage, RgbaImage};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessOptions {
    pub format: String,
    pub quality: u8,
    pub resize_mode: String,
    pub percent: f32,
    pub width: u32,
    pub height: u32,
    pub keep_ratio: bool,
    pub max_side: u32,
}

pub fn process(path: &str, options: &ProcessOptions) -> Result<Vec<u8>, String> {
    let data = fs::read(path).map_err(|error| format!("读取文件失败：{error}"))?;
    let format = image::guess_format(&data).map_err(|_| "无法识别图片格式".to_string())?;
    if !matches!(format, ImageFormat::Jpeg | ImageFormat::Png) {
        return Err("目前仅支持 JPG / PNG".to_string());
    }

    let mut image = ImageReader::with_format(Cursor::new(&data), format)
        .decode()
        .map_err(|error| format!("解码失败：{error}"))?;

    if format == ImageFormat::Jpeg {
        image = apply_orientation(image, read_orientation(path));
    }

    let (width, height) = target_size(image.width(), image.height(), options);
    let resized = (width, height) != (image.width(), image.height());
    if resized {
        image = resize_image(image, width, height);
    }

    let output_format = match options.format.as_str() {
        "jpeg" => ImageFormat::Jpeg,
        "png" => ImageFormat::Png,
        _ => format,
    };

    let encoded = encode(image, output_format, options.quality)?;

    // 同格式且未改变尺寸时，重编码可能变大（尤其是调色板 PNG），保留原文件
    if !resized && output_format == format && encoded.len() > data.len() {
        return Ok(data);
    }

    Ok(encoded)
}

fn target_size(width: u32, height: u32, options: &ProcessOptions) -> (u32, u32) {
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

fn resize_image(image: DynamicImage, width: u32, height: u32) -> DynamicImage {
    if !image.color().has_alpha() {
        return image.resize_exact(width, height, FilterType::Lanczos3);
    }

    // 透明图先预乘 alpha 再缩放，避免边缘颜色渗入导致线条变细或发黑
    let mut source: RgbaImage = image.to_rgba8();
    for pixel in source.pixels_mut() {
        let alpha = pixel[3] as u16;
        pixel[0] = ((pixel[0] as u16 * alpha) / 255) as u8;
        pixel[1] = ((pixel[1] as u16 * alpha) / 255) as u8;
        pixel[2] = ((pixel[2] as u16 * alpha) / 255) as u8;
    }

    let mut resized = image::imageops::resize(&source, width, height, FilterType::Lanczos3);
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

fn encode(image: DynamicImage, format: ImageFormat, quality: u8) -> Result<Vec<u8>, String> {
    let mut buffer = Vec::new();

    match format {
        ImageFormat::Jpeg => {
            let rgb = flatten_on_white(&image);
            let quality = quality.clamp(1, 100);
            let mut encoder = jpeg_encoder::Encoder::new(&mut buffer, quality);
            encoder.set_sampling_factor(jpeg_encoder::SamplingFactor::R_4_4_4);
            encoder
                .encode(
                    rgb.as_raw(),
                    rgb.width() as u16,
                    rgb.height() as u16,
                    jpeg_encoder::ColorType::Rgb,
                )
                .map_err(|error| format!("JPEG 编码失败：{error}"))?;
        }
        ImageFormat::Png => {
            image
                .write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
                .map_err(|error| format!("PNG 编码失败：{error}"))?;
        }
        _ => return Err("不支持的输出格式".to_string()),
    }

    Ok(buffer)
}

fn flatten_on_white(image: &DynamicImage) -> RgbImage {
    let rgba = image.to_rgba8();
    let mut rgb = RgbImage::new(rgba.width(), rgba.height());

    for (x, y, pixel) in rgba.enumerate_pixels() {
        let alpha = pixel[3] as f32 / 255.0;
        let blend = |channel: u8| {
            ((channel as f32 * alpha) + 255.0 * (1.0 - alpha)).round().clamp(0.0, 255.0) as u8
        };
        rgb.put_pixel(x, y, Rgb([blend(pixel[0]), blend(pixel[1]), blend(pixel[2])]));
    }

    rgb
}

fn read_orientation(path: &str) -> u32 {
    let Ok(file) = fs::File::open(path) else {
        return 1;
    };

    let Ok(exif) = exif::Reader::new().read_from_container(&mut BufReader::new(file)) else {
        return 1;
    };

    exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY)
        .and_then(|field| field.value.get_uint(0))
        .unwrap_or(1)
}

fn apply_orientation(image: DynamicImage, orientation: u32) -> DynamicImage {
    match orientation {
        2 => image.fliph(),
        3 => image.rotate180(),
        4 => image.flipv(),
        5 => image.rotate90().fliph(),
        6 => image.rotate90(),
        7 => image.rotate270().fliph(),
        8 => image.rotate270(),
        _ => image,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options(mode: &str) -> ProcessOptions {
        ProcessOptions {
            format: "auto".into(),
            quality: 82,
            resize_mode: mode.into(),
            percent: 50.0,
            width: 800,
            height: 600,
            keep_ratio: true,
            max_side: 1000,
        }
    }

    #[test]
    fn keeps_original_size() {
        assert_eq!(target_size(1600, 1000, &options("original")), (1600, 1000));
    }

    #[test]
    fn scales_by_percent() {
        assert_eq!(target_size(1600, 1000, &options("percent")), (800, 500));
    }

    #[test]
    fn fits_inside_fixed_box() {
        assert_eq!(target_size(1600, 1000, &options("fixed")), (800, 500));
    }

    #[test]
    fn limits_longest_side() {
        assert_eq!(target_size(1600, 1000, &options("max")), (1000, 625));
    }

    #[test]
    fn does_not_upscale_for_max_mode() {
        assert_eq!(target_size(800, 600, &options("max")), (800, 600));
    }

    #[test]
    fn stretches_when_ratio_unlocked() {
        let mut options = options("fixed");
        options.keep_ratio = false;
        assert_eq!(target_size(1600, 1000, &options), (800, 600));
    }

    #[test]
    fn processes_png_file() {
        let directory = std::env::temp_dir();
        let input = directory.join("my-toolbox-test-input.png");
        let output = directory.join("my-toolbox-test-output.png");

        let mut rgba = image::RgbaImage::new(100, 80);
        for (x, y, pixel) in rgba.enumerate_pixels_mut() {
            *pixel = image::Rgba([(x % 256) as u8, (y % 256) as u8, 200, 255]);
        }
        image::DynamicImage::ImageRgba8(rgba).save(&input).unwrap();

        let mut options = options("percent");
        options.format = "png".into();
        options.percent = 50.0;

        let bytes = process(input.to_str().unwrap(), &options).unwrap();
        std::fs::write(&output, &bytes).unwrap();

        let decoded = image::open(&output).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (50, 40));

        let _ = std::fs::remove_file(&input);
        let _ = std::fs::remove_file(&output);
    }

    #[test]
    fn png_encode_is_lossless() {
        let mut rgba = RgbaImage::new(8, 8);
        for (x, y, pixel) in rgba.enumerate_pixels_mut() {
            *pixel = image::Rgba([(x * 30) as u8, (y * 30) as u8, 120, ((x + y) * 16) as u8]);
        }
        let image = DynamicImage::ImageRgba8(rgba);

        let encoded = encode(image.clone(), ImageFormat::Png, 82).unwrap();
        let decoded = image::load_from_memory(&encoded).unwrap().to_rgba8();

        assert_eq!(decoded, image.to_rgba8());
    }
}
