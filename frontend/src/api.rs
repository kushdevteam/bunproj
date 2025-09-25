use gloo_net::http::Request;
use serde_wasm_bindgen;
use wasm_bindgen_futures::JsFuture;
use web_sys::{RequestInit, RequestMode, Response};
use bnb_bundler_shared::*;

const API_BASE: &str = "/api";

pub async fn get_health() -> Result<ApiResponse<HealthResponse>, Box<dyn std::error::Error>> {
    let response = Request::get(&format!("{}/health", API_BASE))
        .send()
        .await?;
    
    let data: ApiResponse<HealthResponse> = response.json().await?;
    Ok(data)
}

pub async fn generate_wallets(request: GenerateWalletsRequest) -> Result<ApiResponse<Vec<WalletInfo>>, Box<dyn std::error::Error>> {
    let response = Request::post(&format!("{}/wallets/generate", API_BASE))
        .json(&request)?
        .send()
        .await?;
    
    let data: ApiResponse<Vec<WalletInfo>> = response.json().await?;
    Ok(data)
}

pub async fn get_balances(wallet_addresses: Vec<String>) -> Result<ApiResponse<Vec<WalletBalance>>, Box<dyn std::error::Error>> {
    let wallets_param = serde_json::to_string(&wallet_addresses)?;
    let url = format!("{}/wallets/balances?wallets={}", API_BASE, js_sys::encode_uri_component(&wallets_param));
    
    let response = Request::get(&url)
        .send()
        .await?;
    
    let data: ApiResponse<Vec<WalletBalance>> = response.json().await?;
    Ok(data)
}

pub async fn distribute_bnb(request: DistributeRequest) -> Result<ApiResponse<BundleResult>, Box<dyn std::error::Error>> {
    let response = Request::post(&format!("{}/distribute", API_BASE))
        .json(&request)?
        .send()
        .await?;
    
    let data: ApiResponse<BundleResult> = response.json().await?;
    Ok(data)
}