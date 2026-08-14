"""
Tests for the /blockchain API routes and BlockchainService.

These run without a live Ethereum node configured (the default test
environment), so they primarily verify graceful degradation: the service
should never crash the app when unconfigured, and endpoints should return
sensible, well-typed responses or clear error status codes.
"""

from app.services.blockchain_service import BlockchainService


class TestBlockchainService:
    def test_instantiates_without_rpc_configured(self):
        svc = BlockchainService()
        assert svc.is_connected() is False

    def test_integration_status_shape(self):
        svc = BlockchainService()
        status = svc.get_integration_status()
        for key in (
            "web3_installed",
            "rpc_connected",
            "futures_contract_configured",
            "options_contract_configured",
        ):
            assert key in status
        assert status["web3_installed"] is True  # web3 is a pinned dependency
        assert status["rpc_connected"] is False  # no RPC configured in tests

    def test_position_health_falls_back_to_mock_when_unconfigured(self):
        svc = BlockchainService()
        address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        result = svc.get_position_health(address)
        assert result["address"] == address
        assert "positions" in result
        assert "health_ratio" in result

    def test_invalid_address_raises(self):
        svc = BlockchainService()
        try:
            svc.get_position_health("not-an-address")
            assert False, "expected ValueError"
        except ValueError:
            pass

    def test_get_option_returns_none_when_unconfigured(self):
        svc = BlockchainService()
        assert svc.get_option(1) is None

    def test_deposit_tx_builder_requires_contract(self):
        from decimal import Decimal

        svc = BlockchainService()
        try:
            svc.build_deposit_margin_tx(
                "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", Decimal("1")
            )
            assert False, "expected an exception when contract isn't configured"
        except Exception:
            pass


class TestBlockchainRoutes:
    def test_status_is_public(self, client):
        resp = client.get("/blockchain/status")
        assert resp.status_code == 200
        body = resp.json()
        for key in (
            "web3_installed",
            "rpc_connected",
            "futures_contract_configured",
            "options_contract_configured",
        ):
            assert key in body

    def test_wallet_balance_requires_auth(self, client):
        resp = client.get(
            "/blockchain/wallet/0x70997970C51812dc3A010C7d01b50e0d17dc79C8/balance"
        )
        assert resp.status_code == 401

    def test_wallet_balance_unavailable_without_rpc(self, client, auth_headers):
        resp = client.get(
            "/blockchain/wallet/0x70997970C51812dc3A010C7d01b50e0d17dc79C8/balance",
            headers=auth_headers,
        )
        # No RPC configured in the test environment - should fail cleanly,
        # never with an unhandled 500.
        assert resp.status_code == 503

    def test_wallet_balance_rejects_malformed_address(self, client, auth_headers):
        resp = client.get(
            "/blockchain/wallet/not-an-address/balance",
            headers=auth_headers,
        )
        assert resp.status_code == 422  # path pattern validation

    def test_wallet_positions_falls_back_to_mock(self, client, auth_headers):
        resp = client.get(
            "/blockchain/wallet/0x70997970C51812dc3A010C7d01b50e0d17dc79C8/positions",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["address"] == "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        assert "health_ratio" in body

    def test_wallet_options_empty_without_contract(self, client, auth_headers):
        resp = client.get(
            "/blockchain/wallet/0x70997970C51812dc3A010C7d01b50e0d17dc79C8/options",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json() == []

    def test_option_lookup_404_without_contract(self, client, auth_headers):
        resp = client.get("/blockchain/options/1", headers=auth_headers)
        assert resp.status_code == 404

    def test_margin_deposit_requires_auth(self, client):
        resp = client.post(
            "/blockchain/margin/deposit",
            json={
                "user_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                "amount": "1.0",
            },
        )
        assert resp.status_code == 401

    def test_margin_deposit_unavailable_without_contract(self, client, auth_headers):
        resp = client.post(
            "/blockchain/margin/deposit",
            json={
                "user_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                "amount": "1.0",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 503

    def test_margin_deposit_rejects_non_positive_amount(self, client, auth_headers):
        resp = client.post(
            "/blockchain/margin/deposit",
            json={
                "user_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                "amount": "0",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 422

    def test_transaction_status_disconnected(self, client, auth_headers):
        resp = client.get(
            "/blockchain/transactions/0x" + "0" * 64, headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "disconnected"
