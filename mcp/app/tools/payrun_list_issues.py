from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result, rows_of


@registry.register(
    name="payrun_list_issues",
    description="Lists validation issues and blocker alerts for a specific payrun before finalization (e.g. missing bank accounts, unapproved leaves, active contract conflicts).",
    required_permission="payrun.read",
    parameters={
        "type": "object",
        "properties": {
            "payrunId": {"type": "integer", "description": "The numeric ID of the payrun to inspect"},
            "severity": {"type": "string", "description": "Filter by severity: BLOCKER, WARNING", "enum": ["BLOCKER", "WARNING"]},
        },
        "required": ["payrunId"],
    },
    resource_type="payrun_issue",
)
async def payrun_list_issues_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    payrun_id = args.get("payrunId") or args.get("id")
    if not payrun_id:
        try:
            pr_res = await backend_client.get("/api/payruns", params={"size": 5}, token=token)
            pr_items = pr_res.get("content", []) if isinstance(pr_res, dict) else (pr_res if isinstance(pr_res, list) else [])
            if pr_items:
                drafts = [p for p in pr_items if p.get("state") in ("DRAFT", "PENDING_APPROVAL", "COMPUTED")]
                payrun_id = (drafts[0] if drafts else pr_items[0]).get("id")
        except Exception:
            payrun_id = None

    if not payrun_id:
        return "Please provide a payrunId or ensure at least one payrun exists.", [], "payrun_issue", None

    params: Dict[str, Any] = {}
    if args.get("severity"):
        params["severity"] = args["severity"]

    data = await backend_client.get(f"/api/payruns/{payrun_id}/issues", params=params, token=token)
    rows_from_backend = rows_of(data)
    if not rows_from_backend:
        return f"No issues found for payrun #{payrun_id}. The payrun is clean.", [], "payrun_issue", str(payrun_id)

    formatted = format_tool_result(rows_from_backend)
    issues = formatted["ui_view"]

    rows = []
    blockers = 0
    warnings = 0
    for iss in issues:
        sev = iss.get("severity", "WARNING")
        if sev == "BLOCKER":
            blockers += 1
        else:
            warnings += 1
        rows.append([
            str(iss.get("id")),
            iss.get("employeeName", f"Emp #{iss.get('employeeId')}"),
            iss.get("checkCode", "CHECK"),
            sev,
            iss.get("message", "Issue description"),
            iss.get("status", "OPEN"),
        ])

    blocks = [
        kpi_block(
            title=f"Payrun #{payrun_id} Health",
            value=f"{blockers} Blockers",
            subtitle=f"{warnings} Warnings | Total: {len(issues)} issues",
            variant="warning" if blockers > 0 else "neutral"
        )
    ]

    if rows:
        blocks.append(table_block(
            title=f"Pre-Finalization Issues (Payrun #{payrun_id})",
            headers=["Issue ID", "Employee", "Code", "Severity", "Message", "Status"],
            rows=rows
        ))

    summary_text = (
        f"Payrun #{payrun_id} has {len(issues)} issue(s): {blockers} blocker(s) and {warnings} warning(s)."
        if issues else f"Payrun #{payrun_id} has zero issues."
    )
    return summary_text, blocks, "payrun_issue", str(payrun_id)
