use std::io::Cursor;

use image::codecs::gif::{GifDecoder, GifEncoder};
use image::{AnimationDecoder, DynamicImage, Frame, ImageFormat, Rgb, RgbImage, RgbaImage};

use super::encode::{encode, encode_png_lossy};
use super::gif::process_gif;
use super::resize::{resize_crop, resize_image, target_size};
use super::svg::process_svg;
use super::{ProcessOptions, process};

fn options(mode: &str) -> ProcessOptions {
    ProcessOptions {
        quality: 82,
        resize_mode: mode.into(),
        percent: 50.0,
        width: 800,
        height: 600,
        keep_ratio: true,
        fixed_side: "width".into(),
        max_side: 1000,
        png_lossy: false,
        png_colors: 128,
        target_format: String::new(),
        background: "#ffffff".into(),
        raster_scale: 2.0,
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
fn fixed_height_drives_scaled_width() {
    let mut options = options("fixed");
    options.fixed_side = "height".into();
    assert_eq!(target_size(1600, 1000, &options), (960, 600));
}

#[test]
fn stretches_when_ratio_unlocked() {
    let mut options = options("fixed");
    options.keep_ratio = false;
    assert_eq!(target_size(1600, 1000, &options), (800, 600));
}

#[test]
fn crop_uses_exact_target_size() {
    let mut options = options("crop");
    options.width = 400;
    options.height = 400;
    assert_eq!(target_size(1600, 1000, &options), (400, 400));
}

#[test]
fn crop_fills_target_without_stretching() {
    let source = DynamicImage::ImageRgba8(RgbaImage::from_pixel(
        100,
        50,
        image::Rgba([10, 20, 30, 255]),
    ));
    let cropped = resize_crop(source, 40, 40);

    assert_eq!((cropped.width(), cropped.height()), (40, 40));
}

#[test]
fn processes_png_file() {
    let directory = std::env::temp_dir();
    let input = directory.join("folding-blade-toolbox-test-input.png");
    let output = directory.join("folding-blade-toolbox-test-output.png");

    let mut rgba = image::RgbaImage::new(100, 80);
    for (x, y, pixel) in rgba.enumerate_pixels_mut() {
        *pixel = image::Rgba([(x % 256) as u8, (y % 256) as u8, 200, 255]);
    }
    image::DynamicImage::ImageRgba8(rgba).save(&input).unwrap();

    let mut options = options("percent");
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

    let encoded = encode(image.clone(), ImageFormat::Png, 82, "#ffffff").unwrap();
    let decoded = image::load_from_memory(&encoded).unwrap().to_rgba8();

    assert_eq!(decoded, image.to_rgba8());
}

#[test]
fn lossy_png_keeps_dimensions_and_limits_colors() {
    use std::collections::HashSet;

    let mut rgba = RgbaImage::new(16, 16);
    for (x, y, pixel) in rgba.enumerate_pixels_mut() {
        *pixel = image::Rgba([(x * 15) as u8, (y * 15) as u8, 100, 255]);
    }
    let image = DynamicImage::ImageRgba8(rgba);

    let encoded = encode_png_lossy(&image, 16).unwrap();
    let decoded = image::load_from_memory(&encoded).unwrap().to_rgba8();

    assert_eq!(decoded.dimensions(), (16, 16));
    let colors: HashSet<[u8; 4]> = decoded.pixels().map(|pixel| pixel.0).collect();
    assert!(colors.len() <= 16, "颜色数超出限制：{}", colors.len());
}

fn line_image(size: u32, line_width: u32) -> DynamicImage {
    let mut image = RgbaImage::new(size, size);
    let start = (size - line_width) / 2;
    for (x, _, pixel) in image.enumerate_pixels_mut() {
        let inside = x >= start && x < start + line_width;
        *pixel = if inside {
            image::Rgba([0, 0, 0, 255])
        } else {
            image::Rgba([0, 0, 0, 0])
        };
    }
    DynamicImage::ImageRgba8(image)
}

fn white_line_image(size: u32, line_width: u32) -> DynamicImage {
    let mut image = RgbImage::from_pixel(size, size, Rgb([255, 255, 255]));
    let start = (size - line_width) / 2;
    for (x, _, pixel) in image.enumerate_pixels_mut() {
        if x >= start && x < start + line_width {
            *pixel = Rgb([0, 0, 0]);
        }
    }
    DynamicImage::ImageRgb8(image)
}

fn alpha_width(image: &DynamicImage) -> f32 {
    let rgba = image.to_rgba8();
    let row = rgba.height() / 2;
    let sum: u32 = (0..rgba.width())
        .map(|x| rgba.get_pixel(x, row)[3] as u32)
        .sum();
    sum as f32 / 255.0
}

fn ink_width(image: &DynamicImage) -> f32 {
    let rgb = image.to_rgb8();
    let row = rgb.height() / 2;
    let sum: u32 = (0..rgb.width())
        .map(|x| 255 - rgb.get_pixel(x, row)[0] as u32)
        .sum();
    sum as f32 / 255.0
}

#[test]
fn maintains_line_width_after_resize() {
    for line_width in [1u32, 2, 3, 5] {
        for scale in [0.75f32, 0.5, 0.33, 0.25, 2.0] {
            let source = line_image(64, line_width);
            let target = (64.0 * scale).round() as u32;
            let expected = line_width as f32 * (target as f32 / 64.0);

            let resized = resize_image(source, target, target);
            let measured = alpha_width(&resized);

            assert!(
                (measured - expected).abs() < 0.1,
                "line={line_width} scale={scale} expected={expected:.2} measured={measured:.2}"
            );
        }
    }
}

#[test]
fn jpeg_keeps_line_width() {
    for quality in [60u8, 82, 95] {
        let source = white_line_image(128, 2);
        let encoded = encode(source, ImageFormat::Jpeg, quality, "#ffffff").unwrap();
        let decoded = image::load_from_memory(&encoded).unwrap();
        let measured = ink_width(&decoded);

        assert!(
            (measured - 2.0).abs() < 0.1,
            "quality={quality} measured={measured:.2}"
        );
    }
}

#[test]
fn minifies_svg() {
    let svg = "<?xml version=\"1.0\"?>\n<!-- generator -->\n<svg xmlns=\"http://www.w3.org/2000/svg\">\n  <metadata>big</metadata>\n  <rect width=\"10\" height=\"10\" />\n</svg>\n";
    let output = process_svg(svg.as_bytes()).unwrap();
    let minified = String::from_utf8(output).unwrap();

    assert!(minified.len() < svg.len());
    assert!(!minified.contains("generator"));
    assert!(!minified.contains("<metadata"));
    assert!(minified.starts_with("<svg"));
}

#[test]
fn keeps_original_svg_when_already_small() {
    let svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><rect/></svg>";
    let output = process_svg(svg.as_bytes()).unwrap();

    assert_eq!(output, svg.as_bytes());
}

#[test]
fn resizes_animated_gif() {
    let mut source = Vec::new();
    {
        let mut encoder = GifEncoder::new(&mut source);
        for color in [255u8, 0] {
            let frame = RgbaImage::from_pixel(40, 30, image::Rgba([color, 0, 0, 255]));
            let delay = image::Delay::from_numer_denom_ms(100, 1);
            encoder
                .encode_frame(Frame::from_parts(frame, 0, 0, delay))
                .unwrap();
        }
    }

    let mut options = options("percent");
    options.percent = 50.0;

    let output = process_gif(&source, &options).unwrap();
    let frames = GifDecoder::new(Cursor::new(&output))
        .unwrap()
        .into_frames()
        .collect_frames()
        .unwrap();

    assert_eq!(frames.len(), 2);
    assert_eq!(
        (frames[0].buffer().width(), frames[0].buffer().height()),
        (20, 15)
    );
}

#[test]
fn converts_png_to_jpeg_with_background() {
    let directory = std::env::temp_dir();
    let input = directory.join("folding-blade-toolbox-convert-alpha.png");

    let rgba = RgbaImage::from_pixel(20, 20, image::Rgba([255, 0, 0, 0]));
    DynamicImage::ImageRgba8(rgba)
        .save(&input)
        .expect("写入测试图片失败");

    let mut options = options("original");
    options.target_format = "jpeg".into();
    options.background = "#00ff00".into();

    let bytes = process(input.to_str().unwrap(), &options).unwrap();
    let decoded = image::load_from_memory(&bytes).unwrap().to_rgb8();
    let pixel = decoded.get_pixel(10, 10);

    let near = |value: u8, expected: u8| (value as i16 - expected as i16).abs() <= 6;
    assert!(near(pixel[1], 255), "绿色底色未铺上：{pixel:?}");
    assert!(near(pixel[0], 0), "红色分量残留：{pixel:?}");
    assert!(near(pixel[2], 0), "蓝色分量残留：{pixel:?}");

    let _ = std::fs::remove_file(&input);
}

#[test]
fn converts_png_to_png_when_requested() {
    let directory = std::env::temp_dir();
    let input = directory.join("folding-blade-toolbox-convert-same.png");
    let output = directory.join("folding-blade-toolbox-convert-same-out.png");

    let rgba = RgbaImage::from_pixel(12, 10, image::Rgba([10, 20, 30, 128]));
    DynamicImage::ImageRgba8(rgba)
        .save(&input)
        .expect("写入测试图片失败");

    let mut options = options("original");
    options.target_format = "png".into();

    let bytes = process(input.to_str().unwrap(), &options).unwrap();
    std::fs::write(&output, &bytes).unwrap();

    let decoded = image::open(&output).unwrap();
    assert_eq!((decoded.width(), decoded.height()), (12, 10));
    assert_eq!(decoded.to_rgba8().get_pixel(0, 0)[3], 128);

    let _ = std::fs::remove_file(&input);
    let _ = std::fs::remove_file(&output);
}

#[test]
fn rasterizes_svg_to_png() {
    let directory = std::env::temp_dir();
    let input = directory.join("folding-blade-toolbox-convert.svg");

    let svg = r##"<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20"><rect width="10" height="20" fill="#ff0000"/></svg>"##;
    std::fs::write(&input, svg).unwrap();

    let mut options = options("original");
    options.target_format = "png".into();
    options.raster_scale = 2.0;

    let bytes = process(input.to_str().unwrap(), &options).unwrap();
    let decoded = image::load_from_memory(&bytes).unwrap();

    assert_eq!((decoded.width(), decoded.height()), (20, 40));
    let pixel = decoded.to_rgba8().get_pixel(10, 20).0;
    assert!(
        pixel[0] > 200 && pixel[1] < 40,
        "SVG 填充色不正确：{pixel:?}"
    );

    let _ = std::fs::remove_file(&input);
}

#[test]
fn keeps_svg_when_target_is_source() {
    let directory = std::env::temp_dir();
    let input = directory.join("folding-blade-toolbox-convert-keep.svg");

    let svg = "<?xml version=\"1.0\"?>\n<!-- note -->\n<svg xmlns=\"http://www.w3.org/2000/svg\">\n  <rect width=\"10\" height=\"10\" />\n</svg>\n";
    std::fs::write(&input, svg).unwrap();

    let options = options("original");
    let bytes = process(input.to_str().unwrap(), &options).unwrap();
    let text = String::from_utf8(bytes).unwrap();

    assert!(text.starts_with("<svg"));
    assert!(!text.contains("note"));

    let _ = std::fs::remove_file(&input);
}

#[test]
fn converts_gif_to_png_first_frame() {
    let directory = std::env::temp_dir();
    let input = directory.join("folding-blade-toolbox-convert.gif");

    let mut source = Vec::new();
    {
        let mut encoder = GifEncoder::new(&mut source);
        for color in [255u8, 0] {
            let frame = RgbaImage::from_pixel(40, 30, image::Rgba([color, 0, 0, 255]));
            let delay = image::Delay::from_numer_denom_ms(100, 1);
            encoder
                .encode_frame(Frame::from_parts(frame, 0, 0, delay))
                .unwrap();
        }
    }
    std::fs::write(&input, &source).unwrap();

    let mut options = options("original");
    options.target_format = "png".into();

    let bytes = process(input.to_str().unwrap(), &options).unwrap();
    let decoded = image::load_from_memory(&bytes).unwrap();

    assert_eq!((decoded.width(), decoded.height()), (40, 30));

    let _ = std::fs::remove_file(&input);
}
