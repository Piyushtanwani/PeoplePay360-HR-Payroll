from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result, rows_of, model_summary


@registry.register(
    name="contract_list_expiring",
    description="Lists active employment contracts that are expiring within a given time window (e.g. within 30, 60, or 90 days).",
    required_permission="contract.read.all",
    parameters={
        "type": "object",
        "properties": {
            "daysAhead": {"type": "integer", "description": "Number of days ahead to look for expiring contracts. Default is 60 days."},
            "employeeId": {"type": "integer", "description": "Optional filter by employee ID"},
        },
        "required": [],
    },
    resource_type="contract",
)
async def contract_list_expiring_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    days_ahead = args.get("daysAhead", 60)
    cutoff = date.today() + timedelta(days=days_ahead)

    params: Dict[str, Any] = {
        "state": "RUNNING",
        "endsBefore": cutoff.isoformat(),
    }
    if args.get("employeeId"):
        params["employeeId"] = args["employeeId"]

    data = await backend_client.get("/api/contracts", params=params, token=token)
    rows_from_backend = rows_of(data)
    if not rows_from_backend:
        return f"No active contracts are expiring within the next {days_ahead} days (before {cutoff}).", [], "contract", None

    formatted = format_tool_result(rows_from_backend)
    contracts = formatted["ui_view"]

    rows = []
    for c in contracts:
        wage = float(c.get("wage") or 0.0)
        rows.append([
            str(c.get("id")),
            c.get("employeeName", f"Emp #{c.get('employeeId')}"),
            c.get("reference", "REF"),
            str(c.get("endDate")),
            f"₹{wage:,.2f} ({c.get('wageType', 'MONTHLY')})",
            c.get("jobTitle", "N/A"),
        ])

    blocks = [
        kpi_block(
            title=f"Expiring Contracts (< {days_ahead} days)",
            value=f"{len(contracts)} contracts",
            subtitle=f"Expiring on or before {cutoff}",
            variant="warning" if contracts else "positive"
        )
    ]

    if rows:
        blocks.append(table_block(
            title=f"Contracts Expiring Before {cutoff}",
            headers=["Contract ID", "Employee", "Reference", "End Date", "Wage", "Position"],
            rows=rows
        ))

    rows_for_model = model_summary(
        contracts,
        ["reference", "employeeName", "jobTitle", "startDate", "endDate", "state"],
    )
    summary_text = (
        f"{len(contracts)} contract(s) end within {days_ahead} days (before {cutoff}).\n"
        f"Rows: {rows_for_model}"
        if contracts else f"No contract ends before {cutoff}."
    )
    return summary_text, blocks, "contract", None
