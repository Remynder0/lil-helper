use screenshots::Screen;
use std::io::Cursor;
use base64::prelude::*;
use windows::Win32::Foundation::{HWND, RECT};
use windows::Win32::UI::WindowsAndMessaging::{FindWindowW, GetWindowRect, IsWindowVisible};
use windows::core::PCWSTR;
use image::{imageops, DynamicImage};

pub(crate) fn find_deadlock_window_bounds() -> Option<(i32, i32, u32, u32)> {
    unsafe {
        let title_candidates = [
            "Deadlock\0",
            "Project8\0",
            "Citadel\0",
        ];

        let class_candidates = [
            "SDL_app\0",
            "Valve001\0",
        ];

        let mut found_hwnd: Option<HWND> = None;

        for &c_name in &class_candidates {
            for &t_name in &title_candidates {
                let c_utf16: Vec<u16> = c_name.encode_utf16().collect();
                let t_utf16: Vec<u16> = t_name.encode_utf16().collect();
                if let Ok(hwnd) = FindWindowW(PCWSTR(c_utf16.as_ptr()), PCWSTR(t_utf16.as_ptr())) {
                    if !hwnd.0.is_null() && IsWindowVisible(hwnd).as_bool() {
                        found_hwnd = Some(hwnd);
                        break;
                    }
                }
            }
            if found_hwnd.is_some() {
                break;
            }
        }

        if found_hwnd.is_none() {
            for &t_name in &title_candidates {
                let t_utf16: Vec<u16> = t_name.encode_utf16().collect();
                if let Ok(hwnd) = FindWindowW(PCWSTR::null(), PCWSTR(t_utf16.as_ptr())) {
                    if !hwnd.0.is_null() && IsWindowVisible(hwnd).as_bool() {
                        found_hwnd = Some(hwnd);
                        break;
                    }
                }
            }
        }

        let hwnd = found_hwnd?;
        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_err() {
            return None;
        }

        let width = (rect.right - rect.left) as u32;
        let height = (rect.bottom - rect.top) as u32;

        if width > 200 && height > 200 {
            Some((rect.left, rect.top, width, height))
        } else {
            None
        }
    }
}

/// Enhances image contrast and resolution for accurate Tesseract OCR.
fn preprocess_image_for_ocr(img: DynamicImage) -> DynamicImage {
    // 1. Convert to grayscale
    let mut gray = img.into_luma8();

    // 2. Deadlock text contrast thresholding
    // Text in Deadlock is light grey/white (luma > 95) on dark textured background (luma < 60)
    for pixel in gray.pixels_mut() {
        if pixel.0[0] > 95 {
            pixel.0[0] = 0; // Black text for Tesseract
        } else {
            pixel.0[0] = 255; // White background
        }
    }

    // 3. 2x Bilinear upscale for sharp letter contours
    let upscaled = imageops::resize(
        &gray,
        gray.width() * 2,
        gray.height() * 2,
        imageops::FilterType::Triangle,
    );

    DynamicImage::ImageLuma8(upscaled)
}

/// Captures the rightmost section of Deadlock (or primary display),
/// specifically targeting the right 30% where the Escape menu is drawn.
pub fn capture_screen_right_half(capture_right_only: bool) -> Result<String, String> {
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    let primary_screen = screens.into_iter().next().ok_or_else(|| "No screens found".to_string())?;

    // The Deadlock escape menu panel occupies roughly the right 30% of the game window/screen
    let crop_ratio = if capture_right_only { 0.30 } else { 1.0 };

    let raw_captured = if let Some((win_x, win_y, win_w, win_h)) = find_deadlock_window_bounds() {
        let (crop_x, crop_w) = if capture_right_only && win_w > 100 {
            let cw = (win_w as f32 * crop_ratio) as u32;
            (win_x + (win_w - cw) as i32, cw)
        } else {
            (win_x, win_w)
        };

        if let Ok(img) = primary_screen.capture_area(crop_x, win_y, crop_w, win_h) {
            Some(image::DynamicImage::ImageRgba8(img))
        } else {
            None
        }
    } else {
        None
    };

    let base_image = match raw_captured {
        Some(img) => img,
        None => {
            // Fallback to screen capture
            let full_image = primary_screen.capture().map_err(|e| format!("Capture failed: {}", e))?;
            let width = full_image.width();
            let height = full_image.height();

            if capture_right_only && width > 100 {
                let crop_width = (width as f32 * crop_ratio) as u32;
                let crop_x = width - crop_width;
                let dyn_img = image::DynamicImage::ImageRgba8(full_image);
                dyn_img.crop_imm(crop_x, 0, crop_width, height)
            } else {
                image::DynamicImage::ImageRgba8(full_image)
            }
        }
    };

    // Preprocess image for OCR (sharp thresholding + 2x upscale)
    let processed_image = preprocess_image_for_ocr(base_image);

    let mut buffer = Cursor::new(Vec::new());
    processed_image
        .write_to(&mut buffer, image::ImageFormat::Png)
        .map_err(|e| format!("PNG encoding failed: {}", e))?;

    let base64_png = BASE64_STANDARD.encode(buffer.into_inner());
    Ok(format!("data:image/png;base64,{}", base64_png))
}
