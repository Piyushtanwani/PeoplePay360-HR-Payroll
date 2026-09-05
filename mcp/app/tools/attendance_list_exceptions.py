from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result


@registry.register(
    name="attendance_list_exceptions",
    description="Lists attendance exceptions such as missing checkouts, late arrivals, or early departures for a given monthly period (YYYY-MM).",
    required_permission="attendance.read",
    parameters={
        "type": "object",
        "properties": {
            "period": {"type": "string", "description": "The month in YYYY-MM format, e.g. '2026-08' or '2026-09'. Defaults to current month if omitted."},
            "type": {"type": "string", "description": "Filter by exception type, e.g. MISSING_CHECK_OUT, LATE_CHECK_IN, EARLY_CHECK_OUT"},
            "resolved": {"type": "boolean", "description": "Filter by resolution status. Default is False (unresolved only)."},
        },
        "required": [],
    },
    resource_type="attendance_exception",
)
async def attendance_list_exceptions_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    period = args.get("period")
    if not period:
        now = datetime.now()
        period = f"{now.year}-{now.month:02d}"

    params: Dict[str, Any] = {"period": period}
    if args.get("type"):
        params["type"] = args["type"]
    if args.get("resolved") is not None:
        params["resolved"] = args["resolved"]

    data = await backend_client.get("/api/attendance/exceptions", params=params, token=token)
    if not data or not isinstance(data, list):
        return f"No attendance exceptions found for period {period}.", [], "attendance_exception", None

    formatted = format_tool_result(data)
    exceptions = formatted["ui_view"]

    rows = []
    unresolved_count = 0
    for ex in exceptions:
        is_res = ex.get("resolved", False)
        if not is_res:
            unresolved_count += 1
        rows.append([
            str(ex.get("id")),
            ex.get("employeeName", f"Emp #{ex.get('employeeId')}"),
            str(ex.get("date")),
            ex.get("type", "UNKNOWN"),
            f"{ex.get('minutes', 0)} min",
            "Resolved" if is_res else "Unresolved",
        ])

    blocks = [
        kpi_block(
            title=f"Exceptions ({period})",
            value=f"{len(exceptions)} total",
            subtitle=f"{unresolved_count} unresolved issues",
            variant="warning" if unresolved_count > 0 else "positive"
        )
    ]

    if rows:
        blocks.append(table_block(
            title=f"Attendance Anomalies ({period})",
            headers=["ID", "Employee", "Date", "Type", "Duration", "Status"],
            rows=rows
        ))

    summary_text = (
        f"Found {len(exceptions)} attendance exception(s) for {period} "
        f"({unresolved_count} unresolved)."
    )
    return summary_text, blocks, "attendance_exception", None
