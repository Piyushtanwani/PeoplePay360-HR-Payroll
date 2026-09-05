from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, link_block, list_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result


@registry.register(
    name="employee_summary",
    description="Fetches a comprehensive 360 overview of an employee including job, department, manager, schedule, and activity counts.",
    required_permission="employee.read.own",
    parameters={
        "type": "object",
        "properties": {
            "employeeId": {"type": "integer", "description": "The numeric ID of the employee"}
        },
        "required": ["employeeId"],
    },
    resource_type="employee",
)
async def employee_summary_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    emp_id = args.get("employeeId")
    if not emp_id:
        return "Please provide an employeeId.", [], "employee", None

    data = await backend_client.get(f"/api/employees/{emp_id}/summary", token=token)
    if not data:
        return f"Employee #{emp_id} was not found.", [], "employee", str(emp_id)

    formatted = format_tool_result(data)
    emp = formatted["ui_view"]
    counts = emp.get("counts", {})

    display_name = emp.get("displayName", f"Employee #{emp_id}")
    emp_no = emp.get("employeeNo", "N/A")
    dept = emp.get("departmentName", "N/A")
    job = emp.get("jobTitle", "N/A")
    status = "Active" if emp.get("active") else "Inactive"
    manager = emp.get("managerName") or "None"
    schedule = emp.get("scheduleName") or "Standard"

    blocks = [
        kpi_block(
            title=f"{display_name} ({emp_no})",
            value=job,
            subtitle=f"Dept: {dept} | Status: {status}",
            variant="positive" if emp.get("active") else "neutral"
        ),
        list_block(
            title="Operational Counts",
            items=[
                f"Contracts: {counts.get('contracts', 0)}",
                f"Attendance Logs: {counts.get('attendance', 0)}",
                f"Leave Requests: {counts.get('requests', 0)}",
                f"Leave Allocations: {counts.get('allocations', 0)}"
            ]
        ),
        link_block(
            label=f"View {display_name} in HR Hub",
            url=f"/employees/{emp_id}"
        )
    ]

    summary_text = (
        f"Employee {display_name} ({emp_no}): Job '{job}' in Department '{dept}', "
        f"reporting to {manager}. Working schedule: {schedule}. "
        f"Activity summary: {counts.get('contracts', 0)} contracts, "
        f"{counts.get('attendance', 0)} attendance records, {counts.get('requests', 0)} leave requests."
    )
    return summary_text, blocks, "employee", str(emp_id)
