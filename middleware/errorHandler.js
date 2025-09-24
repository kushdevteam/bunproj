/**
 * Error Handler Middleware for Proxima Solana Bundler
 */

/**
 * Custom error class for application-specific errors
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Custom error class for validation errors
 */
class ValidationError extends AppError {
    constructor(message, details = []) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
    }
}

/**
 * Custom error class for Solana-related errors
 */
class SolanaError extends AppError {
    constructor(message, originalError = null) {
        super(message, 500, 'SOLANA_ERROR');
        this.originalError = originalError;
    }
}

/**
 * Custom error class for bundle execution errors
 */
class BundleError extends AppError {
    constructor(message, bundleId = null) {
        super(message, 400, 'BUNDLE_ERROR');
        this.bundleId = bundleId;
    }
}

/**
 * Log error details
 */
const logError = (error, req) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.originalUrl;
    const ip = req.ip || req.connection.remoteAddress;
    
    console.error(`[${timestamp}] ERROR ${method} ${url} - IP: ${ip}`);
    console.error(`Message: ${error.message}`);
    console.error(`Status: ${error.statusCode || 500}`);
    console.error(`Code: ${error.code || 'UNKNOWN'}`);
    
    if (error.stack) {
        console.error(`Stack: ${error.stack}`);
    }
    
    if (error.details) {
        console.error(`Details:`, error.details);
    }
    
    if (error.originalError) {
        console.error(`Original Error:`, error.originalError);
    }
};

/**
 * Handle different types of errors
 */
const handleCastError = (error) => {
    return new ValidationError(`Invalid ${error.path}: ${error.value}`);
};

const handleDuplicateFieldsError = (error) => {
    const value = error.errmsg.match(/(["'])(\\?.)*?\1/)[0];
    return new ValidationError(`Duplicate field value: ${value}. Please use another value.`);
};

const handleValidationError = (error) => {
    const errors = Object.values(error.errors).map(el => el.message);
    return new ValidationError('Invalid input data', errors);
};

const handleJWTError = () => {
    return new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');
};

const handleJWTExpiredError = () => {
    return new AppError('Your token has expired. Please log in again.', 401, 'TOKEN_EXPIRED');
};

/**
 * Send error response for development
 */
const sendErrorDev = (err, req, res) => {
    // API error
    return res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: err.code,
        details: err.details,
        stack: err.stack,
        originalError: err.originalError
    });
};

/**
 * Send error response for production
 */
const sendErrorProd = (err, req, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.message,
            code: err.code,
            details: err.details
        });
    }
    
    // Programming or other unknown error: don't leak error details
    console.error('ERROR:', err);
    
    return res.status(500).json({
        success: false,
        error: 'Something went wrong!',
        code: 'INTERNAL_ERROR'
    });
};

/**
 * Global error handling middleware
 */
const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.code = err.code || 'INTERNAL_ERROR';
    
    // Log the error
    logError(err, req);
    
    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, req, res);
    } else {
        let error = { ...err };
        error.message = err.message;
        
        // Handle specific error types
        if (error.name === 'CastError') error = handleCastError(error);
        if (error.code === 11000) error = handleDuplicateFieldsError(error);
        if (error.name === 'ValidationError') error = handleValidationError(error);
        if (error.name === 'JsonWebTokenError') error = handleJWTError();
        if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
        
        sendErrorProd(error, req, res);
    }
};

/**
 * Catch async errors wrapper
 */
const catchAsync = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

/**
 * Handle 404 errors
 */
const handleNotFound = (req, res, next) => {
    const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND');
    next(error);
};

/**
 * Handle uncaught exceptions
 */
const handleUncaughtException = () => {
    process.on('uncaughtException', (err) => {
        console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
        console.error('Error:', err.name, err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    });
};

/**
 * Handle unhandled rejections
 */
const handleUnhandledRejection = (server) => {
    process.on('unhandledRejection', (err) => {
        console.error('UNHANDLED REJECTION! 💥 Shutting down...');
        console.error('Error:', err.name, err.message);
        console.error('Stack:', err.stack);
        
        server.close(() => {
            process.exit(1);
        });
    });
};

/**
 * Graceful shutdown handler
 */
const setupGracefulShutdown = (server) => {
    const gracefulShutdown = (signal) => {
        console.log(`\n${signal} received. Shutting down gracefully...`);
        
        server.close((err) => {
            if (err) {
                console.error('Error during server shutdown:', err);
                process.exit(1);
            }
            
            console.log('Server closed. Process terminating...');
            process.exit(0);
        });
        
        // Force shutdown after timeout
        setTimeout(() => {
            console.error('Could not close connections in time, forcefully shutting down');
            process.exit(1);
        }, 10000);
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

/**
 * Create specific error instances
 */
const createError = {
    validation: (message, details) => new ValidationError(message, details),
    solana: (message, originalError) => new SolanaError(message, originalError),
    bundle: (message, bundleId) => new BundleError(message, bundleId),
    notFound: (resource) => new AppError(`${resource} not found`, 404, 'NOT_FOUND'),
    unauthorized: (message = 'Unauthorized access') => new AppError(message, 401, 'UNAUTHORIZED'),
    forbidden: (message = 'Access forbidden') => new AppError(message, 403, 'FORBIDDEN'),
    tooManyRequests: (message = 'Too many requests') => new AppError(message, 429, 'TOO_MANY_REQUESTS'),
    internal: (message = 'Internal server error') => new AppError(message, 500, 'INTERNAL_ERROR')
};

module.exports = {
    AppError,
    ValidationError,
    SolanaError,
    BundleError,
    globalErrorHandler,
    catchAsync,
    handleNotFound,
    handleUncaughtException,
    handleUnhandledRejection,
    setupGracefulShutdown,
    createError
};
