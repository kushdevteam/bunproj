use std::collections::HashMap;
use std::net::SocketAddr;

// Simple HTTP response builder
fn build_response(status: u16, content_type: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {} OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n\r\n{}",
        status,
        content_type,
        body.len(),
        body
    )
}

fn handle_health() -> String {
    let response_body = r#"{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-09-25T11:05:00Z",
    "network": "BNB Smart Chain Testnet (Rust)",
    "server": "JustJewIt Smart Chain Bundler (Rust Backend)",
    "features": [
      "Wallet Generation",
      "Multi-Wallet Bundling", 
      "Transaction Simulation",
      "Bundle Execution",
      "Balance Checking",
      "BNB Chain Integration"
    ]
  }
}"#;
    build_response(200, "application/json", response_body)
}

fn handle_generate_wallets(body: &str) -> String {
    // Simple mock wallet generation
    let count = if let Ok(json) = serde_json::from_str::<serde_json::Value>(body) {
        json.get("count").and_then(|c| c.as_u64()).unwrap_or(5) as usize
    } else {
        5
    };

    let mut wallets = Vec::new();
    for i in 0..count.min(100) {
        wallets.push(format!(
            r#"{{
      "address": "0x{:040x}",
      "balance_bnb": 0.0,
      "balance_tokens": 0.0,
      "created_at": "2025-09-25T11:05:00Z"
    }}"#,
            i + 1
        ));
    }

    let response_body = format!(
        r#"{{
  "success": true,
  "data": [{}]
}}"#,
        wallets.join(",")
    );
    build_response(200, "application/json", &response_body)
}

fn handle_request(request: &str) -> String {
    let lines: Vec<&str> = request.lines().collect();
    if lines.is_empty() {
        return build_response(400, "text/plain", "Bad Request");
    }

    let request_line = lines[0];
    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        return build_response(400, "text/plain", "Bad Request");
    }

    let method = parts[0];
    let path = parts[1];

    match (method, path) {
        ("GET", "/api/health") => handle_health(),
        ("POST", "/api/wallets/generate") => {
            // Extract body from request
            if let Some(body_start) = request.find("\r\n\r\n") {
                let body = &request[body_start + 4..];
                handle_generate_wallets(body)
            } else {
                handle_generate_wallets("{\"count\": 5}")
            }
        }
        ("OPTIONS", _) => build_response(204, "text/plain", ""),
        _ => {
            // Serve simple frontend for root path
            if path == "/" {
                let html = include_str!("frontend.html");
                build_response(200, "text/html", html)
            } else {
                build_response(404, "text/plain", "Not Found")
            }
        }
    }
}

fn main() -> std::io::Result<()> {
    use std::io::prelude::*;
    use std::net::{TcpListener, TcpStream};

    let listener = TcpListener::bind("0.0.0.0:8000")?;
    println!("🦀 BNB Chain Multi-Wallet Bundler (Minimal Rust Backend)");
    println!("🌐 Listening on http://0.0.0.0:8000");
    println!("🔗 Ready for BNB Smart Chain integration");

    for stream in listener.incoming() {
        match stream {
            Ok(mut stream) => {
                let mut buffer = [0; 4096];
                if let Ok(size) = stream.read(&mut buffer) {
                    let request = String::from_utf8_lossy(&buffer[..size]);
                    let response = handle_request(&request);
                    let _ = stream.write_all(response.as_bytes());
                    let _ = stream.flush();
                }
            }
            Err(e) => eprintln!("Error accepting connection: {}", e),
        }
    }

    Ok(())
}