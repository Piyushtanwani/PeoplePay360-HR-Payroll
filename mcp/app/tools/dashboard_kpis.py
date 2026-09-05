from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result


@registry.register(
    name="dashboard_kpis",
    description="Retrieves high-level executive payroll KPIs and organizational analytics for a given month (e.g. total net paid, headcount, average salary, time-off days, and attendance health percentage).",
    required_permission="payroll.read",
    parameters={
        "type": "object",
        "properties": {
            "period": {"type": "string", "description": "The month in YYYY-MM format, e.g. '2026-08'. Defaults to current month if omitted."},
            "departmentId": {"type": "integer", "description": "Optional department ID to scope analytics"},
        },
        "required": [],
    },
    resource_type="report",
)
async def dashboard_kpis_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    period = args.get("period")
    if not period:
        now = datetime.now()
        period = f"{now.year}-{now.month:02d}"

    params: Dict[str, Any] = {"period": period}
    if args.get("departmentId"):
        params["departmentId"] = args["departmentId"]

    data = await backend_client.get("/api/reports/dashboard", params=params, token=token)
    if not data or not isinstance(data, dict):
        return f"No dashboard data available for period {period}.", [], "report", None

    formatted = format_tool_result(data)
    dash = formatted["ui_view"]
    kpis = dash.get("kpis", {})

    total_net = float(kpis.get("totalNetPaid") or 0.0)
    payslips = kpis.get("payslipsGenerated", 0)
    avg_salary = float(kpis.get("averageSalary") or 0.0)
    timeoff_days = float(kpis.get("approvedTimeOffDays") or 0.0)
    att_health = float(kpis.get("attendanceHealthPct") or 0.0)

    blocks = [
        kpi_block(
            title="Total Net Salary Paid",
            value=f"₹{total_net:,.2f}",
            subtitle=f"Period: {period} ({payslips} payslips)",
            variant="positive"
        ),
        kpi_block(
            title="Average Salary",
            value=f"₹{avg_salary:,.2f}",
            subtitle=f"Approved Time-off: {timeoff_days} days",
            variant="neutral"
        ),
        kpi_block(
            title="Attendance Health Index",
            value=f"{att_health:.1f}%",
            subtitle="Punctuality & coverage score",
            variant="positive" if att_health >= 90 else "warning"
        )
    ]

    dept_costs = dash.get("salaryCostByDepartment", [])
    if dept_costs:
        dept_rows = [[d.get("departmentName", "Dept"), f"₹{float(d.get('amount') or 0.0):,.2f}"] for d in dept_costs]
        blocks.append(table_block(
            title=f"Department Salary Spend ({period})",
            headers=["Department", "Total Net Spend"],
            rows=dept_rows
        ))

    summary_text = (
        f"Executive Dashboard for {period}: Total Net Paid: ₹{total_net:,.2f} across {payslips} payslips. "
        f"Average Salary: ₹{avg_salary:,.2f}. Approved Time-Off: {timeoff_days} days. "
        f"Attendance Health: {att_health:.1f}%."
    )
    return summary_text, blocks, "report", None
