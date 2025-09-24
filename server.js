const express = require('express');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Telegram Bot
let telegramBot = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
        telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
        console.log('🤖 Telegram Bot initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize Telegram Bot:', error.message);
    }
} else {
    console.log('⚠️ Telegram Bot Token not found. Bot features disabled.');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Solana connection
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// In-memory storage for wallet data and transaction history
let walletStore = new Map();
let transactionHistory = [];
let bundleCounter = 0;
let chatSubscriptions = new Map(); // Store Telegram chat IDs for notifications

// Enhanced stealth mode configuration
const stealthConfig = {
    useRandomDelays: true,
    randomizeTransactionOrder: true,
    useMultipleRPCs: true,
    avoidMEVDetection: true,
    customUserAgents: true,
    vpnRotation: false // Would need external VPN service
};

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        network: SOLANA_RPC_URL,
        server: 'Proxima Bundler API'
    });
});

/**
 * Generate wallets endpoint
 */
app.post('/api/wallets/generate', async (req, res) => {
    try {
        const { count } = req.body;
        
        if (!count || count < 1 || count > 100) {
            return res.status(400).json({
                success: false,
                error: 'Invalid wallet count. Must be between 1 and 100.'
            });
        }

        const wallets = [];
        
        for (let i = 0; i < count; i++) {
            const keypair = Keypair.generate();
            const wallet = {
                publicKey: keypair.publicKey.toString(),
                secretKey: Array.from(keypair.secretKey),
                balance: 0,
                created: new Date().toISOString()
            };
            
            wallets.push({
                publicKey: wallet.publicKey,
                balance: wallet.balance
            });
            
            // Store full wallet data (including secret key) server-side
            walletStore.set(wallet.publicKey, wallet);
        }

        console.log(`Generated ${count} wallets`);
        
        res.json({
            success: true,
            wallets: wallets,
            count: count
        });

    } catch (error) {
        console.error('Error generating wallets:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate wallets: ' + error.message
        });
    }
});

/**
 * Fund wallets endpoint
 */
app.post('/api/wallets/fund', async (req, res) => {
    try {
        const { wallets, amount } = req.body;
        
        if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No wallets provided'
            });
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid funding amount'
            });
        }

        const fundedWallets = [];
        let fundedCount = 0;

        // Simulate funding for devnet (in production, this would request from faucet or transfer from main wallet)
        for (const walletAddress of wallets) {
            try {
                const walletData = walletStore.get(walletAddress);
                if (!walletData) {
                    console.warn(`Wallet not found: ${walletAddress}`);
                    continue;
                }

                // Simulate funding (in production, would actually transfer SOL)
                walletData.balance = amount;
                walletData.lastFunded = new Date().toISOString();
                
                fundedWallets.push({
                    publicKey: walletAddress,
                    balance: walletData.balance
                });
                
                fundedCount++;
                
                // Simulate funding delay
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`Error funding wallet ${walletAddress}:`, error);
            }
        }

        console.log(`Funded ${fundedCount} wallets with ${amount} SOL each`);
        
        res.json({
            success: true,
            wallets: fundedWallets,
            funded: fundedCount,
            totalAmount: fundedCount * amount
        });

    } catch (error) {
        console.error('Error funding wallets:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fund wallets: ' + error.message
        });
    }
});

/**
 * Get wallet balances endpoint
 */
app.post('/api/wallets/balances', async (req, res) => {
    try {
        const { wallets } = req.body;
        
        if (!wallets || !Array.isArray(wallets)) {
            return res.status(400).json({
                success: false,
                error: 'No wallets provided'
            });
        }

        const walletsWithBalances = [];
        const balances = {};

        for (const walletAddress of wallets) {
            try {
                const walletData = walletStore.get(walletAddress);
                if (walletData) {
                    // In production, would query actual blockchain balance
                    // const balance = await connection.getBalance(new PublicKey(walletAddress));
                    // const solBalance = balance / LAMPORTS_PER_SOL;
                    
                    walletsWithBalances.push({
                        publicKey: walletAddress,
                        balance: walletData.balance
                    });
                    
                    balances[walletAddress] = walletData.balance;
                }
            } catch (error) {
                console.error(`Error getting balance for ${walletAddress}:`, error);
                walletsWithBalances.push({
                    publicKey: walletAddress,
                    balance: 0
                });
                balances[walletAddress] = 0;
            }
        }

        res.json({
            success: true,
            wallets: walletsWithBalances,
            balances: balances
        });

    } catch (error) {
        console.error('Error getting balances:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get balances: ' + error.message
        });
    }
});

/**
 * Execute bundle endpoint
 */
app.post('/api/bundle/execute', async (req, res) => {
    try {
        const { type, tokenAddress, amountPerWallet, wallets, settings } = req.body;
        
        if (!type || !wallets || !Array.isArray(wallets) || wallets.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid bundle configuration'
            });
        }

        if (!amountPerWallet || amountPerWallet <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount per wallet'
            });
        }

        const bundleId = ++bundleCounter;
        console.log(`Executing bundle ${bundleId}: ${type} with ${wallets.length} wallets`);

        const transactions = [];
        let successCount = 0;
        let totalCost = 0;

        // Execute transactions for each wallet
        for (let i = 0; i < wallets.length; i++) {
            const wallet = wallets[i];
            
            try {
                // Simulate transaction execution
                await simulateTransaction(wallet, type, tokenAddress, amountPerWallet, settings);
                
                const transaction = {
                    wallet: wallet.publicKey,
                    status: 'confirmed',
                    amount: amountPerWallet,
                    fee: settings.priorityFee || 0.001,
                    signature: generateMockSignature(),
                    timestamp: new Date().toISOString(),
                    bundleId: bundleId
                };
                
                transactions.push(transaction);
                successCount++;
                totalCost += amountPerWallet + (settings.priorityFee || 0.001);
                
                // Apply stagger delay
                if (settings.staggerDelay && i < wallets.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, settings.staggerDelay));
                }
                
            } catch (error) {
                console.error(`Transaction failed for wallet ${wallet.publicKey}:`, error);
                
                const transaction = {
                    wallet: wallet.publicKey,
                    status: 'failed',
                    amount: amountPerWallet,
                    fee: 0,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    bundleId: bundleId
                };
                
                transactions.push(transaction);
            }
        }

        const bundleResult = {
            bundleId: bundleId,
            type: type,
            tokenAddress: tokenAddress,
            transactions: transactions,
            successCount: successCount,
            totalCost: totalCost.toFixed(6),
            status: successCount > 0 ? 'completed' : 'failed',
            timestamp: new Date().toISOString(),
            settings: settings
        };

        // Store in transaction history
        transactionHistory.unshift(bundleResult);
        
        // Keep only last 100 bundles
        if (transactionHistory.length > 100) {
            transactionHistory = transactionHistory.slice(0, 100);
        }

        console.log(`Bundle ${bundleId} completed: ${successCount}/${wallets.length} successful transactions`);

        res.json({
            success: true,
            result: bundleResult
        });

    } catch (error) {
        console.error('Error executing bundle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to execute bundle: ' + error.message
        });
    }
});

/**
 * Get transaction history endpoint
 */
app.get('/api/history', (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        
        const history = transactionHistory
            .slice(offset, offset + limit)
            .map(bundle => ({
                bundleId: bundle.bundleId,
                type: bundle.type,
                tokenAddress: bundle.tokenAddress,
                walletsUsed: bundle.transactions.length,
                successCount: bundle.successCount,
                totalCost: bundle.totalCost,
                status: bundle.status,
                timestamp: bundle.timestamp
            }));

        res.json({
            success: true,
            history: history,
            total: transactionHistory.length
        });

    } catch (error) {
        console.error('Error getting history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get history: ' + error.message
        });
    }
});

/**
 * Get bundle details endpoint
 */
app.get('/api/bundle/:bundleId', (req, res) => {
    try {
        const bundleId = parseInt(req.params.bundleId);
        const bundle = transactionHistory.find(b => b.bundleId === bundleId);
        
        if (!bundle) {
            return res.status(404).json({
                success: false,
                error: 'Bundle not found'
            });
        }

        res.json({
            success: true,
            bundle: bundle
        });

    } catch (error) {
        console.error('Error getting bundle details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get bundle details: ' + error.message
        });
    }
});

/**
 * Simulate transaction execution
 */
async function simulateTransaction(wallet, type, tokenAddress, amount, settings) {
    // Simulate processing time
    const processingTime = Math.random() * 1000 + 500; // 500-1500ms
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Simulate failure rate (5% chance of failure)
    if (Math.random() < 0.05) {
        throw new Error('Transaction simulation failed');
    }
    
    // Update wallet balance in store
    const walletData = walletStore.get(wallet.publicKey);
    if (walletData) {
        if (type === 'buy') {
            walletData.balance -= amount;
        } else if (type === 'sell') {
            walletData.balance += amount * 0.95; // Assume 5% slippage
        }
        walletData.lastTransaction = new Date().toISOString();
    }
    
    return true;
}

/**
 * Generate mock transaction signature
 */
function generateMockSignature() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let signature = '';
    for (let i = 0; i < 64; i++) {
        signature += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return signature;
}

/**
 * Error handling middleware
 */
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

/**
 * 404 handler
 */
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Proxima Solana Bundler API running on port ${PORT}`);
    console.log(`📡 Connected to Solana network: ${SOLANA_RPC_URL}`);
    console.log(`🌐 Frontend accessible at: http://localhost:5000`);
    console.log(`🔧 API endpoints available at: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
});
