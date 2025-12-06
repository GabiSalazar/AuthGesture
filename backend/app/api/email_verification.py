"""
ENDPOINTS DE VERIFICACIÓN DE EMAIL
API REST para gestionar verificación de emails
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from typing import Optional
import os
from dotenv import load_dotenv

from app.core.email_verification import get_email_verification_system

# Cargar variables de entorno
load_dotenv()

# Router
router = APIRouter()

# ============================================================================
# MODELOS DE REQUEST/RESPONSE
# ============================================================================

class SendVerificationRequest(BaseModel):
    """Request para enviar email de verificación"""
    user_id: str
    username: str
    email: EmailStr


class SendVerificationResponse(BaseModel):
    """Response de envío de email"""
    success: bool
    message: str
    user_id: str
    email: str


class ResendVerificationRequest(BaseModel):
    """Request para reenviar email"""
    user_id: str


class ResendVerificationResponse(BaseModel):
    """Response de reenvío"""
    success: bool
    message: str
    can_resend: bool


class VerificationStatusRequest(BaseModel):
    """Request para verificar estado"""
    user_id: str


class VerificationStatusResponse(BaseModel):
    """Response de estado de verificación"""
    verified: bool
    user_id: str
    message: str


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/send-verification", response_model=SendVerificationResponse)
async def send_verification_email(request: SendVerificationRequest):
    """
    Envía email de verificación al usuario
    
    Args:
        request: Datos del usuario (user_id, username, email)
    
    Returns:
        SendVerificationResponse con resultado
    """
    try:
        email_system = get_email_verification_system()
        
        # Verificar si ya está verificado
        if email_system.is_email_verified(request.user_id):
            return SendVerificationResponse(
                success=True,
                message="Email ya verificado anteriormente",
                user_id=request.user_id,
                email=request.email
            )
        
        # Verificar cooldown de reenvío
        can_resend, cooldown_message = email_system.can_resend_email(request.user_id)
        if not can_resend:
            raise HTTPException(
                status_code=429,
                detail=cooldown_message
            )
        
        # Enviar email
        success = email_system.send_verification_email(
            user_id=request.user_id,
            username=request.username,
            email=request.email
        )
        
        if success:
            return SendVerificationResponse(
                success=True,
                message=f"Email de verificación enviado a {request.email}",
                user_id=request.user_id,
                email=request.email
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Error enviando email de verificación"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error en send_verification_email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verify")
async def verify_email_token(token: str = Query(..., description="Token de verificación")):
    """
    Verifica token de email y redirige al frontend
    
    Este endpoint es llamado cuando el usuario hace click en el email.
    Valida el token y redirige a la PWA con el resultado.
    
    Args:
        token: Token de verificación desde el email
    
    Returns:
        RedirectResponse al frontend con parámetros de resultado
    """
    try:
        email_system = get_email_verification_system()
        
        # Verificar token
        result = email_system.verify_token(token)
        
        # URL del frontend
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        
        if result.success:
            # Redirigir al frontend con éxito
            redirect_url = f"{frontend_url}/enrollment?verified=true&user_id={result.user_id}&email={result.email}"
            print(f"✅ Redirigiendo a: {redirect_url}")
        else:
            # Redirigir con error
            redirect_url = f"{frontend_url}/enrollment?verified=false&error={result.message}"
            print(f"❌ Verificación fallida: {result.message}")
        
        return RedirectResponse(url=redirect_url)
    
    except Exception as e:
        print(f"❌ Error en verify_email_token: {e}")
        # Redirigir con error genérico
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        redirect_url = f"{frontend_url}/enrollment?verified=false&error=Error+verificando+token"
        return RedirectResponse(url=redirect_url)

@router.post("/resend-code")
async def resend_verification_code(request: dict):
    """
    Reenvía código de verificación al usuario
    
    Args:
        request: dict con user_id, username, email
    
    Returns:
        Mensaje de confirmación
    """
    try:
        from datetime import datetime
        
        user_id = request.get('user_id')
        username = request.get('username')
        email = request.get('email')
        
        email_system = get_email_verification_system()
        
        # Verificar si puede reenviar (cooldown de 60 segundos)
        verification = email_system._load_verification(user_id)
        
        if verification:
            # Verificar cooldown
            created_at = datetime.fromisoformat(verification.created_at)
            elapsed = (datetime.now() - created_at).total_seconds()
            
            if elapsed < 60:  # Cooldown de 60 segundos
                remaining = int(60 - elapsed)
                return {
                    "success": False,
                    "message": f"Espera {remaining} segundos antes de reenviar"
                }
        
        # Enviar nuevo código
        success = email_system.send_verification_email(
            user_id=user_id,
            username=username,
            email=email
        )
        
        if not success:
            return {
                "success": False,
                "message": "Error al reenviar el código"
            }
        
        print(f"✅ Código reenviado a: {email}")
        
        return {
            "success": True,
            "message": "Código reenviado exitosamente"
        }
        
    except Exception as e:
        print(f"❌ Error reenviando código: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/resend", response_model=ResendVerificationResponse)
async def resend_verification_email(request: ResendVerificationRequest):
    """
    Reenvía email de verificación
    
    Args:
        request: user_id del usuario
    
    Returns:
        ResendVerificationResponse con resultado
    """
    try:
        email_system = get_email_verification_system()
        
        # Verificar si ya está verificado
        if email_system.is_email_verified(request.user_id):
            return ResendVerificationResponse(
                success=False,
                message="Email ya verificado",
                can_resend=False
            )
        
        # Verificar cooldown
        can_resend, message = email_system.can_resend_email(request.user_id)
        
        if not can_resend:
            return ResendVerificationResponse(
                success=False,
                message=message,
                can_resend=False
            )
        
        # Cargar verificación existente para obtener datos
        verification = email_system._load_verification(request.user_id)
        
        if not verification:
            raise HTTPException(
                status_code=404,
                detail="No se encontró solicitud de verificación para este usuario"
            )
        
        # Reenviar email (genera nuevo token)
        success = email_system.send_verification_email(
            user_id=request.user_id,
            username="Usuario",  # Se podría pasar en el request si se necesita
            email=verification.email
        )
        
        if success:
            return ResendVerificationResponse(
                success=True,
                message="Email reenviado exitosamente",
                can_resend=True
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Error reenviando email"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error en resend_verification_email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/status", response_model=VerificationStatusResponse)
async def check_verification_status(request: VerificationStatusRequest):
    """
    Verifica el estado de verificación de un usuario
    
    Este endpoint se usa para polling desde el frontend,
    permitiendo detectar cuando el usuario verificó su email.
    
    Args:
        request: user_id del usuario
    
    Returns:
        VerificationStatusResponse con estado actual
    """
    try:
        email_system = get_email_verification_system()
        
        verified = email_system.is_email_verified(request.user_id)
        
        if verified:
            message = "Email verificado correctamente"
        else:
            message = "Email pendiente de verificación"
        
        return VerificationStatusResponse(
            verified=verified,
            user_id=request.user_id,
            message=message
        )
    
    except Exception as e:
        print(f"❌ Error en check_verification_status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/verify-code")
async def verify_code(request: dict):
    """
    Verifica código de 6 dígitos ingresado por el usuario
    
    Args:
        request: dict con user_id y code
    
    Returns:
        Resultado de verificación
    """
    try:
        from datetime import datetime
        
        user_id = request.get('user_id')
        code = request.get('code')
        
        email_system = get_email_verification_system()
        
        # Validar formato
        if not code or len(code) != 6 or not code.isdigit():
            return {
                "success": False,
                "message": "Código inválido. Debe ser de 6 dígitos."
            }
        
        # Cargar verificación
        verification = email_system._load_verification(user_id)
        
        if not verification:
            return {
                "success": False,
                "message": "No se encontró verificación pendiente."
            }
        
        # Ya verificado
        if verification.verified:
            return {
                "success": True,
                "message": "Email ya verificado.",
                "user_id": verification.user_id,
                "email": verification.email
            }
        
        # Expirado
        # expires_at = datetime.fromisoformat(verification.expires_at)
        # if datetime.now() > expires_at:
        #     return {
        #         "success": False,
        #         "message": "Código expirado. Solicita uno nuevo."
        #     }
        
        # Expirado
        expires_at = datetime.fromisoformat(verification.expires_at)
        # Remover timezone si existe para comparación
        if expires_at.tzinfo is not None:
            expires_at = expires_at.replace(tzinfo=None)
        if datetime.now() > expires_at:
            return {
                "success": False,
                "message": "Código expirado. Solicita uno nuevo."
            }
        
        # Verificar código
        if verification.token != code:
            return {
                "success": False,
                "message": "Código incorrecto."
            }
        
        # Marcar como verificado
        verification.verified = True
        verification.verification_date = datetime.now().isoformat()
        email_system._save_verification(verification)
        
        print(f"✅ Código verificado: {verification.email}")
        
        return {
            "success": True,
            "message": "Email verificado exitosamente",
            "user_id": verification.user_id,
            "email": verification.email
        }
        
    except Exception as e:
        print(f"❌ Error verificando código: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cleanup-expired")
async def cleanup_expired_verifications():
    ...

@router.delete("/cleanup-expired")
async def cleanup_expired_verifications():
    """
    Limpia tokens de verificación expirados
    
    Endpoint de mantenimiento para eliminar tokens viejos.
    Debería llamarse periódicamente o mediante un cron job.
    
    Returns:
        Mensaje de confirmación
    """
    try:
        email_system = get_email_verification_system()
        email_system.cleanup_expired_verifications()
        
        return {
            "success": True,
            "message": "Tokens expirados limpiados exitosamente"
        }
    
    except Exception as e:
        print(f"❌ Error en cleanup_expired_verifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINT DE SALUD
# ============================================================================

@router.get("/health")
async def email_system_health():
    """
    Verifica salud del sistema de emails
    
    Returns:
        Estado del sistema
    """
    try:
        email_system = get_email_verification_system()
        
        return {
            "status": "healthy",
            "sendgrid_configured": bool(email_system.api_key),
            "from_email": email_system.from_email,
            "expiry_minutes": email_system.expiry_minutes
        }
    
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }