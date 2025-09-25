/**
 * Four.meme API Client Service
 * Handles authentication, image upload, and token creation through four.meme platform
 */

import { ethers } from 'ethers';
import { bscRpcClient } from './bsc-rpc';
import { config } from '../config/env';

// Four.meme API endpoints
const FOURMEME_API_BASE = 'https://four.meme/meme-api';

// Four.meme API interfaces
export interface FourMemeNonceRequest {
  accountAddress: string;
  verifyType: 'LOGIN';
  networkCode: 'BSC';
}

export interface FourMemeNonceResponse {
  code: string;
  data: string;
}

export interface FourMemeLoginRequest {
  region: 'WEB';
  langType: 'EN';
  loginIp: '';
  inviteCode: '';
  verifyInfo: {
    address: string;
    networkCode: 'BSC';
    signature: string;
    verifyType: 'LOGIN';
  };
  walletName: 'MetaMask';
}

export interface FourMemeLoginResponse {
  code: string;
  data: string; // access_token
}

export interface FourMemeUploadResponse {
  code: string;
  data: string; // image URL
}

export interface FourMemeTokenCreateRequest {
  name: string;
  shortName: string;
  desc: string;
  imgUrl: string;
  launchTime: number;
  label: string;
  lpTradingFee: number;
  webUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  preSale: string;
  // Fixed parameters
  totalSupply: 1000000000;
  raisedAmount: 24;
  saleRate: 0.8;
  reserveRate: 0;
  funGroup: false;
  clickFun: false;
  symbol: 'BNB';
  raisedToken: {
    symbol: 'BNB';
    nativeSymbol: 'BNB';
    symbolAddress: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
    deployCost: '0';
    buyFee: '0.01';
    sellFee: '0.01';
    minTradeFee: '0';
    b0Amount: '8';
    totalBAmount: '24';
    totalAmount: '1000000000';
    logoUrl: 'https://static.four.meme/market/68b871b6-96f7-408c-b8d0-388d804b34275092658264263839640.png';
    tradeLevel: ['0.1', '0.5', '1'];
    status: 'PUBLISH';
    buyTokenLink: 'https://pancakeswap.finance/swap';
    reservedNumber: 10;
    saleRate: '0.8';
    networkCode: 'BSC';
    platform: 'MEME';
  };
}

export interface FourMemeTokenCreateResponse {
  code: string;
  data: {
    createArg: string; // Hex data for contract call
    signature: string; // Signature for contract call
  };
}

export interface TokenCreationResult {
  contractAddress: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  status: 'success' | 'failed';
  fourMemeUrl?: string;
}

class FourMemeClient {
  private accessToken: string | null = null;
  private tokenManagerAddress = '0x5c952063c7fc8610FFDB798152D69F0B9550762b'; // BSC TokenManager2

  constructor() {
    console.log('Four.meme client initialized');
  }

  /**
   * Generate nonce for wallet authentication
   */
  private async generateNonce(walletAddress: string): Promise<string> {
    const request: FourMemeNonceRequest = {
      accountAddress: walletAddress,
      verifyType: 'LOGIN',
      networkCode: 'BSC'
    };

    try {
      const response = await fetch(`${FOURMEME_API_BASE}/v1/private/user/nonce/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate nonce: ${response.status} ${response.statusText}`);
      }

      const result: FourMemeNonceResponse = await response.json();
      
      if (result.code !== '0') {
        throw new Error(`Four.meme API error: ${result.code}`);
      }

      return result.data;
    } catch (error) {
      console.error('Failed to generate nonce:', error);
      throw new Error(`Nonce generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sign message with wallet and login to four.meme
   */
  async login(walletPrivateKey: string): Promise<string> {
    try {
      // Create wallet instance
      const wallet = new ethers.Wallet(walletPrivateKey);
      const walletAddress = wallet.address;

      console.log(`Authenticating with four.meme using wallet: ${walletAddress}`);

      // Step 1: Generate nonce
      const nonce = await this.generateNonce(walletAddress);
      console.log('Nonce generated successfully');

      // Step 2: Sign the message
      const message = `You are sign in Meme ${nonce}`;
      const signature = await wallet.signMessage(message);

      // Step 3: Login with signature
      const loginRequest: FourMemeLoginRequest = {
        region: 'WEB',
        langType: 'EN',
        loginIp: '',
        inviteCode: '',
        verifyInfo: {
          address: walletAddress,
          networkCode: 'BSC',
          signature,
          verifyType: 'LOGIN'
        },
        walletName: 'MetaMask'
      };

      const response = await fetch(`${FOURMEME_API_BASE}/v1/private/user/login/dex`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginRequest),
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
      }

      const result: FourMemeLoginResponse = await response.json();
      
      if (result.code !== '0') {
        throw new Error(`Four.meme login error: ${result.code}`);
      }

      this.accessToken = result.data;
      console.log('Successfully authenticated with four.meme');
      return this.accessToken;
    } catch (error) {
      console.error('Four.meme login failed:', error);
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload token image to four.meme platform
   */
  async uploadImage(imageFile: File): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const formData = new FormData();
      formData.append('file', imageFile);

      const response = await fetch(`${FOURMEME_API_BASE}/v1/private/token/upload`, {
        method: 'POST',
        headers: {
          'meme-web-access': this.accessToken,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Image upload failed: ${response.status} ${response.statusText}`);
      }

      const result: FourMemeUploadResponse = await response.json();
      
      if (result.code !== '0') {
        throw new Error(`Four.meme upload error: ${result.code}`);
      }

      console.log('Image uploaded successfully:', result.data);
      return result.data;
    } catch (error) {
      console.error('Image upload failed:', error);
      throw new Error(`Image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create token parameters and get signature from four.meme API
   */
  async createTokenSignature(tokenData: {
    name: string;
    symbol: string;
    description: string;
    imageUrl: string;
    socialLinks: {
      website?: string;
      twitter?: string;
      telegram?: string;
    };
    launchTime?: number;
    preSaleBnb?: string;
  }): Promise<{ createArg: string; signature: string }> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      // Get config data for raisedToken (static for now)
      const raisedTokenConfig = {
        symbol: 'BNB' as const,
        nativeSymbol: 'BNB' as const,
        symbolAddress: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' as const,
        deployCost: '0' as const,
        buyFee: '0.01' as const,
        sellFee: '0.01' as const,
        minTradeFee: '0' as const,
        b0Amount: '8' as const,
        totalBAmount: '24' as const,
        totalAmount: '1000000000' as const,
        logoUrl: 'https://static.four.meme/market/68b871b6-96f7-408c-b8d0-388d804b34275092658264263839640.png' as const,
        tradeLevel: ['0.1', '0.5', '1'],
        status: 'PUBLISH' as const,
        buyTokenLink: 'https://pancakeswap.finance/swap' as const,
        reservedNumber: 10 as const,
        saleRate: '0.8' as const,
        networkCode: 'BSC' as const,
        platform: 'MEME' as const
      };

      const createRequest: FourMemeTokenCreateRequest = {
        name: tokenData.name,
        shortName: tokenData.symbol,
        desc: tokenData.description,
        imgUrl: tokenData.imageUrl,
        launchTime: tokenData.launchTime || Date.now(),
        label: 'Meme', // Default to Meme category
        lpTradingFee: 0.0025, // Fixed trading fee
        webUrl: tokenData.socialLinks.website || '',
        twitterUrl: tokenData.socialLinks.twitter || '',
        telegramUrl: tokenData.socialLinks.telegram || '',
        preSale: tokenData.preSaleBnb || '0',
        // Fixed parameters that cannot be customized
        totalSupply: 1000000000,
        raisedAmount: 24,
        saleRate: 0.8,
        reserveRate: 0,
        funGroup: false,
        clickFun: false,
        symbol: 'BNB',
        raisedToken: raisedTokenConfig as any
      };

      console.log('Creating token signature with four.meme:', {
        name: createRequest.name,
        symbol: createRequest.shortName,
        description: createRequest.desc.substring(0, 50) + '...',
      });

      const response = await fetch(`${FOURMEME_API_BASE}/v1/private/token/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'meme-web-access': this.accessToken,
        },
        body: JSON.stringify(createRequest),
      });

      if (!response.ok) {
        throw new Error(`Token creation request failed: ${response.status} ${response.statusText}`);
      }

      const result: FourMemeTokenCreateResponse = await response.json();
      
      if (result.code !== '0') {
        throw new Error(`Four.meme token creation error: ${result.code}`);
      }

      console.log('Token signature created successfully');
      return result.data;
    } catch (error) {
      console.error('Token signature creation failed:', error);
      throw new Error(`Token signature creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deploy token to blockchain using TokenManager2 contract
   */
  async deployToken(
    walletPrivateKey: string,
    createArg: string,
    signature: string
  ): Promise<TokenCreationResult> {
    try {
      console.log('Starting token deployment to BSC...');
      
      // Get current network info
      const network = bscRpcClient.getCurrentNetwork();
      console.log(`Deploying on network: ${network.displayName}`);

      // Create wallet instance with QuickNode provider
      const provider = new ethers.JsonRpcProvider(config.networks['bsc-testnet'].rpcUrl);
      const wallet = new ethers.Wallet(walletPrivateKey, provider);

      console.log(`Deploying from wallet: ${wallet.address}`);

      // Create contract instance
      const tokenManagerABI = [
        'function createToken(bytes calldata createArg, bytes calldata sign) external payable',
        'event TokenCreate(address indexed creator, address indexed token, uint256 requestId, string name, string symbol, uint256 totalSupply, uint256 launchTime, uint256 launchFee)'
      ];

      const contract = new ethers.Contract(this.tokenManagerAddress, tokenManagerABI, wallet);

      // Convert hex strings to bytes
      const createArgBytes = ethers.getBytes(createArg);
      const signatureBytes = ethers.getBytes(signature);

      // Get gas price
      const gasPriceInfo = await bscRpcClient.getGasPriceInfo();
      
      // Estimate gas
      let gasLimit: bigint;
      try {
        gasLimit = await contract.createToken.estimateGas(createArgBytes, signatureBytes, {
          value: ethers.parseEther('0.005') // 0.005 BNB creation fee
        });
        gasLimit = gasLimit * BigInt(120) / BigInt(100); // Add 20% buffer
      } catch (gasError) {
        console.warn('Gas estimation failed, using default:', gasError);
        gasLimit = BigInt(500000); // Default gas limit
      }

      console.log('Transaction parameters:', {
        gasLimit: gasLimit.toString(),
        gasPrice: gasPriceInfo.standard,
        value: '0.005 BNB',
        to: this.tokenManagerAddress
      });

      // Send transaction
      const tx = await contract.createToken(createArgBytes, signatureBytes, {
        value: ethers.parseEther('0.005'),
        gasLimit,
        gasPrice: BigInt(gasPriceInfo.standard)
      });

      console.log(`Transaction sent: ${tx.hash}`);
      console.log(`View on BSCScan: ${network.blockExplorerUrl}/tx/${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (!receipt) {
        throw new Error('Transaction receipt not available');
      }

      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

      // Parse TokenCreate event to get the new token address
      let tokenAddress = '';
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog && parsedLog.name === 'TokenCreate') {
            tokenAddress = parsedLog.args.token;
            console.log(`New token created at: ${tokenAddress}`);
            break;
          }
        } catch (parseError) {
          // Continue to next log
        }
      }

      if (!tokenAddress) {
        throw new Error('Could not find TokenCreate event in transaction logs');
      }

      const result: TokenCreationResult = {
        contractAddress: tokenAddress,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'success' : 'failed',
        fourMemeUrl: `https://four.meme/token/${tokenAddress}`
      };

      console.log('Token deployment successful:', result);
      return result;
    } catch (error) {
      console.error('Token deployment failed:', error);
      throw new Error(`Token deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Complete token creation flow with enhanced progress tracking
   */
  async createToken(tokenData: {
    name: string;
    symbol: string;
    description: string;
    imageFile: File | null;
    socialLinks: {
      website?: string;
      twitter?: string;
      telegram?: string;
    };
    launchTime?: number;
    preSaleBnb?: string;
  }, walletPrivateKey: string, progressCallback?: (step: string, progress: number) => void): Promise<TokenCreationResult> {
    try {
      console.log('Starting complete token creation flow...');
      progressCallback?.('Initializing...', 10);
      
      // Step 1: Login to four.meme
      console.log('Authenticating with four.meme...');
      progressCallback?.('Authenticating with four.meme...', 20);
      try {
        await this.login(walletPrivateKey);
      } catch (authError) {
        throw new Error(`Authentication failed: ${authError instanceof Error ? authError.message : 'Unknown authentication error'}`);
      }
      
      // Step 2: Upload image if provided
      let imageUrl = '';
      if (tokenData.imageFile) {
        console.log('Uploading token image...');
        progressCallback?.('Uploading token image...', 35);
        try {
          imageUrl = await this.uploadImage(tokenData.imageFile);
        } catch (uploadError) {
          console.warn('Image upload failed, continuing without image:', uploadError);
          // Continue without image rather than failing completely
        }
      }
      
      // Step 3: Create token signature
      console.log('Getting token creation signature...');
      progressCallback?.('Preparing token deployment...', 50);
      let createArg: string;
      let signature: string;
      try {
        const result = await this.createTokenSignature({
          ...tokenData,
          imageUrl
        });
        createArg = result.createArg;
        signature = result.signature;
      } catch (signatureError) {
        throw new Error(`Token signature creation failed: ${signatureError instanceof Error ? signatureError.message : 'Unknown signature error'}`);
      }
      
      // Step 4: Deploy to blockchain
      console.log('Deploying token to blockchain...');
      progressCallback?.('Deploying to blockchain...', 75);
      let deployResult: TokenCreationResult;
      try {
        deployResult = await this.deployToken(walletPrivateKey, createArg, signature);
      } catch (deployError) {
        throw new Error(`Blockchain deployment failed: ${deployError instanceof Error ? deployError.message : 'Unknown deployment error'}`);
      }
      
      // Step 5: Monitor transaction completion
      progressCallback?.('Confirming transaction...', 90);
      try {
        // Add extra verification by checking the transaction status
        const monitorResult = await this.monitorTransaction(deployResult.transactionHash);
        if (monitorResult && monitorResult.status === 'failed') {
          throw new Error('Transaction failed on blockchain');
        }
      } catch (monitorError) {
        console.warn('Transaction monitoring failed, but deployment may have succeeded:', monitorError);
        // Don't fail the entire process if monitoring fails
      }
      
      progressCallback?.('Token creation completed!', 100);
      console.log('Token creation flow completed successfully:', deployResult);
      return deployResult;
    } catch (error) {
      console.error('Token creation flow failed:', error);
      
      // Enhanced error handling with specific error types
      if (error instanceof Error) {
        if (error.message.includes('authentication') || error.message.includes('login')) {
          throw new Error('Failed to authenticate with four.meme. Please check your wallet and try again.');
        } else if (error.message.includes('image') || error.message.includes('upload')) {
          throw new Error('Image upload failed. You can try again or proceed without an image.');
        } else if (error.message.includes('signature')) {
          throw new Error('Failed to prepare token for deployment. Please check your token details and try again.');
        } else if (error.message.includes('deployment') || error.message.includes('blockchain')) {
          throw new Error('Blockchain deployment failed. Please check your wallet balance and network connection.');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          throw new Error('Network error. Please check your internet connection and try again.');
        }
      }
      
      throw error;
    }
  }

  /**
   * Monitor transaction status
   */
  async monitorTransaction(txHash: string): Promise<TokenCreationResult | null> {
    try {
      console.log(`Monitoring transaction: ${txHash}`);
      
      const receipt = await bscRpcClient.waitForTransaction(txHash, 1, 120000);
      
      if (!receipt) {
        throw new Error('Transaction not found or timed out');
      }

      // Parse logs to get token address
      const tokenManagerABI = [
        'event TokenCreate(address indexed creator, address indexed token, uint256 requestId, string name, string symbol, uint256 totalSupply, uint256 launchTime, uint256 launchFee)'
      ];
      
      const iface = new ethers.Interface(tokenManagerABI);
      let tokenAddress = '';
      
      for (const log of receipt.logs) {
        try {
          const parsedLog = iface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog && parsedLog.name === 'TokenCreate') {
            tokenAddress = parsedLog.args.token;
            break;
          }
        } catch (parseError) {
          // Continue to next log
        }
      }

      return {
        contractAddress: tokenAddress,
        transactionHash: txHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'success' : 'failed',
        fourMemeUrl: tokenAddress ? `https://four.meme/token/${tokenAddress}` : undefined
      };
    } catch (error) {
      console.error('Transaction monitoring failed:', error);
      return null;
    }
  }
}

// Export singleton instance
export const fourMemeClient = new FourMemeClient();
export default fourMemeClient;