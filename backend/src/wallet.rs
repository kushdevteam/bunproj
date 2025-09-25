use anyhow::Result;
use ethers::{
    prelude::*,
    providers::{Http, Provider},
    signers::{LocalWallet, Signer},
    types::{Address, U256},
    utils::format_ether,
};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

use bnb_bundler_shared::*;

// BSC Testnet RPC URL - QuickNode integration for enterprise reliability
const BSC_TESTNET_RPC: &str = "https://data-seed-prebsc-1-s1.binance.org:8545/";

fn get_rpc_url() -> String {
    // Priority: QuickNode URL -> environment variable -> fallback to public node
    std::env::var("QUICKNODE_RPC_URL")
        .or_else(|_| std::env::var("REACT_APP_QUICKNODE_RPC_URL"))
        .unwrap_or_else(|_| BSC_TESTNET_RPC.to_string())
}

pub struct StoredWallet {
    pub wallet: LocalWallet,
    pub balance_bnb: f64,
    pub balance_tokens: f64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub struct WalletManager {
    wallets: Arc<RwLock<HashMap<String, StoredWallet>>>,
    provider: Arc<Provider<Http>>,
}

impl WalletManager {
    pub async fn new() -> Result<Self> {
        let rpc_url = get_rpc_url();
        info!("Connecting to blockchain RPC: {}", rpc_url);
        let provider = Provider::<Http>::try_from(rpc_url)?;
        
        // Test connection
        let chain_id = provider.get_chainid().await?;
        info!("Connected to BNB Smart Chain (Chain ID: {})", chain_id);
        
        Ok(Self {
            wallets: Arc::new(RwLock::new(HashMap::new())),
            provider: Arc::new(provider),
        })
    }

    pub async fn generate_wallets(&self, count: u32) -> Result<Vec<WalletInfo>> {
        if count == 0 || count > 1000 {
            return Err(anyhow::anyhow!("Invalid wallet count. Must be between 1 and 1000"));
        }

        let mut wallets = Vec::new();
        let mut wallet_store = self.wallets.write().await;

        for _ in 0..count {
            // Generate a new random wallet
            let wallet = LocalWallet::new(&mut rand::thread_rng());
            let address = format!("{:?}", wallet.address());
            let created_at = chrono::Utc::now();

            let stored_wallet = StoredWallet {
                wallet,
                balance_bnb: 0.0,
                balance_tokens: 0.0,
                created_at,
            };

            let wallet_info = WalletInfo {
                address: address.clone(),
                balance_bnb: 0.0,
                balance_tokens: 0.0,
                created_at,
            };

            wallet_store.insert(address, stored_wallet);
            wallets.push(wallet_info);
        }

        info!("Generated {} new wallets", count);
        Ok(wallets)
    }

    pub async fn get_balances(&self, wallet_addresses: &[String]) -> Result<Vec<WalletBalance>> {
        let mut balances = Vec::new();

        for address_str in wallet_addresses {
            // Parse address
            let address = match Address::from_str(address_str) {
                Ok(addr) => addr,
                Err(e) => {
                    warn!("Invalid address {}: {}", address_str, e);
                    balances.push(WalletBalance {
                        address: address_str.clone(),
                        balance_bnb: 0.0,
                        balance_tokens: 0.0,
                    });
                    continue;
                }
            };

            // Get BNB balance from chain
            match self.provider.get_balance(address, None).await {
                Ok(balance_wei) => {
                    let balance_bnb: f64 = format_ether(balance_wei).parse().unwrap_or(0.0);
                    
                    // Update local cache
                    {
                        let mut wallet_store = self.wallets.write().await;
                        if let Some(stored_wallet) = wallet_store.get_mut(address_str) {
                            stored_wallet.balance_bnb = balance_bnb;
                        }
                    }
                    
                    balances.push(WalletBalance {
                        address: address_str.clone(),
                        balance_bnb,
                        balance_tokens: 0.0, // TODO: Implement token balance checking
                    });
                },
                Err(e) => {
                    warn!("Failed to get balance for {}: {}", address_str, e);
                    balances.push(WalletBalance {
                        address: address_str.clone(),
                        balance_bnb: 0.0,
                        balance_tokens: 0.0,
                    });
                }
            }
        }

        Ok(balances)
    }

    pub async fn get_network_info(&self) -> Result<(u64, u64)> {
        let block_number = self.provider.get_block_number().await?;
        let gas_price = self.provider.get_gas_price().await?;
        let gas_price_gwei = gas_price.as_u64() / 1_000_000_000;
        
        Ok((block_number.as_u64(), gas_price_gwei))
    }

    pub async fn get_wallet(&self, address: &str) -> Option<LocalWallet> {
        let wallet_store = self.wallets.read().await;
        wallet_store.get(address).map(|w| w.wallet.clone())
    }

    pub async fn update_balance(&self, address: &str, new_balance_bnb: f64) {
        let mut wallet_store = self.wallets.write().await;
        if let Some(stored_wallet) = wallet_store.get_mut(address) {
            stored_wallet.balance_bnb = new_balance_bnb;
        }
    }

    pub async fn get_all_wallets(&self) -> Vec<WalletInfo> {
        let wallet_store = self.wallets.read().await;
        wallet_store.iter().map(|(address, stored_wallet)| {
            WalletInfo {
                address: address.clone(),
                balance_bnb: stored_wallet.balance_bnb,
                balance_tokens: stored_wallet.balance_tokens,
                created_at: stored_wallet.created_at,
            }
        }).collect()
    }

    pub fn get_provider(&self) -> Arc<Provider<Http>> {
        self.provider.clone()
    }
}