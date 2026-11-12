use std::fs::{self, File};
use std::io::{BufReader, Cursor};

use image::{ImageFormat, ImageReader};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExifField {
    tag: String,
    value: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageMeta {
    format: String,
    width: u32,
    height: u32,
    bytes: u64,
    exif: Vec<ExifField>,
}

fn format_label(format: ImageFormat) -> String {
    match format {
        ImageFormat::Jpeg => "JPEG",
        ImageFormat::Png => "PNG",
        ImageFormat::Gif => "GIF",
        _ => "未知",
    }
    .to_string()
}

fn read_exif(path: &str) -> Vec<ExifField> {
    let Ok(file) = File::open(path) else {
        return Vec::new();
    };
    let Ok(exif) = exif::Reader::new().read_from_container(&mut BufReader::new(file)) else {
        return Vec::new();
    };

    exif.fields()
        .map(|field| ExifField {
            tag: field.tag.to_string(),
            value: field.display_value().with_unit(&exif).to_string(),
        })
        .collect()
}

#[tauri::command]
pub fn inspect_image(path: String) -> Result<ImageMeta, String> {
    let data = fs::read(&path).map_err(|error| format!("读取文件失败：{error}"))?;
    let bytes = data.len() as u64;
    let format = image::guess_format(&data).map_err(|_| "无法识别图片格式".to_string())?;
    let (width, height) = ImageReader::with_format(Cursor::new(&data), format)
        .into_dimensions()
        .map_err(|error| format!("读取图片尺寸失败：{error}"))?;

    Ok(ImageMeta {
        format: format_label(format),
        width,
        height,
        bytes,
        exif: read_exif(&path),
    })
}

#[tauri::command]
pub fn strip_metadata(path: String) -> Result<tauri::ipc::Response, String> {
    let data = fs::read(&path).map_err(|error| format!("读取文件失败：{error}"))?;
    let format = image::guess_format(&data).map_err(|_| "无法识别图片格式".to_string())?;

    let cleaned = match format {
        ImageFormat::Jpeg => strip_jpeg(&data)?,
        ImageFormat::Png => strip_png(&data)?,
        _ => return Err("元数据清理目前支持 JPG / PNG".to_string()),
    };

    Ok(tauri::ipc::Response::new(cleaned))
}

/// 重写 JPEG 容器，跳过 APP1（EXIF / XMP）与 COM 段，图像数据原样保留
fn strip_jpeg(data: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() < 4 || data[0] != 0xFF || data[1] != 0xD8 {
        return Err("不是有效的 JPEG 文件".to_string());
    }

    let mut output = Vec::with_capacity(data.len());
    output.extend_from_slice(&data[0..2]);

    let mut index = 2;
    while index + 1 < data.len() {
        if data[index] != 0xFF {
            return Err("JPEG 结构异常".to_string());
        }

        let marker = data[index + 1];
        if marker == 0xFF {
            index += 1;
            continue;
        }

        // 扫描数据开始，后面全部原样保留
        if marker == 0xDA || marker == 0xD9 {
            output.extend_from_slice(&data[index..]);
            return Ok(output);
        }

        // 无长度字段的标记
        if marker == 0x01 || (0xD0..=0xD7).contains(&marker) {
            output.extend_from_slice(&data[index..index + 2]);
            index += 2;
            continue;
        }

        if index + 3 >= data.len() {
            break;
        }
        let length = u16::from_be_bytes([data[index + 2], data[index + 3]]) as usize;
        let end = index + 2 + length;
        if length < 2 || end > data.len() {
            return Err("JPEG 结构异常".to_string());
        }

        let keep = !(marker == 0xE1 || marker == 0xFE);
        if keep {
            output.extend_from_slice(&data[index..end]);
        }
        index = end;
    }

    Err("JPEG 结构异常".to_string())
}

/// 重写 PNG 容器，跳过 eXIf 与文本 / 时间等元数据块
fn strip_png(data: &[u8]) -> Result<Vec<u8>, String> {
    const SIGNATURE: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];

    if data.len() < 8 || data[0..8] != SIGNATURE {
        return Err("不是有效的 PNG 文件".to_string());
    }

    let mut output = Vec::with_capacity(data.len());
    output.extend_from_slice(&SIGNATURE);

    let mut index = 8;
    while index + 8 <= data.len() {
        let length = u32::from_be_bytes([
            data[index],
            data[index + 1],
            data[index + 2],
            data[index + 3],
        ]) as usize;
        let name = std::str::from_utf8(&data[index + 4..index + 8]).unwrap_or("");
        let end = index + 12 + length;
        if end > data.len() {
            return Err("PNG 结构异常".to_string());
        }

        if !matches!(name, "eXIf" | "tEXt" | "zTXt" | "iTXt" | "tIME") {
            output.extend_from_slice(&data[index..end]);
        }

        index = end;
        if name == "IEND" {
            break;
        }
    }

    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};

    fn sample(format: ImageFormat) -> Vec<u8> {
        let image = DynamicImage::ImageRgba8(RgbaImage::from_pixel(8, 8, Rgba([12, 34, 56, 255])));
        let mut buffer = Vec::new();
        image
            .write_to(&mut Cursor::new(&mut buffer), format)
            .unwrap();
        buffer
    }

    #[test]
    fn strips_app1_from_jpeg() {
        let original = sample(ImageFormat::Jpeg);

        let mut marked = vec![0xFF, 0xD8];
        marked.extend_from_slice(&[0xFF, 0xE1, 0x00, 0x10]);
        marked.extend_from_slice(b"Exif\0\0FAKEDATA");
        marked.extend_from_slice(&original[2..]);

        let stripped = strip_jpeg(&marked).unwrap();

        assert!(!stripped.windows(8).any(|window| window == b"FAKEDATA"));
        assert!(stripped.len() < marked.len());
        assert!(image::load_from_memory(&stripped).is_ok());
    }

    #[test]
    fn strips_text_chunks_from_png() {
        let mut png = sample(ImageFormat::Png);
        let iend = png
            .windows(4)
            .rposition(|window| window == b"IEND")
            .unwrap();
        let start = iend - 4;

        let payload = b"toolbox\0demo";
        let mut chunk = Vec::new();
        chunk.extend_from_slice(&(payload.len() as u32).to_be_bytes());
        chunk.extend_from_slice(b"tEXt");
        chunk.extend_from_slice(payload);
        chunk.extend_from_slice(&[0, 0, 0, 0]);
        png.splice(start..start, chunk);

        let stripped = strip_png(&png).unwrap();
        let decoded = image::load_from_memory(&stripped).unwrap();

        assert!(!stripped.windows(4).any(|window| window == b"tEXt"));
        assert_eq!((decoded.width(), decoded.height()), (8, 8));
    }
}
