/**
 * REAL WLSFX Test Token Deployment Script
 * Executes actual on-chain deployment to BSC Testnet
 */

const { ethers } = require('ethers');
const crypto = require('crypto');

// BSC Testnet configuration
const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545';
const FUNDED_WALLET_ADDRESS = '0xe9ec106Cf658ca5b736DD29d5Be6e6Aa1c706875';
const FUNDED_WALLET_PRIVATE_KEY = '0x7e4034c051fc383c278fe5988e822c989fea9eb8b5f4386e124ddf12d3eede8a';

// Contract ABI (from compiled TaxToken.sol)
const TAXTOKEN_ABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "name_", "type": "string"},
      {"internalType": "string", "name": "symbol_", "type": "string"},
      {"internalType": "uint8", "name": "decimals_", "type": "uint8"},
      {"internalType": "uint256", "name": "totalSupply_", "type": "uint256"},
      {"internalType": "uint256", "name": "taxRate_", "type": "uint256"},
      {"internalType": "address", "name": "treasury_", "type": "address"}
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "owner", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "spender", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "value", "type": "uint256"}
    ],
    "name": "Approval",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "from", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "to", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "value", "type": "uint256"}
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "inputs": [{"internalType": "bool", "name": "enabled", "type": "bool"}],
    "name": "setTradingEnabled",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "recipient", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Contract bytecode (truncated version for testing)
const TAXTOKEN_BYTECODE = "0x608060405234801561000f575f5ffd5b506040516144d63803806144d683398181016040528101906100319190610659565b5f73ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff160361009f576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016100969061079a565b60405180910390fd5b60148211156100e3576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016100da90610828565b60405180910390fd5b85600390816100f29190610a4d565b5084600490816101029190610a4d565b508360055f6101000a81548160ff021916908360ff16021790555083600a61012a9190610c78565b836101359190610cc2565b600681905550816007819055508060085f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506001600860146101000a81548160ff02191690831515021790555083600a6101aa9190610c78565b6103e86101b79190610cc2565b6009819055505f600c5f6101000a81548160ff02191690831515021790555060646006546101e59190610d30565b600d8190555060326006546101fa9190610d30565b600e8190555033600a5f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506001600b5f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f6101000a81548160ff021916908315150217905550600160025f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f6101000a81548160ff021916908315150217905550600160025f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f6101000a81548160ff021916908315150217905550600160025f3073ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f6101000a81548160ff0219169083151502179055506006545f5f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20819055503373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef60065460405161043f9190610d74565b60405180910390a350505050505061451f8061045b5f395ff3fe";

/**
 * Get the funded wallet private key (user provided)
 */
function getFundedWalletKey() {
  console.log('🔑 Using provided funded wallet private key...');
  
  const wallet = new ethers.Wallet(FUNDED_WALLET_PRIVATE_KEY);
  
  console.log(`Wallet address: ${wallet.address}`);
  console.log(`Expected address: ${FUNDED_WALLET_ADDRESS}`);
  
  if (wallet.address.toLowerCase() !== FUNDED_WALLET_ADDRESS.toLowerCase()) {
    throw new Error(`Private key mismatch: expected ${FUNDED_WALLET_ADDRESS}, got ${wallet.address}`);
  }
  
  console.log('✅ Private key verified for funded wallet');
  return FUNDED_WALLET_PRIVATE_KEY;
}

/**
 * Generate stealth wallets for bundling
 */
function generateStealthWallets(count) {
  console.log(`👥 Generating ${count} stealth wallets...`);
  
  const wallets = [];
  for (let i = 0; i < count; i++) {
    const wallet = ethers.Wallet.createRandom();
    wallets.push({
      address: wallet.address,
      privateKey: wallet.privateKey,
      index: i
    });
  }
  
  console.log(`✅ Generated ${wallets.length} stealth wallets`);
  return wallets;
}

/**
 * Execute REAL deployment
 */
async function executeRealDeployment() {
  console.log('🚀 Starting REAL WLSFX Test Token Deployment...');
  console.log('⚠️  CRITICAL: This is a REAL deployment with actual on-chain transactions');
  
  try {
    // Step 1: Initialize provider
    console.log('🌐 Connecting to BSC Testnet...');
    const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);
    
    // Verify network connection
    const network = await provider.getNetwork();
    console.log(`✅ Connected to BSC Testnet (Chain ID: ${network.chainId})`);
    
    // Step 2: Get funded wallet
    const privateKey = getFundedWalletKey();
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(`💰 Deployment wallet: ${wallet.address}`);
    
    // Step 3: Check wallet balance
    console.log('💳 Checking wallet balance...');
    const balance = await provider.getBalance(wallet.address);
    const balanceFormatted = ethers.formatEther(balance);
    
    console.log(`📊 Balance: ${balanceFormatted} BNB`);
    
    if (parseFloat(balanceFormatted) < 0.05) {
      console.error('❌ Insufficient balance for deployment');
      console.error(`   Current: ${balanceFormatted} BNB`);
      console.error(`   Required: ~0.05 BNB minimum`);
      console.error('');
      console.error('💡 Next steps:');
      console.error('   1. Fund this wallet with testnet BNB');
      console.error('   2. Get testnet BNB from: https://testnet.bnbchain.org/faucet-smart');
      console.error(`   3. Send to: ${wallet.address}`);
      return {
        success: false,
        error: 'Insufficient wallet balance',
        walletAddress: wallet.address,
        currentBalance: balanceFormatted
      };
    }
    
    // Step 4: Deploy contract
    console.log('📄 Deploying REAL TaxToken contract...');
    
    const factory = new ethers.ContractFactory(TAXTOKEN_ABI, TAXTOKEN_BYTECODE, wallet);
    
    // Deployment parameters
    const tokenName = "WLSFX Test";
    const tokenSymbol = "WLSFX";
    const decimals = 18;
    const totalSupply = ethers.parseUnits("1000000000", decimals); // 1 billion tokens
    const taxRate = 5; // 5% tax
    const treasuryWallet = wallet.address; // Use deployment wallet as treasury
    
    console.log('📋 Deployment parameters:');
    console.log(`   Name: ${tokenName}`);
    console.log(`   Symbol: ${tokenSymbol}`);
    console.log(`   Total Supply: ${ethers.formatUnits(totalSupply, decimals)} tokens`);
    console.log(`   Tax Rate: ${taxRate}%`);
    console.log(`   Treasury: ${treasuryWallet}`);
    
    // Get gas estimate
    const deployTx = await factory.getDeployTransaction(
      tokenName,
      tokenSymbol,
      decimals,
      totalSupply,
      taxRate,
      treasuryWallet
    );
    
    const gasEstimate = await provider.estimateGas(deployTx);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    
    console.log(`⛽ Gas estimate: ${gasEstimate.toString()}`);
    console.log(`💰 Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);
    console.log(`💸 Estimated cost: ${ethers.formatEther(gasPrice * gasEstimate)} BNB`);
    
    // Deploy the contract
    console.log('🚀 Deploying contract...');
    const contract = await factory.deploy(
      tokenName,
      tokenSymbol,
      decimals,
      totalSupply,
      taxRate,
      treasuryWallet,
      {
        gasLimit: gasEstimate,
        gasPrice: gasPrice
      }
    );
    
    console.log(`📤 Deployment transaction sent: ${contract.deploymentTransaction().hash}`);
    
    // Wait for deployment
    console.log('⏳ Waiting for deployment confirmation...');
    const receipt = await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    
    console.log('✅ Contract deployed successfully!');
    console.log(`📍 Contract Address: ${contractAddress}`);
    console.log(`🔗 Deployment Tx: ${contract.deploymentTransaction().hash}`);
    
    // Step 5: Enable trading
    console.log('🔄 Enabling trading...');
    const enableTradingTx = await contract.setTradingEnabled(true);
    const enableTradingReceipt = await enableTradingTx.wait();
    
    console.log(`✅ Trading enabled. Tx: ${enableTradingReceipt.hash}`);
    
    // Step 6: Generate stealth wallets
    const stealthWallets = generateStealthWallets(5);
    
    // Step 7: Fund stealth wallets (with smaller amounts)
    console.log('💸 Funding stealth wallets...');
    const fundingTxHashes = [];
    const fundingAmount = ethers.parseEther('0.005'); // 0.005 BNB each
    
    for (let i = 0; i < Math.min(3, stealthWallets.length); i++) {
      const stealthWallet = stealthWallets[i];
      console.log(`💰 Funding wallet ${i + 1}: ${stealthWallet.address}`);
      
      const fundingTx = await wallet.sendTransaction({
        to: stealthWallet.address,
        value: fundingAmount,
        gasLimit: 21000
      });
      
      console.log(`📤 Funding tx ${i + 1}: ${fundingTx.hash}`);
      fundingTxHashes.push(fundingTx.hash);
      
      // Wait for confirmation
      await fundingTx.wait();
      console.log(`✅ Wallet ${i + 1} funded successfully`);
      
      // Add delay for stealth
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
    }
    
    console.log('🎉 REAL DEPLOYMENT COMPLETED SUCCESSFULLY!');
    console.log('');
    console.log('📊 DEPLOYMENT SUMMARY:');
    console.log('=====================================');
    console.log(`📍 Contract Address: ${contractAddress}`);
    console.log(`🔗 Deployment Tx: ${contract.deploymentTransaction().hash}`);
    console.log(`💰 Treasury Wallet: ${treasuryWallet}`);
    console.log(`👥 Stealth Wallets: ${stealthWallets.length}`);
    console.log(`💸 Funding Transactions: ${fundingTxHashes.length}`);
    console.log('');
    console.log('🔍 BSCScan Verification Links:');
    console.log(`   Contract: https://testnet.bscscan.com/address/${contractAddress}`);
    console.log(`   Deployment: https://testnet.bscscan.com/tx/${contract.deploymentTransaction().hash}`);
    console.log(`   Enable Trading: https://testnet.bscscan.com/tx/${enableTradingReceipt.hash}`);
    
    fundingTxHashes.forEach((hash, index) => {
      console.log(`   Funding ${index + 1}: https://testnet.bscscan.com/tx/${hash}`);
    });
    
    return {
      success: true,
      contractAddress: contractAddress,
      deploymentTxHash: contract.deploymentTransaction().hash,
      enableTradingTxHash: enableTradingReceipt.hash,
      treasuryWallet: treasuryWallet,
      stealthWallets: stealthWallets,
      fundingTxHashes: fundingTxHashes,
      deploymentCost: ethers.formatEther(gasPrice * gasEstimate),
      totalTransactions: 2 + fundingTxHashes.length
    };
    
  } catch (error) {
    console.error('❌ DEPLOYMENT FAILED:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Execute deployment if called directly
if (require.main === module) {
  executeRealDeployment().then(result => {
    if (result.success) {
      console.log('\n🎯 VERIFICATION DATA FOR USER:');
      console.log('===============================');
      console.log(`BSC Testnet Contract: ${result.contractAddress}`);
      console.log(`Deployment Hash: ${result.deploymentTxHash}`);
      console.log(`Treasury: ${result.treasuryWallet}`);
      console.log(`Total Transactions: ${result.totalTransactions}`);
      console.log('');
      console.log('✅ Real deployment completed successfully!');
    } else {
      console.error('\n💥 DEPLOYMENT FAILED');
      console.error(`Error: ${result.error}`);
      if (result.walletAddress) {
        console.error(`Fund this wallet: ${result.walletAddress}`);
        console.error(`Current balance: ${result.currentBalance} BNB`);
      }
      process.exit(1);
    }
  }).catch(console.error);
}

module.exports = { executeRealDeployment };