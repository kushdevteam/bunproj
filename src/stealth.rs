use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};
use rand::Rng;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StealthConfig {
    pub enabled: bool,
    pub randomize_timing: bool,
    pub randomize_order: bool,
    pub use_multiple_rpcs: bool,
    pub randomize_user_agents: bool,
    pub anti_fingerprinting: bool,
    pub proxy_rotation: bool,
    pub gas_optimization: bool,
}

impl Default for StealthConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            randomize_timing: true,
            randomize_order: true,
            use_multiple_rpcs: true,
            randomize_user_agents: true,
            anti_fingerprinting: true,
            proxy_rotation: false, // Requires external proxy service
            gas_optimization: true,
        }
    }
}

pub struct StealthEngine {
    config: Arc<RwLock<StealthConfig>>,
    user_agents: Vec<String>,
    timing_patterns: HashMap<String, Vec<u64>>,
    fingerprint_mitigation: Arc<RwLock<HashMap<String, String>>>,
}

impl StealthEngine {
    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let user_agents = vec![
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36".to_string(),
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36".to_string(),
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36".to_string(),
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0".to_string(),
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0".to_string(),
        ];

        let mut timing_patterns = HashMap::new();
        timing_patterns.insert("human_like".to_string(), vec![100, 150, 200, 250, 300, 350, 400, 500]);
        timing_patterns.insert("fast_trading".to_string(), vec![50, 75, 100, 125, 150]);
        timing_patterns.insert("conservative".to_string(), vec![500, 750, 1000, 1250, 1500, 2000]);

        Ok(Self {
            config: Arc::new(RwLock::new(StealthConfig::default())),
            user_agents,
            timing_patterns,
            fingerprint_mitigation: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    pub async fn enable_advanced_stealth(&self) {
        let mut config = self.config.write().await;
        config.enabled = true;
        config.randomize_timing = true;
        config.randomize_order = true;
        config.use_multiple_rpcs = true;
        config.randomize_user_agents = true;
        config.anti_fingerprinting = true;
        
        info!("🥷 Advanced stealth mode enabled");
    }

    pub async fn get_random_timing_delay(&self, pattern: &str) -> u64 {
        let config = self.config.read().await;
        
        if !config.randomize_timing {
            return 100; // Default delay
        }

        if let Some(pattern_delays) = self.timing_patterns.get(pattern) {
            let base_delay = pattern_delays[rand::thread_rng().gen_range(0..pattern_delays.len())];
            let randomization_factor = rand::thread_rng().gen_range(0.7..1.3);
            (base_delay as f64 * randomization_factor) as u64
        } else {
            rand::thread_rng().gen_range(100..500)
        }
    }

    pub async fn get_random_user_agent(&self) -> String {
        let config = self.config.read().await;
        
        if config.randomize_user_agents {
            self.user_agents[rand::thread_rng().gen_range(0..self.user_agents.len())].clone()
        } else {
            self.user_agents[0].clone()
        }
    }

    pub async fn apply_transaction_randomization(&self, mut wallets: Vec<String>) -> Vec<String> {
        let config = self.config.read().await;
        
        if config.randomize_order {
            use rand::seq::SliceRandom;
            wallets.shuffle(&mut rand::thread_rng());
            info!("🔀 Transaction order randomized for stealth");
        }
        
        wallets
    }

    pub async fn get_anti_fingerprinting_headers(&self) -> HashMap<String, String> {
        let config = self.config.read().await;
        let mut headers = HashMap::new();
        
        if config.anti_fingerprinting {
            headers.insert("Accept".to_string(), "application/json, text/plain, */*".to_string());
            headers.insert("Accept-Language".to_string(), "en-US,en;q=0.9".to_string());
            headers.insert("Accept-Encoding".to_string(), "gzip, deflate, br".to_string());
            headers.insert("Connection".to_string(), "keep-alive".to_string());
            headers.insert("DNT".to_string(), "1".to_string());
            headers.insert("Sec-Fetch-Dest".to_string(), "empty".to_string());
            headers.insert("Sec-Fetch-Mode".to_string(), "cors".to_string());
            headers.insert("Sec-Fetch-Site".to_string(), "cross-site".to_string());
            
            // Randomize some headers
            if rand::thread_rng().gen_bool(0.5) {
                headers.insert("Cache-Control".to_string(), "no-cache".to_string());
            }
            
            if rand::thread_rng().gen_bool(0.3) {
                headers.insert("Pragma".to_string(), "no-cache".to_string());
            }
        }
        
        headers
    }

    pub async fn calculate_optimal_mev_delay(&self, bundle_type: &str, network_congestion: f64) -> u64 {
        let config = self.config.read().await;
        
        if !config.enabled {
            return 0;
        }

        let base_delay = match bundle_type {
            "snipe" => 50,  // Fast for sniping
            "buy" => 100,   // Medium for regular buys
            "sell" => 150,  // Slightly slower for sells
            "volume" => 75, // Fast for volume generation
            _ => 100,
        };

        // Adjust based on network congestion
        let congestion_multiplier = 1.0 + (network_congestion * 0.5);
        let adjusted_delay = (base_delay as f64 * congestion_multiplier) as u64;

        // Add randomization to avoid detection
        let random_factor = rand::thread_rng().gen_range(0.8..1.2);
        (adjusted_delay as f64 * random_factor) as u64
    }

    pub async fn generate_stealth_report(&self) -> HashMap<String, serde_json::Value> {
        let config = self.config.read().await;
        let mut report = HashMap::new();
        
        report.insert("stealth_enabled".to_string(), serde_json::Value::Bool(config.enabled));
        report.insert("timing_randomization".to_string(), serde_json::Value::Bool(config.randomize_timing));
        report.insert("order_randomization".to_string(), serde_json::Value::Bool(config.randomize_order));
        report.insert("multi_rpc_support".to_string(), serde_json::Value::Bool(config.use_multiple_rpcs));
        report.insert("user_agent_rotation".to_string(), serde_json::Value::Bool(config.randomize_user_agents));
        report.insert("anti_fingerprinting".to_string(), serde_json::Value::Bool(config.anti_fingerprinting));
        
        let stealth_score = self.calculate_stealth_score(&config).await;
        report.insert("stealth_score".to_string(), serde_json::Value::Number(
            serde_json::Number::from_f64(stealth_score).unwrap_or_default()
        ));
        
        report
    }

    async fn calculate_stealth_score(&self, config: &StealthConfig) -> f64 {
        let mut score = 0.0;
        
        if config.enabled { score += 20.0; }
        if config.randomize_timing { score += 15.0; }
        if config.randomize_order { score += 15.0; }
        if config.use_multiple_rpcs { score += 10.0; }
        if config.randomize_user_agents { score += 10.0; }
        if config.anti_fingerprinting { score += 15.0; }
        if config.proxy_rotation { score += 15.0; }
        
        score
    }

    pub async fn update_config(&self, new_config: StealthConfig) {
        let mut config = self.config.write().await;
        *config = new_config;
        info!("🔧 Stealth configuration updated");
    }

    pub async fn get_config(&self) -> StealthConfig {
        let config = self.config.read().await;
        config.clone()
    }
}