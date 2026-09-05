from typing import Any, Dict, List, Optional


def kpi_block(
    title: str,
    value: Any,
    subtitle: Optional[str] = None,
    variant: str = "neutral"
) -> Dict[str, Any]:
    """Generates a KPI metric card block for UI display."""
    block = {
        "type": "kpi",
        "title": title,
        "value": str(value),
        "variant": variant,
    }
    if subtitle:
        block["subtitle"] = subtitle
    return block


def table_block(
    title: str,
    headers: List[str],
    rows: List[List[Any]]
) -> Dict[str, Any]:
    """Generates a structured data table block for UI display."""
    return {
        "type": "table",
        "title": title,
        "headers": headers,
        "rows": [[str(cell) if cell is not None else "" for cell in row] for row in rows],
    }


def list_block(title: str, items: List[str]) -> Dict[str, Any]:
    """Generates an itemized bulleted list block."""
    return {
        "type": "list",
        "title": title,
        "items": items,
    }


def link_block(label: str, url: str) -> Dict[str, Any]:
    """Generates an in-app navigation link block."""
    return {
        "type": "link",
        "label": label,
        "url": url,
    }


def refusal_block(reason: str, suggested_topic: Optional[str] = None) -> Dict[str, Any]:
    """Generates an explicit refusal block when a request is out of scope or unauthorized."""
    return {
        "type": "refusal",
        "reason": reason,
        "suggestedTopic": suggested_topic or "HR and Payroll operations in PeoplePay360",
    }


def proposed_action_block(label: str, action: str, target: str) -> Dict[str, Any]:
    """Suggests an actionable next step for the user in the web UI."""
    return {
        "type": "proposed_action",
        "label": label,
        "action": action,
        "target": target,
    }
