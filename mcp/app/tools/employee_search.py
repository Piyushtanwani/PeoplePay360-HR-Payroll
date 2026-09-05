from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result, model_summary


@registry.register(
    name="employee_search",
    description=(
        "The employee directory: how many people work here, who they are, which department "
        "they sit in, and their job titles. Use this for any question about headcount or "
        "about finding a person. Returns the total number of matches."
    ),
    required_permission="employee.read.all",
    parameters={
        "type": "object",
        "properties": {
            "q": {"type": "string", "description": "Search query for employee name or employee number"},
            "departmentId": {"type": "integer", "description": "Optional department ID to filter by"},
            "status": {"type": "string", "description": "Employment status, e.g. ACTIVE, INACTIVE", "enum": ["ACTIVE", "INACTIVE"]},
        },
        "required": [],
    },
    resource_type="employee",
)
async def employee_search_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    params = {
        "q": args.get("q"),
        "departmentId": args.get("departmentId"),
        # The endpoint filters on a boolean, not a status string.
        "active": args.get("status", "ACTIVE") != "INACTIVE",
        "sort": "displayName,asc",
        "page": 0,
        "size": 20,
    }
    data = await backend_client.get("/api/employees", params=params, token=token)
    if not data:
        return "No employees found matching the search criteria.", [], "employee", None

    items = data.get("content", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
    # The endpoint pages, so the count of rows on this page is not the count of matches.
    total = data.get("totalElements", len(items)) if isinstance(data, dict) else len(items)
    formatted = format_tool_result(items)

    rows = []
    for emp in formatted["ui_view"]:
        rows.append([
            emp.get("employeeNo", "N/A"),
            f"{emp.get('firstName', '')} {emp.get('lastName', '')}".strip() or emp.get("displayName", "N/A"),
            emp.get("departmentName") or (emp.get("department") or {}).get("name", "N/A"),
            emp.get("jobTitle") or emp.get("position", "N/A"),
            "Active" if emp.get("active", True) else "Inactive",
        ])

    blocks = []
    if rows:
        blocks.append(table_block(
            title=f"Employees ({len(rows)} results)",
            headers=["Employee No", "Name", "Department", "Position", "Status"],
            rows=rows
        ))

    # The model is given the rows themselves, so it can answer about the people rather than only
    # report a count. Personal details are stripped by model_summary before they reach the context.
    rows_for_model = model_summary(
        items,
        ["id", "employeeNo", "displayName", "jobTitle", "departmentName", "employeeType", "active"],
    )
    summary_text = (
        f"{total} employees match. Showing the first {len(items)}.\n"
        f"Rows: {rows_for_model}"
    )
    return summary_text, blocks, "employee", None
