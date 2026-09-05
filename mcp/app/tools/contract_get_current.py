from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result, rows_of


@registry.register(
    name="contract_get_current",
    description="Retrieves the key terms, start date, renewal or end date, job title, working schedule, and status of an employee's current active employment contract. Available to employees for their own contract, or to HR/Admins for any employee.",
    required_permission="contract.read.own",
    parameters={
        "type": "object",
        "properties": {
            "employeeId": {
                "type": "integer",
                "description": "Optional employee ID to inspect. Defaults to the currently authenticated employee.",
            },
        },
        "required": [],
    },
    resource_type="contract",
)
async def contract_get_current_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    # Determine which employee ID to query
    target_id = args.get("employeeId")
    if target_id is not None and target_id != claims.employee_id and not claims.has_permission("contract.read.all"):
        return (
            "Access Restricted: As an employee, you only have permission to view your own employment contract. "
            "You are not authorized to view contract terms or compensation details for other employees. "
            "Please reach out to your HR department or People Operations manager for assistance.",
            [],
            "contract",
            None,
        )
    if not target_id:
        target_id = claims.employee_id

    if not target_id:
        return "Could not determine employee ID to retrieve contract details.", [], "contract", None

    # Query active running contracts for this employee
    params: Dict[str, Any] = {"employeeId": target_id, "state": "RUNNING"}
    data = await backend_client.get("/api/contracts", params=params, token=token)
    contracts = rows_of(data)

    if not contracts:
        # Fallback: query without state filter to check for any contract on file
        fallback_data = await backend_client.get("/api/contracts", params={"employeeId": target_id}, token=token)
        contracts = rows_of(fallback_data)

    if not contracts:
        return (
            f"No contract records found on file for employee #{target_id}. Please check with HR Operations.",
            [],
            "contract",
            str(target_id),
        )

    formatted = format_tool_result(contracts)
    ui_contracts = formatted["ui_view"]
    c = ui_contracts[0]

    ref = c.get("reference") or f"Contract #{c.get('id')}"
    emp_name = c.get("employeeName") or f"Employee #{target_id}"
    job_title = c.get("jobTitle") or "Staff"
    start_date = c.get("startDate") or "N/A"
    end_date = c.get("endDate")
    state = c.get("state") or "RUNNING"
    schedule_name = c.get("workingScheduleName") or "Standard Working Hours"

    renewal_str = str(end_date) if end_date else "Permanent / Open-Ended (Continuous employment, no fixed renewal date)"
    wage_val = c.get("wage")
    wage_str = f"₹{float(wage_val):,.2f} ({c.get('wageType', 'MONTHLY')})" if wage_val is not None else None

    table_row = [
        ref,
        job_title,
        str(start_date),
        str(end_date) if end_date else "Permanent (No expiry)",
        schedule_name,
        state,
    ]
    headers = ["Contract Ref", "Position / Role", "Start Date", "End / Renewal Date", "Working Schedule", "Status"]

    if wage_str:
        table_row.insert(2, wage_str)
        headers.insert(2, "Agreed Wage")

    blocks = [
        kpi_block(
            title=f"Active Contract ({ref})",
            value=job_title,
            subtitle=f"Renewal / End: {str(end_date) if end_date else 'Permanent / Open-Ended'}",
            variant="positive",
        ),
        table_block(
            title=f"Contract Terms — {emp_name}",
            headers=headers,
            rows=[table_row],
        ),
    ]

    summary_text = (
        f"Active contract details for {emp_name} (Reference: {ref}):\n"
        f"- Contract Status: {state} (Active)\n"
        f"- Position / Job Title: {job_title}\n"
        f"- Effective Start Date: {start_date}\n"
        f"- Renewal / End Date: {renewal_str}\n"
        f"- Working Schedule: {schedule_name}\n"
        + (f"- Compensation: {wage_str}\n" if wage_str else "")
        + f"- Key Terms: Fully active employment agreement with continuous validity under {schedule_name} schedule."
    )

    return summary_text, blocks, "contract", str(c.get("id"))
