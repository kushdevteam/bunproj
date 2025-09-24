# Overview

SolNox is a Rust-based Solana bundler application designed for handling Solana blockchain transactions and operations. The project includes both a Rust backend (currently experiencing compilation issues) and a fully functional Python mock server serving the frontend.

## Current Status
- **Frontend**: Fully functional HTML/CSS/JavaScript interface
- **Backend**: Python mock server providing all API endpoints 
- **Deployment**: Configured for production autoscaling
- **Port**: Running on port 5000 (as required by Replit)

## Recent Changes (September 24, 2025)
- Set up Python mock server to serve frontend while resolving Rust compilation issues
- Configured workflow for port 5000 with webview output
- Set up autoscale deployment configuration
- All API endpoints working through mock implementation

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Runtime Architecture
- **Async Runtime**: Built on Tokio for handling asynchronous operations, essential for blockchain network communication and concurrent transaction processing
- **Memory Management**: Uses Rust's ownership system with additional smart pointer types (bytes crate) for efficient memory handling of blockchain data

## Data Serialization Layer
- **JSON Processing**: Implements serde/serde_json for serializing and deserializing blockchain transaction data and API responses
- **Type Safety**: Leverages Rust's strong type system with derive macros for automatic serialization implementations

## Concurrency and Threading
- **Multi-threaded Runtime**: Tokio's multi-threaded scheduler for handling multiple blockchain operations simultaneously
- **Synchronization**: Uses parking_lot for efficient mutex implementations, likely for protecting shared state during transaction bundling

## Network Communication
- **Socket Operations**: socket2 and mio crates provide low-level network primitives for blockchain node communication
- **Async I/O**: Non-blocking network operations for maintaining persistent connections to Solana RPC endpoints

## Development Architecture
- **Modular Design**: Standard Rust project structure with cargo build system
- **Error Handling**: Rust's Result type system for robust error propagation in blockchain operations
- **Memory Safety**: Zero-cost abstractions with compile-time guarantees, crucial for financial applications

# External Dependencies

## Blockchain Integration
- **Solana Network**: Direct integration with Solana blockchain infrastructure for transaction submission and monitoring
- **RPC Endpoints**: Communication with Solana RPC nodes for transaction broadcasting and state queries

## Runtime Dependencies
- **Tokio Ecosystem**: Comprehensive async runtime with networking, filesystem, and process management capabilities
- **Serde Framework**: Industry-standard serialization for blockchain data interchange formats

## System Libraries
- **libc**: System-level operations and platform-specific functionality
- **Platform Networking**: Low-level socket operations for optimized blockchain communication

## Development Tools
- **Rust Toolchain**: Standard Rust compilation and dependency management through Cargo
- **Build Optimization**: Configured for both development and release builds with appropriate optimization levels