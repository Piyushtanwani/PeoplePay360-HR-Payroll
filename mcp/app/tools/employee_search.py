from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result


@registry.register(
    name="employee_search",
    description="Search and filter active or past employees by name, department, or status.",
    required_permission="employee.read",
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
        "status": args.get("status", "ACTIVE"),
        "page": 0,
        "size": 20,
    }
    data = await backend_client.get("/api/employees", params=params, token=token)
    if not data:
        return "No employees found matching the search criteria.", [], "employee", None

    items = data.get("content", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
    formatted = format_tool_result(items)

    rows = []
    for emp in formatted["ui_view"]:
        rows.append([
            emp.get("employeeNo", "N/A"),
            f"{emp.get('firstName', '')} {emp.get('lastName', '')}".strip() or emp.get("displayName", "N/A"),
            emp.get("departmentName") or (emp.get("department") or {}).get("name", "N/A"),
            emp.get("jobTitle") or emp.get("position", "N/A"),
            emp.get("status", "ACTIVE"),
        ])

    blocks = []
    if rows:
        blocks.append(table_block(
            title=f"Employees ({len(rows)} results)",
            headers=["Employee No", "Name", "Department", "Position", "Status"],
            rows=rows
        ))

    summary_text = f"Found {len(items)} employees matching your criteria."
    return summary_text, blocks, "employee", None
