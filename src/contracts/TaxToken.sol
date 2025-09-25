// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TaxToken - Fee-on-Transfer Token with Configurable Tax System
 * @dev BEP-20 compatible token with built-in 5% tax collection system
 * @notice Designed for BSC deployment with treasury tax collection
 */

interface IBEP20 {
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
    function name() external view returns (string memory);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract TaxToken is IBEP20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => bool) private _isExcludedFromTax;
    
    string private _name;
    string private _symbol;
    uint8 private _decimals;
    uint256 private _totalSupply;
    
    // Tax system configuration
    uint256 public taxRatePercent; // Tax rate in percentage (e.g., 5 for 5%)
    address public treasuryWallet; // Address to receive tax
    bool public taxEnabled;
    uint256 public minimumTaxAmount; // Minimum transfer amount to apply tax
    
    // Access control
    address public owner;
    mapping(address => bool) public isAuthorized;
    
    // Trading controls
    bool public tradingEnabled;
    uint256 public maxTransactionAmount;
    uint256 public maxWalletAmount;
    
    // Events
    event TaxCollected(address indexed from, address indexed to, uint256 taxAmount, uint256 originalAmount);
    event TaxConfigUpdated(uint256 newRate, address newTreasury, bool enabled);
    event ExclusionUpdated(address indexed account, bool excluded);
    event TradingStatusUpdated(bool enabled);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "TaxToken: caller is not the owner");
        _;
    }
    
    modifier onlyAuthorized() {
        require(msg.sender == owner || isAuthorized[msg.sender], "TaxToken: caller is not authorized");
        _;
    }
    
    /**
     * @dev Constructor for TaxToken
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param decimals_ Token decimals
     * @param totalSupply_ Total token supply
     * @param taxRate_ Initial tax rate percentage (e.g., 5 for 5%)
     * @param treasury_ Treasury wallet address for tax collection
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_,
        uint256 taxRate_,
        address treasury_
    ) {
        require(treasury_ != address(0), "TaxToken: treasury cannot be zero address");
        require(taxRate_ <= 20, "TaxToken: tax rate cannot exceed 20%");
        
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
        _totalSupply = totalSupply_ * 10**decimals_;
        
        // Tax configuration
        taxRatePercent = taxRate_;
        treasuryWallet = treasury_;
        taxEnabled = true;
        minimumTaxAmount = 1000 * 10**decimals_; // Default minimum 1000 tokens
        
        // Trading controls
        tradingEnabled = false; // Disabled by default
        maxTransactionAmount = _totalSupply / 100; // 1% of total supply
        maxWalletAmount = _totalSupply / 50; // 2% of total supply
        
        // Access control
        owner = msg.sender;
        isAuthorized[msg.sender] = true;
        
        // Exclude owner and treasury from tax
        _isExcludedFromTax[msg.sender] = true;
        _isExcludedFromTax[treasury_] = true;
        _isExcludedFromTax[address(this)] = true;
        
        // Mint total supply to owner
        _balances[msg.sender] = _totalSupply;
        emit Transfer(address(0), msg.sender, _totalSupply);
    }
    
    // ===== BEP-20 IMPLEMENTATION =====
    
    function name() public view override returns (string memory) {
        return _name;
    }
    
    function symbol() public view override returns (string memory) {
        return _symbol;
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }
    
    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }
    
    function transfer(address recipient, uint256 amount) public override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }
    
    function allowance(address owner_, address spender) public view override returns (uint256) {
        return _allowances[owner_][spender];
    }
    
    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
        uint256 currentAllowance = _allowances[sender][msg.sender];
        require(currentAllowance >= amount, "TaxToken: transfer amount exceeds allowance");
        
        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, currentAllowance - amount);
        
        return true;
    }
    
    // ===== TAX SYSTEM IMPLEMENTATION =====
    
    /**
     * @dev Internal transfer function with tax logic
     */
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "TaxToken: transfer from the zero address");
        require(to != address(0), "TaxToken: transfer to the zero address");
        require(_balances[from] >= amount, "TaxToken: transfer amount exceeds balance");
        
        // Check if trading is enabled (excludes owner and authorized addresses)
        if (!tradingEnabled && !isAuthorized[from] && !isAuthorized[to]) {
            require(from == owner || to == owner, "TaxToken: trading is not enabled");
        }
        
        // Check transaction limits (excludes owner and authorized addresses)
        if (!isAuthorized[from] && !isAuthorized[to]) {
            if (maxTransactionAmount > 0) {
                require(amount <= maxTransactionAmount, "TaxToken: transfer amount exceeds the maxTxAmount");
            }
            
            if (maxWalletAmount > 0 && to != treasuryWallet) {
                require(_balances[to] + amount <= maxWalletAmount, "TaxToken: transfer would exceed max wallet amount");
            }
        }
        
        uint256 transferAmount = amount;
        uint256 taxAmount = 0;
        
        // Calculate tax if enabled and conditions are met
        if (
            taxEnabled &&
            amount >= minimumTaxAmount &&
            !_isExcludedFromTax[from] &&
            !_isExcludedFromTax[to] &&
            treasuryWallet != address(0) &&
            taxRatePercent > 0
        ) {
            taxAmount = (amount * taxRatePercent) / 100;
            transferAmount = amount - taxAmount;
            
            // Transfer tax to treasury
            if (taxAmount > 0) {
                _balances[from] -= taxAmount;
                _balances[treasuryWallet] += taxAmount;
                emit Transfer(from, treasuryWallet, taxAmount);
                emit TaxCollected(from, to, taxAmount, amount);
            }
        }
        
        // Execute the main transfer
        _balances[from] -= transferAmount;
        _balances[to] += transferAmount;
        emit Transfer(from, to, transferAmount);
    }
    
    function _approve(address owner_, address spender, uint256 amount) internal {
        require(owner_ != address(0), "TaxToken: approve from the zero address");
        require(spender != address(0), "TaxToken: approve to the zero address");
        
        _allowances[owner_][spender] = amount;
        emit Approval(owner_, spender, amount);
    }
    
    // ===== TAX CONFIGURATION FUNCTIONS =====
    
    /**
     * @dev Update tax configuration
     */
    function updateTaxConfig(
        uint256 newRate,
        address newTreasury,
        bool enabled
    ) external onlyOwner {
        require(newRate <= 20, "TaxToken: tax rate cannot exceed 20%");
        require(newTreasury != address(0), "TaxToken: treasury cannot be zero address");
        
        taxRatePercent = newRate;
        treasuryWallet = newTreasury;
        taxEnabled = enabled;
        
        // Ensure new treasury is excluded from tax
        _isExcludedFromTax[newTreasury] = true;
        
        emit TaxConfigUpdated(newRate, newTreasury, enabled);
    }
    
    /**
     * @dev Set minimum tax amount threshold
     */
    function setMinimumTaxAmount(uint256 amount) external onlyOwner {
        minimumTaxAmount = amount;
    }
    
    /**
     * @dev Exclude or include account from tax
     */
    function setTaxExclusion(address account, bool excluded) external onlyOwner {
        require(account != address(0), "TaxToken: account cannot be zero address");
        _isExcludedFromTax[account] = excluded;
        emit ExclusionUpdated(account, excluded);
    }
    
    /**
     * @dev Bulk set tax exclusions
     */
    function bulkSetTaxExclusion(address[] calldata accounts, bool excluded) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != address(0), "TaxToken: account cannot be zero address");
            _isExcludedFromTax[accounts[i]] = excluded;
            emit ExclusionUpdated(accounts[i], excluded);
        }
    }
    
    /**
     * @dev Check if account is excluded from tax
     */
    function isExcludedFromTax(address account) external view returns (bool) {
        return _isExcludedFromTax[account];
    }
    
    // ===== TRADING CONTROLS =====
    
    /**
     * @dev Enable or disable trading
     */
    function setTradingEnabled(bool enabled) external onlyOwner {
        tradingEnabled = enabled;
        emit TradingStatusUpdated(enabled);
    }
    
    /**
     * @dev Set maximum transaction amount
     */
    function setMaxTransactionAmount(uint256 amount) external onlyOwner {
        maxTransactionAmount = amount;
    }
    
    /**
     * @dev Set maximum wallet amount
     */
    function setMaxWalletAmount(uint256 amount) external onlyOwner {
        maxWalletAmount = amount;
    }
    
    // ===== ACCESS CONTROL =====
    
    /**
     * @dev Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "TaxToken: new owner is the zero address");
        address oldOwner = owner;
        owner = newOwner;
        isAuthorized[newOwner] = true;
        _isExcludedFromTax[newOwner] = true;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    /**
     * @dev Set authorized address (can bypass trading restrictions)
     */
    function setAuthorized(address account, bool authorized) external onlyOwner {
        require(account != address(0), "TaxToken: account cannot be zero address");
        isAuthorized[account] = authorized;
    }
    
    // ===== UTILITY FUNCTIONS =====
    
    /**
     * @dev Calculate tax amount for a given transfer amount
     */
    function calculateTaxAmount(uint256 amount, address from, address to) external view returns (uint256) {
        if (
            !taxEnabled ||
            amount < minimumTaxAmount ||
            _isExcludedFromTax[from] ||
            _isExcludedFromTax[to] ||
            treasuryWallet == address(0) ||
            taxRatePercent == 0
        ) {
            return 0;
        }
        
        return (amount * taxRatePercent) / 100;
    }
    
    /**
     * @dev Get current tax configuration
     */
    function getTaxConfig() external view returns (
        uint256 rate,
        address treasury,
        bool enabled,
        uint256 minimumAmount
    ) {
        return (taxRatePercent, treasuryWallet, taxEnabled, minimumTaxAmount);
    }
    
    /**
     * @dev Emergency function to recover stuck tokens (only owner)
     */
    function emergencyRecoverToken(address tokenAddress, uint256 amount) external onlyOwner {
        require(tokenAddress != address(this), "TaxToken: cannot recover own tokens");
        IBEP20(tokenAddress).transfer(owner, amount);
    }
    
    /**
     * @dev Emergency function to recover BNB (only owner)
     */
    function emergencyRecoverBNB() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    // Allow contract to receive BNB
    receive() external payable {}
}