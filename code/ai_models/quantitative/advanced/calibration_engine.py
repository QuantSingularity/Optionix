import logging
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

import numpy as np

from ..black_scholes import bs_price, implied_volatility_from_price
from .local_volatility import CEVModel, DupireLocalVolModel
from .stochastic_volatility import HestonModel, SabrModel

logger = logging.getLogger(__name__)

OptionData = Union[Dict[str, Any], Sequence[Dict[str, Any]]]


class CalibrationEngine:
    def __init__(
        self,
        spot: Optional[float] = None,
        rate: float = 0.02,
        dividend: float = 0.0,
    ) -> None:
        self.spot = spot
        self.rate = rate
        self.dividend = dividend

    def _resolve_spot(self, spot: Optional[float]) -> float:
        value = spot if spot is not None else self.spot
        if value is None or value <= 0:
            raise ValueError("A positive spot price is required for calibration")
        return float(value)

    @staticmethod
    def _flatten(option_data: OptionData) -> List[Dict[str, Any]]:
        if isinstance(option_data, dict):
            flat = []
            for side, option_type in (("calls", "call"), ("puts", "put")):
                for entry in option_data.get(side, []):
                    item = dict(entry)
                    item.setdefault("option_type", option_type)
                    flat.append(item)
            return flat
        return [dict(item) for item in option_data]

    def _normalise(
        self,
        option_data: OptionData,
        spot: float,
        rate: float,
        dividend: float,
    ) -> List[Dict[str, Any]]:
        normalised = []
        for item in self._flatten(option_data):
            expiry = float(item.get("expiry", item.get("time_to_expiry", 0.5)))
            option_type = str(item.get("option_type", "call")).lower()
            strike = float(item["strike"])
            if expiry <= 0 or strike <= 0:
                continue
            price = item.get("price", item.get("market_price"))
            if price is None:
                iv = item.get(
                    "iv", item.get("implied_volatility", item.get("market_vol"))
                )
                if iv is None:
                    raise ValueError(
                        "Each option needs a price or an implied volatility"
                    )
                price = float(
                    bs_price(
                        spot, strike, expiry, rate, float(iv), dividend, option_type
                    )
                )
            normalised.append(
                {
                    "strike": strike,
                    "expiry": expiry,
                    "price": float(price),
                    "option_type": option_type,
                }
            )
        if not normalised:
            raise ValueError("No usable option data supplied")
        return normalised

    def calibrate_heston(
        self,
        option_data: OptionData,
        initial_params: Optional[Dict[str, float]] = None,
        spot: Optional[float] = None,
        rate: Optional[float] = None,
        dividend: Optional[float] = None,
    ) -> Dict[str, Any]:
        s = self._resolve_spot(spot)
        r = self.rate if rate is None else rate
        q = self.dividend if dividend is None else dividend
        quotes = [
            {
                "spot": s,
                "strike": o["strike"],
                "time_to_expiry": o["expiry"],
                "rate": r,
                "dividend": q,
                "option_type": o["option_type"],
                "market_price": o["price"],
            }
            for o in self._normalise(option_data, s, r, q)
        ]
        model = HestonModel(initial_params)
        params = model.calibrate(quotes)
        return {"parameters": params, "diagnostics": model.calibration_info}

    def calibrate_sabr(
        self,
        option_data: OptionData,
        initial_params: Optional[Dict[str, float]] = None,
        spot: Optional[float] = None,
        rate: Optional[float] = None,
        dividend: Optional[float] = None,
        fix_beta: bool = True,
    ) -> Dict[str, Any]:
        s = self._resolve_spot(spot)
        r = self.rate if rate is None else rate
        q = self.dividend if dividend is None else dividend
        quotes = []
        for o in self._normalise(option_data, s, r, q):
            forward = s * np.exp((r - q) * o["expiry"])
            try:
                vol = implied_volatility_from_price(
                    o["price"], s, o["strike"], o["expiry"], r, q, o["option_type"]
                )
            except ValueError:
                continue
            quotes.append(
                {
                    "strike": o["strike"],
                    "forward": float(forward),
                    "time_to_expiry": o["expiry"],
                    "market_vol": vol,
                }
            )
        model = SabrModel(initial_params)
        params = model.calibrate(quotes, fix_beta=fix_beta)
        return {"parameters": params, "diagnostics": model.calibration_info}

    def calibrate_local_volatility(
        self,
        option_data: OptionData,
        spot: Optional[float] = None,
        rate: Optional[float] = None,
        dividend: Optional[float] = None,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        s = self._resolve_spot(spot)
        r = self.rate if rate is None else rate
        q = self.dividend if dividend is None else dividend
        options = self._normalise(option_data, s, r, q)
        return DupireLocalVolModel().calibrate(options, s, r, q)

    def calibrate_cev(
        self,
        option_data: OptionData,
        spot: Optional[float] = None,
        rate: Optional[float] = None,
        dividend: Optional[float] = None,
        fix_beta: bool = False,
    ) -> Dict[str, float]:
        s = self._resolve_spot(spot)
        r = self.rate if rate is None else rate
        q = self.dividend if dividend is None else dividend
        return CEVModel().calibrate(
            self._normalise(option_data, s, r, q), s, r, q, fix_beta=fix_beta
        )

    def _bs_price_from_iv(
        self,
        iv: float,
        strike: float,
        time_to_expiry: float,
        option_type: str,
        spot: Optional[float] = None,
        rate: Optional[float] = None,
        dividend: Optional[float] = None,
    ) -> float:
        return float(
            bs_price(
                self._resolve_spot(spot),
                strike,
                time_to_expiry,
                self.rate if rate is None else rate,
                iv,
                self.dividend if dividend is None else dividend,
                option_type,
            )
        )
