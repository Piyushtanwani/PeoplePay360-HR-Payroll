import jwt
import pytest

from app.security import TokenClaims
from app.settings import settings

# The permission codes below are the real ones from the backend catalogue
# (backend/src/main/resources/db/migration/V014__seed_catalogue.sql). The tests previously used
# invented names such as "timeoff.read", which meant they passed while every real caller was
# offered no tools at all.

ADMIN_PERMISSIONS = [
    "chat.access",
    "employee.read.all",
    "employee.read.own",
    "contract.read.all",
    "contract.read.own",
    "attendance.read.all",
    "attendance.read.own",
    "timeoff_request.read.all",
    "timeoff_request.read.own",
    "timeoff_allocation.read.all",
    "timeoff_allocation.read.own",
    "payrun.read",
    "payslip.read.all",
    "payslip.read.own",
    "dashboard.read.hr",
    "dashboard.read.payroll",
    "candidate.compare",
]

# Exactly what the EMPLOYEE role holds, after the backend expands implied permissions.
EMPLOYEE_PERMISSIONS = [
    "chat.access",
    "employee.read.own",
    "contract.read.own",
    "attendance.read.own",
    "timeoff_request.read.own",
    "timeoff_allocation.read.own",
    "payslip.read.own",
]


@pytest.fixture
def admin_claims() -> TokenClaims:
    return TokenClaims(
        user_id=1,
        sub="1",
        role="ADMIN",
        roles=["ADMIN"],
        permissions=ADMIN_PERMISSIONS,
        employee_no="E-1001",
        employee_id=1,
        raw_token="mock_admin_token",
    )


@pytest.fixture
def employee_claims() -> TokenClaims:
    return TokenClaims(
        user_id=5,
        sub="5",
        role="EMPLOYEE",
        roles=["EMPLOYEE"],
        permissions=EMPLOYEE_PERMISSIONS,
        employee_no="E-1005",
        employee_id=5,
        raw_token="mock_employee_token",
    )


@pytest.fixture
def mock_jwt_token() -> str:
    """Shaped exactly like a delegated token from the backend's JwtService: perms, emp, roles."""
    payload = {
        "sub": "1",
        "roles": ["ADMIN"],
        "perms": ADMIN_PERMISSIONS,
        "emp": 1,
        "act": "chat",
        "scp": ["read"],
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
    }
    return jwt.encode(payload, "test-signing-key-not-verified-in-dev", algorithm="HS256")
