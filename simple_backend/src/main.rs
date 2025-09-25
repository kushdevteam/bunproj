use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use serde_json::{Value, json};
use tiny_http::{Server, Request, Response, Method, Header};

// ===== IN-MEMORY STORAGE =====
type Storage = Arc<Mutex<HashMap<String, Value>>>;

struct Database {
    tokens: Storage,
    drafts: Storage,
    launch_plans: Storage,
    wallets: Storage,
    tax_config: Storage,
    tax_transactions: Storage,
    excluded_wallets: Storage,
}

impl Database {
    fn new() -> Self {
        let db = Database {
            tokens: Arc::new(Mutex::new(HashMap::new())),
            drafts: Arc::new(Mutex::new(HashMap::new())),
            launch_plans: Arc::new(Mutex::new(HashMap::new())),
            wallets: Arc::new(Mutex::new(HashMap::new())),
            tax_config: Arc::new(Mutex::new(HashMap::new())),
            tax_transactions: Arc::new(Mutex::new(HashMap::new())),
            excluded_wallets: Arc::new(Mutex::new(HashMap::new())),
        };
        
        // Initialize default tax configuration
        db.init_default_tax_config();
        db
    }

    fn create_token(&self, id: String, data: Value) -> Result<Value, String> {
        let mut tokens = self.tokens.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        
        let token = json!({
            "id": id.clone(),
            "project_name": data.get("project_name").unwrap_or(&json!("")),
            "symbol": data.get("symbol").unwrap_or(&json!("")),
            "description": data.get("description").unwrap_or(&json!("")),
            "twitter": data.get("twitter"),
            "telegram": data.get("telegram"),
            "website": data.get("website"),
            "launch_option": data.get("launch_option"),
            "status": "draft",
            "created_at": now.clone(),
            "updated_at": now
        });

        tokens.insert(id.clone(), token.clone());
        Ok(token)
    }

    fn get_token(&self, id: &str) -> Option<Value> {
        let tokens = self.tokens.lock().unwrap();
        tokens.get(id).cloned()
    }

    fn save_draft(&self, id: String, data: Value) -> Result<(), String> {
        let mut drafts = self.drafts.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        
        let draft = json!({
            "id": id.clone(),
            "token_data": data,
            "created_at": drafts.get(&id).and_then(|d| d.get("created_at")).unwrap_or(&json!(now.clone())),
            "updated_at": now
        });

        drafts.insert(id, draft);
        Ok(())
    }

    fn get_drafts(&self) -> Vec<Value> {
        let drafts = self.drafts.lock().unwrap();
        drafts.values().cloned().collect()
    }

    fn delete_draft(&self, id: &str) -> bool {
        let mut drafts = self.drafts.lock().unwrap();
        drafts.remove(id).is_some()
    }

    fn create_launch_plan(&self, id: String, data: Value) -> Result<Value, String> {
        let mut plans = self.launch_plans.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        
        let plan = json!({
            "id": id.clone(),
            "token_id": data.get("token_id"),
            "launch_mode": data.get("launch_mode").unwrap_or(&json!("quick")),
            "dev_buy_percent": data.get("dev_buy_percent").unwrap_or(&json!(0)),
            "supply_buy_percent": data.get("supply_buy_percent").unwrap_or(&json!(0)),
            "disperse_wallets_count": data.get("disperse_wallets_count").unwrap_or(&json!(0)),
            "status": "draft",
            "created_at": now.clone(),
            "updated_at": now
        });

        plans.insert(id.clone(), plan.clone());
        Ok(plan)
    }

    fn get_launch_plan(&self, id: &str) -> Option<Value> {
        let plans = self.launch_plans.lock().unwrap();
        plans.get(id).cloned()
    }

    fn generate_wallets(&self, launch_plan_id: String, count: i32) -> Result<Vec<Value>, String> {
        let mut wallets = self.wallets.lock().unwrap();
        let mut generated = Vec::new();
        let now = chrono::Utc::now().to_rfc3339();

        for i in 0..count {
            let wallet_id = format!("wallet_{}_{}", launch_plan_id, i);
            let address = format!("0x{:040x}", i + 1);
            let private_key = format!("0x{:064x}", (i as u64) * 12345 + 67890);
            let wallet_type = if i % 4 == 0 { "aged" } else { "fresh" };
            
            let wallet = json!({
                "id": wallet_id.clone(),
                "launch_plan_id": launch_plan_id,
                "address": address,
                "private_key": private_key,
                "buy_percentage": 1.0 / count as f64,
                "funded": false,
                "balance": 0.0,
                "wallet_type": wallet_type,
                "status": "active",
                "created_at": now.clone()
            });

            wallets.insert(wallet_id, wallet.clone());
            generated.push(wallet);
        }

        Ok(generated)
    }

    fn get_wallets_by_plan(&self, plan_id: &str) -> Vec<Value> {
        let wallets = self.wallets.lock().unwrap();
        wallets.values()
            .filter(|wallet| {
                wallet.get("launch_plan_id")
                    .and_then(|v| v.as_str())
                    .map_or(false, |id| id == plan_id)
            })
            .cloned()
            .collect()
    }
    
    // ===== TAX SYSTEM METHODS =====
    
    fn init_default_tax_config(&self) {
        let mut config = self.tax_config.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        
        let default_config = json!({
            "tax_rate_percent": 5.0,
            "treasury_wallet": "0x91e58Ea55BF914fE15444E34AF11A259f1DE8526",
            "enabled": true,
            "apply_to_buys": true,
            "apply_to_sells": true,
            "minimum_tax_amount": 0.001, // Minimum BNB amount to collect tax
            "created_at": now.clone(),
            "updated_at": now
        });
        
        config.insert("default".to_string(), default_config);
    }
    
    fn get_tax_config(&self) -> Value {
        let config = self.tax_config.lock().unwrap();
        config.get("default").cloned().unwrap_or(json!({
            "tax_rate_percent": 5.0,
            "treasury_wallet": "0x91e58Ea55BF914fE15444E34AF11A259f1DE8526",
            "enabled": true
        }))
    }
    
    fn update_tax_config(&self, config: Value) -> Result<Value, String> {
        let mut tax_config = self.tax_config.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        
        let updated_config = json!({
            "tax_rate_percent": config.get("tax_rate_percent").unwrap_or(&json!(5.0)),
            "treasury_wallet": config.get("treasury_wallet").unwrap_or(&json!("0x91e58Ea55BF914fE15444E34AF11A259f1DE8526")),
            "enabled": config.get("enabled").unwrap_or(&json!(true)),
            "apply_to_buys": config.get("apply_to_buys").unwrap_or(&json!(true)),
            "apply_to_sells": config.get("apply_to_sells").unwrap_or(&json!(true)),
            "minimum_tax_amount": config.get("minimum_tax_amount").unwrap_or(&json!(0.001)),
            "created_at": tax_config.get("default").and_then(|c| c.get("created_at")).unwrap_or(&json!(now.clone())),
            "updated_at": now
        });
        
        tax_config.insert("default".to_string(), updated_config.clone());
        Ok(updated_config)
    }
    
    fn add_excluded_wallet(&self, wallet_address: String, reason: String) -> Result<(), String> {
        let mut excluded = self.excluded_wallets.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        
        let exclusion = json!({
            "address": wallet_address.clone(),
            "reason": reason,
            "created_at": now
        });
        
        excluded.insert(wallet_address, exclusion);
        Ok(())
    }
    
    fn remove_excluded_wallet(&self, wallet_address: &str) -> bool {
        let mut excluded = self.excluded_wallets.lock().unwrap();
        excluded.remove(wallet_address).is_some()
    }
    
    fn get_excluded_wallets(&self) -> Vec<Value> {
        let excluded = self.excluded_wallets.lock().unwrap();
        excluded.values().cloned().collect()
    }
    
    fn is_wallet_excluded(&self, wallet_address: &str) -> bool {
        let excluded = self.excluded_wallets.lock().unwrap();
        excluded.contains_key(wallet_address)
    }
    
    fn record_tax_transaction(&self, transaction_data: Value) -> Result<Value, String> {
        let mut transactions = self.tax_transactions.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let tx_id = generate_id();
        
        let tax_transaction = json!({
            "id": tx_id.clone(),
            "original_tx_hash": transaction_data.get("original_tx_hash"),
            "tax_tx_hash": transaction_data.get("tax_tx_hash"),
            "wallet_address": transaction_data.get("wallet_address"),
            "transaction_amount": transaction_data.get("transaction_amount"),
            "tax_amount": transaction_data.get("tax_amount"),
            "tax_rate_percent": transaction_data.get("tax_rate_percent"),
            "treasury_wallet": transaction_data.get("treasury_wallet"),
            "transaction_type": transaction_data.get("transaction_type"), // "buy" or "sell"
            "status": transaction_data.get("status").unwrap_or(&json!("pending")),
            "block_number": transaction_data.get("block_number"),
            "gas_used": transaction_data.get("gas_used"),
            "created_at": now
        });
        
        transactions.insert(tx_id.clone(), tax_transaction.clone());
        Ok(tax_transaction)
    }
    
    fn get_tax_transactions(&self, limit: Option<i32>) -> Vec<Value> {
        let transactions = self.tax_transactions.lock().unwrap();
        let mut tx_list: Vec<Value> = transactions.values().cloned().collect();
        
        // Sort by created_at descending
        tx_list.sort_by(|a, b| {
            let a_time = a.get("created_at").and_then(|v| v.as_str()).unwrap_or("");
            let b_time = b.get("created_at").and_then(|v| v.as_str()).unwrap_or("");
            b_time.cmp(a_time)
        });
        
        if let Some(limit) = limit {
            tx_list.into_iter().take(limit as usize).collect()
        } else {
            tx_list
        }
    }
    
    fn get_tax_statistics(&self) -> Value {
        let transactions = self.tax_transactions.lock().unwrap();
        let config = self.get_tax_config();
        
        let total_transactions = transactions.len();
        let mut total_tax_collected = 0.0;
        let mut successful_transactions = 0;
        let mut failed_transactions = 0;
        
        for tx in transactions.values() {
            if let Some(tax_amount) = tx.get("tax_amount").and_then(|v| v.as_f64()) {
                total_tax_collected += tax_amount;
            }
            
            match tx.get("status").and_then(|v| v.as_str()) {
                Some("success") | Some("confirmed") => successful_transactions += 1,
                Some("failed") | Some("error") => failed_transactions += 1,
                _ => {} // pending or unknown
            }
        }
        
        json!({
            "tax_config": config,
            "total_transactions": total_transactions,
            "successful_transactions": successful_transactions,
            "failed_transactions": failed_transactions,
            "pending_transactions": total_transactions - successful_transactions - failed_transactions,
            "total_tax_collected_bnb": total_tax_collected,
            "excluded_wallets_count": self.get_excluded_wallets().len()
        })
    }
}

// Mock chrono functionality
mod chrono {
    use std::time::{SystemTime, UNIX_EPOCH};
    pub struct Utc;
    
    impl Utc {
        pub fn now() -> DateTime {
            DateTime
        }
    }
    
    pub struct DateTime;
    
    impl DateTime {
        pub fn to_rfc3339(&self) -> String {
            let duration = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap();
            format!("2025-09-25T{}Z", 
                format!("{:02}:{:02}:{:02}", 
                    (duration.as_secs() / 3600) % 24,
                    (duration.as_secs() / 60) % 60,
                    duration.as_secs() % 60
                )
            )
        }
    }
}

// ===== UTILITY FUNCTIONS =====
fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    format!("id_{}", timestamp)
}

// Build HTTP response with CORS headers for tiny_http
fn build_response_with_cors(status: u16, content_type: &str, body: String) -> Response<std::io::Cursor<Vec<u8>>> {
    let status_code = match status {
        200 => tiny_http::StatusCode(200),
        201 => tiny_http::StatusCode(201),
        204 => tiny_http::StatusCode(204),
        400 => tiny_http::StatusCode(400),
        404 => tiny_http::StatusCode(404),
        500 => tiny_http::StatusCode(500),
        _ => tiny_http::StatusCode(200),
    };
    
    let content_type_header = Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap();
    let cors_origin_header = Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap();
    let cors_methods_header = Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, POST, PUT, DELETE, OPTIONS"[..]).unwrap();
    let cors_headers_header = Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"Content-Type, Authorization"[..]).unwrap();
    
    Response::from_data(body.into_bytes())
        .with_status_code(status_code)
        .with_header(content_type_header)
        .with_header(cors_origin_header)
        .with_header(cors_methods_header)
        .with_header(cors_headers_header)
}

fn success_response(data: Value) -> Response<std::io::Cursor<Vec<u8>>> {
    let response = json!({
        "success": true,
        "data": data,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    build_response_with_cors(200, "application/json", response.to_string())
}

fn error_response(status: u16, message: &str) -> Response<std::io::Cursor<Vec<u8>>> {
    let response = json!({
        "success": false,
        "error": message,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    build_response_with_cors(status, "application/json", response.to_string())
}


fn extract_path_param<'a>(path: &'a str, prefix: &str) -> Option<&'a str> {
    if path.starts_with(prefix) && path.len() > prefix.len() {
        Some(&path[prefix.len()..])
    } else {
        None
    }
}

fn extract_query_param(query: &str, param_name: &str) -> Option<String> {
    for param in query.split('&') {
        if let Some((key, value)) = param.split_once('=') {
            if key == param_name {
                return Some(value.to_string());
            }
        }
    }
    None
}

// ===== API HANDLERS =====

fn handle_health() -> Response<std::io::Cursor<Vec<u8>>> {
    let response = json!({
        "success": true,
        "data": {
            "status": "ok",
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "network": "BNB Smart Chain Testnet (Rust)",
            "server": "JustJewIt Token Launcher Backend v2.0",
            "database": "In-Memory (Development)",
            "features": [
                "Token Management",
                "Draft System", 
                "Launch Plan Generation",
                "Wallet Generation & Management",
                "Multi-Wallet Bundling",
                "BNB Chain Integration",
                "5% Tax Collection System",
                "Treasury Management",
                "Transaction Monitoring",
                "Wallet Exclusion System"
            ]
        }
    });
    build_response_with_cors(200, "application/json", response.to_string())
}

fn handle_create_token(body: &str, db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    match serde_json::from_str::<Value>(body) {
        Ok(data) => {
            let id = generate_id();
            match db.create_token(id, data) {
                Ok(token) => success_response(token),
                Err(e) => error_response(500, &e),
            }
        }
        Err(e) => error_response(400, &format!("Invalid JSON: {}", e)),
    }
}

fn handle_get_token(id: &str, db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    match db.get_token(id) {
        Some(token) => success_response(token),
        None => error_response(404, "Token not found"),
    }
}

fn handle_save_draft(body: &str, db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    match serde_json::from_str::<Value>(body) {
        Ok(data) => {
            let id = data.get("id")
                .and_then(|v| v.as_str())
                .unwrap_or(&generate_id())
                .to_string();
            
            match db.save_draft(id, data) {
                Ok(_) => success_response(json!({"message": "Draft saved successfully"})),
                Err(e) => error_response(500, &e),
            }
        }
        Err(e) => error_response(400, &format!("Invalid JSON: {}", e)),
    }
}

fn handle_get_drafts(db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    let drafts = db.get_drafts();
    success_response(json!(drafts))
}

fn handle_delete_draft(id: &str, db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    if db.delete_draft(id) {
        success_response(json!({"message": "Draft deleted successfully"}))
    } else {
        error_response(404, "Draft not found")
    }
}

fn handle_create_launch_plan(body: &str, db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    match serde_json::from_str::<Value>(body) {
        Ok(data) => {
            let id = generate_id();
            match db.create_launch_plan(id, data) {
                Ok(plan) => success_response(plan),
                Err(e) => error_response(500, &e),
            }
        }
        Err(e) => error_response(400, &format!("Invalid JSON: {}", e)),
    }
}

fn handle_get_launch_plan(id: &str, db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    match db.get_launch_plan(id) {
        Some(plan) => success_response(plan),
        None => error_response(404, "Launch plan not found"),
    }
}

fn handle_generate_wallets(body: &str, db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    match serde_json::from_str::<Value>(body) {
        Ok(data) => {
            let launch_plan_id = data.get("launch_plan_id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let count = data.get("count")
                .and_then(|v| v.as_i64())
                .unwrap_or(5) as i32;
            
            match db.generate_wallets(launch_plan_id, count) {
                Ok(wallets) => success_response(json!(wallets)),
                Err(e) => error_response(500, &e),
            }
        }
        Err(e) => error_response(400, &format!("Invalid JSON: {}", e)),
    }
}

fn handle_get_wallets_by_plan(plan_id: &str, db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    let wallets = db.get_wallets_by_plan(plan_id);
    success_response(json!(wallets))
}

// ===== TAX SYSTEM API HANDLERS =====

fn handle_get_tax_config(db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    let config = db.get_tax_config();
    success_response(config)
}

fn handle_update_tax_config(body: &str, db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    match serde_json::from_str::<Value>(body) {
        Ok(config_data) => {
            match db.update_tax_config(config_data) {
                Ok(updated_config) => success_response(updated_config),
                Err(e) => error_response(500, &e),
            }
        }
        Err(e) => error_response(400, &format!("Invalid JSON: {}", e)),
    }
}

fn handle_add_excluded_wallet(body: &str, db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    match serde_json::from_str::<Value>(body) {
        Ok(data) => {
            let wallet_address = data.get("wallet_address")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let reason = data.get("reason")
                .and_then(|v| v.as_str())
                .unwrap_or("Manual exclusion")
                .to_string();
            
            if wallet_address.is_empty() {
                return error_response(400, "Wallet address is required");
            }
            
            match db.add_excluded_wallet(wallet_address.clone(), reason) {
                Ok(_) => success_response(json!({
                    "message": "Wallet excluded from tax collection",
                    "wallet_address": wallet_address
                })),
                Err(e) => error_response(500, &e),
            }
        }
        Err(e) => error_response(400, &format!("Invalid JSON: {}", e)),
    }
}

fn handle_remove_excluded_wallet(wallet_address: &str, db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    if db.remove_excluded_wallet(wallet_address) {
        success_response(json!({
            "message": "Wallet removed from exclusion list",
            "wallet_address": wallet_address
        }))
    } else {
        error_response(404, "Wallet not found in exclusion list")
    }
}

fn handle_get_excluded_wallets(db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    let excluded_wallets = db.get_excluded_wallets();
    success_response(json!(excluded_wallets))
}

fn handle_record_tax_transaction(body: &str, db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    match serde_json::from_str::<Value>(body) {
        Ok(transaction_data) => {
            // Validate required fields
            let required_fields = ["original_tx_hash", "wallet_address", "transaction_amount", "tax_amount", "transaction_type"];
            for field in &required_fields {
                if transaction_data.get(field).is_none() {
                    return error_response(400, &format!("Missing required field: {}", field));
                }
            }
            
            match db.record_tax_transaction(transaction_data) {
                Ok(tax_tx) => success_response(tax_tx),
                Err(e) => error_response(500, &e),
            }
        }
        Err(e) => error_response(400, &format!("Invalid JSON: {}", e)),
    }
}

fn handle_get_tax_transactions(db: &Database, query_params: &str) -> Response<std::io::Cursor<Vec<u8>>> {
    // Parse limit from query parameters
    let limit = if let Some(limit_str) = extract_query_param(query_params, "limit") {
        limit_str.parse::<i32>().ok()
    } else {
        None
    };
    
    let transactions = db.get_tax_transactions(limit);
    success_response(json!(transactions))
}

fn handle_get_tax_statistics(db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    let stats = db.get_tax_statistics();
    success_response(stats)
}

fn handle_check_wallet_exclusion(wallet_address: &str, db: &Database) -> Response<std::io::Cursor<Vec<u8>>> {
    let is_excluded = db.is_wallet_excluded(wallet_address);
    success_response(json!({
        "wallet_address": wallet_address,
        "is_excluded": is_excluded
    }))
}

fn serve_frontend() -> Response<std::io::Cursor<Vec<u8>>> {
    let html = r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>JustJewIt Token Launcher - Backend API</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #1e1e1e 0%, #2d2d30 100%);
            color: #fff;
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #00ff88; padding-bottom: 20px; }
        .card { 
            background: rgba(26, 26, 26, 0.8); 
            border: 1px solid #333; 
            border-radius: 12px; 
            padding: 25px; 
            margin-bottom: 25px;
        }
        .btn { 
            background: linear-gradient(45deg, #00ff88, #00dd77);
            color: #000; 
            border: none; 
            padding: 12px 24px; 
            border-radius: 8px; 
            cursor: pointer; 
            font-weight: 600;
        }
        .btn:hover { background: linear-gradient(45deg, #00dd77, #00bb66); }
        #status { color: #00ff88; font-size: 18px; font-weight: bold; }
        .endpoint { background: #2a2a2a; padding: 10px; margin: 8px 0; border-radius: 6px; font-family: monospace; }
        .method { color: #ffab00; font-weight: bold; margin-right: 10px; }
        pre { background: #1a1a1a; padding: 15px; border-radius: 8px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 JustJewIt Token Launcher Backend</h1>
            <p>Production Rust API Server with tiny_http Library</p>
            <div id="status">✅ API SERVER RUNNING! 🦀</div>
        </div>

        <div class="card">
            <h3>🔧 API Health Check</h3>
            <button class="btn" onclick="checkHealth()">Check API Health</button>
            <div id="health-result"></div>
        </div>

        <div class="card">
            <h3>📊 Available API Endpoints</h3>
            <div class="endpoint"><span class="method">GET</span> /api/health - System health check</div>
            <div class="endpoint"><span class="method">POST</span> /api/tokens - Create new token</div>
            <div class="endpoint"><span class="method">GET</span> /api/tokens/:id - Get token details</div>
            <div class="endpoint"><span class="method">POST</span> /api/drafts - Save draft</div>
            <div class="endpoint"><span class="method">GET</span> /api/drafts - List all drafts</div>
            <div class="endpoint"><span class="method">DELETE</span> /api/drafts/:id - Delete draft</div>
            <div class="endpoint"><span class="method">POST</span> /api/launch-plans - Create launch plan</div>
            <div class="endpoint"><span class="method">GET</span> /api/launch-plans/:id - Get launch plan</div>
            <div class="endpoint"><span class="method">POST</span> /api/wallets/generate - Generate wallets</div>
            <div class="endpoint"><span class="method">GET</span> /api/wallets/:plan_id - Get wallets by plan</div>
            
            <h4 style="margin-top: 20px; color: #00ff88;">🏛️ Tax System API</h4>
            <div class="endpoint"><span class="method">GET</span> /api/tax/config - Get tax configuration</div>
            <div class="endpoint"><span class="method">PUT</span> /api/tax/config - Update tax configuration</div>
            <div class="endpoint"><span class="method">GET</span> /api/tax/statistics - Get tax collection statistics</div>
            <div class="endpoint"><span class="method">GET</span> /api/tax/transactions - Get tax transaction history</div>
            <div class="endpoint"><span class="method">POST</span> /api/tax/transactions - Record tax transaction</div>
            <div class="endpoint"><span class="method">GET</span> /api/tax/excluded-wallets - Get excluded wallets</div>
            <div class="endpoint"><span class="method">POST</span> /api/tax/excluded-wallets - Add wallet exclusion</div>
            <div class="endpoint"><span class="method">DELETE</span> /api/tax/excluded-wallets/:address - Remove wallet exclusion</div>
            <div class="endpoint"><span class="method">GET</span> /api/tax/check-exclusion/:address - Check if wallet is excluded</div>
        </div>

        <div class="card">
            <h3>🛠️ Technical Details</h3>
            <ul>
                <li><strong>Backend:</strong> Rust with tiny_http library</li>
                <li><strong>Storage:</strong> In-memory hash maps (development mode)</li>
                <li><strong>API:</strong> RESTful JSON endpoints with CORS support</li>
                <li><strong>Network:</strong> BNB Smart Chain compatible</li>
                <li><strong>Port:</strong> 8000</li>
            </ul>
        </div>
    </div>

    <script>
        async function checkHealth() {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                document.getElementById('health-result').innerHTML = 
                    `<pre style="color: #00ff88; margin-top: 15px;">${JSON.stringify(data, null, 2)}</pre>`;
            } catch (error) {
                document.getElementById('health-result').innerHTML = 
                    `<p style="color: #ff4444; margin-top: 15px;">❌ Error: ${error.message}</p>`;
            }
        }
        
        document.addEventListener('DOMContentLoaded', checkHealth);
    </script>
</body>
</html>"#;
    build_response_with_cors(200, "text/html", html.to_string())
}

// ===== MAIN REQUEST HANDLER =====

fn handle_request(mut request: Request, db: &Database) {
    let method = request.method().clone();
    let url = request.url().to_string();
    let path = url.split('?').next().unwrap_or(&url);

    // Handle CORS preflight
    if method == Method::Options {
        let response = build_response_with_cors(204, "text/plain", String::new());
        let _ = request.respond(response);
        return;
    }
    
    // Read request body once if needed for POST requests
    let request_body = if method == Method::Post {
        read_request_body_safe(&mut request)
    } else {
        Ok(String::new())
    };
    
    let response = match (&method, path) {
        (&Method::Get, "/api/health") => handle_health(),
        
        (&Method::Post, "/api/tokens") => {
            match request_body {
                Ok(body) => handle_create_token(&body, db),
                Err(_) => error_response(400, "Request body is required")
            }
        }
        (&Method::Get, path) if path.starts_with("/api/tokens/") => {
            if let Some(id) = extract_path_param(path, "/api/tokens/") {
                handle_get_token(id, db)
            } else {
                error_response(400, "Token ID is required")
            }
        }
        
        (&Method::Post, "/api/drafts") => {
            match request_body {
                Ok(body) => handle_save_draft(&body, db),
                Err(_) => error_response(400, "Request body is required")
            }
        }
        (&Method::Get, "/api/drafts") => handle_get_drafts(db),
        (&Method::Delete, path) if path.starts_with("/api/drafts/") => {
            if let Some(id) = extract_path_param(path, "/api/drafts/") {
                handle_delete_draft(id, db)
            } else {
                error_response(400, "Draft ID is required")
            }
        }
        
        (&Method::Post, "/api/launch-plans") => {
            match request_body {
                Ok(body) => handle_create_launch_plan(&body, db),
                Err(_) => error_response(400, "Request body is required")
            }
        }
        (&Method::Get, path) if path.starts_with("/api/launch-plans/") => {
            if let Some(id) = extract_path_param(path, "/api/launch-plans/") {
                handle_get_launch_plan(id, db)
            } else {
                error_response(400, "Launch plan ID is required")
            }
        }
        
        (&Method::Post, "/api/wallets/generate") => {
            match request_body {
                Ok(body) => handle_generate_wallets(&body, db),
                Err(_) => error_response(400, "Request body is required")
            }
        }
        (&Method::Get, path) if path.starts_with("/api/wallets/") => {
            if let Some(plan_id) = extract_path_param(path, "/api/wallets/") {
                handle_get_wallets_by_plan(plan_id, db)
            } else {
                error_response(400, "Launch plan ID is required")
            }
        }
        
        // Tax system endpoints
        (&Method::Get, "/api/tax/config") => handle_get_tax_config(db),
        (&Method::Put, "/api/tax/config") => {
            match request_body {
                Ok(body) => handle_update_tax_config(&body, db),
                Err(_) => error_response(400, "Request body is required")
            }
        }
        (&Method::Get, "/api/tax/statistics") => handle_get_tax_statistics(db),
        (&Method::Get, path) if path.starts_with("/api/tax/transactions") => {
            let query_params = url.split('?').nth(1).unwrap_or("");
            handle_get_tax_transactions(db, query_params)
        }
        (&Method::Post, "/api/tax/transactions") => {
            match request_body {
                Ok(body) => handle_record_tax_transaction(&body, db),
                Err(_) => error_response(400, "Request body is required")
            }
        }
        (&Method::Get, "/api/tax/excluded-wallets") => handle_get_excluded_wallets(db),
        (&Method::Post, "/api/tax/excluded-wallets") => {
            match request_body {
                Ok(body) => handle_add_excluded_wallet(&body, db),
                Err(_) => error_response(400, "Request body is required")
            }
        }
        (&Method::Delete, path) if path.starts_with("/api/tax/excluded-wallets/") => {
            if let Some(wallet_address) = extract_path_param(path, "/api/tax/excluded-wallets/") {
                handle_remove_excluded_wallet(wallet_address, db)
            } else {
                error_response(400, "Wallet address is required")
            }
        }
        (&Method::Get, path) if path.starts_with("/api/tax/check-exclusion/") => {
            if let Some(wallet_address) = extract_path_param(path, "/api/tax/check-exclusion/") {
                handle_check_wallet_exclusion(wallet_address, db)
            } else {
                error_response(400, "Wallet address is required")
            }
        }
        
        (&Method::Get, "/") => serve_frontend(),
        _ => error_response(404, "Endpoint not found")
    };
    
    // Send the response
    let _ = request.respond(response);
}

// Helper function to read request body without consuming the request  
fn read_request_body_safe(request: &mut Request) -> Result<String, Box<dyn std::error::Error>> {
    use std::io::Read;
    let mut body = String::new();
    request.as_reader().read_to_string(&mut body)?;
    Ok(body)
}

// ===== MAIN FUNCTION =====


fn main() {
    let db = Database::new();
    
    println!("🦀 JustJewIt Token Launcher Backend v2.0");
    println!("🌐 Server running on http://0.0.0.0:8000");
    println!("💾 Using in-memory storage (development mode)");
    println!("🔗 Ready for BNB Smart Chain integration");
    println!("🚀 Production API Server Ready!");
    println!("\n📋 Available API Endpoints:");
    println!("   • GET  /api/health");
    println!("   • POST /api/tokens");
    println!("   • GET  /api/tokens/:id");
    println!("   • POST /api/drafts");
    println!("   • GET  /api/drafts");
    println!("   • DELETE /api/drafts/:id");
    println!("   • POST /api/launch-plans");
    println!("   • GET  /api/launch-plans/:id");
    println!("   • POST /api/wallets/generate");
    println!("   • GET  /api/wallets/:plan_id");
    println!("   • GET  /api/tax/config");
    println!("   • PUT  /api/tax/config");
    println!("   • GET  /api/tax/statistics");
    println!("   • GET  /api/tax/transactions");
    println!("   • POST /api/tax/transactions");
    println!("   • GET  /api/tax/excluded-wallets");
    println!("   • POST /api/tax/excluded-wallets");
    println!("   • DELETE /api/tax/excluded-wallets/:address");
    println!("   • GET  /api/tax/check-exclusion/:address");
    println!("\n🔍 Starting tiny_http server...");
    
    // Create the HTTP server using tiny_http
    let server = match Server::http("0.0.0.0:8000") {
        Ok(server) => {
            println!("✅ Server successfully bound to port 8000");
            server
        }
        Err(e) => {
            eprintln!("❌ Failed to bind to port 8000: {}", e);
            return;
        }
    };
    
    println!("🔍 Listening for HTTP requests...");
    
    // Handle requests in a loop with explicit error handling
    loop {
        match server.recv() {
            Ok(request) => {
                let peer_addr = request.remote_addr().map(|addr| addr.to_string()).unwrap_or_else(|| "unknown".to_string());
                let method = request.method().clone();
                let url = request.url().to_string();
                
                // Handle the request and generate response
                handle_request(request, &db);
                
                // Log the request
                println!("✅ {} {} - {}", method, url, peer_addr);
            }
            Err(e) => {
                eprintln!("⚠️  Error receiving request: {}", e);
                // Don't break - continue processing other requests
                std::thread::sleep(std::time::Duration::from_millis(100));
                continue;
            }
        }
    }
}