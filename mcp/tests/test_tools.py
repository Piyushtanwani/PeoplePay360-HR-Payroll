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


def test_an_employee_is_offered_only_their_own_records(employee_claims):
    allowed = {t.name for t in registry.list_for(employee_claims)}
    # Their own leave balance and payslips: yes.
    assert "timeoff_get_balance" in allowed
    assert "payslip_list" in allowed
    assert "payslip_explain" in allowed
    assert "whoami" in allowed
    # Everybody else's records, and payroll operations: no.
    assert "payrun_list" not in allowed
    assert "payrun_list_issues" not in allowed
    assert "employee_search" not in allowed
    assert "attendance_list_exceptions" not in allowed
    assert "dashboard_kpis" not in allowed


def test_an_administrator_is_offered_every_tool(admin_claims):
    allowed = {t.name for t in registry.list_for(admin_claims)}
    assert len(allowed) == len(registry.list_all())


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
