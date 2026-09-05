from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, link_block, table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result


@registry.register(
    name="payslip_explain",
    description="Provides an itemized mathematical explanation and salary breakdown for a specific payslip, including basic wage, allowance lines, and statutory deductions.",
    required_permission="payslip.read.own",
    parameters={
        "type": "object",
        "properties": {
            "payslipId": {"type": "integer", "description": "The unique ID of the payslip to explain"}
        },
        "required": ["payslipId"],
    },
    resource_type="payslip",
)
async def payslip_explain_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    payslip_id = args.get("payslipId")
    if not payslip_id:
        return "Please provide a payslipId.", [], "payslip", None

    data = await backend_client.get(f"/api/payslips/{payslip_id}", token=token)
    if not data:
        return f"Payslip #{payslip_id} was not found.", [], "payslip", str(payslip_id)

    formatted = format_tool_result(data)
    ps = formatted["ui_view"]

    emp_name = ps.get("employeeName", f"Emp #{ps.get('employeeId')}")
    emp_no = ps.get("employeeNo", "N/A")
    # net/gross/deductions are the endpoint's own field names.
    net_pay = float(ps.get("net") or 0.0)
    gross_pay = float(ps.get("gross") or 0.0)
    deductions = float(ps.get("deductions") or 0.0)
    lines = ps.get("lines", [])

    line_rows = []
    for line_item in lines:
        amt = float(line_item.get("amount") or 0.0)
        line_rows.append([
            str(line_item.get("sequence", 0)),
            line_item.get("ruleName", line_item.get("ruleCode", "Rule")),
            line_item.get("category", "OTHER"),
            f"₹{amt:,.2f}",
        ])

    blocks = [
        kpi_block(
            title=f"Net Pay for {emp_name}",
            value=f"₹{net_pay:,.2f}",
            subtitle=f"Gross: ₹{gross_pay:,.2f} | Deductions: ₹{deductions:,.2f}",
            variant="good"
        )
    ]

    if line_rows:
        blocks.append(table_block(
            title=f"Salary Rule Calculation Lines (Payslip #{payslip_id})",
            headers=["Seq", "Rule / Item", "Category", "Amount"],
            rows=line_rows
        ))

    blocks.append(link_block(
        label="Download Official Payslip PDF",
        url=f"/api/payslips/{payslip_id}/pdf"
    ))

    summary_text = (
        f"Payslip #{payslip_id} for {emp_name} ({emp_no}): "
        f"Gross Pay = ₹{gross_pay:,.2f}, Total Deductions = ₹{deductions:,.2f}, "
        f"Net Payout = ₹{net_pay:,.2f} computed across {len(lines)} sequenced salary rules."
    )
    return summary_text, blocks, "payslip", str(payslip_id)
