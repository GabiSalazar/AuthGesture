"""
API endpoints para gestión de API Keys
Comunicación segura Plugin ↔ Sistema Biométrico
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional

from app.services.api_key_service import get_api_key_service

router = APIRouter(prefix="/api-keys", tags=["API Keys"])


# ============================================
# MODELOS DE DATOS
# ============================================

class APIKeyResponse(BaseModel):
    """Response con API Key generada"""
    success: bool
    key: str
    created_at: str
    message: str


class APIKeyCurrentResponse(BaseModel):
    """Response con API Key actual"""
    exists: bool
    key: Optional[str] = None
    created_at: Optional[str] = None
    usage_count: Optional[int] = None
    last_used_at: Optional[str] = None


class APIKeyValidateRequest(BaseModel):
    """Request de validación de API Key"""
    api_key: str


class APIKeyValidateResponse(BaseModel):
    """Response de validación"""
    valid: bool
    message: str


class APIKeyStatsResponse(BaseModel):
    """Response con estadísticas de API Key"""
    has_active_key: bool
    key_preview: Optional[str] = None
    created_at: Optional[str] = None
    total_usage: Optional[int] = None
    last_used: Optional[str] = None
    created_by: Optional[str] = None


# ============================================
# ENDPOINTS
# ============================================

@router.get("/current", response_model=APIKeyCurrentResponse)
async def get_current_api_key():
    """
    Obtiene la API Key activa actual.
    """
    try:
        service = get_api_key_service()
        current = service.get_current_api_key()
        
        if current:
            return APIKeyCurrentResponse(
                exists=True,
                key=current['key'],
                created_at=current['created_at'],
                usage_count=current.get('usage_count', 0),
                last_used_at=current.get('last_used_at')
            )
        else:
            return APIKeyCurrentResponse(exists=False)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo API Key: {str(e)}")


@router.post("/generate", response_model=APIKeyResponse)
async def generate_api_key():
    """
    Genera una nueva API Key (primera vez o autogenerar).
    Si ya existe una, genera una nueva e invalida la anterior.
    """
    try:
        service = get_api_key_service()
        result = service.create_new_api_key(created_by="admin")
        
        return APIKeyResponse(
            success=True,
            key=result['key'],
            created_at=result['created_at'],
            message="API Key generada exitosamente"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando API Key: {str(e)}")


@router.post("/regenerate", response_model=APIKeyResponse)
async def regenerate_api_key():
    """
    Regenera la API Key (invalida la anterior y crea una nueva).
    ADVERTENCIA: El Plugin dejará de funcionar hasta actualizar la nueva clave.
    """
    try:
        service = get_api_key_service()
        result = service.regenerate_api_key(created_by="admin")
        
        return APIKeyResponse(
            success=True,
            key=result['key'],
            created_at=result['created_at'],
            message="API Key regenerada exitosamente. ADVERTENCIA: Actualiza la clave en el Plugin."
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error regenerando API Key: {str(e)}")


@router.post("/validate", response_model=APIKeyValidateResponse)
async def validate_api_key(request: APIKeyValidateRequest):
    """
    Valida si una API Key es válida y está activa.
    Este endpoint será usado por el Plugin para autenticarse.
    """
    try:
        service = get_api_key_service()
        is_valid = service.validate_api_key(request.api_key)
        
        if is_valid:
            return APIKeyValidateResponse(
                valid=True,
                message="API Key válida"
            )
        else:
            return APIKeyValidateResponse(
                valid=False,
                message="API Key inválida o inactiva"
            )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error validando API Key: {str(e)}")


@router.get("/stats", response_model=APIKeyStatsResponse)
async def get_api_key_stats():
    """
    Obtiene estadísticas de uso de la API Key actual.
    """
    try:
        service = get_api_key_service()
        stats = service.get_api_key_stats()
        
        return APIKeyStatsResponse(**stats)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo estadísticas: {str(e)}")


@router.get("/health")
async def api_keys_health_check():
    """Verifica que el módulo de API Keys esté funcionando"""
    return {
        "status": "healthy",
        "module": "API Keys Management",
        "initialized": True,
        "message": "Módulo de API Keys disponible"
    }