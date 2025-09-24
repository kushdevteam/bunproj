const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

/**
 * Validate Solana address
 */
const isValidSolanaAddress = (address) => {
    if (!address || typeof address !== 'string') {
        return false;
    }
    // Basic validation - Solana addresses are base58 encoded and typically 32-44 characters
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
};

/**
 * Custom validator for Solana addresses
 */
const validateSolanaAddress = (value) => {
    if (!isValidSolanaAddress(value)) {
        throw new Error('Invalid Solana address format');
    }
    return true;
};

/**
 * Wallet generation validation
 */
const validateWalletGeneration = [
    body('count')
        .isInt({ min: 1, max: 100 })
        .withMessage('Wallet count must be between 1 and 100'),
    handleValidationErrors
];

/**
 * Wallet funding validation
 */
const validateWalletFunding = [
    body('wallets')
        .isArray({ min: 1, max: 100 })
        .withMessage('Must provide between 1 and 100 wallets'),
    body('wallets.*')
        .custom(validateSolanaAddress),
    body('amount')
        .isFloat({ min: 0.001, max: 100 })
        .withMessage('Amount must be between 0.001 and 100 SOL'),
    handleValidationErrors
];

/**
 * Bundle execution validation
 */
const validateBundleExecution = [
    body('type')
        .isIn(['buy', 'sell', 'create-lp', 'distribute'])
        .withMessage('Invalid bundle type'),
    body('tokenAddress')
        .optional()
        .custom(validateSolanaAddress),
    body('amountPerWallet')
        .isFloat({ min: 0.001, max: 100 })
        .withMessage('Amount per wallet must be between 0.001 and 100 SOL'),
    body('wallets')
        .isArray({ min: 1, max: 100 })
        .withMessage('Must provide between 1 and 100 wallets'),
    body('wallets.*.publicKey')
        .custom(validateSolanaAddress),
    body('settings.staggerDelay')
        .optional()
        .isInt({ min: 0, max: 10000 })
        .withMessage('Stagger delay must be between 0 and 10000ms'),
    body('settings.priorityFee')
        .optional()
        .isFloat({ min: 0, max: 1 })
        .withMessage('Priority fee must be between 0 and 1 SOL'),
    body('settings.slippage')
        .optional()
        .isFloat({ min: 0.1, max: 50 })
        .withMessage('Slippage must be between 0.1% and 50%'),
    body('settings.stealthMode')
        .optional()
        .isBoolean()
        .withMessage('Stealth mode must be a boolean'),
    handleValidationErrors
];

/**
 * Transaction validation
 */
const validateTransaction = [
    body('tokenAddress')
        .optional()
        .custom(validateSolanaAddress),
    body('amount')
        .isFloat({ min: 0.001 })
        .withMessage('Amount must be greater than 0.001'),
    body('walletAddress')
        .custom(validateSolanaAddress),
    body('type')
        .isIn(['buy', 'sell', 'transfer'])
        .withMessage('Invalid transaction type'),
    handleValidationErrors
];

/**
 * Pagination validation
 */
const validatePagination = [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset must be non-negative'),
    handleValidationErrors
];

/**
 * ID parameter validation
 */
const validateId = [
    param('id')
        .isNumeric()
        .withMessage('ID must be numeric'),
    handleValidationErrors
];

/**
 * Bundle ID validation
 */
const validateBundleId = [
    param('bundleId')
        .isInt({ min: 1 })
        .withMessage('Bundle ID must be a positive integer'),
    handleValidationErrors
];

/**
 * Bundle estimate validation
 */
const validateBundleEstimate = [
    body('type')
        .isIn(['buy', 'sell', 'create-lp', 'distribute'])
        .withMessage('Invalid bundle type'),
    body('amountPerWallet')
        .isFloat({ min: 0.001, max: 100 })
        .withMessage('Amount per wallet must be between 0.001 and 100 SOL'),
    body('walletCount')
        .isInt({ min: 1, max: 100 })
        .withMessage('Wallet count must be between 1 and 100'),
    handleValidationErrors
];

/**
 * Status update validation
 */
const validateStatusUpdate = [
    body('status')
        .isIn(['pending', 'confirmed', 'failed', 'cancelled'])
        .withMessage('Invalid status'),
    body('signature')
        .optional()
        .isString()
        .isLength({ min: 64, max: 88 })
        .withMessage('Invalid transaction signature format'),
    body('error')
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage('Error message too long'),
    handleValidationErrors
];

/**
 * Custom validation for bundle type and token address combination
 */
const validateBundleTypeTokenAddress = (req, res, next) => {
    const { type, tokenAddress } = req.body;
    
    // For create-lp type, token address should not be provided
    if (type === 'create-lp' && tokenAddress) {
        return res.status(400).json({
            success: false,
            error: 'Token address should not be provided for create-lp bundle type'
        });
    }
    
    // For other types, token address is required
    if (type !== 'create-lp' && !tokenAddress) {
        return res.status(400).json({
            success: false,
            error: 'Token address is required for this bundle type'
        });
    }
    
    next();
};

/**
 * Rate limiting validation (basic implementation)
 */
const rateLimitMap = new Map();

const validateRateLimit = (maxRequests = 10, windowMs = 60000) => {
    return (req, res, next) => {
        const clientIP = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Get or create rate limit data for this IP
        let rateLimitData = rateLimitMap.get(clientIP) || { requests: [], lastCleanup: now };
        
        // Remove old requests outside the window
        rateLimitData.requests = rateLimitData.requests.filter(timestamp => timestamp > windowStart);
        
        // Check if limit exceeded
        if (rateLimitData.requests.length >= maxRequests) {
            return res.status(429).json({
                success: false,
                error: 'Too many requests. Please try again later.',
                retryAfter: Math.ceil((rateLimitData.requests[0] + windowMs - now) / 1000)
            });
        }
        
        // Add current request
        rateLimitData.requests.push(now);
        rateLimitData.lastCleanup = now;
        
        // Update rate limit data
        rateLimitMap.set(clientIP, rateLimitData);
        
        // Cleanup old entries periodically
        if (now - rateLimitData.lastCleanup > windowMs) {
            for (const [ip, data] of rateLimitMap.entries()) {
                data.requests = data.requests.filter(timestamp => timestamp > windowStart);
                if (data.requests.length === 0) {
                    rateLimitMap.delete(ip);
                }
            }
        }
        
        next();
    };
};

module.exports = {
    handleValidationErrors,
    validateSolanaAddress,
    validateWalletGeneration,
    validateWalletFunding,
    validateBundleExecution,
    validateTransaction,
    validatePagination,
    validateId,
    validateBundleId,
    validateBundleEstimate,
    validateStatusUpdate,
    validateBundleTypeTokenAddress,
    validateRateLimit,
    isValidSolanaAddress
};
