use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::thread;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager};

#[cfg(windows)]
use crate::screen_hud;

const PICK_TIMEOUT: Duration = Duration::from_secs(60);

static PICKING: AtomicBool = AtomicBool::new(false);
static SESSION: AtomicU64 = AtomicU64::new(0);
static PICK_REQUESTED: AtomicBool = AtomicBool::new(false);
static CANCEL_REQUESTED: AtomicBool = AtomicBool::new(false);
static ESC_REQUESTED: AtomicBool = AtomicBool::new(false);
static LEFT_DOWN: AtomicBool = AtomicBool::new(false);
static RIGHT_DOWN: AtomicBool = AtomicBool::new(false);

#[cfg(windows)]
#[tauri::command]
pub fn start_screen_pick(app: AppHandle) -> Result<(), String> {
    if PICKING.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    if !screen_hud::is_ready() {
        PICKING.store(false, Ordering::SeqCst);
        return Err("取色 HUD 初始化失败，请重试".to_string());
    }

    let session = SESSION.fetch_add(1, Ordering::SeqCst) + 1;
    thread::spawn(move || {
        let fallback = app.clone();
        let result =
            std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| open_picker(app, session)));

        if result.is_err() {
            let _ = fallback.emit_to("main", "screen-picker:error", "屏幕取色出现异常，请重试");
            finish_session(&fallback);
        }
    });

    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn start_screen_pick(_app: AppHandle) -> Result<(), String> {
    Err("当前平台暂不支持屏幕取色".to_string())
}

#[cfg(windows)]
pub fn install_hooks() {
    thread::spawn(|| unsafe {
        use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            DispatchMessageW, GetMessageW, MSG, SetWindowsHookExW, TranslateMessage,
            UnhookWindowsHookEx, WH_KEYBOARD_LL, WH_MOUSE_LL,
        };

        let module = GetModuleHandleW(std::ptr::null());
        let mouse_hook = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook_proc), module, 0);
        let keyboard_hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook_proc), module, 0);

        if mouse_hook.is_null() || keyboard_hook.is_null() {
            eprintln!("screen picker: failed to install input hooks");
        }

        let mut message: MSG = std::mem::zeroed();
        while GetMessageW(&mut message, std::ptr::null_mut(), 0, 0) > 0 {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }

        if !mouse_hook.is_null() {
            UnhookWindowsHookEx(mouse_hook);
        }
        if !keyboard_hook.is_null() {
            UnhookWindowsHookEx(keyboard_hook);
        }
    });
}

#[cfg(windows)]
unsafe extern "system" fn mouse_hook_proc(
    code: i32,
    wparam: windows_sys::Win32::Foundation::WPARAM,
    lparam: windows_sys::Win32::Foundation::LPARAM,
) -> windows_sys::Win32::Foundation::LRESULT {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MBUTTONDOWN, WM_MBUTTONUP, WM_MOUSEWHEEL,
        WM_RBUTTONDOWN, WM_RBUTTONUP,
    };

    if code >= 0 && PICKING.load(Ordering::SeqCst) {
        match wparam as u32 {
            WM_LBUTTONDOWN => {
                LEFT_DOWN.store(true, Ordering::SeqCst);
                PICK_REQUESTED.store(true, Ordering::SeqCst);
                return 1;
            }
            WM_LBUTTONUP => {
                LEFT_DOWN.store(false, Ordering::SeqCst);
                return 1;
            }
            WM_RBUTTONDOWN => {
                RIGHT_DOWN.store(true, Ordering::SeqCst);
                CANCEL_REQUESTED.store(true, Ordering::SeqCst);
                return 1;
            }
            WM_RBUTTONUP => {
                RIGHT_DOWN.store(false, Ordering::SeqCst);
                return 1;
            }
            WM_MBUTTONDOWN | WM_MBUTTONUP | WM_MOUSEWHEEL => return 1,
            _ => {}
        }
    }

    unsafe { CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam) }
}

#[cfg(windows)]
unsafe extern "system" fn keyboard_hook_proc(
    code: i32,
    wparam: windows_sys::Win32::Foundation::WPARAM,
    lparam: windows_sys::Win32::Foundation::LPARAM,
) -> windows_sys::Win32::Foundation::LRESULT {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, KBDLLHOOKSTRUCT, WM_KEYDOWN, WM_SYSKEYDOWN,
    };

    if code >= 0 && PICKING.load(Ordering::SeqCst) {
        let info = unsafe { &*(lparam as *const KBDLLHOOKSTRUCT) };
        let message = wparam as u32;
        if (message == WM_KEYDOWN || message == WM_SYSKEYDOWN) && info.vkCode == 0x1B {
            ESC_REQUESTED.store(true, Ordering::SeqCst);
        }
        return 1;
    }

    unsafe { CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam) }
}

#[cfg(windows)]
fn open_picker(app: AppHandle, session: u64) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.hide();
    }
    thread::sleep(Duration::from_millis(120));

    let bounds = virtual_screen_bounds();
    if let Some((cx, cy, hex)) = cursor_color() {
        if let Ok(rgb) = u32::from_str_radix(hex.trim_start_matches('#'), 16) {
            screen_hud::set_color(rgb);
        }
        let (hx, hy) = hud_position(bounds, cx, cy);
        screen_hud::move_to(hx, hy);
    }

    let picked = run_picker(bounds, session);

    match picked {
        Some(hex) => {
            let _ = app.emit_to("main", "screen-picker:done", hex);
        }
        None => {
            let _ = app.emit_to("main", "screen-picker:cancel", ());
        }
    }

    finish_session(&app);
}

#[cfg(windows)]
fn run_picker(bounds: (i32, i32, u32, u32), session: u64) -> Option<String> {
    // 短暂延迟后清空事件，避免把启动取色的那次点击算进去
    thread::sleep(Duration::from_millis(140));
    PICK_REQUESTED.store(false, Ordering::SeqCst);
    CANCEL_REQUESTED.store(false, Ordering::SeqCst);
    ESC_REQUESTED.store(false, Ordering::SeqCst);
    LEFT_DOWN.store(false, Ordering::SeqCst);
    RIGHT_DOWN.store(false, Ordering::SeqCst);

    let started = Instant::now();
    let mut last_position = (i32::MIN, i32::MIN);

    loop {
        if SESSION.load(Ordering::SeqCst) != session {
            return None;
        }
        if started.elapsed() > PICK_TIMEOUT {
            return None;
        }

        if let Some((cx, cy, hex)) = cursor_color() {
            if let Ok(rgb) = u32::from_str_radix(hex.trim_start_matches('#'), 16) {
                screen_hud::set_color(rgb);
            }

            let position = hud_position(bounds, cx, cy);
            if position != last_position {
                screen_hud::move_to(position.0, position.1);
                last_position = position;
            }
        }

        if ESC_REQUESTED.swap(false, Ordering::SeqCst) {
            return None;
        }

        if CANCEL_REQUESTED.swap(false, Ordering::SeqCst) {
            // 等右键松开后再关闭，保证这次右键不会漏到下层窗口
            let release_deadline = Instant::now() + Duration::from_millis(800);
            while RIGHT_DOWN.load(Ordering::SeqCst) && Instant::now() < release_deadline {
                thread::sleep(Duration::from_millis(10));
            }
            return None;
        }

        if PICK_REQUESTED.swap(false, Ordering::SeqCst) {
            let picked = cursor_color()
                .map(|(_, _, hex)| hex)
                .unwrap_or_else(|| "#FFFFFF".to_string());

            let release_deadline = Instant::now() + Duration::from_millis(800);
            while LEFT_DOWN.load(Ordering::SeqCst) && Instant::now() < release_deadline {
                thread::sleep(Duration::from_millis(10));
            }
            return Some(picked);
        }

        thread::sleep(Duration::from_millis(16));
    }
}

#[cfg(windows)]
fn hud_position(bounds: (i32, i32, u32, u32), cursor_x: i32, cursor_y: i32) -> (i32, i32) {
    const OFFSET: i32 = 20;

    let (left, top, width, height) = bounds;
    let right = left + width as i32;
    let bottom = top + height as i32;

    let mut x = cursor_x + OFFSET;
    let mut y = cursor_y + OFFSET;

    if x + screen_hud::WIDTH > right {
        x = cursor_x - OFFSET - screen_hud::WIDTH;
    }
    if y + screen_hud::HEIGHT > bottom {
        y = cursor_y - OFFSET - screen_hud::HEIGHT;
    }

    (x.max(left), y.max(top))
}

#[cfg(windows)]
fn finish_session(app: &AppHandle) {
    PICKING.store(false, Ordering::SeqCst);
    PICK_REQUESTED.store(false, Ordering::SeqCst);
    CANCEL_REQUESTED.store(false, Ordering::SeqCst);
    ESC_REQUESTED.store(false, Ordering::SeqCst);
    LEFT_DOWN.store(false, Ordering::SeqCst);
    RIGHT_DOWN.store(false, Ordering::SeqCst);

    screen_hud::hide();

    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
}

#[cfg(windows)]
fn cursor_color() -> Option<(i32, i32, String)> {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::Graphics::Gdi::{CLR_INVALID, GetDC, GetPixel, ReleaseDC};
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    unsafe {
        let mut point = POINT { x: 0, y: 0 };
        if GetCursorPos(&mut point) == 0 {
            return None;
        }

        let screen = GetDC(std::ptr::null_mut());
        if screen.is_null() {
            return None;
        }
        let pixel = GetPixel(screen, point.x, point.y);
        ReleaseDC(std::ptr::null_mut(), screen);

        if pixel == CLR_INVALID {
            return None;
        }

        let r = pixel & 0xFF;
        let g = (pixel >> 8) & 0xFF;
        let b = (pixel >> 16) & 0xFF;
        Some((point.x, point.y, format!("#{r:02X}{g:02X}{b:02X}")))
    }
}

#[cfg(windows)]
fn virtual_screen_bounds() -> (i32, i32, u32, u32) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, SM_CXSCREEN, SM_CXVIRTUALSCREEN, SM_CYSCREEN, SM_CYVIRTUALSCREEN,
        SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
    };

    unsafe {
        let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
        let width = GetSystemMetrics(SM_CXVIRTUALSCREEN).max(GetSystemMetrics(SM_CXSCREEN));
        let height = GetSystemMetrics(SM_CYVIRTUALSCREEN).max(GetSystemMetrics(SM_CYSCREEN));
        (x, y, width.max(1) as u32, height.max(1) as u32)
    }
}
