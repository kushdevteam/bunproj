// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IBEP20.sol";

/**
 * @title ITaxToken - Interface for Tax-Enabled Tokens
 * @dev Extends BEP-20 with tax system functionality
 */
interface ITaxToken is IBEP20 {
    // Tax system events
    event TaxCollected(address indexed from, address indexed to, uint256 taxAmount, uint256 originalAmount);
    event TaxConfigUpdated(uint256 newRate, address newTreasury, bool enabled);
    event ExclusionUpdated(address indexed account, bool excluded);
    event TradingStatusUpdated(bool enabled);
    
    // Tax configuration functions
    function updateTaxConfig(uint256 newRate, address newTreasury, bool enabled) external;
    function setMinimumTaxAmount(uint256 amount) external;
    function setTaxExclusion(address account, bool excluded) external;
    function bulkSetTaxExclusion(address[] calldata accounts, bool excluded) external;
    
    // Tax query functions
    function isExcludedFromTax(address account) external view returns (bool);
    function calculateTaxAmount(uint256 amount, address from, address to) external view returns (uint256);
    function getTaxConfig() external view returns (uint256 rate, address treasury, bool enabled, uint256 minimumAmount);
    
    // Trading control functions
    function setTradingEnabled(bool enabled) external;
    function setMaxTransactionAmount(uint256 amount) external;
    function setMaxWalletAmount(uint256 amount) external;
    
    // Tax configuration view properties
    function taxRatePercent() external view returns (uint256);
    function treasuryWallet() external view returns (address);
    function taxEnabled() external view returns (bool);
    function minimumTaxAmount() external view returns (uint256);
    function tradingEnabled() external view returns (bool);
    function maxTransactionAmount() external view returns (uint256);
    function maxWalletAmount() external view returns (uint256);
}