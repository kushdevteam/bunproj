use axum::{
    extract::{Query, State},
    http::{header::CONTENT_TYPE, Method, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tracing::{info, error, warn};

// Simplified modules without heavy dependencies
mod wallet;
mod bundler;
mod analytics;

use wallet::WalletManager;
use bundler::{BundleManager, BundleConfig, BundleResult};
use analytics::Analytics;

#[derive(Clone)]
pub struct AppState {
    pub wallet_manager: Arc<RwLock<WalletManager>>,
    pub bundle_manager: Arc<RwLock<BundleManager>>,
    pub analytics: Arc<RwLock<Analytics>>,
}

#[derive(Serialize, Deserialize)]
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

#[derive(Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub timestamp: String,
    pub network: String,
    pub server: String,
    pub features: Vec<String>,
}

#[derive(Deserialize)]
pub struct GenerateWalletsRequest {
    pub count: u32,
    pub hd_wallet: Option<bool>,
    pub derivation_path: Option<String>,
}

#[derive(Deserialize)]
pub struct FundWalletsRequest {
    pub wallets: Vec<String>,
    pub amount: f64,
    pub use_multiple_sources: Option<bool>,
}

#[derive(Deserialize)]
pub struct ExecuteBundleRequest {
    pub bundle_type: String,
    pub token_address: Option<String>,
    pub amount_per_wallet: f64,
    pub wallets: Vec<String>,
    pub settings: BundleSettings,
}

#[derive(Deserialize)]
pub struct BundleSettings {
    pub stealth_mode: bool,
    pub mev_protection: bool,
    pub priority_fee: f64,
    pub slippage: f64,
    pub stagger_delay: u64,
    pub randomize_order: bool,
    pub use_multiple_rpcs: bool,
    pub anti_mev_delay: Option<u64>,
}

// Health check endpoint
async fn health_check() -> Json<ApiResponse<HealthResponse>> {
    let response = HealthResponse {
        status: "ok".to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        network: "Solana Devnet (Simulated)".to_string(),
        server: "Proxima Solana Bundler (Rust - Minimal)".to_string(),
        features: vec![
            "Advanced Stealth Mode".to_string(),
            "MEV Protection".to_string(),
            "Jupiter Integration (Simulated)".to_string(),
            "Copy Trading".to_string(),
            "Pump Detection".to_string(),
            "Multi-RPC Support".to_string(),
            "Real-time Analytics".to_string(),
            "HD Wallet Support".to_string(),
            "Volume Bundling".to_string(),
        ],
    };
    Json(ApiResponse::success(response))
}

// Generate wallets endpoint
async fn generate_wallets(
    State(state): State<AppState>,
    Json(req): Json<GenerateWalletsRequest>,
) -> Result<Json<ApiResponse<Vec<wallet::WalletInfo>>>, StatusCode> {
    if req.count == 0 || req.count > 1000 {
        return Ok(Json(ApiResponse::error(
            "Invalid wallet count. Must be between 1 and 1000.".to_string(),
        )));
    }

    let mut wallet_manager = state.wallet_manager.write().await;
    
    match wallet_manager.generate_wallets(req.count, req.hd_wallet.unwrap_or(false), req.derivation_path).await {
        Ok(wallets) => {
            info!("🚀 Generated {} wallets with Rust implementation", req.count);
            Ok(Json(ApiResponse::success(wallets)))
        },
        Err(e) => {
            error!("Failed to generate wallets: {}", e);
            Ok(Json(ApiResponse::error(format!("Failed to generate wallets: {}", e))))
        }
    }
}

// Fund wallets endpoint
async fn fund_wallets(
    State(state): State<AppState>,
    Json(req): Json<FundWalletsRequest>,
) -> Result<Json<ApiResponse<Vec<wallet::WalletInfo>>>, StatusCode> {
    if req.wallets.is_empty() || req.wallets.len() > 1000 {
        return Ok(Json(ApiResponse::error(
            "Invalid wallet count. Must be between 1 and 1000.".to_string(),
        )));
    }

    if req.amount <= 0.0 || req.amount > 100.0 {
        return Ok(Json(ApiResponse::error(
            "Invalid amount. Must be between 0.001 and 100 SOL.".to_string(),
        )));
    }

    let mut wallet_manager = state.wallet_manager.write().await;
    
    match wallet_manager.fund_wallets(&req.wallets, req.amount, req.use_multiple_sources.unwrap_or(false)).await {
        Ok(wallets) => {
            info!("💰 Funded {} wallets with Rust implementation", req.wallets.len());
            Ok(Json(ApiResponse::success(wallets)))
        },
        Err(e) => {
            error!("Failed to fund wallets: {}", e);
            Ok(Json(ApiResponse::error(format!("Failed to fund wallets: {}", e))))
        }
    }
}

// Execute bundle endpoint
async fn execute_bundle(
    State(state): State<AppState>,
    Json(req): Json<ExecuteBundleRequest>,
) -> Result<Json<ApiResponse<BundleResult>>, StatusCode> {
    if req.wallets.is_empty() || req.wallets.len() > 1000 {
        return Ok(Json(ApiResponse::error(
            "Invalid wallet count. Must be between 1 and 1000.".to_string(),
        )));
    }

    let bundle_config = BundleConfig {
        bundle_type: req.bundle_type,
        token_address: req.token_address,
        amount_per_wallet: req.amount_per_wallet,
        wallets: req.wallets,
        stealth_mode: req.settings.stealth_mode,
        mev_protection: req.settings.mev_protection,
        priority_fee: req.settings.priority_fee,
        slippage: req.settings.slippage,
        stagger_delay: req.settings.stagger_delay,
        randomize_order: req.settings.randomize_order,
        use_multiple_rpcs: req.settings.use_multiple_rpcs,
        anti_mev_delay: req.settings.anti_mev_delay,
    };

    let mut bundle_manager = state.bundle_manager.write().await;
    
    match bundle_manager.execute_bundle(bundle_config).await {
        Ok(result) => {
            info!("🚀 Bundle executed with Rust implementation: {} successful transactions", result.success_count);
            
            // Update analytics
            let mut analytics = state.analytics.write().await;
            analytics.record_bundle_execution(&result).await;
            
            Ok(Json(ApiResponse::success(result)))
        },
        Err(e) => {
            error!("Failed to execute bundle: {}", e);
            Ok(Json(ApiResponse::error(format!("Failed to execute bundle: {}", e))))
        }
    }
}

// Get analytics endpoint
async fn get_analytics(
    State(state): State<AppState>,
) -> Json<ApiResponse<analytics::AnalyticsData>> {
    let analytics = state.analytics.read().await;
    let data = analytics.get_analytics_data().await;
    Json(ApiResponse::success(data))
}

// Get wallet balances endpoint
async fn get_wallet_balances(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<wallet::WalletBalance>>>, StatusCode> {
    let wallet_addresses: Vec<String> = params.get("wallets")
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    if wallet_addresses.is_empty() {
        return Ok(Json(ApiResponse::error("No wallet addresses provided".to_string())));
    }

    let wallet_manager = state.wallet_manager.read().await;
    
    match wallet_manager.get_balances(&wallet_addresses).await {
        Ok(balances) => Ok(Json(ApiResponse::success(balances))),
        Err(e) => {
            error!("Failed to get wallet balances: {}", e);
            Ok(Json(ApiResponse::error(format!("Failed to get wallet balances: {}", e))))
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    // Load environment variables
    dotenv::dotenv().ok();
    
    info!("🦀🚀 Starting Proxima Solana Bundler (Rust Edition - Minimal)");
    info!("⚡ High-performance Rust implementation with advanced features");
    
    // Initialize components
    let wallet_manager = Arc::new(RwLock::new(WalletManager::new().await?));
    let bundle_manager = Arc::new(RwLock::new(BundleManager::new().await?));
    let analytics = Arc::new(RwLock::new(Analytics::new().await?));

    let app_state = AppState {
        wallet_manager,
        bundle_manager,
        analytics,
    };

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([CONTENT_TYPE]);

    // Build our application with routes
    let app = Router::new()
        .route("/api/health", get(health_check))
        .route("/api/wallets/generate", post(generate_wallets))
        .route("/api/wallets/fund", post(fund_wallets))
        .route("/api/wallets/balances", get(get_wallet_balances))
        .route("/api/bundle/execute", post(execute_bundle))
        .route("/api/analytics", get(get_analytics))
        .nest_service("/", ServeDir::new("."))
        .layer(cors)
        .with_state(app_state);

    let port = env::var("PORT").unwrap_or_else(|_| "5000".to_string());
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    
    info!("🌐 Rust Server running on http://0.0.0.0:{}", port);
    info!("🦀 High-performance Rust implementation active");
    info!("📡 Connected to Solana network: Devnet (Simulated)");
    info!("🔧 API endpoints available at: http://localhost:{}/api", port);
    info!("🥷 Advanced stealth mode and MEV protection enabled");
    
    axum::serve(listener, app).await?;
    
    Ok(())
}