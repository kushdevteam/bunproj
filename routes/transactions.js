const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const SolanaService = require('../services/solanaService');
const StorageService = require('../services/storageService');

const solanaService = new SolanaService();
const storageService = new StorageService();

/**
 * Validate transaction data
 */
const validateTransactionData = [
    body('tokenAddress').optional().isString().isLength({ min: 32, max: 44 }),
    body('amount').isNumeric().isFloat({ min: 0.001 }),
    body('walletAddress').isString().isLength({ min: 32, max: 44 }),
    body('type').isIn(['buy', 'sell', 'transfer'])
];

/**
 * Create new transaction
 * POST /api/transactions
 */
router.post('/', validateTransactionData, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { tokenAddress, amount, walletAddress, type, settings } = req.body;

        // Create transaction object
        const transaction = {
            id: Date.now().toString(),
            tokenAddress,
            amount: parseFloat(amount),
            walletAddress,
            type,
            settings: settings || {},
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save transaction
        await storageService.saveTransaction(transaction);

        res.json({
            success: true,
            transaction
        });

    } catch (error) {
        console.error('Error creating transaction:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create transaction'
        });
    }
});

/**
 * Get transaction by ID
 * GET /api/transactions/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await storageService.getTransaction(id);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }

        res.json({
            success: true,
            transaction
        });

    } catch (error) {
        console.error('Error getting transaction:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get transaction'
        });
    }
});

/**
 * Get all transactions
 * GET /api/transactions
 */
router.get('/', async (req, res) => {
    try {
        const { limit = 50, offset = 0, status, type } = req.query;
        
        const filters = {};
        if (status) filters.status = status;
        if (type) filters.type = type;

        const transactions = await storageService.getTransactions(
            filters,
            parseInt(limit),
            parseInt(offset)
        );

        res.json({
            success: true,
            transactions,
            total: transactions.length
        });

    } catch (error) {
        console.error('Error getting transactions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get transactions'
        });
    }
});

/**
 * Update transaction status
 * PUT /api/transactions/:id/status
 */
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, signature, error: txError } = req.body;

        const transaction = await storageService.getTransaction(id);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }

        // Update transaction
        transaction.status = status;
        transaction.updatedAt = new Date().toISOString();
        
        if (signature) transaction.signature = signature;
        if (txError) transaction.error = txError;

        await storageService.updateTransaction(id, transaction);

        res.json({
            success: true,
            transaction
        });

    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update transaction'
        });
    }
});

/**
 * Delete transaction
 * DELETE /api/transactions/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const deleted = await storageService.deleteTransaction(id);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }

        res.json({
            success: true,
            message: 'Transaction deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete transaction'
        });
    }
});

/**
 * Validate transaction before execution
 * POST /api/transactions/validate
 */
router.post('/validate', async (req, res) => {
    try {
        const { tokenAddress, amount, walletAddress, type } = req.body;

        // Validate wallet address
        if (!solanaService.isValidAddress(walletAddress)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid wallet address'
            });
        }

        // Validate token address if provided
        if (tokenAddress && !solanaService.isValidAddress(tokenAddress)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token address'
            });
        }

        // Validate amount
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid transaction amount'
            });
        }

        // Additional validations based on transaction type
        const validation = await solanaService.validateTransaction({
            tokenAddress,
            amount,
            walletAddress,
            type
        });

        res.json({
            success: true,
            valid: validation.valid,
            errors: validation.errors || []
        });

    } catch (error) {
        console.error('Error validating transaction:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate transaction'
        });
    }
});

module.exports = router;
