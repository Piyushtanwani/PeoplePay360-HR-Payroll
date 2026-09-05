import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware

from app.chat import handle_chat_turn
from app.providers import provider_manager
from app.registry import registry
from app.schemas import (
    ChatRequest,
    ChatResponse,
    ProviderConfig,
    ProviderModelsRequest,
    ProviderModelsResponse,
    ProviderTestRequest,
    ProviderTestResponse,
    ToolsListResponse,
)
from app.security import TokenClaims, verify_gateway_secret, verify_token
from app.settings import settings
# Import tools package to ensure all tools are registered on startup
import app.tools  # noqa: F401

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("mcp.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting PeoplePay360 FastMCP Service on %s:%s", settings.mcp_host, settings.mcp_port)
    logger.info("Backend base URL: %s", settings.backend_base_url)
    registered_tools = registry.list_all()
    logger.info("Successfully loaded %d FastMCP tools into registry:", len(registered_tools))
    for t in registered_tools:
        logger.info("  - %s (%s)", t.name, t.requiredPermission)
    yield
    logger.info("Shutting down PeoplePay360 FastMCP Service.")


app = FastAPI(
    title="PeoplePay360 MCP Service",
    description="Model Context Protocol & AI Assistant service for PeoplePay360 HR & Payroll",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["System"])
async def health():
    """Liveness probe invoked by Spring Boot HealthController and orchestrators."""
    return {
        "status": "ok",
        "version": "1.0.0",
        "toolsCount": len(registry.list_all()),
        "env": settings.app_env,
    }


@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat_endpoint(
    request: ChatRequest,
    claims: TokenClaims = Depends(verify_token),
    gateway_secret: str = Depends(verify_gateway_secret),
    x_request_id: Optional[str] = Header(None, alias="X-Request-Id"),
):
    """
    Main conversational endpoint called by Spring Boot ChatGatewayService.
    Executes tool-calling loop using the caller's delegated JWT.
    """
    logger.info(
        "Received /chat request for session=%s user=%s (role=%s) req_id=%s",
        request.sessionId, claims.user_id, claims.role, x_request_id
    )
    return await handle_chat_turn(
        request=request,
        token=claims.raw_token,
        claims=claims,
    )


@app.get("/tools", response_model=ToolsListResponse, tags=["Tools"])
async def list_tools_endpoint(
    claims: TokenClaims = Depends(verify_token),
    gateway_secret: str = Depends(verify_gateway_secret),
):
    """Returns the list of MCP tools authorized for the caller's role/permissions."""
    tools = registry.list_for(claims)
    return ToolsListResponse(tools=tools)


@app.post("/providers/models", response_model=ProviderModelsResponse, tags=["Providers"])
async def provider_models_endpoint(
    request: ProviderModelsRequest,
    gateway_secret: str = Depends(verify_gateway_secret),
):
    """Lists available models from the given AI provider."""
    cfg = ProviderConfig(
        provider=request.provider,
        baseUrl=request.baseUrl,
        apiKey=request.apiKey or "",
    )
    models = await provider_manager.list_models(cfg)
    return ProviderModelsResponse(models=models)


@app.post("/providers/test", response_model=ProviderTestResponse, tags=["Providers"])
async def provider_test_endpoint(
    request: ProviderTestRequest,
    gateway_secret: str = Depends(verify_gateway_secret),
):
    """Tests latency and connectivity to a configured AI provider."""
    cfg = ProviderConfig(
        provider=request.provider,
        baseUrl=request.baseUrl,
        apiKey=request.apiKey or "",
        model=request.model or "llama3.1:8b",
    )
    ok, latency_ms, message = await provider_manager.test_connection(cfg)
    return ProviderTestResponse(ok=ok, latencyMs=latency_ms, message=message)
