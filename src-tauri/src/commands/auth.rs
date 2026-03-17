use serde::Serialize;
use std::io::{Read, Write};
use std::net::TcpListener;

/// Fixed port for OAuth callback. Registered in Discord Developer Portal as:
/// http://localhost:17420/callback
const OAUTH_PORT: u16 = 17420;

/// Result of the OAuth callback — the authorization code from Discord.
#[derive(Serialize, Clone)]
pub struct OAuthCallbackResult {
    pub code: String,
    pub redirect_uri: String,
}

/// Listen for the Discord OAuth callback on a fixed port.
/// The frontend opens the Discord auth URL BEFORE calling this command
/// (the user takes seconds to authenticate, giving us time to start listening).
///
/// Flow:
/// 1. Frontend opens Discord auth in browser with redirect_uri=http://localhost:17420/callback
/// 2. Frontend calls this command (starts listening)
/// 3. User authenticates on Discord
/// 4. Discord redirects to localhost:17420/callback?code=xxx
/// 5. This command catches the code and returns it
#[tauri::command]
pub async fn await_oauth_callback() -> Result<OAuthCallbackResult, String> {
    let (tx, rx) = std::sync::mpsc::channel::<Result<OAuthCallbackResult, String>>();

    let redirect_uri = format!("http://localhost:{}/callback", OAUTH_PORT);

    std::thread::spawn(move || {
        // Try to bind — if the port is busy, fail immediately
        let listener = match TcpListener::bind(format!("127.0.0.1:{}", OAUTH_PORT)) {
            Ok(l) => l,
            Err(e) => {
                let _ = tx.send(Err(format!("Port {} busy: {}", OAUTH_PORT, e)));
                return;
            }
        };

        listener.set_nonblocking(true).ok();
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(300);

        loop {
            if std::time::Instant::now() > deadline {
                let _ = tx.send(Err("OAuth timeout — no callback received".to_string()));
                return;
            }

            match listener.accept() {
                Ok((mut stream, _)) => {
                    stream.set_nonblocking(false).ok();
                    let mut buf = [0u8; 4096];
                    let n = stream.read(&mut buf).unwrap_or(0);
                    let request = String::from_utf8_lossy(&buf[..n]).to_string();

                    let code = extract_code(&request);

                    let body = if code.is_some() {
                        r#"<!DOCTYPE html><html><body style="background:#0b0d11;color:#c4cacf;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#4fbef7">&#10003; Signed in to Slipgate</h2><p>You can close this tab and return to the app.</p></div></body></html>"#
                    } else {
                        r#"<!DOCTYPE html><html><body style="background:#0b0d11;color:#c4cacf;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#e05050">Authentication failed</h2><p>Please try again in the app.</p></div></body></html>"#
                    };

                    let resp = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(), body
                    );
                    let _ = stream.write_all(resp.as_bytes());
                    let _ = stream.flush();

                    let _ = tx.send(match code {
                        Some(c) => Ok(OAuthCallbackResult {
                            code: c,
                            redirect_uri: format!("http://localhost:{}/callback", OAUTH_PORT),
                        }),
                        None => Err("No code in callback".to_string()),
                    });
                    return;
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                Err(e) => {
                    let _ = tx.send(Err(format!("Listener error: {}", e)));
                    return;
                }
            }
        }
    });

    // Poll the channel without blocking the async runtime
    loop {
        match rx.try_recv() {
            Ok(result) => return result,
            Err(std::sync::mpsc::TryRecvError::Empty) => {
                // Yield to async runtime
                #[cfg(target_os = "windows")]
                std::thread::sleep(std::time::Duration::from_millis(50));
                #[cfg(not(target_os = "windows"))]
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                return Err("OAuth listener thread disconnected".to_string());
            }
        }
    }
}

fn extract_code(request: &str) -> Option<String> {
    let first_line = request.lines().next()?;
    let path = first_line.split_whitespace().nth(1)?;
    let query = path.split('?').nth(1)?;
    for param in query.split('&') {
        let mut kv = param.splitn(2, '=');
        if let (Some("code"), Some(value)) = (kv.next(), kv.next()) {
            return Some(value.to_string());
        }
    }
    None
}
