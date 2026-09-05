from typing import Any, Dict, List, Optional, Tuple
from app.backend import backend_client
from app.blocks import kpi_block, list_block
from app.registry import registry
from app.security import TokenClaims
from app.views import format_tool_result


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
    data = await backend_client.get("/api/auth/me", token=token)
    if not data:
        return "Could not retrieve user profile.", [], "user", str(claims.user_id)

    formatted = format_tool_result(data)
    user_info = formatted["ui_view"]

    username = user_info.get("username", "Unknown")
    display_name = user_info.get("displayName", username)
    role = user_info.get("role", {}).get("name", claims.role or "User")
    permissions = user_info.get("permissions", claims.permissions)

    blocks = [
        kpi_block(
            title="Logged-in User",
            value=display_name,
            subtitle=f"Role: {role}",
            variant="neutral"
        ),
        list_block(
            title=f"Active Authorities ({len(permissions)})",
            items=permissions[:10] + (["...and more"] if len(permissions) > 10 else [])
        )
    ]

    text = (
        f"You are authenticated as {display_name} ({username}) with role '{role}'. "
        f"Your account holds {len(permissions)} permissions."
    )
    return text, blocks, "user", str(user_info.get("id", claims.user_id))
