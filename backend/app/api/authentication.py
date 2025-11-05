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
        from app.core.visual_feedback import get_visual_feedback_manager, FeedbackMessage, FeedbackLevel
        
        auth_system = get_real_authentication_system()
        
        # ✅ VERIFICAR SI SESIÓN EXISTE ANTES DE PROCESAR
        session = auth_system.session_manager.get_real_session(session_id)
        if not session:
            # Sesión cerrada o no existe - retornar 410 Gone
            raise HTTPException(status_code=410, detail="Sesión finalizada o no encontrada")
        
        # Procesar frame
        result = auth_system.process_real_authentication_frame(session_id)
        
        if 'error' in result:
            raise HTTPException(status_code=404, detail=result['error'])
        
        # ✅ CAPTURAR Y PROCESAR FRAME VISUAL
        frame_base64 = None
        try:
            camera = get_camera_manager()
            capture_result = camera.capture_frame()
            
            # ✅ SIEMPRE extraer como tupla primero
            if isinstance(capture_result, tuple):
                ret, frame = capture_result
                if not ret or frame is None:
                    logger.warning("Captura de frame falló")
                    frame = None
            else:
                # Si no es tupla, asumir que es el frame directamente
                frame = capture_result
            
            # ✅ VALIDACIÓN: Verificar que es numpy array
            if frame is not None:
                if not isinstance(frame, np.ndarray):
                    logger.error(f"Frame no es numpy array: {type(frame)}")
                    frame = None
                elif len(frame.shape) != 3:
                    logger.error(f"Frame shape inválido: {frame.shape}")
                    frame = None
                else:
                    # ✅ HACER COPIA
                    frame = frame.copy()
                    logger.debug(f"✅ Frame válido capturado: {frame.shape}")
    
            # ========================================================================
            # PROCESAR FRAME VISUAL CON OVERLAYS
            # ========================================================================
            if frame is not None:
                # Obtener sesión para información visual
                session = auth_system.session_manager.get_real_session(session_id)
                
                if session and session.required_sequence:
                    current_step = len(session.gesture_sequence_captured)
                    if current_step < len(session.required_sequence):
                        expected_gesture = session.required_sequence[current_step]
                        
                        # ========================================
                        # PASO 1: Dibujar área de referencia
                        # ========================================
                        try:
                            area_manager = get_reference_area_manager()
                            frame = area_manager.draw_reference_area(frame, expected_gesture)
                            
                            # ✅ CRÍTICO: Verificar que sigue siendo numpy array
                            if not isinstance(frame, np.ndarray):
                                logger.error(f"Frame se convirtió en {type(frame)} después de draw_reference_area")
                                raise ValueError("Frame inválido después de dibujar área")
                            
                            logger.debug("✅ Área de referencia dibujada correctamente")
                            
                        except Exception as e:
                            logger.error(f"Error dibujando área de referencia: {e}")
                            import traceback
                            logger.error(traceback.format_exc())
                        
                        # ========================================
                        # PASO 2: Dibujar información de progreso
                        # ========================================
                        try:
                            # ✅ VERIFICAR antes de usar
                            if not isinstance(frame, np.ndarray):
                                logger.error(f"Frame no es numpy array antes de dibujar info: {type(frame)}")
                                raise ValueError("Frame inválido")
                            
                            h, w = frame.shape[:2]
                            
                            # Panel superior semi-transparente
                            overlay = frame.copy()
                            cv2.rectangle(overlay, (0, 0), (w, 100), (0, 0, 0), -1)
                            cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)
                            
                            # Texto de gesto actual
                            gesture_text = f"Gesto {current_step + 1}/{len(session.required_sequence)}: {expected_gesture}"
                            cv2.putText(frame, gesture_text, 
                                       (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
                            
                            # Progreso
                            progress = result.get('progress', 0)
                            progress_text = f"Progreso: {progress:.1f}%"
                            cv2.putText(frame, progress_text, 
                                       (20, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                            
                            # Capturas válidas
                            valid_captures = result.get('valid_captures', 0)
                            captures_text = f"Capturas: {valid_captures}/5"
                            cv2.putText(frame, captures_text, 
                                       (w - 200, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                            
                            logger.debug("✅ Información de progreso dibujada")
                            
                        except Exception as e:
                            logger.error(f"Error dibujando información: {e}")
                            import traceback
                            logger.error(traceback.format_exc())
                        
                        # ========================================
                        # PASO 3: Mensaje de feedback inferior
                        # ========================================
                        try:
                            # ✅ VERIFICAR antes de usar
                            if not isinstance(frame, np.ndarray):
                                logger.error(f"Frame no es numpy array antes de mensaje: {type(frame)}")
                                raise ValueError("Frame inválido")
                            
                            if result.get('message'):
                                h, w = frame.shape[:2]
                                message = result['message'][:80]
                                text_size = cv2.getTextSize(message, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
                                
                                # Fondo semi-transparente
                                y_pos = h - 50
                                overlay = frame.copy()
                                cv2.rectangle(overlay, (10, y_pos - 10), 
                                            (min(text_size[0] + 40, w - 10), y_pos + 30), 
                                            (0, 0, 0), -1)
                                cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
                                
                                # Color según mensaje
                                if 'capturada' in message.lower() or 'éxito' in message.lower():
                                    color = (0, 255, 0)
                                elif 'calidad' in message.lower() or 'insuficiente' in message.lower():
                                    color = (0, 165, 255)
                                elif 'error' in message.lower():
                                    color = (0, 0, 255)
                                else:
                                    color = (0, 255, 255)
                                
                                cv2.putText(frame, message, 
                                           (20, y_pos + 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                                
                                logger.debug(f"✅ Mensaje dibujado: {message[:30]}...")
                                
                        except Exception as e:
                            logger.error(f"Error dibujando mensaje: {e}")
                            import traceback
                            logger.error(traceback.format_exc())
                
                # ========================================
                # PASO 4: Visual feedback (opcional)
                # ========================================
                try:
                    # ✅ VALIDACIÓN FINAL
                    if not isinstance(frame, np.ndarray):
                        logger.error(f"Frame no es numpy array antes de visual feedback: {type(frame)}")
                        raise ValueError("Frame no es numpy array")
                    
                    visual_manager = get_visual_feedback_manager()
                    
                    if hasattr(auth_system, 'pipeline') and hasattr(auth_system.pipeline, 'last_roi_result'):
                        roi_result = auth_system.pipeline.last_roi_result
                        
                        if roi_result and hasattr(roi_result, 'is_valid') and roi_result.is_valid:
                            messages = []
                            messages.append(FeedbackMessage(
                                "Mano detectada",
                                FeedbackLevel.SUCCESS,
                                priority=1,
                                icon="✓",
                                action="Mantener posición"
                            ))
                            
                            feedback_result = visual_manager.draw_feedback_overlay(frame, messages, None)
                            
                            # ✅ Verificar resultado
                            if isinstance(feedback_result, tuple):
                                logger.warning("draw_feedback_overlay retornó tupla")
                                frame = feedback_result[0] if len(feedback_result) > 0 else frame
                            else:
                                frame = feedback_result
                            
                            logger.debug("✅ Visual feedback dibujado")
                            
                except Exception as e:
                    logger.error(f"Error con visual feedback: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                
                # ========================================
                # PASO 5: Convertir a JPEG y base64
                # ========================================
                try:
                    # ✅ VALIDACIÓN FINAL antes de encodear
                    if not isinstance(frame, np.ndarray):
                        logger.error(f"Frame no es numpy array antes de encodear: {type(frame)}")
                        raise ValueError("Frame inválido para encodear")
                    
                    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    frame_base64 = base64.b64encode(buffer).decode('utf-8')
                    logger.info(f"✅ Frame codificado exitosamente: {len(frame_base64)} bytes")
                    
                except Exception as e:
                    logger.error(f"Error codificando frame: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                    frame_base64 = None
            else:
                logger.warning("No se pudo obtener frame válido para visualización")
                    
        except Exception as e:
            logger.error(f"Error capturando/procesando frame visual: {e}")
            import traceback
            logger.error(traceback.format_exc())
            frame_base64 = None
        
        # Agregar frame al resultado
        result['frame'] = f"data:image/jpeg;base64,{frame_base64}" if frame_base64 else None
        
        if frame_base64:
            logger.info(f"✅ Frame procesado exitosamente para sesión {session_id}")
        else:
            logger.warning(f"⚠️ No se pudo generar frame visual para sesión {session_id}")
        
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