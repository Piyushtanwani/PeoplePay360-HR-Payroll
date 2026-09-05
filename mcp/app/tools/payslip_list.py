from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result, rows_of, model_summary


@registry.register(
    name="payslip_list",
    description="Lists generated payslips with gross pay, deductions, and net salary. Can filter by payrunId or employeeId.",
    required_permission="payslip.read.own",
    parameters={
        "type": "object",
        "properties": {
            "payrunId": {"type": "integer", "description": "Filter payslips for a specific payrun ID"},
            "employeeId": {"type": "integer", "description": "Filter payslips for a specific employee ID"},
            "period": {"type": "string", "description": "Monthly period in YYYY-MM format, e.g. '2026-08'"},
        },
        "required": [],
    },
    resource_type="payslip",
)
async def payslip_list_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    params: Dict[str, Any] = {}
    if args.get("payrunId"):
        params["payrunId"] = args["payrunId"]
    if args.get("employeeId"):
        params["employeeId"] = args["employeeId"]
    if args.get("period"):
        params["period"] = args["period"]

    data = await backend_client.get("/api/payslips", params=params, token=token)
    rows_from_backend = rows_of(data)
    if not rows_from_backend:
        return "No payslips found for the given criteria.", [], "payslip", None

    formatted = format_tool_result(rows_from_backend)
    payslips = formatted["ui_view"]

    rows = []
    total_net = 0.0
    for ps in payslips:
        # The endpoint calls these net/gross/deductions. Reading netPay/grossPay produced a table of
        # zeros beside a model answer built from the real figures, which read as a broken assistant.
        net = float(ps.get("net") or 0.0)
        gross = float(ps.get("gross") or 0.0)
        ded = float(ps.get("deductions") or 0.0)
        total_net += net
        rows.append([
            str(ps.get("id")),
            ps.get("employeeName", f"Emp #{ps.get('employeeId')}"),
            ps.get("employeeNo", "N/A"),
            f"₹{gross:,.2f}",
            f"₹{ded:,.2f}",
            f"₹{net:,.2f}",
            ps.get("payrunState", "DRAFT"),
        ])

    blocks = [
        kpi_block(
            title="Total Payslips",
            value=f"{len(payslips)}",
            subtitle=f"Total Net Sum: ₹{total_net:,.2f}",
            variant="neutral"
        )
    ]

    if rows:
        blocks.append(table_block(
            title="Payslips Overview",
            headers=["ID", "Employee", "Emp No", "Gross Pay", "Deductions", "Net Pay", "Status"],
            rows=rows
        ))

    rows_for_model = model_summary(
        payslips,
        ["id", "employeeName", "employeeNo", "periodStart", "periodEnd", "gross", "deductions", "net"],
    )
    summary_text = (
        f"Retrieved {len(payslips)} payslip(s), total net ₹{total_net:,.2f}.\n"
        f"Rows: {rows_for_model}"
    )
    return summary_text, blocks, "payslip", None
