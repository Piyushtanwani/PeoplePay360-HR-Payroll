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
    raw_id = args.get("payslipId") or args.get("id")
    data = None
    resolved_id: Optional[int] = None

    if raw_id:
        try:
            numeric_id = int(str(raw_id).replace("PS-", "").replace("E-", ""))
            data = await backend_client.get(f"/api/payslips/{numeric_id}", token=token)
            if data and data.get("id"):
                resolved_id = int(data["id"])
        except Exception:
            data = None

    # If payslip was not directly found by id (e.g. employeeId or name was passed)
    if not data:
        emp_query = args.get("employeeId") or args.get("employeeName") or args.get("name") or raw_id
        params = {}
        if emp_query:
            try:
                clean_str = str(emp_query).strip()
                if clean_str.upper().startswith("E-"):
                    clean_str = clean_str[2:]
                if clean_str.isdigit():
                    params["employeeId"] = int(clean_str)
            except Exception:
                pass

            if "employeeId" not in params:
                emp_res = await backend_client.get("/api/employees", params={"q": str(emp_query), "size": 1}, token=token)
                emp_items = emp_res.get("content", []) if isinstance(emp_res, dict) else (emp_res if isinstance(emp_res, list) else [])
                if emp_items and emp_items[0].get("id"):
                    params["employeeId"] = emp_items[0]["id"]

        try:
            ps_res = await backend_client.get("/api/payslips", params=params, token=token)
            ps_items = ps_res.get("content", []) if isinstance(ps_res, dict) else (ps_res if isinstance(ps_res, list) else [])
            if ps_items:
                latest_id = ps_items[0].get("id")
                if latest_id:
                    data = await backend_client.get(f"/api/payslips/{latest_id}", token=token)
                    if data and data.get("id"):
                        resolved_id = int(data["id"])
        except Exception:
            pass

    if not data or not resolved_id:
        return "No payslip was found to explain.", [], "payslip", str(raw_id) if raw_id else None

    payslip_id = resolved_id

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
