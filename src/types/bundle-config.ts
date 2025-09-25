/**
 * Extended Bundle Configuration Types for Phase 4
 */

import { Role } from './index';

// Enhanced Token Configuration
export interface TokenConfig {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  verified: boolean;
  contractValidated: boolean;
}

// Allocation Configuration
export interface AllocationConfig extends Record<string, number> {
  [Role.DEV]: number;
  [Role.MEV]: number;
  [Role.FUNDER]: number;
  [Role.NUMBERED]: number;
}

// Enhanced Transaction Settings
export interface TransactionSettings {
  gasConfiguration: {
    baseGasPrice: string; // in Wei
    priorityFee: string; // in Wei
    gasLimit: string;
    gasMultiplier: number;
  };
  slippageSettings: {
    tolerance: number; // percentage 0.1-50
    autoAdjust: boolean;
    maxSlippage: number;
  };
  mevProtection: {
    enabled: boolean;
    frontrunningProtection: boolean;
    sandwichProtection: boolean;
    usePrivateMempool: boolean;
  };
  networkSettings: {
    rpcEndpoint: string;
    chainId: number;
    fallbackRpc: string[];
  };
}

// Execution Parameters
export interface ExecutionParameters {
  staggerSettings: {
    enabled: boolean;
    delayMin: number; // milliseconds
    delayMax: number; // milliseconds
    randomization: boolean;
  };
  stealthMode: {
    enabled: boolean;
    randomTiming: boolean;
    variationPercent: number; // 0-50%
    proxyUsage: boolean;
  };
  batchConfiguration: {
    batchSize: number; // transactions per batch
    concurrentLimit: number;
    pauseBetweenBatches: number; // seconds
  };
  safetyFeatures: {
    maxTotalSpend: number; // in BNB
    emergencyStopEnabled: boolean;
    maxFailureRate: number; // percentage
    timeoutPerTx: number; // seconds
  };
}

// Enhanced Bundle Configuration
export interface EnhancedBundleConfig {
  // Basic Configuration
  id?: string;
  name: string;
  description: string;
  version: string;
  
  // Token Configuration
  token: TokenConfig;
  
  // Amount and Allocation
  purchaseAmount: {
    totalBnb: number;
    perWalletMin: number;
    perWalletMax: number;
    allocation: AllocationConfig;
  };
  
  // Buy/Sell Strategy
  strategy: {
    buyStrategy: 'immediate' | 'staggered' | 'scaled';
    sellStrategy: 'hold' | 'gradual' | 'dump';
    sellDelay: number; // seconds
    sellPercentage: number; // 0-100
    retainPercentage: number; // 0-100
  };
  
  // Transaction Settings
  transactionSettings: TransactionSettings;
  
  // Execution Parameters
  executionParams: ExecutionParameters;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  author?: string;
  tags: string[];
}

// Configuration Preset
export interface ConfigurationPreset {
  id: string;
  name: string;
  description: string;
  config: EnhancedBundleConfig;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
  usage: number;
}

// Validation Result
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  risk: string;
}

// Configuration Summary
export interface ConfigurationSummary {
  totalWallets: number;
  totalBnbRequired: number;
  estimatedGasCost: number;
  estimatedDuration: number; // seconds
  riskAssessment: {
    level: string;
    factors: string[];
  };
  validationStatus: ValidationResult;
}

// Template Types
export type ConfigurationTemplate = 
  | 'conservative'
  | 'aggressive'
  | 'stealth'
  | 'volume'
  | 'custom';

export interface TemplateInfo {
  id: ConfigurationTemplate;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  config: Partial<EnhancedBundleConfig>;
}