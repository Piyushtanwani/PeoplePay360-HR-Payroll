import hmac
import logging
import time
from typing import List, Optional
import jwt
from jwt import PyJWKClient
from fastapi import HTTPException, Header, status
from pydantic import BaseModel

from app.settings import settings

logger = logging.getLogger("mcp.security")


class TokenClaims(BaseModel):
    user_id: Optional[int] = None
    sub: Optional[str] = None
    role: Optional[str] = None
    roles: List[str] = []
    permissions: List[str] = []
    employee_no: Optional[str] = None
    employee_id: Optional[int] = None
    raw_token: str = ""

    def has_permission(self, perm: str) -> bool:
        """
        Whether the caller holds a permission.

        The backend expands implications before minting the token, so a caller with
        employee.read.all already carries employee.read.own here. An .own requirement is
        additionally satisfied by the matching .all, which is the same rule the backend applies.
        """
        if perm in self.permissions:
            return True
        if perm.endswith(".own"):
            return perm[: -len(".own")] + ".all" in self.permissions
        return False


class JwksCache:
    def __init__(self, jwks_url: str, cache_ttl: int = 300):
        self.jwks_url = jwks_url
        self.cache_ttl = cache_ttl
        self.last_fetch = 0.0
        self._client: Optional[PyJWKClient] = None

    def get_client(self) -> PyJWKClient:
        now = time.time()
        if self._client is None or (now - self.last_fetch) > self.cache_ttl:
            self._client = PyJWKClient(self.jwks_url, cache_jwk_set=True, lifespan=self.cache_ttl)
            self.last_fetch = now
        return self._client


jwks_cache = JwksCache(settings.jwks_url)


def verify_gateway_secret(x_gateway_secret: Optional[str] = Header(None, alias="X-Gateway-Secret")) -> str:
    """Verifies that the request comes from the backend ChatGateway using the shared secret."""
    if not x_gateway_secret:
        logger.warning("Missing X-Gateway-Secret header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing gateway secret"
        )

    expected = settings.mcp_gateway_secret
    if not hmac.compare_digest(x_gateway_secret.strip(), expected.strip()):
        logger.warning("Invalid X-Gateway-Secret provided")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid gateway secret"
        )
    return x_gateway_secret


def verify_token(authorization: Optional[str] = Header(None, alias="Authorization")) -> TokenClaims:
    """
    Verifies Bearer token against JWKS from backend or decodes claims in development.
    Extracts user_id, roles, and fine-grained permissions.
    """
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("Missing or malformed Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Bearer token"
        )

    token = authorization.split(" ", 1)[1].strip()

    try:
        # First attempt: Verify using JWKS from backend
        client = jwks_cache.get_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.jwt_issuer,
            options={"verify_aud": False}  # Allows aud='mcp' or aud='web'
        )
    except Exception as jwks_err:
        logger.debug("JWKS verification failed or unreachable: %s. Trying unverified fallback in dev.", jwks_err)
        # Development fallback: If JWKS is temporarily unreachable, decode claims without signature check if dev
        if settings.app_env in ("dev", "test"):
            try:
                payload = jwt.decode(token, options={"verify_signature": False})
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid JWT token: {str(e)}"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token verification failed: {str(jwks_err)}"
            )

    # Claim names come from the backend's JwtService. A delegated chat token carries "perms" and
    # "emp"; the browser token carries "roles" and "perms". Reading the wrong names left every
    # caller with an empty permission list, so no tool was ever authorised.
    sub = payload.get("sub")
    user_id = payload.get("userId") or (int(sub) if sub and str(sub).isdigit() else None)
    roles = payload.get("roles") or []
    if isinstance(roles, str):
        roles = [roles]
    role = payload.get("role") or (roles[0] if roles else None)
    permissions = (
        payload.get("perms")
        or payload.get("permissions")
        or payload.get("authorities")
        or []
    )
    employee_no = payload.get("employeeNo")
    employee_id = payload.get("emp") or payload.get("employeeId")

    return TokenClaims(
        user_id=user_id,
        sub=sub,
        role=role,
        roles=roles,
        permissions=permissions,
        employee_no=employee_no,
        employee_id=employee_id,
        raw_token=token
    )
