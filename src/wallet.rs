use anyhow::Result;
use parking_lot::RwLock;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use ed25519_dalek::{Keypair, PublicKey, SecretKey};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use tracing::{info, warn};

use crate::solana_client::SolanaClient;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletInfo {
    pub public_key: String,
    pub balance: f64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletBalance {
    pub public_key: String,
    pub balance: f64,
}

#[derive(Debug, Deserialize)]
pub struct WalletRequest {
    pub count: u32,
}

#[derive(Debug, Deserialize)]
pub struct FundRequest {
    pub wallets: Vec<String>,
    pub amount: f64,
}

pub struct StoredWallet {
    pub keypair: Keypair,
    pub balance: f64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub struct WalletManager {
    wallets: Arc<RwLock<HashMap<String, StoredWallet>>>,
    solana_client: SolanaClient,
}

impl WalletManager {
    pub async fn new() -> Result<Self> {
        Ok(Self {
            wallets: Arc::new(RwLock::new(HashMap::new())),
            solana_client: SolanaClient::new(),
        })
    }

    pub async fn generate_wallets(&self, count: u32) -> Result<Vec<WalletInfo>> {
        if count == 0 || count > 1000 {
            return Err(anyhow::anyhow!("Invalid wallet count. Must be between 1 and 1000"));
        }

        let mut wallets = Vec::new();
        let mut wallet_store = self.wallets.write();

        for _ in 0..count {
            let mut csprng = OsRng {};
            let keypair = Keypair::generate(&mut csprng);
            let public_key = bs58::encode(keypair.public.to_bytes()).into_string();
            let created_at = chrono::Utc::now();

            let stored_wallet = StoredWallet {
                keypair,
                balance: 0.0,
                created_at,
            };

            let wallet_info = WalletInfo {
                public_key: public_key.clone(),
                balance: 0.0,
                created_at: created_at.to_rfc3339(),
            };

            wallet_store.insert(public_key, stored_wallet);
            wallets.push(wallet_info);
        }

        info!("Generated {} new wallets", count);
        Ok(wallets)
    }

    pub async fn fund_wallets(&self, wallet_addresses: &[String], amount: f64) -> Result<Vec<WalletInfo>> {
        if wallet_addresses.is_empty() {
            return Err(anyhow::anyhow!("No wallet addresses provided"));
        }

        if amount <= 0.0 || amount > 100.0 {
            return Err(anyhow::anyhow!("Invalid amount. Must be between 0.001 and 100 SOL"));
        }

        let mut funded_wallets = Vec::new();
        let lamports = (amount * 1_000_000_000.0) as u64; // Convert SOL to lamports

        for wallet_address in wallet_addresses {
            // Request airdrop from devnet faucet
            match self.solana_client.request_airdrop(wallet_address, lamports).await {
                Ok(signature) => {
                    // Wait a moment for the airdrop to be processed
                    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
                    
                    // Get the actual balance from the blockchain
                    let balance_lamports = self.solana_client.get_balance(wallet_address).await.unwrap_or(0);
                    let balance_sol = balance_lamports as f64 / 1_000_000_000.0;
                    
                    // Update our local record
                    {
                        let mut wallet_store = self.wallets.write();
                        if let Some(stored_wallet) = wallet_store.get_mut(wallet_address) {
                            stored_wallet.balance = balance_sol;
                        }
                    }
                    
                    let wallet_info = WalletInfo {
                        public_key: wallet_address.clone(),
                        balance: balance_sol,
                        created_at: chrono::Utc::now().to_rfc3339(),
                    };
                    
                    funded_wallets.push(wallet_info);
                    info!("✅ Funded wallet {} with {} SOL (signature: {})", 
                          &wallet_address[..8], amount, &signature[..8]);
                },
                Err(e) => {
                    warn!("❌ Failed to fund wallet {}: {}", &wallet_address[..8], e);
                    // Add wallet with 0 balance to show the attempt
                    funded_wallets.push(WalletInfo {
                        public_key: wallet_address.clone(),
                        balance: 0.0,
                        created_at: chrono::Utc::now().to_rfc3339(),
                    });
                }
            }
        }

        info!("Funding completed: {}/{} wallets funded successfully", 
              funded_wallets.iter().filter(|w| w.balance > 0.0).count(), 
              wallet_addresses.len());
        Ok(funded_wallets)
    }

    pub async fn get_balances(&self, wallet_addresses: &[String]) -> Result<Vec<WalletBalance>> {
        let mut balances = Vec::new();

        for wallet_address in wallet_addresses {
            // Get actual balance from the Solana blockchain
            match self.solana_client.get_balance(wallet_address).await {
                Ok(balance_lamports) => {
                    let balance_sol = balance_lamports as f64 / 1_000_000_000.0;
                    
                    // Update our local cache
                    {
                        let mut wallet_store = self.wallets.write();
                        if let Some(stored_wallet) = wallet_store.get_mut(wallet_address) {
                            stored_wallet.balance = balance_sol;
                        }
                    }
                    
                    balances.push(WalletBalance {
                        public_key: wallet_address.clone(),
                        balance: balance_sol,
                    });
                },
                Err(e) => {
                    warn!("Failed to get balance for {}: {}", &wallet_address[..8], e);
                    balances.push(WalletBalance {
                        public_key: wallet_address.clone(),
                        balance: 0.0,
                    });
                }
            }
        }

        Ok(balances)
    }

    pub fn get_keypair(&self, public_key: &str) -> Option<Keypair> {
        let wallet_store = self.wallets.read();
        wallet_store.get(public_key).map(|w| {
            w.keypair.clone()
        })
    }

    pub async fn update_balance(&self, public_key: &str, new_balance: f64) {
        let mut wallet_store = self.wallets.write();
        if let Some(stored_wallet) = wallet_store.get_mut(public_key) {
            stored_wallet.balance = new_balance;
        }
    }

    pub fn get_all_wallets(&self) -> Vec<WalletInfo> {
        let wallet_store = self.wallets.read();
        wallet_store.iter().map(|(public_key, stored_wallet)| {
            WalletInfo {
                public_key: public_key.clone(),
                balance: stored_wallet.balance,
                created_at: stored_wallet.created_at.to_rfc3339(),
            }
        }).collect()
    }
}