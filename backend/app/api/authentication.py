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
    frame: Optional[str] = None
    current_gesture: Optional[str] = None
    gesture_confidence: Optional[float] = None
    required_sequence: Optional[List[str]] = None
    captured_sequence: Optional[List[str]] = None
    # ✅ NUEVOS CAMPOS PARA IDENTIFICACIÓN
    sequence_complete: Optional[bool] = None
    gestures_needed: Optional[int] = None


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
        
        auth_system = get_real_authentication_system()
        
        # ✅ VERIFICAR SI SESIÓN EXISTE ANTES DE PROCESAR
        session = auth_system.session_manager.get_real_session(session_id)
        if not session:
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
            
            if isinstance(capture_result, tuple):
                ret, frame = capture_result
                if not ret or frame is None:
                    logger.warning("Captura de frame falló")
                    frame = None
            else:
                frame = capture_result
            
            if frame is not None:
                if not isinstance(frame, np.ndarray):
                    logger.error(f"Frame no es numpy array: {type(frame)}")
                    frame = None
                elif len(frame.shape) != 3:
                    logger.error(f"Frame shape inválido: {frame.shape}")
                    frame = None
                else:
                    frame = frame.copy()
                    logger.debug(f"✅ Frame válido capturado: {frame.shape}")
    
            # ========================================================================
            # DISEÑO ADAPTATIVO: VERIFICACIÓN vs IDENTIFICACIÓN
            # ========================================================================
            if frame is not None:
                session = auth_system.session_manager.get_real_session(session_id)
                
                if session:
                    try:
                        if not isinstance(frame, np.ndarray):
                            raise ValueError("Frame inválido")
                        
                        h, w = frame.shape[:2]
                        
                        # ========================================
                        # MODO VERIFICACIÓN (1:1)
                        # ========================================
                        if session.mode == AuthenticationMode.VERIFICATION and session.required_sequence:
                            current_step = len(session.gesture_sequence_captured)
                            if current_step < len(session.required_sequence):
                                expected_gesture = session.required_sequence[current_step]
                                
                                # BARRA SUPERIOR: Información compacta
                                bar_height = 70
                                overlay = frame.copy()
                                cv2.rectangle(overlay, (0, 0), (w, bar_height), (0, 0, 0), -1)
                                cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
                                
                                # Línea inferior de la barra (acento azul)
                                cv2.line(frame, (0, bar_height-1), (w, bar_height-1), (66, 135, 245), 2)
                                
                                # IZQUIERDA: Gesto actual
                                gesture_label = f"Gesto {current_step + 1}/{len(session.required_sequence)}:"
                                cv2.putText(frame, gesture_label, 
                                           (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)
                                cv2.putText(frame, expected_gesture, 
                                           (15, 52), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)
                                
                                # CENTRO: Progreso con porcentaje
                                progress = result.get('progress', 0)
                                progress_text = f"{progress:.0f}%"
                                
                                center_x = w // 2
                                center_y = 35
                                radius = 22
                                
                                cv2.circle(frame, (center_x, center_y), radius, (40, 40, 40), -1)
                                
                                angle = int(360 * (progress / 100))
                                if angle > 0:
                                    for i in range(-90, -90 + angle):
                                        x1 = int(center_x + radius * np.cos(np.radians(i)))
                                        y1 = int(center_y + radius * np.sin(np.radians(i)))
                                        cv2.circle(frame, (x1, y1), 3, (66, 135, 245), -1)
                                
                                text_size = cv2.getTextSize(progress_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
                                text_x = center_x - text_size[0] // 2
                                text_y = center_y + text_size[1] // 2
                                cv2.putText(frame, progress_text, 
                                           (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                                
                                # DERECHA: Capturas válidas
                                valid_captures = len(session.gesture_sequence_captured)
                                circle_spacing = 35
                                start_x = w - 130
                                circle_y = 35
                                
                                for i in range(3):
                                    circle_x = start_x + (i * circle_spacing)
                                    
                                    if i < valid_captures:
                                        cv2.circle(frame, (circle_x, circle_y), 10, (66, 245, 158), -1)
                                        cv2.putText(frame, "✓", 
                                                   (circle_x - 6, circle_y + 6), 
                                                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)
                                    else:
                                        cv2.circle(frame, (circle_x, circle_y), 10, (60, 60, 60), -1)
                                        cv2.circle(frame, (circle_x, circle_y), 10, (100, 100, 100), 1)
                        
                        # ========================================
                        # MODO IDENTIFICACIÓN (1:N) - NUEVO
                        # ========================================
                        elif session.mode == AuthenticationMode.IDENTIFICATION:
                            captured_gestures = session.gesture_sequence_captured
                            gestures_needed = 3
                            current_step = len(captured_gestures)
                            
                            # BARRA SUPERIOR: Información de identificación
                            bar_height = 90
                            overlay = frame.copy()
                            cv2.rectangle(overlay, (0, 0), (w, bar_height), (0, 0, 0), -1)
                            cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
                            
                            # Línea inferior de la barra (acento morado para identificación)
                            cv2.line(frame, (0, bar_height-1), (w, bar_height-1), (147, 51, 234), 2)
                            
                            # TÍTULO
                            cv2.putText(frame, "IDENTIFICACION 1:N", 
                                       (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (147, 51, 234), 2)
                            
                            # SUBTÍTULO: Instrucción
                            instruction = "Realiza 3 gestos diferentes"
                            cv2.putText(frame, instruction, 
                                       (15, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1)
                            
                            # PROGRESO: Gestos capturados
                            progress_text = f"{current_step}/3 gestos"
                            cv2.putText(frame, progress_text, 
                                       (15, 72), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                            
                            # DERECHA: Indicadores de gestos capturados
                            circle_spacing = 40
                            start_x = w - 150
                            circle_y = 45
                            
                            for i in range(3):
                                circle_x = start_x + (i * circle_spacing)
                                
                                if i < current_step:
                                    # Gesto capturado (morado)
                                    cv2.circle(frame, (circle_x, circle_y), 12, (147, 51, 234), -1)
                                    cv2.putText(frame, "✓", 
                                               (circle_x - 7, circle_y + 7), 
                                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                                    
                                    # Nombre del gesto capturado (debajo)
                                    if i < len(captured_gestures):
                                        gesture_name = captured_gestures[i][:8]  # Truncar
                                        text_size = cv2.getTextSize(gesture_name, cv2.FONT_HERSHEY_SIMPLEX, 0.3, 1)[0]
                                        text_x = circle_x - text_size[0] // 2
                                        cv2.putText(frame, gesture_name, 
                                                   (text_x, circle_y + 22), 
                                                   cv2.FONT_HERSHEY_SIMPLEX, 0.3, (180, 180, 180), 1)
                                else:
                                    # Pendiente (gris)
                                    cv2.circle(frame, (circle_x, circle_y), 12, (60, 60, 60), -1)
                                    cv2.circle(frame, (circle_x, circle_y), 12, (100, 100, 100), 1)
                        
                        # ========================================
                        # MENSAJE INFERIOR: Solo mensajes importantes
                        # ========================================
                        message = result.get('message', '')
                        
                        if message and any(word in message.lower() for word in 
                                         ['capturada', 'éxito', 'completado', 'error', 'fallido', 'identificado']):
                            
                            display_message = message[:60] + "..." if len(message) > 60 else message
                            text_size = cv2.getTextSize(display_message, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
                            
                            y_pos = h - 25
                            x_pos = (w - text_size[0]) // 2
                            padding = 15
                            
                            overlay = frame.copy()
                            cv2.rectangle(overlay, 
                                        (x_pos - padding, y_pos - 12), 
                                        (x_pos + text_size[0] + padding, y_pos + 10), 
                                        (0, 0, 0), -1)
                            cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
                            
                            # Color según tipo
                            if 'identificado' in message.lower() or 'éxito' in message.lower():
                                color = (66, 245, 158)
                            elif 'error' in message.lower() or 'fallido' in message.lower():
                                color = (245, 66, 66)
                            else:
                                color = (200, 200, 200)
                            
                            cv2.putText(frame, display_message, 
                                       (x_pos, y_pos + 2), 
                                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
                        
                        logger.debug("✅ Overlay dibujado correctamente")
                        
                    except Exception as e:
                        logger.error(f"Error dibujando overlay: {e}")
                        import traceback
                        logger.error(traceback.format_exc())
                
                # ========================================
                # CONVERTIR A BASE64
                # ========================================
                try:
                    if not isinstance(frame, np.ndarray):
                        raise ValueError("Frame inválido para encodear")
                    
                    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
                    frame_base64 = base64.b64encode(buffer).decode('utf-8')
                    logger.debug(f"✅ Frame codificado: {len(frame_base64)} bytes")
                    
                except Exception as e:
                    logger.error(f"Error codificando frame: {e}")
                    frame_base64 = None
            else:
                logger.warning("No se pudo obtener frame válido")
                    
        except Exception as e:
            logger.error(f"Error procesando frame visual: {e}")
            import traceback
            logger.error(traceback.format_exc())
            frame_base64 = None
        
        # ✅ AGREGAR FRAME Y DATOS ADICIONALES AL RESULTADO
        result['frame'] = f"data:image/jpeg;base64,{frame_base64}" if frame_base64 else None
        
        # ✅ INFORMACIÓN ADICIONAL PARA IDENTIFICACIÓN
        if session and session.mode == AuthenticationMode.IDENTIFICATION:
            result['sequence_complete'] = len(session.gesture_sequence_captured) >= 3
            result['gestures_needed'] = 3
            result['captured_sequence'] = session.gesture_sequence_captured
        
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