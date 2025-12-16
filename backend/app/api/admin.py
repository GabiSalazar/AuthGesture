"""
API endpoints para autenticación de administrador
"""

import os
from jose import jwt
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["Admin"])


# ============================================
# MODELOS DE AUTENTICACIÓN
# ============================================

class AdminLoginRequest(BaseModel):
    """Request de login de administrador"""
    username: str
    password: str


class AdminLoginResponse(BaseModel):
    """Response de login exitoso"""
    success: bool
    token: str
    expires_at: str
    message: str


class TokenVerifyRequest(BaseModel):
    """Request de verificación de token"""
    token: str


class TokenVerifyResponse(BaseModel):
    """Response de verificación de token"""
    valid: bool
    username: str
    expires_at: str


# ============================================
# ENDPOINTS DE AUTENTICACIÓN
# ============================================

@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(credentials: AdminLoginRequest):
    """
    Endpoint de autenticación para administradores.
    Verifica credenciales contra variables de entorno y retorna JWT token.
    """
    try:
        # Obtener credenciales desde variables de entorno
        admin_username = os.getenv("ADMIN_USERNAME", "admin")
        admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
        jwt_secret = os.getenv("ADMIN_JWT_SECRET", "default_secret_change_me")
        jwt_expiration_hours = int(os.getenv("ADMIN_JWT_EXPIRATION_HOURS", "8"))
        
        # Verificar credenciales
        if credentials.username != admin_username or credentials.password != admin_password:
            raise HTTPException(
                status_code=401,
                detail="Credenciales incorrectas"
            )
        
        # Generar token JWT
        expiration = datetime.utcnow() + timedelta(hours=jwt_expiration_hours)
        payload = {
            "username": credentials.username,
            "exp": expiration,
            "iat": datetime.utcnow(),
            "role": "admin"
        }
        
        token = jwt.encode(payload, jwt_secret, algorithm="HS256")
        
        return AdminLoginResponse(
            success=True,
            token=token,
            expires_at=expiration.isoformat(),
            message="Autenticación exitosa"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error en autenticación: {str(e)}"
        )


@router.post("/verify-token", response_model=TokenVerifyResponse)
async def verify_admin_token(request: TokenVerifyRequest):
    """
    Verifica si un token JWT es válido y retorna información del usuario.
    """
    try:
        jwt_secret = os.getenv("ADMIN_JWT_SECRET", "default_secret_change_me")
        
        # Decodificar y verificar token
        payload = jwt.decode(request.token, jwt_secret, algorithms=["HS256"])
        
        return TokenVerifyResponse(
            valid=True,
            username=payload.get("username"),
            expires_at=datetime.fromtimestamp(payload.get("exp")).isoformat()
        )
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error verificando token: {str(e)}")


@router.get("/health")
async def admin_health_check():
    """Verifica que el módulo de admin esté funcionando"""
    return {
        "status": "healthy",
        "module": "Admin Authentication",
        "initialized": True,
        "message": "Módulo de autenticación disponible"
    }