from typing import Any

"""
Circuit Breaker implementation for Optionix platform.

This module provides a framework for implementing and managing circuit breakers
to protect against extreme market conditions and volatility.
"""

import logging
import threading
import time
from datetime import datetime, timedelta
from enum import Enum
import numpy as np

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class CircuitBreakerStatus(Enum):
    """Enum for circuit breaker status values"""

    INACTIVE = "INACTIVE"
    ACTIVE = "ACTIVE"
    MONITORING = "MONITORING"


class CircuitBreakerType(Enum):
    """Enum for circuit breaker types"""

    PRICE_MOVEMENT = "PRICE_MOVEMENT"
    VOLATILITY = "VOLATILITY"
    VOLUME = "VOLUME"
    LIQUIDITY = "LIQUIDITY"
    CUSTOM = "CUSTOM"


class CircuitBreaker:
    """
    Framework for implementing and managing circuit breakers.

    Circuit breakers are mechanisms that temporarily halt trading when market
    conditions exceed predefined thresholds, helping to prevent extreme price
    movements and market disruption.
    """

    def __init__(self, config: Any = None) -> None:
        """
        Initialize circuit breaker framework.

        Args:
            config (dict, optional): Configuration parameters
        """
        self.config = config or {}
        self.active_breakers = {}
        self.breaker_history = {}
        self.market_monitor = MarketMonitor()
        self._lock = threading.RLock()
        self._monitoring_thread = None
        self._stop_monitoring = threading.Event()

    def start_monitoring(self, interval_seconds: Any = 5) -> Any:
        """
        Start monitoring thread for circuit breakers.

        Args:
            interval_seconds (int): Monitoring interval in seconds
        """
        if self._monitoring_thread is not None and self._monitoring_thread.is_alive():
            logger.warning("Monitoring thread already running")
            return
        self._stop_monitoring.clear()
        self._monitoring_thread = threading.Thread(
            target=self._monitor_market_conditions,
            args=(interval_seconds,),
            daemon=True,
        )
        self._monitoring_thread.start()
        logger.info(
            f"Circuit breaker monitoring started with interval {interval_seconds}s"
        )

    def stop_monitoring(self) -> Any:
        """Stop monitoring thread for circuit breakers."""
        if self._monitoring_thread is None or not self._monitoring_thread.is_alive():
            logger.warning("Monitoring thread not running")
            return
        self._stop_monitoring.set()
        self._monitoring_thread.join(timeout=10)
        logger.info("Circuit breaker monitoring stopped")

    def _monitor_market_conditions(self, interval_seconds: Any) -> Any:
        """
        Monitor market conditions for circuit breaker triggers.

        Args:
            interval_seconds (int): Monitoring interval in seconds
        """
        while not self._stop_monitoring.is_set():
            try:
                instruments = self.market_monitor.get_all_instruments()
                for instrument in instruments:
                    self.check_conditions(instrument)
                self._check_breaker_expiry()
            except Exception as e:
                logger.error(f"Error in circuit breaker monitoring: {str(e)}")
            time.sleep(interval_seconds)

    def check_conditions(self, instrument: Any) -> Any:
        """
        Check market conditions for circuit breaker triggers.

        Args:
            instrument (str): Instrument identifier

        Returns:
            bool: True if any circuit breaker was activated, False otherwise
        """
        with self._lock:
            if instrument in self.active_breakers:
                return False
            market_data = self.market_monitor.get_market_data(instrument)
            if not market_data:
                logger.warning(f"No market data available for {instrument}")
                return False
            if self._check_price_movement(instrument, market_data):
                return True
            if self._check_volatility(instrument, market_data):
                return True
            if self._check_volume(instrument, market_data):
                return True
            if self._check_liquidity(instrument, market_data):
                return True
            return False

    def _check_price_movement(self, instrument: Any, market_data: Any) -> Any:
        """
        Check price movement for circuit breaker trigger.

        Args:
            instrument (str): Instrument identifier
            market_data (dict): Market data

        Returns:
            bool: True if circuit breaker triggered, False otherwise
        """
        config = self.config.get("price_movement", {})
        enabled = config.get("enabled", True)
        if not enabled:
            return False
        thresholds = config.get(
            "thresholds",
            {
                "level1": {"change_percent": 7, "duration_minutes": 15},
                "level2": {"change_percent": 13, "duration_minutes": 30},
                "level3": {"change_percent": 20, "duration_minutes": 60},
            },
        )
        price_history = market_data.get("price_history", [])
        if len(price_history) < 2:
            return False
        current_price = price_history[-1]["price"]
        reference_price = market_data.get("reference_price")
        if reference_price is None:
            reference_price = price_history[0]["price"]
        price_change_percent = (
            abs((current_price - reference_price) / reference_price) * 100
        )
        for level, threshold in thresholds.items():
            if price_change_percent >= threshold["change_percent"]:
                self.activate_circuit_breaker(
                    instrument,
                    CircuitBreakerType.PRICE_MOVEMENT,
                    f"Price change of {price_change_percent:.2f}% exceeded {level} threshold of {threshold['change_percent']}%",
                    threshold["duration_minutes"],
                    {
                        "level": level,
                        "price_change_percent": price_change_percent,
                        "current_price": current_price,
                        "reference_price": reference_price,
                    },
                )
                return True
        return False

    def _check_volatility(self, instrument: Any, market_data: Any) -> Any:
        """
        Check volatility for circuit breaker trigger.

        Args:
            instrument (str): Instrument identifier
            market_data (dict): Market data

        Returns:
            bool: True if circuit breaker triggered, False otherwise
        """
        config = self.config.get("volatility", {})
        enabled = config.get("enabled", True)
        if not enabled:
            return False
        thresholds = config.get(
            "thresholds",
            {
                "level1": {"volatility": 0.05, "duration_minutes": 15},
                "level2": {"volatility": 0.08, "duration_minutes": 30},
                "level3": {"volatility": 0.12, "duration_minutes": 60},
            },
        )
        current_volatility = market_data.get("current_volatility")
        if current_volatility is None:
            price_history = market_data.get("price_history", [])
            if len(price_history) < 30:
                return False
            prices = [p["price"] for p in price_history[-30:]]
            returns = np.diff(np.log(prices))
            current_volatility = np.std(returns) * np.sqrt(252)
        for level, threshold in thresholds.items():
            if current_volatility >= threshold["volatility"]:
                self.activate_circuit_breaker(
                    instrument,
                    CircuitBreakerType.VOLATILITY,
                    f"Volatility of {current_volatility:.4f} exceeded {level} threshold of {threshold['volatility']}",
                    threshold["duration_minutes"],
                    {"level": level, "current_volatility": current_volatility},
                )
                return True
        return False

    def _check_volume(self, instrument: Any, market_data: Any) -> Any:
        """
        Check volume for circuit breaker trigger.

        Args:
            instrument (str): Instrument identifier
            market_data (dict): Market data

        Returns:
            bool: True if circuit breaker triggered, False otherwise
        """
        config = self.config.get("volume", {})
        enabled = config.get("enabled", True)
        if not enabled:
            return False
        thresholds = config.get(
            "thresholds",
            {
                "level1": {"volume_ratio": 3, "duration_minutes": 15},
                "level2": {"volume_ratio": 5, "duration_minutes": 30},
                "level3": {"volume_ratio": 10, "duration_minutes": 60},
            },
        )
        current_volume = market_data.get("current_volume")
        average_volume = market_data.get("average_volume")
        if current_volume is None or average_volume is None or average_volume == 0:
            return False
        volume_ratio = current_volume / average_volume
        for level, threshold in thresholds.items():
            if volume_ratio >= threshold["volume_ratio"]:
                self.activate_circuit_breaker(
                    instrument,
                    CircuitBreakerType.VOLUME,
                    f"Volume ratio of {volume_ratio:.2f} exceeded {level} threshold of {threshold['volume_ratio']}",
                    threshold["duration_minutes"],
                    {
                        "level": level,
                        "volume_ratio": volume_ratio,
                        "current_volume": current_volume,
                        "average_volume": average_volume,
                    },
                )
                return True
        return False

    def _check_liquidity(self, instrument: Any, market_data: Any) -> Any:
        """
        Check liquidity for circuit breaker trigger.

        Args:
            instrument (str): Instrument identifier
            market_data (dict): Market data

        Returns:
            bool: True if circuit breaker triggered, False otherwise
        """
        config = self.config.get("liquidity", {})
        enabled = config.get("enabled", True)
        if not enabled:
            return False
        thresholds = config.get(
            "thresholds",
            {
                "level1": {"spread_ratio": 3, "duration_minutes": 15},
                "level2": {"spread_ratio": 5, "duration_minutes": 30},
                "level3": {"spread_ratio": 10, "duration_minutes": 60},
            },
        )
        current_spread = market_data.get("current_spread")
        average_spread = market_data.get("average_spread")
        if current_spread is None or average_spread is None or average_spread == 0:
            return False
        spread_ratio = current_spread / average_spread
        for level, threshold in thresholds.items():
            if spread_ratio >= threshold["spread_ratio"]:
                self.activate_circuit_breaker(
                    instrument,
                    CircuitBreakerType.LIQUIDITY,
                    f"Spread ratio of {spread_ratio:.2f} exceeded {level} threshold of {threshold['spread_ratio']}",
                    threshold["duration_minutes"],
                    {
                        "level": level,
                        "spread_ratio": spread_ratio,
                        "current_spread": current_spread,
                        "average_spread": average_spread,
                    },
                )
                return True
        return False

    def activate_circuit_breaker(
        self,
        instrument: Any,
        breaker_type: Any,
        reason: Any,
        duration_minutes: Any,
        data: Any = None,
    ) -> Any:
        """
        Activate circuit breaker for an instrument.

        Args:
            instrument (str): Instrument identifier
            breaker_type (CircuitBreakerType): Type of circuit breaker
            reason (str): Reason for activation
            duration_minutes (int): Duration in minutes
            data (dict, optional): Additional data

        Returns:
            dict: Activated circuit breaker
        """
        with self._lock:
            breaker_type = (
                breaker_type
                if isinstance(breaker_type, CircuitBreakerType)
                else CircuitBreakerType(breaker_type)
            )
            now = datetime.now()
            breaker = {
                "instrument": instrument,
                "type": breaker_type.value,
                "reason": reason,
                "activated_at": now,
                "expires_at": now + timedelta(minutes=duration_minutes),
                "status": CircuitBreakerStatus.ACTIVE.value,
                "data": data or {},
            }
            self.active_breakers[instrument] = breaker
            if instrument not in self.breaker_history:
                self.breaker_history[instrument] = []
            self.breaker_history[instrument].append(breaker)
            logger.warning(f"Circuit breaker activated for {instrument}: {reason}")
            return breaker

    def deactivate_circuit_breaker(self, instrument: Any, reason: Any = None) -> Any:
        """
        Deactivate circuit breaker for an instrument.

        Args:
            instrument (str): Instrument identifier
            reason (str, optional): Reason for deactivation

        Returns:
            bool: True if deactivated, False if not found
        """
        with self._lock:
            if instrument not in self.active_breakers:
                return False
            breaker = self.active_breakers[instrument]
            breaker["status"] = CircuitBreakerStatus.INACTIVE.value
            breaker["deactivated_at"] = datetime.now()
            breaker["deactivation_reason"] = reason or "Manual deactivation"
            del self.active_breakers[instrument]
            for i, hist_breaker in enumerate(self.breaker_history[instrument]):
                if (
                    hist_breaker["activated_at"] == breaker["activated_at"]
                    and hist_breaker["type"] == breaker["type"]
                ):
                    self.breaker_history[instrument][i] = breaker
                    break
            logger.info(
                f"Circuit breaker deactivated for {instrument}: {reason or 'Manual deactivation'}"
            )
            return True

    def _check_breaker_expiry(self) -> Any:
        """Check if any active circuit breakers have expired."""
        with self._lock:
            now = datetime.now()
            expired = []
            for instrument, breaker in self.active_breakers.items():
                if now >= breaker["expires_at"]:
                    expired.append(instrument)
            for instrument in expired:
                self.deactivate_circuit_breaker(instrument, "Expiration")

    def is_active(self, instrument: Any) -> Any:
        """
        Check if circuit breaker is active for an instrument.

        Args:
            instrument (str): Instrument identifier

        Returns:
            bool: True if active, False otherwise
        """
        with self._lock:
            return instrument in self.active_breakers

    def get_active_breakers(self) -> Any:
        """
        Get all active circuit breakers.

        Returns:
            dict: Active circuit breakers
        """
        with self._lock:
            return self.active_breakers.copy()

    def get_breaker_history(
        self, instrument: Any = None, start_time: Any = None, end_time: Any = None
    ) -> Any:
        """
        Get circuit breaker history.

        Args:
            instrument (str, optional): Filter by instrument
            start_time (datetime, optional): Filter by start time
            end_time (datetime, optional): Filter by end time

        Returns:
            list: Circuit breaker history
        """
        with self._lock:
            if instrument:
                history = self.breaker_history.get(instrument, [])
            else:
                history = []
                for inst_history in self.breaker_history.values():
                    history.extend(inst_history)
            if start_time:
                history = [b for b in history if b["activated_at"] >= start_time]
            if end_time:
                history = [b for b in history if b["activated_at"] <= end_time]
            history.sort(key=lambda b: b["activated_at"], reverse=True)
            return history

    def get_breaker_statistics(
        self, start_time: Any = None, end_time: Any = None
    ) -> Any:
        """
        Get circuit breaker statistics.

        Args:
            start_time (datetime, optional): Filter by start time
            end_time (datetime, optional): Filter by end time

        Returns:
            dict: Circuit breaker statistics
        """
        history = self.get_breaker_history(start_time=start_time, end_time=end_time)
        if not history:
            return {"total_activations": 0, "by_type": {}, "by_instrument": {}}
        by_type = {}
        by_instrument = {}
        for breaker in history:
            breaker_type = breaker["type"]
            if breaker_type not in by_type:
                by_type[breaker_type] = 0
            by_type[breaker_type] += 1
            instrument = breaker["instrument"]
            if instrument not in by_instrument:
                by_instrument[instrument] = 0
            by_instrument[instrument] += 1
        return {
            "total_activations": len(history),
            "by_type": by_type,
            "by_instrument": by_instrument,
        }


class MarketMonitor:
    """
    System for monitoring market conditions.
    """

    def __init__(self, config: Any = None) -> None:
        """
        Initialize market monitor.

        Args:
            config (dict, optional): Configuration parameters
        """
        self.config = config or {}
        self.market_data = {}
        self._lock = threading.RLock()

    def update_market_data(self, instrument: Any, data: Any) -> Any:
        """
        Update market data for an instrument.

        Args:
            instrument (str): Instrument identifier
            data (dict): Market data

        Returns:
            dict: Updated market data
        """
        with self._lock:
            if instrument not in self.market_data:
                self.market_data[instrument] = {
                    "price_history": [],
                    "volume_history": [],
                    "spread_history": [],
                }
            if "price" in data:
                price_entry = {
                    "price": data["price"],
                    "timestamp": data.get("timestamp", datetime.now()),
                }
                self.market_data[instrument]["price_history"].append(price_entry)
                max_history = self.config.get("max_price_history", 1000)
                if len(self.market_data[instrument]["price_history"]) > max_history:
                    self.market_data[instrument]["price_history"] = self.market_data[
                        instrument
                    ]["price_history"][-max_history:]
            if "volume" in data:
                volume_entry = {
                    "volume": data["volume"],
                    "timestamp": data.get("timestamp", datetime.now()),
                }
                self.market_data[instrument]["volume_history"].append(volume_entry)
                max_history = self.config.get("max_volume_history", 1000)
                if len(self.market_data[instrument]["volume_history"]) > max_history:
                    self.market_data[instrument]["volume_history"] = self.market_data[
                        instrument
                    ]["volume_history"][-max_history:]
            if "spread" in data:
                spread_entry = {
                    "spread": data["spread"],
                    "timestamp": data.get("timestamp", datetime.now()),
                }
                self.market_data[instrument]["spread_history"].append(spread_entry)
                max_history = self.config.get("max_spread_history", 1000)
                if len(self.market_data[instrument]["spread_history"]) > max_history:
                    self.market_data[instrument]["spread_history"] = self.market_data[
                        instrument
                    ]["spread_history"][-max_history:]
            for key, value in data.items():
                if key not in ["price_history", "volume_history", "spread_history"]:
                    self.market_data[instrument][key] = value
            self._calculate_derived_metrics(instrument)
            return self.market_data[instrument]

    def _calculate_derived_metrics(self, instrument: Any) -> Any:
        """
        Calculate derived metrics for an instrument.

        Args:
            instrument (str): Instrument identifier
        """
        data = self.market_data[instrument]
        if len(data["price_history"]) >= 30:
            prices = [p["price"] for p in data["price_history"][-30:]]
            returns = np.diff(np.log(prices))
            data["current_volatility"] = np.std(returns) * np.sqrt(252)
        if len(data["volume_history"]) > 0:
            volumes = [v["volume"] for v in data["volume_history"]]
            data["average_volume"] = np.mean(volumes)
        if len(data["spread_history"]) > 0:
            spreads = [s["spread"] for s in data["spread_history"]]
            data["average_spread"] = np.mean(spreads)

    def get_market_data(self, instrument: Any) -> Any:
        """
        Get market data for an instrument.

        Args:
            instrument (str): Instrument identifier

        Returns:
            dict: Market data or None if not found
        """
        with self._lock:
            return self.market_data.get(instrument)

    def get_all_instruments(self) -> Any:
        """
        Get all instruments with market data.

        Returns:
            list: Instrument identifiers
        """
        with self._lock:
            return list(self.market_data.keys())

    def calculate_volatility(self, instrument: Any, window: Any = 30) -> Any:
        """
        Calculate volatility for an instrument.

        Args:
            instrument (str): Instrument identifier
            window (int): Window size for calculation

        Returns:
            float: Volatility or None if insufficient data
        """
        with self._lock:
            data = self.get_market_data(instrument)
            if not data or len(data["price_history"]) < window:
                return None
            prices = [p["price"] for p in data["price_history"][-window:]]
            returns = np.diff(np.log(prices))
            return np.std(returns) * np.sqrt(252)

    def calculate_price_change(self, instrument: Any, window: Any = 1) -> Any:
        """
        Calculate price change for an instrument.

        Args:
            instrument (str): Instrument identifier
            window (int): Window size for calculation

        Returns:
            float: Price change percentage or None if insufficient data
        """
        with self._lock:
            data = self.get_market_data(instrument)
            if not data or len(data["price_history"]) < window + 1:
                return None
            current_price = data["price_history"][-1]["price"]
            previous_price = data["price_history"][-window - 1]["price"]
            return (current_price - previous_price) / previous_price * 100

    def detect_anomalies(
        self, instrument: Any, method: Any = "zscore", threshold: Any = 3.0
    ) -> Any:
        """
        Detect anomalies in market data.

        Args:
            instrument (str): Instrument identifier
            method (str): Anomaly detection method
            threshold (float): Anomaly threshold

        Returns:
            list: Detected anomalies
        """
        with self._lock:
            data = self.get_market_data(instrument)
            if not data:
                return []
            anomalies = []
            if len(data["price_history"]) > 30:
                prices = [p["price"] for p in data["price_history"][-30:]]
                if method == "zscore":
                    mean_price = np.mean(prices[:-1])
                    std_price = np.std(prices[:-1])
                    if std_price > 0:
                        current_price = prices[-1]
                        zscore = abs(current_price - mean_price) / std_price
                        if zscore > threshold:
                            anomalies.append(
                                {
                                    "type": "price",
                                    "value": current_price,
                                    "zscore": zscore,
                                    "threshold": threshold,
                                }
                            )
            if len(data["volume_history"]) > 30:
                volumes = [v["volume"] for v in data["volume_history"][-30:]]
                if method == "zscore":
                    mean_volume = np.mean(volumes[:-1])
                    std_volume = np.std(volumes[:-1])
                    if std_volume > 0:
                        current_volume = volumes[-1]
                        zscore = abs(current_volume - mean_volume) / std_volume
                        if zscore > threshold:
                            anomalies.append(
                                {
                                    "type": "volume",
                                    "value": current_volume,
                                    "zscore": zscore,
                                    "threshold": threshold,
                                }
                            )
            return anomalies


class AlertSystem:
    """
    System for generating alerts and notifications.
    """

    def __init__(self) -> None:
        """Initialize alert system."""
        self.alerts = []
        self.alert_handlers = []
        self._lock = threading.RLock()

    def generate_alert(self, level: Any, message: Any, data: Any = None) -> Any:
        """
        Generate an alert.

        Args:
            level (str): Alert level ('info', 'warning', 'high', 'critical')
            message (str): Alert message
            data (dict, optional): Additional data

        Returns:
            dict: Generated alert
        """
        with self._lock:
            alert = {
                "id": len(self.alerts) + 1,
                "level": level,
                "message": message,
                "timestamp": datetime.now(),
                "data": data or {},
                "acknowledged": False,
            }
            self.alerts.append(alert)
            log_method = getattr(
                logger,
                (
                    level.lower()
                    if level.lower() in ["info", "warning", "critical"]
                    else "warning"
                ),
            )
            log_method(f"Alert: {message}")
            for handler in self.alert_handlers:
                try:
                    handler(alert)
                except Exception as e:
                    logger.error(f"Error in alert handler: {str(e)}")
            return alert

    def acknowledge_alert(self, alert_id: Any) -> Any:
        """
        Acknowledge an alert.

        Args:
            alert_id (int): Alert ID

        Returns:
            bool: True if acknowledged, False if not found
        """
        with self._lock:
            for i, alert in enumerate(self.alerts):
                if alert["id"] == alert_id:
                    self.alerts[i]["acknowledged"] = True
                    self.alerts[i]["acknowledged_at"] = datetime.now()
                    return True
            return False

    def get_alerts(
        self,
        level: Any = None,
        acknowledged: Any = None,
        start_time: Any = None,
        end_time: Any = None,
    ) -> Any:
        """
        Get alerts with filtering.

        Args:
            level (str, optional): Filter by alert level
            acknowledged (bool, optional): Filter by acknowledgment status
            start_time (datetime, optional): Filter by start time
            end_time (datetime, optional): Filter by end time

        Returns:
            list: Filtered alerts
        """
        with self._lock:
            filtered_alerts = self.alerts.copy()
            if level is not None:
                filtered_alerts = [a for a in filtered_alerts if a["level"] == level]
            if acknowledged is not None:
                filtered_alerts = [
                    a for a in filtered_alerts if a["acknowledged"] == acknowledged
                ]
            if start_time is not None:
                filtered_alerts = [
                    a for a in filtered_alerts if a["timestamp"] >= start_time
                ]
            if end_time is not None:
                filtered_alerts = [
                    a for a in filtered_alerts if a["timestamp"] <= end_time
                ]
            return filtered_alerts

    def add_alert_handler(self, handler: Any) -> Any:
        """
        Add an alert handler function.

        Args:
            handler (callable): Function to call when alerts are generated

        Returns:
            int: Handler ID
        """
        with self._lock:
            self.alert_handlers.append(handler)
            return len(self.alert_handlers) - 1

    def remove_alert_handler(self, handler_id: Any) -> Any:
        """
        Remove an alert handler.

        Args:
            handler_id (int): Handler ID

        Returns:
            bool: True if removed, False if not found
        """
        with self._lock:
            if 0 <= handler_id < len(self.alert_handlers):
                self.alert_handlers.pop(handler_id)
                return True
            return False
