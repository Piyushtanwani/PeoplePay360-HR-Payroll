from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, proposed_action_block, table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result, rows_of, model_summary


@registry.register(
    name="payrun_list",
    description="Lists payrun batches, showing their state (DRAFT, COMPUTED, VALIDATED, PAID), period, employee count, and total gross/net amounts.",
    required_permission="payrun.read",
    parameters={
        "type": "object",
        "properties": {
            "state": {"type": "string", "description": "Filter by payrun state: DRAFT, COMPUTED, VALIDATED, PAID", "enum": ["DRAFT", "COMPUTED", "VALIDATED", "PAID"]},
            "period": {"type": "string", "description": "Monthly period in YYYY-MM format, e.g. '2026-08'"},
        },
        "required": [],
    },
    resource_type="payrun",
)
async def payrun_list_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    params: Dict[str, Any] = {}
    if args.get("state"):
        params["state"] = args["state"]
    if args.get("period"):
        params["period"] = args["period"]

    data = await backend_client.get("/api/payruns", params=params, token=token)
    rows_from_backend = rows_of(data)
    if not rows_from_backend:
        return "No payruns found matching the criteria.", [], "payrun", None

    formatted = format_tool_result(rows_from_backend)
    payruns = formatted["ui_view"]

    rows = []
    total_net_sum = 0.0
    has_draft = False
    for p in payruns:
        st = p.get("state", "DRAFT")
        if st == "DRAFT":
            has_draft = True
        net = float(p.get("totalNet") or 0.0)
        total_net_sum += net
        rows.append([
            str(p.get("id")),
            p.get("name", "Payrun"),
            f"{p.get('periodStart')} to {p.get('periodEnd')}",
            st,
            str(p.get("employeeCount", 0)),
            f"₹{net:,.2f}",
            str(p.get("warningCount", 0)),
        ])

    blocks = [
        kpi_block(
            title="Total Batches",
            value=f"{len(payruns)}",
            subtitle=f"Cumulative Net: ₹{total_net_sum:,.2f}",
            variant="neutral"
        )
    ]

    if rows:
        blocks.append(table_block(
            title="Payrun Batches",
            headers=["ID", "Name", "Period", "State", "Employees", "Total Net", "Warnings"],
            rows=rows
        ))

    if has_draft:
        blocks.append(proposed_action_block(
            label="Compute Pending Payruns",
            action="navigate",
            target="/payruns"
        ))

    rows_for_model = model_summary(
        payruns,
        ["name", "state", "periodStart", "periodEnd", "employeeCount", "payslipCount", "totalNet",
         "blockerCount", "warningCount"],
    )
    summary_text = (
        f"Found {len(payruns)} payrun(s), total net ₹{total_net_sum:,.2f}.\n"
        f"Rows: {rows_for_model}"
    )
    return summary_text, blocks, "payrun", None
