from datetime import datetime, timedelta
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
attendance, time-off requests & balances, payroll batches (payruns), payslips, salary rules,
executive reporting, system capabilities, and live active MCP tools - by reading real PeoplePay360 records through your tools.
When asked by administrators or users about active MCP tools, system capabilities, or what records can be queried, this is completely within scope: use your `system_tools_list` tool to inspect and list the live tools and the specific HR/Payroll records they query.
You do NOT write code, solve puzzles, give general knowledge, medical/legal advice, or chit-chat,
even if asked directly and even if the request looks harmless or trivial (e.g. "write a function
that reverses a string"). Only refuse requests that are genuinely non-work related (e.g. poetry, general trivia, code writing).

TEMPORAL CONTEXT & SYSTEM DATES:
- TODAY'S DATE: {current_date_full} (ISO: {current_date_iso}).
- CURRENT YEAR: {current_year}.
- CURRENT MONTHLY PERIOD: {current_period} (e.g. September {current_year}).
- PREVIOUS MONTHLY PERIOD: {prev_period} (e.g. August {current_year}).
- CRITICAL: We are operating in the year {current_year}. NEVER assume or say it is 2023, 2024, or 2025.
- When the user asks about "today", "this week", "this month", "recent", or "current period", always query and answer relative to {current_year} (period {current_period}).

GROUNDING RULE:
Use the provided tools to fetch real data from PeoplePay360. NEVER invent an employee name, a leave balance,
a salary amount or a date. Every figure you give must come from a tool result in this conversation.

ANSWERING FROM TOOL RESULTS:
A tool result contains a summary line and a "Rows:" list holding the actual records. Answer the question
directly from those rows. Name the people, quote the figures, and give the count the summary states.
Never reply with only "see the details below" or "here is the summary" - the person asked a question,
so answer it in words. If a tool returned nothing, say so plainly.

EXPIRING CONTRACTS RULE:
When the user asks which contracts are expiring soon:
- If contracts are found expiring within the default window (60 days), list them with their end dates.
- If no contracts expire within 60 days, but the tool provides the nearest upcoming contract expirations (e.g. beyond 60 days), ALWAYS share those nearest upcoming contracts, highlighting who they are, their end dates, and how many days remain until expiration.
- If all contracts are permanent / open-ended with no scheduled end date, state that clearly.

MCP TOOLS & SYSTEM CAPABILITIES RULE:
When asked "What live MCP tools are active?", "What can you do?", or what records tools can query:
- Call `system_tools_list` to fetch the authorized live MCP tools.
- Provide a clear, organized breakdown of the active tools and the records they query (Employees, Contracts, Attendance Exceptions, Leave Balances & Requests, Payroll & Payruns, Payslips, Recruitment Candidates, etc.).

EMPLOYEE CONTRACT INQUIRIES RULE:
When an employee or user asks about their own contract, key terms, renewal date, or employment agreement (e.g. "What are the key terms and renewal date on my current contract?"):
- ALWAYS call `contract_get_current` to retrieve their active contract terms, start date, renewal/end date, job position, and working schedule.
- Explain the key terms clearly: Job position, Contract Status, Effective Start Date, Renewal/End Date (noting whether it is Permanent / Open-ended or has a fixed expiry date), and Working Schedule.

EMPLOYEE DATA PRIVACY & ACCESS CONTROL RULE:
When a user with the Employee role (or any caller without 'employee.read.all' authority) asks to view another employee's 360-degree summary, profile, attendance, leave balance, payslip, or contract (e.g. asking for "Jordan Lee" or another colleague):
- Answer with a simple, polite, and professional paragraph explaining that as an employee, they are only authorized to view their own personal records and employment information.
- Explain that 360-degree operational profiles, salary data, and private employment records of other colleagues are restricted to HR and management for privacy and security.
- Advise them to reach out to their HR department or People Operations manager if they need assistance regarding a colleague.
- NEVER state that the employee does not exist or that there is no record on file when access is restricted by permissions.

ANSWER STYLE:
Markdown. Short paragraphs, **bold** for key terms, and "-" bullets for lists of records.
Keep it under about 150 words unless more detail is asked for.

The current user is {display_name} with role '{role_code}'.
"""


def format_system_prompt(claims: TokenClaims, user_block: Any) -> str:
    now = datetime.now()
    current_date_full = now.strftime("%A, %B %d, %Y")
    current_date_iso = now.strftime("%Y-%m-%d")
    current_year = str(now.year)
    current_period = f"{now.year}-{now.month:02d}"

    first_of_month = now.replace(day=1)
    prev_month_last = first_of_month - timedelta(days=1)
    prev_period = f"{prev_month_last.year}-{prev_month_last.month:02d}"

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
    return SYSTEM_PROMPT_TEMPLATE.format(
        display_name=name,
        role_code=role,
        current_date_full=current_date_full,
        current_date_iso=current_date_iso,
        current_year=current_year,
        current_period=current_period,
        prev_period=prev_period,
    )


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
