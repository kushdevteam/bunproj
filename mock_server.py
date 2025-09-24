#!/usr/bin/env python3
"""
Mock server for SolNox Solana Bundler to serve the frontend and provide mock API endpoints
while the Rust backend compilation issues are being resolved.
"""

import json
import random
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
import uuid


class MockAPI(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests"""
        if self.path == "/":
            self.serve_frontend()
        elif self.path == "/api/health":
            self.serve_health()
        elif self.path == "/api/statistics":
            self.serve_statistics()
        elif self.path.startswith("/api/wallets/balances"):
            self.serve_balances()
        else:
            self.serve_404()

    def do_POST(self):
        """Handle POST requests"""
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length).decode('utf-8')
        
        try:
            data = json.loads(post_data) if post_data else {}
        except json.JSONDecodeError:
            data = {}

        if self.path == "/api/wallets/generate":
            self.serve_generate_wallets(data)
        elif self.path == "/api/wallets/fund":
            self.serve_fund_wallets(data)
        elif self.path == "/api/bundle/execute":
            self.serve_execute_bundle(data)
        elif self.path == "/api/tokens/create":
            self.serve_create_token(data)
        else:
            self.serve_404()

    def serve_frontend(self):
        """Serve the HTML frontend"""
        try:
            with open('frontend.html', 'r') as f:
                content = f.read()
            
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            self.end_headers()
            self.wfile.write(content.encode())
        except FileNotFoundError:
            self.serve_404()

    def serve_health(self):
        """Serve health check endpoint"""
        response = {
            "success": True,
            "data": {
                "status": "ok",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "network": "Solana Devnet (Mock)",
                "server": "SolNox Solana Bundler (Python Mock Server)",
                "features": [
                    "Wallet Generation",
                    "Multi-Wallet Bundling", 
                    "Transaction Simulation",
                    "Bundle Execution",
                    "Balance Checking"
                ]
            }
        }
        self.send_json_response(response)

    def serve_statistics(self):
        """Serve statistics data for the dashboard"""
        response = {
            "success": True,
            "data": {
                "tokensLaunched": 87,
                "profits": 842.2,
                "lastLaunch": "$XPD",
                "usersReferred": 3,
                "referralRate": 15,
                "referralEarned": 66.93,
                "chartData": [
                    {"date": "Jul 13", "profit": 50},
                    {"date": "Jul 20", "profit": 120},
                    {"date": "Jul 27", "profit": 200},
                    {"date": "Aug 3", "profit": 280},
                    {"date": "Aug 10", "profit": 350},
                    {"date": "Aug 17", "profit": 450},
                    {"date": "Aug 24", "profit": 550},
                    {"date": "Aug 31", "profit": 650},
                    {"date": "Sep 7", "profit": 750},
                    {"date": "Sep 14", "profit": 800},
                    {"date": "Sep 21", "profit": 842.2}
                ]
            }
        }
        self.send_json_response(response)

    def serve_create_token(self, data):
        """Handle token creation requests"""
        name = data.get('name', '')
        symbol = data.get('symbol', '')
        description = data.get('description', '')
        platform = data.get('platform', 'pumpfun')
        
        if not name or not symbol or not description:
            error_response = {
                "success": False,
                "error": "Name, symbol, and description are required"
            }
            self.send_json_response(error_response)
            return
        
        # Simulate token creation
        token_id = str(uuid.uuid4())
        token_address = self.generate_solana_address()
        
        # Simulate creation delay
        time.sleep(random.uniform(1.0, 3.0))
        
        # Simulate 95% success rate
        if random.random() > 0.05:
            response = {
                "success": True,
                "data": {
                    "tokenId": token_id,
                    "tokenAddress": token_address,
                    "name": name,
                    "symbol": symbol,
                    "description": description,
                    "platform": platform,
                    "created_at": datetime.utcnow().isoformat() + "Z",
                    "status": "created"
                }
            }
        else:
            response = {
                "success": False,
                "error": "Token creation failed - platform error"
            }
        
        self.send_json_response(response)

    def serve_generate_wallets(self, data):
        """Generate mock wallets"""
        count = data.get('count', 5)
        count = min(max(count, 1), 100)  # Limit between 1-100
        
        wallets = []
        for i in range(count):
            # Generate mock Solana address (44 characters, base58)
            address = self.generate_solana_address()
            wallet = {
                "public_key": address,
                "balance": 0.0,
                "created_at": datetime.utcnow().isoformat() + "Z"
            }
            wallets.append(wallet)
        
        response = {
            "success": True,
            "data": wallets
        }
        self.send_json_response(response)

    def serve_fund_wallets(self, data):
        """Fund mock wallets"""
        wallets = data.get('wallets', [])
        amount = data.get('amount', 0.1)
        
        funded_wallets = []
        for wallet_address in wallets:
            # Simulate funding success (95% success rate)
            success = random.random() > 0.05
            balance = amount if success else 0.0
            
            wallet = {
                "public_key": wallet_address,
                "balance": balance,
                "created_at": datetime.utcnow().isoformat() + "Z"
            }
            funded_wallets.append(wallet)
            
            # Simulate network delay
            time.sleep(random.uniform(0.1, 0.3))
        
        response = {
            "success": True,
            "data": funded_wallets
        }
        self.send_json_response(response)

    def serve_balances(self):
        """Serve wallet balances"""
        query_params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        wallet_addresses = []
        
        if 'wallets' in query_params:
            try:
                wallet_addresses = json.loads(query_params['wallets'][0])
            except (json.JSONDecodeError, IndexError):
                pass
        
        balances = []
        for address in wallet_addresses:
            balance = random.uniform(0.05, 2.0)  # Random balance
            balances.append({
                "public_key": address,
                "balance": balance
            })
        
        response = {
            "success": True,
            "data": balances
        }
        self.send_json_response(response)

    def serve_execute_bundle(self, data):
        """Execute mock bundle"""
        bundle_type = data.get('bundle_type', 'buy')
        wallets = data.get('wallets', [])
        amount_per_wallet = data.get('amount_per_wallet', 0.1)
        settings = data.get('settings', {})
        
        # Simulate bundle execution
        bundle_id = str(uuid.uuid4())
        transactions = []
        success_count = 0
        total_cost = 0.0
        
        for wallet in wallets:
            # Simulate transaction execution (90% success rate)
            success = random.random() > 0.1
            
            if success:
                success_count += 1
                signature = self.generate_signature()
                fee = settings.get('priority_fee', 0.001)
                total_cost += amount_per_wallet + fee
                
                transaction = {
                    "wallet": wallet,
                    "signature": signature,
                    "status": "confirmed",
                    "amount": amount_per_wallet,
                    "fee": fee,
                    "error": None,
                    "execution_time_ms": random.randint(200, 1000)
                }
            else:
                transaction = {
                    "wallet": wallet,
                    "signature": None,
                    "status": "failed",
                    "amount": amount_per_wallet,
                    "fee": 0.0,
                    "error": "Transaction failed - simulated error",
                    "execution_time_ms": random.randint(100, 500)
                }
            
            transactions.append(transaction)
            
            # Simulate stagger delay
            if settings.get('stealth_mode', False):
                delay = settings.get('stagger_delay', 100) / 1000.0
                time.sleep(delay)
        
        bundle_result = {
            "bundle_id": bundle_id,
            "bundle_type": bundle_type,
            "success_count": success_count,
            "total_transactions": len(wallets),
            "transactions": transactions,
            "execution_time_ms": random.randint(1000, 5000),
            "total_cost": total_cost,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        response = {
            "success": True,
            "data": bundle_result
        }
        self.send_json_response(response)

    def generate_solana_address(self):
        """Generate a mock Solana address (44 characters, base58)"""
        chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
        return ''.join(random.choice(chars) for _ in range(44))

    def generate_signature(self):
        """Generate a mock Solana transaction signature (88 characters, base58)"""
        chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
        return ''.join(random.choice(chars) for _ in range(88))

    def send_json_response(self, data):
        """Send a JSON response"""
        response = json.dumps(data, indent=2)
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # Enable CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(response.encode())

    def serve_404(self):
        """Serve 404 response"""
        self.send_response(404)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'Not Found')

    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        """Custom logging"""
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {format % args}")


def run_server():
    """Run the mock server"""
    server_address = ('0.0.0.0', 5000)
    httpd = HTTPServer(server_address, MockAPI)
    print("🦀 SolNox Solana Bundler Mock Server")
    print("🌐 Server running on http://0.0.0.0:5000")
    print("📡 Serving mock Solana API endpoints")
    print("⚠️  This is a mock server - Rust backend compilation in progress")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
        httpd.shutdown()


if __name__ == '__main__':
    run_server()