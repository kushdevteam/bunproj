use anyhow::Result;
use ed25519_dalek::{PublicKey, Signature};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::str::FromStr;
use tracing::{info, error};

pub struct SolanaClient {
    rpc_url: String,
    client: Client,
}

#[derive(Serialize)]
struct RpcRequest {
    jsonrpc: String,
    id: u64,
    method: String,
    params: Vec<Value>,
}

#[derive(Deserialize)]
struct RpcResponse<T> {
    result: Option<T>,
    error: Option<RpcError>,
}

#[derive(Deserialize)]
struct RpcError {
    code: i32,
    message: String,
}

impl SolanaClient {
    pub fn new() -> Self {
        let rpc_url = std::env::var("SOLANA_RPC_URL")
            .unwrap_or_else(|_| "https://api.devnet.solana.com".to_string());
        
        Self { 
            rpc_url,
            client: Client::new(),
        }
    }

    pub async fn get_balance(&self, pubkey: &str) -> Result<u64> {
        let request = RpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "getBalance".to_string(),
            params: vec![json!(pubkey)],
        };

        let response = self.client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await?;

        let rpc_response: RpcResponse<Value> = response.json().await?;
        
        if let Some(error) = rpc_response.error {
            return Err(anyhow::anyhow!("RPC Error: {}", error.message));
        }

        let balance = rpc_response.result
            .and_then(|r| r.get("value"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        info!("Retrieved balance for {}: {} lamports", &pubkey[..8], balance);
        Ok(balance)
    }

    pub async fn simulate_transaction(&self, transaction_data: &str) -> Result<bool> {
        // Simulate transaction validation
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        
        // Return success for 95% of transactions
        Ok(rand::random::<f64>() > 0.05)
    }

    pub async fn send_transaction(&self, transaction_data: &str) -> Result<String> {
        // Simulate sending transaction to network
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        
        // Generate a mock signature
        let signature_bytes: [u8; 64] = rand::random();
        Ok(bs58::encode(signature_bytes).into_string())
    }

    pub async fn confirm_transaction(&self, signature: &str) -> Result<bool> {
        // Simulate confirmation wait time
        tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
        
        // Return confirmed for 98% of transactions
        Ok(rand::random::<f64>() > 0.02)
    }

    pub async fn get_recent_blockhash(&self) -> Result<String> {
        let request = RpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "getRecentBlockhash".to_string(),
            params: vec![],
        };

        let response = self.client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await?;

        let rpc_response: RpcResponse<Value> = response.json().await?;
        
        if let Some(error) = rpc_response.error {
            return Err(anyhow::anyhow!("RPC Error: {}", error.message));
        }

        let blockhash = rpc_response.result
            .and_then(|r| r.get("value"))
            .and_then(|v| v.get("blockhash"))
            .and_then(|v| v.as_str())
            .unwrap_or("11111111111111111111111111111112")
            .to_string();

        Ok(blockhash)
    }

    pub async fn request_airdrop(&self, pubkey: &str, lamports: u64) -> Result<String> {
        let request = RpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "requestAirdrop".to_string(),
            params: vec![json!(pubkey), json!(lamports)],
        };

        let response = self.client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await?;

        let rpc_response: RpcResponse<String> = response.json().await?;
        
        if let Some(error) = rpc_response.error {
            return Err(anyhow::anyhow!("Airdrop failed: {}", error.message));
        }

        let signature = rpc_response.result
            .unwrap_or_else(|| "mock_signature".to_string());

        info!("Airdrop requested for {}: {} lamports, signature: {}", 
              &pubkey[..8], lamports, &signature[..8]);
        
        Ok(signature)
    }

    pub fn get_rpc_url(&self) -> &str {
        &self.rpc_url
    }
}