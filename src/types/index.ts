/**
 * Comprehensive TypeScript types for the Multi-Wallet Bundler
 */

// Wallet Role Enum
export enum Role {
  DEV = 'dev',
  MEV = 'mev', 
  FUNDER = 'funder',
  NUMBERED = 'numbered'
}

// Wallet Interface
export interface Wallet {
  id: string;
  publicKey: string;
  privateKey?: string; // Only stored encrypted client-side
  address: string;
  balance: number;
  role: Role;
  createdAt: string;
  isActive: boolean;
  transactions?: Transaction[];
}

// Transaction Interface
export interface Transaction {
  id: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  blockNumber?: number;
}

// Bundle Configuration
export interface BundleConfiguration {
  id?: string;
  name?: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  totalSupply: string;
  platform: 'pancakeswap' | 'uniswap' | 'other';
  fundingPlan: FundingPlan;
  sellPlan: SellPlan;
  walletCount: number;
  gasSettings: GasSettings;
  // Extended properties for enhanced configuration
  purchaseAmount?: {
    totalBnb: number;
    perWalletMin: number;
    perWalletMax: number;
    allocation: Record<string, number>;
  };
  strategy?: {
    buyStrategy: 'immediate' | 'staggered' | 'scaled';
    sellStrategy: 'hold' | 'gradual' | 'dump';
    sellDelay: number;
    sellPercentage: number;
    retainPercentage: number;
  };
  token?: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    verified: boolean;
    contractValidated: boolean;
  };
  transactionSettings?: any;
  executionParams?: any;
}

// Funding Plan
export interface FundingPlan {
  totalFunding: number;
  fundingPerWallet: number;
  fundingCurrency: 'BNB' | 'ETH';
  distributionMethod: 'equal' | 'weighted' | 'random';
}

// Sell Plan
export interface SellPlan {
  sellPercentage: number;
  sellDelay: number; // seconds
  sellMethod: 'gradual' | 'immediate' | 'random';
  maxSlippage: number;
  retainPercentage: number;
}

// Gas Settings
export interface GasSettings {
  gasLimit: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  gasMultiplier: number;
}

// Bundle Result
export interface BundleResult {
  id: string;
  success: boolean;
  transactions: Transaction[];
  totalGasUsed: string;
  totalCost: string;
  profitLoss: string;
  executionTime: number; // milliseconds
  errors: string[];
  createdAt: string;
}

// API Response Wrappers
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: string;
}

// Health Check Response
export interface HealthResponse {
  status: string;
  timestamp: string;
  network: string;
  server: string;
  features: string[];
}

// Wallet Generation Request/Response
export interface GenerateWalletsRequest {
  count: number;
  roles?: Role[];
}

export interface GenerateWalletsResponse {
  wallets: Wallet[];
  seed?: string; // Optional seed for reproducibility
}

// Wallet Funding Request/Response
export interface FundWalletsRequest {
  wallets: string[]; // Array of wallet addresses
  amount: number;
  currency: 'BNB' | 'ETH';
}

export interface FundWalletsResponse {
  fundedWallets: Array<{
    address: string;
    amount: number;
    txHash: string;
    success: boolean;
  }>;
  totalFunded: number;
  failedCount: number;
}

// Bundle Execution Request/Response
export interface ExecuteBundleRequest {
  config: BundleConfiguration;
  wallets: string[];
  dryRun?: boolean;
}

export interface ExecuteBundleResponse {
  bundleResult: BundleResult;
  estimatedCost?: string;
  warnings: string[];
}

// Token Creation Request/Response
export interface CreateTokenRequest {
  name: string;
  symbol: string;
  description: string;
  totalSupply: string;
  platform: string;
  metadata?: Record<string, any>;
}

export interface CreateTokenResponse {
  tokenId: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  description: string;
  platform: string;
  createdAt: string;
  status: 'created' | 'pending' | 'failed';
}

// Session Management
export interface SessionState {
  isUnlocked: boolean;
  passphrase?: string;
  sessionId?: string;
  expiresAt?: string;
  encryptedData?: Record<string, string>;
}

// Application State
export interface AppState {
  wallets: Wallet[];
  bundles: BundleResult[];
  currentConfig: Partial<BundleConfiguration>;
  session: SessionState;
  isLoading: boolean;
  errors: ApiError[];
}

// Crypto Utilities Types
export interface EncryptionResult {
  encrypted: ArrayBuffer;
  iv: Uint8Array;
  salt: Uint8Array;
}

export interface DecryptionParams {
  encrypted: ArrayBuffer;
  iv: Uint8Array;
  salt: Uint8Array;
  passphrase: string;
}

// Form Validation Schemas (for react-hook-form with zod)
export interface WalletFormData {
  count: number;
  roles: Role[];
}

export interface BundleFormData {
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  totalSupply: string;
  platform: string;
  fundingAmount: number;
  sellPercentage: number;
  walletCount: number;
}

export interface SessionFormData {
  passphrase: string;
  confirmPassphrase?: string;
}

// Component Props Types
export interface WalletCardProps {
  wallet: Wallet;
  onSelect?: (wallet: Wallet) => void;
  isSelected?: boolean;
  showBalance?: boolean;
}

export interface BundleConfigurationCardProps {
  config: Partial<BundleConfiguration>;
  onUpdate: (config: Partial<BundleConfiguration>) => void;
  isEditing?: boolean;
}

export interface TransactionListProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

// Store Types (for Zustand)
export interface WalletStore {
  wallets: Wallet[];
  selectedWallets: string[];
  isGenerating: boolean;
  error: string | null;
  
  addWallets: (wallets: Wallet[]) => void;
  removeWallet: (id: string) => void;
  selectWallet: (id: string) => void;
  deselectWallet: (id: string) => void;
  clearSelection: () => void;
  updateWallet: (id: string, updates: Partial<Wallet>) => void;
  setError: (error: string | null) => void;
}

export interface SessionStore {
  isUnlocked: boolean;
  sessionId: string | null;
  expiresAt: Date | null;
  
  unlock: (passphrase: string) => Promise<boolean>;
  lock: () => void;
  extendSession: () => void;
  isSessionValid: () => boolean;
}

export interface ConfigStore {
  currentConfig: Partial<BundleConfiguration>;
  savedConfigs: BundleConfiguration[];
  
  updateConfig: (updates: Partial<BundleConfiguration>) => void;
  saveConfig: (name: string) => void;
  loadConfig: (id: string) => void;
  deleteConfig: (id: string) => void;
  resetConfig: () => void;
}

// Funding Panel Types
export type DistributionMethod = 'equal' | 'weighted' | 'custom' | 'smart';
export type FundingOperationStatus = 'idle' | 'preparing' | 'executing' | 'completed' | 'failed' | 'cancelled';

export interface FundingTransaction {
  id: string;
  walletAddress: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
  gasUsed?: string;
  error?: string;
  timestamp: string;
}

export interface DistributionPlan {
  walletId: string;
  address: string;
  role: Role;
  currentBalance: number;
  plannedAmount: number;
  finalBalance: number;
  requiresFunding: boolean;
}

export interface FundingOperation {
  id: string;
  method: DistributionMethod;
  totalAmount: number;
  selectedWallets: string[];
  distributionPlan: DistributionPlan[];
  transactions: FundingTransaction[];
  status: FundingOperationStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  gasEstimate: number;
  estimatedCost: number;
}

// Treasury Management Types
export type TreasuryOperationType = 'withdraw_all' | 'withdraw_partial' | 'withdraw_emergency' | 'withdraw_by_role';
export type TreasuryStatus = 'idle' | 'preparing' | 'executing' | 'completed' | 'failed' | 'cancelled';

export interface TreasuryTransaction {
  id: string;
  walletAddress: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
  gasUsed?: string;
  error?: string;
  timestamp: string;
}

export interface TreasuryOperation {
  id: string;
  type: TreasuryOperationType;
  treasuryAddress: string;
  selectedWallets: string[];
  withdrawalAmounts: Record<string, number>;
  minimumBalance: number;
  transactions: TreasuryTransaction[];
  status: TreasuryStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  totalWithdrawn: number;
  gasEstimate: number;
  estimatedCost: number;
}

// Network Management Types
export type NetworkType = 'testnet' | 'mainnet';

export interface NetworkConfig {
  id: string;
  name: string;
  displayName: string;
  type: NetworkType;
  chainId: number;
  rpcUrl: string;
  backupRpcUrls?: readonly string[];
  blockExplorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isTestnet: boolean;
  iconColor: string;
  warningLevel: 'none' | 'warning' | 'danger';
  faucetUrl?: string;
  features?: readonly string[];
}

export interface NetworkState {
  currentNetwork: NetworkConfig;
  availableNetworks: NetworkConfig[];
  isConnected: boolean;
  blockNumber?: number;
  gasPrice?: string;
  lastUpdate?: string;
  connectionError?: string;
}

// Export Management Types
export type ExportFormat = 'hex' | 'json' | 'csv';
export type ExportType = 'single' | 'bulk' | 'by_role';

export interface ExportRequest {
  type: ExportType;
  format: ExportFormat;
  walletIds?: string[];
  role?: Role;
  includeBalances?: boolean;
  includePrivateKeys?: boolean;
  passphrase: string;
}

export interface ExportedWallet {
  id: string;
  address: string;
  role: Role;
  balance?: number;
  privateKey?: string;
  createdAt: string;
}

export interface ExportResult {
  filename: string;
  format: ExportFormat;
  wallets: ExportedWallet[];
  exportedAt: string;
  totalWallets: number;
  warnings: string[];
}

export interface ExportDialogState {
  isOpen: boolean;
  type: ExportType;
  selectedWallets?: string[];
  format: ExportFormat;
  includePrivateKeys: boolean;
  requiresConfirmation: boolean;
  securityWarnings: string[];
}

// Network Store Types
export interface NetworkStore {
  currentNetwork: NetworkConfig;
  availableNetworks: NetworkConfig[];
  isConnected: boolean;
  isConnecting: boolean;
  blockNumber?: number;
  gasPrice?: string;
  lastUpdate?: string;
  error?: string;
  
  // Actions
  switchNetwork: (networkId: string) => Promise<void>;
  refreshNetworkStatus: () => Promise<void>;
  updateGasPrice: () => Promise<void>;
  setError: (error: string | null) => void;
}

// Enhanced Wallet Store for Export Functionality
export interface EnhancedWalletStore extends WalletStore {
  // Export functionality
  exportWallets: (request: ExportRequest) => Promise<ExportResult>;
  exportSingleWallet: (walletId: string, passphrase: string, format: ExportFormat) => Promise<ExportedWallet>;
  exportWalletsByRole: (role: Role, passphrase: string, format: ExportFormat) => Promise<ExportedWallet[]>;
  validateExportRequest: (request: ExportRequest) => string[];
}