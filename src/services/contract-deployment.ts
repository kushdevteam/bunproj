/**
 * Contract Deployment Service
 * Handles deployment of tax-enabled token contracts on BSC
 */

import { JsonRpcProvider, Wallet, ContractFactory, parseEther, formatEther, Contract, ethers } from 'ethers';
import { config } from '../config/env';
import { bscRpcClient } from './bsc-rpc';
import type { TaxTokenTemplate, DeployTaxTokenRequest, DeployTaxTokenResponse, ApiResponse } from '../types';

// Contract ABI and Bytecode - would be generated from compiled contracts
// TODO: Generate these from actual compiled contracts
const TaxTokenABI = [] as any[];
const TaxTokenBytecode = "0x" as string;
const TaxTokenFactoryABI = [] as any[];
const TaxTokenFactoryBytecode = "0x" as string;

// Interfaces for typed contracts
interface TaxTokenContract {
  bulkSetTaxExclusion(addresses: string[], excluded: boolean): Promise<any>;
  setTradingEnabled(enabled: boolean): Promise<any>;
  name(): Promise<string>;
  symbol(): Promise<string>;
  decimals(): Promise<number>;
  totalSupply(): Promise<bigint>;
  getTaxConfig(): Promise<[bigint, string, boolean, bigint]>;
  owner(): Promise<string>;
}

export interface ContractDeploymentResult {
  contractAddress: string;
  deploymentTxHash: string;
  gasUsed: string;
  gasPrice: string;
  deployedAt: string;
  blockNumber: number;
  deploymentCost: string; // in BNB
}

export interface FactoryDeploymentOptions {
  defaultTaxRate: number; // Percentage (e.g., 5 for 5%)
  defaultTreasuryWallet: string;
  creationFee: string; // in BNB
}

class ContractDeploymentService {
  private provider: JsonRpcProvider | null = null;
  private defaultTreasuryWallet: string;
  private defaultTaxRate: number;

  constructor() {
    this.defaultTreasuryWallet = '0x91e58Ea55BF914fE15444E34AF11A259f1DE8526';
    this.defaultTaxRate = 5; // 5% default tax rate
    this.initializeProvider();
  }

  /**
   * Initialize the provider using existing BSC RPC client
   */
  private initializeProvider(): void {
    try {
      const currentNetwork = bscRpcClient.getCurrentNetwork();
      this.provider = new JsonRpcProvider(currentNetwork.rpcUrl, {
        name: currentNetwork.displayName,
        chainId: currentNetwork.chainId,
      });
      console.log(`Contract deployment service initialized for ${currentNetwork.displayName}`);
    } catch (error) {
      console.error('Failed to initialize contract deployment provider:', error);
    }
  }

  /**
   * Deploy a tax token factory contract
   */
  async deployTaxTokenFactory(
    deployerPrivateKey: string,
    options: FactoryDeploymentOptions,
    gasLimit?: string,
    gasPrice?: string
  ): Promise<ContractDeploymentResult> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    // CRITICAL SECURITY: Enforce testnet-only deployment
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== 97) {
      throw new Error(`SAFETY: Contract deployment blocked. Only BSC Testnet (chainId: 97) is allowed, but connected to chainId ${network.chainId}`);
    }

    try {
      // Create wallet instance
      const wallet = new Wallet(deployerPrivateKey, this.provider);
      console.log(`Deploying TaxTokenFactory from wallet: ${wallet.address}`);

      // Validate options
      if (!options.defaultTreasuryWallet || options.defaultTreasuryWallet === '0x0000000000000000000000000000000000000000') {
        throw new Error('Invalid treasury wallet address');
      }
      if (options.defaultTaxRate < 0 || options.defaultTaxRate > 20) {
        throw new Error('Tax rate must be between 0 and 20 percent');
      }

      // Create contract factory
      const contractFactory = new ContractFactory(TaxTokenFactoryABI, TaxTokenFactoryBytecode, wallet);

      // Estimate gas if not provided
      let finalGasLimit = gasLimit;
      if (!finalGasLimit) {
        const estimatedGas = await contractFactory.getDeployTransaction(
          options.defaultTaxRate,
          options.defaultTreasuryWallet,
          parseEther(options.creationFee)
        ).then(tx => this.provider!.estimateGas(tx));
        finalGasLimit = (BigInt(estimatedGas) * BigInt(120) / BigInt(100)).toString(); // Add 20% buffer
      }

      // Get gas price if not provided
      let finalGasPrice = gasPrice;
      if (!finalGasPrice) {
        const gasPriceInfo = await bscRpcClient.getGasPriceInfo();
        finalGasPrice = gasPriceInfo.standard;
      }

      console.log('Factory deployment parameters:', {
        defaultTaxRate: options.defaultTaxRate,
        defaultTreasuryWallet: options.defaultTreasuryWallet,
        creationFee: options.creationFee,
        gasLimit: finalGasLimit,
        gasPrice: finalGasPrice,
      });

      // Deploy the contract
      const contract = await contractFactory.deploy(
        options.defaultTaxRate,
        options.defaultTreasuryWallet,
        parseEther(options.creationFee),
        {
          gasLimit: parseInt(finalGasLimit),
          gasPrice: BigInt(finalGasPrice),
        }
      );

      // Wait for deployment
      const deploymentReceipt = await contract.deploymentTransaction()?.wait();
      if (!deploymentReceipt) {
        throw new Error('Deployment transaction failed');
      }

      const deploymentCost = formatEther(
        BigInt(deploymentReceipt.gasUsed) * BigInt(deploymentReceipt.gasPrice || finalGasPrice)
      );

      const result: ContractDeploymentResult = {
        contractAddress: await contract.getAddress(),
        deploymentTxHash: deploymentReceipt.hash,
        gasUsed: deploymentReceipt.gasUsed.toString(),
        gasPrice: (deploymentReceipt.gasPrice || finalGasPrice).toString(),
        deployedAt: new Date().toISOString(),
        blockNumber: deploymentReceipt.blockNumber,
        deploymentCost,
      };

      console.log('TaxTokenFactory deployed successfully:', result);
      return result;
    } catch (error) {
      console.error('Factory deployment failed:', error);
      throw error;
    }
  }

  /**
   * Deploy a single tax token directly
   */
  async deployTaxToken(
    request: DeployTaxTokenRequest
  ): Promise<DeployTaxTokenResponse> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    if (!request.deployerPrivateKey) {
      throw new Error('Deployer private key is required for contract deployment');
    }

    // CRITICAL SECURITY: Enforce testnet-only deployment
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== 97) {
      throw new Error(`SAFETY: Contract deployment blocked. Only BSC Testnet (chainId: 97) is allowed, but connected to chainId ${network.chainId}`);
    }

    try {
      // Create wallet instance
      const wallet = new Wallet(request.deployerPrivateKey, this.provider);
      console.log(`Deploying TaxToken from wallet: ${wallet.address}`);

      // Validate template
      const template = request.template;
      if (!template.treasuryWallet || template.treasuryWallet === '0x0000000000000000000000000000000000000000') {
        throw new Error('Invalid treasury wallet address');
      }
      if (template.taxRate < 0 || template.taxRate > 20) {
        throw new Error('Tax rate must be between 0 and 20 percent');
      }

      // Create contract factory
      const contractFactory = new ContractFactory(TaxTokenABI, TaxTokenBytecode, wallet);

      // Estimate gas if not provided
      let finalGasLimit = request.gasLimit;
      if (!finalGasLimit) {
        const estimatedGas = await contractFactory.getDeployTransaction(
          template.name,
          template.symbol,
          template.decimals,
          template.totalSupply,
          template.taxRate,
          template.treasuryWallet
        ).then(tx => this.provider!.estimateGas(tx));
        finalGasLimit = (BigInt(estimatedGas) * BigInt(120) / BigInt(100)).toString(); // Add 20% buffer
      }

      // Get gas price if not provided
      let finalGasPrice = request.gasPrice;
      if (!finalGasPrice) {
        const gasPriceInfo = await bscRpcClient.getGasPriceInfo();
        finalGasPrice = gasPriceInfo.standard;
      }

      console.log('Token deployment parameters:', {
        name: template.name,
        symbol: template.symbol,
        decimals: template.decimals,
        totalSupply: template.totalSupply,
        taxRate: template.taxRate,
        treasuryWallet: template.treasuryWallet,
        gasLimit: finalGasLimit,
        gasPrice: finalGasPrice,
      });

      // Deploy the contract
      const contract = await contractFactory.deploy(
        template.name,
        template.symbol,
        template.decimals,
        template.totalSupply,
        template.taxRate,
        template.treasuryWallet,
        {
          gasLimit: parseInt(finalGasLimit),
          gasPrice: BigInt(finalGasPrice),
        }
      );

      // Wait for deployment
      const deploymentReceipt = await contract.deploymentTransaction()?.wait();
      if (!deploymentReceipt) {
        throw new Error('Deployment transaction failed');
      }

      const contractAddress = await contract.getAddress();

      // Create typed contract instance for configuration
      const typedContract = new Contract(contractAddress, TaxTokenABI, wallet) as any;

      // Set up initial configuration if specified
      if (template.excludedWallets && template.excludedWallets.length > 0) {
        console.log(`Setting up exclusions for ${template.excludedWallets.length} wallets...`);
        const excludeTx = await typedContract.bulkSetTaxExclusion(template.excludedWallets, true);
        await excludeTx.wait();
        console.log('Exclusions configured successfully');
      }

      // Enable trading if specified
      if (template.tradingEnabled) {
        console.log('Enabling trading...');
        const tradingTx = await typedContract.setTradingEnabled(true);
        await tradingTx.wait();
        console.log('Trading enabled successfully');
      }

      const result: DeployTaxTokenResponse = {
        contractAddress,
        deploymentTxHash: deploymentReceipt.hash,
        gasUsed: deploymentReceipt.gasUsed.toString(),
        deployedAt: new Date().toISOString(),
        verified: false, // Would need BSCScan verification
      };

      console.log('TaxToken deployed successfully:', result);
      return result;
    } catch (error) {
      console.error('Token deployment failed:', error);
      throw error;
    }
  }

  /**
   * Deploy tax token using factory contract
   */
  async deployTaxTokenViaFactory(
    factoryAddress: string,
    deployerPrivateKey: string,
    template: TaxTokenTemplate,
    creationFee: string, // in BNB
    gasLimit?: string,
    gasPrice?: string
  ): Promise<ContractDeploymentResult> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    // CRITICAL SECURITY: Enforce testnet-only deployment
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== 97) {
      throw new Error(`SAFETY: Factory deployment blocked. Only BSC Testnet (chainId: 97) is allowed, but connected to chainId ${network.chainId}`);
    }

    try {
      // Create wallet instance
      const wallet = new Wallet(deployerPrivateKey, this.provider);
      
      // Connect to factory contract
      const factoryContract = new Contract(factoryAddress, TaxTokenFactoryABI, wallet);

      // Get gas price if not provided
      let finalGasPrice = gasPrice;
      if (!finalGasPrice) {
        const gasPriceInfo = await bscRpcClient.getGasPriceInfo();
        finalGasPrice = gasPriceInfo.standard;
      }

      console.log('Factory deployment parameters:', {
        factoryAddress,
        name: template.name,
        symbol: template.symbol,
        decimals: template.decimals,
        totalSupply: template.totalSupply,
        taxRate: template.taxRate,
        treasuryWallet: template.treasuryWallet,
        creationFee,
      });

      // Create token via factory
      const tx = await factoryContract.createCustomTaxToken(
        template.name,
        template.symbol,
        template.decimals,
        template.totalSupply,
        template.taxRate,
        template.treasuryWallet,
        {
          value: parseEther(creationFee),
          gasLimit: gasLimit ? parseInt(gasLimit) : undefined,
          gasPrice: BigInt(finalGasPrice),
        }
      );

      // Wait for transaction
      const receipt = await tx.wait();
      
      // Extract new token address from events
      const tokenCreatedEvent = receipt.logs.find((log: any) => 
        log.topics[0] === ethers.id('TokenCreated(address,address,string,string,uint256,uint256,address)')
      );
      
      if (!tokenCreatedEvent) {
        throw new Error('TokenCreated event not found in transaction receipt');
      }
      
      const abiCoder = new ethers.AbiCoder();
      const newTokenAddress = abiCoder.decode(
        ['address', 'address', 'string', 'string', 'uint256', 'uint256', 'address'],
        tokenCreatedEvent.data
      )[0];

      const deploymentCost = formatEther(
        BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice || finalGasPrice)
      );

      const result: ContractDeploymentResult = {
        contractAddress: newTokenAddress,
        deploymentTxHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: (receipt.gasPrice || finalGasPrice).toString(),
        deployedAt: new Date().toISOString(),
        blockNumber: receipt.blockNumber,
        deploymentCost,
      };

      console.log('Token deployed via factory successfully:', result);
      return result;
    } catch (error) {
      console.error('Factory token deployment failed:', error);
      throw error;
    }
  }

  /**
   * Get contract deployment cost estimate
   */
  async estimateDeploymentCost(
    template: TaxTokenTemplate,
    gasPrice?: string
  ): Promise<{ gasEstimate: string; costEstimate: string; costInBNB: string }> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      // Create temporary wallet for estimation
      const tempWallet = Wallet.createRandom().connect(this.provider);
      const contractFactory = new ContractFactory(TaxTokenABI, TaxTokenBytecode, tempWallet);

      // Estimate gas
      const gasEstimate = await contractFactory.getDeployTransaction(
        template.name,
        template.symbol,
        template.decimals,
        template.totalSupply,
        template.taxRate,
        template.treasuryWallet
      ).then(tx => this.provider!.estimateGas(tx));

      // Add 20% buffer
      const gasWithBuffer = (BigInt(gasEstimate) * BigInt(120) / BigInt(100)).toString();

      // Get gas price if not provided
      let finalGasPrice = gasPrice;
      if (!finalGasPrice) {
        const gasPriceInfo = await bscRpcClient.getGasPriceInfo();
        finalGasPrice = gasPriceInfo.standard;
      }

      // Calculate cost
      const costInWei = BigInt(gasWithBuffer) * BigInt(finalGasPrice);
      const costInBNB = formatEther(costInWei);

      return {
        gasEstimate: gasWithBuffer,
        costEstimate: costInWei.toString(),
        costInBNB,
      };
    } catch (error) {
      console.error('Failed to estimate deployment cost:', error);
      throw error;
    }
  }

  /**
   * Validate contract template
   */
  validateTemplate(template: TaxTokenTemplate): string[] {
    const errors: string[] = [];

    if (!template.name || template.name.length < 1) {
      errors.push('Token name is required');
    }
    if (!template.symbol || template.symbol.length < 1) {
      errors.push('Token symbol is required');
    }
    if (template.decimals < 0 || template.decimals > 18) {
      errors.push('Decimals must be between 0 and 18');
    }
    if (!template.totalSupply || parseInt(template.totalSupply) <= 0) {
      errors.push('Total supply must be greater than 0');
    }
    if (template.taxRate < 0 || template.taxRate > 20) {
      errors.push('Tax rate must be between 0 and 20 percent');
    }
    if (!template.treasuryWallet || template.treasuryWallet === '0x0000000000000000000000000000000000000000') {
      errors.push('Valid treasury wallet address is required');
    }

    // Validate treasury wallet format (basic check)
    if (template.treasuryWallet && !template.treasuryWallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      errors.push('Treasury wallet address format is invalid');
    }

    return errors;
  }
}

// Export singleton instance
export const contractDeploymentService = new ContractDeploymentService();
export default contractDeploymentService;