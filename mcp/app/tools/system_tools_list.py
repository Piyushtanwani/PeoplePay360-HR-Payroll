from typing import Any, Dict, List, Optional, Tuple
from app.blocks import kpi_block, table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import model_summary

RESOURCE_DOMAINS = {
    "employee": "Employees (Profiles, Departments, Status, Positions)",
    "contract": "Contracts (Wages, Terms, Expiring/Renewal Dates)",
    "attendance_exception": "Attendance (Missing Check-outs, Lateness, Overtime)",
    "attendance": "Attendance (Daily Records, Clock-in/Clock-out)",
    "timeoff_balance": "Time Off (Leave Balances & Allocations)",
    "timeoff_request": "Time Off (Pending & Approved Leave Requests)",
    "payroll": "Payroll (Payrun Batches, Processing Issues, Blockers)",
    "payslip": "Payslips (Gross-to-Net Math, Deductions, Earnings)",
    "candidate": "Recruitment (Candidate Pipeline, Applications, Ratings)",
    "dashboard": "Executive KPIs (Headcount, Total Payroll, Operational Trends)",
    "user": "Security & Identity (Current User, Roles, Permissions)",
    "system": "System Operations (Active Tools, MCP Capabilities)",
}


@registry.register(
    name="system_tools_list",
    description="Lists all live active MCP tools available to the caller, their target records/domains, operational capabilities, and required permissions.",
    required_permission="authenticated",
    parameters={
        "type": "object",
        "properties": {},
        "required": [],
    },
    resource_type="system",
)
async def system_tools_list_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    """
    Returns the list of active live MCP tools and the records they can query,
    scoped to the caller's authorization level.
    """
    tools = registry.list_for(claims)

    rows = []
    tool_dicts = []
    for t in tools:
        domain = RESOURCE_DOMAINS.get(t.resourceType or "", t.resourceType or "General")
        rows.append([
            t.name,
            domain,
            t.description,
            t.requiredPermission or "authenticated",
        ])
        tool_dicts.append({
            "name": t.name,
            "targetRecords": domain,
            "description": t.description,
            "requiredPermission": t.requiredPermission,
        })

    blocks = [
        kpi_block(
            title="Live Active MCP Tools",
            value=f"{len(tools)} Tools Active",
            subtitle=f"Authorized for role: {claims.role or 'User'}",
            variant="positive",
        ),
        table_block(
            title="Active MCP Tools & Target Records",
            headers=["Tool Name", "Target Records / Domain", "Description", "Required Permission"],
            rows=rows,
        ),
    ]

    summary_text = (
        f"There are {len(tools)} live MCP tool(s) active and available for role '{claims.role}':\n"
        f"Rows: {model_summary(tool_dicts, ['name', 'targetRecords', 'description', 'requiredPermission'])}"
    )
    return summary_text, blocks, "system", None
