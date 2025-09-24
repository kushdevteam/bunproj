use anyhow::Result;
use parking_lot::RwLock;
use rand::Rng;
use serde::{Deserialize, Serialize};
use ed25519_dalek::Keypair;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::{info, warn, error};
use uuid::Uuid;

use crate::solana_client::SolanaClient;
use crate::wallet::WalletManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleRequest {
    pub bundle_type: String,
    pub token_address: Option<String>,
    pub amount_per_wallet: f64,
    pub wallets: Vec<String>,
    pub settings: BundleSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleSettings {
    pub priority_fee: f64,
    pub slippage: f64,
    pub stagger_delay: u64,
    pub stealth_mode: bool,
    pub mev_protection: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleResult {
    pub bundle_id: String,
    pub bundle_type: String,
    pub success_count: u32,
    pub total_transactions: u32,
    pub transactions: Vec<TransactionResult>,
    pub execution_time_ms: u64,
    pub total_cost: f64,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionResult {
    pub wallet: String,
    pub signature: Option<String>,
    pub status: String,
    pub amount: f64,
    pub fee: f64,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

pub struct BundleManager {
    bundles: Arc<RwLock<HashMap<String, BundleResult>>>,
    solana_client: SolanaClient,
}

impl BundleManager {
    pub async fn new() -> Result<Self> {
        Ok(Self {
            bundles: Arc::new(RwLock::new(HashMap::new())),
            solana_client: SolanaClient::new(),
        })
    }

    pub async fn execute_bundle(
        &self,
        request: BundleRequest,
        wallet_manager: &WalletManager,
    ) -> Result<BundleResult> {
        let bundle_id = Uuid::new_v4().to_string();
        let start_time = Instant::now();

        info!(
            "Executing bundle {} with {} wallets for {}",
            bundle_id, request.wallets.len(), request.bundle_type
        );

        if request.wallets.is_empty() {
            return Err(anyhow::anyhow!("No wallets provided for bundle"));
        }

        if request.amount_per_wallet <= 0.0 {
            return Err(anyhow::anyhow!("Invalid amount per wallet"));
        }

        let mut transactions = Vec::new();
        let mut success_count = 0;
        let mut total_cost = 0.0;

        // Execute transactions for each wallet
        for (index, wallet_address) in request.wallets.iter().enumerate() {
            let tx_start = Instant::now();

            // Apply stagger delay for stealth mode
            if request.settings.stealth_mode && index > 0 {
                let delay_ms = if request.settings.mev_protection {
                    // Add randomization for MEV protection
                    let base_delay = request.settings.stagger_delay;
                    let random_factor = rand::thread_rng().gen_range(0.5..1.5);
                    (base_delay as f64 * random_factor) as u64
                } else {
                    request.settings.stagger_delay
                };
                
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
            }

            // Execute the transaction based on bundle type
            let tx_result = self.execute_transaction(
                &request.bundle_type,
                wallet_address,
                request.amount_per_wallet,
                &request.settings,
                wallet_manager,
            ).await;

            let execution_time_ms = tx_start.elapsed().as_millis() as u64;

            match tx_result {
                Ok((signature, actual_amount, fee)) => {
                    success_count += 1;
                    total_cost += actual_amount + fee;

                    transactions.push(TransactionResult {
                        wallet: wallet_address.clone(),
                        signature: Some(signature),
                        status: "confirmed".to_string(),
                        amount: actual_amount,
                        fee,
                        error: None,
                        execution_time_ms,
                    });

                    // Update wallet balance
                    let new_balance = match request.bundle_type.as_str() {
                        "buy" => {
                            // Buying tokens reduces SOL balance
                            wallet_manager.update_balance(
                                wallet_address,
                                0.0 // In real implementation, query actual balance
                            ).await;
                            0.0
                        },
                        "sell" => {
                            // Selling tokens increases SOL balance  
                            let new_balance = actual_amount * 0.95; // Simulate slippage
                            wallet_manager.update_balance(wallet_address, new_balance).await;
                            new_balance
                        },
                        _ => 0.0,
                    };

                    info!("✅ Transaction successful for wallet {}: {} SOL", 
                          &wallet_address[..8], actual_amount);
                },
                Err(e) => {
                    transactions.push(TransactionResult {
                        wallet: wallet_address.clone(),
                        signature: None,
                        status: "failed".to_string(),
                        amount: request.amount_per_wallet,
                        fee: 0.0,
                        error: Some(e.to_string()),
                        execution_time_ms,
                    });

                    warn!("❌ Transaction failed for wallet {}: {}", 
                          &wallet_address[..8], e);
                }
            }
        }

        let execution_time_ms = start_time.elapsed().as_millis() as u64;

        let bundle_result = BundleResult {
            bundle_id: bundle_id.clone(),
            bundle_type: request.bundle_type,
            success_count,
            total_transactions: request.wallets.len() as u32,
            transactions,
            execution_time_ms,
            total_cost,
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        // Store bundle result
        {
            let mut bundles = self.bundles.write();
            bundles.insert(bundle_id.clone(), bundle_result.clone());
        }

        info!(
            "Bundle {} completed: {}/{} successful transactions in {}ms",
            bundle_id, success_count, request.wallets.len(), execution_time_ms
        );

        Ok(bundle_result)
    }

    async fn execute_transaction(
        &self,
        bundle_type: &str,
        wallet_address: &str,
        amount: f64,
        settings: &BundleSettings,
        wallet_manager: &WalletManager,
    ) -> Result<(String, f64, f64)> {
        // Get wallet keypair
        let keypair = wallet_manager.get_keypair(wallet_address)
            .ok_or_else(|| anyhow::anyhow!("Wallet not found: {}", wallet_address))?;

        // Simulate different transaction types
        let (signature, actual_amount, fee) = match bundle_type {
            "buy" => {
                self.simulate_buy_transaction(&keypair, amount, settings).await?
            },
            "sell" => {
                self.simulate_sell_transaction(&keypair, amount, settings).await?
            },
            "distribute" => {
                self.simulate_distribute_transaction(&keypair, amount, settings).await?
            },
            "volume" => {
                self.simulate_volume_transaction(&keypair, amount, settings).await?
            },
            _ => {
                return Err(anyhow::anyhow!("Unsupported bundle type: {}", bundle_type));
            }
        };

        Ok((signature, actual_amount, fee))
    }

    async fn simulate_buy_transaction(
        &self,
        keypair: &Keypair,
        amount: f64,
        settings: &BundleSettings,
    ) -> Result<(String, f64, f64)> {
        // Simulate transaction processing time
        let processing_time = rand::thread_rng().gen_range(200..800);
        tokio::time::sleep(Duration::from_millis(processing_time)).await;

        // Simulate 95% success rate for buy transactions
        if rand::thread_rng().gen::<f64>() > 0.05 {
            let signature = self.generate_signature();
            let fee = settings.priority_fee;
            Ok((signature, amount, fee))
        } else {
            Err(anyhow::anyhow!("Buy transaction failed - slippage exceeded"))
        }
    }

    async fn simulate_sell_transaction(
        &self,
        keypair: &Keypair,
        amount: f64,
        settings: &BundleSettings,
    ) -> Result<(String, f64, f64)> {
        let processing_time = rand::thread_rng().gen_range(300..1000);
        tokio::time::sleep(Duration::from_millis(processing_time)).await;

        if rand::thread_rng().gen::<f64>() > 0.03 {
            let signature = self.generate_signature();
            let fee = settings.priority_fee;
            // Apply slippage
            let slippage_factor = 1.0 - (settings.slippage / 100.0);
            let actual_amount = amount * slippage_factor;
            Ok((signature, actual_amount, fee))
        } else {
            Err(anyhow::anyhow!("Sell transaction failed - insufficient liquidity"))
        }
    }

    async fn simulate_distribute_transaction(
        &self,
        keypair: &Keypair,
        amount: f64,
        settings: &BundleSettings,
    ) -> Result<(String, f64, f64)> {
        let processing_time = rand::thread_rng().gen_range(150..500);
        tokio::time::sleep(Duration::from_millis(processing_time)).await;

        if rand::thread_rng().gen::<f64>() > 0.01 {
            let signature = self.generate_signature();
            let fee = settings.priority_fee;
            Ok((signature, amount, fee))
        } else {
            Err(anyhow::anyhow!("Distribution failed - network error"))
        }
    }

    async fn simulate_volume_transaction(
        &self,
        keypair: &Keypair,
        amount: f64,
        settings: &BundleSettings,
    ) -> Result<(String, f64, f64)> {
        let processing_time = rand::thread_rng().gen_range(100..400);
        tokio::time::sleep(Duration::from_millis(processing_time)).await;

        if rand::thread_rng().gen::<f64>() > 0.02 {
            let signature = self.generate_signature();
            let fee = settings.priority_fee;
            Ok((signature, amount, fee))
        } else {
            Err(anyhow::anyhow!("Volume transaction failed"))
        }
    }

    fn generate_signature(&self) -> String {
        // Generate a Solana-compatible signature (88 characters, base58)
        let chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        (0..88)
            .map(|_| {
                let idx = rand::thread_rng().gen_range(0..chars.len());
                chars.chars().nth(idx).unwrap()
            })
            .collect()
    }

    pub fn get_bundle(&self, bundle_id: &str) -> Option<BundleResult> {
        let bundles = self.bundles.read();
        bundles.get(bundle_id).cloned()
    }

    pub fn get_all_bundles(&self) -> Vec<BundleResult> {
        let bundles = self.bundles.read();
        bundles.values().cloned().collect()
    }
}