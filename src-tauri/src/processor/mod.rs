mod encode;
mod exif;
mod gif;
mod resize;
mod svg;

#[cfg(test)]
mod tests;

use std::fs;
use std::io::Cursor;

use image::{ImageFormat, ImageReader};
use serde::Deserialize;

use self::encode::{encode, encode_png_lossy, optimize_png};
use self::exif::{apply_orientation, read_orientation};
use self::gif::process_gif;
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
}

fn default_png_colors() -> u32 {
    128
}

fn default_fixed_side() -> String {
    "width".to_string()
}

pub fn process(path: &str, options: &ProcessOptions) -> Result<Vec<u8>, String> {
    let data = fs::read(path).map_err(|error| format!("读取文件失败：{error}"))?;

    if is_svg(path, &data) {
        return process_svg(&data);
    }

    let format = image::guess_format(&data).map_err(|_| "无法识别图片格式".to_string())?;
    if format == ImageFormat::Gif {
        return process_gif(&data, options);
    }
    if !matches!(format, ImageFormat::Jpeg | ImageFormat::Png) {
        return Err("目前仅支持 JPG / PNG / SVG / GIF".to_string());
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
        image = if options.resize_mode == "crop" {
            resize_crop(image, width, height)
        } else {
            resize_image(image, width, height)
        };
    }

    let output_format = format;

    // PNG 有损量化：减少颜色数，显著压缩体积
    if output_format == ImageFormat::Png && options.png_lossy {
        let encoded = encode_png_lossy(&image, options.png_colors)?;
        return Ok(optimize_png(encoded));
    }

    // 同格式且未改变尺寸：PNG 直接做无损优化，JPEG 重编码变大时保留原图
    if !resized && output_format == format {
        if format == ImageFormat::Png {
            return Ok(optimize_png(data));
        }

        let encoded = encode(image, output_format, options.quality)?;
        if encoded.len() > data.len() {
            return Ok(data);
        }
        return Ok(encoded);
    }

    let encoded = encode(image, output_format, options.quality)?;
    if output_format == ImageFormat::Png {
        return Ok(optimize_png(encoded));
    }

    Ok(encoded)
}
