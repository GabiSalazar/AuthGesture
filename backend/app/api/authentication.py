"""
API Endpoints para Authentication System
Integración completa con RealAuthenticationSystem
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging

from app.core.authentication_system import (
    get_real_authentication_system,
    AuthenticationMode,
    AuthenticationStatus,
    SecurityLevel
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ====================================================================
# MODELOS PYDANTIC
# ====================================================================

class VerificationStartRequest(BaseModel):
    """Request para iniciar verificación 1:1"""
    user_id: str = Field(..., description="ID del usuario a verificar")
    security_level: str = Field(default="standard", description="Nivel de seguridad")
    required_sequence: Optional[List[str]] = Field(None, description="Secuencia de gestos")
    ip_address: str = Field(default="localhost", description="IP del cliente")


class IdentificationStartRequest(BaseModel):
    """Request para iniciar identificación 1:N"""
    security_level: str = Field(default="standard", description="Nivel de seguridad")
    ip_address: str = Field(default="localhost", description="IP del cliente")


class AuthenticationStartResponse(BaseModel):
    """Response de inicio de autenticación"""
    session_id: str
    mode: str
    user_id: Optional[str]
    security_level: str
    message: str


class FrameProcessResponse(BaseModel):
    """Response de procesamiento de frame"""
    session_id: str
    status: str
    phase: str
    progress: float
    message: str
    frames_processed: int
    frame_processed: bool
    is_real_processing: bool
    frame: Optional[str] = None  # ✅ NUEVO: Frame como base64
    current_gesture: Optional[str] = None
    gesture_confidence: Optional[float] = None
    required_sequence: Optional[List[str]] = None
    captured_sequence: Optional[List[str]] = None


class AuthenticationStatusResponse(BaseModel):
    """Response de estado de autenticación"""
    session_id: str
    mode: str
    user_id: Optional[str]
    status: str
    phase: str
    duration: float
    progress: float
    is_real_session: bool


# ====================================================================
# ENDPOINTS
# ====================================================================

@router.post("/authentication/verify/start", response_model=AuthenticationStartResponse)
async def start_verification(request: VerificationStartRequest):
    """
    Inicia proceso de verificación 1:1.
    """
    try:
        logger.info(f"API: Iniciando verificación para {request.user_id}")
        
        auth_system = get_real_authentication_system()
        
        # Inicializar si es necesario
        if not auth_system.is_initialized:
            if not auth_system.initialize_real_system():
                raise HTTPException(status_code=500, detail="Error inicializando sistema")
        
        # Convertir security_level
        security_level = SecurityLevel[request.security_level.upper()]
        
        session_id = auth_system.start_real_verification(
            user_id=request.user_id,
            security_level=security_level,
            required_sequence=request.required_sequence,
            ip_address=request.ip_address
        )
        
        return AuthenticationStartResponse(
            session_id=session_id,
            mode="verification",
            user_id=request.user_id,
            security_level=request.security_level,
            message="Verificación iniciada"
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error iniciando verificación: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/authentication/identify/start", response_model=AuthenticationStartResponse)
async def start_identification(request: IdentificationStartRequest):
    """
    Inicia proceso de identificación 1:N.
    """
    try:
        logger.info("API: Iniciando identificación 1:N")
        
        auth_system = get_real_authentication_system()
        
        # Inicializar si es necesario
        if not auth_system.is_initialized:
            if not auth_system.initialize_real_system():
                raise HTTPException(status_code=500, detail="Error inicializando sistema")
        
        security_level = SecurityLevel[request.security_level.upper()]
        
        session_id = auth_system.start_real_identification(
            security_level=security_level,
            ip_address=request.ip_address
        )
        
        return AuthenticationStartResponse(
            session_id=session_id,
            mode="identification",
            user_id=None,
            security_level=request.security_level,
            message="Identificación iniciada"
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error iniciando identificación: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/authentication/{session_id}/frame")
async def process_authentication_frame(session_id: str):
    """
    Procesa un frame para la sesión de autenticación y devuelve el frame visual.
    """
    try:
        import cv2
        import base64
        import numpy as np
        from app.core.camera_manager import get_camera_manager
        from app.core.reference_area_manager import get_reference_area_manager
        from app.core.visual_feedback import get_visual_feedback_manager
        
        auth_system = get_real_authentication_system()
        
        # Procesar frame
        result = auth_system.process_real_authentication_frame(session_id)
        
        if 'error' in result:
            raise HTTPException(status_code=404, detail=result['error'])
        
        # ✅ CAPTURAR Y PROCESAR FRAME VISUAL
        frame_base64 = None
        try:
            camera = get_camera_manager()
            ret, frame = camera.capture_frame()
            
            if ret and frame is not None:
                # ✅ VERIFICAR QUE FRAME ES UN NUMPY ARRAY
                if not isinstance(frame, np.ndarray):
                    logger.error(f"Frame no es numpy array: {type(frame)}")
                    frame = None
                elif len(frame.shape) != 3:
                    logger.error(f"Frame shape inválido: {frame.shape}")
                    frame = None
                    
            if frame is not None:
                # Obtener sesión para información visual
                session = auth_system.session_manager.get_real_session(session_id)
                
                if session and session.required_sequence:
                    current_step = len(session.gesture_sequence_captured)
                    if current_step < len(session.required_sequence):
                        expected_gesture = session.required_sequence[current_step]
                        
                        # Dibujar área de referencia
                        try:
                            area_manager = get_reference_area_manager()
                            frame = area_manager.draw_reference_area(frame, expected_gesture)
                        except Exception as e:
                            logger.error(f"Error dibujando área de referencia: {e}")
                        
                        # Dibujar información de progreso
                        try:
                            # Texto de gesto actual
                            cv2.putText(frame, f"Gesto {current_step + 1}/{len(session.required_sequence)}: {expected_gesture}", 
                                       (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                            
                            # Progreso
                            progress_text = f"Progreso: {result.get('progress', 0):.1f}%"
                            cv2.putText(frame, progress_text, 
                                       (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                            
                            # Mensaje de feedback (en la parte inferior)
                            if result.get('message'):
                                message = result['message'][:60]  # Limitar caracteres
                                text_size = cv2.getTextSize(message, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
                                
                                # Fondo semi-transparente para el texto
                                y_pos = frame.shape[0] - 40
                                cv2.rectangle(frame, (10, y_pos - 5), (text_size[0] + 30, y_pos + 20), 
                                            (0, 0, 0), -1)
                                
                                # Texto del mensaje
                                cv2.putText(frame, message, 
                                           (20, y_pos + 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
                        except Exception as e:
                            logger.error(f"Error dibujando información: {e}")
                
                # ✅ USAR VISUAL FEEDBACK SI ESTÁ DISPONIBLE
                try:
                    visual_manager = get_visual_feedback_manager()
                    if hasattr(auth_system.pipeline, 'last_roi_result') and auth_system.pipeline.last_roi_result:
                        roi_result = auth_system.pipeline.last_roi_result
                        frame = visual_manager.draw_feedback(frame, roi_result)
                except Exception as e:
                    logger.error(f"Error con visual feedback: {e}")
                
                # Convertir a JPEG y base64
                try:
                    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    frame_base64 = base64.b64encode(buffer).decode('utf-8')
                except Exception as e:
                    logger.error(f"Error codificando frame: {e}")
                    frame_base64 = None
                    
        except Exception as e:
            logger.error(f"Error capturando/procesando frame visual: {e}")
            import traceback
            logger.error(traceback.format_exc())
            frame_base64 = None
        
        # Agregar frame al resultado
        result['frame'] = f"data:image/jpeg;base64,{frame_base64}" if frame_base64 else None
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error procesando frame: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/authentication/{session_id}/status", response_model=AuthenticationStatusResponse)
async def get_authentication_status(session_id: str):
    """
    Obtiene el estado de una sesión de autenticación.
    """
    try:
        auth_system = get_real_authentication_system()
        
        status = auth_system.get_real_authentication_status(session_id)
        
        if 'error' in status:
            raise HTTPException(status_code=404, detail=status['error'])
        
        return AuthenticationStatusResponse(**status)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo estado: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/authentication/{session_id}/cancel")
async def cancel_authentication(session_id: str):
    """
    Cancela una sesión de autenticación.
    """
    try:
        auth_system = get_real_authentication_system()
        
        success = auth_system.cancel_real_authentication(session_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
        return {
            "cancelled": True,
            "session_id": session_id,
            "message": "Autenticación cancelada"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelando: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/authentication/users")
async def get_available_users():
    """
    Obtiene usuarios disponibles para autenticación.
    """
    try:
        auth_system = get_real_authentication_system()
        
        users = auth_system.get_real_available_users()
        
        return {
            "users": users,
            "total": len(users)
        }
        
    except Exception as e:
        logger.error(f"Error obteniendo usuarios: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/authentication/stats")
async def get_authentication_stats():
    """
    Obtiene estadísticas del sistema de autenticación.
    """
    try:
        auth_system = get_real_authentication_system()
        
        stats = auth_system.get_real_system_statistics()
        
        return stats
        
    except Exception as e:
        logger.error(f"Error obteniendo estadísticas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/authentication/initialize")
async def initialize_authentication_system():
    """
    Inicializa el sistema de autenticación.
    """
    try:
        auth_system = get_real_authentication_system()
        
        if auth_system.is_initialized:
            return {
                "initialized": True,
                "message": "Sistema ya inicializado"
            }
        
        success = auth_system.initialize_real_system()
        
        if not success:
            raise HTTPException(status_code=500, detail="Error inicializando sistema")
        
        return {
            "initialized": True,
            "message": "Sistema inicializado exitosamente"
        }
        
    except Exception as e:
        logger.error(f"Error inicializando: {e}")
        raise HTTPException(status_code=500, detail=str(e))