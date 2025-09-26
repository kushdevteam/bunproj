# JustJewIt Multi-Wallet Token Launcher

## Overview
A sophisticated multi-wallet token launcher and bundler application for BNB Smart Chain (BSC). This application enables users to create, manage, and coordinate multiple wallets for token launches with advanced features like stealth funding, transaction bundling, and analytics.

## Project Architecture

### Frontend (React/TypeScript)
- **Framework**: React 19.1.1 with TypeScript 5.9.2
- **Build Tool**: react-scripts 5.0.1
- **Port**: 5000 (configured for Replit environment)
- **State Management**: Zustand for state management
- **UI Features**: 
  - Wallet generation and management
  - Token launch configuration
  - Bundle execution monitoring
  - Analytics dashboard
  - Funding panel with distribution controls
  - Stealth funding capabilities

### Backend (Rust)
- **Framework**: Custom HTTP server using tiny_http
- **Port**: 8000
- **Database**: In-memory storage (development mode)
- **Features**:
  - RESTful API for wallet and token management
  - BNB Smart Chain integration
  - Tax collection system (5%)
  - Transaction monitoring
  - Draft and launch plan management

## Current Configuration

### Dependencies
- **Node.js**: v20 with npm package manager
- **React Dependencies**: Complete set including react-query, ethers, react-hook-form, zod
- **Rust Dependencies**: Minimal set with serde_json and tiny_http for stability

### Environment Setup
- **Development Host**: 0.0.0.0:5000 (frontend)
- **Backend Host**: localhost:8000
- **API Proxy**: Configured in package.json to proxy requests to backend
- **Host Check**: Disabled for Replit environment compatibility

### Deployment Configuration
- **Type**: VM deployment (required for persistent backend)
- **Build**: npm run build (React production build)
- **Runtime**: Combined serving of static React build + Rust backend

## Key Files and Structure

```
├── src/                     # React frontend source
│   ├── components/          # UI components organized by feature
│   ├── services/           # Business logic and API integration
│   ├── store/              # Zustand state management stores
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── simple_backend/         # Rust backend
│   └── src/main.rs        # HTTP server implementation
├── contracts/             # Smart contract artifacts and sources
├── public/               # Static assets
└── package.json          # Node.js dependencies and scripts
```

## Development Setup Notes
- **TypeScript Compatibility**: Using --legacy-peer-deps flag to resolve version conflicts between react-scripts 5.0.1 and TypeScript 5.9.2
- **ESLint Warnings**: Multiple unused variable warnings present but not blocking compilation
- **API Communication**: Frontend successfully connects to backend via proxy configuration

## Features Implemented
- Multi-wallet generation and management
- Token launch planning and configuration
- Bundle execution with real-time monitoring
- Analytics and performance tracking
- Stealth funding mechanisms
- Tax collection system integration
- BSC testnet and mainnet support
- Export functionality for wallet data

## Recent Setup (September 25, 2025)
- Successfully imported from GitHub
- Configured for Replit environment
- Both frontend and backend running and communicating
- Deployment configuration established
- All dependencies resolved and installed

## User Preferences
- Project imported from external GitHub repository
- Preference for maintaining existing architecture and dependencies
- Focus on getting the application running in Replit environment without major refactoring