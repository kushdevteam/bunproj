use anyhow::Result;
use ethers::{
    prelude::*,
    providers::{Http, Provider},
    types::{TransactionRequest, U256},
    utils::{parse_ether, format_ether},
};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{info, warn, error};
use uuid::Uuid;

use crate::wallet::WalletManager;
use bnb_bundler_shared::*;

pub struct BundleManager {
    bundles: Arc<RwLock<HashMap<String, BundleResult>>>,
}

impl BundleManager {
    pub async fn new() -> Result<Self> {
        Ok(Self {
            bundles: Arc::RwLock::new(HashMap::new()),
        })
    }

    pub async fn distribute_bnb(
        &self,
        request: DistributeRequest,
        wallet_manager: &WalletManager,
    ) -> Result<BundleResult> {
        let bundle_id = Uuid::new_v4().to_string();
        let start_time = Instant::now();

        info!(
            "Starting BNB distribution {} from {} to {} wallets",
            bundle_id, request.from_wallet, request.to_wallets.len()
        );

        if request.to_wallets.is_empty() {
            return Err(anyhow::anyhow!("No destination wallets provided"));
        }

        if request.amount_per_wallet <= 0.0 {
            return Err(anyhow::anyhow!("Invalid amount per wallet"));
        }

        // Get the source wallet
        let source_wallet = wallet_manager.get_wallet(&request.from_wallet).await
            .ok_or_else(|| anyhow::anyhow!("Source wallet not found: {}", request.from_wallet))?;

        let provider = wallet_manager.get_provider();
        let source_address = Address::from_str(&request.from_wallet)?;

        // Check source wallet balance
        let source_balance = provider.get_balance(source_address, None).await?;
        let source_balance_bnb: f64 = format_ether(source_balance).parse()?;
        let total_needed = request.amount_per_wallet * request.to_wallets.len() as f64;

        if source_balance_bnb < total_needed {
            return Err(anyhow::anyhow!(
                "Insufficient balance: need {} BNB, have {} BNB", 
                total_needed, source_balance_bnb
            ));
        }

        let mut bundle_result = BundleResult::new(bundle_id.clone(), BundleType::Distribute);
        bundle_result.total_transactions = request.to_wallets.len() as u32;

        // Create client with source wallet
        let client = Arc::new(SignerMiddleware::new(
            provider.clone(),
            source_wallet.with_chain_id(BSC_TESTNET_CHAIN_ID),
        ));

        // Execute transactions for each destination wallet
        for (index, to_address_str) in request.to_wallets.iter().enumerate() {
            let tx_start = Instant::now();

            // Apply stagger delay for stealth mode
            if request.settings.stealth_mode && index > 0 {
                let delay_ms = if request.settings.mev_protection {
                    // Add randomization for MEV protection
                    let base_delay = request.settings.stagger_delay_ms;
                    let random_factor = 0.5 + (rand::random::<f64>() * 1.0); // 0.5 to 1.5
                    (base_delay as f64 * random_factor) as u64
                } else {
                    request.settings.stagger_delay_ms
                };
                
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
            }

            // Execute the transaction
            let tx_result = self.execute_distribution_transaction(
                &client,
                to_address_str,
                request.amount_per_wallet,
                &request.settings,
            ).await;

            let execution_time_ms = tx_start.elapsed().as_millis() as u64;

            match tx_result {
                Ok((tx_hash, gas_used, gas_price_gwei)) => {
                    bundle_result.success_count += 1;
                    let gas_cost_bnb = (gas_used * gas_price_gwei * 1_000_000_000) as f64 / 1e18;
                    bundle_result.total_cost_bnb += request.amount_per_wallet + gas_cost_bnb;

                    bundle_result.transactions.push(TransactionResult {
                        wallet_address: to_address_str.clone(),
                        tx_hash: Some(tx_hash),
                        status: TransactionStatus::Confirmed,
                        amount_bnb: request.amount_per_wallet,
                        gas_used,
                        gas_price_gwei,
                        error: None,
                        execution_time_ms,
                    });

                    info!("✅ Distributed {} BNB to {}", request.amount_per_wallet, &to_address_str[..8]);
                },
                Err(e) => {
                    bundle_result.transactions.push(TransactionResult {
                        wallet_address: to_address_str.clone(),
                        tx_hash: None,
                        status: TransactionStatus::Failed,
                        amount_bnb: request.amount_per_wallet,
                        gas_used: 0,
                        gas_price_gwei: request.settings.priority_fee_gwei,
                        error: Some(e.to_string()),
                        execution_time_ms,
                    });

                    warn!("❌ Failed to distribute to {}: {}", &to_address_str[..8], e);
                }
            }
        }

        bundle_result.execution_time_ms = start_time.elapsed().as_millis() as u64;

        // Store bundle result
        {
            let mut bundles = self.bundles.write().await;
            bundles.insert(bundle_id.clone(), bundle_result.clone());
        }

        info!(
            "Distribution {} completed: {}/{} successful transactions in {}ms",
            bundle_id, bundle_result.success_count, bundle_result.total_transactions, bundle_result.execution_time_ms
        );

        Ok(bundle_result)
    }

    async fn execute_distribution_transaction(
        &self,
        client: &Arc<SignerMiddleware<Arc<Provider<Http>>, LocalWallet>>,
        to_address_str: &str,
        amount_bnb: f64,
        settings: &BundleSettings,
    ) -> Result<(String, u64, u64)> {
        // Parse destination address
        let to_address = Address::from_str(to_address_str)?;
        
        // Convert BNB amount to Wei
        let amount_wei = parse_ether(amount_bnb)?;
        
        // Build transaction
        let tx = TransactionRequest::new()
            .to(to_address)
            .value(amount_wei)
            .gas_price(U256::from(settings.priority_fee_gwei * 1_000_000_000)); // Convert gwei to wei

        // Set gas limit if provided
        let tx = if let Some(gas_limit) = settings.gas_limit {
            tx.gas(U256::from(gas_limit))
        } else {
            tx
        };

        // Send transaction
        let pending_tx = client.send_transaction(tx, None).await?;
        
        // Wait for confirmation
        let receipt = pending_tx.await?;
        
        if let Some(receipt) = receipt {
            let tx_hash = format!("{:?}", receipt.transaction_hash);
            let gas_used = receipt.gas_used.unwrap_or_default().as_u64();
            let gas_price_gwei = settings.priority_fee_gwei;
            
            Ok((tx_hash, gas_used, gas_price_gwei))
        } else {
            Err(anyhow::anyhow!("Transaction failed - no receipt received"))
        }
    }

    pub async fn get_bundle(&self, bundle_id: &str) -> Option<BundleResult> {
        let bundles = self.bundles.read().await;
        bundles.get(bundle_id).cloned()
    }

    pub async fn get_all_bundles(&self) -> Vec<BundleResult> {
        let bundles = self.bundles.read().await;
        bundles.values().cloned().collect()
    }
}