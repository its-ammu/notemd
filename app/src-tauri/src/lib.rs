// Fixed localhost port used for production builds. The packaged app serves its
// assets over http://localhost:<PORT> (via tauri-plugin-localhost) instead of
// the tauri:// custom protocol. This gives the webview a real HTTP origin,
// which is required for embeds like the YouTube IFrame player (the tauri://
// origin triggers "YouTube error 153: player configuration error").
//
// Keep this port STABLE across releases: localStorage (the Supabase session,
// radio prefs, etc.) is keyed by origin, so changing the port would log users
// out and wipe their saved settings on update.
const LOCALHOST_PORT: u16 = 1430;

use tauri::{
  menu::{
    AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu, HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
  },
  webview::NewWindowResponse,
  Manager,
};

fn host_matches(host: &str, suffix: &str) -> bool {
  host == suffix
    || (host.ends_with(suffix)
      && host.as_bytes().get(host.len().saturating_sub(suffix.len() + 1)) == Some(&b'.'))
}

/// YouTube (and Google's player CDNs) load inside an iframe. WKWebView reports
/// those as navigations, so they must not be sent to the system browser —
/// cancelling them is a common cause of a dead player / Error 153.
fn is_media_embed_host(host: &str) -> bool {
  const SUFFIXES: &[&str] = &[
    "youtube.com",
    "youtube-nocookie.com",
    "youtu.be",
    "ytimg.com",
    "ggpht.com",
    "googlevideo.com",
    "gstatic.com",
    "google.com",
    "googleapis.com",
  ];
  SUFFIXES.iter().any(|s| host_matches(host, s))
}

fn is_local_app_host(host: &str) -> bool {
  host == "localhost"
    || host == "127.0.0.1"
    || host == "tauri.localhost"
    || host.ends_with(".localhost")
}

fn open_in_browser(url: &tauri::Url) {
  let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
}

fn build_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
  let pkg_info = app.package_info();
  let config = app.config();
  let about_metadata = AboutMetadata {
    name: Some(pkg_info.name.clone()),
    version: Some(pkg_info.version.to_string()),
    copyright: config.bundle.copyright.clone(),
    authors: config.bundle.publisher.clone().map(|p| vec![p]),
    ..Default::default()
  };

  let reload = MenuItem::with_id(app, "reload", "Reload", true, Some("CmdOrCtrl+R"))?;

  let window_menu = Submenu::with_id_and_items(
    app,
    WINDOW_SUBMENU_ID,
    "Window",
    true,
    &[
      &PredefinedMenuItem::minimize(app, None)?,
      &PredefinedMenuItem::maximize(app, None)?,
      #[cfg(target_os = "macos")]
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::close_window(app, None)?,
    ],
  )?;

  let help_menu = Submenu::with_id_and_items(
    app,
    HELP_SUBMENU_ID,
    "Help",
    true,
    &[
      #[cfg(not(target_os = "macos"))]
      &PredefinedMenuItem::about(app, None, Some(about_metadata.clone()))?,
    ],
  )?;

  Menu::with_items(
    app,
    &[
      #[cfg(target_os = "macos")]
      &Submenu::with_items(
        app,
        pkg_info.name.clone(),
        true,
        &[
          &PredefinedMenuItem::about(app, None, Some(about_metadata))?,
          &PredefinedMenuItem::separator(app)?,
          &PredefinedMenuItem::services(app, None)?,
          &PredefinedMenuItem::separator(app)?,
          &PredefinedMenuItem::hide(app, None)?,
          &PredefinedMenuItem::hide_others(app, None)?,
          &PredefinedMenuItem::separator(app)?,
          &PredefinedMenuItem::quit(app, None)?,
        ],
      )?,
      #[cfg(not(any(
        target_os = "linux",
        target_os = "dragonfly",
        target_os = "freebsd",
        target_os = "netbsd",
        target_os = "openbsd"
      )))]
      &Submenu::with_items(
        app,
        "File",
        true,
        &[
          &PredefinedMenuItem::close_window(app, None)?,
          #[cfg(not(target_os = "macos"))]
          &PredefinedMenuItem::quit(app, None)?,
        ],
      )?,
      &Submenu::with_items(
        app,
        "Edit",
        true,
        &[
          &PredefinedMenuItem::undo(app, None)?,
          &PredefinedMenuItem::redo(app, None)?,
          &PredefinedMenuItem::separator(app)?,
          &PredefinedMenuItem::cut(app, None)?,
          &PredefinedMenuItem::copy(app, None)?,
          &PredefinedMenuItem::paste(app, None)?,
          &PredefinedMenuItem::select_all(app, None)?,
        ],
      )?,
      &Submenu::with_items(
        app,
        "View",
        true,
        &[
          &reload,
          &PredefinedMenuItem::separator(app)?,
          &PredefinedMenuItem::fullscreen(app, None)?,
        ],
      )?,
      &window_menu,
      &help_menu,
    ],
  )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default();

  // Only serve over http://localhost in release. In `tauri dev` the window
  // loads the Vite dev server (http://localhost:5173) — already a valid HTTP
  // origin, and we want its hot-reload — so the plugin isn't needed there.
  #[cfg(not(debug_assertions))]
  {
    builder = builder.plugin(
      tauri_plugin_localhost::Builder::new(LOCALHOST_PORT)
        // WKWebView strips Referer on custom-protocol pages; `origin` is the
        // policy YouTube Error 153 actually honors from http://localhost.
        .on_request(|_req, res| {
          res.add_header("Referrer-Policy", "origin");
        })
        .build(),
    );
  }

  builder
    .plugin(tauri_plugin_opener::init())
    .menu(|app| build_menu(app))
    .on_menu_event(|app, event| {
      if event.id() == "reload" {
        if let Some(win) = app.get_webview_window("main") {
          let _ = win.reload();
        }
      }
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // In dev, load via the default app URL (Vite dev server). In release,
      // point the window at the localhost plugin's HTTP server.
      #[cfg(debug_assertions)]
      let url = tauri::WebviewUrl::default();
      #[cfg(not(debug_assertions))]
      let url = tauri::WebviewUrl::External(
        format!("http://localhost:{}", LOCALHOST_PORT).parse().unwrap(),
      );

      tauri::webview::WebviewWindowBuilder::new(app, "main", url)
        .title("NoteMD")
        .inner_size(1200.0, 800.0)
        .min_inner_size(720.0, 540.0)
        .resizable(true)
        // Turn off the OS-level file drag-drop handler: it intercepts drag
        // events before the DOM sees them, which breaks in-app HTML5
        // drag-and-drop (reordering notebooks, pages, and tracker tasks).
        .disable_drag_drop_handler()
        // target=_blank / Cmd-click requests a *new window*, which WKWebView
        // silently drops unless we handle it. Send those URLs to the OS browser.
        .on_new_window(|url, _features| {
          let host = url.host_str().unwrap_or("");
          if !is_media_embed_host(host)
            && matches!(url.scheme(), "http" | "https" | "mailto")
          {
            open_in_browser(&url);
          }
          NewWindowResponse::Deny
        })
        // Same-origin stays in the webview. External navigations (not new
        // windows) also go to the system browser. iframe loads for YouTube
        // must be allowed or the radio player dies with Error 153.
        .on_navigation(|url| {
          let host = url.host_str().unwrap_or("");
          if is_local_app_host(host) && matches!(url.scheme(), "http" | "https" | "tauri") {
            return true;
          }
          if is_media_embed_host(host) {
            return true;
          }
          if matches!(url.scheme(), "http" | "https" | "mailto") {
            open_in_browser(&url);
            return false;
          }
          true
        })
        .build()?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
