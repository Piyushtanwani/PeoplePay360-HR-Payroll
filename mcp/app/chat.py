import json
import logging
from typing import Any, Dict, List
from app.providers import provider_manager
from app.registry import registry
from app.schemas import ChatRequest, ChatResponse, ProviderConfig, ToolCallRecord
from app.security import TokenClaims

logger = logging.getLogger("mcp.chat")

SYSTEM_PROMPT_TEMPLATE = """You are the PeoplePay360 AI Assistant. PeoplePay360 is an enterprise HR and Payroll Operations platform.

SCOPE RULE:
You answer questions about employees, departments, employment contracts, working schedules, daily
attendance, time-off requests & balances, payroll batches (payruns), payslips, salary rules, and
executive reporting - by reading real PeoplePay360 records through your tools.
You do NOT write code, solve puzzles, give general knowledge, medical/legal advice, or chit-chat,
even if asked directly and even if the request looks harmless or trivial (e.g. "write a function
that reverses a string"). For anything outside HR/Payroll operations, refuse in one sentence and
name a few things you can help with instead. Do not attempt the off-topic request first.

GROUNDING RULE:
Use the provided tools to fetch real data from PeoplePay360. NEVER invent an employee name, a leave balance,
a salary amount or a date. Every figure you give must come from a tool result in this conversation.

ANSWERING FROM TOOL RESULTS:
A tool result contains a summary line and a "Rows:" list holding the actual records. Answer the question
directly from those rows. Name the people, quote the figures, and give the count the summary states.
Never reply with only "see the details below" or "here is the summary" - the person asked a question,
so answer it in words. If a tool returned nothing, say so plainly.

ANSWER STYLE:
Markdown. Short paragraphs, **bold** for key terms, and "-" bullets for lists of records.
Keep it under about 150 words unless more detail is asked for.

The current user is {display_name} with role '{role_code}'.
"""


def format_system_prompt(claims: TokenClaims, user_block: Any) -> str:
    name = (
        (user_block.displayNameForUi if user_block else None)
        or claims.sub
        or "Employee"
    )
    role = (
        (user_block.roleCode if user_block else None)
        or claims.role
        or "ROLE_EMPLOYEE"
    )
    return SYSTEM_PROMPT_TEMPLATE.format(display_name=name, role_code=role)


async def handle_chat_turn(
    request: ChatRequest,
    token: str,
    claims: TokenClaims,
) -> ChatResponse:
    """
    Orchestrates the chat turn:
    - Filters tools authorized for caller's permissions
    - Iterates over LLM tool call requests up to maxToolCalls limit
    - Collects UI presentation blocks and audit records
    - Checks grounding and formats the final response
    """
    # 1. Filter tools by caller permissions
    authorized_tools = registry.list_for(claims)
    openai_tools = [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": {
                    "type": "object",
                    "properties": t.parameters.properties,
                    "required": t.parameters.required,
                },
            },
        }
        for t in authorized_tools
    ]

    # 2. Prepare message history
    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": format_system_prompt(claims, request.user)}
    ]
    for m in request.messages:
        messages.append({"role": m.role, "content": m.content})

    provider_config = request.provider or ProviderConfig()
    max_tool_calls = request.limits.maxToolCalls if request.limits else 8

    accumulated_blocks: List[Dict[str, Any]] = []
    accumulated_tool_records: List[ToolCallRecord] = []

    tool_call_count = 0
    final_content = ""

    # 3. Agent tool calling loop
    while tool_call_count < max_tool_calls:
        content, tool_calls = await provider_manager.generate(messages, openai_tools, provider_config)

        if not tool_calls:
            # Model gave final answer
            final_content = content
            break

        # Append assistant message with requested tool calls to history
        messages.append({
            "role": "assistant",
            "content": content or None,
            "tool_calls": [
                {
                    "id": tc["id"],
                    "type": "function",
                    # JSON, not a Python repr. str() produces single quotes, which providers
                    # reject as "invalid tool call arguments", and the whole turn then fell back
                    # to the canned offline reply.
                    "function": {"name": tc["name"], "arguments": json.dumps(tc["arguments"] or {})},
                }
                for tc in tool_calls
            ],
        })

        for tc in tool_calls:
            tool_call_count += 1
            tool_name = tc["name"]
            tool_args = tc["arguments"]

            logger.info("Executing tool %s (turn %s) with args: %s", tool_name, tool_call_count, tool_args)
            text_result, blocks, record = await registry.execute(
                name=tool_name,
                args=tool_args,
                token=token,
                claims=claims,
            )

            accumulated_blocks.extend(blocks)
            accumulated_tool_records.append(record)

            messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": text_result,
            })

            if tool_call_count >= max_tool_calls:
                break

    if not final_content and messages:
        # Final pass after tool outputs
        final_content, _ = await provider_manager.generate(messages, [], provider_config)

    # 4. Final verification and polish
    if not final_content:
        final_content = "I have retrieved the requested records from PeoplePay360. Please see the details above."

    return ChatResponse(
        content=final_content,
        blocks=accumulated_blocks,
        toolCalls=accumulated_tool_records,
    )
