import pytest
from unittest.mock import AsyncMock, patch
from app.chat import handle_chat_turn
from app.schemas import ChatMessage, ChatRequest, ProviderConfig


@pytest.mark.asyncio
async def test_chat_turn_mock_whoami(admin_claims):
    request = ChatRequest(
        messages=[ChatMessage(role="user", content="Who am I?")],
        provider=ProviderConfig(provider="mock"),
    )
    mock_me = {
        "id": 1,
        "username": "admin",
        "displayName": "Administrator",
        "role": {"name": "Admin"},
        "permissions": ["all"]
    }
    with patch("app.tools.whoami.backend_client.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_me
        response = await handle_chat_turn(request, token=admin_claims.raw_token, claims=admin_claims)
        assert response.content is not None
        assert len(response.toolCalls) == 1
        assert response.toolCalls[0].toolName == "whoami"
        assert len(response.blocks) >= 1
        assert response.blocks[0]["type"] == "kpi"


@pytest.mark.asyncio
async def test_chat_turn_mock_leave_balance(employee_claims):
    request = ChatRequest(
        messages=[ChatMessage(role="user", content="What is my leave balance?")],
        provider=ProviderConfig(provider="mock"),
    )
    mock_balances = [
        {"typeName": "Annual Leave", "allocated": 15, "taken": 3, "pending": 1, "available": 11, "projected": 11},
        {"typeName": "Sick Leave", "allocated": 10, "taken": 1, "pending": 0, "available": 9, "projected": 9},
    ]
    with patch("app.tools.timeoff_get_balance.backend_client.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_balances
        response = await handle_chat_turn(request, token=employee_claims.raw_token, claims=employee_claims)
        assert response.content is not None
        assert len(response.toolCalls) == 1
        assert response.toolCalls[0].toolName == "timeoff_get_balance"
        assert len(response.blocks) >= 2  # KPI + Table
