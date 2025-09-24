use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::RwLock;
use tracing::{info, warn};
use rand::Rng;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MevProtectionConfig {
    pub enabled: bool,
    pub priority_fee_boost: f64,
    pub frontrun_protection: bool,
    pub sandwich_protection: bool,
    pub timing_randomization: bool,
    pub multiple_rpcs: bool,
    pub private_mempool: bool,
}

impl Default for MevProtectionConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            priority_fee_boost: 2.0,
            frontrun_protection: true,
            sandwich_protection: true,
            timing_randomization: true,
            multiple_rpcs: true,
            private_mempool: false, // Requires flashloan protection
        }
    }
}

pub struct MevProtection {
    config: RwLock<MevProtectionConfig>,
    network_stats: RwLock<HashMap<String, f64>>,
    protected_transactions: RwLock<Vec<String>>,
}

impl MevProtection {
    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            config: RwLock::new(MevProtectionConfig::default()),
            network_stats: RwLock::new(HashMap::new()),
            protected_transactions: RwLock::new(Vec::new()),
        })
    }

    pub async fn calculate_optimal_delay(&self, bundle_type: &str) -> u64 {
        let config = self.config.read().await;
        
        if !config.enabled {
            return 0;
        }

        let base_delay = match bundle_type {
            "snipe" => 25,  // Minimal delay for sniping
            "buy" => 100,   // Standard delay for buys
            "sell" => 150,  // Longer delay for sells
            "volume" => 50, // Short delay for volume
            _ => 100,
        };

        // Add randomization to prevent pattern detection
        if config.timing_randomization {
            let randomization = rand::thread_rng().gen_range(0.5..1.5);
            (base_delay as f64 * randomization) as u64
        } else {
            base_delay
        }
    }

    pub async fn calculate_priority_fee(&self, base_fee: f64, urgency: &str) -> f64 {
        let config = self.config.read().await;
        
        if !config.enabled {
            return base_fee;
        }

        let urgency_multiplier = match urgency {
            "low" => 1.0,
            "medium" => 1.5,
            "high" => 2.0,
            "urgent" => 3.0,
            _ => 1.0,
        };

        base_fee * config.priority_fee_boost * urgency_multiplier
    }

    pub async fn detect_frontrunning_risk(&self, token_address: &str, amount: f64) -> f64 {
        // Simulate frontrunning risk detection
        let network_stats = self.network_stats.read().await;
        
        // Base risk assessment
        let mut risk_score = 0.0;
        
        // Large transactions have higher MEV risk
        if amount > 10.0 {
            risk_score += 0.3;
        }
        
        // Popular tokens have higher MEV risk
        if let Some(popularity) = network_stats.get(&format!("popularity_{}", token_address)) {
            risk_score += popularity * 0.2;
        }
        
        // Network congestion increases MEV risk
        if let Some(congestion) = network_stats.get("network_congestion") {
            risk_score += congestion * 0.4;
        }
        
        // Add some randomness to simulate real-world conditions
        risk_score += rand::thread_rng().gen_range(0.0..0.1);
        
        risk_score.min(1.0)
    }

    pub async fn apply_sandwich_protection(&self, transaction_params: &mut HashMap<String, f64>) {
        let config = self.config.read().await;
        
        if !config.sandwich_protection {
            return;
        }

        // Adjust slippage for sandwich protection
        if let Some(slippage) = transaction_params.get_mut("slippage") {
            *slippage = (*slippage * 1.2).min(50.0); // Increase slippage by 20% max 50%
        }

        // Adjust amount to reduce sandwich attractiveness
        if let Some(amount) = transaction_params.get_mut("amount") {
            let reduction_factor = rand::thread_rng().gen_range(0.95..1.0);
            *amount *= reduction_factor;
        }

        info!("🛡️ Sandwich protection applied");
    }

    pub async fn update_network_stats(&self, stats: HashMap<String, f64>) {
        let mut network_stats = self.network_stats.write().await;
        for (key, value) in stats {
            network_stats.insert(key, value);
        }
    }

    pub async fn is_transaction_safe(&self, token_address: &str, amount: f64) -> bool {
        let frontrun_risk = self.detect_frontrunning_risk(token_address, amount).await;
        
        // Consider transaction safe if frontrun risk is below 70%
        frontrun_risk < 0.7
    }

    pub async fn get_protection_recommendations(&self, bundle_type: &str) -> Vec<String> {
        let config = self.config.read().await;
        let mut recommendations = Vec::new();

        if !config.enabled {
            recommendations.push("Enable MEV protection for better security".to_string());
            return recommendations;
        }

        match bundle_type {
            "snipe" => {
                recommendations.push("Use maximum priority fees".to_string());
                recommendations.push("Execute immediately on token launch".to_string());
                recommendations.push("Use private mempool if available".to_string());
            },
            "buy" => {
                recommendations.push("Use moderate priority fees".to_string());
                recommendations.push("Apply timing randomization".to_string());
                recommendations.push("Monitor for sandwich attacks".to_string());
            },
            "sell" => {
                recommendations.push("Use higher slippage tolerance".to_string());
                recommendations.push("Consider batch selling".to_string());
                recommendations.push("Monitor market impact".to_string());
            },
            "volume" => {
                recommendations.push("Use lower amounts per transaction".to_string());
                recommendations.push("Randomize transaction timing".to_string());
                recommendations.push("Spread across multiple blocks".to_string());
            },
            _ => {
                recommendations.push("Apply standard MEV protection".to_string());
            }
        }

        recommendations
    }

    pub async fn record_protected_transaction(&self, signature: String) {
        let mut protected = self.protected_transactions.write().await;
        protected.push(signature);
        
        // Keep only last 1000 transactions
        if protected.len() > 1000 {
            protected.remove(0);
        }
    }

    pub async fn get_protection_stats(&self) -> HashMap<String, serde_json::Value> {
        let config = self.config.read().await;
        let protected = self.protected_transactions.read().await;
        
        let mut stats = HashMap::new();
        stats.insert("mev_protection_enabled".to_string(), serde_json::Value::Bool(config.enabled));
        stats.insert("frontrun_protection".to_string(), serde_json::Value::Bool(config.frontrun_protection));
        stats.insert("sandwich_protection".to_string(), serde_json::Value::Bool(config.sandwich_protection));
        stats.insert("protected_transactions_count".to_string(), serde_json::Value::Number(protected.len().into()));
        stats.insert("priority_fee_boost".to_string(), serde_json::Value::Number(
            serde_json::Number::from_f64(config.priority_fee_boost).unwrap_or_default()
        ));
        
        stats
    }

    pub async fn update_config(&self, new_config: MevProtectionConfig) {
        let mut config = self.config.write().await;
        *config = new_config;
        info!("🔧 MEV protection configuration updated");
    }
}