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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default();

  // Only serve over http://localhost in release. In `tauri dev` the window
  // loads the Vite dev server (http://localhost:5173) — already a valid HTTP
  // origin, and we want its hot-reload — so the plugin isn't needed there.
  #[cfg(not(debug_assertions))]
  {
    builder = builder.plugin(tauri_plugin_localhost::Builder::new(LOCALHOST_PORT).build());
  }

  builder
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
        .build()?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
