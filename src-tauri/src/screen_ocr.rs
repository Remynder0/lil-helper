use screenshots::Screen;
use std::io::Cursor;
use base64::prelude::*;
use windows::Win32::Foundation::{HWND, RECT};
use windows::Win32::UI::WindowsAndMessaging::{FindWindowW, GetWindowRect};
use windows::core::PCWSTR;

fn find_deadlock_window_bounds() -> Option<(i32, i32, u32, u32)> {
    unsafe {
        // Search for Deadlock game window
        let class_name: Vec<u16> = "SDL_app\0".encode_utf16().collect();
        let title_name: Vec<u16> = "Deadlock\0".encode_utf16().collect();
        
        let mut hwnd = FindWindowW(PCWSTR(class_name.as_ptr()), PCWSTR(title_name.as_ptr())).unwrap_or(HWND(std::ptr::null_mut()));
        if hwnd.0.is_null() {
            // Try searching with NULL class name and title "Deadlock"
            hwnd = FindWindowW(PCWSTR::null(), PCWSTR(title_name.as_ptr())).unwrap_or(HWND(std::ptr::null_mut()));
        }

        if hwnd.0.is_null() {
            return None;
        }

        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_err() {
            return None;
        }

        let width = (rect.right - rect.left) as u32;
        let height = (rect.bottom - rect.top) as u32;

        if width > 0 && height > 0 {
            Some((rect.left, rect.top, width, height))
        } else {
            None
        }
    }
}

/// Captures the Deadlock application window (or primary screen fallback),
/// focusing specifically on the right half (where the escape menu panel sits).
pub fn capture_screen_right_half(capture_right_only: bool) -> Result<String, String> {
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    let primary_screen = screens.into_iter().next().ok_or_else(|| "No screens found".to_string())?;

    // Try finding the exact Deadlock window coordinates
    if let Some((win_x, win_y, win_w, win_h)) = find_deadlock_window_bounds() {
        // Crop right 45% of Deadlock application window
        let (crop_x, crop_w) = if capture_right_only && win_w > 100 {
            let cw = (win_w as f32 * 0.45) as u32;
            (win_x + (win_w - cw) as i32, cw)
        } else {
            (win_x, win_w)
        };

        if let Ok(img) = primary_screen.capture_area(crop_x, win_y, crop_w, win_h) {
            let dyn_img = image::DynamicImage::ImageRgba8(img);
            let mut buffer = Cursor::new(Vec::new());
            dyn_img
                .write_to(&mut buffer, image::ImageFormat::Png)
                .map_err(|e| format!("PNG encoding failed: {}", e))?;
            let base64_png = BASE64_STANDARD.encode(buffer.into_inner());
            return Ok(format!("data:image/png;base64,{}", base64_png));
        }
    }

    // Fallback: Full screen right 45%
    let full_image = primary_screen.capture().map_err(|e| format!("Capture failed: {}", e))?;
    let width = full_image.width();
    let height = full_image.height();

    let cropped_image = if capture_right_only && width > 100 {
        let crop_width = (width as f32 * 0.45) as u32;
        let crop_x = width - crop_width;
        let dyn_img = image::DynamicImage::ImageRgba8(full_image);
        dyn_img.crop_imm(crop_x, 0, crop_width, height)
    } else {
        image::DynamicImage::ImageRgba8(full_image)
    };

    let mut buffer = Cursor::new(Vec::new());
    cropped_image
        .write_to(&mut buffer, image::ImageFormat::Png)
        .map_err(|e| format!("PNG encoding failed: {}", e))?;

    let base64_png = BASE64_STANDARD.encode(buffer.into_inner());
    Ok(format!("data:image/png;base64,{}", base64_png))
}
