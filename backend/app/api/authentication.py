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

    session_token: Optional[str] = Field(None, description="Token de sesión del Plugin")
    callback_url: Optional[str] = Field(None, description="URL para enviar resultado al Plugin")

class IdentificationStartRequest(BaseModel):
    """Request para iniciar identificación 1:N"""
    security_level: str = Field(default="standard", description="Nivel de seguridad")
    ip_address: str = Field(default="localhost", description="IP del cliente")

    session_token: Optional[str] = Field(None, description="Token de sesión del Plugin")
    callback_url: Optional[str] = Field(None, description="URL para enviar resultado al Plugin")

class ProcessFrameRequest(BaseModel):
    """Request para procesar frame desde frontend"""
    frame: str = Field(..., description="Frame en formato base64")
    
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
    #  NUEVOS CAMPOS PARA IDENTIFICACIÓN
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
            ip_address=request.ip_address,
            session_token=request.session_token,
            callback_url=request.callback_url
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


# @router.get("/authentication/{session_id}/frame")
# async def process_authentication_frame(session_id: str):
#     """
#     Procesa un frame para la sesión de autenticación y devuelve el frame visual.
#     """
#     try:
#         import cv2
#         import base64
#         import numpy as np
#         from app.core.camera_manager import get_camera_manager
        
#         auth_system = get_real_authentication_system()
        
#         #  VERIFICAR SI SESIÓN EXISTE ANTES DE PROCESAR
#         session = auth_system.session_manager.get_real_session(session_id)
#         if not session:
#             raise HTTPException(status_code=410, detail="Sesión finalizada o no encontrada")
        
#         # Procesar frame
#         result = auth_system.process_real_authentication_frame(session_id)
        
#         if 'error' in result:
#             raise HTTPException(status_code=404, detail=result['error'])
        
#         #  CAPTURAR Y PROCESAR FRAME VISUAL
#         frame_base64 = None
#         try:
#             camera = get_camera_manager()
#             capture_result = camera.capture_frame()
            
#             if isinstance(capture_result, tuple):
#                 ret, frame = capture_result
#                 if not ret or frame is None:
#                     logger.warning("Captura de frame falló")
#                     frame = None
#             else:
#                 frame = capture_result
            
#             if frame is not None:
#                 if not isinstance(frame, np.ndarray):
#                     logger.error(f"Frame no es numpy array: {type(frame)}")
#                     frame = None
#                 elif len(frame.shape) != 3:
#                     logger.error(f"Frame shape inválido: {frame.shape}")
#                     frame = None
#                 else:
#                     frame = frame.copy()
#                     logger.debug(f" Frame válido capturado: {frame.shape}")
    
#             # ========================================================================
#             # DISEÑO ADAPTATIVO: VERIFICACIÓN vs IDENTIFICACIÓN
#             # ========================================================================
#             if frame is not None:
#                 session = auth_system.session_manager.get_real_session(session_id)
                
#                 if session:
#                     try:
#                         if not isinstance(frame, np.ndarray):
#                             raise ValueError("Frame inválido")
                        
#                         h, w = frame.shape[:2]
                        
#                         # ========================================
#                         # MODO VERIFICACIÓN (1:1) - DISEÑO LIMPIO (SIN BADGE DUPLICADO)
#                         # ========================================
#                         if session.mode == AuthenticationMode.VERIFICATION and session.required_sequence:
#                             current_step = len(session.gesture_sequence_captured)
#                             if current_step < len(session.required_sequence):
#                                 expected_gesture = session.required_sequence[current_step]
#                                 progress = result.get('progress', 0)
                                
#                                 # ===== COLORES DE LA APP (tonos suaves) =====
#                                 COLOR_PRIMARY = (255, 180, 100)  # Azul suave (BGR: 59, 130, 246)
#                                 COLOR_CYAN = (214, 182, 6)       # Cyan suave (BGR: 6, 182, 214)
#                                 COLOR_SLATE = (120, 120, 120)    # Gris suave
#                                 COLOR_WHITE = (255, 255, 255)    # Blanco
#                                 COLOR_BG_DARK = (30, 30, 30)     # Fondo oscuro suave
                                
#                                 # ===== BARRA SUPERIOR MINIMALISTA =====
#                                 bar_height = 65
#                                 overlay = frame.copy()
                                
#                                 # Fondo oscuro translúcido
#                                 cv2.rectangle(overlay, (0, 0), (w, bar_height), COLOR_BG_DARK, -1)
#                                 cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
                                
#                                 # Línea de acento sutil
#                                 cv2.line(frame, (0, bar_height), (w, bar_height), COLOR_PRIMARY, 2)
                                
#                                 # ===== COLUMNA IZQUIERDA: Gesto objetivo =====
#                                 left_x = 20
                                
#                                 # Label pequeño
#                                 cv2.putText(frame, f"Gesto {current_step + 1}/{len(session.required_sequence)}", 
#                                         (left_x, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.4, COLOR_SLATE, 1, cv2.LINE_AA)
                                
#                                 # Nombre del gesto
#                                 cv2.putText(frame, expected_gesture, 
#                                         (left_x, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.7, COLOR_WHITE, 2, cv2.LINE_AA)
                                
#                                 # ===== COLUMNA CENTRO: Progreso con barra =====
#                                 center_x = w // 2
                                
#                                 # Porcentaje
#                                 progress_text = f"{progress:.0f}%"
#                                 text_size = cv2.getTextSize(progress_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
#                                 text_x = center_x - text_size[0] // 2
                                
#                                 cv2.putText(frame, progress_text, 
#                                         (text_x, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, COLOR_WHITE, 2, cv2.LINE_AA)
                                
#                                 # Barra de progreso
#                                 bar_width = 120
#                                 bar_height_px = 6
#                                 bar_x = center_x - bar_width // 2
#                                 bar_y = 45
                                
#                                 # Fondo de la barra
#                                 cv2.rectangle(frame, (bar_x, bar_y), 
#                                             (bar_x + bar_width, bar_y + bar_height_px), 
#                                             (50, 50, 50), -1)
                                
#                                 # Progreso relleno
#                                 filled_width = int((progress / 100) * bar_width)
#                                 if filled_width > 0:
#                                     cv2.rectangle(frame, (bar_x, bar_y), 
#                                                 (bar_x + filled_width, bar_y + bar_height_px), 
#                                                 COLOR_PRIMARY, -1)
                                
#                                 # ===== COLUMNA DERECHA: SOLO INDICADORES CIRCULARES =====
#                                 #  ELIMINADO EL BADGE GRIS - Solo quedan los círculos de progreso
#                                 right_x = w - 110
#                                 circle_y = 35  # Posición vertical de los círculos
#                                 circle_spacing = 18
                                
#                                 import time
#                                 pulse = int(time.time() * 2) % 2
                                
#                                 for i in range(len(session.required_sequence)):
#                                     circle_x = right_x + (i * circle_spacing)
                                    
#                                     if i < current_step:
#                                         # Completado - círculo relleno azul
#                                         cv2.circle(frame, (circle_x, circle_y), 6, COLOR_PRIMARY, -1)
#                                     elif i == current_step:
#                                         # Actual - círculo con borde pulsante
#                                         size = 7 if pulse else 6
#                                         cv2.circle(frame, (circle_x, circle_y), size, COLOR_PRIMARY, 1)
#                                     else:
#                                         # Pendiente - círculo gris pequeño
#                                         cv2.circle(frame, (circle_x, circle_y), 4, COLOR_SLATE, -1)
                        
#                         # ========================================
#                         # MODO IDENTIFICACIÓN (1:N) - DISEÑO MEJORADO
#                         # ========================================
#                         elif session.mode == AuthenticationMode.IDENTIFICATION:
#                             captured_gestures = session.gesture_sequence_captured
#                             gestures_needed = 3
#                             current_step = len(captured_gestures)
                            
#                             # ===== COLORES DE LA APP (tonos suaves) =====
#                             COLOR_PRIMARY = (255, 180, 100)  # Azul suave (BGR: 59, 130, 246)
#                             COLOR_SLATE = (120, 120, 120)    # Gris suave
#                             COLOR_WHITE = (255, 255, 255)    # Blanco
#                             COLOR_BG_DARK = (30, 30, 30)     # Fondo oscuro suave
                            
#                             # ===== BARRA SUPERIOR MINIMALISTA =====
#                             bar_height = 70
#                             overlay = frame.copy()
                            
#                             # Fondo oscuro translúcido
#                             cv2.rectangle(overlay, (0, 0), (w, bar_height), COLOR_BG_DARK, -1)
#                             cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
                            
#                             # Línea de acento sutil (azul)
#                             cv2.line(frame, (0, bar_height-1), (w, bar_height-1), COLOR_PRIMARY, 2)
                            
#                             # ===== IZQUIERDA: Título e instrucción =====
#                             # TÍTULO
#                             cv2.putText(frame, "IDENTIFICACION 1:N", 
#                                     (20, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLOR_PRIMARY, 2, cv2.LINE_AA)
                            
#                             # SUBTÍTULO: Instrucción
#                             instruction = "Realiza 3 gestos diferentes"
#                             cv2.putText(frame, instruction, 
#                                     (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1, cv2.LINE_AA)
                            
#                             # ===== CENTRO: Progreso con texto =====
#                             progress_text = f"{current_step}/3 gestos"
#                             center_x = w // 2
#                             text_size = cv2.getTextSize(progress_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
#                             text_x = center_x - text_size[0] // 2
                            
#                             cv2.putText(frame, progress_text, 
#                                     (text_x, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.5, COLOR_WHITE, 1, cv2.LINE_AA)
                            
#                             # ===== DERECHA: Indicadores circulares de gestos capturados =====
#                             circle_spacing = 35
#                             start_x = w - 140
#                             circle_y = 40
                            
#                             for i in range(3):
#                                 circle_x = start_x + (i * circle_spacing)
                                
#                                 if i < current_step:
#                                     # Gesto capturado (azul con círculo relleno)
#                                     cv2.circle(frame, (circle_x, circle_y), 10, COLOR_PRIMARY, -1)
#                                     cv2.circle(frame, (circle_x, circle_y), 10, (100, 180, 255), 2)
                                    
#                                     # Checkmark simple (líneas)
#                                     cv2.line(frame, (circle_x - 4, circle_y), (circle_x - 2, circle_y + 3), 
#                                             COLOR_WHITE, 2, cv2.LINE_AA)
#                                     cv2.line(frame, (circle_x - 2, circle_y + 3), (circle_x + 4, circle_y - 4), 
#                                             COLOR_WHITE, 2, cv2.LINE_AA)
                                    
#                                     # Nombre del gesto capturado (debajo)
#                                     if i < len(captured_gestures):
#                                         gesture_name = captured_gestures[i][:8]  # Truncar
#                                         text_size = cv2.getTextSize(gesture_name, cv2.FONT_HERSHEY_SIMPLEX, 0.3, 1)[0]
#                                         text_x = circle_x - text_size[0] // 2
#                                         cv2.putText(frame, gesture_name, 
#                                                 (text_x, circle_y + 22), 
#                                                 cv2.FONT_HERSHEY_SIMPLEX, 0.3, (180, 180, 180), 1, cv2.LINE_AA)
#                                 else:
#                                     # Pendiente (gris)
#                                     cv2.circle(frame, (circle_x, circle_y), 10, (60, 60, 60), -1)
#                                     cv2.circle(frame, (circle_x, circle_y), 10, (100, 100, 100), 1)
                            
#                             # ===== MENSAJE INFERIOR: Solo mensajes importantes =====
#                             message = result.get('message', '')
                            
#                             if message and any(word in message.lower() for word in 
#                                             ['capturada', 'éxito', 'completado', 'error', 'fallido', 'identificado']):
                                
#                                 display_message = message[:60] + "..." if len(message) > 60 else message
#                                 text_size = cv2.getTextSize(display_message, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
                                
#                                 y_pos = h - 25
#                                 x_pos = (w - text_size[0]) // 2
#                                 padding = 15
                                
#                                 overlay = frame.copy()
#                                 cv2.rectangle(overlay, 
#                                             (x_pos - padding, y_pos - 12), 
#                                             (x_pos + text_size[0] + padding, y_pos + 10), 
#                                             (0, 0, 0), -1)
#                                 cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
                                
#                                 # Color según tipo
#                                 if 'identificado' in message.lower() or 'éxito' in message.lower():
#                                     color = (66, 245, 158)  # Verde
#                                 elif 'error' in message.lower() or 'fallido' in message.lower():
#                                     color = (245, 66, 66)   # Rojo
#                                 else:
#                                     color = (200, 200, 200) # Gris
                                
#                                 cv2.putText(frame, display_message, 
#                                         (x_pos, y_pos + 2), 
#                                         cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)
                            
#                             logger.debug(" Overlay dibujado correctamente")
    
#                     except Exception as e:
#                         logger.error(f"Error dibujando overlay: {e}")
#                         import traceback
#                         logger.error(traceback.format_exc())
                
#                 # ========================================
#                 # CONVERTIR A BASE64
#                 # ========================================
#                 try:
#                     if not isinstance(frame, np.ndarray):
#                         raise ValueError("Frame inválido para encodear")
                    
#                     _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
#                     frame_base64 = base64.b64encode(buffer).decode('utf-8')
#                     logger.debug(f" Frame codificado: {len(frame_base64)} bytes")
                    
#                 except Exception as e:
#                     logger.error(f"Error codificando frame: {e}")
#                     frame_base64 = None
#             else:
#                 logger.warning("No se pudo obtener frame válido")
                    
#         except Exception as e:
#             logger.error(f"Error procesando frame visual: {e}")
#             import traceback
#             logger.error(traceback.format_exc())
#             frame_base64 = None
        
#         #  AGREGAR FRAME Y DATOS ADICIONALES AL RESULTADO
#         result['frame'] = f"data:image/jpeg;base64,{frame_base64}" if frame_base64 else None
        
#         #  INFORMACIÓN ADICIONAL PARA IDENTIFICACIÓN
#         if session and session.mode == AuthenticationMode.IDENTIFICATION:
#             result['sequence_complete'] = len(session.gesture_sequence_captured) >= 3
#             result['gestures_needed'] = 3
#             result['captured_sequence'] = session.gesture_sequence_captured
        
#         return result
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error procesando frame: {e}")
#         import traceback
#         logger.error(traceback.format_exc())
#         raise HTTPException(status_code=500, detail=str(e))

@router.post("/authentication/{session_id}/process-frame")
async def process_authentication_frame(session_id: str, request: ProcessFrameRequest):
    """
    Procesa un frame recibido del frontend para autenticación.
     NO USA CÁMARA DEL BACKEND - Recibe frame del frontend
    """
    try:
        import cv2
        import base64
        import numpy as np
        import time
        
        auth_system = get_real_authentication_system()
        
        #  VERIFICAR SI SESIÓN EXISTE ANTES DE PROCESAR
        session = auth_system.session_manager.get_real_session(session_id)
        if not session:
            raise HTTPException(status_code=410, detail="Sesión finalizada o no encontrada")
        
        #  DECODIFICAR FRAME DEL FRONTEND (igual que enrollment)
        try:
            # Extraer solo la parte base64 si viene con prefijo data:image
            if request.frame.startswith('data:image'):
                frame_data = request.frame.split(',')[1]
            else:
                frame_data = request.frame
            
            # Decodificar base64 a imagen
            image_data = base64.b64decode(frame_data)
            nparr = np.frombuffer(image_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                raise ValueError("No se pudo decodificar el frame")
            
            logger.debug(f" Frame decodificado del frontend: {frame.shape}")
                
        except Exception as e:
            logger.error(f"Error decodificando frame del frontend: {e}")
            raise HTTPException(status_code=400, detail=f"Frame inválido: {str(e)}")
        
        # #  PROCESAR FRAME (usando el frame recibido del frontend)
        # result = auth_system.process_real_authentication_frame(session_id, frame)
        
        # if 'error' in result:
        #     raise HTTPException(status_code=404, detail=result['error'])
        
        #  PROCESAR FRAME (usando el frame recibido del frontend)
        result = auth_system.process_real_authentication_frame(session_id, frame)
        
        #  MANEJAR ERRORES CON JSON ESTRUCTURADO
        if 'error' in result:
            # Caso 1: Sesión limpiada por timeout
            if result.get('error') == 'Sesión no encontrada o expirada':
                raise HTTPException(
                    status_code=410,
                    detail={
                        'error': 'session_expired',
                        'error_type': 'session_cleaned',
                        'message': 'La sesión fue cerrada por timeout o inactividad',
                        'details': {
                            'reason': 'session_not_found',
                            'suggestion': 'Inicie una nueva sesión de autenticación'
                        }
                    }
                )
            # Caso 2: Timeout detectado en este frame
            elif result.get('error') == 'session_timeout':
                raise HTTPException(
                    status_code=408,
                    detail=result
                )
            # Caso 3: Otros errores
            else:
                raise HTTPException(status_code=404, detail=result['error'])
        
        #  DIBUJAR OVERLAY EN EL FRAME RECIBIDO
        try:
            if not isinstance(frame, np.ndarray):
                raise ValueError("Frame inválido")
            
            h, w = frame.shape[:2]
            
            # ========================================
            # MODO VERIFICACIÓN (1:1) - DISEÑO LIMPIO
            # ========================================
            if session.mode == AuthenticationMode.VERIFICATION and session.required_sequence:
                current_step = len(session.gesture_sequence_captured)
                if current_step < len(session.required_sequence):
                    expected_gesture = session.required_sequence[current_step]
                    progress = result.get('progress', 0)
                    
                    # ===== COLORES DE LA APP (tonos suaves) =====
                    COLOR_PRIMARY = (255, 180, 100)  # Azul suave (BGR: 59, 130, 246)
                    COLOR_CYAN = (214, 182, 6)       # Cyan suave (BGR: 6, 182, 214)
                    COLOR_SLATE = (120, 120, 120)    # Gris suave
                    COLOR_WHITE = (255, 255, 255)    # Blanco
                    COLOR_BG_DARK = (30, 30, 30)     # Fondo oscuro suave
                    
                    # ===== BARRA SUPERIOR MINIMALISTA =====
                    bar_height = 65
                    overlay = frame.copy()
                    
                    # Fondo oscuro translúcido
                    cv2.rectangle(overlay, (0, 0), (w, bar_height), COLOR_BG_DARK, -1)
                    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
                    
                    # Línea de acento sutil
                    cv2.line(frame, (0, bar_height), (w, bar_height), COLOR_PRIMARY, 2)
                    
                    # ===== COLUMNA IZQUIERDA: Gesto objetivo =====
                    left_x = 20
                    
                    # Label pequeño
                    cv2.putText(frame, f"Gesto {current_step + 1}/{len(session.required_sequence)}", 
                            (left_x, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.4, COLOR_SLATE, 1, cv2.LINE_AA)
                    
                    # Nombre del gesto
                    cv2.putText(frame, expected_gesture, 
                            (left_x, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.7, COLOR_WHITE, 2, cv2.LINE_AA)
                    
                    # ===== COLUMNA CENTRO: Progreso con barra =====
                    center_x = w // 2
                    
                    # Porcentaje
                    progress_text = f"{progress:.0f}%"
                    text_size = cv2.getTextSize(progress_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
                    text_x = center_x - text_size[0] // 2
                    
                    cv2.putText(frame, progress_text, 
                            (text_x, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, COLOR_WHITE, 2, cv2.LINE_AA)
                    
                    # Barra de progreso
                    bar_width = 120
                    bar_height_px = 6
                    bar_x = center_x - bar_width // 2
                    bar_y = 45
                    
                    # Fondo de la barra
                    cv2.rectangle(frame, (bar_x, bar_y), 
                                (bar_x + bar_width, bar_y + bar_height_px), 
                                (50, 50, 50), -1)
                    
                    # Progreso relleno
                    filled_width = int((progress / 100) * bar_width)
                    if filled_width > 0:
                        cv2.rectangle(frame, (bar_x, bar_y), 
                                    (bar_x + filled_width, bar_y + bar_height_px), 
                                    COLOR_PRIMARY, -1)
                    
                    # ===== COLUMNA DERECHA: SOLO INDICADORES CIRCULARES =====
                    right_x = w - 110
                    circle_y = 35  # Posición vertical de los círculos
                    circle_spacing = 18
                    
                    pulse = int(time.time() * 2) % 2
                    
                    for i in range(len(session.required_sequence)):
                        circle_x = right_x + (i * circle_spacing)
                        
                        if i < current_step:
                            # Completado - círculo relleno azul
                            cv2.circle(frame, (circle_x, circle_y), 6, COLOR_PRIMARY, -1)
                        elif i == current_step:
                            # Actual - círculo con borde pulsante
                            size = 7 if pulse else 6
                            cv2.circle(frame, (circle_x, circle_y), size, COLOR_PRIMARY, 1)
                        else:
                            # Pendiente - círculo gris pequeño
                            cv2.circle(frame, (circle_x, circle_y), 4, COLOR_SLATE, -1)
            
            # ========================================
            # MODO IDENTIFICACIÓN (1:N) - DISEÑO MEJORADO
            # ========================================
            elif session.mode == AuthenticationMode.IDENTIFICATION:
                captured_gestures = session.gesture_sequence_captured
                gestures_needed = 3
                current_step = len(captured_gestures)
                
                # ===== COLORES DE LA APP (tonos suaves) =====
                COLOR_PRIMARY = (255, 180, 100)  # Azul suave (BGR: 59, 130, 246)
                COLOR_SLATE = (120, 120, 120)    # Gris suave
                COLOR_WHITE = (255, 255, 255)    # Blanco
                COLOR_BG_DARK = (30, 30, 30)     # Fondo oscuro suave
                
                # ===== BARRA SUPERIOR MINIMALISTA =====
                bar_height = 70
                overlay = frame.copy()
                
                # Fondo oscuro translúcido
                cv2.rectangle(overlay, (0, 0), (w, bar_height), COLOR_BG_DARK, -1)
                cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
                
                # Línea de acento sutil (azul)
                cv2.line(frame, (0, bar_height-1), (w, bar_height-1), COLOR_PRIMARY, 2)
                
                # ===== IZQUIERDA: Título e instrucción =====
                # TÍTULO
                cv2.putText(frame, "IDENTIFICACION 1:N", 
                        (20, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLOR_PRIMARY, 2, cv2.LINE_AA)
                
                # SUBTÍTULO: Instrucción
                instruction = "Realiza 3 gestos diferentes"
                cv2.putText(frame, instruction, 
                        (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1, cv2.LINE_AA)
                
                # ===== CENTRO: Progreso con texto =====
                progress_text = f"{current_step}/3 gestos"
                center_x = w // 2
                text_size = cv2.getTextSize(progress_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
                text_x = center_x - text_size[0] // 2
                
                cv2.putText(frame, progress_text, 
                        (text_x, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.5, COLOR_WHITE, 1, cv2.LINE_AA)
                
                # ===== DERECHA: Indicadores circulares de gestos capturados =====
                circle_spacing = 35
                start_x = w - 140
                circle_y = 40
                
                for i in range(3):
                    circle_x = start_x + (i * circle_spacing)
                    
                    if i < current_step:
                        # Gesto capturado (azul con círculo relleno)
                        cv2.circle(frame, (circle_x, circle_y), 10, COLOR_PRIMARY, -1)
                        cv2.circle(frame, (circle_x, circle_y), 10, (100, 180, 255), 2)
                        
                        # Checkmark simple (líneas)
                        cv2.line(frame, (circle_x - 4, circle_y), (circle_x - 2, circle_y + 3), 
                                COLOR_WHITE, 2, cv2.LINE_AA)
                        cv2.line(frame, (circle_x - 2, circle_y + 3), (circle_x + 4, circle_y - 4), 
                                COLOR_WHITE, 2, cv2.LINE_AA)
                        
                        # Nombre del gesto capturado (debajo)
                        if i < len(captured_gestures):
                            gesture_name = captured_gestures[i][:8]  # Truncar
                            text_size = cv2.getTextSize(gesture_name, cv2.FONT_HERSHEY_SIMPLEX, 0.3, 1)[0]
                            text_x = circle_x - text_size[0] // 2
                            cv2.putText(frame, gesture_name, 
                                    (text_x, circle_y + 22), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.3, (180, 180, 180), 1, cv2.LINE_AA)
                    else:
                        # Pendiente (gris)
                        cv2.circle(frame, (circle_x, circle_y), 10, (60, 60, 60), -1)
                        cv2.circle(frame, (circle_x, circle_y), 10, (100, 100, 100), 1)
                
                # ===== MENSAJE INFERIOR: Solo mensajes importantes =====
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
                        color = (66, 245, 158)  # Verde
                    elif 'error' in message.lower() or 'fallido' in message.lower():
                        color = (245, 66, 66)   # Rojo
                    else:
                        color = (200, 200, 200) # Gris
                    
                    cv2.putText(frame, display_message, 
                            (x_pos, y_pos + 2), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)
                
                logger.debug(" Overlay dibujado correctamente")

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
            logger.debug(f" Frame codificado: {len(frame_base64)} bytes")
            
        except Exception as e:
            logger.error(f"Error codificando frame: {e}")
            frame_base64 = None
        
        #  AGREGAR FRAME Y DATOS ADICIONALES AL RESULTADO
        result['frame'] = f"data:image/jpeg;base64,{frame_base64}" if frame_base64 else None
        
        #  INFORMACIÓN ADICIONAL PARA IDENTIFICACIÓN
        if session and session.mode == AuthenticationMode.IDENTIFICATION:
            result['sequence_complete'] = len(session.gesture_sequence_captured) >= 3
            result['gestures_needed'] = 3
            result['captured_sequence'] = session.gesture_sequence_captured
        
        #  INFORMACIÓN DE BLOQUEO (si existe)
        if 'is_locked' not in result:
            result['is_locked'] = False
        if 'lockout_info' not in result:
            result['lockout_info'] = None
            
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