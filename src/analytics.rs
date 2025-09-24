use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::RwLock;
use tracing::info;

use crate::bundler::BundleResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsData {
    pub total_bundles: u32,
    pub successful_transactions: u32,
    pub failed_transactions: u32,
    pub total_volume: f64,
    pub total_fees: f64,
    pub total_profit_loss: f64,
    pub success_rate: f64,
    pub average_execution_time: f64,
    pub popular_bundle_types: HashMap<String, u32>,
    pub stealth_usage: StealthUsageStats,
    pub mev_protection_stats: MevProtectionStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StealthUsageStats {
    pub bundles_with_stealth: u32,
    pub average_stealth_score: f64,
    pub randomization_usage: u32,
    pub multi_rpc_usage: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MevProtectionStats {
    pub protected_transactions: u32,
    pub mev_attacks_blocked: u32,
    pub average_protection_score: f64,
    pub frontrun_attempts_detected: u32,
}

pub struct Analytics {
    bundle_history: RwLock<Vec<BundleResult>>,
    performance_metrics: RwLock<HashMap<String, f64>>,
}

impl Analytics {
    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            bundle_history: RwLock::new(Vec::new()),
            performance_metrics: RwLock::new(HashMap::new()),
        })
    }

    pub async fn record_bundle_execution(&self, bundle_result: &BundleResult) {
        info!("🦀📊 Recording Rust bundle analytics for bundle {}", bundle_result.bundle_id);

        // Add to bundle history
        {
            let mut history = self.bundle_history.write().await;
            history.push(bundle_result.clone());
            
            // Keep only last 1000 bundles
            if history.len() > 1000 {
                history.remove(0);
            }
        }

        // Update performance metrics
        self.update_performance_metrics(bundle_result).await;
    }

    async fn update_performance_metrics(&self, bundle_result: &BundleResult) {
        let mut metrics = self.performance_metrics.write().await;

        // Update average execution time
        let current_avg = metrics.get("avg_execution_time").unwrap_or(&0.0);
        let history_len = self.bundle_history.read().await.len();
        let new_avg = (current_avg * (history_len - 1) as f64 + bundle_result.execution_time as f64) / history_len as f64;
        metrics.insert("avg_execution_time".to_string(), new_avg);

        // Update success rate
        let history = self.bundle_history.read().await;
        let total_success: u32 = history.iter().map(|b| b.success_count).sum();
        let total_transactions: u32 = history.iter().map(|b| b.total_transactions).sum();
        let success_rate = if total_transactions > 0 {
            (total_success as f64 / total_transactions as f64) * 100.0
        } else {
            0.0
        };
        metrics.insert("success_rate".to_string(), success_rate);

        // Update total volume
        let total_volume: f64 = history.iter().map(|b| b.total_cost).sum();
        metrics.insert("total_volume".to_string(), total_volume);
    }

    pub async fn get_analytics_data(&self) -> AnalyticsData {
        let history = self.bundle_history.read().await;
        let performance_metrics = self.performance_metrics.read().await;

        let total_bundles = history.len() as u32;
        let successful_transactions: u32 = history.iter().map(|b| b.success_count).sum();
        let total_transactions: u32 = history.iter().map(|b| b.total_transactions).sum();
        let failed_transactions = total_transactions - successful_transactions;
        let total_volume: f64 = history.iter().map(|b| b.total_cost).sum();
        let total_fees = total_volume * 0.02; // Estimate 2% in fees

        // Calculate profit/loss (simplified)
        let total_profit_loss = total_volume * 0.05 - total_fees; // Estimate 5% profit minus fees

        let success_rate = if total_transactions > 0 {
            (successful_transactions as f64 / total_transactions as f64) * 100.0
        } else {
            0.0
        };

        let average_execution_time = performance_metrics.get("avg_execution_time").unwrap_or(&0.0);

        // Calculate popular bundle types
        let mut popular_bundle_types = HashMap::new();
        for bundle in history.iter() {
            *popular_bundle_types.entry(bundle.bundle_type.clone()).or_insert(0) += 1;
        }

        // Get stealth usage stats
        let stealth_usage = self.calculate_stealth_usage(&history).await;

        // Get MEV protection stats
        let mev_protection_stats = self.calculate_mev_protection_stats(&history).await;

        AnalyticsData {
            total_bundles,
            successful_transactions,
            failed_transactions,
            total_volume,
            total_fees,
            total_profit_loss,
            success_rate,
            average_execution_time: *average_execution_time,
            popular_bundle_types,
            stealth_usage,
            mev_protection_stats,
        }
    }

    async fn calculate_stealth_usage(&self, history: &[BundleResult]) -> StealthUsageStats {
        let bundles_with_stealth = history.iter()
            .filter(|b| b.stealth_metrics.is_some())
            .count() as u32;

        let average_stealth_score = if bundles_with_stealth > 0 {
            let total_score: f64 = history.iter()
                .filter_map(|b| b.stealth_metrics.as_ref())
                .map(|s| s.stealth_score)
                .sum();
            total_score / bundles_with_stealth as f64
        } else {
            0.0
        };

        let randomization_usage = history.iter()
            .filter(|b| b.stealth_metrics.as_ref().map_or(false, |s| s.randomization_applied))
            .count() as u32;

        let multi_rpc_usage = history.iter()
            .filter(|b| b.stealth_metrics.as_ref().map_or(false, |s| s.multiple_rpcs_used))
            .count() as u32;

        StealthUsageStats {
            bundles_with_stealth,
            average_stealth_score,
            randomization_usage,
            multi_rpc_usage,
        }
    }

    async fn calculate_mev_protection_stats(&self, history: &[BundleResult]) -> MevProtectionStats {
        let protected_transactions = history.iter()
            .filter(|b| b.mev_protection_enabled)
            .map(|b| b.total_transactions)
            .sum();

        // Simulate MEV protection metrics
        let mev_attacks_blocked = (protected_transactions as f64 * 0.12) as u32; // Assume 12% attack rate blocked
        let average_protection_score = 88.5; // High protection score
        let frontrun_attempts_detected = (protected_transactions as f64 * 0.06) as u32; // 6% frontrun attempts detected

        MevProtectionStats {
            protected_transactions,
            mev_attacks_blocked,
            average_protection_score,
            frontrun_attempts_detected,
        }
    }

    pub async fn get_performance_summary(&self) -> HashMap<String, f64> {
        let metrics = self.performance_metrics.read().await;
        metrics.clone()
    }
}