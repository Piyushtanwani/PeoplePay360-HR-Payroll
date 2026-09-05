import json
import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

try:
    from openai import AsyncOpenAI  # pyright: ignore[reportMissingImports]
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

try:
    from app.schemas import ProviderConfig
    from app.settings import settings
except ImportError:
    from .schemas import ProviderConfig
    from .settings import settings

logger = logging.getLogger("mcp.providers")


class ProviderManager:
    """Manages connections to LLM providers (Ollama, OpenRouter, NVIDIA, Mock)."""

    def _normalize_base_url(self, base_url: Optional[str]) -> str:
        url = (base_url or "http://localhost:11434").rstrip("/")
        if not url.endswith("/v1"):
            url = f"{url}/v1"
        return url

    async def _generate_via_httpx(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        config: ProviderConfig,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """Direct HTTP client implementation for OpenAI-compatible endpoints when openai lib is absent."""
        base_url = self._normalize_base_url(config.baseUrl)
        url = f"{base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.apiKey or 'ollama'}",
        }
        payload: Dict[str, Any] = {
            "model": config.model or "llama3.1:8b",
            "messages": messages,
            "temperature": config.temperature or 0.2,
            "max_tokens": config.maxTokens or 2048,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        choice = data.get("choices", [{}])[0]
        msg = choice.get("message", {})
        raw_tool_calls = msg.get("tool_calls", [])

        tool_calls: List[Dict[str, Any]] = []
        for tc in raw_tool_calls:
            fn = tc.get("function", {})
            fn_name = fn.get("name", "")
            raw_args = fn.get("arguments", {})
            if isinstance(raw_args, str):
                try:
                    args = json.loads(raw_args)
                except Exception:
                    args = {}
            else:
                args = raw_args or {}

            tool_calls.append({
                "id": tc.get("id", f"call_{len(tool_calls)}"),
                "name": fn_name,
                "arguments": args,
            })

        return msg.get("content") or "", tool_calls

    async def _generate_via_openai(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        config: ProviderConfig,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """Uses AsyncOpenAI client if the openai package is installed."""
        base_url = self._normalize_base_url(config.baseUrl)
        client = AsyncOpenAI(
            base_url=base_url,
            api_key=config.apiKey or "ollama",
            timeout=settings.llm_timeout_seconds,
            # A timed-out generation is not worth repeating: the retry waits just as long and the
            # person is already staring at a spinner. Fail once and say so.
            max_retries=0,
        )
        kwargs: Dict[str, Any] = {
            "model": config.model or "llama3.1:8b",
            "messages": messages,
            "temperature": config.temperature or 0.2,
            "max_tokens": config.maxTokens or 2048,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        response = await client.chat.completions.create(**kwargs)
        choice = response.choices[0]
        message = choice.message

        tool_calls: List[Dict[str, Any]] = []
        if message.tool_calls:
            for tc in message.tool_calls:
                fn_name = tc.function.name
                try:
                    args = json.loads(tc.function.arguments)
                except Exception:
                    args = {}
                tool_calls.append({
                    "id": tc.id,
                    "name": fn_name,
                    "arguments": args,
                })

        return message.content or "", tool_calls

    async def generate(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        config: ProviderConfig,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Calls the LLM provider with tools.
        Returns: (content_str, list_of_tool_calls)
        """
        if config.provider.lower() == "mock":
            return self._mock_generate(messages, tools)

        try:
            if HAS_OPENAI:
                return await self._generate_via_openai(messages, tools, config)
            else:
                return await self._generate_via_httpx(messages, tools, config)
        except Exception as err:
            logger.warning("LLM provider %s call failed: %s", config.provider, err)
            if settings.enable_mock_llm:
                logger.info("Falling back to the deterministic provider after a model failure.")
                return self._mock_generate(
                    messages, tools, degraded=True,
                    degraded_reason=self._explain_failure(err, config),
                )
            raise

    @staticmethod
    def _explain_failure(err: Exception, config: ProviderConfig) -> str:
        """
        Says what actually went wrong, in terms an operator can act on.

        The difference matters: a model that cannot call tools needs replacing, a timeout needs
        patience or a smaller model, and a missing key needs a key. "The model did not respond"
        covers all three and helps with none.
        """
        text = str(err)
        model = config.model or "the configured model"
        if "does not support tools" in text or ("tool" in text and "support" in text):
            return (
                f"The configured model, {model}, cannot call tools, so it cannot read your records. "
                "Choose a tool-capable model in AI Settings."
            )
        if "timed out" in text.lower() or "timeout" in text.lower():
            return (
                f"{model} took too long to answer. It may be loading for the first time; "
                "try again, or choose a smaller model in AI Settings."
            )
        if "402" in text or "credits" in text.lower():
            return "The AI provider account requires more credits or lower max_tokens."
        if "401" in text or "403" in text or "api key" in text.lower():
            return "The provider rejected the API key. Check it in AI Settings."
        if "404" in text or "not found" in text.lower():
            return f"The provider does not offer {model}. Choose another in AI Settings."
        return "The language model did not respond."

    def _mock_generate(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        degraded: bool = False,
        degraded_reason: str = "The language model did not respond.",
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Chooses a tool, or writes an answer, without a model.

        Two callers, and the difference matters. As the `mock` provider it is the whole assistant and
        its replies are the product. As a fallback after the real model failed, `degraded` is set and
        every reply says so: filler that reads like an answer is worse than an error, because nobody
        goes looking for the fault.
        """
        last_user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = (m.get("content") or "").lower()
                break

        tool_results = [m for m in messages if m.get("role") == "tool"]
        if tool_results:
            return self._summarise_without_model(tool_results, degraded, degraded_reason), []

        available_tool_names = {t["function"]["name"] for t in tools if "function" in t}

        # 1. Whoami
        if any(w in last_user_msg for w in ["who am i", "my profile", "my role"]) and "whoami" in available_tool_names:
            return "", [{"id": "call_whoami", "name": "whoami", "arguments": {}}]

        # 2. Leave balances
        if any(w in last_user_msg for w in ["leave balance", "time off balance", "how many leaves"]) and "timeoff_get_balance" in available_tool_names:
            return "", [{"id": "call_tob", "name": "timeoff_get_balance", "arguments": {}}]

        # 3. Pending leave requests
        if any(w in last_user_msg for w in ["pending leave", "leave request", "pending request"]) and "timeoff_list_pending" in available_tool_names:
            return "", [{"id": "call_tlp", "name": "timeoff_list_pending", "arguments": {}}]

        # 4. Attendance exceptions
        if any(w in last_user_msg for w in ["attendance", "missing check", "exception", "late"]) and "attendance_list_exceptions" in available_tool_names:
            return "", [{"id": "call_ale", "name": "attendance_list_exceptions", "arguments": {}}]

        # 5. Payrun issues
        if ("issue" in last_user_msg or "warning" in last_user_msg or "blocker" in last_user_msg) and "payrun" in last_user_msg and "payrun_list_issues" in available_tool_names:
            match = re.search(r"\b(\d+)\b", last_user_msg)
            pid = int(match.group(1)) if match else 1
            return "", [{"id": "call_pli", "name": "payrun_list_issues", "arguments": {"payrunId": pid}}]

        # 6. Payruns
        if ("payrun" in last_user_msg or "batch" in last_user_msg) and "payrun_list" in available_tool_names:
            return "", [{"id": "call_pl", "name": "payrun_list", "arguments": {}}]

        # 7. Explain payslip
        if any(w in last_user_msg for w in ["explain payslip", "salary breakdown"]) and "payslip_explain" in available_tool_names:
            match = re.search(r"\b(\d+)\b", last_user_msg)
            ps_id = int(match.group(1)) if match else 1
            return "", [{"id": "call_pe", "name": "payslip_explain", "arguments": {"payslipId": ps_id}}]

        # 8. Payslips list
        if any(w in last_user_msg for w in ["payslip", "salary slip"]) and "payslip_list" in available_tool_names:
            return "", [{"id": "call_psl", "name": "payslip_list", "arguments": {}}]

        # 9. Dashboard KPIs
        if any(w in last_user_msg for w in ["dashboard", "kpi", "total salary expenditure", "expenditure"]) and "dashboard_kpis" in available_tool_names:
            return "", [{"id": "call_dkpi", "name": "dashboard_kpis", "arguments": {}}]

        # 10. Contracts: current active contract or expiring contracts
        if "contract_get_current" in available_tool_names and any(w in last_user_msg for w in ["my contract", "current contract", "key terms", "renewal date", "terms and renewal", "contract terms"]):
            return "", [{"id": "call_cgc", "name": "contract_get_current", "arguments": {}}]

        if any(w in last_user_msg for w in ["contract", "expiring"]) and "contract_list_expiring" in available_tool_names:
            return "", [{"id": "call_cle", "name": "contract_list_expiring", "arguments": {"daysAhead": 60}}]

        if "contract_get_current" in available_tool_names and "contract" in last_user_msg:
            return "", [{"id": "call_cgc", "name": "contract_get_current", "arguments": {}}]

        # 11. Compare candidates
        if any(w in last_user_msg for w in ["candidate", "applicant", "recruitment"]) and "candidate_compare" in available_tool_names:
            return "", [{"id": "call_cc", "name": "candidate_compare", "arguments": {"openingId": 1, "candidateIds": [1, 2]}}]

        # 12. Employee summary / search
        if any(w in last_user_msg for w in ["employee", "profile", "summary", "360", "who is"]):
            digits = [d for d in re.findall(r"\b(\d+)\b", last_user_msg) if d != "360"]
            if digits and "employee_summary" in available_tool_names:
                return "", [{"id": "call_esum", "name": "employee_summary", "arguments": {"employeeId": int(digits[0])}}]
            if "employee_summary" in available_tool_names:
                target = None
                for marker in ["summary for", "summary of", "profile for", "profile of", "about"]:
                    if marker in last_user_msg:
                        target = last_user_msg.split(marker, 1)[1].strip(" .?!")
                        break
                return "", [{"id": "call_esum", "name": "employee_summary", "arguments": {"employeeId": target or last_user_msg}}]
            if "employee_search" in available_tool_names:
                return "", [{"id": "call_es", "name": "employee_search", "arguments": {}}]

        if degraded:
            return (f"{degraded_reason} I could not work out which records to look up.", [])

        # Default greeting / assistance
        return (
            "I am the PeoplePay360 HR and Payroll Assistant. "
            "I can help you query live employee records, leave balances, attendance exceptions, "
            "payrun batches, and salary calculations using connected MCP tools. "
            "How can I assist you today?",
            [],
        )

    @staticmethod
    def _summarise_without_model(
        tool_results: List[Dict[str, Any]],
        degraded: bool,
        degraded_reason: str = "The language model did not respond.",
    ) -> str:
        """
        Reports what the lookups found when there is no model to phrase it.

        Each tool already returns a plain-English first line, such as "40 employees match". That line
        is a real answer; the JSON rows that follow it are for the model and are dropped here. The
        result is short and true, rather than a sentence that says nothing.
        """
        lines: List[str] = []
        for result in tool_results:
            content = (result.get("content") or "").strip()
            if not content:
                continue
            # Everything up to the machine-readable rows is the human-readable part.
            headline = content.split("\nRows:")[0].split("Rows:")[0].strip()
            if headline:
                lines.append(headline)

        if not lines:
            return (
                "The lookups returned nothing I can summarise without the language model. "
                "The records themselves are below."
            )

        if any("Access Restricted" in line for line in lines):
            return "\n\n".join(lines)

        body = "\n".join(f"- {line}" if len(lines) > 1 else line for line in lines)
        if degraded:
            return (
                f"{degraded_reason}\n\nThis is what the lookups returned:\n\n"
                f"{body}\n\nThe full records are below."
            )
        return f"{body}\n\nThe full records are below."

    async def test_connection(self, config: ProviderConfig) -> Tuple[bool, int, Optional[str]]:
        start_time = time.time()
        if config.provider.lower() == "mock":
            return True, 5, "Mock provider active."
        try:
            base_url = self._normalize_base_url(config.baseUrl)
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{base_url}/models", headers={"Authorization": f"Bearer {config.apiKey or 'ollama'}"})
                latency = int((time.time() - start_time) * 1000)
                if resp.status_code < 400:
                    return True, latency, "Connected successfully."
                return False, latency, f"Provider returned HTTP {resp.status_code}"
        except Exception as e:
            latency = int((time.time() - start_time) * 1000)
            logger.warning("Provider test failed: %s", e)
            return False, latency, str(e)

    async def list_models(self, config: ProviderConfig) -> List[str]:
        """Lists the models a provider offers.

        Returns an empty list when the provider cannot be reached. It must never invent model
        names: a fabricated list looks like a working connection and sends the operator hunting
        for a fault in the wrong place.
        """
        if config.provider.lower() == "mock":
            return ["mock-assistant"]
        try:
            base_url = self._normalize_base_url(config.baseUrl)
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{base_url}/models",
                    headers={"Authorization": f"Bearer {config.apiKey or 'ollama'}"},
                )
            if resp.status_code != 200:
                logger.warning(
                    "Provider %s returned HTTP %s when listing models",
                    config.provider,
                    resp.status_code,
                )
                return []
            data = resp.json()
            return [m["id"] for m in data.get("data", []) if isinstance(m, dict) and m.get("id")]
        except Exception as err:
            logger.warning("Failed to list models for provider %s: %s", config.provider, err)
            return []


provider_manager = ProviderManager()
