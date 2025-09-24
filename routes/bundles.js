const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const BundleService = require('../services/bundleService');
const StorageService = require('../services/storageService');

const bundleService = new BundleService();
const storageService = new StorageService();

/**
 * Validate bundle data
 */
const validateBundleData = [
    body('type').isIn(['buy', 'sell', 'create-lp', 'distribute']),
    body('amountPerWallet').isNumeric().isFloat({ min: 0.001 }),
    body('wallets').isArray({ min: 1, max: 100 }),
    body('tokenAddress').optional().isString().isLength({ min: 32, max: 44 }),
    body('settings').optional().isObject()
];

/**
 * Execute bundle transaction
 * POST /api/bundles/execute
 */
router.post('/execute', validateBundleData, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { type, tokenAddress, amountPerWallet, wallets, settings } = req.body;

        // Validate bundle configuration
        const validation = bundleService.validateBundleConfig({
            type,
            tokenAddress,
            amountPerWallet,
            wallets,
            settings
        });

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid bundle configuration',
                details: validation.errors
            });
        }

        // Execute bundle
        const bundleResult = await bundleService.executeBundle({
            type,
            tokenAddress,
            amountPerWallet,
            wallets,
            settings
        });

        // Save bundle to storage
        await storageService.saveBundle(bundleResult);

        res.json({
            success: true,
            result: bundleResult
        });

    } catch (error) {
        console.error('Error executing bundle:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to execute bundle'
        });
    }
});

/**
 * Get bundle by ID
 * GET /api/bundles/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const bundle = await storageService.getBundle(id);

        if (!bundle) {
            return res.status(404).json({
                success: false,
                error: 'Bundle not found'
            });
        }

        res.json({
            success: true,
            bundle
        });

    } catch (error) {
        console.error('Error getting bundle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get bundle'
        });
    }
});

/**
 * Get all bundles
 * GET /api/bundles
 */
router.get('/', async (req, res) => {
    try {
        const { limit = 50, offset = 0, status, type } = req.query;
        
        const filters = {};
        if (status) filters.status = status;
        if (type) filters.type = type;

        const bundles = await storageService.getBundles(
            filters,
            parseInt(limit),
            parseInt(offset)
        );

        res.json({
            success: true,
            bundles,
            total: bundles.length
        });

    } catch (error) {
        console.error('Error getting bundles:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get bundles'
        });
    }
});

/**
 * Get bundle statistics
 * GET /api/bundles/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await bundleService.getBundleStats();
        
        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('Error getting bundle stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get bundle statistics'
        });
    }
});

/**
 * Cancel bundle execution
 * POST /api/bundles/:id/cancel
 */
router.post('/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await bundleService.cancelBundle(id);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            message: 'Bundle execution cancelled'
        });

    } catch (error) {
        console.error('Error cancelling bundle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel bundle'
        });
    }
});

/**
 * Estimate bundle cost
 * POST /api/bundles/estimate
 */
router.post('/estimate', async (req, res) => {
    try {
        const { type, amountPerWallet, walletCount, settings } = req.body;

        const estimate = bundleService.estimateBundleCost({
            type,
            amountPerWallet: parseFloat(amountPerWallet),
            walletCount: parseInt(walletCount),
            settings: settings || {}
        });

        res.json({
            success: true,
            estimate
        });

    } catch (error) {
        console.error('Error estimating bundle cost:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to estimate bundle cost'
        });
    }
});

/**
 * Get supported bundle types
 * GET /api/bundles/types
 */
router.get('/types', async (req, res) => {
    try {
        const types = bundleService.getSupportedBundleTypes();
        
        res.json({
            success: true,
            types
        });

    } catch (error) {
        console.error('Error getting bundle types:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get bundle types'
        });
    }
});

module.exports = router;
