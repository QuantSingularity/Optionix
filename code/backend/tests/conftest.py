"""
Test configuration and fixtures for Optionix backend tests.
"""

import os
import sys

# Ensure the project root is on sys.path so 'app' package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test environment variables BEFORE importing app modules.
# TESTING=true ensures settings.testing is True, which skips middlewares
# (like TrustedHostMiddleware) that would reject the TestClient host "testserver".
os.environ["ENVIRONMENT"] = "testing"
os.environ["TESTING"] = "true"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-at-least-32-chars-long"
os.environ["ENCRYPTION_KEY"] = "TestEncryptionKey1234567890!!!!!"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import app.data_protection  # noqa: F401 — registers ORM models with Base
import pytest
from app.database import get_db
from app.main import app  # FastAPI application instance
from app.models import Base
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    from app.main import app as fastapi_app

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app, raise_server_exceptions=False) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def registered_user(client):
    """Register a user and return email + password."""
    import time

    email = f"fixture_{int(time.time() * 1000)}@example.com"
    password = "TestPassword123!"
    resp = client.post(
        "/auth/register",
        json={"email": email, "password": password, "full_name": "Fixture User"},
    )
    assert resp.status_code == 200, resp.text
    return {"email": email, "password": password}


@pytest.fixture
def auth_headers(client, registered_user):
    """Return Authorization headers for a logged-in user."""
    resp = client.post(
        "/auth/login",
        json={
            "email": registered_user["email"],
            "password": registered_user["password"],
        },
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
