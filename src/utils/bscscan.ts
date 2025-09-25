/**
 * BSCScan Utilities
 * Handles BSCScan URL generation and blockchain explorer integration
 */

import { config } from '../config/env';

export interface BSCScanConfig {
  mainnetUrl: string;
  testnetUrl: string;
  apiKey?: string;
}

export interface TransactionInfo {
  hash: string;
  blockNumber?: number;
  timestamp?: number;
  from?: string;
  to?: string;
  value?: string;
  gasUsed?: string;
  gasPrice?: string;
  status?: 'success' | 'failed' | 'pending';
}

export interface AddressInfo {
  address: string;
  balance?: string;
  txCount?: number;
  lastActivity?: Date;
}

class BSCScanUtils {
  private readonly config: BSCScanConfig = {
    mainnetUrl: 'https://bscscan.com',
    testnetUrl: 'https://testnet.bscscan.com',
    apiKey: process.env.REACT_APP_BSCSCAN_API_KEY,
  };

  /**
   * Determine if we're on mainnet based on chain ID
   */
  private isMainnet(chainId?: number): boolean {
    return chainId === 56; // BSC Mainnet
  }

  /**
   * Get the base BSCScan URL for the current network
   */
  getBaseUrl(chainId?: number): string {
    return this.isMainnet(chainId) ? this.config.mainnetUrl : this.config.testnetUrl;
  }

  /**
   * Generate address URL for BSCScan
   */
  getAddressUrl(address: string, chainId?: number): string {
    const baseUrl = this.getBaseUrl(chainId);
    return `${baseUrl}/address/${address}`;
  }

  /**
   * Generate transaction URL for BSCScan
   */
  getTransactionUrl(txHash: string, chainId?: number): string {
    const baseUrl = this.getBaseUrl(chainId);
    return `${baseUrl}/tx/${txHash}`;
  }

  /**
   * Generate block URL for BSCScan
   */
  getBlockUrl(blockNumber: number | string, chainId?: number): string {
    const baseUrl = this.getBaseUrl(chainId);
    return `${baseUrl}/block/${blockNumber}`;
  }

  /**
   * Generate token URL for BSCScan
   */
  getTokenUrl(tokenAddress: string, chainId?: number): string {
    const baseUrl = this.getBaseUrl(chainId);
    return `${baseUrl}/token/${tokenAddress}`;
  }

  /**
   * Generate token transfer URL for BSCScan
   */
  getTokenTransfersUrl(tokenAddress: string, address?: string, chainId?: number): string {
    const baseUrl = this.getBaseUrl(chainId);
    if (address) {
      return `${baseUrl}/token/${tokenAddress}?a=${address}`;
    }
    return `${baseUrl}/token/${tokenAddress}`;
  }

  /**
   * Open BSCScan URL in new tab
   */
  openInNewTab(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Open address in BSCScan
   */
  viewAddress(address: string, chainId?: number): void {
    const url = this.getAddressUrl(address, chainId);
    this.openInNewTab(url);
  }

  /**
   * Open transaction in BSCScan
   */
  viewTransaction(txHash: string, chainId?: number): void {
    const url = this.getTransactionUrl(txHash, chainId);
    this.openInNewTab(url);
  }

  /**
   * Open token in BSCScan
   */
  viewToken(tokenAddress: string, chainId?: number): void {
    const url = this.getTokenUrl(tokenAddress, chainId);
    this.openInNewTab(url);
  }

  /**
   * Format BSCScan link for display
   */
  formatLinkText(type: 'address' | 'transaction' | 'token' | 'block', value: string): string {
    switch (type) {
      case 'address':
        return `${value.substring(0, 6)}...${value.substring(value.length - 4)}`;
      case 'transaction':
        return `${value.substring(0, 8)}...${value.substring(value.length - 6)}`;
      case 'token':
        return `${value.substring(0, 6)}...${value.substring(value.length - 4)}`;
      case 'block':
        return `#${value}`;
      default:
        return value;
    }
  }

  /**
   * Get network name for display
   */
  getNetworkName(chainId?: number): string {
    return this.isMainnet(chainId) ? 'BSC Mainnet' : 'BSC Testnet';
  }

  /**
   * Generate QR code URL for address (optional feature)
   */
  getQRCodeUrl(address: string, chainId?: number): string {
    const baseUrl = this.getBaseUrl(chainId);
    return `${baseUrl}/qr/${address}`;
  }

  /**
   * Validate BSC address format
   */
  isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Validate transaction hash format
   */
  isValidTxHash(txHash: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(txHash);
  }

  /**
   * Create shareable link with metadata
   */
  createShareableLink(type: 'address' | 'transaction', value: string, chainId?: number): {
    url: string;
    displayText: string;
    networkName: string;
    copyText: string;
  } {
    const networkName = this.getNetworkName(chainId);
    
    switch (type) {
      case 'address':
        return {
          url: this.getAddressUrl(value, chainId),
          displayText: this.formatLinkText('address', value),
          networkName,
          copyText: `View ${value} on ${networkName}: ${this.getAddressUrl(value, chainId)}`,
        };
      case 'transaction':
        return {
          url: this.getTransactionUrl(value, chainId),
          displayText: this.formatLinkText('transaction', value),
          networkName,
          copyText: `View transaction ${value} on ${networkName}: ${this.getTransactionUrl(value, chainId)}`,
        };
      default:
        throw new Error(`Unsupported link type: ${type}`);
    }
  }

  /**
   * Extract transaction info from BSCScan (if API key is available)
   */
  async getTransactionInfo(txHash: string, chainId?: number): Promise<TransactionInfo | null> {
    if (!this.config.apiKey) {
      console.warn('BSCScan API key not configured');
      return null;
    }

    try {
      const apiUrl = this.isMainnet(chainId) 
        ? 'https://api.bscscan.com/api'
        : 'https://api-testnet.bscscan.com/api';

      const response = await fetch(
        `${apiUrl}?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${this.config.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      const tx = data.result;
      if (!tx) {
        return null;
      }

      return {
        hash: tx.hash,
        blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : undefined,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        gasUsed: tx.gas,
        gasPrice: tx.gasPrice,
        status: 'success', // Would need receipt for actual status
      };
    } catch (error) {
      console.error('Failed to fetch transaction info:', error);
      return null;
    }
  }

  /**
   * Get address balance from BSCScan API
   */
  async getAddressBalance(address: string, chainId?: number): Promise<string | null> {
    if (!this.config.apiKey) {
      console.warn('BSCScan API key not configured');
      return null;
    }

    try {
      const apiUrl = this.isMainnet(chainId) 
        ? 'https://api.bscscan.com/api'
        : 'https://api-testnet.bscscan.com/api';

      const response = await fetch(
        `${apiUrl}?module=account&action=balance&address=${address}&tag=latest&apikey=${this.config.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      return data.result;
    } catch (error) {
      console.error('Failed to fetch address balance:', error);
      return null;
    }
  }
}

// Export singleton instance
export const bscScan = new BSCScanUtils();

// Export utilities for components
export default bscScan;