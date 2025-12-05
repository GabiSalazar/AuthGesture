"""
API Endpoints para recuperación de secuencia de gestos
Maneja el flujo completo de "Olvidaste tu secuencia"
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
import logging

from app.services.forgot_sequence_service import get_forgot_sequence_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/forgot-sequence", tags=["Forgot Sequence"])


# ============================================================================
# MODELOS PYDANTIC
# ============================================================================

class SendOTPRequest(BaseModel):
    """Request para enviar código OTP"""
    email: EmailStr

class SendOTPResponse(BaseModel):
    """Response de envío de OTP"""
    success: bool
    message: str
    email: Optional[str] = None

class VerifyOTPRequest(BaseModel):
    """Request para verificar código OTP"""
    email: EmailStr
    otp_code: str

class VerifyOTPResponse(BaseModel):
    """Response de verificación de OTP"""
    success: bool
    message: Optional[str] = None
    user_id: Optional[str] = None
    username: Optional[str] = None
    gesture_sequence: Optional[List[str]] = None
    can_reenroll: bool = False

class InitiateReenrollRequest(BaseModel):
    """Request para iniciar re-registro"""
    user_id: str

class InitiateReenrollResponse(BaseModel):
    """Response de inicio de re-registro"""
    success: bool
    message: str
    original_user_id: Optional[str] = None
    user_data: Optional[Dict[str, Any]] = None
    personality_profile: Optional[Dict[str, Any]] = None
    reuse_personality: bool = False


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/send-otp", response_model=SendOTPResponse)
async def send_otp(request: SendOTPRequest):
    """
    Envía código OTP al email del usuario para recuperar secuencia.
    
    Args:
        request: Email del usuario
    
    Returns:
        SendOTPResponse con resultado del envío
    
    Raises:
        HTTPException 404: Si no se encuentra usuario activo
        HTTPException 500: Si hay error en el proceso
    """
    try:
        logger.info(f"Solicitud de OTP para forgot sequence: {request.email}")
        
        service = get_forgot_sequence_service()
        result = service.send_otp_for_forgot_sequence(request.email)
        
        if not result['success']:
            logger.warning(f"No se pudo enviar OTP: {result['message']}")
            raise HTTPException(status_code=404, detail=result['message'])
        
        logger.info(f"OTP enviado exitosamente a: {request.email}")
        return SendOTPResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error enviando OTP: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error interno enviando código de verificación"
        )


@router.post("/verify-otp", response_model=VerifyOTPResponse)
async def verify_otp(request: VerifyOTPRequest):
    """
    Verifica código OTP y retorna secuencia de gestos del usuario.
    
    Args:
        request: Email y código OTP
    
    Returns:
        VerifyOTPResponse con datos del usuario y secuencia
    
    Raises:
        HTTPException 400: Si el código es inválido o expirado
        HTTPException 500: Si hay error en el proceso
    """
    try:
        logger.info(f"Verificando OTP para: {request.email}")
        
        service = get_forgot_sequence_service()
        result = service.verify_otp_and_get_sequence(request.email, request.otp_code)
        
        if not result['success']:
            logger.warning(f"OTP inválido para {request.email}: {result['message']}")
            raise HTTPException(status_code=400, detail=result['message'])
        
        logger.info(f"OTP verificado exitosamente para: {request.email}")
        return VerifyOTPResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verificando OTP: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error interno verificando código"
        )


@router.post("/resend-otp", response_model=SendOTPResponse)
async def resend_otp(request: SendOTPRequest):
    """
    Reenvía código OTP al email del usuario.
    
    Args:
        request: Email del usuario
    
    Returns:
        SendOTPResponse con resultado
    
    Raises:
        HTTPException 429: Si no ha pasado el cooldown (60 segundos)
        HTTPException 404: Si no se encuentra usuario activo
        HTTPException 500: Si hay error en el proceso
    """
    try:
        logger.info(f"Solicitud de reenvío de OTP para: {request.email}")
        
        service = get_forgot_sequence_service()
        result = service.resend_otp_for_forgot_sequence(request.email)
        
        if not result['success']:
            # Determinar código de error apropiado
            if 'Espera' in result['message']:
                status_code = 429  # Too Many Requests
            elif 'no encontrado' in result['message'].lower():
                status_code = 404
            else:
                status_code = 500
            
            logger.warning(f"No se pudo reenviar OTP: {result['message']}")
            raise HTTPException(status_code=status_code, detail=result['message'])
        
        logger.info(f"OTP reenviado exitosamente a: {request.email}")
        return SendOTPResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reenviando OTP: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error interno reenviando código"
        )


@router.post("/initiate-reenroll", response_model=InitiateReenrollResponse)
async def initiate_reenroll(request: InitiateReenrollRequest):
    """
    Desactiva usuario actual y prepara datos para re-registro.
    
    Este endpoint:
    1. Renombra el user_id del usuario actual (agrega _inactive_timestamp)
    2. Marca el usuario como inactivo (is_active = False)
    3. Actualiza todas las tablas relacionadas (templates, personality, etc)
    4. Libera el user_id original para el nuevo registro
    5. Retorna datos necesarios para el nuevo enrollment
    
    Args:
        request: ID del usuario a desactivar
    
    Returns:
        InitiateReenrollResponse con datos para nuevo enrollment
    
    Raises:
        HTTPException 404: Si no se encuentra el usuario
        HTTPException 500: Si hay error en el proceso
    """
    try:
        logger.info(f"Iniciando reenrollment para: {request.user_id}")
        
        service = get_forgot_sequence_service()
        result = service.initiate_reenrollment(request.user_id)
        
        if not result['success']:
            logger.error(f"Error en reenrollment: {result['message']}")
            raise HTTPException(status_code=500, detail=result['message'])
        
        logger.info(f"Reenrollment preparado exitosamente para: {request.user_id}")
        return InitiateReenrollResponse(**result)
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Error de validación en reenrollment: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error iniciando reenrollment: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error interno preparando re-registro"
        )