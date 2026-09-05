import copy
import json
from typing import Any, Dict, Iterable

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


def model_summary(rows: Any, fields: Iterable[str], limit: int = 25) -> str:
    """
    The rows themselves, as compact JSON, for the model to answer from.

    A tool that returns only "found 20 employees" gives the model nothing to work with, so it
    either invents names or refuses. Sending the sanitised rows is what lets it answer the
    question that was actually asked, and the PII is stripped on the way.
    """
    if not rows:
        return "[]"
    trimmed = []
    for row in list(rows)[:limit]:
        if not isinstance(row, dict):
            trimmed.append(row)
            continue
        clean = sanitize_for_model(row)
        trimmed.append({f: clean.get(f) for f in fields if clean.get(f) is not None})
    return json.dumps(trimmed, default=str, separators=(",", ":"))


def rows_of(data: Any) -> list:
    """
    The rows out of a backend response, whether it is a page envelope or a bare array.

    Every list endpoint now returns {content, page, size, totalElements, totalPages}. Tools that
    tested `isinstance(data, list)` silently returned "nothing found" against a perfectly good
    response, which is worse than an error because it reads as a fact.
    """
    if isinstance(data, dict):
        content = data.get("content")
        return content if isinstance(content, list) else []
    return data if isinstance(data, list) else []


def total_of(data: Any, rows: list) -> int:
    """How many records match in total, not just how many are on this page."""
    if isinstance(data, dict) and isinstance(data.get("totalElements"), int):
        return data["totalElements"]
    return len(rows)
