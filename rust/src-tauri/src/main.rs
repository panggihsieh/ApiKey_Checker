use std::path::PathBuf;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_root = app_asset_root(app);
            let handle = tauri::async_runtime::block_on(rust_helper::spawn_servers(
                rust_helper::ServeOptions::local(app_root),
            ))
            .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error.to_string()))?;
            let url = format!(
                "http://{}:{}/?helperPort={}#helperToken={}",
                handle.web.host, handle.web.port, handle.helper.port, handle.token
            );

            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url.parse()?))
                .title("API Key Checker")
                .inner_size(1180.0, 820.0)
                .min_inner_size(920.0, 680.0)
                .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running API Key Checker");
}

fn app_asset_root(app: &tauri::App) -> PathBuf {
    let bundled_root = app.path().resource_dir().ok().map(|path| path.join("app"));
    if let Some(path) = bundled_root.filter(|path| path.join("index.html").is_file()) {
        return path;
    }

    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../app")
}
