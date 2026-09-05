import copy
from typing import Any, Dict

SENSITIVE_FIELDS = {
    "workEmail",
    "personalEmail",
    "phone",
    "mobile",
    "bankAccountNumber",
    "bankName",
    "bankBranch",
    "bankIfsc",
    "panNumber",
    "nationalId",
    "emergencyContact",
    "homeAddress",
}


def sanitize_for_model(data: Any) -> Any:
    """
    Recursively strips personal identifiable information (PII) and banking data
    from payload before sending it to LLM context, preventing data leakage.
    """
    if isinstance(data, dict):
        cleaned: Dict[str, Any] = {}
        for k, v in data.items():
            if k in SENSITIVE_FIELDS:
                continue
            cleaned[k] = sanitize_for_model(v)
        return cleaned
    elif isinstance(data, list):
        return [sanitize_for_model(item) for item in data]
    return data


def format_tool_result(raw_data: Any) -> Dict[str, Any]:
    """
    Packages backend response into dual views:
    - ui_view: Preserved rich structure for the frontend UI components and tables.
    - model_view: Sanitized, lightweight structure for the LLM token context.
    """
    ui_view = copy.deepcopy(raw_data)
    model_view = sanitize_for_model(raw_data)
    return {
        "ui_view": ui_view,
        "model_view": model_view,
    }
