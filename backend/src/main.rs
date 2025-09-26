use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use std::collections::HashMap;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing::{info, error};

use bnb_bundler_shared::*;

#[derive(Clone)]
pub struct AppState {
    // Simplified state for now
}

// Health check endpoint
async fn health_check() -> Json<ApiResponse<HealthResponse>> {
    let response = HealthResponse {
        status: "ok".to_string(),
        timestamp: chrono::Utc::now(),
        network: "BNB Smart Chain Testnet (Mock)".to_string(),
        server: "BNB Bundler (Rust Backend)".to_string(),
        features: vec![
            "Wallet Generation".to_string(),
            "Multi-Wallet Bundling".to_string(),
            "BNB Chain Integration".to_string(),
            "PancakeSwap Ready".to_string(),
            "Gas Optimization".to_string(),
        ],
        block_number: Some(12345678),
        gas_price_gwei: Some(5),
    };
    Json(ApiResponse::success(response))
}

/// SECURITY FIX: Deprecated wallet generation endpoint
/// Private keys should NEVER be generated on the backend
async fn generate_wallets(
    Json(req): Json<GenerateWalletsRequest>,
) -> Result<Json<ApiResponse<Vec<WalletInfo>>>, StatusCode> {
    warn!("🚨 SECURITY: Backend wallet generation endpoint called - this is deprecated");
    warn!("🔒 SECURITY: Use client-side wallet generation instead");
    warn!("Request attempted to generate {} wallets - BLOCKED for security", req.count);
    
    // Return error to force client-side generation
    Ok(Json(ApiResponse::error(
        "SECURITY: Backend wallet generation disabled. Generate wallets client-side only.".to_string()
    )))
}

// Get wallet balances endpoint (mock implementation)
async fn get_balances(
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<WalletBalance>>>, StatusCode> {
    let wallet_addresses: Vec<String> = params.get("wallets")
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    if wallet_addresses.is_empty() {
        return Ok(Json(ApiResponse::error("No wallet addresses provided".to_string())));
    }

    let balances: Vec<WalletBalance> = wallet_addresses.into_iter().map(|address| {
        WalletBalance {
            address,
            balance_bnb: 0.0, // Mock balance for now
            balance_tokens: 0.0,
        }
    }).collect();

    Ok(Json(ApiResponse::success(balances)))
}

// Distribute BNB endpoint (mock implementation)
async fn distribute_bnb(
    Json(req): Json<DistributeRequest>,
) -> Result<Json<ApiResponse<BundleResult>>, StatusCode> {
    let bundle_id = uuid::Uuid::new_v4().to_string();
    
    let mut result = BundleResult::new(bundle_id.clone(), BundleType::Distribute);
    result.total_transactions = req.to_wallets.len() as u32;
    result.success_count = req.to_wallets.len() as u32; // Mock success
    
    // Create mock transactions
    for wallet_address in req.to_wallets {
        result.transactions.push(TransactionResult {
            wallet_address,
            tx_hash: Some(format!("0x{:064x}", rand::random::<u64>())),
            status: TransactionStatus::Confirmed,
            amount_bnb: req.amount_per_wallet,
            gas_used: 21000,
            gas_price_gwei: req.settings.priority_fee_gwei,
            error: None,
            execution_time_ms: 1000,
        });
    }

    info!("Mock distribution completed: {}", bundle_id);
    Ok(Json(ApiResponse::success(result)))
}

// Serve the frontend (simplified)
async fn serve_frontend() -> Result<String, StatusCode> {
    Ok(r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>BNB Chain Multi-Wallet Bundler</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #0a0a0a; 
            color: #fff;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
        }
        .header { 
            text-align: center; 
            margin-bottom: 40px; 
        }
        .card { 
            background: #1a1a1a; 
            border: 1px solid #333; 
            border-radius: 12px; 
            padding: 20px; 
            margin-bottom: 20px; 
        }
        .btn { 
            background: #00ff88; 
            color: #000; 
            border: none; 
            padding: 12px 24px; 
            border-radius: 8px; 
            cursor: pointer; 
            font-weight: 600; 
        }
        .btn:hover { 
            background: #00dd77; 
        }
        #status { 
            color: #00ff88; 
        }
        #wallets { 
            margin-top: 20px; 
        }
        .wallet-item { 
            background: #2a2a2a; 
            padding: 10px; 
            margin: 5px 0; 
            border-radius: 6px; 
            font-family: monospace; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🦀 BNB Chain Multi-Wallet Bundler</h1>
            <p>Rust Backend with Axum + ethers-rs</p>
            <div id="status">✅ Backend is running!</div>
        </div>

        <div class="card">
            <h3>🔧 API Health Check</h3>
            <button class="btn" onclick="checkHealth()">Check API Health</button>
            <div id="health-result"></div>
        </div>

        <div class="card">
            <h3>💰 Wallet Generator</h3>
            <input type="number" id="wallet-count" value="5" min="1" max="100" style="background: #2a2a2a; color: #fff; border: 1px solid #333; padding: 8px; border-radius: 4px;">
            <button class="btn" onclick="generateWallets()">Generate Wallets</button>
            <div id="wallets"></div>
        </div>

        <div class="card">
            <h3>📊 Network Information</h3>
            <p><strong>Network:</strong> BNB Smart Chain Testnet</p>
            <p><strong>RPC:</strong> Mock Implementation (Ready for ethers-rs)</p>
            <p><strong>Features:</strong> Wallet Generation, Bundle Execution, Gas Optimization</p>
        </div>
    </div>

    <script>
        async function checkHealth() {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                document.getElementById('health-result').innerHTML = 
                    `<pre style="color: #00ff88; margin-top: 10px;">${JSON.stringify(data, null, 2)}</pre>`;
            } catch (error) {
                document.getElementById('health-result').innerHTML = 
                    `<p style="color: #ff4444;">Error: ${error.message}</p>`;
            }
        }

        async function generateWallets() {
            const count = document.getElementById('wallet-count').value;
            try {
                const response = await fetch('/api/wallets/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ count: parseInt(count) })
                });
                const data = await response.json();
                
                if (data.success) {
                    const walletsHtml = data.data.map(wallet => 
                        `<div class="wallet-item">${wallet.address} - ${wallet.balance_bnb} BNB</div>`
                    ).join('');
                    document.getElementById('wallets').innerHTML = walletsHtml;
                } else {
                    document.getElementById('wallets').innerHTML = 
                        `<p style="color: #ff4444;">Error: ${data.error}</p>`;
                }
            } catch (error) {
                document.getElementById('wallets').innerHTML = 
                    `<p style="color: #ff4444;">Error: ${error.message}</p>`;
            }
        }

        // Auto-check health on load
        checkHealth();
    </script>
</body>
</html>"#.to_string())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    info!("🦀 Starting BNB Chain Multi-Wallet Bundler (Foundation)");
    
    let app_state = AppState {};

    // Build application with routes
    let app = Router::new()
        .route("/", get(serve_frontend))
        .route("/api/health", get(health_check))
        .route("/api/wallets/generate", post(generate_wallets))
        .route("/api/wallets/balances", get(get_balances))
        .route("/api/distribute", post(distribute_bnb))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8000").await?;
    
    info!("🌐 BNB Bundler Backend running on http://0.0.0.0:8000");
    info!("🔗 Ready for BNB Smart Chain integration");
    info!("📡 API endpoints: /api/health, /api/wallets/generate, /api/wallets/balances, /api/distribute");
    info!("🎯 Foundation complete - ethers-rs integration ready for next phase");
    
    axum::serve(listener, app).await?;
    
    Ok(())
}