/**
 * RoleSelector Component
 * Dropdown component for assigning wallet roles with validation
 * Supports dev, mev, funder, and numbered roles
 */

import React, { useState, useCallback } from 'react';
import { useWalletStore } from '../../store/wallets';
import { Role } from '../../types';
import type { Wallet } from '../../types';

interface RoleSelectorProps {
  wallet: Wallet;
  onRoleChange?: (walletId: string, newRole: Role) => void;
  disabled?: boolean;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ 
  wallet, 
  onRoleChange, 
  disabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const updateWallet = useWalletStore(state => state.updateWallet);

  const roleOptions = [
    { value: Role.DEV, label: 'Developer', icon: '👨‍💻', description: 'Development wallet for testing' },
    { value: Role.MEV, label: 'MEV Bot', icon: '🤖', description: 'MEV arbitrage operations' },
    { value: Role.FUNDER, label: 'Funder', icon: '💰', description: 'Provides funding to other wallets' },
    { value: Role.NUMBERED, label: 'Numbered', icon: '🔢', description: 'Standard numbered wallet' },
  ];

  const currentRole = roleOptions.find(option => option.value === wallet.role);

  const handleRoleSelect = useCallback(async (newRole: Role) => {
    if (newRole === wallet.role || isUpdating) return;

    setIsUpdating(true);
    setIsOpen(false);

    try {
      // Update wallet in store
      updateWallet(wallet.id, { role: newRole });
      
      // Notify parent component
      onRoleChange?.(wallet.id, newRole);
      
      // Add a brief delay to show the change
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error('Failed to update wallet role:', error);
      // Revert the change if it failed
      // In a real app, you'd show an error message
    } finally {
      setIsUpdating(false);
    }
  }, [wallet.role, wallet.id, isUpdating, updateWallet, onRoleChange]);

  const toggleDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen(prev => !prev);
    }
  }, [disabled]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const dropdown = target.closest('.role-selector');
      if (!dropdown) {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen, closeDropdown]);

  return (
    <div className={`role-selector ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}>
      <button
        className="role-trigger"
        onClick={toggleDropdown}
        disabled={disabled || isUpdating}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="role-display">
          <span className="role-icon">
            {isUpdating ? '⏳' : currentRole?.icon || '❓'}
          </span>
          <span className="role-label">
            {isUpdating ? 'Updating...' : currentRole?.label || 'Unknown'}
          </span>
          <span className="dropdown-arrow">
            {isOpen ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="role-dropdown">
          <div className="dropdown-header">
            <span>Select Role for Wallet</span>
            <small>{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</small>
          </div>
          
          <div className="role-options" role="listbox">
            {roleOptions.map((option) => (
              <button
                key={option.value}
                className={`role-option ${option.value === wallet.role ? 'selected' : ''}`}
                onClick={() => handleRoleSelect(option.value)}
                role="option"
                aria-selected={option.value === wallet.role}
              >
                <div className="option-content">
                  <div className="option-main">
                    <span className="option-icon">{option.icon}</span>
                    <span className="option-label">{option.label}</span>
                    {option.value === wallet.role && (
                      <span className="selected-indicator">✓</span>
                    )}
                  </div>
                  <div className="option-description">
                    <small>{option.description}</small>
                  </div>
                </div>
              </button>
            ))}
          </div>
          
          <div className="dropdown-footer">
            <small>Role determines wallet behavior and permissions</small>
          </div>
        </div>
      )}
    </div>
  );
};