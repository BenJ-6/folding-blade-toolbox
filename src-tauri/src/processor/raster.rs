use image::DynamicImage;
use resvg::tiny_skia::{Pixmap, Transform};
use resvg::usvg;

/// 将 SVG 按倍数栅格化为位图，文字依赖系统字体
pub(super) fn rasterize_svg(data: &[u8], scale: f32) -> Result<DynamicImage, String> {
    let mut options = usvg::Options::default();
    options.fontdb_mut().load_system_fonts();

    let tree =
        usvg::Tree::from_data(data, &options).map_err(|error| format!("SVG 解析失败：{error}"))?;

    let size = tree.size();
    let scale = scale.clamp(0.5, 8.0);
    let width = (size.width() * scale).round().max(1.0) as u32;
    let height = (size.height() * scale).round().max(1.0) as u32;

    let mut pixmap = Pixmap::new(width, height).ok_or_else(|| "SVG 目标尺寸过大".to_string())?;
    resvg::render(
        &tree,
        Transform::from_scale(scale, scale),
        &mut pixmap.as_mut(),
    );

    let image = image::RgbaImage::from_raw(width, height, pixmap.take())
        .ok_or_else(|| "SVG 栅格化失败".to_string())?;
    Ok(DynamicImage::ImageRgba8(image))
}
