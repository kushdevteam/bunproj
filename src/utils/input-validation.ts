/**
 * Comprehensive Input Validation and Sanitization
 * - Schema validation for all user inputs
 * - XSS/injection prevention
 * - Wallet address and transaction parameter validation
 * - Token name, symbol, and amount validation
 */

// Alternative XSS sanitizer (fallback for DOMPurify)
const createSanitizer = () => {
  const sanitize = (input: string, options: { ALLOWED_TAGS?: string[] } = {}) => {
    if (typeof input !== 'string') return input;
    
    // Simple HTML tag removal for basic XSS prevention
    const htmlTagPattern = /<[^>]*>/g;
    const scriptPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
    const eventPattern = /\bon\w+\s*=/gi;
    
    let sanitized = input
      .replace(scriptPattern, '') // Remove script tags
      .replace(eventPattern, '') // Remove event handlers
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/data:text\/html/gi, ''); // Remove data URLs
    
    // If no tags allowed, remove all HTML
    if (!options.ALLOWED_TAGS || options.ALLOWED_TAGS.length === 0) {
      sanitized = sanitized.replace(htmlTagPattern, '');
    }
    
    return sanitized.trim();
  };
  
  return { sanitize };
};

const DOMPurify = createSanitizer();
import { z } from 'zod';

/**
 * Common validation patterns
 */
const VALIDATION_PATTERNS = {
  // Ethereum/BSC address (40 hex chars with 0x prefix)
  ethereumAddress: /^0x[0-9a-fA-F]{40}$/,
  
  // Private key (64 hex chars with optional 0x prefix)
  privateKey: /^(0x)?[0-9a-fA-F]{64}$/,
  
  // Transaction hash (64 hex chars with 0x prefix)
  transactionHash: /^0x[0-9a-fA-F]{64}$/,
  
  // Token symbol (3-10 uppercase letters/numbers)
  tokenSymbol: /^[A-Z0-9]{3,10}$/,
  
  // Token name (letters, numbers, spaces, basic punctuation)
  tokenName: /^[A-Za-z0-9\s\-_\.]{1,50}$/,
  
  // Hex strings (with 0x prefix)
  hexString: /^0x[0-9a-fA-F]+$/,
  
  // Numeric amounts (positive numbers with optional decimals)
  numericAmount: /^\d+(\.\d+)?$/,
  
  // Percentage (0-100 with optional decimals)
  percentage: /^(100(\.0+)?|[0-9]?[0-9](\.\d+)?)$/,
  
  // Session ID (alphanumeric with optional underscores/hyphens)
  sessionId: /^[A-Za-z0-9_-]+$/,
};

/**
 * Zod schemas for comprehensive validation
 */
export const ValidationSchemas = {
  // Wallet address validation
  walletAddress: z.string()
    .regex(VALIDATION_PATTERNS.ethereumAddress, 'Invalid wallet address format')
    .refine(address => address !== '0x0000000000000000000000000000000000000000', 'Cannot use zero address'),

  // Private key validation (for import operations)
  privateKey: z.string()
    .regex(VALIDATION_PATTERNS.privateKey, 'Invalid private key format')
    .transform(key => key.startsWith('0x') ? key : `0x${key}`),

  // Token symbol validation
  tokenSymbol: z.string()
    .min(3, 'Token symbol must be at least 3 characters')
    .max(10, 'Token symbol must be at most 10 characters')
    .regex(VALIDATION_PATTERNS.tokenSymbol, 'Token symbol must contain only uppercase letters and numbers'),

  // Token name validation
  tokenName: z.string()
    .min(1, 'Token name is required')
    .max(50, 'Token name must be at most 50 characters')
    .regex(VALIDATION_PATTERNS.tokenName, 'Token name contains invalid characters'),

  // Token description validation
  tokenDescription: z.string()
    .min(10, 'Token description must be at least 10 characters')
    .max(1000, 'Token description must be at most 1000 characters')
    .transform(desc => DOMPurify.sanitize(desc, { ALLOWED_TAGS: [] })),

  // Numeric amount validation
  amount: z.string()
    .regex(VALIDATION_PATTERNS.numericAmount, 'Invalid amount format')
    .refine(amount => parseFloat(amount) > 0, 'Amount must be positive')
    .refine(amount => parseFloat(amount) <= 1e18, 'Amount too large'),

  // BNB amount validation (specific limits for BNB)
  bnbAmount: z.string()
    .regex(VALIDATION_PATTERNS.numericAmount, 'Invalid BNB amount format')
    .refine(amount => parseFloat(amount) > 0, 'BNB amount must be positive')
    .refine(amount => parseFloat(amount) <= 10000, 'BNB amount too large (max 10,000)'),

  // Percentage validation
  percentage: z.string()
    .regex(VALIDATION_PATTERNS.percentage, 'Invalid percentage format')
    .refine(pct => parseFloat(pct) >= 0 && parseFloat(pct) <= 100, 'Percentage must be between 0 and 100'),

  // Wallet count validation
  walletCount: z.number()
    .int('Wallet count must be an integer')
    .min(1, 'Must generate at least 1 wallet')
    .max(100, 'Cannot generate more than 100 wallets'),

  // Gas limit validation
  gasLimit: z.string()
    .regex(/^\d+$/, 'Gas limit must be a positive integer')
    .refine(limit => parseInt(limit) >= 21000, 'Gas limit too low (minimum 21,000)')
    .refine(limit => parseInt(limit) <= 10000000, 'Gas limit too high (maximum 10,000,000)'),

  // Gas price validation (in gwei)
  gasPrice: z.string()
    .regex(VALIDATION_PATTERNS.numericAmount, 'Invalid gas price format')
    .refine(price => parseFloat(price) > 0, 'Gas price must be positive')
    .refine(price => parseFloat(price) <= 1000, 'Gas price too high (maximum 1000 gwei)'),

  // Session ID validation
  sessionId: z.string()
    .min(10, 'Session ID too short')
    .max(100, 'Session ID too long')
    .regex(VALIDATION_PATTERNS.sessionId, 'Invalid session ID format'),

  // Passphrase validation
  passphrase: z.string()
    .min(8, 'Passphrase must be at least 8 characters')
    .max(128, 'Passphrase must be at most 128 characters')
    .refine(pass => /[A-Z]/.test(pass), 'Passphrase must contain uppercase letter')
    .refine(pass => /[a-z]/.test(pass), 'Passphrase must contain lowercase letter')
    .refine(pass => /\d/.test(pass), 'Passphrase must contain number'),

  // Transaction hash validation
  transactionHash: z.string()
    .regex(VALIDATION_PATTERNS.transactionHash, 'Invalid transaction hash format'),

  // Network validation
  networkId: z.enum(['bsc-testnet', 'bsc-mainnet']),

  // Launch mode validation
  launchMode: z.enum(['quick', 'organic']),
};

/**
 * Comprehensive bundle configuration validation
 */
export const BundleConfigSchema = z.object({
  tokenName: ValidationSchemas.tokenName,
  tokenSymbol: ValidationSchemas.tokenSymbol,
  tokenDescription: ValidationSchemas.tokenDescription,
  totalSupply: ValidationSchemas.amount,
  devBuyPercent: ValidationSchemas.percentage,
  supplyBuyPercent: ValidationSchemas.percentage,
  disperseWalletsCount: ValidationSchemas.walletCount,
  staggerDelayMs: z.number().min(0).max(300000), // Max 5 minutes
  launchMode: ValidationSchemas.launchMode,
});

/**
 * Wallet import validation
 */
export const WalletImportSchema = z.object({
  privateKey: ValidationSchemas.privateKey,
  label: z.string().min(1).max(50).optional(),
  role: z.enum(['dev', 'mev', 'funder', 'numbered']).optional(),
});

/**
 * Transaction validation
 */
export const TransactionSchema = z.object({
  to: ValidationSchemas.walletAddress,
  value: ValidationSchemas.amount.optional(),
  data: z.string().regex(VALIDATION_PATTERNS.hexString).optional(),
  gasLimit: ValidationSchemas.gasLimit.optional(),
  gasPrice: ValidationSchemas.gasPrice.optional(),
});

/**
 * XSS sanitization utility
 */
export class XSSSanitizer {
  private static config = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  };

  /**
   * Sanitize HTML content to prevent XSS
   */
  static sanitizeHtml(input: string): string {
    return DOMPurify.sanitize(input, this.config);
  }

  /**
   * Sanitize plain text (removes all HTML)
   */
  static sanitizeText(input: string): string {
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  }

  /**
   * Sanitize object recursively
   */
  static sanitizeObject<T>(obj: T): T {
    if (typeof obj !== 'object' || obj === null) {
      return typeof obj === 'string' ? this.sanitizeText(obj) as T : obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item)) as T;
    }

    const sanitized = {} as T;
    for (const [key, value] of Object.entries(obj)) {
      (sanitized as any)[key] = this.sanitizeObject(value);
    }

    return sanitized;
  }
}

/**
 * SQL injection prevention (for future database integration)
 */
export class SQLSanitizer {
  private static dangerousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(--|\/\*|\*\/|;)/g,
    /(\b(OR|AND)\s+1\s*=\s*1\b)/gi,
    /('|\"|`|\\)/g,
  ];

  /**
   * Check if input contains SQL injection patterns
   */
  static containsSQLInjection(input: string): boolean {
    return this.dangerousPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Sanitize input to prevent SQL injection
   */
  static sanitize(input: string): string {
    if (this.containsSQLInjection(input)) {
      throw new Error('🚨 SECURITY: Potential SQL injection detected');
    }
    return input.trim();
  }
}

/**
 * Input validator with comprehensive checks
 */
export class InputValidator {
  /**
   * Validate and sanitize user input
   */
  static validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
    try {
      // Pre-sanitize if it's an object
      const sanitizedData = typeof data === 'object' && data !== null 
        ? XSSSanitizer.sanitizeObject(data)
        : data;

      // Validate with Zod schema
      return schema.parse(sanitizedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.issues.map((err: any) => `${err.path.join('.')}: ${err.message}`);
        throw new Error(`Validation failed: ${messages.join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Validate wallet address
   */
  static validateWalletAddress(address: string): string {
    return this.validate(ValidationSchemas.walletAddress, address);
  }

  /**
   * Validate token configuration
   */
  static validateTokenConfig(config: unknown): z.infer<typeof BundleConfigSchema> {
    return this.validate(BundleConfigSchema, config);
  }

  /**
   * Validate wallet import data
   */
  static validateWalletImport(data: unknown): z.infer<typeof WalletImportSchema> {
    return this.validate(WalletImportSchema, data);
  }

  /**
   * Validate transaction data
   */
  static validateTransaction(tx: unknown): z.infer<typeof TransactionSchema> {
    return this.validate(TransactionSchema, tx);
  }

  /**
   * Validate amount string
   */
  static validateAmount(amount: string, maxAmount?: number): string {
    let schema = ValidationSchemas.amount;
    
    if (maxAmount) {
      schema = schema.refine(
        amt => parseFloat(amt) <= maxAmount,
        `Amount cannot exceed ${maxAmount}`
      );
    }
    
    return this.validate(schema, amount);
  }

  /**
   * Validate percentage
   */
  static validatePercentage(percentage: string): string {
    return this.validate(ValidationSchemas.percentage, percentage);
  }

  /**
   * Batch validate wallet addresses
   */
  static validateWalletAddresses(addresses: string[]): string[] {
    if (!Array.isArray(addresses)) {
      throw new Error('Addresses must be an array');
    }

    if (addresses.length === 0) {
      throw new Error('At least one address is required');
    }

    if (addresses.length > 1000) {
      throw new Error('Too many addresses (maximum 1000)');
    }

    return addresses.map((addr, index) => {
      try {
        return this.validateWalletAddress(addr);
      } catch (error) {
        throw new Error(`Invalid address at index ${index}: ${error}`);
      }
    });
  }

  /**
   * Security check for private key presence in data
   */
  static assertNoPrivateKeys(data: any): void {
    const str = JSON.stringify(data);
    if (VALIDATION_PATTERNS.privateKey.test(str)) {
      throw new Error('🚨 SECURITY: Private key detected in data');
    }
  }
}

/**
 * Form validation helpers for React components
 */
export const FormValidators = {
  /**
   * Real-time token name validator
   */
  tokenName: (value: string) => {
    try {
      ValidationSchemas.tokenName.parse(value);
      return null; // No error
    } catch (error) {
      return error instanceof z.ZodError ? error.issues[0].message : 'Invalid input';
    }
  },

  /**
   * Real-time token symbol validator
   */
  tokenSymbol: (value: string) => {
    try {
      ValidationSchemas.tokenSymbol.parse(value.toUpperCase());
      return null;
    } catch (error) {
      return error instanceof z.ZodError ? error.issues[0].message : 'Invalid input';
    }
  },

  /**
   * Real-time amount validator
   */
  amount: (value: string, maxAmount?: number) => {
    try {
      InputValidator.validateAmount(value, maxAmount);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Invalid amount';
    }
  },

  /**
   * Real-time wallet address validator
   */
  walletAddress: (value: string) => {
    try {
      ValidationSchemas.walletAddress.parse(value);
      return null;
    } catch (error) {
      return error instanceof z.ZodError ? error.issues[0].message : 'Invalid address';
    }
  },

  /**
   * Real-time percentage validator
   */
  percentage: (value: string) => {
    try {
      ValidationSchemas.percentage.parse(value);
      return null;
    } catch (error) {
      return error instanceof z.ZodError ? error.issues[0].message : 'Invalid percentage';
    }
  },
};

// Auto-run validation tests in development
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    console.log('🔒 Running input validation tests...');
    
    try {
      // Test valid inputs
      InputValidator.validateWalletAddress('0x742D35Cc6134C0532925a3b8D04524205C9cdE4e');
      console.log('✅ Wallet address validation working');
      
      // Test invalid inputs
      try {
        InputValidator.validateWalletAddress('invalid');
        console.error('❌ Wallet address validation failed');
      } catch (error) {
        console.log('✅ Wallet address rejection working');
      }
      
      // Test XSS sanitization
      const dirty = '<script>alert("xss")</script>Hello';
      const clean = XSSSanitizer.sanitizeText(dirty);
      if (clean === 'Hello') {
        console.log('✅ XSS sanitization working');
      } else {
        console.error('❌ XSS sanitization failed');
      }
      
      console.log('🔒 Input validation tests completed');
    } catch (error) {
      console.error('❌ Input validation tests failed:', error);
    }
  }, 1500);
}