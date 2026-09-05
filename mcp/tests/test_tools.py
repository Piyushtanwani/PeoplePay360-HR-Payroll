import pytest
from unittest.mock import AsyncMock, patch
from app.registry import registry
import app.tools  # noqa: F401


def test_registry_contains_13_tools():
    all_tools = registry.list_all()
    tool_names = {t.name for t in all_tools}
    expected = {
        "whoami",
        "employee_search",
        "employee_summary",
        "timeoff_get_balance",
        "timeoff_list_pending",
        "attendance_list_exceptions",
        "payrun_list",
        "payrun_list_issues",
        "payslip_list",
        "payslip_explain",
        "dashboard_kpis",
        "contract_list_expiring",
        "candidate_compare",
    }
    assert expected.issubset(tool_names)


def test_registry_permission_filtering(employee_claims):
    allowed_tools = registry.list_for(employee_claims)
    allowed_names = {t.name for t in allowed_tools}
    # Employee has timeoff.read and attendance.read and payslip.read
    assert "timeoff_get_balance" in allowed_names
    assert "attendance_list_exceptions" in allowed_names
    assert "payslip_list" in allowed_names
    # Employee does NOT have payroll.read (admin/payroll mgr only)
    assert "payrun_list" not in allowed_names
    assert "payrun_list_issues" not in allowed_names


@pytest.mark.asyncio
async def test_tool_execution_permission_denied(employee_claims):
    text, blocks, record = await registry.execute(
        name="payrun_list",
        args={},
        token=employee_claims.raw_token,
        claims=employee_claims
    )
    assert not record.allowed
    assert record.denialCode == "PERMISSION_DENIED"
    assert "Permission denied" in text


@pytest.mark.asyncio
async def test_whoami_execution(admin_claims):
    mock_data = {
        "id": 1,
        "username": "admin",
        "displayName": "Administrator",
        "role": {"name": "Admin"},
        "permissions": ["all"]
    }
    with patch("app.tools.whoami.backend_client.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_data
        text, blocks, record = await registry.execute(
            name="whoami",
            args={},
            token=admin_claims.raw_token,
            claims=admin_claims
        )
        assert record.allowed
        assert "Administrator" in text
        assert len(blocks) == 2
        assert blocks[0]["type"] == "kpi"
