# Optionix Documentation

**Optionix** is a comprehensive options trading and analytics platform that combines traditional finance with blockchain technology, providing advanced options pricing models, real-time market data, and AI-powered trading signals.

## Quick Start

Get started with Optionix in 3 simple steps:

1. **Install Dependencies**: `./scripts/setup_optionix_env.sh`
2. **Configure Environment**: Copy `.env.example` to `.env` and update settings
3. **Start the Platform**: `./scripts/run_optionix.sh`

## Documentation Index

### Getting Started

- [Installation Guide](INSTALLATION.md) - System requirements and installation steps
- [Quick Start Tutorial](USAGE.md) - Basic usage patterns and workflows
- [Configuration Guide](CONFIGURATION.md) - Environment variables and settings

### Features & APIs

- [Feature Matrix](FEATURE_MATRIX.md) - Complete feature overview with version support
- [API Reference](API.md) - RESTful API endpoints and parameters
- [CLI Reference](CLI.md) - Command-line interface documentation

### Advanced Topics

- [Architecture](architecture.md) - System design and component interactions
- [Examples](examples/) - Runnable code examples and tutorials
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions

### Contributing

- [Contributing Guide](CONTRIBUTING.md) - How to contribute to Optionix
- [Development Setup](CONTRIBUTING.md#development-setup) - Setup for contributors

## Key Features

| Category            | Features                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| **Options Trading** | Real-time options chain, multi-leg strategies, one-click execution        |
| **Analytics**       | Volatility surface, Greeks calculation, strategy payoff diagrams          |
| **AI/ML**           | Volatility prediction, mispricing detection, automated signals            |
| **Blockchain**      | Decentralized contracts, smart contract settlement, on-chain verification |
| **Security**        | MFA, RBAC, encryption at rest and in transit, audit logging               |
| **Compliance**      | KYC/AML, GDPR, SOC 2, PCI DSS, financial regulations                      |

## Platform Components

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web/Mobile    │────▶│   Backend API   │────▶│   AI Models     │
│    Frontend     │◀────│    (FastAPI)    │◀────│   (PyTorch)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ├──────▶ PostgreSQL + TimescaleDB
                               ├──────▶ Redis Cache
                               └──────▶ Blockchain (Ethereum)
```

## Technology Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy, Celery
- **Frontend**: React 18+, TypeScript, Redux Toolkit, TailwindCSS
- **Mobile**: React Native, Expo
- **AI/ML**: PyTorch, TensorFlow, scikit-learn, XGBoost
- **Blockchain**: Solidity, Web3.py, Chainlink oracles
- **Database**: PostgreSQL, TimescaleDB, Redis
- **Infrastructure**: Docker, Kubernetes, Terraform, Ansible

---

For detailed installation instructions, see [INSTALLATION.md](INSTALLATION.md).  
For usage examples, see [USAGE.md](USAGE.md) and [examples/](examples/).
