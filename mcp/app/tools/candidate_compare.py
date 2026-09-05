from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, table_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result


@registry.register(
    name="candidate_compare",
    description="Compares 2 to 5 job applicants for an opening against skill rubric, experience, and salary band.",
    required_permission="candidate.compare",
    parameters={
        "type": "object",
        "properties": {
            "openingId": {"type": "integer", "description": "The job opening ID"},
            "candidateIds": {
                "type": "array",
                "items": {"type": "integer"},
                "description": "List of 2 to 5 candidate IDs to compare"
            },
        },
        "required": ["openingId", "candidateIds"],
    },
    resource_type="recruitment_comparison",
)
async def candidate_compare_tool(
    args: Dict[str, Any],
    token: str,
    claims: TokenClaims,
) -> Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]:
    opening_id = args.get("openingId")
    candidate_ids = args.get("candidateIds", [])

    if not opening_id or not candidate_ids or len(candidate_ids) < 2:
        return "Please provide an openingId and between 2 and 5 candidateIds to compare.", [], "recruitment_comparison", None

    # Use comma-separated IDs for GET /api/recruitment/openings/{id}/comparison?candidateIds=1,2
    id_param = ",".join(str(cid) for cid in candidate_ids)
    data = await backend_client.get(
        f"/api/recruitment/openings/{opening_id}/comparison",
        params={"candidateIds": id_param},
        token=token
    )
    if not data or not isinstance(data, dict):
        return f"Comparison could not be generated for opening #{opening_id}.", [], "recruitment_comparison", str(opening_id)

    formatted = format_tool_result(data)
    result = formatted["ui_view"]
    candidates = result.get("candidates", [])

    rows = []
    best_candidate = None
    best_score = -1
    for c in candidates:
        code = c.get("code", "Candidate")
        total = c.get("total", 0)
        band = c.get("bandStatus", "IN_BAND")
        if total > best_score:
            best_score = total
            best_candidate = code
        rows.append([
            code,
            f"{total}/100",
            band,
        ])

    blocks = []
    if best_candidate:
        blocks.append(kpi_block(
            title="Top Ranked Candidate",
            value=best_candidate,
            subtitle=f"Overall Rubric Score: {best_score}/100",
            variant="positive"
        ))

    if rows:
        blocks.append(table_block(
            title=f"Candidate Comparison Matrix (Opening #{opening_id})",
            headers=["Candidate Code", "Overall Score", "Salary Fit"],
            rows=rows
        ))

    summary_text = (
        f"Compared {len(candidates)} candidates for opening #{opening_id}. "
        f"Top candidate: {best_candidate} ({best_score}/100). "
        f"Disclaimer: {result.get('disclaimer', 'Evaluated against automated rubric.')}"
    )
    return summary_text, blocks, "recruitment_comparison", str(opening_id)
