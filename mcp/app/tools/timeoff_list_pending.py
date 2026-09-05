from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result, rows_of, model_summary


@registry.register(
    name="timeoff_list_pending",
    description="Lists submitted time-off and leave requests awaiting manager review or approval.",
    required_permission="timeoff_request.read.all",
    parameters={
        "type": "object",
        "properties": {
            "employeeId": {"type": "integer", "description": "Optional filter by specific employee ID"},
        },
        "required": [],
    },
    resource_type="timeoff_request",
)
async def timeoff_list_pending_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    params: Dict[str, Any] = {"status": "SUBMITTED"}
    if args.get("employeeId"):
        params["employeeId"] = args["employeeId"]

    data = await backend_client.get("/api/timeoff/requests", params=params, token=token)
    rows_from_backend = rows_of(data)
    if not rows_from_backend:
        return "There are no pending leave requests awaiting approval.", [], "timeoff_request", None

    formatted = format_tool_result(rows_from_backend)
    requests = formatted["ui_view"]

    rows = []
    for r in requests:
        rows.append([
            str(r.get("id")),
            r.get("employeeName", f"Emp #{r.get('employeeId')}"),
            r.get("typeName", "Leave"),
            f"{r.get('startDate')} to {r.get('endDate')}",
            f"{r.get('days', 0)} days",
            r.get("anomaly") or "None",
        ])

    blocks = [
        kpi_block(
            title="Pending Leave Requests",
            value=f"{len(requests)}",
            subtitle="Awaiting manager approval",
            variant="warning" if requests else "positive"
        )
    ]

    if rows:
        blocks.append(table_block(
            title="Requests Awaiting Review",
            headers=["Req ID", "Employee", "Type", "Duration", "Days", "Anomaly"],
            rows=rows
        ))

    rows_for_model = model_summary(
        requests,
        ["employeeName", "typeName", "startDate", "endDate", "days", "state", "anomaly"],
    )
    summary_text = (
        f"{len(requests)} leave request(s) awaiting a decision.\nRows: {rows_for_model}"
        if requests else "No leave requests are awaiting a decision."
    )
    return summary_text, blocks, "timeoff_request", None
