from typing import Any

"""
Risk Management and Stress Testing Tools for Optionix platform.

This module provides comprehensive risk management tools with stress testing capabilities,
including advanced risk metrics, scenario analysis, and portfolio-level risk assessment.
"""

import json
import logging
import threading
import uuid
from datetime import datetime
from enum import Enum
import numpy as np
import pandas as pd
from scipy import stats

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class RiskMetricType(Enum):
    """Enum for risk metric types"""

    VAR = "VALUE_AT_RISK"
    CVAR = "CONDITIONAL_VALUE_AT_RISK"
    EXPECTED_SHORTFALL = "EXPECTED_SHORTFALL"
    COMPONENT_VAR = "COMPONENT_VALUE_AT_RISK"
    INCREMENTAL_VAR = "INCREMENTAL_VALUE_AT_RISK"
    MARGINAL_VAR = "MARGINAL_VALUE_AT_RISK"
    BETA = "BETA"
    VOLATILITY = "VOLATILITY"
    CORRELATION = "CORRELATION"
    DRAWDOWN = "DRAWDOWN"
    SHARPE_RATIO = "SHARPE_RATIO"
    SORTINO_RATIO = "SORTINO_RATIO"
    CUSTOM = "CUSTOM"


class RiskEngine:
    """
    Core engine for risk calculation and management.

    This class provides a comprehensive framework for calculating various risk metrics,
    performing scenario analysis, and stress testing portfolios.
    """

    def __init__(self, config: Any = None) -> None:
        """
        Initialize risk engine.

        Args:
            config (dict, optional): Configuration parameters
        """
        self.config = config or {}
        self.metrics_calculator = RiskMetricsCalculator()
        self.scenario_analyzer = ScenarioAnalyzer()
        self.stress_test_engine = StressTestEngine()
        self.sensitivity_calculator = SensitivityCalculator()
        self.what_if_analyzer = WhatIfAnalyzer()
        self._lock = threading.RLock()

    def calculate_portfolio_risk(
        self, portfolio: Any, market_data: Any = None, metrics: Any = None
    ) -> Any:
        """
        Calculate comprehensive risk metrics for a portfolio.

        Args:
            portfolio (dict): Portfolio data
            market_data (dict, optional): Market data
            metrics (list, optional): List of metrics to calculate

        Returns:
            dict: Risk metrics
        """
        if metrics is None:
            metrics = [
                RiskMetricType.VAR,
                RiskMetricType.CVAR,
                RiskMetricType.VOLATILITY,
                RiskMetricType.DRAWDOWN,
                RiskMetricType.SHARPE_RATIO,
            ]
        metrics = [
            m if isinstance(m, RiskMetricType) else RiskMetricType(m) for m in metrics
        ]
        results = {}
        for metric in metrics:
            if metric == RiskMetricType.VAR:
                confidence = self.config.get("var_confidence", 0.95)
                window = self.config.get("var_window", 252)
                results["var"] = self.metrics_calculator.calculate_var(
                    portfolio, confidence, window
                )
            elif (
                metric == RiskMetricType.CVAR
                or metric == RiskMetricType.EXPECTED_SHORTFALL
            ):
                confidence = self.config.get("cvar_confidence", 0.95)
                window = self.config.get("cvar_window", 252)
                results["cvar"] = self.metrics_calculator.calculate_cvar(
                    portfolio, confidence, window
                )
            elif metric == RiskMetricType.COMPONENT_VAR:
                confidence = self.config.get("var_confidence", 0.95)
                window = self.config.get("var_window", 252)
                results["component_var"] = (
                    self.metrics_calculator.calculate_component_var(
                        portfolio, confidence, window
                    )
                )
            elif metric == RiskMetricType.INCREMENTAL_VAR:
                confidence = self.config.get("var_confidence", 0.95)
                window = self.config.get("var_window", 252)
                results["incremental_var"] = (
                    self.metrics_calculator.calculate_incremental_var(
                        portfolio, confidence, window
                    )
                )
            elif metric == RiskMetricType.MARGINAL_VAR:
                confidence = self.config.get("var_confidence", 0.95)
                window = self.config.get("var_window", 252)
                results["marginal_var"] = (
                    self.metrics_calculator.calculate_marginal_var(
                        portfolio, confidence, window
                    )
                )
            elif metric == RiskMetricType.BETA:
                market_index = self.config.get("market_index", "SPY")
                window = self.config.get("beta_window", 252)
                results["beta"] = self.metrics_calculator.calculate_beta(
                    portfolio, market_index, window
                )
            elif metric == RiskMetricType.VOLATILITY:
                window = self.config.get("volatility_window", 252)
                annualize = self.config.get("annualize_volatility", True)
                results["volatility"] = self.metrics_calculator.calculate_volatility(
                    portfolio, window, annualize
                )
            elif metric == RiskMetricType.CORRELATION:
                window = self.config.get("correlation_window", 252)
                results["correlation"] = (
                    self.metrics_calculator.calculate_correlation_matrix(
                        portfolio, window
                    )
                )
            elif metric == RiskMetricType.DRAWDOWN:
                window = self.config.get("drawdown_window", 252)
                results["drawdown"] = self.metrics_calculator.calculate_drawdown(
                    portfolio, window
                )
            elif metric == RiskMetricType.SHARPE_RATIO:
                risk_free_rate = self.config.get("risk_free_rate", 0.02)
                window = self.config.get("sharpe_window", 252)
                results["sharpe_ratio"] = (
                    self.metrics_calculator.calculate_sharpe_ratio(
                        portfolio, risk_free_rate, window
                    )
                )
            elif metric == RiskMetricType.SORTINO_RATIO:
                risk_free_rate = self.config.get("risk_free_rate", 0.02)
                window = self.config.get("sortino_window", 252)
                results["sortino_ratio"] = (
                    self.metrics_calculator.calculate_sortino_ratio(
                        portfolio, risk_free_rate, window
                    )
                )
        results["sensitivities"] = (
            self.sensitivity_calculator.calculate_portfolio_sensitivities(portfolio)
        )
        return results

    def run_scenario_analysis(self, portfolio: Any, scenarios: Any = None) -> Any:
        """
        Run scenario analysis on a portfolio.

        Args:
            portfolio (dict): Portfolio data
            scenarios (dict, optional): Dictionary of scenarios

        Returns:
            dict: Scenario analysis results
        """
        if scenarios is None:
            scenarios = self.scenario_analyzer.get_default_scenarios()
        results = {}
        for scenario_name, scenario in scenarios.items():
            scenario_result = self.scenario_analyzer.analyze_scenario(
                portfolio, scenario
            )
            results[scenario_name] = scenario_result
        return results

    def run_stress_test(self, portfolio: Any, stress_test_config: Any = None) -> Any:
        """
        Run stress test on a portfolio.

        Args:
            portfolio (dict): Portfolio data
            stress_test_config (dict, optional): Stress test configuration

        Returns:
            dict: Stress test results
        """
        if stress_test_config is None:
            stress_test_config = self.stress_test_engine.get_default_config()
        return self.stress_test_engine.run_stress_test(portfolio, stress_test_config)

    def run_what_if_analysis(
        self, portfolio: Any, what_if_scenarios: Any = None
    ) -> Any:
        """
        Run what-if analysis on a portfolio.

        Args:
            portfolio (dict): Portfolio data
            what_if_scenarios (dict, optional): What-if scenarios

        Returns:
            dict: What-if analysis results
        """
        if what_if_scenarios is None:
            what_if_scenarios = self.what_if_analyzer.get_default_scenarios()
        results = {}
        for scenario_name, scenario in what_if_scenarios.items():
            scenario_result = self.what_if_analyzer.analyze_scenario(
                portfolio, scenario
            )
            results[scenario_name] = scenario_result
        return results

    def check_risk_limits(self, portfolio: Any, limits: Any = None) -> Any:
        """
        Check if portfolio risk exceeds defined limits.

        Args:
            portfolio (dict): Portfolio data
            limits (dict, optional): Risk limits

        Returns:
            dict: Limit breaches
        """
        if limits is None:
            limits = self.config.get("risk_limits", {})
        portfolio_risk = self.calculate_portfolio_risk(portfolio)
        limit_breaches = {}
        for metric, limit in limits.items():
            if metric in portfolio_risk and portfolio_risk[metric] > limit:
                limit_breaches[metric] = {
                    "limit": limit,
                    "actual": portfolio_risk[metric],
                    "breach_percentage": (portfolio_risk[metric] - limit) / limit * 100,
                }
        return limit_breaches

    def generate_risk_report(self, portfolio: Any, report_config: Any = None) -> Any:
        """
        Generate comprehensive risk report for a portfolio.

        Args:
            portfolio (dict): Portfolio data
            report_config (dict, optional): Report configuration

        Returns:
            dict: Risk report
        """
        if report_config is None:
            report_config = {
                "include_metrics": True,
                "include_scenarios": True,
                "include_stress_tests": True,
                "include_what_if": True,
                "include_limits": True,
            }
        report = {
            "portfolio_id": portfolio.get("portfolio_id", "unknown"),
            "report_id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "summary": {},
        }
        if report_config.get("include_metrics", True):
            report["risk_metrics"] = self.calculate_portfolio_risk(portfolio)
            report["summary"]["var_95"] = (
                report["risk_metrics"].get("var", {}).get("var_95", 0)
            )
            report["summary"]["volatility"] = report["risk_metrics"].get(
                "volatility", 0
            )
        if report_config.get("include_scenarios", True):
            report["scenario_analysis"] = self.run_scenario_analysis(portfolio)
            worst_scenario = min(
                report["scenario_analysis"].items(), key=lambda x: x[1]["pnl"]
            )
            report["summary"]["worst_scenario"] = {
                "name": worst_scenario[0],
                "pnl": worst_scenario[1]["pnl"],
            }
        if report_config.get("include_stress_tests", True):
            report["stress_tests"] = self.run_stress_test(portfolio)
            report["summary"]["stress_test_impact"] = (
                report["stress_tests"].get("aggregated_results", {}).get("pnl", 0)
            )
        if report_config.get("include_what_if", True):
            report["what_if_analysis"] = self.run_what_if_analysis(portfolio)
        if report_config.get("include_limits", True):
            report["limit_breaches"] = self.check_risk_limits(portfolio)
            report["summary"]["limit_breaches"] = len(report["limit_breaches"])
        return report


class RiskMetricsCalculator:
    """
    Calculator for various risk metrics.
    """

    def __init__(self) -> None:
        """Initialize risk metrics calculator."""

    def calculate_var(
        self, portfolio: Any, confidence: Any = 0.95, window: Any = 252
    ) -> Any:
        """
        Calculate Value at Risk (VaR) for a portfolio.

        Args:
            portfolio (dict): Portfolio data
            confidence (float): Confidence level
            window (int): Lookback window

        Returns:
            dict: VaR metrics
        """
        returns = self._get_portfolio_returns(portfolio, window)
        if len(returns) < window / 2:
            return {"var_95": None, "var_99": None, "error": "Insufficient return data"}
        var_95 = self._calculate_historical_var(returns, 0.95)
        var_99 = self._calculate_historical_var(returns, 0.99)
        mean_return = np.mean(returns)
        std_return = np.std(returns)
        var_95_parametric = -mean_return - std_return * stats.norm.ppf(0.95)
        var_99_parametric = -mean_return - std_return * stats.norm.ppf(0.99)
        return {
            "var_95": var_95,
            "var_99": var_99,
            "var_95_parametric": var_95_parametric,
            "var_99_parametric": var_99_parametric,
            "confidence": confidence,
            "window": window,
            "method": "historical",
        }

    def _calculate_historical_var(self, returns: Any, confidence: Any) -> Any:
        """
        Calculate historical VaR.

        Args:
            returns (array): Array of returns
            confidence (float): Confidence level

        Returns:
            float: VaR
        """
        sorted_returns = np.sort(returns)
        index = int(len(returns) * (1 - confidence))
        return -sorted_returns[index]

    def calculate_cvar(
        self, portfolio: Any, confidence: Any = 0.95, window: Any = 252
    ) -> Any:
        """
        Calculate Conditional Value at Risk (CVaR) / Expected Shortfall.

        Args:
            portfolio (dict): Portfolio data
            confidence (float): Confidence level
            window (int): Lookback window

        Returns:
            dict: CVaR metrics
        """
        returns = self._get_portfolio_returns(portfolio, window)
        if len(returns) < window / 2:
            return {
                "cvar_95": None,
                "cvar_99": None,
                "error": "Insufficient return data",
            }
        var_95 = self._calculate_historical_var(returns, 0.95)
        var_99 = self._calculate_historical_var(returns, 0.99)
        cvar_95 = self._calculate_conditional_var(returns, var_95)
        cvar_99 = self._calculate_conditional_var(returns, var_99)
        return {
            "cvar_95": cvar_95,
            "cvar_99": cvar_99,
            "confidence": confidence,
            "window": window,
            "method": "historical",
        }

    def _calculate_conditional_var(self, returns: Any, var: Any) -> Any:
        """
        Calculate Conditional VaR (Expected Shortfall).

        Args:
            returns (array): Array of returns
            var (float): Value at Risk

        Returns:
            float: Conditional VaR
        """
        excess_returns = returns[returns <= -var]
        if len(excess_returns) > 0:
            return -np.mean(excess_returns)
        else:
            return var

    def calculate_component_var(
        self, portfolio: Any, confidence: Any = 0.95, window: Any = 252
    ) -> Any:
        """
        Calculate Component VaR for portfolio attribution.

        Args:
            portfolio (dict): Portfolio data
            confidence (float): Confidence level
            window (int): Lookback window

        Returns:
            dict: Component VaR for each position
        """
        portfolio_returns = self._get_portfolio_returns(portfolio, window)
        position_returns = self._get_position_returns(portfolio, window)
        if len(portfolio_returns) < window / 2:
            return {"error": "Insufficient return data"}
        portfolio_var = self._calculate_historical_var(portfolio_returns, confidence)
        returns_df = pd.DataFrame(position_returns)
        cov_matrix = returns_df.cov()
        weights = self._get_portfolio_weights(portfolio)
        component_var = {}
        for position_id, position_weight in weights.items():
            if position_id in position_returns:
                position_cov = cov_matrix[position_id].values
                marginal_contribution = position_weight * np.dot(
                    position_cov, weights.values()
                )
                component_var[position_id] = (
                    marginal_contribution
                    * portfolio_var
                    / np.std(portfolio_returns) ** 2
                )
        return component_var

    def calculate_incremental_var(
        self, portfolio: Any, confidence: Any = 0.95, window: Any = 252
    ) -> Any:
        """
        Calculate Incremental VaR for each position.

        Args:
            portfolio (dict): Portfolio data
            confidence (float): Confidence level
            window (int): Lookback window

        Returns:
            dict: Incremental VaR for each position
        """
        portfolio_returns = self._get_portfolio_returns(portfolio, window)
        if len(portfolio_returns) < window / 2:
            return {"error": "Insufficient return data"}
        portfolio_var = self._calculate_historical_var(portfolio_returns, confidence)
        incremental_var = {}
        for position in portfolio.get("positions", []):
            position_id = position.get("position_id")
            portfolio_without_position = self._remove_position_from_portfolio(
                portfolio, position_id
            )
            returns_without_position = self._get_portfolio_returns(
                portfolio_without_position, window
            )
            var_without_position = self._calculate_historical_var(
                returns_without_position, confidence
            )
            incremental_var[position_id] = portfolio_var - var_without_position
        return incremental_var

    def calculate_marginal_var(
        self, portfolio: Any, confidence: Any = 0.95, window: Any = 252
    ) -> Any:
        """
        Calculate Marginal VaR for each position.

        Args:
            portfolio (dict): Portfolio data
            confidence (float): Confidence level
            window (int): Lookback window

        Returns:
            dict: Marginal VaR for each position
        """
        portfolio_returns = self._get_portfolio_returns(portfolio, window)
        position_returns = self._get_position_returns(portfolio, window)
        if len(portfolio_returns) < window / 2:
            return {"error": "Insufficient return data"}
        portfolio_var = self._calculate_historical_var(portfolio_returns, confidence)
        marginal_var = {}
        for position_id, returns in position_returns.items():
            cov = np.cov(returns, portfolio_returns)[0, 1]
            marginal_var[position_id] = cov / np.std(portfolio_returns) * portfolio_var
        return marginal_var

    def calculate_beta(
        self, portfolio: Any, market_index: Any = "SPY", window: Any = 252
    ) -> Any:
        """
        Calculate beta for portfolio and positions.

        Args:
            portfolio (dict): Portfolio data
            market_index (str): Market index symbol
            window (int): Lookback window

        Returns:
            dict: Beta for portfolio and positions
        """
        portfolio_returns = self._get_portfolio_returns(portfolio, window)
        position_returns = self._get_position_returns(portfolio, window)
        market_returns = self._get_market_returns(market_index, window)
        if len(portfolio_returns) < window / 2 or len(market_returns) < window / 2:
            return {
                "portfolio_beta": None,
                "position_betas": {},
                "error": "Insufficient return data",
            }
        portfolio_beta = self._calculate_beta(portfolio_returns, market_returns)
        position_betas = {}
        for position_id, returns in position_returns.items():
            position_betas[position_id] = self._calculate_beta(returns, market_returns)
        return {
            "portfolio_beta": portfolio_beta,
            "position_betas": position_betas,
            "market_index": market_index,
            "window": window,
        }

    def _calculate_beta(self, returns: Any, market_returns: Any) -> Any:
        """
        Calculate beta between returns and market returns.

        Args:
            returns (array): Array of returns
            market_returns (array): Array of market returns

        Returns:
            float: Beta
        """
        cov = np.cov(returns, market_returns)[0, 1]
        market_var = np.var(market_returns)
        if market_var > 0:
            return cov / market_var
        else:
            return 0

    def calculate_volatility(
        self, portfolio: Any, window: Any = 252, annualize: Any = True
    ) -> Any:
        """
        Calculate volatility for portfolio and positions.

        Args:
            portfolio (dict): Portfolio data
            window (int): Lookback window
            annualize (bool): Whether to annualize volatility

        Returns:
            dict: Volatility for portfolio and positions
        """
        portfolio_returns = self._get_portfolio_returns(portfolio, window)
        position_returns = self._get_position_returns(portfolio, window)
        if len(portfolio_returns) < window / 2:
            return {
                "portfolio_volatility": None,
                "position_volatilities": {},
                "error": "Insufficient return data",
            }
        portfolio_volatility = np.std(portfolio_returns)
        if annualize:
            portfolio_volatility *= np.sqrt(252)
        position_volatilities = {}
        for position_id, returns in position_returns.items():
            position_volatility = np.std(returns)
            if annualize:
                position_volatility *= np.sqrt(252)
            position_volatilities[position_id] = position_volatility
        return {
            "portfolio_volatility": portfolio_volatility,
            "position_volatilities": position_volatilities,
            "window": window,
            "annualized": annualize,
        }

    def calculate_correlation_matrix(self, portfolio: Any, window: Any = 252) -> Any:
        """
        Calculate correlation matrix for positions.

        Args:
            portfolio (dict): Portfolio data
            window (int): Lookback window

        Returns:
            dict: Correlation matrix
        """
        position_returns = self._get_position_returns(portfolio, window)
        if not position_returns or len(list(position_returns.values())[0]) < window / 2:
            return {"correlation_matrix": None, "error": "Insufficient return data"}
        returns_df = pd.DataFrame(position_returns)
        correlation_matrix = returns_df.corr().to_dict()
        return {"correlation_matrix": correlation_matrix, "window": window}

    def calculate_drawdown(self, portfolio: Any, window: Any = 252) -> Any:
        """
        Calculate drawdown for portfolio.

        Args:
            portfolio (dict): Portfolio data
            window (int): Lookback window

        Returns:
            dict: Drawdown metrics
        """
        portfolio_values = self._get_portfolio_values(portfolio, window)
        if len(portfolio_values) < window / 2:
            return {
                "max_drawdown": None,
                "current_drawdown": None,
                "drawdown_series": None,
                "error": "Insufficient value data",
            }
        cumulative_returns = (1 + np.array(portfolio_values)).cumprod()
        running_max = np.maximum.accumulate(cumulative_returns)
        drawdown_series = (cumulative_returns - running_max) / running_max
        max_drawdown = np.min(drawdown_series)
        current_drawdown = drawdown_series[-1]
        return {
            "max_drawdown": max_drawdown,
            "current_drawdown": current_drawdown,
            "drawdown_series": drawdown_series.tolist(),
            "window": window,
        }

    def calculate_sharpe_ratio(
        self, portfolio: Any, risk_free_rate: Any = 0.02, window: Any = 252
    ) -> Any:
        """
        Calculate Sharpe ratio for portfolio.

        Args:
            portfolio (dict): Portfolio data
            risk_free_rate (float): Risk-free rate
            window (int): Lookback window

        Returns:
            float: Sharpe ratio
        """
        portfolio_returns = self._get_portfolio_returns(portfolio, window)
        if len(portfolio_returns) < window / 2:
            return None
        avg_return = np.mean(portfolio_returns)
        volatility = np.std(portfolio_returns)
        daily_rf = risk_free_rate / 252
        if volatility > 0:
            sharpe = (avg_return - daily_rf) / volatility
            sharpe *= np.sqrt(252)
            return sharpe
        else:
            return 0

    def calculate_sortino_ratio(
        self, portfolio: Any, risk_free_rate: Any = 0.02, window: Any = 252
    ) -> Any:
        """
        Calculate Sortino ratio for portfolio.

        Args:
            portfolio (dict): Portfolio data
            risk_free_rate (float): Risk-free rate
            window (int): Lookback window

        Returns:
            float: Sortino ratio
        """
        portfolio_returns = self._get_portfolio_returns(portfolio, window)
        if len(portfolio_returns) < window / 2:
            return None
        avg_return = np.mean(portfolio_returns)
        daily_rf = risk_free_rate / 252
        downside_returns = portfolio_returns[portfolio_returns < 0]
        if len(downside_returns) > 0:
            downside_deviation = np.sqrt(np.mean(downside_returns**2))
            if downside_deviation > 0:
                sortino = (avg_return - daily_rf) / downside_deviation
                sortino *= np.sqrt(252)
                return sortino
            else:
                return 0
        else:
            return 0

    def _get_portfolio_returns(self, portfolio: Any, window: Any = 252) -> Any:
        """
        Get historical returns for a portfolio.

        Args:
            portfolio (dict): Portfolio data
            window (int): Lookback window

        Returns:
            array: Portfolio returns
        """
        if "returns" in portfolio and len(portfolio["returns"]) > 0:
            return np.array(portfolio["returns"][-window:])
        mean_return = 0.0005
        std_return = 0.01
        return np.random.normal(mean_return, std_return, window)

    def _get_position_returns(self, portfolio: Any, window: Any = 252) -> Any:
        """
        Get historical returns for each position in a portfolio.

        Args:
            portfolio (dict): Portfolio data
            window (int): Lookback window

        Returns:
            dict: Position returns
        """
        position_returns = {}
        for position in portfolio.get("positions", []):
            position_id = position.get("position_id")
            if "returns" in position and len(position["returns"]) > 0:
                position_returns[position_id] = np.array(position["returns"][-window:])
            else:
                mean_return = 0.0005
                std_return = 0.015
                position_returns[position_id] = np.random.normal(
                    mean_return, std_return, window
                )
        return position_returns

    def _get_portfolio_values(self, portfolio: Any, window: Any = 252) -> Any:
        """
        Get historical values for a portfolio.

        Args:
            portfolio (dict): Portfolio data
            window (int): Lookback window

        Returns:
            array: Portfolio values
        """
        returns = self._get_portfolio_returns(portfolio, window)
        values = np.cumprod(1 + returns) - 1
        return values

    def _get_market_returns(self, market_index: Any, window: Any = 252) -> Any:
        """
        Get historical returns for a market index.

        Args:
            market_index (str): Market index symbol
            window (int): Lookback window

        Returns:
            array: Market returns
        """
        mean_return = 0.0004
        std_return = 0.008
        return np.random.normal(mean_return, std_return, window)

    def _get_portfolio_weights(self, portfolio: Any) -> Any:
        """
        Get weights for each position in a portfolio.

        Args:
            portfolio (dict): Portfolio data

        Returns:
            dict: Position weights
        """
        weights = {}
        total_value = 0
        for position in portfolio.get("positions", []):
            position_value = position.get("value", 0)
            total_value += position_value
        if total_value > 0:
            for position in portfolio.get("positions", []):
                position_id = position.get("position_id")
                position_value = position.get("value", 0)
                weights[position_id] = position_value / total_value
        return weights

    def _remove_position_from_portfolio(self, portfolio: Any, position_id: Any) -> Any:
        """
        Create a copy of portfolio without a specific position.

        Args:
            portfolio (dict): Portfolio data
            position_id (str): Position ID to remove

        Returns:
            dict: Portfolio without the position
        """
        portfolio_copy = json.loads(json.dumps(portfolio))
        portfolio_copy["positions"] = [
            p
            for p in portfolio_copy.get("positions", [])
            if p.get("position_id") != position_id
        ]
        return portfolio_copy


class StressTestEngine:
    """
    Core engine for stress testing.
    """

    def __init__(self, config: Any = None) -> None:
        """
        Initialize stress test engine.

        Args:
            config (dict, optional): Configuration parameters
        """
        self.config = config or {}
        self.scenario_generator = StressScenarioGenerator()
        self.portfolio_valuator = PortfolioValuator()

    def get_default_config(self) -> Any:
        """
        Get default stress test configuration.

        Returns:
            dict: Default configuration
        """
        return {
            "scenarios": [
                "historical_2008_crisis",
                "historical_2020_covid",
                "hypothetical_rate_hike_200bp",
                "hypothetical_equity_crash_30pct",
                "hypothetical_volatility_spike_100pct",
            ],
            "metrics": ["pnl", "var", "liquidity"],
            "aggregation": "worst_case",
        }

    def run_stress_test(self, portfolio: Any, config: Any) -> Any:
        """
        Run stress test on a portfolio.

        Args:
            portfolio (dict): Portfolio data
            config (dict): Stress test configuration

        Returns:
            dict: Stress test results
        """
        results = {}
        scenarios = {}
        for scenario_name in config["scenarios"]:
            if scenario_name.startswith("historical_"):
                scenarios[scenario_name] = (
                    self.scenario_generator.generate_historical_scenario(
                        scenario_name.replace("historical_", "")
                    )
                )
            elif scenario_name.startswith("hypothetical_"):
                scenarios[scenario_name] = (
                    self.scenario_generator.generate_hypothetical_scenario(
                        scenario_name.replace("hypothetical_", "")
                    )
                )
            else:
                scenarios[scenario_name] = (
                    self.scenario_generator.generate_custom_scenario(scenario_name)
                )
        for scenario_name, scenario in scenarios.items():
            valuation_result = self.portfolio_valuator.value_under_stress(
                portfolio, scenario
            )
            metrics = {}
            for metric in config["metrics"]:
                if metric == "pnl":
                    metrics["pnl"] = valuation_result["total_pnl"]
                elif metric == "var":
                    metrics["var"] = self._calculate_var_under_stress(
                        portfolio, scenario
                    )
                elif metric == "liquidity":
                    metrics["liquidity"] = self._calculate_liquidity_under_stress(
                        portfolio, scenario
                    )
            results[scenario_name] = {
                "scenario": scenario,
                "valuation": valuation_result,
                "metrics": metrics,
            }
        aggregated_results = self._aggregate_results(results, config["aggregation"])
        return {"scenario_results": results, "aggregated_results": aggregated_results}

    def _calculate_var_under_stress(self, portfolio: Any, scenario: Any) -> Any:
        """
        Calculate VaR under stress scenario.

        Args:
            portfolio (dict): Portfolio data
            scenario (dict): Stress scenario

        Returns:
            float: VaR under stress
        """
        calculator = RiskMetricsCalculator()
        base_var = calculator.calculate_var(portfolio).get("var_95", 0)
        severity = scenario.get("severity", 1.0)
        return base_var * severity

    def _calculate_liquidity_under_stress(self, portfolio: Any, scenario: Any) -> Any:
        """
        Calculate liquidity metrics under stress scenario.

        Args:
            portfolio (dict): Portfolio data
            scenario (dict): Stress scenario

        Returns:
            dict: Liquidity metrics
        """
        base_cost = 0
        for position in portfolio.get("positions", []):
            position_value = position.get("value", 0)
            liquidity = position.get("liquidity", 0.5)
            base_cost += position_value * (1 - liquidity) * 0.01
        liquidity_impact = scenario.get("liquidity_impact", 1.0)
        return {
            "liquidation_cost": base_cost * liquidity_impact,
            "liquidity_score": 1.0 / (1.0 + base_cost * liquidity_impact),
        }

    def _aggregate_results(self, results: Any, aggregation_method: Any) -> Any:
        """
        Aggregate results from multiple scenarios.

        Args:
            results (dict): Scenario results
            aggregation_method (str): Aggregation method

        Returns:
            dict: Aggregated results
        """
        if aggregation_method == "worst_case":
            return self._aggregate_worst_case(results)
        elif aggregation_method == "probability_weighted":
            return self._aggregate_probability_weighted(results)
        elif aggregation_method == "average":
            return self._aggregate_average(results)
        return None

    def _aggregate_worst_case(self, results: Any) -> Any:
        """
        Aggregate using worst case scenario.

        Args:
            results (dict): Scenario results

        Returns:
            dict: Worst case results
        """
        worst_scenario = min(
            results.items(), key=lambda x: x[1]["metrics"].get("pnl", 0)
        )
        return {
            "method": "worst_case",
            "scenario": worst_scenario[0],
            "pnl": worst_scenario[1]["metrics"].get("pnl", 0),
            "var": worst_scenario[1]["metrics"].get("var", 0),
            "liquidity": worst_scenario[1]["metrics"].get("liquidity", {}),
        }

    def _aggregate_probability_weighted(self, results: Any) -> Any:
        """
        Aggregate using probability weights.

        Args:
            results (dict): Scenario results

        Returns:
            dict: Probability-weighted results
        """
        probabilities = {}
        for scenario_name in results.keys():
            if scenario_name.startswith("historical_"):
                probabilities[scenario_name] = 0.4
            elif scenario_name.startswith("hypothetical_"):
                probabilities[scenario_name] = 0.2
            else:
                probabilities[scenario_name] = 0.1
        total_prob = sum(probabilities.values())
        if total_prob > 0:
            for scenario_name in probabilities:
                probabilities[scenario_name] /= total_prob
        weighted_pnl = 0
        weighted_var = 0
        for scenario_name, result in results.items():
            prob = probabilities.get(scenario_name, 0)
            weighted_pnl += result["metrics"].get("pnl", 0) * prob
            weighted_var += result["metrics"].get("var", 0) * prob
        return {
            "method": "probability_weighted",
            "probabilities": probabilities,
            "pnl": weighted_pnl,
            "var": weighted_var,
        }

    def _aggregate_average(self, results: Any) -> Any:
        """
        Aggregate using simple average.

        Args:
            results (dict): Scenario results

        Returns:
            dict: Average results
        """
        total_pnl = 0
        total_var = 0
        for result in results.values():
            total_pnl += result["metrics"].get("pnl", 0)
            total_var += result["metrics"].get("var", 0)
        num_scenarios = len(results)
        if num_scenarios > 0:
            return {
                "method": "average",
                "pnl": total_pnl / num_scenarios,
                "var": total_var / num_scenarios,
            }
        else:
            return {"method": "average", "pnl": 0, "var": 0}


class StressScenarioGenerator:
    """
    Generator for stress test scenarios.
    """

    def __init__(self, config: Any = None) -> None:
        """
        Initialize stress scenario generator.

        Args:
            config (dict, optional): Configuration parameters
        """
        self.config = config or {}

    def generate_historical_scenario(self, crisis_name: Any) -> Any:
        """
        Generate scenario based on historical crisis.

        Args:
            crisis_name (str): Name of historical crisis

        Returns:
            dict: Scenario parameters
        """
        crisis_parameters = {
            "2008_crisis": {
                "equity_return": -0.4,
                "volatility_change": 2.5,
                "correlation_change": 0.3,
                "interest_rate_change": -0.01,
                "credit_spread_change": 0.05,
                "liquidity_impact": 3.0,
                "severity": 2.0,
            },
            "2020_covid": {
                "equity_return": -0.3,
                "volatility_change": 3.0,
                "correlation_change": 0.4,
                "interest_rate_change": -0.01,
                "credit_spread_change": 0.03,
                "liquidity_impact": 2.5,
                "severity": 1.5,
            },
            "2000_dotcom": {
                "equity_return": -0.25,
                "volatility_change": 1.5,
                "correlation_change": 0.2,
                "interest_rate_change": -0.005,
                "credit_spread_change": 0.02,
                "liquidity_impact": 1.5,
                "severity": 1.2,
            },
        }
        if crisis_name not in crisis_parameters:
            raise ValueError(f"Unknown crisis: {crisis_name}")
        params = crisis_parameters[crisis_name]
        scenario = {
            "name": f"Historical: {crisis_name}",
            "type": "historical",
            "description": f"Scenario based on {crisis_name} market conditions",
            "parameters": params,
        }
        return scenario

    def generate_hypothetical_scenario(self, scenario_name: Any) -> Any:
        """
        Generate hypothetical stress scenario.

        Args:
            scenario_name (str): Scenario name

        Returns:
            dict: Scenario parameters
        """
        hypothetical_scenarios = {
            "rate_hike_200bp": {
                "interest_rate_change": 0.02,
                "equity_return": -0.15,
                "volatility_change": 1.5,
                "correlation_change": 0.1,
                "credit_spread_change": 0.01,
                "liquidity_impact": 1.2,
                "severity": 1.3,
            },
            "equity_crash_30pct": {
                "equity_return": -0.3,
                "volatility_change": 2.0,
                "correlation_change": 0.3,
                "interest_rate_change": -0.005,
                "credit_spread_change": 0.02,
                "liquidity_impact": 2.0,
                "severity": 1.7,
            },
            "volatility_spike_100pct": {
                "volatility_change": 2.0,
                "equity_return": -0.1,
                "correlation_change": 0.2,
                "interest_rate_change": 0.0,
                "credit_spread_change": 0.01,
                "liquidity_impact": 1.5,
                "severity": 1.4,
            },
        }
        if scenario_name not in hypothetical_scenarios:
            raise ValueError(f"Unknown hypothetical scenario: {scenario_name}")
        params = hypothetical_scenarios[scenario_name]
        scenario = {
            "name": f"Hypothetical: {scenario_name}",
            "type": "hypothetical",
            "description": f"Hypothetical scenario: {scenario_name}",
            "parameters": params,
        }
        return scenario

    def generate_custom_scenario(self, scenario_name: Any) -> Any:
        """
        Generate custom stress scenario.

        Args:
            scenario_name (str): Scenario name

        Returns:
            dict: Scenario parameters
        """
        scenario = {
            "name": f"Custom: {scenario_name}",
            "type": "custom",
            "description": f"Custom scenario: {scenario_name}",
            "parameters": {
                "equity_return": -0.2,
                "volatility_change": 1.5,
                "correlation_change": 0.2,
                "interest_rate_change": 0.01,
                "credit_spread_change": 0.015,
                "liquidity_impact": 1.5,
                "severity": 1.5,
            },
        }
        return scenario

    def generate_reverse_stress_scenario(self, portfolio: Any, target_loss: Any) -> Any:
        """
        Generate reverse stress scenario to achieve a target loss.

        Args:
            portfolio (dict): Portfolio data
            target_loss (float): Target loss amount

        Returns:
            dict: Scenario parameters
        """
        portfolio_value = sum(
            (p.get("value", 0) for p in portfolio.get("positions", []))
        )
        required_return = -target_loss / portfolio_value
        base_scenario = self.generate_hypothetical_scenario("equity_crash_30pct")
        base_equity_return = base_scenario["parameters"]["equity_return"]
        scale_factor = required_return / base_equity_return
        scenario = {
            "name": f"Reverse Stress: {target_loss} Loss",
            "type": "reverse",
            "description": f"Reverse stress scenario to achieve {target_loss} loss",
            "parameters": {
                "equity_return": base_equity_return * scale_factor,
                "volatility_change": base_scenario["parameters"]["volatility_change"],
                "correlation_change": base_scenario["parameters"]["correlation_change"],
                "interest_rate_change": base_scenario["parameters"][
                    "interest_rate_change"
                ],
                "credit_spread_change": base_scenario["parameters"][
                    "credit_spread_change"
                ],
                "liquidity_impact": base_scenario["parameters"]["liquidity_impact"],
                "severity": base_scenario["parameters"]["severity"] * scale_factor,
            },
        }
        return scenario


class PortfolioValuator:
    """
    System for portfolio valuation under stress conditions.
    """

    def __init__(self, config: Any = None) -> None:
        """
        Initialize portfolio valuator.

        Args:
            config (dict, optional): Configuration parameters
        """
        self.config = config or {}

    def value_portfolio(self, portfolio: Any, market_data: Any = None) -> Any:
        """
        Value a portfolio under normal market conditions.

        Args:
            portfolio (dict): Portfolio data
            market_data (dict, optional): Market data

        Returns:
            dict: Valuation result
        """
        total_value = 0
        position_values = {}
        for position in portfolio.get("positions", []):
            position_id = position.get("position_id")
            position_value = position.get("value", 0)
            position_values[position_id] = position_value
            total_value += position_value
        return {"total_value": total_value, "position_values": position_values}

    def value_under_stress(self, portfolio: Any, scenario: Any) -> Any:
        """
        Value a portfolio under stress scenario.

        Args:
            portfolio (dict): Portfolio data
            scenario (dict): Stress scenario

        Returns:
            dict: Valuation result
        """
        base_valuation = self.value_portfolio(portfolio)
        scenario_params = scenario.get("parameters", {})
        stressed_values = {}
        total_stressed_value = 0
        for position in portfolio.get("positions", []):
            position_id = position.get("position_id")
            position_value = position.get("value", 0)
            position_type = position.get("type", "equity")
            if position_type == "equity":
                shock = scenario_params.get("equity_return", 0)
            elif position_type == "fixed_income":
                duration = position.get("duration", 5)
                shock = -duration * scenario_params.get("interest_rate_change", 0)
                credit_duration = position.get("credit_duration", 3)
                shock += -credit_duration * scenario_params.get(
                    "credit_spread_change", 0
                )
            elif position_type == "option":
                underlying_shock = scenario_params.get("equity_return", 0)
                vega = position.get("vega", 0.1)
                volatility_shock = scenario_params.get("volatility_change", 0) - 1
                shock = underlying_shock + vega * volatility_shock
            else:
                shock = scenario_params.get("equity_return", 0) * 0.5
            stressed_value = position_value * (1 + shock)
            stressed_values[position_id] = stressed_value
            total_stressed_value += stressed_value
        total_pnl = total_stressed_value - base_valuation["total_value"]
        position_pnl = {
            position_id: stressed_values[position_id]
            - base_valuation["position_values"][position_id]
            for position_id in stressed_values
        }
        return {
            "base_value": base_valuation["total_value"],
            "stressed_value": total_stressed_value,
            "total_pnl": total_pnl,
            "total_pnl_percent": (
                total_pnl / base_valuation["total_value"]
                if base_valuation["total_value"] > 0
                else 0
            ),
            "position_values": stressed_values,
            "position_pnl": position_pnl,
        }


class ScenarioAnalyzer:
    """
    Framework for scenario-based risk analysis.
    """

    def __init__(self, config: Any = None) -> None:
        """
        Initialize scenario analyzer.

        Args:
            config (dict, optional): Configuration parameters
        """
        self.config = config or {}
        self.portfolio_valuator = PortfolioValuator()

    def get_default_scenarios(self) -> Any:
        """
        Get default scenarios for analysis.

        Returns:
            dict: Default scenarios
        """
        return {
            "base_case": self._create_base_case_scenario(),
            "bullish": self._create_bullish_scenario(),
            "bearish": self._create_bearish_scenario(),
            "high_volatility": self._create_high_volatility_scenario(),
            "low_volatility": self._create_low_volatility_scenario(),
        }

    def analyze_scenario(self, portfolio: Any, scenario: Any) -> Any:
        """
        Analyze portfolio under given scenario.

        Args:
            portfolio (dict): Portfolio data
            scenario (dict): Scenario parameters

        Returns:
            dict: Scenario analysis result
        """
        valuation = self.portfolio_valuator.value_under_stress(portfolio, scenario)
        risk_metrics = self._calculate_risk_metrics(portfolio, scenario)
        performance_metrics = self._calculate_performance_metrics(portfolio, valuation)
        return {
            "scenario": scenario,
            "valuation": valuation,
            "risk_metrics": risk_metrics,
            "performance_metrics": performance_metrics,
            "pnl": valuation["total_pnl"],
        }

    def _create_base_case_scenario(self) -> Any:
        """
        Create base case scenario.

        Returns:
            dict: Base case scenario
        """
        return {
            "name": "Base Case",
            "type": "base",
            "description": "Base case scenario with no shocks",
            "parameters": {
                "equity_return": 0.0,
                "volatility_change": 1.0,
                "correlation_change": 0.0,
                "interest_rate_change": 0.0,
                "credit_spread_change": 0.0,
                "liquidity_impact": 1.0,
                "severity": 1.0,
            },
        }

    def _create_bullish_scenario(self) -> Any:
        """
        Create bullish market scenario.

        Returns:
            dict: Bullish scenario
        """
        return {
            "name": "Bullish",
            "type": "bullish",
            "description": "Bullish market scenario",
            "parameters": {
                "equity_return": 0.1,
                "volatility_change": 0.8,
                "correlation_change": -0.1,
                "interest_rate_change": 0.005,
                "credit_spread_change": -0.005,
                "liquidity_impact": 0.8,
                "severity": 0.8,
            },
        }

    def _create_bearish_scenario(self) -> Any:
        """
        Create bearish market scenario.

        Returns:
            dict: Bearish scenario
        """
        return {
            "name": "Bearish",
            "type": "bearish",
            "description": "Bearish market scenario",
            "parameters": {
                "equity_return": -0.1,
                "volatility_change": 1.2,
                "correlation_change": 0.1,
                "interest_rate_change": -0.005,
                "credit_spread_change": 0.01,
                "liquidity_impact": 1.2,
                "severity": 1.2,
            },
        }

    def _create_high_volatility_scenario(self) -> Any:
        """
        Create high volatility scenario.

        Returns:
            dict: High volatility scenario
        """
        return {
            "name": "High Volatility",
            "type": "volatility",
            "description": "High volatility scenario",
            "parameters": {
                "equity_return": 0.0,
                "volatility_change": 1.5,
                "correlation_change": 0.2,
                "interest_rate_change": 0.0,
                "credit_spread_change": 0.005,
                "liquidity_impact": 1.3,
                "severity": 1.3,
            },
        }

    def _create_low_volatility_scenario(self) -> Any:
        """
        Create low volatility scenario.

        Returns:
            dict: Low volatility scenario
        """
        return {
            "name": "Low Volatility",
            "type": "volatility",
            "description": "Low volatility scenario",
            "parameters": {
                "equity_return": 0.0,
                "volatility_change": 0.7,
                "correlation_change": -0.1,
                "interest_rate_change": 0.0,
                "credit_spread_change": -0.003,
                "liquidity_impact": 0.9,
                "severity": 0.9,
            },
        }

    def _calculate_risk_metrics(self, portfolio: Any, scenario: Any) -> Any:
        """
        Calculate risk metrics under scenario.

        Args:
            portfolio (dict): Portfolio data
            scenario (dict): Scenario parameters

        Returns:
            dict: Risk metrics
        """
        calculator = RiskMetricsCalculator()
        base_metrics = calculator.calculate_var(portfolio)
        scenario_params = scenario.get("parameters", {})
        severity = scenario_params.get("severity", 1.0)
        return {
            "var_95": base_metrics.get("var_95", 0) * severity,
            "var_99": base_metrics.get("var_99", 0) * severity,
            "volatility": calculator.calculate_volatility(portfolio).get(
                "portfolio_volatility", 0
            )
            * scenario_params.get("volatility_change", 1.0),
        }

    def _calculate_performance_metrics(self, portfolio: Any, valuation: Any) -> Any:
        """
        Calculate performance metrics.

        Args:
            portfolio (dict): Portfolio data
            valuation (dict): Valuation result

        Returns:
            dict: Performance metrics
        """
        portfolio_value = sum(
            (p.get("value", 0) for p in portfolio.get("positions", []))
        )
        if portfolio_value > 0:
            return_pct = valuation["total_pnl"] / portfolio_value
        else:
            return_pct = 0
        return {
            "return": return_pct,
            "return_annualized": return_pct * 252,
            "pnl": valuation["total_pnl"],
        }


class SensitivityCalculator:
    """
    Calculator for portfolio sensitivities.
    """

    def __init__(self, config: Any = None) -> None:
        """
        Initialize sensitivity calculator.

        Args:
            config (dict, optional): Configuration parameters
        """
        self.config = config or {}

    def calculate_portfolio_sensitivities(self, portfolio: Any) -> Any:
        """
        Calculate sensitivities for a portfolio.

        Args:
            portfolio (dict): Portfolio data

        Returns:
            dict: Portfolio sensitivities
        """
        total_delta = 0
        total_gamma = 0
        total_vega = 0
        total_theta = 0
        total_rho = 0
        position_sensitivities = {}
        for position in portfolio.get("positions", []):
            position_id = position.get("position_id")
            position.get("value", 0)
            delta = position.get("delta", self._generate_random_delta(position))
            gamma = position.get("gamma", self._generate_random_gamma(position))
            vega = position.get("vega", self._generate_random_vega(position))
            theta = position.get("theta", self._generate_random_theta(position))
            rho = position.get("rho", self._generate_random_rho(position))
            position_sensitivities[position_id] = {
                "delta": delta,
                "gamma": gamma,
                "vega": vega,
                "theta": theta,
                "rho": rho,
            }
            total_delta += delta
            total_gamma += gamma
            total_vega += vega
            total_theta += theta
            total_rho += rho
        return {
            "portfolio": {
                "delta": total_delta,
                "gamma": total_gamma,
                "vega": total_vega,
                "theta": total_theta,
                "rho": total_rho,
            },
            "positions": position_sensitivities,
        }

    def calculate_cross_asset_sensitivities(self, portfolio: Any) -> Any:
        """
        Calculate cross-asset sensitivities.

        Args:
            portfolio (dict): Portfolio data

        Returns:
            dict: Cross-asset sensitivities
        """
        asset_classes = ["equity", "fixed_income", "fx", "commodity"]
        cross_sensitivities = {}
        for asset_class in asset_classes:
            cross_sensitivities[asset_class] = {
                "equity": np.random.normal(0, 0.1),
                "fixed_income": np.random.normal(0, 0.1),
                "fx": np.random.normal(0, 0.1),
                "commodity": np.random.normal(0, 0.1),
            }
        return cross_sensitivities

    def calculate_basis_risk(self, portfolio: Any) -> Any:
        """
        Calculate basis risk.

        Args:
            portfolio (dict): Portfolio data

        Returns:
            dict: Basis risk metrics
        """
        basis_risk = {}
        for position in portfolio.get("positions", []):
            position_id = position.get("position_id")
            position_type = position.get("type", "equity")
            if position_type == "hedge":
                basis_risk[position_id] = {
                    "correlation": np.random.uniform(0.7, 0.95),
                    "tracking_error": np.random.uniform(0.01, 0.05),
                    "hedge_effectiveness": np.random.uniform(0.8, 0.98),
                }
        return basis_risk

    def _generate_random_delta(self, position: Any) -> Any:
        """
        Generate random delta for a position.

        Args:
            position (dict): Position data

        Returns:
            float: Random delta
        """
        position_type = position.get("type", "equity")
        if position_type == "equity":
            return 1.0
        elif position_type == "option":
            option_type = position.get("option_type", "call")
            if option_type == "call":
                return np.random.uniform(0.3, 0.7)
            else:
                return np.random.uniform(-0.7, -0.3)
        else:
            return np.random.uniform(-0.2, 0.2)

    def _generate_random_gamma(self, position: Any) -> Any:
        """
        Generate random gamma for a position.

        Args:
            position (dict): Position data

        Returns:
            float: Random gamma
        """
        position_type = position.get("type", "equity")
        if position_type == "option":
            return np.random.uniform(0.01, 0.1)
        else:
            return 0.0

    def _generate_random_vega(self, position: Any) -> Any:
        """
        Generate random vega for a position.

        Args:
            position (dict): Position data

        Returns:
            float: Random vega
        """
        position_type = position.get("type", "equity")
        if position_type == "option":
            return np.random.uniform(0.1, 0.5)
        else:
            return 0.0

    def _generate_random_theta(self, position: Any) -> Any:
        """
        Generate random theta for a position.

        Args:
            position (dict): Position data

        Returns:
            float: Random theta
        """
        position_type = position.get("type", "equity")
        if position_type == "option":
            return np.random.uniform(-0.05, -0.01)
        else:
            return 0.0

    def _generate_random_rho(self, position: Any) -> Any:
        """
        Generate random rho for a position.

        Args:
            position (dict): Position data

        Returns:
            float: Random rho
        """
        position_type = position.get("type", "equity")
        if position_type == "option":
            option_type = position.get("option_type", "call")
            if option_type == "call":
                return np.random.uniform(0.01, 0.05)
            else:
                return np.random.uniform(-0.05, -0.01)
        elif position_type == "fixed_income":
            return np.random.uniform(-0.2, -0.05)
        else:
            return 0.0


class WhatIfAnalyzer:
    """
    System for what-if analysis.
    """

    def __init__(self, config: Any = None) -> None:
        """
        Initialize what-if analyzer.

        Args:
            config (dict, optional): Configuration parameters
        """
        self.config = config or {}
        self.portfolio_valuator = PortfolioValuator()
        self.risk_calculator = RiskMetricsCalculator()

    def get_default_scenarios(self) -> Any:
        """
        Get default what-if scenarios.

        Returns:
            dict: Default scenarios
        """
        return {
            "double_position": self._create_position_sizing_scenario(2.0),
            "half_position": self._create_position_sizing_scenario(0.5),
            "add_hedge": self._create_hedging_scenario(),
            "market_crash": self._create_market_scenario("crash"),
            "market_rally": self._create_market_scenario("rally"),
        }

    def analyze_scenario(self, portfolio: Any, scenario: Any) -> Any:
        """
        Analyze what-if scenario.

        Args:
            portfolio (dict): Portfolio data
            scenario (dict): What-if scenario

        Returns:
            dict: Scenario analysis result
        """
        modified_portfolio = self._apply_scenario(portfolio, scenario)
        original_valuation = self.portfolio_valuator.value_portfolio(portfolio)
        modified_valuation = self.portfolio_valuator.value_portfolio(modified_portfolio)
        original_risk = self.risk_calculator.calculate_var(portfolio)
        modified_risk = self.risk_calculator.calculate_var(modified_portfolio)
        value_change = (
            modified_valuation["total_value"] - original_valuation["total_value"]
        )
        risk_change = modified_risk.get("var_95", 0) - original_risk.get("var_95", 0)
        return {
            "scenario": scenario,
            "original_portfolio": {
                "value": original_valuation["total_value"],
                "risk": original_risk.get("var_95", 0),
            },
            "modified_portfolio": {
                "value": modified_valuation["total_value"],
                "risk": modified_risk.get("var_95", 0),
            },
            "changes": {
                "value": value_change,
                "value_percent": (
                    value_change / original_valuation["total_value"]
                    if original_valuation["total_value"] > 0
                    else 0
                ),
                "risk": risk_change,
                "risk_percent": (
                    risk_change / original_risk.get("var_95", 1)
                    if original_risk.get("var_95", 0) != 0
                    else 0
                ),
            },
        }

    def _create_position_sizing_scenario(self, size_factor: Any) -> Any:
        """
        Create position sizing scenario.

        Args:
            size_factor (float): Size factor

        Returns:
            dict: Position sizing scenario
        """
        return {
            "name": f"Position Sizing: {size_factor}x",
            "type": "position_sizing",
            "description": f"Adjust all positions by factor of {size_factor}",
            "parameters": {"size_factor": size_factor},
        }

    def _create_hedging_scenario(self) -> Any:
        """
        Create hedging scenario.

        Returns:
            dict: Hedging scenario
        """
        return {
            "name": "Add Hedge",
            "type": "hedging",
            "description": "Add hedging positions to reduce risk",
            "parameters": {"hedge_ratio": 0.5, "hedge_instrument": "index_put"},
        }

    def _create_market_scenario(self, scenario_type: Any) -> Any:
        """
        Create market scenario.

        Args:
            scenario_type (str): Scenario type

        Returns:
            dict: Market scenario
        """
        if scenario_type == "crash":
            return {
                "name": "Market Crash",
                "type": "market",
                "description": "Simulate market crash",
                "parameters": {
                    "equity_return": -0.2,
                    "volatility_change": 2.0,
                    "correlation_change": 0.3,
                },
            }
        elif scenario_type == "rally":
            return {
                "name": "Market Rally",
                "type": "market",
                "description": "Simulate market rally",
                "parameters": {
                    "equity_return": 0.15,
                    "volatility_change": 0.7,
                    "correlation_change": -0.1,
                },
            }
        else:
            return {
                "name": "Neutral Market",
                "type": "market",
                "description": "Simulate neutral market",
                "parameters": {
                    "equity_return": 0.0,
                    "volatility_change": 1.0,
                    "correlation_change": 0.0,
                },
            }

    def _apply_scenario(self, portfolio: Any, scenario: Any) -> Any:
        """
        Apply what-if scenario to portfolio.

        Args:
            portfolio (dict): Portfolio data
            scenario (dict): What-if scenario

        Returns:
            dict: Modified portfolio
        """
        modified_portfolio = json.loads(json.dumps(portfolio))
        scenario_type = scenario.get("type")
        params = scenario.get("parameters", {})
        if scenario_type == "position_sizing":
            size_factor = params.get("size_factor", 1.0)
            for i, position in enumerate(modified_portfolio.get("positions", [])):
                position_value = position.get("value", 0)
                modified_portfolio["positions"][i]["value"] = (
                    position_value * size_factor
                )
        elif scenario_type == "hedging":
            hedge_ratio = params.get("hedge_ratio", 0.5)
            hedge_instrument = params.get("hedge_instrument", "index_put")
            portfolio_value = sum(
                (p.get("value", 0) for p in portfolio.get("positions", []))
            )
            hedge_position = {
                "position_id": f"hedge_{hedge_instrument}",
                "type": "option",
                "option_type": "put",
                "value": portfolio_value * hedge_ratio * -1,
                "delta": -0.5,
                "gamma": 0.05,
                "vega": 0.2,
                "theta": -0.02,
                "rho": -0.03,
            }
            modified_portfolio["positions"].append(hedge_position)
        elif scenario_type == "market":
            equity_return = params.get("equity_return", 0.0)
            for i, position in enumerate(modified_portfolio.get("positions", [])):
                position_value = position.get("value", 0)
                position_type = position.get("type", "equity")
                if position_type == "equity":
                    modified_portfolio["positions"][i]["value"] = position_value * (
                        1 + equity_return
                    )
        return modified_portfolio
