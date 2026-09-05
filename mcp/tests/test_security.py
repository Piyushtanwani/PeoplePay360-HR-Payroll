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


def test_verify_token_reads_the_backends_claim_names(mock_jwt_token):
    """The backend mints perms and emp; reading permissions and employeeId left the list empty."""
    claims = verify_token(f"Bearer {mock_jwt_token}")
    assert claims.user_id == 1
    assert claims.role == "ADMIN"
    assert claims.employee_id == 1
    assert claims.has_permission("payrun.read") is True
    assert claims.has_permission("seed.manage") is False


def test_an_all_scope_satisfies_an_own_requirement(employee_claims, admin_claims):
    """Matching the backend rule, where employee.read.all implies employee.read.own."""
    assert admin_claims.has_permission("employee.read.own") is True
    assert employee_claims.has_permission("employee.read.all") is False
    assert employee_claims.has_permission("employee.read.own") is True
