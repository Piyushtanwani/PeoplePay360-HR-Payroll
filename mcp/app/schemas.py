from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str
    content: str


class UserProfile(BaseModel):
    userId: Optional[int] = None
    employeeNo: Optional[str] = None
    roleCode: Optional[str] = None
    permissions: List[str] = []
    displayNameForUi: Optional[str] = None


class ProviderConfig(BaseModel):
    provider: str = "ollama"  # ollama, openrouter, nvidia, mock
    baseUrl: Optional[str] = "http://localhost:11434"
    apiKey: Optional[str] = ""
    model: str = "llama3.1:8b"
    toolMode: Optional[str] = "native"
    temperature: Optional[float] = 0.2
    maxTokens: Optional[int] = 2048


class LimitsConfig(BaseModel):
    maxToolCalls: int = 8
    timeoutSeconds: int = 90


class ChatRequest(BaseModel):
    sessionId: Optional[int] = None
    messages: List[ChatMessage] = []
    user: Optional[UserProfile] = None
    provider: Optional[ProviderConfig] = None
    limits: Optional[LimitsConfig] = Field(default_factory=LimitsConfig)
    locale: Optional[str] = "en"


class ToolCallRecord(BaseModel):
    toolName: str
    allowed: bool = True
    denialCode: Optional[str] = None
    latencyMs: Optional[int] = None
    resourceType: Optional[str] = None
    resourceId: Optional[str] = None
    rawInput: Optional[Dict[str, Any]] = None
    rawOutput: Optional[Any] = None


class ChatResponse(BaseModel):
    content: str
    blocks: List[Dict[str, Any]] = []
    toolCalls: List[ToolCallRecord] = []


class ToolParameterProperty(BaseModel):
    type: str
    description: Optional[str] = None
    enum: Optional[List[str]] = None


class ToolParameters(BaseModel):
    type: str = "object"
    properties: Dict[str, Any] = {}
    required: List[str] = []


class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters: ToolParameters = Field(default_factory=ToolParameters)
    requiredPermission: str
    resourceType: Optional[str] = None


class ToolsListResponse(BaseModel):
    tools: List[ToolDefinition]


class ProviderTestRequest(BaseModel):
    provider: str
    baseUrl: Optional[str] = None
    apiKey: Optional[str] = None
    model: Optional[str] = None


class ProviderTestResponse(BaseModel):
    ok: bool
    latencyMs: int
    message: Optional[str] = None


class ProviderModelsRequest(BaseModel):
    provider: str
    baseUrl: Optional[str] = None
    apiKey: Optional[str] = None


class ProviderModelsResponse(BaseModel):
    models: List[str]
