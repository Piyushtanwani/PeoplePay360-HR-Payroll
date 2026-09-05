from app.views import format_tool_result, sanitize_for_model


def test_sanitize_for_model_removes_pii():
    data = {
        "id": 1,
        "employeeNo": "E-1001",
        "displayName": "Jane Doe",
        "workEmail": "jane@company.com",
        "phone": "+91 9876543210",
        "bankAccountNumber": "1234567890",
        "panNumber": "ABCDE1234F",
        "jobTitle": "Lead Engineer",
    }
    cleaned = sanitize_for_model(data)
    assert "workEmail" not in cleaned
    assert "phone" not in cleaned
    assert "bankAccountNumber" not in cleaned
    assert "panNumber" not in cleaned
    assert cleaned["id"] == 1
    assert cleaned["employeeNo"] == "E-1001"
    assert cleaned["jobTitle"] == "Lead Engineer"


def test_format_tool_result_preserves_ui_view():
    data = {
        "id": 1,
        "workEmail": "jane@company.com",
        "jobTitle": "Lead Engineer",
    }
    result = format_tool_result(data)
    assert result["ui_view"]["workEmail"] == "jane@company.com"
    assert "workEmail" not in result["model_view"]
    assert result["model_view"]["jobTitle"] == "Lead Engineer"
