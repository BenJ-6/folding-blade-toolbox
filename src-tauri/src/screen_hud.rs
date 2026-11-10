#![allow(unsafe_op_in_unsafe_fn)]

use std::sync::atomic::{AtomicIsize, AtomicU32, Ordering};
use std::thread;

use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows_sys::Win32::Graphics::Gdi::{
    BeginPaint, BitBlt, CLEARTYPE_QUALITY, CLIP_DEFAULT_PRECIS, CreateCompatibleBitmap,
    CreateCompatibleDC, CreateFontW, CreateSolidBrush, DEFAULT_CHARSET, DEFAULT_PITCH, DT_LEFT,
    DT_NOPREFIX, DT_SINGLELINE, DT_VCENTER, DeleteDC, DeleteObject, DrawTextW, EndPaint,
    FF_DONTCARE, FW_BOLD, FW_NORMAL, FillRect, FrameRect, GetDC, InvalidateRect,
    OUT_DEFAULT_PRECIS, PAINTSTRUCT, ReleaseDC, SRCCOPY, SelectObject, SetBkMode, SetTextColor,
    TRANSPARENT,
};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CS_HREDRAW, CS_VREDRAW, CreateWindowExW, DefWindowProcW, DispatchMessageW, GWLP_USERDATA,
    GetClientRect, GetMessageW, GetWindowLongPtrW, HWND_TOPMOST, MSG, PostQuitMessage,
    RegisterClassW, SW_HIDE, SWP_NOACTIVATE, SWP_NOSIZE, SWP_SHOWWINDOW, SetWindowLongPtrW,
    SetWindowPos, ShowWindow, TranslateMessage, WM_CREATE, WM_DESTROY, WM_ERASEBKGND, WM_PAINT,
    WNDCLASSW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
};

pub const WIDTH: i32 = 236;
pub const HEIGHT: i32 = 64;

static HUD_HWND: AtomicIsize = AtomicIsize::new(0);
static HUD_COLOR: AtomicU32 = AtomicU32::new(0x00FFFFFF);

struct HudState {
    mem_dc: windows_sys::Win32::Graphics::Gdi::HDC,
    bitmap: windows_sys::Win32::Graphics::Gdi::HBITMAP,
    previous_bitmap: windows_sys::Win32::Graphics::Gdi::HGDIOBJ,
    title_font: windows_sys::Win32::Graphics::Gdi::HFONT,
    hint_font: windows_sys::Win32::Graphics::Gdi::HFONT,
    bg_brush: windows_sys::Win32::Graphics::Gdi::HBRUSH,
    border_brush: windows_sys::Win32::Graphics::Gdi::HBRUSH,
    swatch_brush: windows_sys::Win32::Graphics::Gdi::HBRUSH,
    swatch_color: u32,
    width: i32,
    height: i32,
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

fn rgb(r: u8, g: u8, b: u8) -> u32 {
    (r as u32) << 16 | (g as u32) << 8 | b as u32
}

fn to_colorref(value: u32) -> u32 {
    let r = (value >> 16) & 0xFF;
    let g = (value >> 8) & 0xFF;
    let b = value & 0xFF;
    r | (g << 8) | (b << 16)
}

pub fn spawn() {
    thread::spawn(|| unsafe {
        let instance = GetModuleHandleW(std::ptr::null());
        let class_name = wide("ToolboxEyedropperHud");
        let window_title = wide("实时取色");

        let mut window_class: WNDCLASSW = std::mem::zeroed();
        window_class.style = CS_HREDRAW | CS_VREDRAW;
        window_class.lpfnWndProc = Some(hud_wnd_proc);
        window_class.hInstance = instance;
        window_class.lpszClassName = class_name.as_ptr();

        if RegisterClassW(&window_class) == 0 {
            eprintln!("screen hud: failed to register window class");
            return;
        }

        let hwnd = CreateWindowExW(
            WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT,
            class_name.as_ptr(),
            window_title.as_ptr(),
            WS_POPUP,
            0,
            0,
            WIDTH,
            HEIGHT,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            instance,
            std::ptr::null(),
        );

        if hwnd.is_null() {
            eprintln!("screen hud: failed to create window");
            return;
        }

        HUD_HWND.store(hwnd as isize, Ordering::SeqCst);

        let mut message: MSG = std::mem::zeroed();
        while GetMessageW(&mut message, std::ptr::null_mut(), 0, 0) > 0 {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    });
}

pub fn is_ready() -> bool {
    HUD_HWND.load(Ordering::SeqCst) != 0
}

pub fn move_to(x: i32, y: i32) {
    let raw = HUD_HWND.load(Ordering::SeqCst);
    if raw == 0 {
        return;
    }
    unsafe {
        SetWindowPos(
            raw as HWND,
            HWND_TOPMOST,
            x,
            y,
            0,
            0,
            SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
        );
    }
}

pub fn hide() {
    let raw = HUD_HWND.load(Ordering::SeqCst);
    if raw == 0 {
        return;
    }
    unsafe {
        ShowWindow(raw as HWND, SW_HIDE);
    }
}

pub fn set_color(value: u32) {
    let color = value & 0x00FFFFFF;
    if HUD_COLOR.swap(color, Ordering::SeqCst) == color {
        return;
    }
    let raw = HUD_HWND.load(Ordering::SeqCst);
    if raw == 0 {
        return;
    }
    unsafe {
        InvalidateRect(raw as HWND, std::ptr::null(), 0);
    }
}

unsafe extern "system" fn hud_wnd_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match message {
        WM_CREATE => {
            let mut client: RECT = std::mem::zeroed();
            GetClientRect(hwnd, &mut client);

            let window_dc = GetDC(hwnd);
            if window_dc.is_null() {
                return -1;
            }
            let mem_dc = CreateCompatibleDC(window_dc);
            let bitmap = CreateCompatibleBitmap(window_dc, client.right, client.bottom);
            ReleaseDC(hwnd, window_dc);

            if mem_dc.is_null() || bitmap.is_null() {
                if !mem_dc.is_null() {
                    DeleteDC(mem_dc);
                }
                if !bitmap.is_null() {
                    DeleteObject(bitmap);
                }
                return -1;
            }

            let previous_bitmap = SelectObject(mem_dc, bitmap);

            let title_face = wide("Consolas");
            let hint_face = wide("Microsoft YaHei UI");
            let title_font = CreateFontW(
                -19,
                0,
                0,
                0,
                FW_BOLD as i32,
                0,
                0,
                0,
                DEFAULT_CHARSET as u32,
                OUT_DEFAULT_PRECIS as u32,
                CLIP_DEFAULT_PRECIS as u32,
                CLEARTYPE_QUALITY as u32,
                (DEFAULT_PITCH | FF_DONTCARE) as u32,
                title_face.as_ptr(),
            );
            let hint_font = CreateFontW(
                -12,
                0,
                0,
                0,
                FW_NORMAL as i32,
                0,
                0,
                0,
                DEFAULT_CHARSET as u32,
                OUT_DEFAULT_PRECIS as u32,
                CLIP_DEFAULT_PRECIS as u32,
                CLEARTYPE_QUALITY as u32,
                (DEFAULT_PITCH | FF_DONTCARE) as u32,
                hint_face.as_ptr(),
            );

            let state = Box::new(HudState {
                mem_dc,
                bitmap,
                previous_bitmap,
                title_font,
                hint_font,
                bg_brush: CreateSolidBrush(to_colorref(rgb(13, 18, 33))),
                border_brush: CreateSolidBrush(to_colorref(rgb(58, 68, 94))),
                swatch_brush: std::ptr::null_mut(),
                swatch_color: 0xFFFFFFFF,
                width: client.right,
                height: client.bottom,
            });

            SetWindowLongPtrW(hwnd, GWLP_USERDATA, Box::into_raw(state) as isize);
            0
        }
        WM_ERASEBKGND => 1,
        WM_PAINT => {
            let mut paint: PAINTSTRUCT = std::mem::zeroed();
            let window_dc = BeginPaint(hwnd, &mut paint);
            let raw = GetWindowLongPtrW(hwnd, GWLP_USERDATA);

            if raw != 0 {
                let state = &mut *(raw as *mut HudState);
                paint_hud(state, window_dc);
            }

            EndPaint(hwnd, &paint);
            0
        }
        WM_DESTROY => {
            let raw = GetWindowLongPtrW(hwnd, GWLP_USERDATA);
            if raw != 0 {
                let state = Box::from_raw(raw as *mut HudState);
                SelectObject(state.mem_dc, state.previous_bitmap);
                DeleteObject(state.bitmap);
                DeleteObject(state.title_font);
                DeleteObject(state.hint_font);
                DeleteObject(state.bg_brush);
                DeleteObject(state.border_brush);
                if !state.swatch_brush.is_null() {
                    DeleteObject(state.swatch_brush);
                }
                DeleteDC(state.mem_dc);
                drop(state);
                SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
            }
            PostQuitMessage(0);
            0
        }
        _ => DefWindowProcW(hwnd, message, wparam, lparam),
    }
}

unsafe fn paint_hud(state: &mut HudState, window_dc: windows_sys::Win32::Graphics::Gdi::HDC) {
    let client = RECT {
        left: 0,
        top: 0,
        right: state.width,
        bottom: state.height,
    };

    FillRect(state.mem_dc, &client, state.bg_brush);
    FrameRect(state.mem_dc, &client, state.border_brush);

    let color = HUD_COLOR.load(Ordering::SeqCst) & 0x00FFFFFF;
    if state.swatch_color != color {
        if !state.swatch_brush.is_null() {
            DeleteObject(state.swatch_brush);
        }
        state.swatch_brush = CreateSolidBrush(to_colorref(color));
        state.swatch_color = color;
    }

    let swatch = RECT {
        left: 12,
        top: 14,
        right: 48,
        bottom: 50,
    };
    if !state.swatch_brush.is_null() {
        FillRect(state.mem_dc, &swatch, state.swatch_brush);
    }
    FrameRect(state.mem_dc, &swatch, state.border_brush);

    SetBkMode(state.mem_dc, TRANSPARENT as i32);

    let r = (color >> 16) & 0xFF;
    let g = (color >> 8) & 0xFF;
    let b = color & 0xFF;
    let hex = wide(&format!("#{r:02X}{g:02X}{b:02X}"));
    let mut hex_rect = RECT {
        left: 60,
        top: 6,
        right: 226,
        bottom: 32,
    };
    SelectObject(state.mem_dc, state.title_font);
    SetTextColor(state.mem_dc, to_colorref(rgb(255, 255, 255)));
    DrawTextW(
        state.mem_dc,
        hex.as_ptr(),
        -1,
        &mut hex_rect,
        DT_LEFT | DT_SINGLELINE | DT_VCENTER | DT_NOPREFIX,
    );

    let hint = wide("左键拾取 · 右键 / Esc 取消");
    let mut hint_rect = RECT {
        left: 60,
        top: 32,
        right: 226,
        bottom: 58,
    };
    SelectObject(state.mem_dc, state.hint_font);
    SetTextColor(state.mem_dc, to_colorref(rgb(150, 160, 180)));
    DrawTextW(
        state.mem_dc,
        hint.as_ptr(),
        -1,
        &mut hint_rect,
        DT_LEFT | DT_SINGLELINE | DT_VCENTER | DT_NOPREFIX,
    );

    BitBlt(
        window_dc,
        0,
        0,
        state.width,
        state.height,
        state.mem_dc,
        0,
        0,
        SRCCOPY,
    );
}
