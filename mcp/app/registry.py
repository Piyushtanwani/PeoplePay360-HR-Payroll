import logging
import time
from typing import Any, Callable, Coroutine, Dict, List, Optional, Tuple
from app.schemas import ToolCallRecord, ToolDefinition, ToolParameters
from app.security import TokenClaims

logger = logging.getLogger("mcp.registry")


class RegisteredTool:
    def __init__(
        self,
        name: str,
        description: str,
        required_permission: str,
        parameters: Dict[str, Any],
        handler: Callable[..., Coroutine[Any, Any, Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]]],
        resource_type: Optional[str] = None,
    ):
        self.name = name
        self.description = description
        self.required_permission = required_permission
        self.parameters = parameters
        self.handler = handler
        self.resource_type = resource_type

    def to_definition(self) -> ToolDefinition:
        params_obj = ToolParameters(
            type="object",
            properties=self.parameters.get("properties", {}),
            required=self.parameters.get("required", [])
        )
        return ToolDefinition(
            name=self.name,
            description=self.description,
            parameters=params_obj,
            requiredPermission=self.required_permission,
            resourceType=self.resource_type,
        )


class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, RegisteredTool] = {}

    def register(
        self,
        name: str,
        description: str,
        required_permission: str,
        parameters: Dict[str, Any],
        resource_type: Optional[str] = None,
    ):
        """Decorator to register an MCP tool."""
        def decorator(fn: Callable[..., Coroutine[Any, Any, Tuple[str, List[Dict[str, Any]], Optional[str], Optional[str]]]]):
            tool = RegisteredTool(
                name=name,
                description=description,
                required_permission=required_permission,
                parameters=parameters,
                handler=fn,
                resource_type=resource_type,
            )
            self._tools[name] = tool
            return fn
        return decorator

    def get(self, name: str) -> Optional[RegisteredTool]:
        return self._tools.get(name)

    def list_all(self) -> List[ToolDefinition]:
        return [t.to_definition() for t in self._tools.values()]

    def list_for(self, claims: Optional[TokenClaims]) -> List[ToolDefinition]:
        """Returns only the tools authorized for the caller's role/permissions."""
        if claims is None:
            return []
        definitions: List[ToolDefinition] = []
        for tool in self._tools.values():
            if tool.required_permission == "authenticated" or claims.has_permission(tool.required_permission):
                definitions.append(tool.to_definition())
        return definitions

    async def execute(
        self,
        name: str,
        args: Dict[str, Any],
        token: str,
        claims: TokenClaims,
    ) -> Tuple[str, List[Dict[str, Any]], ToolCallRecord]:
        """
        Executes a registered tool with deny-by-default access check and latency timing.
        Returns: (text_result_for_llm, ui_blocks, tool_call_record)
        """
        tool = self.get(name)
        if not tool:
            record = ToolCallRecord(
                toolName=name,
                allowed=False,
                denialCode="TOOL_NOT_FOUND",
                rawInput=args,
            )
            return f"Error: Tool '{name}' does not exist.", [], record

        # Authorization check
        if tool.required_permission != "authenticated" and not claims.has_permission(tool.required_permission):
            logger.warning(
                "Access denied for tool %s: user %s lacks permission %s",
                name, claims.user_id, tool.required_permission
            )
            record = ToolCallRecord(
                toolName=name,
                allowed=False,
                denialCode="PERMISSION_DENIED",
                resourceType=tool.resource_type,
                rawInput=args,
            )
            return (
                f"Permission denied: You do not have the required permission '{tool.required_permission}' to run '{name}'.",
                [],
                record
            )

        # Execution with latency recording
        start_time = time.time()
        try:
            text_result, blocks, res_type, res_id = await tool.handler(args, token, claims)
            latency = int((time.time() - start_time) * 1000)
            record = ToolCallRecord(
                toolName=name,
                allowed=True,
                latencyMs=latency,
                resourceType=res_type or tool.resource_type,
                resourceId=str(res_id) if res_id is not None else None,
                rawInput=args,
                rawOutput=text_result,
            )
            return text_result, blocks, record
        except Exception as exc:
            latency = int((time.time() - start_time) * 1000)
            logger.exception("Error executing tool %s: %s", name, exc)
            record = ToolCallRecord(
                toolName=name,
                allowed=False,
                denialCode="EXECUTION_ERROR",
                latencyMs=latency,
                resourceType=tool.resource_type,
                rawInput=args,
            )
            return f"Error executing tool '{name}': {str(exc)}", [], record


registry = ToolRegistry()
