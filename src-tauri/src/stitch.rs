use std::io::Cursor;

use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};
use serde::Deserialize;

use crate::processor;

const MAX_SIDE: u32 = 30_000;
const MAX_PIXELS: u64 = 120_000_000;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StitchOptions {
    /// vertical（纵向长图）/ horizontal（横向长图）/ grid（网格拼图）
    pub direction: String,
    #[serde(default)]
    pub gap: u32,
    #[serde(default = "default_columns")]
    pub columns: u32,
    #[serde(default = "default_background")]
    pub background: String,
}

fn default_columns() -> u32 {
    2
}

fn default_background() -> String {
    "#ffffff".to_string()
}

#[tauri::command]
pub fn stitch_images(
    paths: Vec<String>,
    options: StitchOptions,
) -> Result<tauri::ipc::Response, String> {
    let data = stitch(&paths, &options)?;
    Ok(tauri::ipc::Response::new(data))
}

fn stitch(paths: &[String], options: &StitchOptions) -> Result<Vec<u8>, String> {
    if paths.is_empty() {
        return Err("请先添加图片".to_string());
    }

    let mut images = Vec::with_capacity(paths.len());
    for path in paths {
        images.push(processor::load_for_output(path)?);
    }

    let gap = options.gap.min(200);
    let background = parse_hex_color(&options.background);

    let canvas = match options.direction.as_str() {
        "horizontal" => stitch_horizontal(&images, gap, background)?,
        "grid" => stitch_grid(&images, gap, options.columns.clamp(1, 8), background)?,
        _ => stitch_vertical(&images, gap, background)?,
    };

    encode_png(canvas)
}

fn stitch_vertical(
    images: &[DynamicImage],
    gap: u32,
    background: Rgba<u8>,
) -> Result<RgbaImage, String> {
    let width = images.iter().map(DynamicImage::width).max().unwrap_or(0);
    if width == 0 {
        return Err("图片尺寸无效".to_string());
    }

    let mut resized = Vec::with_capacity(images.len());
    let mut total_height = gap as u64 * (images.len() as u64 - 1);

    for image in images {
        let height = scale_height(image, width);
        resized.push(processor::resize_for_output(image.clone(), width, height));
        total_height += height as u64;
    }

    let (_, canvas_height) = check_size(width as u64, total_height)?;
    let mut canvas = RgbaImage::from_pixel(width, canvas_height, background);
    let mut y = 0i64;

    for image in resized {
        image::imageops::overlay(&mut canvas, &image.to_rgba8(), 0, y);
        y += image.height() as i64 + gap as i64;
    }

    Ok(canvas)
}

fn stitch_horizontal(
    images: &[DynamicImage],
    gap: u32,
    background: Rgba<u8>,
) -> Result<RgbaImage, String> {
    let height = images.iter().map(DynamicImage::height).max().unwrap_or(0);
    if height == 0 {
        return Err("图片尺寸无效".to_string());
    }

    let mut resized = Vec::with_capacity(images.len());
    let mut total_width = gap as u64 * (images.len() as u64 - 1);

    for image in images {
        let width = ((image.width() as f64) * (height as f64) / (image.height() as f64))
            .round()
            .max(1.0) as u32;
        resized.push(processor::resize_for_output(image.clone(), width, height));
        total_width += width as u64;
    }

    let (canvas_width, _) = check_size(total_width, height as u64)?;
    let mut canvas = RgbaImage::from_pixel(canvas_width, height, background);
    let mut x = 0i64;

    for image in resized {
        image::imageops::overlay(&mut canvas, &image.to_rgba8(), x, 0);
        x += image.width() as i64 + gap as i64;
    }

    Ok(canvas)
}

fn stitch_grid(
    images: &[DynamicImage],
    gap: u32,
    columns: u32,
    background: Rgba<u8>,
) -> Result<RgbaImage, String> {
    let columns = columns.max(1) as usize;
    let cell_width = images.iter().map(DynamicImage::width).max().unwrap_or(0);
    let cell_height = images.iter().map(DynamicImage::height).max().unwrap_or(0);
    if cell_width == 0 || cell_height == 0 {
        return Err("图片尺寸无效".to_string());
    }

    let rows = images.len().div_ceil(columns);
    let canvas_width = cell_width as u64 * columns as u64 + gap as u64 * (columns as u64 - 1);
    let canvas_height = cell_height as u64 * rows as u64 + gap as u64 * (rows as u64 - 1);
    let (width, height) = check_size(canvas_width, canvas_height)?;
    let mut canvas = RgbaImage::from_pixel(width, height, background);

    for (index, image) in images.iter().enumerate() {
        let column = index % columns;
        let row = index / columns;
        let scale = (cell_width as f64 / image.width() as f64)
            .min(cell_height as f64 / image.height() as f64);
        let target_width = ((image.width() as f64) * scale).round().max(1.0) as u32;
        let target_height = ((image.height() as f64) * scale).round().max(1.0) as u32;
        let resized = processor::resize_for_output(image.clone(), target_width, target_height);
        let x = (column as u32 * (cell_width + gap) + (cell_width - target_width) / 2) as i64;
        let y = (row as u32 * (cell_height + gap) + (cell_height - target_height) / 2) as i64;
        image::imageops::overlay(&mut canvas, &resized.to_rgba8(), x, y);
    }

    Ok(canvas)
}

fn scale_height(image: &DynamicImage, width: u32) -> u32 {
    ((image.height() as f64) * (width as f64) / (image.width() as f64))
        .round()
        .max(1.0) as u32
}

fn check_size(width: u64, height: u64) -> Result<(u32, u32), String> {
    if width == 0 || height == 0 {
        return Err("图片尺寸无效".to_string());
    }
    if width > MAX_SIDE as u64 || height > MAX_SIDE as u64 || width * height > MAX_PIXELS {
        return Err("拼接结果过大，请减少图片数量或先缩小图片".to_string());
    }
    Ok((width as u32, height as u32))
}

fn encode_png(image: RgbaImage) -> Result<Vec<u8>, String> {
    let mut buffer = Vec::new();
    DynamicImage::ImageRgba8(image)
        .write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
        .map_err(|error| format!("PNG 编码失败：{error}"))?;
    Ok(buffer)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid(width: u32, height: u32, color: [u8; 4]) -> DynamicImage {
        DynamicImage::ImageRgba8(RgbaImage::from_pixel(width, height, Rgba(color)))
    }

    #[test]
    fn vertical_stitch_aligns_width_and_gap() {
        let canvas = stitch_vertical(
            &[
                solid(10, 10, [255, 0, 0, 255]),
                solid(5, 5, [0, 0, 255, 255]),
            ],
            4,
            Rgba([255, 255, 255, 255]),
        )
        .unwrap();

        assert_eq!((canvas.width(), canvas.height()), (10, 24));
        assert_eq!(canvas.get_pixel(0, 12).0, [255, 255, 255, 255]);
        assert_eq!(canvas.get_pixel(2, 16).0, [0, 0, 255, 255]);
    }

    #[test]
    fn grid_stitch_centers_cells() {
        let canvas = stitch_grid(
            &[
                solid(10, 10, [255, 0, 0, 255]),
                solid(4, 8, [0, 255, 0, 255]),
                solid(6, 6, [0, 0, 255, 255]),
            ],
            2,
            2,
            Rgba([255, 255, 255, 255]),
        )
        .unwrap();

        assert_eq!((canvas.width(), canvas.height()), (22, 22));
        assert_eq!(canvas.get_pixel(11, 1).0, [255, 255, 255, 255]);
        assert_eq!(canvas.get_pixel(5, 5).0, [255, 0, 0, 255]);
    }

    #[test]
    fn rejects_oversized_result() {
        let error = check_size(MAX_SIDE as u64 + 1, 10).unwrap_err();
        assert!(error.contains("过大"));
    }
}

fn parse_hex_color(value: &str) -> Rgba<u8> {
    let hex = value.trim().trim_start_matches('#');
    let channel = |text: &str| u8::from_str_radix(text, 16);

    match hex.len() {
        6 => match (
            channel(&hex[0..2]),
            channel(&hex[2..4]),
            channel(&hex[4..6]),
        ) {
            (Ok(r), Ok(g), Ok(b)) => Rgba([r, g, b, 255]),
            _ => Rgba([255, 255, 255, 255]),
        },
        3 => match (
            channel(&hex[0..1]),
            channel(&hex[1..2]),
            channel(&hex[2..3]),
        ) {
            (Ok(r), Ok(g), Ok(b)) => Rgba([r * 17, g * 17, b * 17, 255]),
            _ => Rgba([255, 255, 255, 255]),
        },
        _ => Rgba([255, 255, 255, 255]),
    }
}
