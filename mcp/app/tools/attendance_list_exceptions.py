from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result, rows_of, model_summary


@registry.register(
    name="attendance_list_exceptions",
    description="Lists attendance exceptions such as missing checkouts, late arrivals, or early departures for a given monthly period (YYYY-MM).",
    required_permission="attendance.read.all",
    parameters={
        "type": "object",
        "properties": {
            "period": {"type": "string", "description": "The month in YYYY-MM format, e.g. '2026-09'. Defaults to current month if omitted."},
            "type": {"type": "string", "description": "Filter by exception type: MISSING_CHECKOUT, LATE, OVERTIME, or ABSENT."},
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
    now = datetime.now()
    cur_period = f"{now.year}-{now.month:02d}"

    period = args.get("period")
    if not period:
        period = cur_period
    else:
        # Sanitize outdated years (e.g. if the LLM defaults to 2023 or 2024)
        try:
            p_year = int(period.split("-")[0])
            if p_year < 2026:
                period = cur_period
        except Exception:
            period = cur_period

    params: Dict[str, Any] = {"period": period, "size": 100}

    # Normalize type parameter if provided
    raw_type = args.get("type")
    if raw_type:
        norm_type = raw_type.upper().strip()
        if norm_type in ("MISSING_CHECK_OUT", "MISSING_CHECKOUT", "CHECKOUT", "MISSING_OUT"):
            params["type"] = "MISSING_CHECKOUT"
        elif norm_type in ("LATE_CHECK_IN", "LATE", "LATE_IN"):
            params["type"] = "LATE"
        elif norm_type in ("OVERTIME", "OVER_TIME", "OT"):
            params["type"] = "OVERTIME"
        elif norm_type in ("ABSENT", "ABSENCE"):
            params["type"] = "ABSENT"
        else:
            params["type"] = norm_type

    if args.get("resolved") is not None:
        params["resolved"] = args["resolved"]

    data = await backend_client.get("/api/attendance/exceptions", params=params, token=token)
    rows_from_backend = rows_of(data)

    # If current month has no exceptions, fall back to previous month (e.g. 2026-08)
    if not rows_from_backend and period == cur_period:
        prev_month = (now.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
        fallback_params = dict(params)
        fallback_params["period"] = prev_month
        prev_data = await backend_client.get("/api/attendance/exceptions", params=fallback_params, token=token)
        prev_rows = rows_of(prev_data)
        if prev_rows:
            rows_from_backend = prev_rows
            period = prev_month

    if not rows_from_backend:
        return f"No attendance exceptions found for period {period}.", [], "attendance_exception", None

    formatted = format_tool_result(rows_from_backend)
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

    rows_for_model = model_summary(
        exceptions,
        ["employeeName", "date", "type", "minutes", "resolved"],
    )
    summary_text = (
        f"{len(exceptions)} attendance exception(s) for {period}, {unresolved_count} still open.\n"
        f"Rows: {rows_for_model}"
    )
    return summary_text, blocks, "attendance_exception", None
