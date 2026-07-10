use axum::{
    body::{Body, Bytes},
    extract::State,
    http::{header, HeaderMap, HeaderName, HeaderValue, Method, Response, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use include_dir::{include_dir, Dir};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env, fs,
    future::pending,
    io,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Arc,
};
use tokio::{net::TcpListener, task::JoinHandle};

const MAX_REQUEST_BODY_BYTES: usize = 1024 * 128;
const MAX_PROFILE_BYTES: u64 = 1024 * 256;
const MAX_ENV_VALUE_BYTES: usize = 1024 * 8;
static EMBEDDED_APP: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../app");

#[derive(Clone)]
struct HelperState {
    token: String,
    allowed_origins: Vec<String>,
}

#[derive(Clone)]
struct StaticState {
    root: PathBuf,
}

#[derive(Deserialize)]
struct CheckRequest {
    #[serde(default, rename = "envVars")]
    env_vars: Vec<String>,
}

#[derive(Deserialize)]
struct SaveRequest {
    #[serde(rename = "envVar")]
    env_var: String,
    #[serde(default)]
    value: String,
}

#[derive(Serialize)]
struct CheckResult {
    status: &'static str,
    #[serde(rename = "maskedValue")]
    masked_value: String,
}

#[derive(Serialize)]
struct SaveResult {
    ok: bool,
    #[serde(rename = "envVar")]
    env_var: String,
    #[serde(rename = "maskedValue")]
    masked_value: String,
    target: String,
}

#[derive(Serialize)]
struct HealthResult {
    ok: bool,
}

#[derive(Serialize)]
struct OpenTerminalResult {
    ok: bool,
    terminal: String,
}

#[derive(Serialize)]
pub struct StartupPayload {
    pub event: &'static str,
    pub web: BoundServer,
    pub helper: BoundServer,
}

#[derive(Clone, Serialize)]
pub struct BoundServer {
    pub host: String,
    pub port: u16,
}

pub type BackendError = Box<dyn std::error::Error + Send + Sync>;

pub struct ServeHandle {
    pub web: BoundServer,
    pub helper: BoundServer,
    pub token: String,
    _web_task: JoinHandle<()>,
    _helper_task: JoinHandle<()>,
}

pub fn run_cli() -> Result<(), BackendError> {
    let runtime = tokio::runtime::Runtime::new()?;
    runtime.block_on(async_main())
}

async fn async_main() -> Result<(), BackendError> {
    let args: Vec<String> = env::args().collect();
    if args.get(1).map(String::as_str) != Some("serve") {
        eprintln!("Usage: api-key-checker-helper serve [--web-port PORT] [--helper-port PORT]");
        std::process::exit(2);
    }

    let options = ServeOptions::from_env_and_args(&args[2..])?;
    let handle = spawn_servers(options).await?;

    println!(
        "{}",
        serde_json::to_string(&StartupPayload {
            event: "ready",
            web: handle.web.clone(),
            helper: handle.helper.clone(),
        })?
    );

    pending::<()>().await;
    Ok(())
}

pub async fn spawn_servers(mut options: ServeOptions) -> Result<ServeHandle, BackendError> {
    let web_listener = TcpListener::bind((options.host.as_str(), options.web_port)).await?;
    let helper_listener = TcpListener::bind((options.host.as_str(), options.helper_port)).await?;
    let web_addr = web_listener.local_addr()?;
    let helper_addr = helper_listener.local_addr()?;
    if options.allowed_origins.is_empty() {
        options.allowed_origins = vec![
            format!("http://127.0.0.1:{}", web_addr.port()),
            format!("http://localhost:{}", web_addr.port()),
        ];
    }

    let static_app = Router::new()
        .fallback(static_handler)
        .with_state(Arc::new(StaticState { root: options.root }));
    let helper_app = Router::new()
        .route("/health", get(health_handler).options(options_handler))
        .route("/api/check", post(check_handler).options(options_handler))
        .route("/api/save", post(save_handler).options(options_handler))
        .route(
            "/api/open-terminal",
            post(open_terminal_handler).options(options_handler),
        )
        .with_state(Arc::new(HelperState {
            token: options.token.clone(),
            allowed_origins: options.allowed_origins,
        }));

    let web_task = tokio::spawn(async move {
        if let Err(error) = axum::serve(web_listener, static_app).await {
            eprintln!("static server failed: {error}");
        }
    });
    let helper_task = tokio::spawn(async move {
        if let Err(error) = axum::serve(helper_listener, helper_app).await {
            eprintln!("helper server failed: {error}");
        }
    });

    Ok(ServeHandle {
        web: BoundServer {
            host: web_addr.ip().to_string(),
            port: web_addr.port(),
        },
        helper: BoundServer {
            host: helper_addr.ip().to_string(),
            port: helper_addr.port(),
        },
        token: options.token,
        _web_task: web_task,
        _helper_task: helper_task,
    })
}

pub struct ServeOptions {
    pub host: String,
    pub web_port: u16,
    pub helper_port: u16,
    pub token: String,
    pub allowed_origins: Vec<String>,
    pub root: PathBuf,
}

impl ServeOptions {
    pub fn local(root: PathBuf) -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            web_port: 0,
            helper_port: 0,
            token: random_token(),
            allowed_origins: Vec::new(),
            root,
        }
    }

    pub fn from_env_and_args(args: &[String]) -> Result<Self, String> {
        let mut host = env::var("API_KEY_CHECKER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let mut web_port = env_u16("API_KEY_CHECKER_WEB_PORT", 5173)?;
        let mut helper_port = env_u16("API_KEY_CHECKER_HELPER_PORT", 8787)?;
        let mut token = env::var("API_KEY_CHECKER_HELPER_TOKEN").unwrap_or_else(|_| random_token());
        let mut allowed_origins =
            parse_allowed_origins(&env::var("API_KEY_CHECKER_ALLOWED_ORIGINS").unwrap_or_default());
        let mut root = env::var_os("API_KEY_CHECKER_APP_ROOT")
            .map(PathBuf::from)
            .unwrap_or(env::current_dir().map_err(|error| error.to_string())?);

        let mut index = 0;
        while index < args.len() {
            let value = args[index].as_str();
            let next = || {
                args.get(index + 1)
                    .ok_or_else(|| format!("Missing value after {value}"))
            };

            match value {
                "--host" => host = next()?.clone(),
                "--web-port" => web_port = parse_u16(next()?, "--web-port")?,
                "--helper-port" => helper_port = parse_u16(next()?, "--helper-port")?,
                "--token" => token = next()?.clone(),
                "--allowed-origins" => allowed_origins = parse_allowed_origins(next()?),
                "--root" => root = PathBuf::from(next()?),
                other => return Err(format!("Unknown option: {other}")),
            }
            index += 2;
        }

        if allowed_origins.is_empty() {
            allowed_origins = vec![
                format!("http://127.0.0.1:{web_port}"),
                format!("http://localhost:{web_port}"),
            ];
        }

        Ok(Self {
            host,
            web_port,
            helper_port,
            token,
            allowed_origins,
            root,
        })
    }
}

fn env_u16(name: &str, default: u16) -> Result<u16, String> {
    match env::var(name) {
        Ok(value) => parse_u16(&value, name),
        Err(_) => Ok(default),
    }
}

fn parse_u16(value: &str, name: &str) -> Result<u16, String> {
    value
        .parse::<u16>()
        .map_err(|_| format!("{name} must be a valid TCP port"))
}

fn random_token() -> String {
    let mut bytes = [0_u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn parse_allowed_origins(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

async fn static_handler(
    State(state): State<Arc<StaticState>>,
    method: Method,
    uri: axum::http::Uri,
) -> impl IntoResponse {
    if method != Method::GET && method != Method::HEAD {
        return static_response(
            StatusCode::METHOD_NOT_ALLOWED,
            "text/plain; charset=utf-8",
            b"Method not allowed.".to_vec(),
        );
    }

    let Some(relative_path) = resolve_static_relative_path(uri.path()) else {
        return static_response(
            StatusCode::FORBIDDEN,
            "text/plain; charset=utf-8",
            b"Forbidden.".to_vec(),
        );
    };

    let path = state.root.join(&relative_path);
    match fs::read(&path) {
        Ok(body) => static_response(StatusCode::OK, content_type_for(&path), body),
        Err(_) => match EMBEDDED_APP.get_file(&relative_path) {
            Some(file) => static_response(
                StatusCode::OK,
                content_type_for(Path::new(&relative_path)),
                file.contents().to_vec(),
            ),
            None => static_response(
                StatusCode::NOT_FOUND,
                "text/plain; charset=utf-8",
                b"Not found.".to_vec(),
            ),
        },
    }
}

fn resolve_static_relative_path(request_path: &str) -> Option<String> {
    let request_path = percent_decode_path(request_path)?;
    let relative = if request_path == "/" {
        "index.html".to_string()
    } else {
        request_path.trim_start_matches('/').replace('\\', "/")
    };

    if relative.contains("..") {
        return None;
    }

    let is_public_file = matches!(
        relative.as_str(),
        "index.html" | "src/app.js" | "src/providers.js" | "src/ranking.js" | "src/styles.css"
    );
    let is_flag = relative.starts_with("src/flags/") && relative.ends_with(".svg");
    let is_icon = relative.starts_with("icon/") && relative.ends_with(".svg");
    if !is_public_file && !is_flag && !is_icon {
        return None;
    }

    Some(relative)
}

fn percent_decode_path(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let high = *bytes.get(index + 1)?;
            let low = *bytes.get(index + 2)?;
            output.push(hex_pair(high, low)?);
            index += 3;
        } else {
            output.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(output).ok()
}

fn hex_pair(high: u8, low: u8) -> Option<u8> {
    Some(hex_value(high)? * 16 + hex_value(low)?)
}

fn hex_value(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

fn content_type_for(path: &Path) -> &'static str {
    match path.extension().and_then(|extension| extension.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("svg") => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

fn static_response(status: StatusCode, content_type: &str, body: Vec<u8>) -> Response<Body> {
    let mut response = Response::new(Body::from(body));
    *response.status_mut() = status;
    insert_static_headers(response.headers_mut(), content_type);
    response
}

fn insert_static_headers(headers: &mut HeaderMap, content_type: &str) {
    let security_headers = [
        (
            "content-security-policy",
            "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'self'; style-src 'self'; connect-src 'self' http://127.0.0.1:* http://localhost:*",
        ),
        ("cross-origin-opener-policy", "same-origin"),
        ("referrer-policy", "no-referrer"),
        ("x-content-type-options", "nosniff"),
        ("x-frame-options", "DENY"),
    ];
    for (name, value) in security_headers {
        headers.insert(
            HeaderName::from_static(name),
            HeaderValue::from_static(value),
        );
    }
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(content_type)
            .unwrap_or(HeaderValue::from_static("application/octet-stream")),
    );
}

async fn options_handler(
    State(state): State<Arc<HelperState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if !origin_allowed(&headers, &state.allowed_origins) {
        return helper_text(
            &headers,
            &state.allowed_origins,
            StatusCode::FORBIDDEN,
            "Forbidden origin.",
        );
    }
    helper_text(&headers, &state.allowed_origins, StatusCode::NO_CONTENT, "")
}

async fn health_handler(
    State(state): State<Arc<HelperState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Some(response) = authorize(&headers, &state) {
        return response;
    }
    helper_json(
        &headers,
        &state.allowed_origins,
        StatusCode::OK,
        &HealthResult { ok: true },
    )
}

async fn check_handler(
    State(state): State<Arc<HelperState>>,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    if let Some(response) = authorize(&headers, &state) {
        return response;
    }
    if body.len() > MAX_REQUEST_BODY_BYTES {
        return helper_text(
            &headers,
            &state.allowed_origins,
            StatusCode::BAD_REQUEST,
            "Request body is too large.",
        );
    }

    let request: CheckRequest = match serde_json::from_slice(&body) {
        Ok(value) => value,
        Err(_) => {
            return helper_text(
                &headers,
                &state.allowed_origins,
                StatusCode::BAD_REQUEST,
                "Invalid JSON body.",
            )
        }
    };
    let profile_env = read_profile_env();
    let mut results = HashMap::new();
    for env_var in request.env_vars {
        if !validate_env_var(&env_var) {
            continue;
        }
        let value = read_env_value(&env_var, &profile_env);
        results.insert(
            env_var,
            CheckResult {
                status: if value.is_empty() { "missing" } else { "found" },
                masked_value: mask_key(&value),
            },
        );
    }
    helper_json(&headers, &state.allowed_origins, StatusCode::OK, &results)
}

async fn save_handler(
    State(state): State<Arc<HelperState>>,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    if let Some(response) = authorize(&headers, &state) {
        return response;
    }
    if body.len() > MAX_REQUEST_BODY_BYTES {
        return helper_text(
            &headers,
            &state.allowed_origins,
            StatusCode::BAD_REQUEST,
            "Request body is too large.",
        );
    }

    let request: SaveRequest = match serde_json::from_slice(&body) {
        Ok(value) => value,
        Err(_) => {
            return helper_text(
                &headers,
                &state.allowed_origins,
                StatusCode::BAD_REQUEST,
                "Invalid JSON body.",
            )
        }
    };
    if !validate_env_var(&request.env_var) {
        return helper_text(
            &headers,
            &state.allowed_origins,
            StatusCode::BAD_REQUEST,
            "Invalid environment variable name.",
        );
    }
    if request.value.trim().is_empty()
        || request.value.contains('\0')
        || request.value.len() > MAX_ENV_VALUE_BYTES
    {
        return helper_text(
            &headers,
            &state.allowed_origins,
            StatusCode::BAD_REQUEST,
            "Invalid environment variable value.",
        );
    }

    match save_env(&request.env_var, &request.value) {
        Ok(target) => helper_json(
            &headers,
            &state.allowed_origins,
            StatusCode::OK,
            &SaveResult {
                ok: true,
                env_var: request.env_var,
                masked_value: mask_key(&request.value),
                target,
            },
        ),
        Err(error) => helper_text(
            &headers,
            &state.allowed_origins,
            StatusCode::INTERNAL_SERVER_ERROR,
            &error.to_string(),
        ),
    }
}

async fn open_terminal_handler(
    State(state): State<Arc<HelperState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Some(response) = authorize(&headers, &state) {
        return response;
    }

    match open_terminal() {
        Ok(terminal) => helper_json(
            &headers,
            &state.allowed_origins,
            StatusCode::OK,
            &OpenTerminalResult { ok: true, terminal },
        ),
        Err(error) => helper_text(
            &headers,
            &state.allowed_origins,
            StatusCode::INTERNAL_SERVER_ERROR,
            &error.to_string(),
        ),
    }
}

fn authorize(headers: &HeaderMap, state: &HelperState) -> Option<Response<Body>> {
    if !origin_allowed(headers, &state.allowed_origins) {
        return Some(helper_text(
            headers,
            &state.allowed_origins,
            StatusCode::FORBIDDEN,
            "Forbidden origin.",
        ));
    }

    let supplied = headers
        .get("x-api-key-checker-token")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    if !timing_safe_equal(supplied, &state.token) {
        return Some(helper_text(
            headers,
            &state.allowed_origins,
            StatusCode::UNAUTHORIZED,
            "Unauthorized.",
        ));
    }

    None
}

fn origin_allowed(headers: &HeaderMap, allowed_origins: &[String]) -> bool {
    headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
        .map(|origin| allowed_origins.iter().any(|allowed| allowed == origin))
        .unwrap_or(true)
}

fn timing_safe_equal(left: &str, right: &str) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.as_bytes()
        .iter()
        .zip(right.as_bytes())
        .fold(0_u8, |diff, (a, b)| diff | (a ^ b))
        == 0
}

fn helper_json<T: Serialize>(
    headers: &HeaderMap,
    allowed_origins: &[String],
    status: StatusCode,
    payload: &T,
) -> Response<Body> {
    match serde_json::to_string(payload) {
        Ok(body) => helper_response(
            headers,
            allowed_origins,
            status,
            "application/json; charset=utf-8",
            body,
        ),
        Err(_) => helper_text(
            headers,
            allowed_origins,
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error.",
        ),
    }
}

fn helper_text(
    headers: &HeaderMap,
    allowed_origins: &[String],
    status: StatusCode,
    message: &str,
) -> Response<Body> {
    helper_response(
        headers,
        allowed_origins,
        status,
        "text/plain; charset=utf-8",
        message.to_string(),
    )
}

fn helper_response(
    request_headers: &HeaderMap,
    allowed_origins: &[String],
    status: StatusCode,
    content_type: &str,
    body: String,
) -> Response<Body> {
    let mut response = Response::new(Body::from(body));
    *response.status_mut() = status;
    let headers = response.headers_mut();
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("Content-Type, X-API-Key-Checker-Token"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET,POST,OPTIONS"),
    );
    headers.insert(
        HeaderName::from_static("access-control-allow-private-network"),
        HeaderValue::from_static("true"),
    );
    headers.insert(header::VARY, HeaderValue::from_static("Origin"));
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(content_type)
            .unwrap_or(HeaderValue::from_static("text/plain; charset=utf-8")),
    );

    let origin = request_headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    if origin.is_empty() || allowed_origins.iter().any(|allowed| allowed == origin) {
        headers.insert(
            header::ACCESS_CONTROL_ALLOW_ORIGIN,
            HeaderValue::from_str(if origin.is_empty() { "null" } else { origin })
                .unwrap_or(HeaderValue::from_static("null")),
        );
    }

    response
}

fn validate_env_var(env_var: &str) -> bool {
    let mut chars = env_var.chars();
    match chars.next() {
        Some(first) if first.is_ascii_uppercase() => {}
        _ => return false,
    }
    chars.all(|value| value.is_ascii_uppercase() || value.is_ascii_digit() || value == '_')
}

fn mask_key(value: &str) -> String {
    if value.is_empty() {
        return String::new();
    }
    if value.len() <= 8 {
        return "****".to_string();
    }
    format!("{}...{}", &value[..4], &value[value.len() - 4..])
}

fn configured_shell_profiles() -> Vec<PathBuf> {
    if let Ok(profile) = env::var("API_KEY_CHECKER_PROFILE") {
        return vec![PathBuf::from(profile)];
    }

    if cfg!(windows) {
        return Vec::new();
    }

    let Some(home) = home_dir() else {
        return Vec::new();
    };
    [
        ".zshrc",
        ".zprofile",
        ".bashrc",
        ".bash_profile",
        ".profile",
    ]
    .iter()
    .map(|name| home.join(name))
    .collect()
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

fn read_profile_env() -> HashMap<String, String> {
    let mut result = HashMap::new();
    for profile in configured_shell_profiles() {
        let Ok(metadata) = fs::metadata(&profile) else {
            continue;
        };
        if !metadata.is_file() || metadata.len() > MAX_PROFILE_BYTES {
            continue;
        }
        if let Ok(content) = fs::read_to_string(profile) {
            result.extend(parse_shell_profile(&content));
        }
    }
    result
}

fn parse_shell_profile(content: &str) -> HashMap<String, String> {
    let mut result = HashMap::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let candidate = trimmed.strip_prefix("export ").unwrap_or(trimmed);
        let Some((name, value)) = candidate.split_once('=') else {
            continue;
        };
        if validate_env_var(name) {
            result.insert(name.to_string(), unquote_shell_value(value));
        }
    }
    result
}

fn unquote_shell_value(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.len() >= 2 && trimmed.starts_with('\'') && trimmed.ends_with('\'') {
        return trimmed[1..trimmed.len() - 1].to_string();
    }

    if trimmed.len() >= 2 && trimmed.starts_with('"') && trimmed.ends_with('"') {
        return unescape_double_quoted(&trimmed[1..trimmed.len() - 1]);
    }

    match trimmed.find(" #") {
        Some(index) => trimmed[..index].trim().to_string(),
        None => trimmed.to_string(),
    }
}

fn unescape_double_quoted(value: &str) -> String {
    let mut output = String::new();
    let mut chars = value.chars();
    while let Some(ch) = chars.next() {
        if ch != '\\' {
            output.push(ch);
            continue;
        }
        match chars.next() {
            Some('"') => output.push('"'),
            Some('\\') => output.push('\\'),
            Some('$') => output.push('$'),
            Some('`') => output.push('`'),
            Some('n') => output.push('\n'),
            Some('r') => output.push('\r'),
            Some('t') => output.push('\t'),
            Some(other) => {
                output.push('\\');
                output.push(other);
            }
            None => output.push('\\'),
        }
    }
    output
}

fn read_env_value(env_var: &str, profile_env: &HashMap<String, String>) -> String {
    let windows_user_env = read_windows_registry_env("HKCU\\Environment", env_var);
    let windows_system_env = read_windows_registry_env(
        "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment",
        env_var,
    );
    resolve_env_value(
        env_var,
        profile_env,
        windows_user_env.as_deref(),
        windows_system_env.as_deref(),
        env::var(env_var).ok().as_deref(),
    )
}

fn resolve_env_value(
    env_var: &str,
    profile_env: &HashMap<String, String>,
    windows_user_env: Option<&str>,
    windows_system_env: Option<&str>,
    process_env: Option<&str>,
) -> String {
    profile_env
        .get(env_var)
        .map(String::as_str)
        .or(windows_user_env.filter(|value| !value.is_empty()))
        .or(windows_system_env.filter(|value| !value.is_empty()))
        .or(process_env.filter(|value| !value.is_empty()))
        .unwrap_or("")
        .to_string()
}

fn read_windows_registry_env(hive_path: &str, env_var: &str) -> Option<String> {
    if !cfg!(windows) {
        return None;
    }

    let output = Command::new("reg")
        .args(["query", hive_path, "/v", env_var])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    parse_windows_env(&String::from_utf8_lossy(&output.stdout), env_var)
}

fn parse_windows_env(output: &str, env_var: &str) -> Option<String> {
    for line in output.lines() {
        let trimmed = line.trim();
        let mut parts = trimmed.split_whitespace();
        if parts.next()? != env_var {
            continue;
        }
        let kind = parts.next()?;
        if !kind.starts_with("REG_") {
            continue;
        }
        let value = parts.collect::<Vec<_>>().join(" ");
        if !value.is_empty() {
            return Some(value);
        }
    }
    None
}

fn save_env(env_var: &str, value: &str) -> io::Result<String> {
    let target = if cfg!(windows) {
        save_env_to_windows_user(env_var, value)?
    } else {
        save_env_to_shell_profile(env_var, value)?
    };
    env::set_var(env_var, value);
    Ok(target)
}

fn save_env_to_windows_user(env_var: &str, value: &str) -> io::Result<String> {
    let status = Command::new("setx")
        .args([env_var, value])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()?;
    if status.success() {
        Ok("windows-user".to_string())
    } else {
        Err(io::Error::new(
            io::ErrorKind::Other,
            "Unable to save Windows user environment variable.",
        ))
    }
}

fn save_env_to_shell_profile(env_var: &str, value: &str) -> io::Result<String> {
    let profile = profile_for_save();
    let mut content = String::new();
    match fs::metadata(&profile) {
        Ok(metadata) => {
            if !metadata.is_file() || metadata.len() > MAX_PROFILE_BYTES {
                return Err(io::Error::new(
                    io::ErrorKind::Other,
                    "Shell profile is not writable by API Key Checker.",
                ));
            }
            content = fs::read_to_string(&profile)?;
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => return Err(error),
    }

    let export_line = format!("export {env_var}={}", shell_export_value(value));
    let mut replaced = false;
    let mut next_lines = Vec::new();
    for line in content.lines() {
        let candidate = line
            .trim_start()
            .strip_prefix("export ")
            .unwrap_or(line.trim_start());
        if candidate.starts_with(&format!("{env_var}=")) {
            next_lines.push(export_line.clone());
            replaced = true;
        } else {
            next_lines.push(line.to_string());
        }
    }
    if !replaced {
        next_lines.push(export_line);
    }
    let mut next_content = next_lines.join("\n");
    next_content.push('\n');

    if let Some(parent) = profile.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(profile, next_content)?;
    Ok("shell-profile".to_string())
}

fn profile_for_save() -> PathBuf {
    configured_shell_profiles()
        .into_iter()
        .next()
        .or_else(|| home_dir().map(|home| home.join(".profile")))
        .unwrap_or_else(|| PathBuf::from(".profile"))
}

fn shell_export_value(value: &str) -> String {
    format!(
        "\"{}\"",
        value
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('$', "\\$")
            .replace('`', "\\`")
    )
}

fn open_terminal() -> io::Result<String> {
    if cfg!(target_os = "macos") {
        Command::new("open")
            .args(["-a", "Terminal"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;
        return Ok("Terminal".to_string());
    }

    if cfg!(windows) {
        Command::new("powershell.exe")
            .arg("-NoExit")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;
        return Ok("PowerShell".to_string());
    }

    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "Opening a terminal is supported only on macOS and Windows.",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_keys_without_exposing_full_value() {
        assert_eq!(mask_key(""), "");
        assert_eq!(mask_key("12345678"), "****");
        assert_eq!(mask_key("sk-test-secret-value"), "sk-t...alue");
    }

    #[test]
    fn parses_shell_profile_exports() {
        let parsed = parse_shell_profile(
            r#"
            # ignored
            export OPENAI_API_KEY="sk-test-secret"
            DEEPSEEK_API_KEY='sk-deepseek-secret'
            BAD-name=value
            "#,
        );
        assert_eq!(parsed.get("OPENAI_API_KEY").unwrap(), "sk-test-secret");
        assert_eq!(
            parsed.get("DEEPSEEK_API_KEY").unwrap(),
            "sk-deepseek-secret"
        );
        assert!(!parsed.contains_key("BAD-name"));
    }

    #[test]
    fn persistent_env_values_beat_process_snapshot() {
        let profile_env = HashMap::new();
        let value = resolve_env_value(
            "DEEPSEEK_API_KEY",
            &profile_env,
            Some("sk-new-user-value"),
            None,
            Some("sk-old-process-value"),
        );
        assert_eq!(value, "sk-new-user-value");
    }

    #[test]
    fn resolves_only_public_static_paths() {
        assert_eq!(
            resolve_static_relative_path("/src/app.js").unwrap(),
            "src/app.js"
        );
        assert!(resolve_static_relative_path("/package.json").is_none());
        assert!(resolve_static_relative_path("/../server/helper.js").is_none());
    }
}
