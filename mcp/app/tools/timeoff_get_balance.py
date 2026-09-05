from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result, rows_of


@registry.register(
    name="timeoff_get_balance",
    description="Fetches accrued, taken, pending, and remaining leave balances for an employee across all leave types.",
    required_permission="timeoff_allocation.read.own",
    parameters={
        "type": "object",
        "properties": {
            "employeeId": {"type": "integer", "description": "Another employee's ID. Omit it to read your own balances, which is what most questions mean. Ignored unless you may read everybody's leave."}
        },
        "required": [],
    },
    resource_type="timeoff_balance",
)
async def timeoff_get_balance_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    # A caller scoped to their own records gets their own records, whatever id the model supplied.
    # Models invent plausible ids, and asking the backend for a stranger's balance earns a 403 that
    # reads to the person as "the assistant is broken" rather than "you asked for someone else".
    requested = args.get("employeeId")
    if requested is not None and not claims.has_permission("timeoff_allocation.read.all"):
        requested = None
    emp_id = requested or claims.employee_id
    params = {"employeeId": emp_id} if emp_id else {}

    data = await backend_client.get("/api/timeoff/balances", params=params, token=token)
    rows_from_backend = rows_of(data)
    if not rows_from_backend:
        return "No leave balances found for this employee.", [], "timeoff_balance", str(emp_id) if emp_id else None

    formatted = format_tool_result(rows_from_backend)
    balances = formatted["ui_view"]

    rows = []
    total_available = 0.0
    for b in balances:
        avail = float(b.get("available") or 0.0)
        total_available += avail
        rows.append([
            b.get("typeName", "Leave"),
            str(b.get("allocated", 0)),
            str(b.get("taken", 0)),
            str(b.get("pending", 0)),
            str(b.get("available", 0)),
            str(b.get("projected", 0)),
        ])

    blocks = [
        kpi_block(
            title="Total Available Leave",
            value=f"{total_available:.1f} days",
            subtitle=f"{len(balances)} active leave policy types",
            variant="positive" if total_available > 0 else "neutral"
        ),
        table_block(
            title="Leave Balance Breakdown",
            headers=["Leave Type", "Allocated", "Taken", "Pending", "Available", "Projected"],
            rows=rows
        )
    ]

    summary_text = (
        f"Employee has {len(balances)} leave balance categories with a total of "
        f"{total_available:.1f} days available. Breakdown: " +
        ", ".join(f"{r[0]}: {r[4]} available ({r[1]} allocated, {r[2]} taken)" for r in rows)
    )
    return summary_text, blocks, "timeoff_balance", str(emp_id) if emp_id else None
