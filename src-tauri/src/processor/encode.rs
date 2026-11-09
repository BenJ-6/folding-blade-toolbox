use std::io::Cursor;

use image::{DynamicImage, ImageFormat, Rgb, RgbImage};

pub(super) fn encode_png_lossy(image: &DynamicImage, colors: u32) -> Result<Vec<u8>, String> {
    let rgba = image.to_rgba8();
    let width = rgba.width() as usize;
    let height = rgba.height() as usize;
    let pixels: Vec<imagequant::RGBA> = rgba
        .pixels()
        .map(|pixel| imagequant::RGBA::new(pixel[0], pixel[1], pixel[2], pixel[3]))
        .collect();

    let mut attributes = imagequant::Attributes::new();
    attributes
        .set_max_colors(colors.clamp(2, 256))
        .map_err(|error| format!("PNG 颜色量化失败：{error}"))?;
    attributes
        .set_speed(4)
        .map_err(|error| format!("PNG 颜色量化失败：{error}"))?;

    let mut source = attributes
        .new_image(pixels, width, height, 0.0)
        .map_err(|error| format!("PNG 颜色量化失败：{error}"))?;
    let mut result = attributes
        .quantize(&mut source)
        .map_err(|error| format!("PNG 颜色量化失败：{error}"))?;
    result
        .set_dithering_level(1.0)
        .map_err(|error| format!("PNG 颜色量化失败：{error}"))?;

    let (palette, indices) = result
        .remapped(&mut source)
        .map_err(|error| format!("PNG 颜色量化失败：{error}"))?;

    let mut palette_rgb = Vec::with_capacity(palette.len() * 3);
    let mut palette_alpha = Vec::with_capacity(palette.len());
    for color in &palette {
        palette_rgb.extend_from_slice(&[color.r, color.g, color.b]);
        palette_alpha.push(color.a);
    }

    let mut buffer = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut buffer, width as u32, height as u32);
        encoder.set_color(png::ColorType::Indexed);
        encoder.set_depth(png::BitDepth::Eight);
        encoder.set_palette(palette_rgb);
        encoder.set_trns(palette_alpha);

        let mut writer = encoder
            .write_header()
            .map_err(|error| format!("PNG 编码失败：{error}"))?;
        writer
            .write_image_data(&indices)
            .map_err(|error| format!("PNG 编码失败：{error}"))?;
    }

    Ok(buffer)
}

pub(super) fn optimize_png(data: Vec<u8>) -> Vec<u8> {
    let options = oxipng::Options::from_preset(2);
    oxipng::optimize_from_memory(&data, &options).unwrap_or(data)
}

pub(super) fn encode(
    image: DynamicImage,
    format: ImageFormat,
    quality: u8,
    background: &str,
) -> Result<Vec<u8>, String> {
    let mut buffer = Vec::new();

    match format {
        ImageFormat::Jpeg => {
            let rgb = flatten_on_background(&image, parse_hex_color(background));
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

/// 支持 `#rgb` / `#rrggbb`，解析失败时回退为白色
fn parse_hex_color(value: &str) -> Rgb<u8> {
    let hex = value.trim().trim_start_matches('#');
    let channel = |text: &str| u8::from_str_radix(text, 16);

    match hex.len() {
        6 => match (
            channel(&hex[0..2]),
            channel(&hex[2..4]),
            channel(&hex[4..6]),
        ) {
            (Ok(r), Ok(g), Ok(b)) => Rgb([r, g, b]),
            _ => Rgb([255, 255, 255]),
        },
        3 => match (
            channel(&hex[0..1]),
            channel(&hex[1..2]),
            channel(&hex[2..3]),
        ) {
            (Ok(r), Ok(g), Ok(b)) => Rgb([r * 17, g * 17, b * 17]),
            _ => Rgb([255, 255, 255]),
        },
        _ => Rgb([255, 255, 255]),
    }
}

fn flatten_on_background(image: &DynamicImage, background: Rgb<u8>) -> RgbImage {
    let rgba = image.to_rgba8();
    let mut rgb = RgbImage::new(rgba.width(), rgba.height());

    for (x, y, pixel) in rgba.enumerate_pixels() {
        let alpha = pixel[3] as f32 / 255.0;
        let blend = |channel: u8, base: u8| {
            ((channel as f32 * alpha) + base as f32 * (1.0 - alpha))
                .round()
                .clamp(0.0, 255.0) as u8
        };
        rgb.put_pixel(
            x,
            y,
            Rgb([
                blend(pixel[0], background[0]),
                blend(pixel[1], background[1]),
                blend(pixel[2], background[2]),
            ]),
        );
    }

    rgb
}
