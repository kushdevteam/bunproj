/**
 * Environment configuration for the Multi-Wallet Bundler
 */

export const config = {
  // API Configuration
  api: {
    baseUrl: process.env.REACT_APP_API_URL || (
      // Force relative URLs in Replit environment to use proxy
      ''
    ),
    timeout: parseInt(process.env.REACT_APP_API_TIMEOUT || '30000'),
    retryAttempts: parseInt(process.env.REACT_APP_API_RETRY_ATTEMPTS || '3'),
  },
  
  // Development Configuration
  development: {
    isDev: process.env.NODE_ENV === 'development',
    enableLogging: process.env.REACT_APP_ENABLE_LOGGING !== 'false',
    enableDebugMode: process.env.REACT_APP_DEBUG_MODE === 'true',
    mockApi: process.env.REACT_APP_MOCK_API === 'true',
    mockBlockchain: process.env.REACT_APP_MOCK_BLOCKCHAIN !== 'false', // Default to true in dev
  },
  
  // Security Configuration
  security: {
    sessionTimeout: parseInt(process.env.REACT_APP_SESSION_TIMEOUT || '3600000'), // 1 hour default
    encryptionKeyLength: 32,
    pbkdf2Iterations: 100000,
    storagePrefix: 'justjewit_',
    maxWalletCount: parseInt(process.env.REACT_APP_MAX_WALLET_COUNT || '100'),
  },
  
  // Blockchain Configuration
  blockchain: {
    network: process.env.REACT_APP_NETWORK || 'bsc-testnet',
    defaultGasLimit: process.env.REACT_APP_DEFAULT_GAS_LIMIT || '300000',
    defaultGasPrice: process.env.REACT_APP_DEFAULT_GAS_PRICE || '20000000000', // 20 gwei
    confirmationsRequired: parseInt(process.env.REACT_APP_CONFIRMATIONS_REQUIRED || '3'),
  },

  // Network Configurations for BSC Testnet and Mainnet
  networks: {
    'bsc-testnet': {
      id: 'bsc-testnet',
      name: 'bsc-testnet',
      displayName: 'BSC Testnet',
      type: 'testnet' as const,
      chainId: 97,
      rpcUrl: process.env.REACT_APP_BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.binance.org:8545',
      backupRpcUrls: [
        'https://data-seed-prebsc-2-s1.binance.org:8545',
        'https://data-seed-prebsc-1-s2.binance.org:8545',
        'https://data-seed-prebsc-2-s2.binance.org:8545',
        'https://data-seed-prebsc-1-s3.binance.org:8545',
      ],
      blockExplorerUrl: 'https://testnet.bscscan.com',
      nativeCurrency: {
        name: 'Test BNB',
        symbol: 'tBNB',
        decimals: 18,
      },
      isTestnet: true,
      iconColor: '#22c55e', // Green for testnet
      warningLevel: 'none' as const,
      faucetUrl: 'https://testnet.bnbchain.org/faucet-smart',
      features: ['balance_checking', 'transaction_sending', 'contract_interaction'],
    },
    'bsc-mainnet': {
      id: 'bsc-mainnet',
      name: 'bsc-mainnet',
      displayName: 'BSC Mainnet',
      type: 'mainnet' as const,
      chainId: 56,
      rpcUrl: process.env.REACT_APP_BSC_MAINNET_RPC || 'https://bsc-dataseed1.binance.org',
      backupRpcUrls: [
        'https://bsc-dataseed2.binance.org',
        'https://bsc-dataseed3.binance.org',
        'https://bsc-dataseed4.binance.org',
        'https://bsc-dataseed1.defibit.io',
        'https://bsc-dataseed2.defibit.io',
        'https://bsc-dataseed3.defibit.io',
        'https://bsc-dataseed4.defibit.io',
        'https://bsc-dataseed1.ninicoin.io',
        'https://bsc-dataseed2.ninicoin.io',
        'https://bsc-dataseed3.ninicoin.io',
        'https://bsc-dataseed4.ninicoin.io',
      ],
      blockExplorerUrl: 'https://bscscan.com',
      nativeCurrency: {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18,
      },
      isTestnet: false,
      iconColor: '#ef4444', // Red for mainnet (danger)
      warningLevel: 'danger' as const,
      features: ['balance_checking', 'transaction_sending', 'contract_interaction'],
    },
  },

  // Network Connection Settings
  rpc: {
    timeout: parseInt(process.env.REACT_APP_RPC_TIMEOUT || '10000'), // 10 seconds
    retryAttempts: parseInt(process.env.REACT_APP_RPC_RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.REACT_APP_RPC_RETRY_DELAY || '1000'), // 1 second
    maxConcurrentRequests: parseInt(process.env.REACT_APP_RPC_MAX_CONCURRENT || '5'),
    cacheTime: parseInt(process.env.REACT_APP_RPC_CACHE_TIME || '30000'), // 30 seconds
  },

  // Gas and Transaction Settings
  gas: {
    defaultGasLimit: parseInt(process.env.REACT_APP_DEFAULT_GAS_LIMIT || '300000'),
    defaultGasPrice: process.env.REACT_APP_DEFAULT_GAS_PRICE || '20000000000', // 20 gwei
    maxGasPrice: process.env.REACT_APP_MAX_GAS_PRICE || '100000000000', // 100 gwei
    gasLimitMultiplier: parseFloat(process.env.REACT_APP_GAS_LIMIT_MULTIPLIER || '1.2'), // 20% buffer
    gasPriceRefreshInterval: parseInt(process.env.REACT_APP_GAS_PRICE_REFRESH || '30000'), // 30 seconds
  },

  // Export and Security Settings
  export: {
    maxExportSize: parseInt(process.env.REACT_APP_MAX_EXPORT_SIZE || '100'), // Max wallets per export
    requireConfirmations: parseInt(process.env.REACT_APP_EXPORT_CONFIRMATIONS || '3'), // Security confirmations
    downloadTimeout: parseInt(process.env.REACT_APP_DOWNLOAD_TIMEOUT || '30000'), // 30 seconds
    enableBulkExport: process.env.REACT_APP_ENABLE_BULK_EXPORT !== 'false',
    enablePrivateKeyExport: process.env.REACT_APP_ENABLE_PRIVATE_KEY_EXPORT !== 'false',
  },
  
  // Application Configuration
  app: {
    name: 'JustJewIt Multi-Wallet Bundler',
    version: process.env.REACT_APP_VERSION || '1.0.0',
    maxBundleSize: parseInt(process.env.REACT_APP_MAX_BUNDLE_SIZE || '50'),
    defaultWalletCount: parseInt(process.env.REACT_APP_DEFAULT_WALLET_COUNT || '5'),
    autoSaveInterval: parseInt(process.env.REACT_APP_AUTOSAVE_INTERVAL || '30000'), // 30 seconds
  },
  
  // Feature Flags
  features: {
    enableAdvancedMode: process.env.REACT_APP_ENABLE_ADVANCED_MODE === 'true',
    enableAnalytics: process.env.REACT_APP_ENABLE_ANALYTICS === 'true',
    enableExport: process.env.REACT_APP_ENABLE_EXPORT !== 'false',
    enableBatchOperations: process.env.REACT_APP_ENABLE_BATCH_OPS !== 'false',
  },
} as const;

export type Config = typeof config;

// Environment validation
export const validateEnvironment = (): void => {
  const requiredEnvVars: string[] = [
    // Add any required environment variables here
  ];
  
  const missing = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
  
  // Validate numeric values
  const numericConfigs = [
    config.api.timeout,
    config.api.retryAttempts,
    config.security.sessionTimeout,
    config.security.maxWalletCount,
    config.blockchain.confirmationsRequired,
    config.app.maxBundleSize,
    config.app.defaultWalletCount,
    config.app.autoSaveInterval,
  ];
  
  numericConfigs.forEach((value, index) => {
    if (isNaN(value) || value < 0) {
      console.warn(`Invalid numeric configuration at index ${index}: ${value}`);
    }
  });
};

// Initialize environment validation
if (config.development.isDev) {
  try {
    validateEnvironment();
  } catch (error) {
    console.error('Environment validation failed:', error);
  }
}

export default config;