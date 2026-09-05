import re
from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, link_block, list_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result


@registry.register(
    name="employee_summary",
    description="Fetches a comprehensive 360 overview of an employee including job, department, manager, schedule, salary contract, leave balances, and activity counts.",
    required_permission="employee.read.own",
    parameters={
        "type": "object",
        "properties": {
            "employeeId": {"type": "integer", "description": "The numeric ID of the employee (or search query/name)"}
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
    raw_id = args.get("employeeId") or args.get("id") or args.get("query") or args.get("name")

    # Authorization guard: employees with only employee.read.own may only inspect their own profile
    has_read_all = claims.has_permission("employee.read.all")
    if not has_read_all:
        is_self = False
        if not raw_id:
            is_self = True
        else:
            clean_str = str(raw_id).strip().lower()
            caller_id = str(claims.employee_id) if claims.employee_id else ""
            caller_no = str(claims.employee_no or "").lower()
            words = set(re.findall(r"\b\w+\b", clean_str))
            if clean_str == caller_id or (caller_no and clean_str in (caller_no, caller_no.replace("e-", ""))):
                is_self = True
            elif any(w in words for w in ["me", "myself", "my", "own", "self"]):
                is_self = True
            elif clean_str in ("me", "myself", "self", "my", "my profile", "own", "current"):
                is_self = True

        if not is_self:
            target_name = str(raw_id).strip().title()
            return (
                f"Access Restricted: As an employee, you only have permission to view your own personal employee records. "
                f"You are not authorized to view 360-degree operational summaries or details for other colleagues ({target_name}). "
                f"If you require information regarding this employee, please contact your HR department or People Operations manager.",
                [],
                "employee",
                None,
            )
        raw_id = claims.employee_id

    if not raw_id:
        raw_id = claims.employee_id

    if not raw_id:
        return "Please provide an employeeId.", [], "employee", None

    data = None
    resolved_id: Optional[int] = None

    # 1. Try direct numeric lookup if raw_id is numeric or can be parsed
    try:
        clean_str = str(raw_id).strip()
        if clean_str.upper().startswith("E-"):
            clean_str = clean_str[2:]
        if clean_str.isdigit():
            numeric_id = int(clean_str)
            data = await backend_client.get(f"/api/employees/{numeric_id}/summary", token=token)
            if data and data.get("id"):
                resolved_id = int(data["id"])
    except Exception:
        data = None

    # 2. If direct numeric lookup was not successful (e.g. employeeNo 1003 instead of DB id 3, or name string), search by q
    if not data:
        try:
            search_res = await backend_client.get("/api/employees", params={"q": str(raw_id), "size": 5}, token=token)
            items = search_res.get("content", []) if isinstance(search_res, dict) else (search_res if isinstance(search_res, list) else [])
            if items:
                actual_id = items[0].get("id")
                if actual_id:
                    data = await backend_client.get(f"/api/employees/{actual_id}/summary", token=token)
                    if data and data.get("id"):
                        resolved_id = int(data["id"])
        except Exception:
            data = None

    if not data or not resolved_id:
        if not has_read_all and claims.employee_id and resolved_id != claims.employee_id:
            return (
                f"Access Restricted: As an employee, you only have permission to view your own personal employee records. "
                f"You are not authorized to view 360-degree operational summaries or details for other colleagues ({raw_id}). "
                f"If you require information regarding this employee, please contact your HR department or People Operations manager.",
                [],
                "employee",
                str(raw_id),
            )
        return f"Employee '{raw_id}' was not found.", [], "employee", str(raw_id)

    formatted = format_tool_result(data)
    emp = formatted["ui_view"]
    counts = emp.get("counts", {})

    display_name = emp.get("displayName", f"Employee #{resolved_id}")
    emp_no = emp.get("employeeNo", "N/A")
    dept = emp.get("departmentName", "N/A")
    job = emp.get("jobTitle", "N/A")
    status = "Active" if emp.get("active") else "Inactive"
    manager = emp.get("managerName") or "None"
    schedule = emp.get("scheduleName") or "Standard"

    # Fetch active contract wage if available
    wage_info = "N/A"
    try:
        contracts_data = await backend_client.get("/api/contracts", params={"employeeId": resolved_id, "state": "RUNNING"}, token=token)
        c_items = contracts_data.get("content", []) if isinstance(contracts_data, dict) else (contracts_data if isinstance(contracts_data, list) else [])
        if c_items:
            c = c_items[0]
            raw_wage = c.get("wage")
            if raw_wage is not None:
                wage_type = c.get("wageType", "MONTHLY")
                wage_info = f"₹{float(raw_wage):,.2f} ({wage_type})"
            elif c.get("reference"):
                wage_info = f"Active ({c.get('reference')})"
    except Exception:
        pass

    # Fetch leave balances if available
    leave_summary_str = ""
    try:
        leaves_data = await backend_client.get("/api/timeoff/balances", params={"employeeId": resolved_id}, token=token)
        l_items = leaves_data.get("content", []) if isinstance(leaves_data, dict) else (leaves_data if isinstance(leaves_data, list) else [])
        if l_items:
            balances = [f"{b.get('leaveTypeName', 'Leave')}: {b.get('remainingDays', 0)} days" for b in l_items[:3]]
            if balances:
                leave_summary_str = ", ".join(balances)
    except Exception:
        pass

    blocks = [
        kpi_block(
            title=f"{display_name} ({emp_no})",
            value=job,
            subtitle=f"Dept: {dept} | Status: {status} | Salary: {wage_info}",
            variant="positive" if emp.get("active") else "neutral"
        ),
        list_block(
            title="360° Operational Overview",
            items=[
                f"Active Contract / Wage: {wage_info}",
                f"Leave Balances: {leave_summary_str or 'Standard Accruals'}",
                f"Attendance Logs: {counts.get('attendance', 0)} records",
                f"Pending Requests: {counts.get('requests', 0)} leave requests",
                f"Manager: {manager}",
                f"Schedule: {schedule}",
            ]
        ),
        link_block(
            label=f"View {display_name} in HR Hub",
            url=f"/employees/{resolved_id}"
        )
    ]

    summary_text = (
        f"Employee 360 Dossier for {display_name} ({emp_no}):\n"
        f"- Position: '{job}' in Department '{dept}'\n"
        f"- Manager: {manager} | Schedule: {schedule} | Status: {status}\n"
        f"- Compensation: {wage_info}\n"
        f"- Leave Balances: {leave_summary_str or 'Standard entitlement'}\n"
        f"- Activity: {counts.get('contracts', 0)} contracts, "
        f"{counts.get('attendance', 0)} attendance records, {counts.get('requests', 0)} leave requests."
    )
    return summary_text, blocks, "employee", str(resolved_id)
