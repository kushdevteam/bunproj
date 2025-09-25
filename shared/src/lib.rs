use serde::{Deserialize, Serialize};
// use ethers::types::{Address, U256}; // Temporarily commented for foundation
use uuid::Uuid;
use chrono::{DateTime, Utc};

// Common API response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
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

// Wallet types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletInfo {
    pub address: String,
    pub balance_bnb: f64,
    pub balance_tokens: f64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletBalance {
    pub address: String,
    pub balance_bnb: f64,
    pub balance_tokens: f64,
}

#[derive(Debug, Deserialize)]
pub struct GenerateWalletsRequest {
    pub count: u32,
}

#[derive(Debug, Deserialize)]
pub struct FundWalletsRequest {
    pub wallets: Vec<String>,
    pub amount_bnb: f64,
}

// Bundle types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleRequest {
    pub bundle_type: BundleType,
    pub token_address: Option<String>,
    pub amount_per_wallet: f64,
    pub wallets: Vec<String>,
    pub settings: BundleSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BundleType {
    Buy,
    Sell,
    Distribute,
    Volume,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleSettings {
    pub priority_fee_gwei: u64,
    pub slippage_percent: f64,
    pub stagger_delay_ms: u64,
    pub stealth_mode: bool,
    pub mev_protection: bool,
    pub gas_limit: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleResult {
    pub bundle_id: String,
    pub bundle_type: BundleType,
    pub success_count: u32,
    pub total_transactions: u32,
    pub transactions: Vec<TransactionResult>,
    pub execution_time_ms: u64,
    pub total_cost_bnb: f64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionResult {
    pub wallet_address: String,
    pub tx_hash: Option<String>,
    pub status: TransactionStatus,
    pub amount_bnb: f64,
    pub gas_used: u64,
    pub gas_price_gwei: u64,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransactionStatus {
    Pending,
    Confirmed,
    Failed,
}

// Health check response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub timestamp: DateTime<Utc>,
    pub network: String,
    pub server: String,
    pub features: Vec<String>,
    pub block_number: Option<u64>,
    pub gas_price_gwei: Option<u64>,
}

// Distribution types
#[derive(Debug, Deserialize)]
pub struct DistributeRequest {
    pub from_wallet: String,
    pub to_wallets: Vec<String>,
    pub amount_per_wallet: f64,
    pub settings: BundleSettings,
}

// Error types
#[derive(Debug, thiserror::Error)]
pub enum BundlerError {
    #[error("Wallet error: {0}")]
    Wallet(String),
    
    #[error("Network error: {0}")]
    Network(String),
    
    #[error("Transaction error: {0}")]
    Transaction(String),
    
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Configuration error: {0}")]
    Config(String),
}

// Constants
pub const BSC_TESTNET_CHAIN_ID: u64 = 97;
pub const BSC_MAINNET_CHAIN_ID: u64 = 56;
pub const DEFAULT_GAS_LIMIT: u64 = 21_000;
pub const DEFAULT_GAS_PRICE_GWEI: u64 = 5;

// Utility functions
impl WalletInfo {
    pub fn new(address: String) -> Self {
        Self {
            address,
            balance_bnb: 0.0,
            balance_tokens: 0.0,
            created_at: Utc::now(),
        }
    }
}

impl Default for BundleSettings {
    fn default() -> Self {
        Self {
            priority_fee_gwei: DEFAULT_GAS_PRICE_GWEI,
            slippage_percent: 0.5,
            stagger_delay_ms: 100,
            stealth_mode: false,
            mev_protection: false,
            gas_limit: Some(DEFAULT_GAS_LIMIT),
        }
    }
}

impl BundleResult {
    pub fn new(bundle_id: String, bundle_type: BundleType) -> Self {
        Self {
            bundle_id,
            bundle_type,
            success_count: 0,
            total_transactions: 0,
            transactions: Vec::new(),
            execution_time_ms: 0,
            total_cost_bnb: 0.0,
            timestamp: Utc::now(),
        }
    }
}