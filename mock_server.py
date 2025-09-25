#!/usr/bin/env python3
"""
Mock server for JustJewIt Smart Chain Bundler to serve the frontend and provide mock API endpoints
while the Rust backend compilation issues are being resolved.
"""

import json
import random
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
import uuid

# Global storage for wallet balances and state
WALLET_STORAGE = {}
OPERATION_HISTORY = []

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
        elif self.path == "/api/users":
            self.serve_users_list()
        elif self.path == "/api/users/sessions":
            self.serve_user_sessions()
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
        elif self.path == "/api/treasury/withdraw":
            self.serve_treasury_withdraw(data)
        elif self.path == "/api/users/login":
            self.serve_user_login(data)
        elif self.path == "/api/users/create":
            self.serve_user_create(data)
        elif self.path == "/api/users/update":
            self.serve_user_update(data)
        elif self.path == "/api/users/delete":
            self.serve_user_delete(data)
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
                "network": "BNB Smart Chain Testnet (Mock)",
                "server": "JustJewIt Smart Chain Bundler (Python Mock Server)",
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
        platform = data.get('platform', 'pancakeswap')
        
        if not name or not symbol or not description:
            error_response = {
                "success": False,
                "error": "Name, symbol, and description are required"
            }
            self.send_json_response(error_response)
            return
        
        # Simulate token creation
        token_id = str(uuid.uuid4())
        token_address = self.generate_bnb_address()
        
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
            # Generate mock BNB address (0x + 40 hex characters)
            address = self.generate_bnb_address()
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
        """Fund mock wallets with persistent storage"""
        wallets = data.get('wallets', [])
        amount = data.get('amount', 0.1)
        
        funded_wallets = []
        operation_id = str(uuid.uuid4())
        
        for wallet_address in wallets:
            # Simulate funding success (95% success rate)
            success = random.random() > 0.05
            
            if success:
                # Update stored balance
                current_balance = WALLET_STORAGE.get(wallet_address, 0.0)
                new_balance = current_balance + amount
                WALLET_STORAGE[wallet_address] = new_balance
                
                wallet = {
                    "public_key": wallet_address,
                    "balance": new_balance,
                    "funded_amount": amount,
                    "created_at": datetime.utcnow().isoformat() + "Z",
                    "success": True
                }
            else:
                # Funding failed, balance unchanged
                current_balance = WALLET_STORAGE.get(wallet_address, 0.0)
                wallet = {
                    "public_key": wallet_address,
                    "balance": current_balance,
                    "funded_amount": 0.0,
                    "created_at": datetime.utcnow().isoformat() + "Z",
                    "success": False,
                    "error": "Funding simulation failed"
                }
            
            funded_wallets.append(wallet)
            
            # Simulate network delay
            time.sleep(random.uniform(0.05, 0.15))
        
        # Store operation in history
        operation = {
            "id": operation_id,
            "type": "funding",
            "wallets": wallets,
            "amount_per_wallet": amount,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "results": funded_wallets
        }
        OPERATION_HISTORY.append(operation)
        
        response = {
            "success": True,
            "data": funded_wallets,
            "operation_id": operation_id
        }
        self.send_json_response(response)

    def serve_balances(self):
        """Serve wallet balances from persistent storage"""
        query_params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        wallet_addresses = []
        
        # Parse addresses from query parameters (multiple formats supported)
        if 'wallets' in query_params:
            try:
                wallet_addresses = json.loads(query_params['wallets'][0])
            except (json.JSONDecodeError, IndexError):
                pass
        elif 'address' in query_params:
            # Support for ?address=0x123&address=0x456 format
            wallet_addresses = query_params['address']
        
        balances = []
        for address in wallet_addresses:
            # Get stored balance or default to small random amount for new wallets
            if address in WALLET_STORAGE:
                balance = WALLET_STORAGE[address]
            else:
                # Initialize new wallets with small random balance
                balance = random.uniform(0.01, 0.05)
                WALLET_STORAGE[address] = balance
            
            balances.append({
                "public_key": address,
                "balance": balance,
                "last_updated": datetime.utcnow().isoformat() + "Z"
            })
        
        response = {
            "success": True,
            "data": balances,
            "total_wallets": len(balances)
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

    def serve_treasury_withdraw(self, data):
        """Handle treasury withdrawal requests with persistent storage"""
        operation_type = data.get('type', 'withdraw_partial')
        treasury_address = data.get('treasuryAddress', '')
        selected_wallets = data.get('selectedWallets', [])
        withdrawal_amounts = data.get('withdrawalAmounts', {})
        
        if not treasury_address:
            error_response = {
                "success": False,
                "error": "Treasury address is required"
            }
            self.send_json_response(error_response)
            return
        
        if not selected_wallets:
            error_response = {
                "success": False,
                "error": "No wallets selected for withdrawal"
            }
            self.send_json_response(error_response)
            return
        
        # Simulate withdrawal execution
        operation_id = str(uuid.uuid4())
        transactions = []
        total_withdrawn = 0.0
        
        for wallet_address, amount in withdrawal_amounts.items():
            if amount > 0:
                # Check current stored balance
                current_balance = WALLET_STORAGE.get(wallet_address, 0.0)
                
                # Can't withdraw more than available
                withdrawal_amount = min(amount, current_balance)
                
                if withdrawal_amount > 0:
                    # Simulate transaction execution (95% success rate)
                    success = random.random() > 0.05
                    
                    if success:
                        # Update stored balance
                        new_balance = current_balance - withdrawal_amount
                        WALLET_STORAGE[wallet_address] = max(0.0, new_balance)
                        
                        transaction = {
                            "id": f"tx_{uuid.uuid4()}",
                            "walletAddress": wallet_address,
                            "amount": withdrawal_amount,
                            "status": "confirmed",
                            "txHash": self.generate_signature(),
                            "gasUsed": str(random.randint(21000, 25000)),
                            "error": None,
                            "timestamp": datetime.utcnow().isoformat() + "Z",
                            "balanceAfter": new_balance
                        }
                        total_withdrawn += withdrawal_amount
                    else:
                        transaction = {
                            "id": f"tx_{uuid.uuid4()}",
                            "walletAddress": wallet_address,
                            "amount": 0.0,
                            "status": "failed",
                            "txHash": None,
                            "gasUsed": "0",
                            "error": "Withdrawal failed - simulated error",
                            "timestamp": datetime.utcnow().isoformat() + "Z",
                            "balanceAfter": current_balance
                        }
                    
                    transactions.append(transaction)
                    
                    # Simulate network delay
                    time.sleep(random.uniform(0.05, 0.15))
        
        # Store operation in history
        operation = {
            "id": operation_id,
            "type": "treasury_withdrawal",
            "operation_type": operation_type,
            "treasury_address": treasury_address,
            "selected_wallets": selected_wallets,
            "withdrawal_amounts": withdrawal_amounts,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "results": transactions
        }
        OPERATION_HISTORY.append(operation)
        
        response = {
            "success": True,
            "data": {
                "operationId": operation_id,
                "type": operation_type,
                "treasuryAddress": treasury_address,
                "transactions": transactions,
                "totalWithdrawn": total_withdrawn,
                "status": "completed",
                "completedAt": datetime.utcnow().isoformat() + "Z"
            }
        }
        
        self.send_json_response(response)

    def serve_user_login(self, data):
        """Handle user login requests"""
        username = data.get('username', '').lower().strip()
        pin = data.get('pin', '')
        
        if not username or not pin:
            response = {
                "success": False,
                "error": "Username and PIN are required"
            }
            self.send_json_response(response)
            return
        
        # Admin login
        if username == 'walshadmin' and pin == '612599':
            session_id = str(uuid.uuid4())
            response = {
                "success": True,
                "data": {
                    "user": {
                        "id": "admin",
                        "username": "walshadmin",
                        "role": "admin",
                        "created_at": datetime.utcnow().isoformat() + "Z",
                        "last_login_at": datetime.utcnow().isoformat() + "Z",
                        "is_active": True
                    },
                    "session": {
                        "session_id": session_id,
                        "login_at": datetime.utcnow().isoformat() + "Z",
                        "expires_at": datetime.utcnow().isoformat() + "Z"
                    }
                }
            }
            self.send_json_response(response)
            return
        
        # Demo user login
        if username == 'demo' and pin == '123456':
            session_id = str(uuid.uuid4())
            response = {
                "success": True,
                "data": {
                    "user": {
                        "id": "demo_user_001",
                        "username": "demo",
                        "role": "user",
                        "created_at": datetime.utcnow().isoformat() + "Z",
                        "last_login_at": datetime.utcnow().isoformat() + "Z",
                        "is_active": True
                    },
                    "session": {
                        "session_id": session_id,
                        "login_at": datetime.utcnow().isoformat() + "Z",
                        "expires_at": datetime.utcnow().isoformat() + "Z"
                    }
                }
            }
            self.send_json_response(response)
            return
        
        # Invalid credentials
        response = {
            "success": False,
            "error": "Invalid username or PIN"
        }
        self.send_json_response(response)

    def serve_user_create(self, data):
        """Handle user creation requests (admin only)"""
        username = data.get('username', '').lower().strip()
        pin = data.get('pin', '')
        role = data.get('role', 'user')
        admin_session = data.get('admin_session', '')
        
        # Validate admin session (simplified for mock)
        if not admin_session:
            response = {
                "success": False,
                "error": "Admin authentication required"
            }
            self.send_json_response(response)
            return
        
        if not username or not pin:
            response = {
                "success": False,
                "error": "Username and PIN are required"
            }
            self.send_json_response(response)
            return
        
        if len(pin) != 6 or not pin.isdigit():
            response = {
                "success": False,
                "error": "PIN must be exactly 6 digits"
            }
            self.send_json_response(response)
            return
        
        # Check if username already exists (simplified check)
        if username in ['walshadmin', 'demo', 'admin', 'test']:
            response = {
                "success": False,
                "error": "Username already exists"
            }
            self.send_json_response(response)
            return
        
        # Create user
        user_id = str(uuid.uuid4())
        response = {
            "success": True,
            "data": {
                "user": {
                    "id": user_id,
                    "username": username,
                    "role": role,
                    "created_at": datetime.utcnow().isoformat() + "Z",
                    "is_active": True
                }
            }
        }
        self.send_json_response(response)

    def serve_user_update(self, data):
        """Handle user update requests (admin only)"""
        user_id = data.get('user_id', '')
        updates = data.get('updates', {})
        admin_session = data.get('admin_session', '')
        
        if not admin_session:
            response = {
                "success": False,
                "error": "Admin authentication required"
            }
            self.send_json_response(response)
            return
        
        if not user_id:
            response = {
                "success": False,
                "error": "User ID is required"
            }
            self.send_json_response(response)
            return
        
        # Mock successful update
        response = {
            "success": True,
            "data": {
                "user": {
                    "id": user_id,
                    "updated_at": datetime.utcnow().isoformat() + "Z",
                    **updates
                }
            }
        }
        self.send_json_response(response)

    def serve_user_delete(self, data):
        """Handle user deletion requests (admin only)"""
        user_id = data.get('user_id', '')
        admin_session = data.get('admin_session', '')
        
        if not admin_session:
            response = {
                "success": False,
                "error": "Admin authentication required"
            }
            self.send_json_response(response)
            return
        
        if not user_id:
            response = {
                "success": False,
                "error": "User ID is required"
            }
            self.send_json_response(response)
            return
        
        # Prevent deleting admin
        if user_id == 'admin':
            response = {
                "success": False,
                "error": "Cannot delete admin user"
            }
            self.send_json_response(response)
            return
        
        # Mock successful deletion
        response = {
            "success": True,
            "data": {
                "deleted_user_id": user_id,
                "deleted_at": datetime.utcnow().isoformat() + "Z"
            }
        }
        self.send_json_response(response)

    def serve_users_list(self):
        """Serve list of users (admin only)"""
        # Mock users list
        users = [
            {
                "id": "admin",
                "username": "walshadmin",
                "role": "admin",
                "created_at": "2024-01-01T00:00:00Z",
                "last_login_at": datetime.utcnow().isoformat() + "Z",
                "is_active": True
            },
            {
                "id": "demo_user_001",
                "username": "demo",
                "role": "user",
                "created_at": "2024-01-01T00:00:00Z",
                "last_login_at": datetime.utcnow().isoformat() + "Z",
                "is_active": True
            }
        ]
        
        response = {
            "success": True,
            "data": {
                "users": users,
                "total_count": len(users)
            }
        }
        self.send_json_response(response)

    def serve_user_sessions(self):
        """Serve active user sessions (admin only)"""
        # Mock active sessions
        sessions = [
            {
                "session_id": str(uuid.uuid4()),
                "user_id": "admin",
                "username": "walshadmin",
                "login_at": datetime.utcnow().isoformat() + "Z",
                "last_activity": datetime.utcnow().isoformat() + "Z",
                "ip_address": "127.0.0.1",
                "user_agent": "Mozilla/5.0"
            }
        ]
        
        response = {
            "success": True,
            "data": {
                "sessions": sessions,
                "active_count": len(sessions)
            }
        }
        self.send_json_response(response)

    def generate_bnb_address(self):
        """Generate a mock BNB Smart Chain address (0x + 40 hex characters)"""
        chars = "0123456789abcdef"
        address_hex = ''.join(random.choice(chars) for _ in range(40))
        return f"0x{address_hex}"

    def generate_signature(self):
        """Generate a mock BNB Smart Chain transaction hash (0x + 64 hex characters)"""
        chars = "0123456789abcdef"
        tx_hash = ''.join(random.choice(chars) for _ in range(64))
        return f"0x{tx_hash}"

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
    server_address = ('0.0.0.0', 8000)
    httpd = HTTPServer(server_address, MockAPI)
    print("🦀 JustJewIt Smart Chain Bundler Mock Server")
    print("🌐 Server running on http://0.0.0.0:8000")
    print("📡 Serving mock BNB Smart Chain API endpoints")
    print("⚠️  This is a mock server - Rust backend compilation in progress")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
        httpd.shutdown()


if __name__ == '__main__':
    run_server()