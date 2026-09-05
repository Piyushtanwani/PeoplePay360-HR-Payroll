import pytest
from fastapi import HTTPException
from app.security import verify_gateway_secret, verify_token
from app.settings import settings


def test_verify_gateway_secret_valid():
    secret = settings.mcp_gateway_secret
    assert verify_gateway_secret(secret) == secret


def test_verify_gateway_secret_invalid():
    with pytest.raises(HTTPException) as exc:
        verify_gateway_secret("wrong-secret")
    assert exc.value.status_code == 403


def test_verify_gateway_secret_missing():
    with pytest.raises(HTTPException) as exc:
        verify_gateway_secret(None)
    assert exc.value.status_code == 401


def test_verify_token_dev_fallback(mock_jwt_token):
    claims = verify_token(f"Bearer {mock_jwt_token}")
    assert claims.user_id == 1
    assert claims.role == "ROLE_ADMIN"
    assert "ROLE_ADMIN" in claims.roles
    assert claims.has_permission("anything") is True
