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
                logger.info("Falling back to deterministic heuristic provider.")
                return self._mock_generate(messages, tools)
            raise

    def _mock_generate(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """Heuristic fallback for offline / mock testing across all 13 tools."""
        last_user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = (m.get("content") or "").lower()
                break

        has_tool_results = any(m.get("role") == "tool" for m in messages)
        if has_tool_results:
            return (
                "Based on the live company records retrieved from PeoplePay360, "
                "here is the requested summary below.",
                [],
            )

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

        # 10. Expiring contracts
        if any(w in last_user_msg for w in ["contract", "expiring"]) and "contract_list_expiring" in available_tool_names:
            return "", [{"id": "call_cle", "name": "contract_list_expiring", "arguments": {"daysAhead": 60}}]

        # 11. Compare candidates
        if any(w in last_user_msg for w in ["candidate", "applicant", "recruitment"]) and "candidate_compare" in available_tool_names:
            return "", [{"id": "call_cc", "name": "candidate_compare", "arguments": {"openingId": 1, "candidateIds": [1, 2]}}]

        # 12. Employee summary / search
        if "employee" in last_user_msg or "profile" in last_user_msg:
            match = re.search(r"\b(\d+)\b", last_user_msg)
            if match and "employee_summary" in available_tool_names:
                return "", [{"id": "call_esum", "name": "employee_summary", "arguments": {"employeeId": int(match.group(1))}}]
            if "employee_search" in available_tool_names:
                return "", [{"id": "call_es", "name": "employee_search", "arguments": {}}]

        # Default greeting / assistance
        return (
            "I am the PeoplePay360 HR and Payroll Assistant. "
            "I can help you query live employee records, leave balances, attendance exceptions, "
            "payrun batches, and salary calculations using connected MCP tools. "
            "How can I assist you today?",
            [],
        )

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
        if config.provider.lower() == "mock":
            return ["mock-assistant", "llama3.1:8b", "qwen2.5:7b"]
        try:
            base_url = self._normalize_base_url(config.baseUrl)
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{base_url}/models", headers={"Authorization": f"Bearer {config.apiKey or 'ollama'}"})
                if resp.status_code == 200:
                    data = resp.json()
                    return [m.get("id") for m in data.get("data", []) if "id" in m]
        except Exception as err:
            logger.warning("Failed to list models for provider %s: %s", config.provider, err)
        return ["llama3.1:8b", "qwen2.5:7b", "mistral:7b"]


provider_manager = ProviderManager()
