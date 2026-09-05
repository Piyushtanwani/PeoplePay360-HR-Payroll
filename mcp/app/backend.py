import logging
from typing import Any, Dict, Optional
import httpx
from fastapi import HTTPException, status

from app.settings import settings

logger = logging.getLogger("mcp.backend")


class BackendClient:
    """
    Read-only HTTP client to call the Spring Boot Backend API.
    Strictly provides GET requests. Mutations (POST/PUT/DELETE) are prohibited by design.
    """

    def __init__(self, base_url: Optional[str] = None, timeout: Optional[float] = None):
        self.base_url = (base_url or settings.backend_base_url).rstrip("/")
        self.timeout = timeout or settings.http_timeout_seconds

    async def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        token: Optional[str] = None
    ) -> Any:
        """
        Executes a read-only GET request against the Spring Boot backend with delegated Bearer token.
        """
        url = f"{self.base_url}/{path.lstrip('/')}"
        headers = {
            "Accept": "application/json",
            "User-Agent": "PeoplePay360-FastMCP/1.0",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"

        clean_params = {k: v for k, v in (params or {}).items() if v is not None}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(url, headers=headers, params=clean_params)
            except httpx.RequestError as exc:
                logger.error("Backend request error for %s: %s", url, exc)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Backend service unreachable: {str(exc)}"
                )

            if response.status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Unauthorized access to backend resource"
                )
            if response.status_code == 403:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied by backend security policies"
                )
            if response.status_code == 404:
                return None
            if response.status_code >= 400:
                logger.error("Backend error %s for %s: %s", response.status_code, url, response.text)
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Backend returned error {response.status_code}: {response.text}"
                )

            try:
                return response.json()
            except Exception:
                return response.text


backend_client = BackendClient()
