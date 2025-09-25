// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./TaxToken.sol";

/**
 * @title TaxTokenFactory - Factory for deploying tax-enabled tokens
 * @dev Factory contract for creating standardized tax tokens with configurable parameters
 * @notice Allows batch deployment of tax tokens with consistent configuration
 */
contract TaxTokenFactory {
    // Events
    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 totalSupply,
        uint256 taxRate,
        address treasuryWallet
    );
    
    event FactoryConfigUpdated(
        address indexed newOwner,
        uint256 newDefaultTaxRate,
        address newDefaultTreasury,
        uint256 newCreationFee
    );
    
    // Factory configuration
    address public owner;
    uint256 public defaultTaxRate; // Default tax rate for new tokens
    address public defaultTreasuryWallet; // Default treasury wallet
    uint256 public creationFee; // BNB fee for token creation
    bool public factoryEnabled;
    
    // Token tracking
    address[] public deployedTokens;
    mapping(address => bool) public isFactoryToken;
    mapping(address => address[]) public creatorTokens; // creator => token addresses
    
    // Access control
    mapping(address => bool) public isAuthorizedCreator;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "TaxTokenFactory: caller is not the owner");
        _;
    }
    
    modifier onlyAuthorizedCreator() {
        require(
            isAuthorizedCreator[msg.sender] || msg.sender == owner,
            "TaxTokenFactory: caller is not authorized creator"
        );
        _;
    }
    
    modifier factoryIsEnabled() {
        require(factoryEnabled, "TaxTokenFactory: factory is disabled");
        _;
    }
    
    /**
     * @dev Constructor for TaxTokenFactory
     */
    constructor(
        uint256 _defaultTaxRate,
        address _defaultTreasuryWallet,
        uint256 _creationFee
    ) {
        require(_defaultTreasuryWallet != address(0), "TaxTokenFactory: default treasury cannot be zero");
        require(_defaultTaxRate <= 20, "TaxTokenFactory: default tax rate cannot exceed 20%");
        
        owner = msg.sender;
        defaultTaxRate = _defaultTaxRate;
        defaultTreasuryWallet = _defaultTreasuryWallet;
        creationFee = _creationFee;
        factoryEnabled = true;
        
        // Owner is authorized by default
        isAuthorizedCreator[msg.sender] = true;
    }
    
    /**
     * @dev Create a new tax token with default configuration
     */
    function createTaxToken(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 totalSupply
    ) external payable factoryIsEnabled onlyAuthorizedCreator returns (address) {
        return _createTaxToken(
            name,
            symbol,
            decimals,
            totalSupply,
            defaultTaxRate,
            defaultTreasuryWallet
        );
    }
    
    /**
     * @dev Create a new tax token with custom configuration
     */
    function createCustomTaxToken(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 totalSupply,
        uint256 taxRate,
        address treasuryWallet
    ) external payable factoryIsEnabled onlyAuthorizedCreator returns (address) {
        require(treasuryWallet != address(0), "TaxTokenFactory: treasury cannot be zero");
        require(taxRate <= 20, "TaxTokenFactory: tax rate cannot exceed 20%");
        
        return _createTaxToken(
            name,
            symbol,
            decimals,
            totalSupply,
            taxRate,
            treasuryWallet
        );
    }
    
    /**
     * @dev Internal function to create tax token
     */
    function _createTaxToken(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 totalSupply,
        uint256 taxRate,
        address treasuryWallet
    ) internal returns (address) {
        require(msg.value >= creationFee, "TaxTokenFactory: insufficient creation fee");
        
        // Deploy new tax token
        TaxToken newToken = new TaxToken(
            name,
            symbol,
            decimals,
            totalSupply,
            taxRate,
            treasuryWallet
        );
        
        address tokenAddress = address(newToken);
        
        // Transfer ownership to creator
        newToken.transferOwnership(msg.sender);
        
        // Track the deployed token
        deployedTokens.push(tokenAddress);
        isFactoryToken[tokenAddress] = true;
        creatorTokens[msg.sender].push(tokenAddress);
        
        // Transfer creation fee to owner
        if (creationFee > 0) {
            payable(owner).transfer(creationFee);
        }
        
        // Refund excess payment
        if (msg.value > creationFee) {
            payable(msg.sender).transfer(msg.value - creationFee);
        }
        
        emit TokenCreated(
            tokenAddress,
            msg.sender,
            name,
            symbol,
            totalSupply,
            taxRate,
            treasuryWallet
        );
        
        return tokenAddress;
    }
    
    /**
     * @dev Batch create multiple tax tokens
     */
    function batchCreateTaxTokens(
        string[] memory names,
        string[] memory symbols,
        uint8[] memory decimalsArray,
        uint256[] memory totalSupplies,
        uint256[] memory taxRates,
        address[] memory treasuryWallets
    ) external payable factoryIsEnabled onlyAuthorizedCreator returns (address[] memory) {
        require(names.length == symbols.length, "TaxTokenFactory: arrays length mismatch");
        require(names.length == decimalsArray.length, "TaxTokenFactory: arrays length mismatch");
        require(names.length == totalSupplies.length, "TaxTokenFactory: arrays length mismatch");
        require(names.length == taxRates.length, "TaxTokenFactory: arrays length mismatch");
        require(names.length == treasuryWallets.length, "TaxTokenFactory: arrays length mismatch");
        
        uint256 totalFee = creationFee * names.length;
        require(msg.value >= totalFee, "TaxTokenFactory: insufficient total creation fee");
        
        address[] memory newTokens = new address[](names.length);
        
        for (uint256 i = 0; i < names.length; i++) {
            require(treasuryWallets[i] != address(0), "TaxTokenFactory: treasury cannot be zero");
            require(taxRates[i] <= 20, "TaxTokenFactory: tax rate cannot exceed 20%");
            
            TaxToken newToken = new TaxToken(
                names[i],
                symbols[i],
                decimalsArray[i],
                totalSupplies[i],
                taxRates[i],
                treasuryWallets[i]
            );
            
            address tokenAddress = address(newToken);
            newToken.transferOwnership(msg.sender);
            
            // Track the deployed token
            deployedTokens.push(tokenAddress);
            isFactoryToken[tokenAddress] = true;
            creatorTokens[msg.sender].push(tokenAddress);
            
            newTokens[i] = tokenAddress;
            
            emit TokenCreated(
                tokenAddress,
                msg.sender,
                names[i],
                symbols[i],
                totalSupplies[i],
                taxRates[i],
                treasuryWallets[i]
            );
        }
        
        // Transfer total fee to owner
        if (totalFee > 0) {
            payable(owner).transfer(totalFee);
        }
        
        // Refund excess payment
        if (msg.value > totalFee) {
            payable(msg.sender).transfer(msg.value - totalFee);
        }
        
        return newTokens;
    }
    
    // ===== CONFIGURATION FUNCTIONS =====
    
    /**
     * @dev Update factory configuration
     */
    function updateFactoryConfig(
        uint256 newDefaultTaxRate,
        address newDefaultTreasury,
        uint256 newCreationFee
    ) external onlyOwner {
        require(newDefaultTreasury != address(0), "TaxTokenFactory: treasury cannot be zero");
        require(newDefaultTaxRate <= 20, "TaxTokenFactory: tax rate cannot exceed 20%");
        
        defaultTaxRate = newDefaultTaxRate;
        defaultTreasuryWallet = newDefaultTreasury;
        creationFee = newCreationFee;
        
        emit FactoryConfigUpdated(owner, newDefaultTaxRate, newDefaultTreasury, newCreationFee);
    }
    
    /**
     * @dev Set factory enabled/disabled
     */
    function setFactoryEnabled(bool enabled) external onlyOwner {
        factoryEnabled = enabled;
    }
    
    /**
     * @dev Set authorized creator
     */
    function setAuthorizedCreator(address creator, bool authorized) external onlyOwner {
        require(creator != address(0), "TaxTokenFactory: creator cannot be zero");
        isAuthorizedCreator[creator] = authorized;
    }
    
    /**
     * @dev Bulk set authorized creators
     */
    function bulkSetAuthorizedCreators(address[] calldata creators, bool authorized) external onlyOwner {
        for (uint256 i = 0; i < creators.length; i++) {
            require(creators[i] != address(0), "TaxTokenFactory: creator cannot be zero");
            isAuthorizedCreator[creators[i]] = authorized;
        }
    }
    
    /**
     * @dev Transfer factory ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "TaxTokenFactory: new owner cannot be zero");
        owner = newOwner;
        isAuthorizedCreator[newOwner] = true;
    }
    
    // ===== VIEW FUNCTIONS =====
    
    /**
     * @dev Get total number of deployed tokens
     */
    function getDeployedTokensCount() external view returns (uint256) {
        return deployedTokens.length;
    }
    
    /**
     * @dev Get all deployed tokens
     */
    function getAllDeployedTokens() external view returns (address[] memory) {
        return deployedTokens;
    }
    
    /**
     * @dev Get tokens created by specific creator
     */
    function getCreatorTokens(address creator) external view returns (address[] memory) {
        return creatorTokens[creator];
    }
    
    /**
     * @dev Get token details for a deployed token
     */
    function getTokenDetails(address tokenAddress) external view returns (
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 totalSupply,
        uint256 taxRate,
        address treasury,
        bool taxEnabled,
        address tokenOwner
    ) {
        require(isFactoryToken[tokenAddress], "TaxTokenFactory: not a factory token");
        
        TaxToken token = TaxToken(tokenAddress);
        (uint256 rate, address treasuryAddr, bool enabled,) = token.getTaxConfig();
        
        return (
            token.name(),
            token.symbol(),
            token.decimals(),
            token.totalSupply(),
            rate,
            treasuryAddr,
            enabled,
            token.owner()
        );
    }
    
    /**
     * @dev Get factory configuration
     */
    function getFactoryConfig() external view returns (
        address factoryOwner,
        uint256 defTaxRate,
        address defTreasury,
        uint256 fee,
        bool enabled
    ) {
        return (
            owner,
            defaultTaxRate,
            defaultTreasuryWallet,
            creationFee,
            factoryEnabled
        );
    }
    
    // ===== EMERGENCY FUNCTIONS =====
    
    /**
     * @dev Emergency recover BNB
     */
    function emergencyRecoverBNB() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    /**
     * @dev Emergency recover tokens
     */
    function emergencyRecoverToken(address tokenAddress, uint256 amount) external onlyOwner {
        IBEP20(tokenAddress).transfer(owner, amount);
    }
    
    // Allow contract to receive BNB
    receive() external payable {}
}