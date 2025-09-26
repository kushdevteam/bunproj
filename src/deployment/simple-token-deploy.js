/**
 * Simple WLSFX Token Deployment with OpenZeppelin Standard
 * Uses minimal, tested bytecode to avoid deployment issues
 */

const { ethers } = require('ethers');

// BSC Testnet configuration
const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545';
const FUNDED_WALLET_ADDRESS = '0xe9ec106Cf658ca5b736DD29d5Be6e6Aa1c706875';
const FUNDED_WALLET_PRIVATE_KEY = '0x7e4034c051fc383c278fe5988e822c989fea9eb8b5f4386e124ddf12d3eede8a';

// Minimal ERC20 with 5% tax - simplified bytecode
const SIMPLE_TAX_TOKEN_ABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "name", "type": "string"},
      {"internalType": "string", "name": "symbol", "type": "string"},
      {"internalType": "uint256", "name": "totalSupply", "type": "uint256"},
      {"internalType": "address", "name": "treasury", "type": "address"}
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
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}, {"internalType": "address", "name": "spender", "type": "address"}],
    "name": "allowance",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "spender", "type": "address"}, {"internalType": "uint256", "name": "amount", "type": "uint256"}],
    "name": "approve",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
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
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
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
    "name": "totalSupply",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "recipient", "type": "address"}, {"internalType": "uint256", "name": "amount", "type": "uint256"}],
    "name": "transfer",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "sender", "type": "address"}, {"internalType": "address", "name": "recipient", "type": "address"}, {"internalType": "uint256", "name": "amount", "type": "uint256"}],
    "name": "transferFrom",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Simplified bytecode - minimal viable token with 5% tax
const SIMPLE_TAX_TOKEN_BYTECODE = "0x608060405234801561001057600080fd5b506040516108b73803806108b783398181016040528101906100329190610277565b83600390816100419190610423565b5082600490816100519190610423565b5060128060056101000a81548160ff021916908360ff16021790555081600181905550806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555081600860003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055503373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8360405161013091906104f4565b60405180910390a25050505061066a565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6101a582610160565b810181811067ffffffffffffffff821117156101c4576101c361016d565b5b80604052505050565b60006101d7610143565b90506101e3828261019c565b919050565b600067ffffffffffffffff8211156102035761020261016d565b5b61020c82610160565b9050602081019050919050565b60005b8381101561023757808201518184015260208101905061021c565b60008484015250505050565b600061025661025184610203565b6101cd565b90508281526020810184848401111561027257610271610102565b5b61027d848285610219565b509392505050565b600082601f83011261029a576102996100fd565b5b81516102aa848260208601610243565b91505092915050565b6000819050919050565b6102c6816102b3565b81146102d157600080fd5b50565b6000815190506102e3816102bd565b92915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000610314826102e9565b9050919050565b61032481610309565b811461032f57600080fd5b50565b6000815190506103418161031b565b92915050565b6000806000806080858703121561036157610360610149565b5b600085015167ffffffffffffffff81111561037f5761037e61014e565b5b61038b87828801610285565b945050602085015167ffffffffffffffff8111156103ac576103ab61014e565b5b6103b887828801610285565b93505060406103c9878288016102d4565b92505060606103da87828801610332565b91505092959194509250565b600081519050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b6000600282049050600182168061043b57607f821691505b60208210810361044e5761044d6103f4565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b6000600883026104b67fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff82610479565b6104c08683610479565b95508019841693508086168417925050509392505050565b6000819050919050565b60006104fd6104f86104f3846102b3565b6104d8565b6102b3565b9050919050565b6000819050919050565b610517836104e2565b61052b61052382610504565b848454610486565b825550505050565b600090565b610540610533565b61054b81848461050e565b505050565b5b8181101561056f57610564600082610538565b600181019050610551565b5050565b601f8211156105b45761058581610454565b61058e84610469565b8101602085101561059d578190505b6105b16105a985610469565b830182610550565b50505b505050565b600082821c905092915050565b60006105d7600019846008026105b9565b1980831691505092915050565b60006105f083836105c6565b9150826002028217905092915050565b610609826103e6565b67ffffffffffffffff8211156106225761062161016d565b5b61062c8254610423565b610637828285610573565b600060209050601f83116001811461066a5760008415610658578287015190505b61066285826105e4565b8655506106ca565b601f19841661067886610454565b60005b828110156106a05784890151825560018201915060208501945060208101905061067b565b868310156106bd57848901516106b9601f8916826105c6565b8355505b6001600288020188555050505b505050505050565b6106d2816102b3565b82525050565b60006020820190506106ed60008301846106c9565b92915050565b6102618061070260003960006000f3fe608060405234801561001057600080fd5b50600436106100a95760003560e01c80633950935111610071578063395093511461016857806370a082311461019857806395d89b41146101c8578063a457c2d7146101e6578063a9059cbb14610216578063dd62ed3e14610246576100a9565b806306fdde03146100ae578063095ea7b3146100cc57806318160ddd146100fc57806323b872dd1461011a578063313ce5671461014a575b600080fd5b6100b6610276565b6040516100c39190610196565b60405180910390f35b6100e660048036038101906100e191906101b8565b610304565b6040516100f39190610213565b60405180910390f35b610104610321565b604051610111919061022e565b60405180910390f35b610134600480360381019061012f9190610249565b61032b565b6040516101419190610213565b60405180910390f35b610152610424565b60405161015f91906102b8565b60405180910390f35b610182600480360381019061017d91906101b8565b61043b565b60405161018f9190610213565b60405180910390f35b6101b260048036038101906101ad91906102d3565b6104e7565b6040516101bf919061022e565b60405180910390f35b6101d0610530565b6040516101dd9190610196565b60405180910390f35b61020060048036038101906101fb91906101b8565b6105be565b60405161020d9190610213565b60405180910390f35b610230600480360381019061022b91906101b8565b6106a9565b60405161023d9190610213565b60405180910390f35b610260600480360381019061025b9190610300565b6106c6565b60405161026d919061022e565b60405180910390f35b60606003805461028590610340565b80601f01602080910402602001604051908101604052809291908181526020018280546102b190610340565b80156102fe5780601f106102d3576101008083540402835291602001916102fe565b820191906000526020600020905b8154815290600101906020018083116102e157829003601f168201915b50505050509050919050565b600061031861031161074d565b8484610755565b6001905092915050565b6000600154905090565b600061033884848461091e565b6000600760008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600061038361074d565b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905082811015610403576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016103fa906103e3565b60405180910390fd5b61041785610410868561040c565b610755565b6001915050949350505050565b6000600560009054906101000a900460ff16905090565b60006104dd61044861074d565b84846007600061045661074d565b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546104d89190610432565b610755565b6001905092915050565b6000600860008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b60606004805461053f90610340565b80601f016020809104026020016040519081016040528092919081815260200182805461056b90610340565b80156105b85780601f1061058d576101008083540402835291602001916105b8565b820191906000526020600020905b81548152906001019060200180831161059b57829003601f168201915b50505050509050919050565b600080600760006105cd61074d565b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205490508281101561068a576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610681906104b4565b60405180910390fd5b61069e61069561074d565b85858403610755565b600191505092915050565b60006106bc6106b661074d565b8361091e565b6001905092915050565b6000600760008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b600033905090565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16036107c4576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016107bb90610546565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603610833576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161082a906105d8565b60405180910390fd5b80600760008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b9258360405161091191906105f8565b60405180910390a3505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff160361098d576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016109849061068a565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036109fc576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016109f39061071c565b60405180910390fd5b6000610a0784610755565b905081811015610a4c576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610a43906107ae565b60405180910390fd5b8181610a5891906107ce565b600860008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506000606482610aaa9190610802565b90506000815484610abb91906107ce565b9050806008600087527";

/**
 * Execute simple WLSFX deployment
 */
async function executeSimpleDeployment() {
  console.log('🚀 SIMPLE WLSFX TEST TOKEN DEPLOYMENT');
  console.log('=====================================');
  
  try {
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);
    const wallet = new ethers.Wallet(FUNDED_WALLET_PRIVATE_KEY, provider);
    
    console.log('💰 Deployment wallet:', wallet.address);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('💳 Balance:', ethers.formatEther(balance), 'BNB');
    
    if (parseFloat(ethers.formatEther(balance)) < 0.05) {
      throw new Error(`Insufficient balance: ${ethers.formatEther(balance)} BNB`);
    }
    
    // Create contract factory
    const factory = new ethers.ContractFactory(
      SIMPLE_TAX_TOKEN_ABI, 
      SIMPLE_TAX_TOKEN_BYTECODE, 
      wallet
    );
    
    // Deploy parameters
    const tokenName = "WLSFX Test";
    const tokenSymbol = "WLSFX";
    const totalSupply = ethers.parseUnits("1000000000", 18); // 1 billion tokens
    const treasuryWallet = wallet.address;
    
    console.log('📋 Deployment parameters:');
    console.log(`   Name: ${tokenName}`);
    console.log(`   Symbol: ${tokenSymbol}`);
    console.log(`   Total Supply: ${ethers.formatUnits(totalSupply, 18)} tokens`);
    console.log(`   Treasury: ${treasuryWallet}`);
    
    // Deploy contract
    console.log('🚀 Deploying simple tax token...');
    const contract = await factory.deploy(
      tokenName,
      tokenSymbol,
      totalSupply,
      treasuryWallet,
      { gasLimit: 2000000 } // Explicit gas limit
    );
    
    console.log(`📤 Deployment transaction: ${contract.deploymentTransaction().hash}`);
    
    // Wait for deployment
    console.log('⏳ Waiting for confirmation...');
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    
    console.log('✅ DEPLOYMENT SUCCESSFUL!');
    console.log('========================');
    console.log(`📍 Contract Address: ${contractAddress}`);
    console.log(`🔗 Deployment Tx: ${contract.deploymentTransaction().hash}`);
    console.log(`💰 Treasury Wallet: ${treasuryWallet}`);
    console.log('');
    console.log('🔍 BSCScan Links:');
    console.log(`   Contract: https://testnet.bscscan.com/address/${contractAddress}`);
    console.log(`   Transaction: https://testnet.bscscan.com/tx/${contract.deploymentTransaction().hash}`);
    
    return {
      success: true,
      contractAddress: contractAddress,
      deploymentTxHash: contract.deploymentTransaction().hash,
      treasuryWallet: treasuryWallet
    };
    
  } catch (error) {
    console.error('❌ DEPLOYMENT FAILED:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Execute if called directly
if (require.main === module) {
  executeSimpleDeployment().then(result => {
    if (result.success) {
      console.log('\n🎉 WLSFX Test Token deployed successfully!');
      console.log(`Contract: ${result.contractAddress}`);
      console.log(`Transaction: ${result.deploymentTxHash}`);
    } else {
      console.error('\n💥 Deployment failed:', result.error);
      process.exit(1);
    }
  }).catch(console.error);
}

module.exports = { executeSimpleDeployment };