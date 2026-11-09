mod encode;
mod exif;
mod gif;
mod raster;
mod resize;
mod svg;

#[cfg(test)]
mod tests;

use std::fs;
use std::io::Cursor;

use image::{DynamicImage, ImageFormat, ImageReader};
use serde::Deserialize;

use self::encode::{encode, encode_png_lossy, optimize_png};
use self::exif::{apply_orientation, read_orientation};
use self::gif::{first_frame, process_gif};
use self::raster::rasterize_svg;
use self::resize::{resize_crop, resize_image, target_size};
use self::svg::{is_svg, process_svg};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessOptions {
    pub quality: u8,
    pub resize_mode: String,
    pub percent: f32,
    pub width: u32,
    pub height: u32,
    pub keep_ratio: bool,
    #[serde(default = "default_fixed_side")]
    pub fixed_side: String,
    pub max_side: u32,
    #[serde(default)]
    pub png_lossy: bool,
    #[serde(default = "default_png_colors")]
    pub png_colors: u32,
    /// 空值或 "source" 表示沿用源图格式
    #[serde(default)]
    pub target_format: String,
    #[serde(default = "default_background")]
    pub background: String,
    #[serde(default = "default_raster_scale")]
    pub raster_scale: f32,
}

fn default_png_colors() -> u32 {
    128
}

fn default_fixed_side() -> String {
    "width".to_string()
}

fn default_background() -> String {
    "#ffffff".to_string()
}

fn default_raster_scale() -> f32 {
    2.0
}

fn parse_output_format(target: &str, source: ImageFormat) -> Result<ImageFormat, String> {
    match target.trim().to_ascii_lowercase().as_str() {
        "" | "source" => Ok(source),
        "jpeg" | "jpg" => Ok(ImageFormat::Jpeg),
        "png" => Ok(ImageFormat::Png),
        other => Err(format!("暂不支持输出为 {other}")),
    }
}

pub fn process(path: &str, options: &ProcessOptions) -> Result<Vec<u8>, String> {
    let data = fs::read(path).map_err(|error| format!("读取文件失败：{error}"))?;

    if is_svg(path, &data) {
        return process_svg_input(&data, options);
    }

    let format = image::guess_format(&data).map_err(|_| "无法识别图片格式".to_string())?;
    if format == ImageFormat::Gif {
        return process_gif_input(&data, options);
    }
    if !matches!(format, ImageFormat::Jpeg | ImageFormat::Png) {
        return Err("目前仅支持 JPG / PNG / SVG / GIF".to_string());
    }

    let output_format = parse_output_format(&options.target_format, format)?;
    let format_changed = output_format != format;

    let mut image = ImageReader::with_format(Cursor::new(&data), format)
        .decode()
        .map_err(|error| format!("解码失败：{error}"))?;

    if format == ImageFormat::Jpeg {
        image = apply_orientation(image, read_orientation(path));
    }

    let (width, height) = target_size(image.width(), image.height(), options);
    let resized = (width, height) != (image.width(), image.height());
    if resized {
        image = if options.resize_mode == "crop" {
            resize_crop(image, width, height)
        } else {
            resize_image(image, width, height)
        };
    }

    // 只有同格式且未改尺寸时才可能在编码后体积变大，此时保留原文件
    let original = (!format_changed && !resized).then_some(data.as_slice());
    finish(image, output_format, options, original)
}

fn process_svg_input(data: &[u8], options: &ProcessOptions) -> Result<Vec<u8>, String> {
    let target = options.target_format.trim().to_ascii_lowercase();

    if target.is_empty() || target == "source" || target == "svg" {
        return process_svg(data);
    }

    let output_format = parse_output_format(&target, ImageFormat::Png)?;
    let image = rasterize_svg(data, options.raster_scale)?;
    let image = fit_to_size(image, options);
    finish(image, output_format, options, None)
}

fn process_gif_input(data: &[u8], options: &ProcessOptions) -> Result<Vec<u8>, String> {
    let target = options.target_format.trim().to_ascii_lowercase();

    if target.is_empty() || target == "source" || target == "gif" {
        return process_gif(data, options);
    }

    let output_format = parse_output_format(&target, ImageFormat::Png)?;
    let image = fit_to_size(first_frame(data)?, options);
    finish(image, output_format, options, None)
}

fn fit_to_size(image: DynamicImage, options: &ProcessOptions) -> DynamicImage {
    let (width, height) = target_size(image.width(), image.height(), options);
    if (width, height) == (image.width(), image.height()) {
        return image;
    }
    if options.resize_mode == "crop" {
        resize_crop(image, width, height)
    } else {
        resize_image(image, width, height)
    }
}

fn finish(
    image: DynamicImage,
    output_format: ImageFormat,
    options: &ProcessOptions,
    original: Option<&[u8]>,
) -> Result<Vec<u8>, String> {
    // PNG 有损量化：减少颜色数，显著压缩体积
    if output_format == ImageFormat::Png && options.png_lossy {
        let encoded = encode_png_lossy(&image, options.png_colors)?;
        return Ok(optimize_png(encoded));
    }

    if let Some(original) = original {
        if output_format == ImageFormat::Png {
            return Ok(optimize_png(original.to_vec()));
        }

        let encoded = encode(image, output_format, options.quality, &options.background)?;
        if encoded.len() > original.len() {
            return Ok(original.to_vec());
        }
        return Ok(encoded);
    }

    let encoded = encode(image, output_format, options.quality, &options.background)?;
    if output_format == ImageFormat::Png {
        return Ok(optimize_png(encoded));
    }

    Ok(encoded)
}
