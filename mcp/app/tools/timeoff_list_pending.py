from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result


@registry.register(
    name="timeoff_list_pending",
    description="Lists submitted time-off and leave requests awaiting manager review or approval.",
    required_permission="timeoff.read",
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
    if not data or not isinstance(data, list):
        return "There are no pending leave requests awaiting approval.", [], "timeoff_request", None

    formatted = format_tool_result(data)
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

    summary_text = (
        f"There are currently {len(requests)} leave request(s) awaiting approval."
        if requests else "No pending leave requests found."
    )
    return summary_text, blocks, "timeoff_request", None
