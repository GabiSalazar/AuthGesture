"""
API Endpoints para comunicación con Plugin
Endpoints específicos para la integración Plugin ↔ Sistema Biométrico
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
import logging

from app.services.api_key_service import get_api_key_service
from app.core.biometric_database import get_biometric_database

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/biometric", tags=["Biometric Plugin"])


# ============================================
# MODELOS DE DATOS
# ============================================

class CheckUserRequest(BaseModel):
    """Request para verificar si usuario existe"""
    email: EmailStr
    session_token: str
    action: str  # "registro"


class CheckUserResponse(BaseModel):
    """Response de verificación de usuario"""
    exists: bool
    message: str


# ============================================
# VALIDACIÓN DE API KEY
# ============================================

async def validate_api_key(authorization: str = Header(None)):
    """
    Valida que la API Key sea válida.
    Debe venir en formato: Bearer sk_live_...
    """
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="API Key requerida. Header: Authorization: Bearer sk_live_..."
        )
    
    # Extraer el token
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Formato inválido. Debe ser: Bearer sk_live_..."
        )
    
    api_key = parts[1]
    
    # Validar con el servicio
    api_key_service = get_api_key_service()
    is_valid = api_key_service.validate_api_key(api_key)
    
    if not is_valid:
        raise HTTPException(
            status_code=401,
            detail="API Key inválida o inactiva"
        )
    
    return True


# ============================================
# ENDPOINTS
# ============================================

@router.post("/check-user", response_model=CheckUserResponse)
async def check_user_exists(
    request: CheckUserRequest,
    authorization: str = Header(None)
):
    """
    Verifica si un usuario ya está registrado en el sistema biométrico.
    
    Este endpoint es usado por el Plugin para validar si un email
    ya existe antes de iniciar el proceso de registro.
    
    Args:
        request: Email, session_token y action
        authorization: Header con API Key (Bearer sk_live_...)
    
    Returns:
        CheckUserResponse con exists: true/false
    """
    try:
        # Validar API Key
        await validate_api_key(authorization)
        
        logger.info(f"🔍 Verificando usuario con email: {request.email}")
        logger.info(f"   Session Token: {request.session_token}")
        logger.info(f"   Action: {request.action}")
        
        # Obtener base de datos
        database = get_biometric_database()
        
        # Verificar si el email ya existe
        # is_email_unique retorna True si NO existe, False si YA existe
        is_unique = database.is_email_unique(request.email)
        
        # Invertir la lógica para la respuesta
        exists = not is_unique
        
        if exists:
            logger.info(f"✅ Usuario EXISTE con email: {request.email}")
            return CheckUserResponse(
                exists=True,
                message=f"Usuario con email {request.email} ya está registrado"
            )
        else:
            logger.info(f"✅ Usuario NO EXISTE con email: {request.email}")
            return CheckUserResponse(
                exists=False,
                message=f"Email {request.email} disponible para registro"
            )
    
    except HTTPException:
        # Re-lanzar excepciones HTTP (errores de autenticación)
        raise
    
    except Exception as e:
        logger.error(f"❌ Error verificando usuario: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error interno del servidor: {str(e)}"
        )


# ============================================
# NUEVOS MODELOS PARA AUTENTICACIÓN
# ============================================

class AuthenticateStartRequest(BaseModel):
    """Request para iniciar autenticación desde Plugin"""
    email: EmailStr
    session_token: str
    action: str  # "autenticacion"
    callback_url: str  # URL del Plugin para enviar resultado


class AuthenticateStartResponse(BaseModel):
    """Response de inicio de autenticación"""
    success: bool
    message: str
    user_id: Optional[str] = None
    request_id: str  # ID único para trackear esta solicitud


# ============================================
# ALMACENAMIENTO TEMPORAL DE SOLICITUDES
# ============================================

# Diccionario global para almacenar solicitudes de autenticación pendientes
# En producción, esto debería estar en Redis o base de datos
_pending_auth_requests = {}


# ============================================
# ENDPOINT DE AUTENTICACIÓN
# ============================================

@router.post("/authenticate-start", response_model=AuthenticateStartResponse)
async def authenticate_start(
    request: AuthenticateStartRequest,
    authorization: str = Header(None)
):
    """
    Inicia proceso de autenticación solicitado por el Plugin.
    
    El Plugin envía email del usuario y callback_url.
    Cuando el usuario complete la autenticación en el sistema biométrico,
    este sistema enviará el resultado al callback_url proporcionado.
    
    Args:
        request: Email, session_token, action y callback_url
        authorization: Header con API Key (Bearer sk_live_...)
    
    Returns:
        AuthenticateStartResponse con confirmación y request_id
    """
    try:
        # Validar API Key
        await validate_api_key(authorization)
        
        logger.info(f"🔐 Iniciando autenticación para email: {request.email}")
        logger.info(f"   Session Token: {request.session_token}")
        logger.info(f"   Callback URL: {request.callback_url}")
        logger.info(f"   Action: {request.action}")
        
        # Validar que action sea "autenticacion"
        if request.action != "autenticacion":
            raise HTTPException(
                status_code=400,
                detail=f"Action inválida: {request.action}. Debe ser 'autenticacion'"
            )
        
        # Obtener base de datos
        database = get_biometric_database()
        
        # Buscar usuario por email
        user_profile = None
        for uid, profile in database.users.items():
            if hasattr(profile, 'email') and profile.email == request.email:
                user_profile = profile
                break
        
        if not user_profile:
            logger.warning(f"⚠️ Usuario no encontrado con email: {request.email}")
            raise HTTPException(
                status_code=404,
                detail=f"Usuario con email {request.email} no está registrado en el sistema biométrico"
            )
        
        # Generar request_id único
        import uuid
        request_id = f"auth_{uuid.uuid4().hex[:16]}"
        
        # Guardar solicitud pendiente en memoria
        _pending_auth_requests[request_id] = {
            "email": request.email,
            "user_id": user_profile.user_id,
            "session_token": request.session_token,
            "callback_url": request.callback_url,
            "action": request.action,
            "created_at": __import__('time').time(),
            "status": "pending"
        }
        
        logger.info(f"✅ Solicitud de autenticación guardada - Request ID: {request_id}")
        logger.info(f"   Usuario: {user_profile.username} ({user_profile.user_id})")
        
        return AuthenticateStartResponse(
            success=True,
            message=f"Autenticación iniciada. El usuario debe completar el proceso biométrico.",
            user_id=user_profile.user_id,
            request_id=request_id
        )
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"❌ Error iniciando autenticación: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Error interno del servidor: {str(e)}"
        )


# ============================================
# FUNCIÓN AUXILIAR PARA OBTENER SOLICITUD PENDIENTE
# ============================================

def get_pending_auth_request(request_id: str):
    """
    Obtiene una solicitud de autenticación pendiente.
    
    Args:
        request_id: ID de la solicitud
    
    Returns:
        Diccionario con datos de la solicitud o None
    """
    return _pending_auth_requests.get(request_id)


def complete_auth_request(request_id: str):
    """
    Marca una solicitud como completada y la elimina.
    
    Args:
        request_id: ID de la solicitud
    """
    if request_id in _pending_auth_requests:
        del _pending_auth_requests[request_id]
        logger.info(f"✅ Solicitud {request_id} completada y eliminada")
        

@router.get("/health")
async def biometric_plugin_health():
    """Health check del módulo de comunicación con Plugin"""
    return {
        "status": "healthy",
        "module": "Biometric Plugin Communication",
        "initialized": True,
        "message": "✅ Endpoints para Plugin disponibles"
    }