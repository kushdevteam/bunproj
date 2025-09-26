/**
 * Security Headers, Policies, and Audit Logging
 * - Content Security Policy (CSP) implementation
 * - CORS and HSTS headers enforcement
 * - Spend limits and dry-run simulation
 * - Comprehensive audit logging with sensitive data redaction
 */

import { SecurityLogger } from './security-guards';

/**
 * Content Security Policy configuration
 */
export class CSPManager {
  private static readonly CSP_DIRECTIVES = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'", // Required for React in development
      'https://cdn.jsdelivr.net', // For external libraries
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for styled-components
      'https://fonts.googleapis.com',
    ],
    'font-src': [
      "'self'",
      'https://fonts.gstatic.com',
    ],
    'img-src': [
      "'self'",
      'data:', // For base64 images
      'https:', // For external images
    ],
    'connect-src': [
      "'self'",
      'https://data-seed-prebsc-1-s1.binance.org', // BSC Testnet
      'https://data-seed-prebsc-2-s1.binance.org',
      'https://bsc-dataseed1.binance.org', // BSC Mainnet
      'https://bsc-dataseed2.binance.org',
      'wss:', // WebSocket connections
      process.env.REACT_APP_API_URL || 'https://*.replit.dev',
    ],
    'frame-src': ["'none'"], // Prevent clickjacking
    'object-src': ["'none'"], // Prevent object/embed attacks
    'base-uri': ["'self'"], // Restrict base URI
    'form-action': ["'self'"], // Restrict form submissions
    'upgrade-insecure-requests': [], // Force HTTPS
  };

  /**
   * Generate CSP header value
   */
  static generateCSPHeader(): string {
    const directives = Object.entries(this.CSP_DIRECTIVES)
      .map(([directive, sources]) => {
        if (sources.length === 0) {
          return directive;
        }
        return `${directive} ${sources.join(' ')}`;
      })
      .join('; ');

    return directives;
  }

  /**
   * Apply CSP via meta tag (fallback method)
   */
  static applyCspMetaTag(): void {
    if (typeof document === 'undefined') return;

    const existingTag = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existingTag) {
      existingTag.remove();
    }

    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = this.generateCSPHeader();
    document.head.appendChild(meta);

    SecurityLogger.log('info', 'CSP meta tag applied', { csp: meta.content });
  }

  /**
   * Validate CSP compliance
   */
  static validateCSPCompliance(): boolean {
    try {
      // Check if CSP is supported
      if (typeof CSPViolationReportBody === 'undefined') {
        console.warn('⚠️ CSP not supported in this browser');
        return false;
      }

      // Set up CSP violation reporting
      document.addEventListener('securitypolicyviolation', (event) => {
        SecurityLogger.log('error', 'CSP Violation detected', {
          violatedDirective: event.violatedDirective,
          blockedURI: event.blockedURI,
          sourceFile: event.sourceFile,
          lineNumber: event.lineNumber,
        });
      });

      console.log('✅ CSP compliance validation enabled');
      return true;
    } catch (error) {
      console.error('❌ CSP validation setup failed:', error);
      return false;
    }
  }
}

/**
 * Security headers enforcement for API calls
 */
export class SecurityHeaders {
  private static readonly SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  };

  /**
   * Get security headers for API requests
   */
  static getApiHeaders(): Record<string, string> {
    return {
      ...this.SECURITY_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    };
  }

  /**
   * Validate response headers
   */
  static validateResponseHeaders(response: Response): boolean {
    const securityIssues: string[] = [];

    // Check for security headers
    Object.entries(this.SECURITY_HEADERS).forEach(([header, expectedValue]) => {
      const actualValue = response.headers.get(header);
      if (!actualValue) {
        securityIssues.push(`Missing header: ${header}`);
      } else if (actualValue !== expectedValue) {
        securityIssues.push(`Invalid ${header}: ${actualValue}`);
      }
    });

    // Check for HTTPS
    if (response.url && !response.url.startsWith('https://') && !response.url.startsWith('http://localhost')) {
      securityIssues.push('Insecure HTTP connection detected');
    }

    if (securityIssues.length > 0) {
      SecurityLogger.log('warn', 'Security header issues detected', { issues: securityIssues, url: response.url });
      return false;
    }

    return true;
  }
}

/**
 * Spend limits and transaction controls
 */
export class SpendLimitsManager {
  private static readonly LIMITS = {
    maxBnbPerTransaction: 10, // 10 BNB max per transaction
    maxBnbPerHour: 50, // 50 BNB max per hour
    maxBnbPerDay: 200, // 200 BNB max per day
    maxWalletsPerBundle: 100, // 100 wallets max per bundle
    maxTransactionsPerMinute: 10, // 10 transactions max per minute
    dryRunRequired: process.env.NODE_ENV === 'production', // Require dry run in production
  };

  private static spendingHistory: Array<{ amount: number; timestamp: number }> = [];
  private static transactionHistory: Array<{ timestamp: number }> = [];

  /**
   * Check if a transaction amount is within limits
   */
  static validateTransactionAmount(amountBnb: number): boolean {
    if (amountBnb > this.LIMITS.maxBnbPerTransaction) {
      throw new Error(`🚨 SECURITY: Transaction amount ${amountBnb} BNB exceeds limit of ${this.LIMITS.maxBnbPerTransaction} BNB`);
    }

    // Check hourly limit
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const hourlySpend = this.spendingHistory
      .filter(tx => tx.timestamp > oneHourAgo)
      .reduce((sum, tx) => sum + tx.amount, 0);

    if (hourlySpend + amountBnb > this.LIMITS.maxBnbPerHour) {
      throw new Error(`🚨 SECURITY: Transaction would exceed hourly limit of ${this.LIMITS.maxBnbPerHour} BNB`);
    }

    // Check daily limit
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const dailySpend = this.spendingHistory
      .filter(tx => tx.timestamp > oneDayAgo)
      .reduce((sum, tx) => sum + tx.amount, 0);

    if (dailySpend + amountBnb > this.LIMITS.maxBnbPerDay) {
      throw new Error(`🚨 SECURITY: Transaction would exceed daily limit of ${this.LIMITS.maxBnbPerDay} BNB`);
    }

    return true;
  }

  /**
   * Check transaction rate limits
   */
  static validateTransactionRate(): boolean {
    const oneMinuteAgo = Date.now() - 60 * 1000;
    const recentTransactions = this.transactionHistory.filter(tx => tx.timestamp > oneMinuteAgo);

    if (recentTransactions.length >= this.LIMITS.maxTransactionsPerMinute) {
      throw new Error(`🚨 SECURITY: Transaction rate limit exceeded (${this.LIMITS.maxTransactionsPerMinute}/min)`);
    }

    return true;
  }

  /**
   * Record a transaction for rate limiting
   */
  static recordTransaction(amountBnb: number): void {
    const now = Date.now();
    
    this.spendingHistory.push({ amount: amountBnb, timestamp: now });
    this.transactionHistory.push({ timestamp: now });

    // Clean old records (keep last 7 days)
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    this.spendingHistory = this.spendingHistory.filter(tx => tx.timestamp > sevenDaysAgo);
    this.transactionHistory = this.transactionHistory.filter(tx => tx.timestamp > sevenDaysAgo);
  }

  /**
   * Get current spending limits status
   */
  static getSpendingStatus(): {
    hourlyUsed: number;
    hourlyLimit: number;
    dailyUsed: number;
    dailyLimit: number;
    transactionsThisMinute: number;
    transactionRateLimit: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneMinuteAgo = now - 60 * 1000;

    return {
      hourlyUsed: this.spendingHistory
        .filter(tx => tx.timestamp > oneHourAgo)
        .reduce((sum, tx) => sum + tx.amount, 0),
      hourlyLimit: this.LIMITS.maxBnbPerHour,
      dailyUsed: this.spendingHistory
        .filter(tx => tx.timestamp > oneDayAgo)
        .reduce((sum, tx) => sum + tx.amount, 0),
      dailyLimit: this.LIMITS.maxBnbPerDay,
      transactionsThisMinute: this.transactionHistory.filter(tx => tx.timestamp > oneMinuteAgo).length,
      transactionRateLimit: this.LIMITS.maxTransactionsPerMinute,
    };
  }

  /**
   * Check if dry run is required
   */
  static isDryRunRequired(): boolean {
    return this.LIMITS.dryRunRequired;
  }
}

/**
 * Dry run simulation system
 */
export class DryRunSimulator {
  /**
   * Simulate a transaction without executing it
   */
  static async simulateTransaction(tx: {
    to: string;
    value: string;
    data?: string;
    gasLimit?: string;
    gasPrice?: string;
  }): Promise<{
    success: boolean;
    gasUsed: string;
    gasPrice: string;
    totalCost: string;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Validate transaction parameters
      if (!tx.to || !/^0x[0-9a-fA-F]{40}$/.test(tx.to)) {
        errors.push('Invalid recipient address');
      }

      const value = BigInt(tx.value || '0');
      if (value < 0) {
        errors.push('Negative transaction value');
      }

      const gasLimit = BigInt(tx.gasLimit || '21000');
      const gasPrice = BigInt(tx.gasPrice || '20000000000');

      if (gasPrice > BigInt('100000000000')) { // 100 gwei
        warnings.push('High gas price detected');
      }

      if (gasLimit > BigInt('10000000')) { // 10M gas
        warnings.push('High gas limit detected');
      }

      // Simulate gas usage (estimate based on transaction type)
      let estimatedGasUsed = BigInt('21000'); // Base transfer
      if (tx.data && tx.data !== '0x') {
        estimatedGasUsed = gasLimit / BigInt('2'); // Contract interaction estimate
      }

      const totalCost = (estimatedGasUsed * gasPrice) + value;

      SecurityLogger.log('info', 'Dry run simulation completed', {
        to: tx.to,
        value: tx.value,
        estimatedGasUsed: estimatedGasUsed.toString(),
        totalCost: totalCost.toString(),
        warnings: warnings.length,
        errors: errors.length,
      });

      return {
        success: errors.length === 0,
        gasUsed: estimatedGasUsed.toString(),
        gasPrice: gasPrice.toString(),
        totalCost: totalCost.toString(),
        warnings,
        errors,
      };
    } catch (error) {
      errors.push(`Simulation failed: ${error}`);
      return {
        success: false,
        gasUsed: '0',
        gasPrice: '0',
        totalCost: '0',
        warnings,
        errors,
      };
    }
  }

  /**
   * Simulate bundle execution
   */
  static async simulateBundle(transactions: Array<{
    to: string;
    value: string;
    data?: string;
  }>): Promise<{
    success: boolean;
    totalGasUsed: string;
    totalCost: string;
    successfulTxs: number;
    failedTxs: number;
    warnings: string[];
    errors: string[];
  }> {
    const results = await Promise.all(
      transactions.map(tx => this.simulateTransaction(tx))
    );

    const successfulTxs = results.filter(r => r.success).length;
    const failedTxs = results.length - successfulTxs;
    
    const totalGasUsed = results.reduce(
      (sum, r) => sum + BigInt(r.gasUsed || '0'),
      BigInt('0')
    );

    const totalCost = results.reduce(
      (sum, r) => sum + BigInt(r.totalCost || '0'),
      BigInt('0')
    );

    const allWarnings = results.flatMap(r => r.warnings);
    const allErrors = results.flatMap(r => r.errors);

    SecurityLogger.log('info', 'Bundle simulation completed', {
      totalTransactions: transactions.length,
      successfulTxs,
      failedTxs,
      totalGasUsed: totalGasUsed.toString(),
      totalCost: totalCost.toString(),
    });

    return {
      success: failedTxs === 0,
      totalGasUsed: totalGasUsed.toString(),
      totalCost: totalCost.toString(),
      successfulTxs,
      failedTxs,
      warnings: allWarnings,
      errors: allErrors,
    };
  }
}

/**
 * Comprehensive audit logging system
 */
export class AuditLogger {
  private static readonly AUDIT_EVENTS = {
    WALLET_CREATED: 'wallet_created',
    WALLET_IMPORTED: 'wallet_imported',
    WALLET_EXPORTED: 'wallet_exported',
    PRIVATE_KEY_ACCESSED: 'private_key_accessed',
    SESSION_STARTED: 'session_started',
    SESSION_ENDED: 'session_ended',
    TRANSACTION_SIGNED: 'transaction_signed',
    TRANSACTION_SENT: 'transaction_sent',
    BUNDLE_EXECUTED: 'bundle_executed',
    SECURITY_VIOLATION: 'security_violation',
    API_CALL: 'api_call',
    AUTHENTICATION_FAILED: 'auth_failed',
  };

  /**
   * Log audit event with automatic sensitive data redaction
   */
  static logEvent(
    event: keyof typeof AuditLogger.AUDIT_EVENTS,
    data: Record<string, any> = {},
    sessionId?: string
  ): void {
    const auditData = {
      timestamp: new Date().toISOString(),
      event: this.AUDIT_EVENTS[event],
      sessionId: sessionId || 'unknown',
      data: this.redactSensitiveData(data),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      ip: 'client-side', // Would be populated server-side
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 AUDIT:', auditData);
    }

    // Store in local audit log (limited retention)
    this.storeAuditLog(auditData);
  }

  /**
   * Redact sensitive data from audit logs
   */
  private static redactSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const redacted = { ...data };
    const sensitiveFields = [
      'privateKey', 'private_key', 'passphrase', 'password', 'seed', 'mnemonic',
      'signature', 'signedTransaction', 'encrypted', 'salt', 'iv'
    ];

    for (const field of sensitiveFields) {
      if (field in redacted) {
        redacted[field] = '***REDACTED***';
      }
    }

    // Recursively redact nested objects
    for (const [key, value] of Object.entries(redacted)) {
      if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactSensitiveData(value);
      }
    }

    return redacted;
  }

  /**
   * Store audit log with rotation
   */
  private static storeAuditLog(auditData: any): void {
    try {
      const storageKey = 'bnb-bundler-audit-log';
      const existingLogs = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      // Add new log
      existingLogs.push(auditData);
      
      // Rotate logs (keep last 1000 entries)
      if (existingLogs.length > 1000) {
        existingLogs.splice(0, existingLogs.length - 1000);
      }
      
      localStorage.setItem(storageKey, JSON.stringify(existingLogs));
    } catch (error) {
      console.error('Failed to store audit log:', error);
    }
  }

  /**
   * Get audit logs for review
   */
  static getAuditLogs(limit: number = 100): any[] {
    try {
      const storageKey = 'bnb-bundler-audit-log';
      const logs = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return logs.slice(-limit);
    } catch (error) {
      console.error('Failed to retrieve audit logs:', error);
      return [];
    }
  }

  /**
   * Clear audit logs (admin function)
   */
  static clearAuditLogs(): void {
    try {
      localStorage.removeItem('bnb-bundler-audit-log');
      console.log('🗑️ Audit logs cleared');
    } catch (error) {
      console.error('Failed to clear audit logs:', error);
    }
  }
}

/**
 * Initialize all security policies
 */
export const initializeSecurityPolicies = (): void => {
  console.log('🔒 Initializing security policies...');

  try {
    // Apply CSP
    CSPManager.applyCspMetaTag();
    CSPManager.validateCSPCompliance();

    // Initialize spend limits tracking
    const spendingStatus = SpendLimitsManager.getSpendingStatus();
    console.log('💰 Spending limits initialized:', spendingStatus);

    // Log initialization
    AuditLogger.logEvent('SESSION_STARTED', {
      timestamp: new Date().toISOString(),
      securityPoliciesEnabled: true,
    });

    console.log('🔒 Security policies initialized successfully');
  } catch (error) {
    console.error('❌ Security policy initialization failed:', error);
    AuditLogger.logEvent('SECURITY_VIOLATION', {
      error: 'Security policy initialization failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Auto-initialize in browser environment
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  // Delay initialization to ensure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSecurityPolicies);
  } else {
    setTimeout(initializeSecurityPolicies, 100);
  }
}