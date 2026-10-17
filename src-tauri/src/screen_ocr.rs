use screenshots::Screen;
use std::io::Cursor;
use base64::prelude::*;
use windows::Win32::Foundation::{HWND, RECT};
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, FindWindowExW, FindWindowW, GetClassNameW, GetForegroundWindow,
    GetWindowRect, GetWindowTextW, IsIconic,
    SetForegroundWindow, ShowWindow, SW_RESTORE, SW_SHOW,
};
use windows::core::{w, PCWSTR};
use image::{imageops, DynamicImage};

#[derive(Debug, Clone, Copy)]
pub(crate) struct DeadlockWindow {
    pub hwnd: HWND,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Helper that inspects a candidate HWND.
/// If `restore_if_minimized` is true and the window is minimized, restores it.
unsafe fn inspect_candidate_hwnd(hwnd: HWND, restore_if_minimized: bool) -> Option<DeadlockWindow> {
    if hwnd.0.is_null() {
        return None;
    }

    let is_minimized = IsIconic(hwnd).as_bool();
    if is_minimized {
        if restore_if_minimized {
            let _ = ShowWindow(hwnd, SW_RESTORE);
            std::thread::sleep(std::time::Duration::from_millis(150));
        } else {
            // When checking if running, iconic window still counts!
            return Some(DeadlockWindow {
                hwnd,
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
            });
        }
    }

    let mut rect = RECT::default();
    if GetWindowRect(hwnd, &mut rect).is_err() {
        return None;
    }

    let width = (rect.right - rect.left) as u32;
    let height = (rect.bottom - rect.top) as u32;

    if width > 300 && height > 200 {
        Some(DeadlockWindow {
            hwnd,
            x: rect.left,
            y: rect.top,
            width,
            height,
        })
    } else {
        None
    }
}

pub(crate) fn find_deadlock_window(restore_if_minimized: bool) -> Option<DeadlockWindow> {
    unsafe {
        // Priority 1: Exact matches via FindWindowW
        let candidates: [(Option<PCWSTR>, Option<PCWSTR>); 5] = [
            (Some(w!("SDL_app")), Some(w!("Deadlock"))),
            (None, Some(w!("Deadlock"))),
            (Some(w!("Valve001")), Some(w!("Deadlock"))),
            (None, Some(w!("Citadel"))),
            (None, Some(w!("Project8"))),
        ];

        for (cls, title) in candidates {
            let cls_ptr = cls.unwrap_or(PCWSTR::null());
            let title_ptr = title.unwrap_or(PCWSTR::null());
            if let Ok(hwnd) = FindWindowW(cls_ptr, title_ptr) {
                if let Some(win) = inspect_candidate_hwnd(hwnd, restore_if_minimized) {
                    return Some(win);
                }
            }
        }

        // Priority 2: Traverse top-level windows via FindWindowExW
        let mut curr = HWND::default();
        loop {
            let child_after = if curr.0.is_null() { None } else { Some(curr) };
            match FindWindowExW(None, child_after, PCWSTR::null(), PCWSTR::null()) {
                Ok(hwnd) if !hwnd.0.is_null() => {
                    curr = hwnd;
                    let mut title_buf = [0u16; 512];
                    let title_len = GetWindowTextW(hwnd, &mut title_buf);
                    let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);

                    let mut class_buf = [0u16; 512];
                    let class_len = GetClassNameW(hwnd, &mut class_buf);
                    let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);

                    let title_lower = title.to_lowercase();
                    let class_lower = class_name.to_lowercase();

                    let is_match = title_lower == "deadlock"
                        || (title_lower.contains("deadlock") && !title_lower.contains("analyzer") && !title_lower.contains("helper"))
                        || (class_lower == "sdl_app" && !title.is_empty() && title != "Menu")
                        || title_lower == "citadel";

                    if is_match {
                        if let Some(win) = inspect_candidate_hwnd(hwnd, restore_if_minimized) {
                            return Some(win);
                        }
                    }
                }
                _ => break,
            }
        }

        None
    }
}

pub(crate) fn find_deadlock_window_bounds() -> Option<(i32, i32, u32, u32)> {
    find_deadlock_window(false).map(|w| (w.x, w.y, w.width, w.height))
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
/// Ensures Deadlock is focused/brought to front so overlapping windows do not pollute OCR.
pub fn capture_screen_right_half(capture_right_only: bool) -> Result<String, String> {
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    if screens.is_empty() {
        return Err("No screens found".to_string());
    }

    let crop_ratio = if capture_right_only { 0.30 } else { 1.0 };
    let prev_foreground = unsafe { GetForegroundWindow() };

    // Find and optionally restore Deadlock window
    let maybe_dl = find_deadlock_window(true);

    let raw_captured = if let Some(dl) = maybe_dl {
        unsafe {
            // Bring Deadlock to the foreground so other overlapping windows do not pollute the capture
            if IsIconic(dl.hwnd).as_bool() {
                let _ = ShowWindow(dl.hwnd, SW_RESTORE);
            } else {
                let _ = ShowWindow(dl.hwnd, SW_SHOW);
            }
            let _ = BringWindowToTop(dl.hwnd);
            let _ = SetForegroundWindow(dl.hwnd);
        }

        // Sleep to give Windows DWM compositor time to swap and paint the window in the foreground
        std::thread::sleep(std::time::Duration::from_millis(150));

        // Re-read window rect after bringing to front in case size or pos shifted
        let mut rect = RECT::default();
        let (win_x, win_y, win_w, win_h) = if unsafe { GetWindowRect(dl.hwnd, &mut rect).is_ok() } {
            let w = (rect.right - rect.left) as u32;
            let h = (rect.bottom - rect.top) as u32;
            if w > 300 && h > 200 {
                (rect.left, rect.top, w, h)
            } else {
                (dl.x, dl.y, dl.width, dl.height)
            }
        } else {
            (dl.x, dl.y, dl.width, dl.height)
        };

        // Find the exact screen displaying the Deadlock window
        let center_x = win_x + (win_w / 2) as i32;
        let center_y = win_y + (win_h / 2) as i32;
        let target_screen = Screen::from_point(center_x, center_y)
            .ok()
            .or_else(|| {
                screens.iter().find(|s| {
                    win_x >= s.display_info.x
                        && win_x < s.display_info.x + s.display_info.width as i32
                        && win_y >= s.display_info.y
                        && win_y < s.display_info.y + s.display_info.height as i32
                }).cloned()
            })
            .unwrap_or_else(|| screens[0].clone());

        let local_win_x = win_x - target_screen.display_info.x;
        let local_win_y = win_y - target_screen.display_info.y;

        let (local_crop_x, crop_w) = if capture_right_only && win_w > 100 {
            let cw = (win_w as f32 * crop_ratio) as u32;
            (local_win_x + (win_w - cw) as i32, cw)
        } else {
            (local_win_x, win_w)
        };

        let screen_w = target_screen.display_info.width as i32;
        let screen_h = target_screen.display_info.height as i32;

        let safe_x = local_crop_x.clamp(0, screen_w.saturating_sub(1));
        let safe_y = local_win_y.clamp(0, screen_h.saturating_sub(1));
        let safe_w = (crop_w as i32).min(screen_w - safe_x).max(1) as u32;
        let safe_h = (win_h as i32).min(screen_h - safe_y).max(1) as u32;

        target_screen
            .capture_area(safe_x, safe_y, safe_w, safe_h)
            .map(|img| DynamicImage::ImageRgba8(img))
            .ok()
    } else {
        None
    };

    // Restore focus back to Lil Helper (or whatever was active previously)
    if !prev_foreground.0.is_null() {
        unsafe {
            let _ = SetForegroundWindow(prev_foreground);
        }
    }

    let base_image = match raw_captured {
        Some(img) => img,
        None => {
            // Fallback: capture primary screen
            let primary_screen = &screens[0];
            let full_image = primary_screen.capture().map_err(|e| format!("Capture failed: {}", e))?;
            let width = full_image.width();
            let height = full_image.height();

            if capture_right_only && width > 100 {
                let crop_width = (width as f32 * crop_ratio) as u32;
                let crop_x = width - crop_width;
                let dyn_img = DynamicImage::ImageRgba8(full_image);
                dyn_img.crop_imm(crop_x, 0, crop_width, height)
            } else {
                DynamicImage::ImageRgba8(full_image)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_screen_enumeration() {
        let screens = Screen::all().unwrap();
        assert!(!screens.is_empty());
    }
}

