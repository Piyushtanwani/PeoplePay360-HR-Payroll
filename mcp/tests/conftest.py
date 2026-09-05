import pytest
import jwt
from app.security import TokenClaims
from app.settings import settings


@pytest.fixture
def admin_claims() -> TokenClaims:
    return TokenClaims(
        user_id=1,
        sub="admin",
        role="ROLE_ADMIN",
        roles=["ROLE_ADMIN"],
        permissions=["*"],
        employee_no="EMP-001",
        employee_id=1,
        raw_token="mock_admin_token"
    )


@pytest.fixture
def employee_claims() -> TokenClaims:
    return TokenClaims(
        user_id=5,
        sub="john.doe",
        role="ROLE_EMPLOYEE",
        roles=["ROLE_EMPLOYEE"],
        permissions=["chat.access", "timeoff.read", "attendance.read", "payslip.read"],
        employee_no="EMP-1005",
        employee_id=5,
        raw_token="mock_employee_token"
    )


@pytest.fixture
def mock_jwt_token() -> str:
    payload = {
        "sub": "admin",
        "userId": 1,
        "role": "ROLE_ADMIN",
        "roles": ["ROLE_ADMIN"],
        "permissions": ["chat.access", "employee.read", "payroll.read"],
        "employeeNo": "EMP-001",
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
    }
    return jwt.encode(payload, "change-me-32-chars-minimum-value!", algorithm="HS256")
