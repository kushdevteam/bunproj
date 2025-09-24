use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing::{info, error};

mod wallet;
mod bundle;
mod solana_client;

use wallet::{WalletManager, WalletRequest, FundRequest};
use bundle::{BundleManager, BundleRequest, BundleResult};

#[derive(Clone)]
pub struct AppState {
    pub wallet_manager: Arc<WalletManager>,
    pub bundle_manager: Arc<BundleManager>,
}

#[derive(Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub timestamp: String,
    pub network: String,
    pub server: String,
    pub features: Vec<String>,
}

// Health check endpoint
async fn health_check() -> Json<ApiResponse<HealthResponse>> {
    let response = HealthResponse {
        status: "ok".to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        network: "Solana Devnet".to_string(),
        server: "Proxima Solana Bundler (Rust)".to_string(),
        features: vec![
            "Wallet Generation".to_string(),
            "Multi-Wallet Bundling".to_string(),
            "Transaction Simulation".to_string(),
            "Bundle Execution".to_string(),
            "Balance Checking".to_string(),
        ],
    };
    Json(ApiResponse::success(response))
}

// Generate wallets endpoint
async fn generate_wallets(
    State(state): State<AppState>,
    Json(req): Json<WalletRequest>,
) -> Result<Json<ApiResponse<Vec<wallet::WalletInfo>>>, StatusCode> {
    match state.wallet_manager.generate_wallets(req.count).await {
        Ok(wallets) => {
            info!("Generated {} wallets", req.count);
            Ok(Json(ApiResponse::success(wallets)))
        },
        Err(e) => {
            error!("Failed to generate wallets: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

// Fund wallets endpoint
async fn fund_wallets(
    State(state): State<AppState>,
    Json(req): Json<FundRequest>,
) -> Result<Json<ApiResponse<Vec<wallet::WalletInfo>>>, StatusCode> {
    match state.wallet_manager.fund_wallets(&req.wallets, req.amount).await {
        Ok(wallets) => {
            info!("Funded {} wallets with {} SOL each", req.wallets.len(), req.amount);
            Ok(Json(ApiResponse::success(wallets)))
        },
        Err(e) => {
            error!("Failed to fund wallets: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

// Get wallet balances endpoint
async fn get_balances(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<wallet::WalletBalance>>>, StatusCode> {
    let wallet_addresses: Vec<String> = params.get("wallets")
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    if wallet_addresses.is_empty() {
        return Ok(Json(ApiResponse::error("No wallet addresses provided".to_string())));
    }

    match state.wallet_manager.get_balances(&wallet_addresses).await {
        Ok(balances) => Ok(Json(ApiResponse::success(balances))),
        Err(e) => {
            error!("Failed to get balances: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

// Execute bundle endpoint
async fn execute_bundle(
    State(state): State<AppState>,
    Json(req): Json<BundleRequest>,
) -> Result<Json<ApiResponse<BundleResult>>, StatusCode> {
    match state.bundle_manager.execute_bundle(req, &state.wallet_manager).await {
        Ok(result) => {
            info!("Bundle executed successfully: {} transactions", result.transactions.len());
            Ok(Json(ApiResponse::success(result)))
        },
        Err(e) => {
            error!("Failed to execute bundle: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

// Serve the frontend
async fn serve_frontend() -> Result<String, StatusCode> {
    Ok(include_str!("../frontend.html").to_string())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    info!("🦀 Starting Proxima Solana Bundler (Rust Edition)");
    
    // Initialize components
    let wallet_manager = Arc::new(WalletManager::new().await?);
    let bundle_manager = Arc::new(BundleManager::new().await?);

    let app_state = AppState {
        wallet_manager,
        bundle_manager,
    };

    // Build application with routes
    let app = Router::new()
        .route("/", get(serve_frontend))
        .route("/api/health", get(health_check))
        .route("/api/wallets/generate", post(generate_wallets))
        .route("/api/wallets/fund", post(fund_wallets))
        .route("/api/wallets/balances", get(get_balances))
        .route("/api/bundle/execute", post(execute_bundle))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:5000").await?;
    
    info!("🌐 Rust Server running on http://0.0.0.0:5000");
    info!("📡 Connected to Solana network: Devnet");
    info!("🔧 API endpoints available at: http://localhost:5000/api");
    
    axum::serve(listener, app).await?;
    
    Ok(())
}