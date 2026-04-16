# Contributing to Optionix

Thank you for your interest in contributing to Optionix! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Documentation](#documentation)
- [Security](#security)

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone.

### Our Standards

- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Accepting constructive criticism gracefully
- Focusing on what is best for the community

## Getting Started

1. **Fork the Repository**

   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/quantsingularity/Optionix.git
   cd Optionix
   ```

2. **Add Upstream Remote**

   ```bash
   git remote add upstream https://github.com/quantsingularity/Optionix.git
   ```

3. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 16+
- PostgreSQL 13+
- Redis 6+
- Git

### Environment Setup

```bash
# Run automated setup
./scripts/setup_optionix_env.sh

# Or manual setup
python3 -m venv venv
source venv/bin/activate
pip install -r code/requirements.txt
pip install -r code/requirements-dev.txt  # Development dependencies

# Frontend
cd web-frontend
npm install
```

### Configuration

```bash
# Copy example env file
cp .env.example .env

# Edit with your settings
nano .env
```

## Development Workflow

### 1. Sync with Upstream

```bash
git fetch upstream
git rebase upstream/main
```

### 2. Make Changes

- Write clear, concise commit messages
- Keep commits atomic (one logical change per commit)
- Follow existing code patterns

### 3. Test Your Changes

```bash
# Backend tests
cd code/backend
pytest

# Frontend tests
cd web-frontend
npm test

# Run all tests
./scripts/comprehensive_test.sh
```

### 4. Check Code Quality

```bash
# Run linters
./scripts/lint-all.sh --fix

# Or individually
cd code/backend
black .
flake8 .
mypy .

cd web-frontend
npm run lint:fix
```

## Code Style

### Python Code Style

**Follow PEP 8** with these specifics:

- **Line Length**: 88 characters (Black default)
- **Imports**: Organized by `isort`
- **Docstrings**: Google style
- **Type Hints**: Required for all functions

**Example**:

```python
from typing import Optional

def calculate_option_price(
    spot_price: float,
    strike_price: float,
    volatility: float,
    time_to_expiry: float,
) -> float:
    """
    Calculate Black-Scholes option price.

    Args:
        spot_price: Current price of underlying asset
        strike_price: Option strike price
        volatility: Implied volatility (annual)
        time_to_expiry: Time to expiration (years)

    Returns:
        Option price in dollars

    Raises:
        ValueError: If any parameter is negative
    """
    if spot_price <= 0:
        raise ValueError("Spot price must be positive")

    # Implementation here
    return price
```

### TypeScript/JavaScript Code Style

**Follow Airbnb Style Guide** with these additions:

- **Functional Components**: Use React hooks
- **Type Safety**: Explicit types, no `any`
- **Props**: Interface or type definition required

**Example**:

```typescript
interface OptionPriceProps {
  spotPrice: number;
  strikePrice: number;
  volatility: number;
  onCalculate: (price: number) => void;
}

export const OptionPriceCalculator: React.FC<OptionPriceProps> = ({
  spotPrice,
  strikePrice,
  volatility,
  onCalculate,
}) => {
  const [result, setResult] = useState<number | null>(null);

  const handleCalculate = useCallback(() => {
    const price = calculatePrice(spotPrice, strikePrice, volatility);
    setResult(price);
    onCalculate(price);
  }, [spotPrice, strikePrice, volatility, onCalculate]);

  return (
    <div className="option-calculator">
      {/* Component JSX */}
    </div>
  );
};
```

### Solidity Code Style

- **Version**: Solidity 0.8.19+
- **Style**: Follow Solidity Style Guide
- **NatSpec**: Required for all public functions

**Example**:

```solidity
/**
 * @notice Creates a new options contract
 * @param optionType Type of option (call or put)
 * @param strikePrice Strike price in wei
 * @param expirationTime Unix timestamp of expiration
 * @return optionId The ID of the newly created option
 */
function createOption(
  OptionType optionType,
  uint256 strikePrice,
  uint256 expirationTime
) external returns (uint256 optionId) {
  require(strikePrice > 0, "Invalid strike price");
  require(expirationTime > block.timestamp, "Invalid expiration");

  // Implementation
}
```

## Testing Requirements

### Unit Tests

- **Coverage**: Minimum 80% for new code
- **Framework**: pytest (Python), Jest (TypeScript)
- **Mocking**: Use appropriate mocking libraries

**Example**:

```python
import pytest
from backend.services.pricing_engine import PricingEngine

def test_black_scholes_call_option():
    """Test Black-Scholes pricing for call option."""
    engine = PricingEngine()

    result = engine.price_option(
        spot_price=100.0,
        strike_price=100.0,
        time_to_expiry=1.0,
        risk_free_rate=0.05,
        volatility=0.25,
        option_type='call'
    )

    assert result['price'] > 0
    assert 0 <= result['delta'] <= 1
    assert result['gamma'] >= 0
```

### Integration Tests

- Test API endpoints end-to-end
- Use TestClient for FastAPI
- Mock external services

### Smart Contract Tests

```javascript
const OptionsContract = artifacts.require("OptionsContract");

contract("OptionsContract", (accounts) => {
  it("should create a new option", async () => {
    const contract = await OptionsContract.deployed();
    const result = await contract.createOption(
      0, // Call option
      web3.utils.toWei("100", "ether"),
      Math.floor(Date.now() / 1000) + 86400,
      { from: accounts[0] },
    );

    assert.ok(result.logs[0].args.optionId);
  });
});
```

## Pull Request Process

### Before Submitting

- [ ] All tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Commit messages are clear
- [ ] Branch is up-to-date with main

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review performed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs automatically
2. **Code Review**: At least one maintainer review required
3. **Testing**: All tests must pass
4. **Approval**: Maintainer approves PR
5. **Merge**: Squash and merge to main

## Documentation

### Code Documentation

**Python**:

```python
def complex_function(param1: int, param2: str) -> Dict[str, Any]:
    """
    One-line summary.

    Detailed explanation if needed.

    Args:
        param1: Description of param1
        param2: Description of param2

    Returns:
        Dictionary containing result fields

    Raises:
        ValueError: When validation fails
    """
```

**TypeScript**:

```typescript
/**
 * Calculate option Greeks.
 *
 * @param spotPrice - Current spot price
 * @param strikePrice - Strike price
 * @returns Object containing all Greeks
 */
function calculateGreeks(spotPrice: number, strikePrice: number): Greeks {
  // Implementation
}
```

### Documentation Updates

When adding new features:

1. Update relevant `.md` files in `docs/`
2. Add examples to `docs/EXAMPLES/`
3. Update API reference if applicable
4. Add to `docs/FEATURE_MATRIX.md`

## Security

### Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities.

Email security concerns to: security@optionix.com

Include:

- Description of vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Security Best Practices

1. **Never commit secrets**
   - Use environment variables
   - Add secrets to `.gitignore`
   - Use `.env.example` as template

2. **Input Validation**
   - Validate all user input
   - Use Pydantic schemas
   - Sanitize output

3. **Authentication**
   - Use provided auth service
   - Never bypass authentication
   - Implement rate limiting

4. **Dependencies**
   - Keep dependencies updated
   - Run `pip-audit` regularly
   - Check for known vulnerabilities

## Commit Message Guidelines

### Format

```
type(scope): subject

body

footer
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only
- **style**: Code style (formatting, no logic change)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Example

```
feat(pricing): add barrier option pricing

Implement up-and-out and down-and-out barrier options
using Monte Carlo simulation.

Closes #123
```

## Branch Naming

```
<type>/<short-description>

Examples:
feature/add-asian-options
fix/volatility-calculation-bug
docs/update-api-reference
```

## Code Review Guidelines

### For Authors

- Keep PRs focused and small
- Write clear PR descriptions
- Respond to feedback promptly
- Request review when ready

### For Reviewers

- Be constructive and respectful
- Focus on code quality and design
- Suggest improvements, don't demand
- Approve when ready

## Development Tools

### Recommended IDE Setup

**VSCode Extensions**:

- Python
- Pylance
- ESLint
- Prettier
- GitLens

**PyCharm Plugins**:

- Black
- MyPy
- pytest

### Pre-commit Hooks

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```
