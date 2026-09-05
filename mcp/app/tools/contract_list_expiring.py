from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result, rows_of, model_summary


@registry.register(
    name="contract_list_expiring",
    description="Lists active employment contracts that are expiring soon. If no contracts expire within the specified window (default 60 days), it automatically returns the nearest upcoming contract expirations beyond that window.",
    required_permission="contract.read.all",
    parameters={
        "type": "object",
        "properties": {
            "daysAhead": {"type": "integer", "description": "Number of days ahead to look for expiring contracts. Default is 60 days."},
            "employeeId": {"type": "integer", "description": "Optional filter by employee ID"},
        },
        "required": [],
    },
    resource_type="contract",
)
async def contract_list_expiring_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    today = date.today()
    days_ahead = args.get("daysAhead", 60)
    cutoff = today + timedelta(days=days_ahead)

    params: Dict[str, Any] = {
        "state": "RUNNING",
        "endsBefore": cutoff.isoformat(),
        "size": 100,
    }
    if args.get("employeeId"):
        params["employeeId"] = args["employeeId"]

    data = await backend_client.get("/api/contracts", params=params, token=token)
    rows_from_backend = rows_of(data)

    is_fallback = False
    if not rows_from_backend:
        # If no contracts expire within the window, search all active contracts for nearest upcoming expirations
        all_params: Dict[str, Any] = {"state": "RUNNING", "size": 100}
        if args.get("employeeId"):
            all_params["employeeId"] = args["employeeId"]
        all_data = await backend_client.get("/api/contracts", params=all_params, token=token)
        all_contracts = rows_of(all_data)

        upcoming = []
        for c in all_contracts:
            end_date_str = c.get("endDate")
            if end_date_str:
                try:
                    c_end = date.fromisoformat(str(end_date_str))
                    if c_end >= today:
                        days_left = (c_end - today).days
                        c["_c_end"] = c_end
                        c["daysRemaining"] = days_left
                        upcoming.append(c)
                except Exception:
                    pass

        if upcoming:
            upcoming.sort(key=lambda x: x["_c_end"])
            rows_from_backend = upcoming[:10]
            is_fallback = True
        else:
            # All active contracts are permanent / open-ended
            blocks = [
                kpi_block(
                    title="Expiring Contracts",
                    value="0 upcoming",
                    subtitle="All active contracts are permanent / open-ended",
                    variant="neutral"
                )
            ]
            summary_text = (
                f"No active contracts are expiring within the next {days_ahead} days (before {cutoff}). "
                f"Furthermore, all active employee contracts in the system are open-ended / permanent with no scheduled end date."
            )
            return summary_text, blocks, "contract", None

    formatted = format_tool_result(rows_from_backend)
    contracts = formatted["ui_view"]

    # Ensure daysRemaining is populated
    for c in contracts:
        if "daysRemaining" not in c and c.get("endDate"):
            try:
                c_end = date.fromisoformat(str(c.get("endDate")))
                c["daysRemaining"] = (c_end - today).days
            except Exception:
                pass

    rows = []
    for c in contracts:
        wage = float(c.get("wage") or 0.0)
        days_rem = c.get("daysRemaining")
        days_rem_str = f"{days_rem} days" if days_rem is not None else "N/A"
        rows.append([
            str(c.get("id")),
            c.get("employeeName", f"Emp #{c.get('employeeId')}"),
            c.get("reference", "REF"),
            str(c.get("endDate")),
            days_rem_str,
            f"₹{wage:,.2f} ({c.get('wageType', 'MONTHLY')})",
            c.get("jobTitle", "N/A"),
        ])

    if is_fallback:
        nearest_date = rows_from_backend[0].get("endDate")
        nearest_days = rows_from_backend[0].get("daysRemaining")
        blocks = [
            kpi_block(
                title="Nearest Expiring Contracts",
                value=f"{len(contracts)} upcoming",
                subtitle=f"Nearest: {nearest_date} ({nearest_days} days away)",
                variant="warning"
            ),
            table_block(
                title=f"Nearest Upcoming Contract Expirations (beyond {days_ahead} days)",
                headers=["Contract ID", "Employee", "Reference", "End Date", "Time Remaining", "Wage", "Position"],
                rows=rows
            )
        ]
        rows_for_model = model_summary(
            contracts,
            ["reference", "employeeName", "jobTitle", "endDate", "daysRemaining", "wage"],
        )
        summary_text = (
            f"No active contracts expire within {days_ahead} days (before {cutoff}). "
            f"However, the nearest upcoming contract expirations beyond this window are {len(contracts)} contract(s):\n"
            f"Rows: {rows_for_model}"
        )
    else:
        blocks = [
            kpi_block(
                title=f"Expiring Contracts (< {days_ahead} days)",
                value=f"{len(contracts)} contracts",
                subtitle=f"Expiring on or before {cutoff}",
                variant="warning" if contracts else "positive"
            ),
            table_block(
                title=f"Contracts Expiring Before {cutoff}",
                headers=["Contract ID", "Employee", "Reference", "End Date", "Time Remaining", "Wage", "Position"],
                rows=rows
            )
        ]
        rows_for_model = model_summary(
            contracts,
            ["reference", "employeeName", "jobTitle", "endDate", "daysRemaining", "wage"],
        )
        summary_text = (
            f"{len(contracts)} contract(s) end within {days_ahead} days (before {cutoff}).\n"
            f"Rows: {rows_for_model}"
        )

    return summary_text, blocks, "contract", None
