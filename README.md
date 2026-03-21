# Optionix

![CI/CD Status](https://img.shields.io/github/actions/workflow/status/quantsingularity/Optionix/cicd.yml?branch=main&label=CI/CD&logo=github)
[![Test Coverage](https://img.shields.io/badge/coverage-81%25-brightgreen)](https://github.com/quantsingularity/Optionix/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Options Trading & Analytics Platform

Optionix is a comprehensive options trading and analytics platform that combines traditional finance with blockchain technology. The platform provides advanced options pricing models, real-time market data, and AI-powered trading signals to help traders make informed decisions.

<div align="center">
  <img src="docs/images/Optionix_dashboard.bmp" alt="Optionix Trading Dashboard" width="80%">
</div>

> **Note**: This project is under active development. Features and functionalities are continuously being enhanced to improve user experience and trading capabilities.

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Security and Compliance](#security-and-compliance)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Overview

Optionix is a next-generation options trading platform that leverages advanced algorithms, machine learning, and blockchain technology to provide traders with powerful tools for options analysis and trading.

## Project Structure

The project is organized into several main components:

```
Optionix/
├── code/                   # Core backend logic, services, and shared utilities
├── docs/                   # Project documentation
├── infrastructure/         # DevOps, deployment, and infra-related code
├── mobile-frontend/        # Mobile application
├── web-frontend/           # Web dashboard
├── scripts/                # Automation, setup, and utility scripts
├── LICENSE                 # License information
├── README.md               # Project overview and instructions
└── tools/                  # Formatter configs, linting tools, and dev utilities
```

## Features

### Options Trading

| Feature                        | Description                                                |
| :----------------------------- | :--------------------------------------------------------- |
| **Real-time Options Chain**    | Access to up-to-the-second options chain data              |
| **Multi-leg Strategy Builder** | Tool for constructing complex multi-leg options strategies |
| **One-click Trade Execution**  | Streamlined process for rapid trade execution              |
| **Position Tracking**          | Detailed tracking and P&L analysis of current positions    |
| **Historical Performance**     | Metrics and analysis of past trading performance           |

### Analytics

| Feature                      | Description                                                                      |
| :--------------------------- | :------------------------------------------------------------------------------- |
| **Volatility Surface**       | Visualization of the volatility surface                                          |
| **Greeks Calculation**       | Calculation and visualization of options Greeks (Delta, Gamma, Theta, Vega, Rho) |
| **Implied Volatility**       | In-depth analysis of implied volatility                                          |
| **Strategy Payoff Diagrams** | Visual representation of options strategy payoff profiles                        |
| **Risk/Reward Ratios**       | Calculations for risk and reward ratios                                          |

### AI Features

| Feature                       | Description                                              |
| :---------------------------- | :------------------------------------------------------- |
| **Volatility Prediction**     | Models for forecasting future market volatility          |
| **Mispricing Detection**      | Algorithms to identify options that may be mispriced     |
| **Market Sentiment**          | Analysis of market sentiment from various data sources   |
| **Automated Trading Signals** | AI-generated signals for potential trading opportunities |
| **Personalized Strategy**     | Tailored recommendations for trading strategies          |

### Blockchain Integration

| Feature                           | Description                                                     |
| :-------------------------------- | :-------------------------------------------------------------- |
| **Decentralized Contracts**       | Implementation of decentralized options contracts               |
| **Smart Contract Settlement**     | Automated and secure trade settlement via smart contracts       |
| **On-chain Verification**         | Transparent verification of options positions on the blockchain |
| **Cross-chain Collateralization** | Support for using assets from different chains as collateral    |
| **Transparent History**           | Immutable and transparent transaction history                   |

## Architecture

Optionix is built on a robust, microservices-based architecture designed for high performance, scalability, and financial-grade security.

### Core Components

| Component            | Description                                                                                               |
| :------------------- | :-------------------------------------------------------------------------------------------------------- |
| **Backend Services** | Core business logic, options pricing, AI models, and data processing. Built with Python/Rust and FastAPI. |
| **Web Frontend**     | Primary user interface for trading and analytics, built with React and TypeScript.                        |
| **Mobile Frontend**  | Native mobile application for on-the-go access, built with React Native.                                  |
| **Blockchain Layer** | Smart contracts (Solidity) for decentralized options and on-chain verification.                           |
| **Infrastructure**   | Managed by Kubernetes, Terraform, and Ansible for reliable, scalable deployment.                          |

## Technology Stack

### Backend

| Component         | Technologies                                       |
| :---------------- | :------------------------------------------------- |
| **Language**      | Python, Rust (for performance-critical components) |
| **Framework**     | FastAPI                                            |
| **Database**      | PostgreSQL, TimescaleDB (for time-series data)     |
| **Caching**       | Redis                                              |
| **Message Queue** | RabbitMQ                                           |
| **ML Framework**  | PyTorch, scikit-learn                              |
| **Blockchain**    | Ethereum, Solidity                                 |

### Web Frontend

| Component              | Technologies                   |
| :--------------------- | :----------------------------- |
| **Framework**          | React with TypeScript          |
| **State Management**   | Redux Toolkit                  |
| **Styling**            | Styled Components, TailwindCSS |
| **Data Visualization** | D3.js, TradingView Charts      |
| **Web3**               | ethers.js                      |

### Mobile Frontend

| Component            | Technologies       |
| :------------------- | :----------------- |
| **Framework**        | React Native       |
| **State Management** | Redux Toolkit      |
| **Navigation**       | React Navigation   |
| **UI Components**    | React Native Paper |
| **Charts**           | Victory Native     |

### Infrastructure

| Component            | Technologies        |
| :------------------- | :------------------ |
| **Containerization** | Docker              |
| **Orchestration**    | Kubernetes          |
| **CI/CD**            | GitHub Actions      |
| **Monitoring**       | Prometheus, Grafana |
| **Logging**          | ELK Stack           |

## Security and Compliance

The infrastructure is designed to meet stringent financial industry standards, including principles from **PCI DSS**, **SOC 2**, **GDPR**, **NIST Cybersecurity Framework**, and **ISO 27001**.

### Key Security Measures

| Category              | Measure                                        | Description                                                                                                    |
| :-------------------- | :--------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| **Network Security**  | Micro-segmentation, IDPS, DDoS Protection, WAF | Granular network policies and perimeter defense to limit attack surface.                                       |
| **Data Security**     | Encryption at Rest and in Transit, DLP         | All sensitive data is encrypted, and Data Loss Prevention is implemented.                                      |
| **Endpoint Security** | Continuous Vulnerability Management            | Regular scanning and patching for all servers, containers, and applications.                                   |
| **IAM**               | Least Privilege, MFA, RBAC                     | Strict access controls, Multi-Factor Authentication, and Role-Based Access Control for all users and services. |

### Key Compliance Features

| Category          | Feature                                     | Description                                                                                                 |
| :---------------- | :------------------------------------------ | :---------------------------------------------------------------------------------------------------------- |
| **Auditing**      | Centralized Logging, Comprehensive Auditing | Immutable logs and detailed audit trails for all administrative and data access actions.                    |
| **Resilience**    | Disaster Recovery (DR) and BC Plan          | Regularly tested plans for continuous operation and rapid recovery from major outages.                      |
| **Configuration** | Version Control, Automated Drift Detection  | All infrastructure as code (IaC) is version-controlled with automated tools to prevent configuration drift. |
| **Assessment**    | Regular Security and Compliance Audits      | Periodic internal and external assessments, penetration testing, and vulnerability assessments.             |

## Getting Started

### Backend Setup

| Step                     | Command/Action                               |
| :----------------------- | :------------------------------------------- |
| **Navigate**             | `cd code/backend`                            |
| **Install Dependencies** | `pip install -r requirements.txt`            |
| **Start Server**         | `uvicorn app:app --host 0.0.0.0 --port 8000` |

### Frontend Setup

| Step                     | Command/Action     |
| :----------------------- | :----------------- |
| **Navigate**             | `cd code/frontend` |
| **Install Dependencies** | `npm install`      |
| **Start Dev Server**     | `npm start`        |
| **Build Production**     | `npm run build`    |

For a quick setup of the entire application:

```bash
# Clone the repository
git clone https://github.com/quantsingularity/Optionix.git
cd Optionix

# Run the setup script
./setup_optionix_env.sh

# Start the application
./run_optionix.sh
```

## Testing

The project maintains comprehensive test coverage across all components to ensure reliability and accuracy.

### Test Coverage

| Component              | Coverage | Status |
| :--------------------- | :------- | :----- |
| Backend API            | 85%      | ✅     |
| Options Pricing Engine | 90%      | ✅     |
| Frontend Components    | 78%      | ✅     |
| Blockchain Integration | 75%      | ✅     |
| AI Models              | 77%      | ✅     |
| Overall                | 81%      | ✅     |

### Backend Testing

| Test Type             | Description                    |
| :-------------------- | :----------------------------- |
| **Unit Tests**        | For API endpoints using pytest |
| **Integration Tests** | For blockchain interaction     |
| **Performance Tests** | For options pricing algorithms |

### Frontend Testing

| Test Type            | Description                      |
| :------------------- | :------------------------------- |
| **Component Tests**  | Using React Testing Library      |
| **End-to-end Tests** | With Cypress                     |
| **State Management** | Tests for state management logic |

### AI Model Testing

| Test Type                    | Description                       |
| :--------------------------- | :-------------------------------- |
| **Accuracy Validation**      | Validation of model accuracy      |
| **Backtesting**              | Against historical data           |
| **Performance Benchmarking** | Benchmarking of model performance |

To run tests:

```bash
# Backend tests
cd code/backend
pytest

# Frontend tests
cd code/frontend
npm test

# AI model tests
cd code/ai_models
python -m unittest discover

# Run all tests with the convenience script
./test_backend.sh
```

## CI/CD Pipeline

Optionix uses GitHub Actions for continuous integration and deployment:

| Stage                | Control Area                    | Institutional-Grade Detail                                                              |
| :------------------- | :------------------------------ | :-------------------------------------------------------------------------------------- |
| **Formatting Check** | Change Triggers                 | Enforced on all `push` and `pull_request` events to `main` and `develop`                |
|                      | Manual Oversight                | On-demand execution via controlled `workflow_dispatch`                                  |
|                      | Source Integrity                | Full repository checkout with complete Git history for auditability                     |
|                      | Python Runtime Standardization  | Python 3.10 with deterministic dependency caching                                       |
|                      | Backend Code Hygiene            | `autoflake` to detect unused imports/variables using non-mutating diff-based validation |
|                      | Backend Style Compliance        | `black --check` to enforce institutional formatting standards                           |
|                      | Non-Intrusive Validation        | Temporary workspace comparison to prevent unauthorized source modification              |
|                      | Node.js Runtime Control         | Node.js 18 with locked dependency installation via `npm ci`                             |
|                      | Web Frontend Formatting Control | Prettier checks for web-facing assets                                                   |
|                      | Mobile Frontend Formatting      | Prettier enforcement for mobile application codebases                                   |
|                      | Documentation Governance        | Repository-wide Markdown formatting enforcement                                         |
|                      | Infrastructure Configuration    | Prettier validation for YAML/YML infrastructure definitions                             |
|                      | Compliance Gate                 | Any formatting deviation fails the pipeline and blocks merge                            |

## Documentation

| Document                    | Path                 | Description                                                    |
| :-------------------------- | :------------------- | :------------------------------------------------------------- |
| **README**                  | `README.md`          | High-level overview, project scope, and repository entry point |
| **Installation Guide**      | `INSTALLATION.md`    | Step-by-step installation and environment setup                |
| **API Reference**           | `API.md`             | Detailed documentation for all API endpoints                   |
| **CLI Reference**           | `CLI.md`             | Command-line interface usage, commands, and examples           |
| **User Guide**              | `USAGE.md`           | Comprehensive end-user guide, workflows, and examples          |
| **Architecture Overview**   | `ARCHITECTURE.md`    | System architecture, components, and design rationale          |
| **Configuration Guide**     | `CONFIGURATION.md`   | Configuration options, environment variables, and tuning       |
| **Feature Matrix**          | `FEATURE_MATRIX.md`  | Feature coverage, capabilities, and roadmap alignment          |
| **Contributing Guidelines** | `CONTRIBUTING.md`    | Contribution workflow, coding standards, and PR requirements   |
| **Troubleshooting**         | `TROUBLESHOOTING.md` | Common issues, diagnostics, and remediation steps              |

## Contributing

| Step             | Command/Action                                                         |
| :--------------- | :--------------------------------------------------------------------- |
| **Fork**         | Fork the repository                                                    |
| **Branch**       | Create your feature branch (`git checkout -b feature/amazing-feature`) |
| **Commit**       | Commit your changes (`git commit -m 'Add some amazing feature'`)       |
| **Push**         | Push to the branch (`git push origin feature/amazing-feature`)         |
| **Pull Request** | Open a Pull Request                                                    |

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
