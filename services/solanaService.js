const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, Transaction, SystemProgram } = require('@solana/web3.js');

class SolanaService {
    constructor() {
        const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
        this.connection = new Connection(rpcUrl, 'confirmed');
        this.network = rpcUrl.includes('devnet') ? 'devnet' : 'mainnet';
        
        console.log(`🌐 Connected to Solana ${this.network}:`, rpcUrl);
    }

    /**
     * Validate Solana address
     */
    isValidAddress(address) {
        try {
            new PublicKey(address);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Generate a new keypair
     */
    generateKeypair() {
        return Keypair.generate();
    }

    /**
     * Get wallet balance in SOL
     */
    async getBalance(publicKey) {
        try {
            const balance = await this.connection.getBalance(new PublicKey(publicKey));
            return balance / LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Error getting balance:', error);
            return 0;
        }
    }

    /**
     * Get multiple wallet balances
     */
    async getMultipleBalances(publicKeys) {
        try {
            const balances = {};
            
            // Use Promise.all for concurrent requests
            const balancePromises = publicKeys.map(async (pubKey) => {
                const balance = await this.getBalance(pubKey);
                return { publicKey: pubKey, balance };
            });

            const results = await Promise.all(balancePromises);
            
            results.forEach(({ publicKey, balance }) => {
                balances[publicKey] = balance;
            });

            return balances;
        } catch (error) {
            console.error('Error getting multiple balances:', error);
            return {};
        }
    }

    /**
     * Request airdrop for devnet (simulation for funding)
     */
    async requestAirdrop(publicKey, amount) {
        try {
            if (this.network !== 'devnet') {
                throw new Error('Airdrop only available on devnet');
            }

            const lamports = amount * LAMPORTS_PER_SOL;
            const signature = await this.connection.requestAirdrop(
                new PublicKey(publicKey),
                lamports
            );

            await this.connection.confirmTransaction(signature);
            return { success: true, signature };
        } catch (error) {
            console.error('Error requesting airdrop:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get token account info
     */
    async getTokenAccountInfo(tokenAddress) {
        try {
            const tokenPublicKey = new PublicKey(tokenAddress);
            const accountInfo = await this.connection.getAccountInfo(tokenPublicKey);
            
            if (!accountInfo) {
                return { exists: false };
            }

            return {
                exists: true,
                owner: accountInfo.owner.toString(),
                lamports: accountInfo.lamports,
                data: accountInfo.data
            };
        } catch (error) {
            console.error('Error getting token account info:', error);
            return { exists: false, error: error.message };
        }
    }

    /**
     * Validate transaction parameters
     */
    async validateTransaction({ tokenAddress, amount, walletAddress, type }) {
        const errors = [];

        // Validate wallet address
        if (!this.isValidAddress(walletAddress)) {
            errors.push('Invalid wallet address');
        }

        // Validate token address if provided
        if (tokenAddress && !this.isValidAddress(tokenAddress)) {
            errors.push('Invalid token address');
        }

        // Validate amount
        if (!amount || amount <= 0) {
            errors.push('Amount must be greater than 0');
        }

        // Check wallet balance for buy/transfer transactions
        if (type === 'buy' || type === 'transfer') {
            try {
                const balance = await this.getBalance(walletAddress);
                if (balance < amount) {
                    errors.push(`Insufficient balance. Required: ${amount} SOL, Available: ${balance.toFixed(4)} SOL`);
                }
            } catch (error) {
                errors.push('Could not verify wallet balance');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Create a transfer transaction
     */
    async createTransferTransaction(fromPubkey, toPubkey, lamports) {
        try {
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: new PublicKey(fromPubkey),
                    toPubkey: new PublicKey(toPubkey),
                    lamports: lamports
                })
            );

            const { blockhash } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            
            return transaction;
        } catch (error) {
            console.error('Error creating transfer transaction:', error);
            throw error;
        }
    }

    /**
     * Simulate transaction execution
     */
    async simulateTransaction(transaction, signers) {
        try {
            // For demo purposes, we'll simulate the transaction
            // In a real implementation, this would use connection.simulateTransaction
            
            const simulationResult = {
                success: Math.random() > 0.05, // 95% success rate
                fee: Math.floor(Math.random() * 10000) + 5000, // 5000-15000 lamports
                logs: ['Program log: Instruction: Transfer', 'Program log: Transfer complete'],
                unitsConsumed: Math.floor(Math.random() * 200000) + 50000
            };

            return simulationResult;
        } catch (error) {
            console.error('Error simulating transaction:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get network status
     */
    async getNetworkStatus() {
        try {
            const epochInfo = await this.connection.getEpochInfo();
            const blockHeight = await this.connection.getBlockHeight();
            const health = await this.connection.getHealth();
            
            return {
                success: true,
                network: this.network,
                epoch: epochInfo.epoch,
                blockHeight,
                health,
                slotIndex: epochInfo.slotIndex,
                slotsInEpoch: epochInfo.slotsInEpoch
            };
        } catch (error) {
            console.error('Error getting network status:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get transaction confirmation
     */
    async getTransactionConfirmation(signature) {
        try {
            const confirmation = await this.connection.getSignatureStatus(signature);
            return {
                confirmed: confirmation?.value?.confirmationStatus === 'confirmed',
                status: confirmation?.value?.confirmationStatus || 'unknown',
                err: confirmation?.value?.err
            };
        } catch (error) {
            console.error('Error getting transaction confirmation:', error);
            return { confirmed: false, error: error.message };
        }
    }

    /**
     * Convert SOL to lamports
     */
    solToLamports(sol) {
        return Math.floor(parseFloat(sol) * LAMPORTS_PER_SOL);
    }

    /**
     * Convert lamports to SOL
     */
    lamportsToSol(lamports) {
        return parseFloat(lamports) / LAMPORTS_PER_SOL;
    }

    /**
     * Generate mock transaction signature for demo
     */
    generateMockSignature() {
        const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let signature = '';
        for (let i = 0; i < 64; i++) {
            signature += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return signature;
    }

    /**
     * Get recommended priority fee
     */
    async getRecommendedPriorityFee() {
        try {
            // In a real implementation, this would query current network conditions
            // For demo purposes, return a reasonable default
            return {
                slow: 0.001,
                normal: 0.01,
                fast: 0.05
            };
        } catch (error) {
            console.error('Error getting priority fee:', error);
            return {
                slow: 0.001,
                normal: 0.01,
                fast: 0.05
            };
        }
    }
}

module.exports = SolanaService;
