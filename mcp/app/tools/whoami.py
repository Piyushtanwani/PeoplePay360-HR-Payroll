from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, link_block, list_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result

# The seeded roles, in the words a person would use for them.
ROLE_LABELS = {
    "ADMIN": "Administrator",
    "HR_MANAGER": "HR Manager",
    "HR_PAYROLL_MANAGER": "Payroll Manager",
    "HR_PAYROLL_USER": "Payroll User",
    "EMPLOYEE": "Employee",
}


@registry.register(
    name="whoami",
    description="Returns the profile, role, and permissions of the currently authenticated user.",
    required_permission="authenticated",
    parameters={
        "type": "object",
        "properties": {},
        "required": [],
    },
    resource_type="user",
)
async def whoami_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    """
    Who the caller is, read from the session rather than guessed.

    The fields live under `user` and `employee` in the response. Reading them off the top level
    produced "Unknown" and a role of "User" for everybody, which made the assistant look like it had
    no idea who it was talking to.
    """
    data = await backend_client.get("/api/auth/me", token=token)
    if not data:
        return "Could not retrieve your profile.", [], "user", str(claims.user_id)

    view = format_tool_result(data)["ui_view"]
    user = view.get("user") or {}
    employee = view.get("employee") or {}
    permissions = view.get("permissions") or claims.permissions or []

    display_name = user.get("displayName") or employee.get("displayName") or "Unknown"
    role_code = user.get("roleCode") or claims.role or ""
    role = ROLE_LABELS.get(role_code, role_code or "Unknown role")
    job_title = employee.get("jobTitle")
    department = employee.get("departmentName")
    employee_no = employee.get("employeeNo")

    details = [f"Role: {role}"]
    if job_title:
        details.append(f"Job title: {job_title}")
    if department:
        details.append(f"Department: {department}")
    if employee_no:
        details.append(f"Employee number: {employee_no}")

    blocks: List[Dict[str, Any]] = [
        kpi_block(title="Signed in as", value=display_name, subtitle=role),
        list_block(title="Your details", items=details),
        list_block(
            # The full list runs to eighty-odd codes, which is a wall rather than an answer.
            title=f"What you may do ({len(permissions)} permissions)",
            items=sorted(permissions)[:10] + ([f"…and {len(permissions) - 10} more"] if len(permissions) > 10 else []),
        ),
    ]
    if employee.get("id"):
        blocks.append(link_block(label="Open my employee record", url=f"/employees/{employee['id']}"))

    text = (
        f"You are signed in as {display_name}, with the {role} role. "
        + (f"You are {job_title} in {department}. " if job_title and department else "")
        + f"Your account holds {len(permissions)} permissions."
    )
    return text, blocks, "user", str(user.get("id") or claims.user_id)
