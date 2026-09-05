from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mcp_host: str = "0.0.0.0"
    mcp_port: int = 8000
    backend_base_url: str = "http://localhost:8080"
    jwks_url: str = "http://localhost:8080/.well-known/jwks.json"
    jwt_issuer: str = "peoplepay360"
    jwt_audience: str = "mcp"
    mcp_gateway_secret: str = "change-me-32-chars-minimum-value!"
    http_timeout_seconds: float = 20.0
    llm_timeout_seconds: float = 90.0
    log_level: str = "INFO"
    app_env: str = "dev"
    enable_mock_llm: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
