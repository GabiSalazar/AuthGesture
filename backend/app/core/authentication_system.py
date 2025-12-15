"""
MÓDULO 15: RealAuthenticationSystem
Sistema de Autenticación Biométrica con ROI Normalization
"""

import cv2
import numpy as np
import time
import uuid
import threading
from typing import List, Dict, Tuple, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque
import logging

# ====================================================================
# IMPORTS DEL SISTEMA BIOMÉTRICO
# ====================================================================

from app.core.score_fusion_system import RealIndividualScores # O el archivo correcto donde esté definida
from app.core.config_manager import get_config, get_logger
from app.core.camera_manager import get_camera_manager
from app.core.mediapipe_processor import get_mediapipe_processor, ProcessingResult
from app.core.quality_validator import get_quality_validator, QualityAssessment
from app.core.reference_area_manager import get_reference_area_manager
from app.core.anatomical_features_extractor import get_anatomical_features_extractor, AnatomicalFeatureVector
from app.core.dynamic_features_extractor import get_real_dynamic_features_extractor, DynamicFeatureVector
from app.core.sequence_manager import get_sequence_manager, SequenceState
from app.core.siamese_anatomical_network import get_real_siamese_anatomical_network
from app.core.siamese_dynamic_network import get_real_siamese_dynamic_network
from app.core.feature_preprocessor import get_real_feature_preprocessor
from app.core.score_fusion_system import get_real_score_fusion_system
# from app.core.biometric_database import get_biometric_database, TemplateType, AuthenticationAttempt
from app.core.supabase_biometric_storage import get_biometric_database, TemplateType, AuthenticationAttempt
from app.core.roi_normalization import get_roi_normalization_system
from app.core.visual_feedback import get_visual_feedback_manager
from app.core.dynamic_features_extractor import get_dynamic_features_extractor
from app.core.enrollment_system import get_real_enrollment_system
from app.services.plugin_webhook_service import get_plugin_webhook_service
from app.services.lockout_notification_service import send_lockout_alert_email
from app.config import Settings
from app.services.identification_service import get_identification_service

settings = Settings()
logger = get_logger()


def calculate_score_with_voting(similarities, vote_threshold=0.85, min_vote_ratio=0.5):
    """
    Calcula score usando sistema de votación.
    
    Args:
        similarities: Lista de similitudes calculadas
        vote_threshold: Umbral mínimo para contar como voto positivo (0.85)
        min_vote_ratio: Ratio mínimo de votos para aceptar (0.5 = 50%)
    
    Returns:
        Score calculado (promedio de votos positivos) o 0.0 si no hay consenso
    """
    if not similarities or len(similarities) == 0:
        return 0.0
    
    similarities_array = np.array(similarities)
    
    # Contar votos positivos (referencias con similitud alta)
    high_similarities = similarities_array[similarities_array >= vote_threshold]
    positive_votes = len(high_similarities)
    total_votes = len(similarities_array)
    
    # Calcular ratio de votos
    vote_ratio = positive_votes / total_votes
    
    # Log para debugging
    logger.info(f"  🗳️ Sistema de votación:")
    logger.info(f"     Votos positivos: {positive_votes}/{total_votes} ({vote_ratio:.1%})")
    logger.info(f"     Umbral de votación: {vote_threshold:.2f}")
    logger.info(f"     Ratio requerido: {min_vote_ratio:.1%}")
    
    # Decisión por mayoría
    if vote_ratio >= min_vote_ratio:
        # Hay consenso: promediar solo los votos positivos
        score = np.mean(high_similarities)
        logger.info(f"     Consenso alcanzado - Score: {score:.4f}")
        return float(score)
    else:
        # No hay consenso: rechazo automático
        logger.info(f"     Consenso NO alcanzado - Rechazo automático")
        return 0.0
    
# ====================================================================
# ENUMERACIONES
# ====================================================================

class AuthenticationMode(Enum):
    """Modos de autenticación."""
    VERIFICATION = "verification"       # 1:1 - Verificar identidad claimed
    IDENTIFICATION = "identification"   # 1:N - Identificar entre todos
    CONTINUOUS = "continuous"           # Verificación continua
    ENROLLMENT = "enrollment"           # Modo de registro

class AuthenticationStatus(Enum):
    """Estados de autenticación."""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COLLECTING_FEATURES = "collecting_features"
    PROCESSING_SEQUENCE = "processing_sequence"
    TEMPLATE_MATCHING = "template_matching"
    SCORE_FUSION = "score_fusion"
    DECISION_MAKING = "decision_making"
    AUTHENTICATED = "authenticated"
    REJECTED = "rejected"
    TIMEOUT = "timeout"
    ERROR = "error"
    CANCELLED = "cancelled"

class AuthenticationPhase(Enum):
    """Fases del proceso."""
    INITIALIZATION = "initialization"
    GESTURE_CAPTURE = "gesture_capture"
    FEATURE_EXTRACTION = "feature_extraction"
    QUALITY_VALIDATION = "quality_validation"
    TEMPLATE_MATCHING = "template_matching"
    SCORE_FUSION = "score_fusion"
    DECISION_MAKING = "decision_making"
    COMPLETED = "completed"
    FAILED = "failed"

class SecurityLevel(Enum):
    """Niveles de seguridad."""
    LOW = "low"
    STANDARD = "standard"
    HIGH = "high"
    MAXIMUM = "maximum"

@dataclass
class RealAuthenticationConfig:
    """Configuración para autenticación."""
    # Timeouts
    sequence_timeout: float = 25.0
    total_timeout: float = 45.0
    frame_timeout: float = 3.0
    
    # Umbrales de seguridad por nivel
    security_thresholds: Dict[str, float] = field(default_factory=lambda: {
        'low': 0.65,
        'standard': 0.75, 
        'high': 0.85,
        'maximum': 0.92
    })
    
    # Control de secuencias
    require_sequence_completion: bool = True
    min_gestures_for_auth: int = 2
    max_attempts_per_session: int = 3
    gesture_timeout: float = 8.0
    
    # Identificación 1:N
    max_identification_candidates: int = 5
    identification_threshold_factor: float = 1.1
    
    # Calidad
    min_quality_score: float = 0.7
    min_confidence: float = 0.65
    min_stability_frames: int = 8
    
    # Fusión
    score_fusion_strategy: str = "weighted_average"  # weighted_average, product, max
    anatomical_weight: float = 0.6
    dynamic_weight: float = 0.4
    
    # Seguridad
    enable_audit_logging: bool = True
    enable_continuous_auth: bool = False
    max_failed_attempts: int = 5
    lockout_duration: float = 300.0  # 5 minutos

@dataclass
class RealAuthenticationAttempt:
    """Intento de autenticación completamente."""
    attempt_id: str
    session_id: str
    mode: AuthenticationMode
    user_id: Optional[str]  # Para verificación
    
    # Estado
    status: AuthenticationStatus = AuthenticationStatus.NOT_STARTED
    current_phase: AuthenticationPhase = AuthenticationPhase.INITIALIZATION
    security_level: SecurityLevel = SecurityLevel.STANDARD
    
    # Temporización
    start_time: float = field(default_factory=time.time)
    end_time: Optional[float] = None
    last_frame_time: float = field(default_factory=time.time)
    
    # Datos de entrada
    required_sequence: List[str] = field(default_factory=list)
    gesture_sequence_captured: List[str] = field(default_factory=list)
    frames_processed: int = 0
    valid_captures: int = 0
    
    # Características capturadas
    anatomical_features: List[np.ndarray] = field(default_factory=list)
    dynamic_features: List[np.ndarray] = field(default_factory=list)
    quality_scores: List[float] = field(default_factory=list)
    confidence_scores: List[float] = field(default_factory=list)
    
    # Metadatos 
    ip_address: str = "localhost"
    device_info: Dict[str, Any] = field(default_factory=dict)
    audit_events: List[Dict[str, Any]] = field(default_factory=list)
    
    feedback_token: Optional[str] = None
    session_token: Optional[str] = None
    callback_url: Optional[str] = None

    @property
    def duration(self) -> float:
        end = self.end_time or time.time()
        return end - self.start_time
    
    @property
    def sequence_progress(self) -> float:
        if not self.required_sequence:
            return 100.0
        return (len(self.gesture_sequence_captured) / len(self.required_sequence)) * 100

@dataclass
class RealAuthenticationResult:
    """Resultado de autenticación completamente."""
    attempt_id: str
    success: bool
    user_id: Optional[str]
    matched_user_id: Optional[str] = None  # Para identificación
    
    # Scores
    anatomical_score: float = 0.0
    dynamic_score: float = 0.0
    fused_score: float = 0.0
    confidence: float = 0.0
    
    # Metadatos
    security_level: SecurityLevel = SecurityLevel.STANDARD
    authentication_mode: AuthenticationMode = AuthenticationMode.VERIFICATION
    duration: float = 0.0
    frames_processed: int = 0
    gestures_captured: List[str] = field(default_factory=list)
    
    # Calidad
    average_quality: float = 0.0
    average_confidence: float = 0.0
    
    # Seguridad
    risk_factors: List[str] = field(default_factory=list)
    audit_log_id: Optional[str] = None
    timestamp: float = field(default_factory=time.time)

    is_locked: bool = False
    lockout_info: Optional[Dict[str, Any]] = None
    
# ====================================================================
# AUDITOR DE SEGURIDAD
# ====================================================================

class RealSecurityAuditor:
    """Auditor de seguridad para autenticación."""
    
    def __init__(self, config: RealAuthenticationConfig):
        """Inicializa auditor con logging."""
        self.config = config
        self.logger = get_logger()
        
        # Historial de eventos
        self.security_events: List[Dict[str, Any]] = []
        self.failed_attempts: Dict[str, List[float]] = defaultdict(list)
        self.suspicious_activities: List[Dict[str, Any]] = []
        
        logger.info("RealSecurityAuditor inicializado para auditoría")
    
    def log_authentication_attempt(self, attempt: RealAuthenticationAttempt) -> str:
        """
        Registra intento de autenticación.
        
        Args:
            attempt: Intento de autenticación
            
        Returns:
            ID del log de auditoría
        """
        try:
            audit_id = str(uuid.uuid4())
            
            audit_event = {
                'audit_id': audit_id,
                'timestamp': time.time(),
                'attempt_id': attempt.attempt_id,
                'session_id': attempt.session_id,
                'mode': attempt.mode.value,
                'user_id': attempt.user_id,
                'security_level': attempt.security_level.value,
                'ip_address': attempt.ip_address,
                'device_info': attempt.device_info,
                'duration': attempt.duration,
                'status': attempt.status.value,
                'frames_processed': attempt.frames_processed,
                'gestures_captured': len(attempt.gesture_sequence_captured),
                'is_real_attempt': True
            }
            
            # Analizar riesgos
            risk_factors = self._analyze_real_security_risks(attempt)
            audit_event['risk_factors'] = risk_factors
            audit_event['risk_level'] = len(risk_factors)
            
            self.security_events.append(audit_event)
            
            # Detectar actividad sospechosa
            if len(risk_factors) > 2:
                self._flag_suspicious_activity(attempt, risk_factors)
            
            logger.info(f"Intento de autenticación registrado: {audit_id}")
            return audit_id
            
        except Exception as e:
            logger.error(f"Error registrando intento: {e}")
            return ""
    
    def _analyze_real_security_risks(self, attempt: RealAuthenticationAttempt) -> List[str]:
        """Analiza riesgos de seguridad."""
        risks = []
        
        try:
            # Verificar intentos fallidos recientes
            if attempt.ip_address in self.failed_attempts:
                recent_failures = [
                    t for t in self.failed_attempts[attempt.ip_address]
                    if time.time() - t < 300  # Últimos 5 minutos
                ]
                if len(recent_failures) >= 3:
                    risks.append("múltiples_fallos_recientes")
            
            # Verificar duración anormal
            if attempt.duration > self.config.total_timeout * 0.8:
                risks.append("duración_sospechosa")
            elif attempt.duration < 5.0:
                risks.append("duración_muy_corta")
            
            # Verificar calidad de características
            if attempt.quality_scores:
                avg_quality = np.mean(attempt.quality_scores)
                if avg_quality < self.config.min_quality_score:
                    risks.append("calidad_baja")
            
            # Verificar confianza de detección
            if attempt.confidence_scores:
                avg_confidence = np.mean(attempt.confidence_scores)
                if avg_confidence < self.config.min_confidence:
                    risks.append("confianza_baja")
            
            # Verificar secuencia de gestos
            if (attempt.mode == AuthenticationMode.VERIFICATION and 
                len(attempt.gesture_sequence_captured) != len(attempt.required_sequence)):
                risks.append("secuencia_incompleta")
            
            return risks
            
        except Exception as e:
            logger.error(f"Error analizando riesgos: {e}")
            return ["error_análisis"]
    
    def _flag_suspicious_activity(self, attempt: RealAuthenticationAttempt, risk_factors: List[str]):
        """Marca actividad sospechosa."""
        try:
            suspicious_event = {
                'timestamp': time.time(),
                'attempt_id': attempt.attempt_id,
                'ip_address': attempt.ip_address,
                'risk_factors': risk_factors,
                'risk_level': 'HIGH' if len(risk_factors) > 4 else 'MEDIUM',
                'is_real_threat': True
            }
            
            self.suspicious_activities.append(suspicious_event)
            logger.error(f"Actividad sospechosa detectada: {attempt.attempt_id} - {risk_factors}")
            
        except Exception as e:
            logger.error(f"Error marcando actividad sospechosa: {e}")
    
    def get_security_metrics(self) -> Dict[str, Any]:
        """Obtiene métricas de seguridad."""
        try:
            current_time = time.time()
            
            # Eventos de las últimas 24 horas
            recent_events = [
                e for e in self.security_events
                if current_time - e['timestamp'] < 86400
            ]
            
            return {
                'total_attempts_today': len(recent_events),
                'successful_attempts': len([e for e in recent_events if e['status'] == 'authenticated']),
                'failed_attempts': len([e for e in recent_events if e['status'] in ['rejected', 'timeout', 'error']]),
                'suspicious_activities': len(self.suspicious_activities),
                'unique_ips_today': len(set(e['ip_address'] for e in recent_events)),
                'average_duration': np.mean([e['duration'] for e in recent_events]) if recent_events else 0,
                'high_risk_attempts': len([e for e in recent_events if e.get('risk_level', 0) > 3]),
                'is_real_security': True
            }
            
        except Exception as e:
            logger.error(f"Error obteniendo métricas de seguridad: {e}")
            return {'error': str(e), 'is_real_security': True}

# ====================================================================
# PIPELINE DE AUTENTICACIÓN
# ====================================================================

class RealAuthenticationPipeline:
    """Pipeline principal de procesamiento de autenticación ."""
    
    def __init__(self, config: RealAuthenticationConfig):
        """Inicializa pipeline con componentes."""
        self.config = config
        self.logger = get_logger()
        
        # Componentes base
        self.camera_manager = get_camera_manager()
        self.mediapipe_processor = get_mediapipe_processor()
        self.quality_validator = get_quality_validator()
        self.area_manager = get_reference_area_manager()
        self.sequence_manager = get_sequence_manager()
        
        # Extractores de características (corregidos)
        self.anatomical_extractor = get_anatomical_features_extractor()
        self.dynamic_extractor = get_dynamic_features_extractor()
        
        # Redes siamesas entrenadas (corregidas)
        self.anatomical_network = None
        self.dynamic_network = None
        
        # Sistema de fusión (corregido)
        self.fusion_system = get_real_score_fusion_system()
        
        # Base de datos
        self.database = get_biometric_database()
        
        # Buffer temporal para características dinámicas
        self.temporal_buffer = deque(maxlen=30)
        
        # Estado del pipeline
        self.is_initialized = False
        # NUEVO: Almacenar último resultado de procesamiento
        self.last_processing_result = None
        
        logger.info("RealAuthenticationPipeline inicializado con componentes")
    
    def initialize_real_pipeline(self) -> bool:
        """Inicializa todos los componentes del pipeline."""
        try:
            logger.info("Inicializando pipeline de autenticación...")

            # NUEVO: Obtener referencias ACTUALES a las redes (después del entrenamiento)
            logger.info("Obteniendo referencias actuales a redes entrenadas...")
            self.anatomical_network = get_real_siamese_anatomical_network()
            self.dynamic_network = get_real_siamese_dynamic_network()
            
            # Verificar estado actual de las redes
            logger.info(f"Verificando estado de entrenamiento...")
            logger.info(f"  - Red anatómica entrenada: {self.anatomical_network.is_trained}")
            logger.info(f"  - Red dinámica entrenada: {self.dynamic_network.is_trained}")

        
            # Inicializar componentes base
            if not self.camera_manager.initialize():
                logger.error("Error inicializando cámara")
                return False
            
            if not self.mediapipe_processor.initialize():
                logger.error("Error inicializando MediaPipe")
                return False
            
            # Verificar extractores
            if not self.anatomical_extractor:
                logger.error("Extractor anatómico no disponible")
                return False
            
            if not self.dynamic_extractor:
                logger.error("Extractor dinámico no disponible")
                return False
            
            # Verificar redes siamesas entrenadas
            if not self.anatomical_network.is_trained:
                logger.error("Red anatómica no está entrenada")
                return False
            
            if not self.dynamic_network.is_trained:
                logger.error("Red dinámica no está entrenada")
                return False
            
            # Inicializar sistema de fusión
            if not self.fusion_system.initialize_networks(
                self.anatomical_network, 
                self.dynamic_network, 
                get_real_feature_preprocessor()
            ):
                logger.error("Error inicializando sistema de fusión")
                return False
            
            self.is_initialized = True
            logger.info("Pipeline de autenticación inicializado exitosamente")
            logger.info(f"  - Red anatómica entrenada: {self.anatomical_network.is_trained}")
            logger.info(f"  - Red dinámica entrenada: {self.dynamic_network.is_trained}")
            logger.info(f"  - Sistema de fusión listo: {self.fusion_system.is_initialized}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error inicializando pipeline: {e}")
            return False
    
    # def process_frame_for_real_authentication(self, attempt: RealAuthenticationAttempt) -> Tuple[bool, str]:
    #     """
    #     Procesa un frame para autenticación CON ROI NORMALIZATION.
        
    #     Args:
    #         attempt: Intento de autenticación actual
            
    #     Returns:
    #         Tupla (frame_procesado_exitosamente, mensaje)
    #     """
    #     try:
    #         if not self.is_initialized:
    #             return False, "Pipeline no inicializado"
            
    #         logger.info(f"Procesando frame para sesión {attempt.session_id}")
            
    #         # ========================================================================
    #         # PASO 1: CAPTURAR FRAME ORIGINAL
    #         # ========================================================================
    #         ret, frame_original = get_camera_manager().capture_frame()
    #         if not ret or frame_original is None:
    #             return False, "Error capturando frame de cámara"
            
    #         attempt.frames_processed += 1
    #         attempt.last_frame_time = time.time()
    #         logger.info(f"AUTH: Frame #{attempt.frames_processed} capturado - Shape: {frame_original.shape}")
            
    #         # ========================================================================
    #         # PASO 2: DETECCIÓN INICIAL CON MEDIAPIPE (frame original)
    #         # ========================================================================
    #         logger.info("AUTH: Procesando frame original para detectar mano...")
    #         processing_result_initial = get_mediapipe_processor().process_frame(frame_original)
            
    #         if not processing_result_initial or not processing_result_initial.hand_result or not processing_result_initial.hand_result.is_valid:
    #             logger.info("AUTH: No se detectó mano válida en frame original")
    #             return False, "No se detectó mano válida en frame"
            
    #         logger.info("AUTH: Mano detectada en frame original")
    #         logger.info(f"AUTH: Confianza inicial: {processing_result_initial.hand_result.confidence:.3f}")
            
    #         # # ========================================================================
    #         # # PASO 3: EXTRAER Y VALIDAR ROI
    #         # # ========================================================================
    #         # roi_system = get_roi_normalization_system()
            
    #         # # Obtener gesto actual esperado
    #         # current_gesture = "Unknown"
    #         # expected_gesture = None
            
    #         # if attempt.mode == AuthenticationMode.VERIFICATION and attempt.required_sequence:
    #         #     current_step = len(attempt.gesture_sequence_captured)
    #         #     if current_step < len(attempt.required_sequence):
    #         #         expected_gesture = attempt.required_sequence[current_step]
    #         #         current_gesture = expected_gesture
            
    #         # logger.info("=" * 70)
    #         # logger.info(f"AUTH: EXTRAYENDO ROI - Gesto esperado: {current_gesture}")
    #         # logger.info("=" * 70)
            
    #         # roi_result = roi_system.extract_and_validate_roi(
    #         #     frame_original,
    #         #     processing_result_initial.hand_result.landmarks,
    #         #     current_gesture
    #         # )

    #         # # GUARDAR roi_result para acceso desde _process_frame_with_feedback
    #         # self.last_roi_result = roi_result
    #         # logger.info(f"DEBUG ROI GUARDADO:")
    #         # logger.info(f"   - is_valid: {roi_result.is_valid}")
    #         # logger.info(f"   - tiene roi_bbox: {hasattr(roi_result, 'roi_bbox')}")
    #         # logger.info(f"   - roi_bbox value: {getattr(roi_result, 'roi_bbox', 'NO EXISTE')}")
    #         # logger.info(f"   - roi_width: {roi_result.roi_width if hasattr(roi_result, 'roi_width') else 'NO EXISTE'}")
    #         # logger.info(f"   - roi_height: {roi_result.roi_height if hasattr(roi_result, 'roi_height') else 'NO EXISTE'}")
    #         # # ========================================================================
    #         # # PASO 4: VALIDAR DISTANCIA DEL ROI
    #         # # ========================================================================
    #         # if not roi_result.is_valid:
    #         #     logger.info("=" * 70)
    #         #     logger.info(f"AUTH: ROI NO VÁLIDO")
    #         #     logger.info(f"AUTH: Estado: {roi_result.distance_status.value}")
    #         #     logger.info(f"AUTH: Mensaje: {roi_result.feedback_message}")
    #         #     logger.info(f"AUTH: Tamaño ROI: {roi_result.roi_width}px (rango: 150-600px)")
    #         #     logger.info("=" * 70)
                
    #         #     # NO procesar - solo feedback
    #         #     return False, roi_result.feedback_message
            
    #         # logger.info("=" * 70)
    #         # logger.info("AUTH: ROI VÁLIDO - PROCEDIENDO CON AUTENTICACIÓN ")
    #         # logger.info(f"AUTH: ROI dimensions: {roi_result.roi_width}x{roi_result.roi_height}px")
    #         # logger.info(f"AUTH: Scaling factor: {roi_result.scaling_factor:.3f}x")
    #         # logger.info(f"AUTH: Processing time: {roi_result.processing_time_ms:.2f}ms")
    #         # logger.info("=" * 70)
            
    #         # ========================================================================
    #         # PASO 5: USAR LANDMARKS DEL FRAME ORIGINAL (mejor detección)
    #         # ========================================================================

    #         # DEFINIR VARIABLES DE GESTO (necesarias para validación)
    #         current_gesture = "Unknown"
    #         expected_gesture = None

    #         if attempt.mode == AuthenticationMode.VERIFICATION and attempt.required_sequence:
    #             current_step = len(attempt.gesture_sequence_captured)
    #             if current_step < len(attempt.required_sequence):
    #                 expected_gesture = attempt.required_sequence[current_step]
    #                 current_gesture = expected_gesture

    #         logger.info("AUTH: Usando landmarks del frame ORIGINAL")

    #         # DEFINIR VARIABLES DE PROCESAMIENTO (necesarias para extracción)
    #         processing_result = processing_result_initial
    #         hand_result = processing_result.hand_result
    #         gesture_result = processing_result.gesture_result

    #         # NUEVO: Guardar resultado para acceso externo
    #         self.last_processing_result = processing_result
            
    #         # ========================================================================
    #         # PASO 6: VALIDACIÓN DE CALIDAD (con ROI normalization activo)
    #         # ========================================================================
    #         # Calcular área de referencia
    #         reference_area_coords = get_reference_area_manager().calculate_area_coordinates(
    #             current_gesture, frame_original.shape[:2]
    #         )
    #         reference_area = (reference_area_coords.x1, reference_area_coords.y1,
    #                          reference_area_coords.x2, reference_area_coords.y2)
            
    #         # Validar calidad usando método correcto
    #         quality_assessment = self.quality_validator.validate_complete_quality(
    #             hand_landmarks=hand_result.landmarks,
    #             handedness=hand_result.handedness,
    #             detected_gesture=gesture_result.gesture_name if gesture_result else "None",
    #             gesture_confidence=gesture_result.confidence if gesture_result else 0.0,
    #             target_gesture=expected_gesture or "Unknown",
    #             reference_area=reference_area,
    #             frame_shape=frame_original.shape[:2]
    #         )
            
    #         if not quality_assessment or not quality_assessment.ready_for_capture:
    #             # Mostrar feedback de calidad si está disponible
    #             if self.config.enable_audit_logging:
    #                 self._draw_real_quality_feedback(frame_original, quality_assessment)
                
    #             quality_score = quality_assessment.quality_score if quality_assessment else 0.0
    #             logger.info(f"AUTH: Calidad insuficiente: {quality_score:.3f}")
    #             return False, f"Calidad insuficiente: {quality_score:.3f}" if quality_assessment else "Sin evaluación de calidad"
            
    #         logger.info(f"AUTH: Frame válido - Quality: {quality_assessment.quality_score:.1f}")
            
    #         # ========================================================================
    #         # PASO 7: OBTENER GESTO DETECTADO
    #         # ========================================================================
    #         detected_gesture = None
    #         if processing_result.gesture_result and processing_result.gesture_result.is_valid:
    #             detected_gesture = processing_result.gesture_result.gesture_name
            
    #         # Validar gesto si es necesario
    #         if expected_gesture and detected_gesture != expected_gesture:
    #             logger.info(f"AUTH: Gesto incorrecto - Esperado: {expected_gesture}, Detectado: {detected_gesture}")
    #             return False, f"Gesto esperado: {expected_gesture}, detectado: {detected_gesture}"
            
    #         # ========================================================================
    #         # PASO 8: EXTRAER CARACTERÍSTICAS ANATÓMICAS
    #         # ========================================================================
    #         anatomical_features = self.anatomical_extractor.extract_features(
    #             processing_result.hand_result.landmarks,
    #             processing_result.hand_result.world_landmarks,
    #             hand_result.handedness
    #         )
            
    #         if not anatomical_features:
    #             logger.error("AUTH: Error extrayendo características anatómicas")
    #             return False, "Error extrayendo características anatómicas"
            
    #         logger.info(f"AUTH: Características anatómicas extraídas")
            
    #         # ========================================================================
    #         # PASO 9: AGREGAR AL BUFFER TEMPORAL PARA CARACTERÍSTICAS DINÁMICAS
    #         # ========================================================================
    #         self.temporal_buffer.append({
    #             'landmarks': processing_result.hand_result.landmarks,
    #             'world_landmarks': processing_result.hand_result.world_landmarks,
    #             'timestamp': time.time(),
    #             'gesture': detected_gesture
    #         })
            
    #         logger.info(f"AUTH: Frame agregado a buffer temporal ({len(self.temporal_buffer)} frames)")
            
    #         # ========================================================================
    #         # PASO 10: EXTRAER CARACTERÍSTICAS DINÁMICAS DEL BUFFER
    #         # ========================================================================
    #         dynamic_features = None
    #         if len(self.temporal_buffer) >= 5:  # Mínimo 5 frames para características temporales
    #             dynamic_features = self._extract_real_dynamic_features_from_buffer()
                
    #             if dynamic_features and len(self.temporal_buffer) > 0:
    #                 logger.info(f"AUTH: Características dinámicas extraídas del buffer ({len(self.temporal_buffer)} frames)")
            
    #         if not dynamic_features:
    #             logger.info(f"AUTH: Acumulando frames para características dinámicas... ({len(self.temporal_buffer)}/5)")
    #             return False, "Acumulando frames para características dinámicas..."
            
    #         # ========================================================================
    #         # PASO 11: GENERAR EMBEDDINGS USANDO REDES ENTRENADAS
    #         # ========================================================================
    #         anatomical_embedding = self._generate_real_anatomical_embedding(anatomical_features)
    #         dynamic_embedding = self._generate_real_dynamic_embedding(dynamic_features)
            
    #         if anatomical_embedding is None and dynamic_embedding is None:
    #             logger.error("AUTH: Error generando embeddings biométricos")
    #             return False, "Error generando embeddings biométricos"
            
    #         logger.info(f"AUTH: Embeddings generados - Anatómico: {anatomical_embedding is not None}, Dinámico: {dynamic_embedding is not None}")
            
    #         # ========================================================================
    #         # PASO 12: ALMACENAR CARACTERÍSTICAS CAPTURADAS
    #         # ========================================================================
    #         if anatomical_embedding is not None:
    #             attempt.anatomical_features.append(anatomical_embedding)
    #             logger.info(f"AUTH: Embedding anatómico agregado - Total: {len(attempt.anatomical_features)}")
            
    #         if dynamic_embedding is not None:
    #             attempt.dynamic_features.append(dynamic_embedding)
    #             logger.info(f"AUTH: Embedding dinámico agregado - Total: {len(attempt.dynamic_features)}")
            
    #         attempt.quality_scores.append(quality_assessment.quality_score)
    #         attempt.confidence_scores.append(processing_result.gesture_result.confidence if processing_result.gesture_result else 0.0)
            
    #         # Incrementar contador de capturas válidas
    #         attempt.valid_captures += 1
    #         logger.info(f"AUTH: Captura válida #{attempt.valid_captures} - Embeddings almacenados exitosamente")

    #         # ========================================================================
    #         # PASO 13: REGISTRAR GESTO CAPTURADO (CON LÓGICA DE IDENTIFICACIÓN)
    #         # ========================================================================
    #         if detected_gesture:
    #             # VERIFICACIÓN 1:1 - Agregar todos los gestos de la secuencia requerida
    #             if attempt.mode == AuthenticationMode.VERIFICATION:
    #                 attempt.gesture_sequence_captured.append(detected_gesture)
    #                 logger.info(f"AUTH: Gesto '{detected_gesture}' capturado (Verificación)")
    #                 logger.info(f"AUTH:    Progreso: {len(attempt.gesture_sequence_captured)}/{len(attempt.required_sequence) if attempt.required_sequence else '?'}")
                
    #             # IDENTIFICACIÓN 1:N - Solo agregar gestos NUEVOS (diferentes)
    #             elif attempt.mode == AuthenticationMode.IDENTIFICATION:
    #                 # Verificar si ya capturamos 3 gestos
    #                 if len(attempt.gesture_sequence_captured) < 3:
    #                     # Verificar si este gesto ya está en la secuencia
    #                     if detected_gesture not in attempt.gesture_sequence_captured:
    #                         # GESTO NUEVO - Agregarlo
    #                         attempt.gesture_sequence_captured.append(detected_gesture)
    #                         logger.info(f"AUTH: Gesto NUEVO capturado: '{detected_gesture}'")
    #                         logger.info(f"AUTH:    Secuencia actual: {attempt.gesture_sequence_captured}")
    #                         logger.info(f"AUTH:    Progreso: {len(attempt.gesture_sequence_captured)}/3 gestos únicos")
    #                     else:
    #                         # GESTO REPETIDO - Ignorar (no agregar embeddings ni contar)
    #                         logger.info(f"AUTH: Gesto '{detected_gesture}' ya capturado - esperando gesto diferente")
    #                         logger.info(f"AUTH:    Secuencia actual: {attempt.gesture_sequence_captured}")
    #                         logger.info(f"AUTH:    Necesitas hacer un gesto diferente")
                            
    #                         # IMPORTANTE: Eliminar los embeddings que acabamos de agregar
    #                         if len(attempt.anatomical_features) > 0:
    #                             attempt.anatomical_features.pop()
    #                             logger.info(f"AUTH:    Embedding anatómico removido")
    #                         if len(attempt.dynamic_features) > 0:
    #                             attempt.dynamic_features.pop()
    #                             logger.info(f"AUTH:    Embedding dinámico removido")
                            
    #                         # Decrementar contador de capturas válidas
    #                         attempt.valid_captures -= 1
                            
    #                         # Retornar sin procesar más
    #                         return False, f"Gesto '{detected_gesture}' repetido - haz un gesto diferente"
    #                 else:
    #                     logger.info(f"AUTH: Ya se capturaron 3 gestos únicos - ignorando capturas adicionales")
    #         # ========================================================================
    #         # PASO 14: LOG DE PROGRESO
    #         # ========================================================================
    #         logger.info(f"AUTH: Frame procesado exitosamente para sesión {attempt.session_id}")
    #         logger.info(f"AUTH:   - Gesto detectado: {detected_gesture}")
    #         logger.info(f"AUTH:   - Calidad: {quality_assessment.quality_score:.3f}")
    #         logger.info(f"AUTH:   - Embeddings: anatómico={anatomical_embedding is not None}, dinámico={dynamic_embedding is not None}")
    #         logger.info(f"AUTH:   - Progreso secuencia: {len(attempt.gesture_sequence_captured)}/{len(attempt.required_sequence) if attempt.required_sequence else 'N/A'}")
    #         #logger.info(f"AUTH:   - ROI usado: {roi_result.roi_width}x{roi_result.roi_height}px")
            
    #         # ========================================================================
    #         # PASO 15: VERIFICAR SI COMPLETAMOS LA SECUENCIA REQUERIDA
    #         # ========================================================================

    #         # VERIFICACIÓN 1:1
    #         if (attempt.mode == AuthenticationMode.VERIFICATION and 
    #             attempt.required_sequence and 
    #             len(attempt.gesture_sequence_captured) >= len(attempt.required_sequence)):
                
    #             attempt.current_phase = AuthenticationPhase.TEMPLATE_MATCHING
    #             logger.info("AUTH: 🎉 Secuencia de verificación completada - procediendo a matching biométrico")
    #             return True, "Secuencia completada - procediendo a matching biométrico"

    #         # IDENTIFICACIÓN 1:N
    #         elif (attempt.mode == AuthenticationMode.IDENTIFICATION and 
    #             len(attempt.gesture_sequence_captured) >= 3):
                
    #             attempt.current_phase = AuthenticationPhase.TEMPLATE_MATCHING
    #             logger.info("AUTH: 🎉 Secuencia de identificación completada (3 gestos únicos)")
    #             logger.info(f"AUTH:    Secuencia capturada: {attempt.gesture_sequence_captured}")
    #             logger.info("AUTH:    Procediendo a filtrado por secuencia + verificación biométrica")
    #             return True, "Secuencia de 3 gestos completada - procediendo a identificación"

    #         # ========================================================================
    #         # RETORNO EXITOSO
    #         # ========================================================================
    #         return True, f"Características capturadas - {len(attempt.anatomical_features)} muestras"
            
    #     except Exception as e:
    #         logger.error(f"Error procesando frame para autenticación: {e}")
    #         import traceback
    #         logger.error(f"Traceback: {traceback.format_exc()}")
    #         return False, f"Error de procesamiento: {str(e)}"
    
    def process_frame_for_real_authentication(self, attempt: RealAuthenticationAttempt, frame_image: np.ndarray) -> Tuple[bool, str]:
        """
        Procesa un frame recibido del FRONTEND para autenticación.
        
        Args:
            attempt: Intento de autenticación actual
            frame_image: Frame capturado desde el frontend (numpy array BGR)
            
        Returns:
            Tupla (frame_procesado_exitosamente, mensaje)
        """
        try:
            if not self.is_initialized:
                return False, "Pipeline no inicializado"
            
            logger.info(f"Procesando frame para sesión {attempt.session_id}")
            
            # ========================================================================
            # PASO 1: USAR FRAME RECIBIDO DEL FRONTEND (NO CAPTURAR)
            # ========================================================================
            frame_original = frame_image
            
            attempt.frames_processed += 1
            attempt.last_frame_time = time.time()
            logger.info(f"AUTH: Frame #{attempt.frames_processed} recibido del frontend - Shape: {frame_original.shape}")
            
            # ========================================================================
            # PASO 2: DETECCIÓN INICIAL CON MEDIAPIPE (frame original)
            # ========================================================================
            logger.info("AUTH: Procesando frame original para detectar mano...")
            processing_result_initial = get_mediapipe_processor().process_frame(frame_original)
            
            if not processing_result_initial or not processing_result_initial.hand_result or not processing_result_initial.hand_result.is_valid:
                logger.info("AUTH: No se detectó mano válida en frame original")
                return False, "No se detectó mano válida en frame"
            
            logger.info("AUTH: Mano detectada en frame original")
            logger.info(f"AUTH: Confianza inicial: {processing_result_initial.hand_result.confidence:.3f}")
            
            # DEFINIR VARIABLES DE GESTO (necesarias para validación)
            current_gesture = "Unknown"
            expected_gesture = None

            if attempt.mode == AuthenticationMode.VERIFICATION and attempt.required_sequence:
                current_step = len(attempt.gesture_sequence_captured)
                if current_step < len(attempt.required_sequence):
                    expected_gesture = attempt.required_sequence[current_step]
                    current_gesture = expected_gesture

            logger.info("AUTH: Usando landmarks del frame ORIGINAL")

            # DEFINIR VARIABLES DE PROCESAMIENTO (necesarias para extracción)
            processing_result = processing_result_initial
            hand_result = processing_result.hand_result
            gesture_result = processing_result.gesture_result

            # NUEVO: Guardar resultado para acceso externo
            self.last_processing_result = processing_result
            
            # ========================================================================
            # PASO 3: VALIDACIÓN DE CALIDAD
            # ========================================================================
            # Calcular área de referencia
            reference_area_coords = get_reference_area_manager().calculate_area_coordinates(
                current_gesture, frame_original.shape[:2]
            )
            reference_area = (reference_area_coords.x1, reference_area_coords.y1,
                            reference_area_coords.x2, reference_area_coords.y2)
            
            # Validar calidad usando método correcto
            quality_assessment = self.quality_validator.validate_complete_quality(
                hand_landmarks=hand_result.landmarks,
                handedness=hand_result.handedness,
                detected_gesture=gesture_result.gesture_name if gesture_result else "None",
                gesture_confidence=gesture_result.confidence if gesture_result else 0.0,
                target_gesture=expected_gesture or "Unknown",
                reference_area=reference_area,
                frame_shape=frame_original.shape[:2]
            )
            
            if not quality_assessment or not quality_assessment.ready_for_capture:
                # Mostrar feedback de calidad si está disponible
                if self.config.enable_audit_logging:
                    self._draw_real_quality_feedback(frame_original, quality_assessment)
                
                quality_score = quality_assessment.quality_score if quality_assessment else 0.0
                logger.info(f"AUTH: Calidad insuficiente: {quality_score:.3f}")
                return False, f"Calidad insuficiente: {quality_score:.3f}" if quality_assessment else "Sin evaluación de calidad"
            
            logger.info(f"AUTH: Frame válido - Quality: {quality_assessment.quality_score:.1f}")
            
            # ========================================================================
            # PASO 4: OBTENER GESTO DETECTADO
            # ========================================================================
            detected_gesture = None
            if processing_result.gesture_result and processing_result.gesture_result.is_valid:
                detected_gesture = processing_result.gesture_result.gesture_name
            
            # Validar gesto si es necesario
            if expected_gesture and detected_gesture != expected_gesture:
                logger.info(f"AUTH: Gesto incorrecto - Esperado: {expected_gesture}, Detectado: {detected_gesture}")
                return False, f"Gesto esperado: {expected_gesture}, detectado: {detected_gesture}"
            
            # ========================================================================
            # PASO 5: EXTRAER CARACTERÍSTICAS ANATÓMICAS
            # ========================================================================
            anatomical_features = self.anatomical_extractor.extract_features(
                processing_result.hand_result.landmarks,
                processing_result.hand_result.world_landmarks,
                hand_result.handedness
            )
            
            if not anatomical_features:
                logger.error("AUTH: Error extrayendo características anatómicas")
                return False, "Error extrayendo características anatómicas"
            
            logger.info(f"AUTH: Características anatómicas extraídas")
            
            # ========================================================================
            # PASO 6: AGREGAR AL BUFFER TEMPORAL PARA CARACTERÍSTICAS DINÁMICAS
            # ========================================================================
            self.temporal_buffer.append({
                'landmarks': processing_result.hand_result.landmarks,
                'world_landmarks': processing_result.hand_result.world_landmarks,
                'timestamp': time.time(),
                'gesture': detected_gesture
            })
            
            logger.info(f"AUTH: Frame agregado a buffer temporal ({len(self.temporal_buffer)} frames)")
            
            # ========================================================================
            # PASO 7: EXTRAER CARACTERÍSTICAS DINÁMICAS DEL BUFFER
            # ========================================================================
            dynamic_features = None
            if len(self.temporal_buffer) >= 5:  # Mínimo 5 frames para características temporales
                dynamic_features = self._extract_real_dynamic_features_from_buffer()
                
                if dynamic_features and len(self.temporal_buffer) > 0:
                    logger.info(f"AUTH: Características dinámicas extraídas del buffer ({len(self.temporal_buffer)} frames)")
            
            if not dynamic_features:
                logger.info(f"AUTH: Acumulando frames para características dinámicas... ({len(self.temporal_buffer)}/5)")
                return False, "Acumulando frames para características dinámicas..."
            
            # ========================================================================
            # PASO 8: GENERAR EMBEDDINGS USANDO REDES ENTRENADAS
            # ========================================================================
            anatomical_embedding = self._generate_real_anatomical_embedding(anatomical_features)
            dynamic_embedding = self._generate_real_dynamic_embedding(dynamic_features)
            
            if anatomical_embedding is None and dynamic_embedding is None:
                logger.error("AUTH: Error generando embeddings biométricos")
                return False, "Error generando embeddings biométricos"
            
            logger.info(f"AUTH: Embeddings generados - Anatómico: {anatomical_embedding is not None}, Dinámico: {dynamic_embedding is not None}")
            
            # ========================================================================
            # PASO 9: ALMACENAR CARACTERÍSTICAS CAPTURADAS
            # ========================================================================
            if anatomical_embedding is not None:
                attempt.anatomical_features.append(anatomical_embedding)
                logger.info(f"AUTH: Embedding anatómico agregado - Total: {len(attempt.anatomical_features)}")
            
            if dynamic_embedding is not None:
                attempt.dynamic_features.append(dynamic_embedding)
                logger.info(f"AUTH: Embedding dinámico agregado - Total: {len(attempt.dynamic_features)}")
            
            attempt.quality_scores.append(quality_assessment.quality_score)
            attempt.confidence_scores.append(processing_result.gesture_result.confidence if processing_result.gesture_result else 0.0)
            
            # Incrementar contador de capturas válidas
            attempt.valid_captures += 1
            logger.info(f"AUTH: Captura válida #{attempt.valid_captures} - Embeddings almacenados exitosamente")

            # ========================================================================
            # PASO 10: REGISTRAR GESTO CAPTURADO (CON LÓGICA DE IDENTIFICACIÓN)
            # ========================================================================
            if detected_gesture:
                # VERIFICACIÓN 1:1 - Agregar todos los gestos de la secuencia requerida
                if attempt.mode == AuthenticationMode.VERIFICATION:
                    attempt.gesture_sequence_captured.append(detected_gesture)
                    logger.info(f"AUTH: Gesto '{detected_gesture}' capturado (Verificación)")
                    logger.info(f"AUTH:    Progreso: {len(attempt.gesture_sequence_captured)}/{len(attempt.required_sequence) if attempt.required_sequence else '?'}")
                
                # IDENTIFICACIÓN 1:N - Solo agregar gestos NUEVOS (diferentes)
                elif attempt.mode == AuthenticationMode.IDENTIFICATION:
                    # Verificar si ya capturamos 3 gestos
                    if len(attempt.gesture_sequence_captured) < 3:
                        # Verificar si este gesto ya está en la secuencia
                        if detected_gesture not in attempt.gesture_sequence_captured:
                            # GESTO NUEVO - Agregarlo
                            attempt.gesture_sequence_captured.append(detected_gesture)
                            logger.info(f"AUTH: Gesto NUEVO capturado: '{detected_gesture}'")
                            logger.info(f"AUTH:    Secuencia actual: {attempt.gesture_sequence_captured}")
                            logger.info(f"AUTH:    Progreso: {len(attempt.gesture_sequence_captured)}/3 gestos únicos")
                        else:
                            # GESTO REPETIDO - Ignorar (no agregar embeddings ni contar)
                            logger.info(f"AUTH: Gesto '{detected_gesture}' ya capturado - esperando gesto diferente")
                            logger.info(f"AUTH:    Secuencia actual: {attempt.gesture_sequence_captured}")
                            logger.info(f"AUTH:    Necesitas hacer un gesto diferente")
                            
                            # IMPORTANTE: Eliminar los embeddings que acabamos de agregar
                            if len(attempt.anatomical_features) > 0:
                                attempt.anatomical_features.pop()
                                logger.info(f"AUTH:    Embedding anatómico removido")
                            if len(attempt.dynamic_features) > 0:
                                attempt.dynamic_features.pop()
                                logger.info(f"AUTH:    Embedding dinámico removido")
                            
                            # Decrementar contador de capturas válidas
                            attempt.valid_captures -= 1
                            
                            # Retornar sin procesar más
                            return False, f"Gesto '{detected_gesture}' repetido - haz un gesto diferente"
                    else:
                        logger.info(f"AUTH: Ya se capturaron 3 gestos únicos - ignorando capturas adicionales")
            
            # ========================================================================
            # PASO 11: LOG DE PROGRESO
            # ========================================================================
            logger.info(f"AUTH: Frame procesado exitosamente para sesión {attempt.session_id}")
            logger.info(f"AUTH:   - Gesto detectado: {detected_gesture}")
            logger.info(f"AUTH:   - Calidad: {quality_assessment.quality_score:.3f}")
            logger.info(f"AUTH:   - Embeddings: anatómico={anatomical_embedding is not None}, dinámico={dynamic_embedding is not None}")
            logger.info(f"AUTH:   - Progreso secuencia: {len(attempt.gesture_sequence_captured)}/{len(attempt.required_sequence) if attempt.required_sequence else 'N/A'}")
            
            # ========================================================================
            # PASO 12: VERIFICAR SI COMPLETAMOS LA SECUENCIA REQUERIDA
            # ========================================================================

            # VERIFICACIÓN 1:1
            if (attempt.mode == AuthenticationMode.VERIFICATION and 
                attempt.required_sequence and 
                len(attempt.gesture_sequence_captured) >= len(attempt.required_sequence)):
                
                attempt.current_phase = AuthenticationPhase.TEMPLATE_MATCHING
                logger.info("AUTH: 🎉 Secuencia de verificación completada - procediendo a matching biométrico")
                return True, "Secuencia completada - procediendo a matching biométrico"

            # IDENTIFICACIÓN 1:N
            elif (attempt.mode == AuthenticationMode.IDENTIFICATION and 
                len(attempt.gesture_sequence_captured) >= 3):
                
                attempt.current_phase = AuthenticationPhase.TEMPLATE_MATCHING
                logger.info("AUTH: 🎉 Secuencia de identificación completada (3 gestos únicos)")
                logger.info(f"AUTH:    Secuencia capturada: {attempt.gesture_sequence_captured}")
                logger.info("AUTH:    Procediendo a filtrado por secuencia + verificación biométrica")
                return True, "Secuencia de 3 gestos completada - procediendo a identificación"

            # ========================================================================
            # RETORNO EXITOSO
            # ========================================================================
            return True, f"Características capturadas - {len(attempt.anatomical_features)} muestras"
            
        except Exception as e:
            logger.error(f"Error procesando frame para autenticación: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False, f"Error de procesamiento: {str(e)}"
    
    def _extract_real_dynamic_features_from_buffer(self) -> Optional[DynamicFeatureVector]:
        """Extrae características dinámicas del buffer temporal."""
        try:
            if len(self.temporal_buffer) < 5:
                return None
            
            # Extraer landmarks temporales del buffer
            landmarks_sequence = []
            gesture_sequence = []
            timestamps = []
            
            for frame_data in self.temporal_buffer:
                landmarks_sequence.append(frame_data['landmarks'])
                gesture_sequence.append(frame_data.get('gesture', 'Unknown'))
                timestamps.append(frame_data['timestamp'])
            
            # Extraer características dinámicas usando el extractor
            dynamic_features = self.dynamic_extractor.extract_features_from_sequence_real(
                landmarks_sequence=landmarks_sequence,
                gesture_sequence=gesture_sequence,
                timestamps=timestamps
            )
            
            if not dynamic_features:
                return None
            
            # CRÍTICO: CONSTRUIR temporal_sequence desde el buffer del extractor
            if hasattr(self.dynamic_extractor, 'temporal_buffer') and len(self.dynamic_extractor.temporal_buffer) >= 5:
                temporal_frames = []
                
                for frame_data in self.dynamic_extractor.temporal_buffer:
                    # Extraer características anatómicas de cada frame
                    if hasattr(frame_data, 'landmarks'):
                        world_landmarks = getattr(frame_data, 'world_landmarks', None)
                        anatomical = self.anatomical_extractor.extract_features(frame_data.landmarks, world_landmarks)

                        if anatomical and anatomical.complete_vector is not None:
                            # Expandir a 320D
                            frame_features = anatomical.complete_vector
                            padded = np.zeros(320, dtype=np.float32)
                            padded[:180] = frame_features[:180]
                            
                            remaining = 320 - 180
                            if len(frame_features) >= 140:
                                padded[180:] = frame_features[:140]
                            else:
                                cycle = np.tile(frame_features, (remaining // len(frame_features)) + 1)
                                padded[180:] = cycle[:remaining]
                            
                            temporal_frames.append(padded)
                
                if len(temporal_frames) >= 5:
                    temporal_sequence = np.array(temporal_frames, dtype=np.float32)
                    dynamic_features.temporal_sequence = temporal_sequence
                    logger.info(f"Temporal sequence construida para autenticación: {temporal_sequence.shape}")
                else:
                    logger.warning(f"Insuficientes frames válidos: {len(temporal_frames)}")
            
            if dynamic_features and self._validate_real_dynamic_features(dynamic_features):
                logger.info(f"Características dinámicas extraídas del buffer: dim={dynamic_features.complete_vector.shape[0]}")
                return dynamic_features
            else:
                logger.error("Error validando características dinámicas del buffer")
                return None
                
        except Exception as e:
            logger.error(f"Error extrayendo características dinámicas del buffer: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None
            
    def _extract_temporal_sequence_for_dynamic_network(self) -> Optional[np.ndarray]:
        """
        Extrae secuencia temporal para red dinámica.
        Convierte el buffer temporal en formato compatible con RealSiameseDynamicNetwork.
        """
        try:
            # CORRECCIÓN: Usar el buffer correcto DEL EXTRACTOR DINÁMICO
            if len(self.dynamic_extractor.temporal_buffer) < 5:  # Mínimo 5 frames
                logger.warning("Buffer temporal insuficiente para secuencia dinámica")
                return None
            
            # EXTRAER LANDMARKS DE CADA FRAME EN EL BUFFER DEL EXTRACTOR DINÁMICO
            temporal_frames = []
            for frame_data in self.dynamic_extractor.temporal_buffer:
                if hasattr(frame_data, 'landmarks') and frame_data.landmarks is not None:
                    landmarks = frame_data.landmarks
                    world_landmarks = getattr(frame_data, 'world_landmarks', None)
                    
                    # USAR EL MÉTODO CORREGIDO
                    frame_features = self._extract_single_frame_features(landmarks, world_landmarks)

                    if frame_features is not None:
                        temporal_frames.append(frame_features)
            
            if len(temporal_frames) < 5:
                logger.warning("Insuficientes frames válidos para secuencia")
                return None
            
            # CONVERTIR A ARRAY NUMPY
            temporal_sequence = np.array(temporal_frames, dtype=np.float32)
            
            # LIMITAR LONGITUD MÁXIMA (50 frames para red dinámica)
            if len(temporal_sequence) > 50:
                temporal_sequence = temporal_sequence[-50:]  # Últimos 50 frames
            
            logger.info(f"Secuencia temporal extraída: {temporal_sequence.shape}")
            return temporal_sequence
            
        except Exception as e:
            logger.error(f"Error extrayendo secuencia temporal: {e}")
    
    def _extract_single_frame_features(self, landmarks, world_landmarks=None) -> Optional[np.ndarray]:
        """
        Extrae características de un frame individual para secuencia temporal.
        """
        try:
            # CORRECCIÓN: Usar world_landmarks cuando esté disponible
            anatomical_features = self.anatomical_extractor.extract_features(landmarks, world_landmarks)
            
            if anatomical_features and anatomical_features.complete_vector is not None:
                frame_features = anatomical_features.complete_vector
                
                # ASEGURAR DIMENSIÓN CORRECTA (320 para red dinámica)
                if len(frame_features) >= 180:  # Anatómicas son 180 dims
                    # Expandir a 320 dims para compatibilidad temporal
                    padded_features = np.zeros(320, dtype=np.float32)
                    padded_features[:180] = frame_features[:180]
                    
                    # Completar las últimas 140 dims con características repetidas
                    remaining_dims = 320 - 180  # 140 dims
                    if len(frame_features) >= 140:
                        padded_features[180:] = frame_features[:140]
                    else:
                        # Repetir las características disponibles
                        feature_cycle = np.tile(frame_features, (remaining_dims // len(frame_features)) + 1)
                        padded_features[180:] = feature_cycle[:remaining_dims]
                    
                    return padded_features
            
            return None
            
        except Exception as e:
            logger.error(f"Error extrayendo features de frame individual: {e}")
            return None

    
    def _validate_real_dynamic_features(self, features: DynamicFeatureVector) -> bool:
        """Valida las características dinámicas."""
        try:
            if not features or features.complete_vector is None:
                return False
            
            vector = features.complete_vector
            
            # Verificar que no son datos simulados (sin patrones artificiales)
            if np.var(vector) < 1e-8:
                logger.error("Características dinámicas sin variación - posiblemente simuladas")
                return False
            
            # Verificar dimensiones esperadas
            if len(vector) != 320:
                logger.error(f"Dimensión dinámica incorrecta: {len(vector)} != 320")
                return False
            
            # Verificar que no hay valores NaN o infinitos
            if np.any(np.isnan(vector)) or np.any(np.isinf(vector)):
                logger.error("Características dinámicas contienen NaN o infinitos")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validando características dinámicas: {e}")
            return False
    
    def _generate_real_anatomical_embedding(self, features: AnatomicalFeatureVector) -> Optional[np.ndarray]:
        """Genera embedding anatómico usando red siamesa entrenada."""
        try:
            if not self.anatomical_network.is_trained:
                logger.error("Red anatómica no está entrenada para generar embedding")
                return None
            
            if not features or features.complete_vector is None:
                logger.error("Características anatómicas inválidas para embedding")
                return None
            
            # Usar red base entrenada para generar embedding
            features_array = features.complete_vector.reshape(1, -1)
            
            # Verificar dimensiones
            expected_input_dim = self.anatomical_network.input_dim
            if features_array.shape[1] != expected_input_dim:
                logger.error(f"Dimensión anatómica incorrecta: {features_array.shape[1]} != {expected_input_dim}")
                return None
            
            embedding = self.anatomical_network.base_network.predict(features_array)[0]
            
            # Validar embedding generado
            if self._validate_real_embedding(embedding, "anatomical"):
                logger.info(f"Embedding anatómico generado: dim={embedding.shape[0]}, norm={np.linalg.norm(embedding):.3f}")
                return embedding
            else:
                logger.error("Embedding anatómico generado es inválido")
                return None
                
        except Exception as e:
            logger.error(f"Error generando embedding anatómico: {e}")
            return None
    
    def _generate_real_dynamic_embedding(self, features: DynamicFeatureVector) -> Optional[np.ndarray]:
        """Genera embedding dinámico usando temporal_sequence."""
        try:
            logger.info("Generando embedding dinámico para autenticación")
            
            if not self.dynamic_network.is_trained:
                logger.error("Red dinámica no está entrenada")
                return None
            
            if not features:
                logger.error("Características dinámicas inválidas")
                return None
            
            # Verificar que existe temporal_sequence
            if not hasattr(features, 'temporal_sequence') or features.temporal_sequence is None:
                logger.error("No hay temporal_sequence disponible - no se puede generar embedding dinámico")
                return None
            
            # Usar temporal_sequence
            temporal_array = features.temporal_sequence
            expected_seq_length = self.dynamic_network.sequence_length
            expected_feature_dim = self.dynamic_network.feature_dim
            
            logger.info(f"Temporal sequence shape: {temporal_array.shape}")
            
            # Ajustar longitud de secuencia
            if temporal_array.shape[0] > expected_seq_length:
                temporal_array = temporal_array[:expected_seq_length]
            elif temporal_array.shape[0] < expected_seq_length:
                padding = np.zeros((expected_seq_length - temporal_array.shape[0], temporal_array.shape[1]))
                temporal_array = np.vstack([temporal_array, padding])
            
            # Ajustar dimensión de features
            if temporal_array.shape[1] != expected_feature_dim:
                if temporal_array.shape[1] > expected_feature_dim:
                    temporal_array = temporal_array[:, :expected_feature_dim]
                else:
                    padding = np.zeros((temporal_array.shape[0], expected_feature_dim - temporal_array.shape[1]))
                    temporal_array = np.hstack([temporal_array, padding])
            
            # Preparar para red
            sequence = temporal_array.reshape(1, expected_seq_length, expected_feature_dim)
            
            # Generar embedding
            embedding = self.dynamic_network.base_network.predict(sequence, verbose=0)[0]
            
            # Validar embedding
            if self._validate_real_embedding(embedding, "dynamic"):
                logger.info(f"Embedding dinámico generado: dim={embedding.shape[0]}, norm={np.linalg.norm(embedding):.3f}")
                return embedding
            else:
                logger.error("Embedding dinámico generado es inválido")
                return None
                
        except Exception as e:
            logger.error(f"Error generando embedding dinámico: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None
        
    def _validate_real_embedding(self, embedding: np.ndarray, embedding_type: str) -> bool:
        """Valida que el embedding generado por la red es válido."""
        try:
            if embedding is None:
                return False
            
            # Validar que no hay NaN o infinitos
            if np.any(np.isnan(embedding)) or np.any(np.isinf(embedding)):
                logger.error(f"Embedding {embedding_type} contiene NaN o infinitos")
                return False
            
            # Validar que no es vector cero (indicaría problema de red)
            if np.allclose(embedding, 0.0, atol=1e-6):
                logger.error(f"Embedding {embedding_type} es vector cero - posible problema de red")
                return False
            
            # Validar rango de magnitud razonable
            magnitude = np.linalg.norm(embedding)
            if magnitude < 0.01 or magnitude > 1000.0:
                logger.error(f"Magnitud de embedding {embedding_type} fuera de rango razonable: {magnitude}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validando embedding {embedding_type}: {e}")
            return False
    
    def _draw_real_quality_feedback(self, frame: np.ndarray, quality_assessment: Optional[QualityAssessment]):
        """Dibuja feedback visual en el frame."""
        try:
            if not quality_assessment:
                return
            
            # Feedback de calidad
            quality_color = (0, 255, 0) if quality_assessment.ready_for_capture else (0, 0, 255)
            cv2.putText(frame, f"Calidad: {quality_assessment.quality_score:.3f}", (20, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, quality_color, 2)
            
            # Feedback específico
            y_offset = 60
            if hasattr(quality_assessment, 'hand_size') and quality_assessment.hand_size:
                distance_msg = "Distancia correcta"
                if quality_assessment.hand_size.distance_status == "muy_lejos":
                    distance_msg = "Acerca más la mano"
                elif quality_assessment.hand_size.distance_status == "muy_cerca":
                    distance_msg = "Aleja un poco la mano"
                
                cv2.putText(frame, distance_msg, (20, y_offset), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                y_offset += 25
            
            if hasattr(quality_assessment, 'movement') and quality_assessment.movement:
                movement_msg = "Mano estable"
                if quality_assessment.movement.is_moving:
                    movement_msg = "Mantén la mano quieta"
                elif not quality_assessment.movement.is_stable:
                    movement_msg = f"Estabilizando: {quality_assessment.movement.stable_frames}/3"
                
                cv2.putText(frame, movement_msg, (20, y_offset), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
        except Exception as e:
            logger.error(f"Error dibujando feedback: {e}")
    
    def cleanup(self):
        """Limpia recursos del pipeline."""
        try:
            self.is_initialized = False
            self.temporal_buffer.clear()
            
            if self.camera_manager:
                self.camera_manager.release()
            if self.mediapipe_processor:
                self.mediapipe_processor.close()
            
            # Cerrar ventanas de OpenCV
            cv2.destroyAllWindows()
            
            logger.info("Pipeline de autenticación limpiado")
            
        except Exception as e:
            logger.error(f"Error limpiando pipeline: {e}")

# ====================================================================
# GESTOR DE SESIONES
# ====================================================================

class RealSessionManager:
    """Gestor de sesiones de autenticación."""
    
    def __init__(self, config: RealAuthenticationConfig):
        """Inicializa gestor con control."""
        self.config = config
        self.logger = get_logger()
        
        # Sesiones activas
        self.active_sessions: Dict[str, RealAuthenticationAttempt] = {}
        self.session_history: List[RealAuthenticationAttempt] = []
        
        # Límites por IP/usuario
        self.session_limits: Dict[str, int] = defaultdict(int)
        self.failed_attempts: Dict[str, List[float]] = defaultdict(list)
        
        # Lock para concurrencia
        self.lock = threading.RLock()
        
        logger.info("RealSessionManager inicializado para gestión de sesiones")
    
    def create_real_session(self, mode: AuthenticationMode, user_id: Optional[str] = None,
                           security_level: SecurityLevel = SecurityLevel.STANDARD,
                           ip_address: str = "localhost",
                           device_info: Optional[Dict[str, Any]] = None,
                           required_sequence: Optional[List[str]] = None,
                           session_token: Optional[str] = None,
                           callback_url: Optional[str] = None) -> str:
        """
        Crea nueva sesión de autenticación.
        
        Args:
            mode: Modo de autenticación
            user_id: ID de usuario (para verificación)
            security_level: Nivel de seguridad
            ip_address: Dirección IP del cliente
            device_info: Información del dispositivo
            required_sequence: Secuencia de gestos requerida
            
        Returns:
            ID de la sesión creada
        """
        try:
            with self.lock:
                logger.info(f"Creando sesión: modo={mode.value}, usuario={user_id}")
                
                # LIMPIEZA PREVENTIVA: Cerrar sesiones activas previas de esta IP
                existing_ip_sessions = [
                    sid for sid, s in self.active_sessions.items() 
                    if s.ip_address == ip_address
                ]
                if existing_ip_sessions:
                    logger.info(f"Cerrando {len(existing_ip_sessions)} sesión(es) previa(s) de IP {ip_address}")
                    for old_session_id in existing_ip_sessions:
                        self.close_real_session(old_session_id, AuthenticationStatus.CANCELLED)
        
                # Verificar límites de sesiones
                if len(self.active_sessions) >= 10:  # Máximo 10 sesiones concurrentes
                    raise Exception("Máximo número de sesiones activas alcanzado")
                
                # Verificar límites por IP
                ip_sessions = len([s for s in self.active_sessions.values() if s.ip_address == ip_address])
                if ip_sessions >= 3:  # Máximo 3 sesiones por IP
                    raise Exception("Máximo número de sesiones por IP alcanzado")
                
                # Verificar intentos fallidos recientes
                if ip_address in self.failed_attempts:
                    recent_failures = [
                        t for t in self.failed_attempts[ip_address]
                        if time.time() - t < self.config.lockout_duration
                    ]
                    if len(recent_failures) >= self.config.max_failed_attempts:
                        raise Exception("IP bloqueada por intentos fallidos")
                
                # Crear sesión
                session_id = str(uuid.uuid4())
                attempt_id = str(uuid.uuid4())
                
                attempt = RealAuthenticationAttempt(
                    attempt_id=attempt_id,
                    session_id=session_id,
                    mode=mode,
                    user_id=user_id,
                    security_level=security_level,
                    ip_address=ip_address,
                    device_info=device_info or {},
                    required_sequence=required_sequence or [],
                    session_token=session_token,    # NUEVO
                    callback_url=callback_url       # NUEVO
                )
                
                attempt.status = AuthenticationStatus.IN_PROGRESS
                attempt.current_phase = AuthenticationPhase.INITIALIZATION
                
                self.active_sessions[session_id] = attempt
                self.session_limits[ip_address] += 1
                
                logger.info(f"Sesión creada exitosamente: {session_id}")
                logger.info(f"  - Modo: {mode.value}")
                logger.info(f"  - Usuario: {user_id}")
                logger.info(f"  - Nivel seguridad: {security_level.value}")
                logger.info(f"  - Secuencia requerida: {required_sequence}")
                
                return session_id
                
        except Exception as e:
            logger.error(f"Error creando sesión: {e}")
            raise
    
    def get_real_session(self, session_id: str) -> Optional[RealAuthenticationAttempt]:
        """Obtiene sesión por ID."""
        with self.lock:
            return self.active_sessions.get(session_id)
    
    def close_real_session(self, session_id: str, final_status: AuthenticationStatus):
        """Cierra sesión con estado final."""
        try:
            with self.lock:
                if session_id not in self.active_sessions:
                    logger.error(f"Sesión {session_id} no encontrada para cerrar")
                    return
                
                session = self.active_sessions[session_id]
                session.status = final_status
                session.end_time = time.time()
                
                # Registrar intento fallido si es necesario
                if final_status in [AuthenticationStatus.REJECTED, AuthenticationStatus.TIMEOUT, AuthenticationStatus.ERROR]:
                    self.failed_attempts[session.ip_address].append(time.time())
                
                # Actualizar límites
                self.session_limits[session.ip_address] -= 1
                if self.session_limits[session.ip_address] <= 0:
                    del self.session_limits[session.ip_address]
                
                # Mover a historial
                self.session_history.append(session)
                del self.active_sessions[session_id]
                
                logger.info(f"Sesión cerrada: {session_id} - Estado: {final_status.value}")
                logger.info(f"  - Duración: {session.duration:.1f}s")
                logger.info(f"  - Frames procesados: {session.frames_processed}")
                logger.info(f"  - Gestos capturados: {len(session.gesture_sequence_captured)}")
                
        except Exception as e:
            logger.error(f"Error cerrando sesión: {e}")
    
    # def cleanup_expired_real_sessions(self):
    #     """Limpia sesiones expiradas."""
    #     try:
    #         with self.lock:
    #             current_time = time.time()
    #             expired_sessions = []
                
    #             for session_id, session in self.active_sessions.items():
    #                 if current_time - session.start_time > self.config.total_timeout:
    #                     expired_sessions.append(session_id)
                
    #             for session_id in expired_sessions:
    #                 self.close_real_session(session_id, AuthenticationStatus.TIMEOUT)
                
    #             if expired_sessions:
    #                 logger.info(f"Sesiones expiradas limpiadas: {len(expired_sessions)}")
                    
    #     except Exception as e:
    #         logger.error(f"Error limpiando sesiones expiradas: {e}")
    
    def cleanup_expired_real_sessions(self):
        """Limpia sesiones expiradas por timeout O por inactividad."""
        try:
            with self.lock:
                current_time = time.time()
                expired_sessions = []
                
                for session_id, session in self.active_sessions.items():
                    # LIMPIEZA POR TIMEOUT TOTAL (desde el inicio)
                    if current_time - session.start_time > self.config.total_timeout:
                        expired_sessions.append((session_id, "timeout_total"))
                    # LIMPIEZA POR INACTIVIDAD (60 segundos sin frames)
                    elif current_time - session.last_frame_time > 60:
                        expired_sessions.append((session_id, "inactividad"))
                
                for session_id, reason in expired_sessions:
                    logger.info(f"Limpiando sesión {session_id} por {reason}")
                    self.close_real_session(session_id, AuthenticationStatus.TIMEOUT)
                
                if expired_sessions:
                    logger.info(f"Sesiones limpiadas: {len(expired_sessions)}")
                    
        except Exception as e:
            logger.error(f"Error limpiando sesiones expiradas: {e}")
        
    def get_real_session_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas de sesiones."""
        with self.lock:
            current_time = time.time()
            
            # Sesiones de las últimas 24 horas
            recent_sessions = [
                s for s in self.session_history
                if current_time - s.start_time < 86400
            ]
            
            return {
                'active_sessions': len(self.active_sessions),
                'total_sessions_today': len(recent_sessions),
                'successful_sessions': len([s for s in recent_sessions if s.status == AuthenticationStatus.AUTHENTICATED]),
                'failed_sessions': len([s for s in recent_sessions if s.status in [AuthenticationStatus.REJECTED, AuthenticationStatus.TIMEOUT, AuthenticationStatus.ERROR]]),
                'average_duration': np.mean([s.duration for s in recent_sessions]) if recent_sessions else 0,
                'unique_ips_today': len(set(s.ip_address for s in recent_sessions)),
                'blocked_ips': len([ip for ip, failures in self.failed_attempts.items() if len([f for f in failures if current_time - f < self.config.lockout_duration]) >= self.config.max_failed_attempts]),
                'is_real_stats': True
            }

# ====================================================================
# SISTEMA DE AUTENTICACIÓN PRINCIPAL  
# ====================================================================

class RealAuthenticationSystem:
    """
    Sistema principal de autenticación biométrica.
    Coordina todo el proceso de verificación e identificación.
    """
    
    def __init__(self, config_override: Optional[Dict[str, Any]] = None):
        """
        Inicializa el sistema de autenticación.
        
        Args:
            config_override: Configuración personalizada (opcional)
        """
        self.logger = get_logger()
        
        # Configuración
        default_config = self._load_real_default_config()
        if config_override:
            default_config.update(config_override)
        
        self.config = RealAuthenticationConfig(**default_config)
        
        # Componentes principales
        self.pipeline = RealAuthenticationPipeline(self.config)
        self.session_manager = RealSessionManager(self.config)
        self.security_auditor = RealSecurityAuditor(self.config)
        
        # Servicio de feedback para métricas
        from app.services.authentication_feedback_service import get_feedback_service
        self.feedback_service = get_feedback_service()
        logger.info("Servicio de feedback inicializado")

        # Servicio de identificación
        self.identification_service = get_identification_service()
        logger.info("Servicio de identificación inicializado")
        
        self.database = get_biometric_database()
        self.fusion_system = get_real_score_fusion_system()
        
        # Sistema de enrollment
        self.enrollment_system = get_real_enrollment_system()
        
        # Estado del sistema
        self.is_initialized = False
        
        # Estadísticas
        self.statistics = {
            'verification_attempts': 0,
            'verification_success': 0,
            'verification_errors': 0,
            'identification_attempts': 0,
            'identification_success': 0,
            'identification_errors': 0,
            'total_frames_processed': 0,
            'total_embeddings_generated': 0
        }
        
        logger.info("RealAuthenticationSystem inicializado")
        logger.info(f"  - Configuración: umbrales={self.config.security_thresholds}")
    
    def _load_real_default_config(self) -> Dict[str, Any]:
        """Carga configuración por defecto."""
        return {
            'sequence_timeout': get_config('biometric.auth.sequence_timeout', 25.0),
            'total_timeout': get_config('biometric.auth.total_timeout', 45.0),
            'frame_timeout': get_config('biometric.auth.frame_timeout', 3.0),
            'security_thresholds': {
                'low': get_config('biometric.auth.threshold_low', 0.65),
                'standard': get_config('biometric.auth.threshold_standard', 0.75),
                'high': get_config('biometric.auth.threshold_high', 0.85),
                'maximum': get_config('biometric.auth.threshold_maximum', 0.92)
            },
            'require_sequence_completion': get_config('biometric.auth.require_sequence_completion', True),
            'min_gestures_for_auth': get_config('biometric.auth.min_gestures_for_auth', 2),
            'max_attempts_per_session': get_config('biometric.auth.max_attempts_per_session', 3),
            'max_identification_candidates': get_config('biometric.auth.max_identification_candidates', 5),
            'identification_threshold_factor': get_config('biometric.auth.identification_threshold_factor', 1.1),
            'min_quality_score': get_config('biometric.auth.min_quality_score', 0.7),
            'min_confidence': get_config('biometric.auth.min_confidence', 0.65),
            'min_stability_frames': get_config('biometric.auth.min_stability_frames', 8),
            'score_fusion_strategy': get_config('biometric.auth.score_fusion_strategy', 'weighted_average'),
            'anatomical_weight': get_config('biometric.auth.anatomical_weight', 0.6),
            'dynamic_weight': get_config('biometric.auth.dynamic_weight', 0.4),
            'enable_audit_logging': get_config('biometric.auth.enable_audit_logging', True),
            'enable_continuous_auth': get_config('biometric.auth.enable_continuous_auth', False),
            'max_failed_attempts': get_config('biometric.auth.max_failed_attempts', 5),
            'lockout_duration': get_config('biometric.auth.lockout_duration', 300.0)
        }
    
    def initialize_real_system(self) -> bool:
        """Inicializa todos los componentes del sistema."""
        try:
            logger.info("Inicializando sistema de autenticación...")
            
            # CORRECCIÓN CRÍTICA: OBTENER Y ALMACENAR REFERENCIAS A REDES
            logger.info("Obteniendo referencias a redes entrenadas...")
            self.anatomical_network = get_real_siamese_anatomical_network()
            self.dynamic_network = get_real_siamese_dynamic_network()
            
            # LOGS DE DIAGNÓSTICO ESPECÍFICOS
            logger.info("=== DIAGNÓSTICO DE ESTADO DE REDES ===")
            
            # Verificar archivos de modelo en disco
            from pathlib import Path
            models_dir = Path('biometric_data/models')
            anat_file = models_dir / 'anatomical_model.h5'
            dyn_file = models_dir / 'dynamic_model.h5'
            
            logger.info(f"Archivos de modelo en disco:")
            logger.info(f"  - Anatómico: {anat_file.exists()} - {anat_file}")
            logger.info(f"  - Dinámico: {dyn_file.exists()} - {dyn_file}")
            
            # Verificar estado de instancias
            logger.info(f"Estado de instancias globales:")
            logger.info(f"  - Anatómica is_trained: {getattr(self.anatomical_network, 'is_trained', 'NO_ATRIBUTO')}")
            logger.info(f"  - Dinámica is_trained: {getattr(self.dynamic_network, 'is_trained', 'NO_ATRIBUTO')}")
            
            # Verificar si las instancias tienen modelos cargados
            logger.info(f"Modelos compilados:")
            logger.info(f"  - Anatómica siamese_model: {getattr(self.anatomical_network, 'siamese_model', None) is not None}")
            logger.info(f"  - Dinámica siamese_model: {getattr(self.dynamic_network, 'siamese_model', None) is not None}")
            
            logger.info("=== FIN DIAGNÓSTICO ===")
            
            logger.info(f"Referencias a redes obtenidas:")
            logger.info(f"  - Red anatómica disponible: {self.anatomical_network is not None}")
            logger.info(f"  - Red anatómica entrenada: {self.anatomical_network.is_trained if self.anatomical_network else False}")
            logger.info(f"  - Red dinámica disponible: {self.dynamic_network is not None}")
            logger.info(f"  - Red dinámica entrenada: {self.dynamic_network.is_trained if self.dynamic_network else False}")
            
            # Verificar que la base de datos tiene usuarios registrados
            users = self.database.list_users()
            if not users:
                logger.error("Base de datos vacía - registra usuarios primero")
                return False
            
            # Verificar que los usuarios tienen templates
            users_with_templates = [u for u in users if u.total_templates > 0]
            if not users_with_templates:
                logger.error("No hay usuarios con templates biométricos - completa enrollments primero")
                return False
            
            # VERIFICAR ESTADO DE REDES ANTES DE CONTINUAR
            if not self.anatomical_network or not self.anatomical_network.is_trained:
                logger.error("Red anatómica no está disponible o no entrenada")
                return False
            
            if not self.dynamic_network or not self.dynamic_network.is_trained:
                logger.warning("Red dinámica no está disponible o no entrenada - continuando solo con anatómica")
            
            # Inicializar pipeline
            if hasattr(self, 'pipeline') and hasattr(self.pipeline, 'initialize_real_pipeline'):
                if not self.pipeline.initialize_real_pipeline():
                    logger.error("Error inicializando pipeline de autenticación")
                    return False
            
            # VERIFICAR O INICIALIZAR SISTEMA DE FUSIÓN
            if hasattr(self, 'fusion_system'):
                if not hasattr(self.fusion_system, 'is_initialized') or not self.fusion_system.is_initialized:
                    # Intentar inicializar sistema de fusión con las redes
                    if hasattr(self.fusion_system, 'initialize_networks'):
                        fusion_success = self.fusion_system.initialize_networks(
                            self.anatomical_network, 
                            self.dynamic_network, 
                            get_real_feature_preprocessor()
                        )
                        if not fusion_success:
                            logger.error("Error inicializando sistema de fusión")
                            return False
                    else:
                        logger.warning("Sistema de fusión no tiene método initialize_networks")
            
            self.is_initialized = True
            
            logger.info("Sistema de autenticación inicializado exitosamente")
            logger.info(f"  - Usuarios disponibles: {len(users_with_templates)}")
            logger.info(f"  - Templates totales: {sum(u.total_templates for u in users_with_templates)}")
            if hasattr(self, 'pipeline'):
                logger.info(f"  - Pipeline listo: {getattr(self.pipeline, 'is_initialized', False)}")
            logger.info(f"  - Redes entrenadas: anatómica={self.anatomical_network.is_trained}, dinámica={self.dynamic_network.is_trained}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error inicializando sistema: {e}")
            import traceback
            logger.error(f"Traceback completo: {traceback.format_exc()}")
            return False
    
    def start_real_verification(self, user_id: str, 
                               security_level: SecurityLevel = SecurityLevel.STANDARD,
                               required_sequence: Optional[List[str]] = None,
                               ip_address: str = "localhost",
                               device_info: Optional[Dict[str, Any]] = None,
                               session_token: Optional[str] = None,
                               callback_url: Optional[str] = None) -> str:
        """
        Inicia proceso de verificación 1:1.
        
        Args:
            user_id: ID del usuario a verificar
            security_level: Nivel de seguridad
            required_sequence: Secuencia de gestos requerida
            ip_address: Dirección IP del cliente
            device_info: Información del dispositivo
            
        Returns:
            ID de sesión de verificación
        """
        try:
            logger.info(f"Iniciando verificación para usuario: {user_id}")
            logger.info(f"  - Nivel de seguridad: {security_level.value}")
            logger.info(f"  - Secuencia requerida: {required_sequence}")
            
            if not self.is_initialized:
                raise Exception("Sistema de autenticación no inicializado")
            
            # Verificar que el usuario existe
            user_profile = self.database.get_user(user_id)
            if not user_profile:
                raise Exception(f"Usuario {user_id} no encontrado en base de datos")
            
            if user_profile.total_templates == 0:
                raise Exception(f"Usuario {user_id} no tiene templates biométricos registrados")
            
            # Obtener secuencia del usuario si no se especifica
            if not required_sequence and user_profile.gesture_sequence:
                required_sequence = user_profile.gesture_sequence
            
            # Crear sesión
            session_id = self.session_manager.create_real_session(
                mode=AuthenticationMode.VERIFICATION,
                user_id=user_id,
                security_level=security_level,
                ip_address=ip_address,
                device_info=device_info,
                required_sequence=required_sequence,
                session_token=session_token,    # NUEVO
                callback_url=callback_url       # NUEVO
            )
            
            self.statistics['verification_attempts'] += 1
            
            logger.info(f"Verificación iniciada: sesión {session_id}")
            logger.info(f"  - Usuario: {user_id}")
            logger.info(f"  - Templates disponibles: {user_profile.total_templates}")
            
            return session_id
            
        except Exception as e:
            logger.error(f"Error iniciando verificación: {e}")
            self.statistics['verification_errors'] += 1
            raise
    
    def start_real_identification(self, security_level: SecurityLevel = SecurityLevel.STANDARD,
                                 ip_address: str = "localhost",
                                 device_info: Optional[Dict[str, Any]] = None,
                                 session_token: Optional[str] = None,
                                 callback_url: Optional[str] = None) -> str:
        """
        Inicia proceso de identificación 1:N.
        
        Args:
            security_level: Nivel de seguridad
            ip_address: Dirección IP del cliente
            device_info: Información del dispositivo
            
        Returns:
            ID de sesión de identificación
        """
        try:
            logger.info(f"Iniciando identificación 1:N")
            logger.info(f"  - Nivel de seguridad: {security_level.value}")
            
            if not self.is_initialized:
                raise Exception("Sistema de autenticación no inicializado")
            
            # Verificar que hay usuarios registrados
            users = self.database.list_users()
            users_with_templates = [u for u in users if u.total_templates > 0]
            
            if len(users_with_templates) == 0:
                raise Exception("No hay usuarios con templates para identificación")
            
            # Crear sesión
            session_id = self.session_manager.create_real_session(
                mode=AuthenticationMode.IDENTIFICATION,
                user_id=None,
                security_level=security_level,
                ip_address=ip_address,
                device_info=device_info,
                session_token=session_token,    # NUEVO
                callback_url=callback_url       # NUEVO
            )
            
            self.statistics['identification_attempts'] += 1
            
            logger.info(f"Identificación iniciada: sesión {session_id}")
            logger.info(f"  - Usuarios en base de datos: {len(users_with_templates)}")
            logger.info(f"  - Candidatos máximos: {self.config.max_identification_candidates}")
            
            return session_id
            
        except Exception as e:
            logger.error(f"Error iniciando identificación: {e}")
            self.statistics['identification_errors'] += 1
            raise
    
    # def process_real_authentication_frame(self, session_id: str) -> Dict[str, Any]:
    #     """
    #     Procesa un frame para una sesión de autenticación.
        
    #     Args:
    #         session_id: ID de la sesión
            
    #     Returns:
    #         Información del frame procesado y estado de la sesión
    #     """
    #     try:
    #         # Limpiar sesiones expiradas
    #         self.session_manager.cleanup_expired_real_sessions()
            
    #         # Obtener sesión
    #         session = self.session_manager.get_real_session(session_id)
    #         if not session:
    #             return {'error': 'Sesión no encontrada o expirada', 'is_real': True}
            
    #         # Verificar timeout
    #         if session.duration > self.config.total_timeout:
    #             self._complete_real_authentication(session, AuthenticationStatus.TIMEOUT)
    #             return {'status': 'timeout', 'message': 'Sesión expirada', 'is_real': True}
            
    #         # Procesar frame
    #         success, message = self.pipeline.process_frame_for_real_authentication(session)
            
    #         self.statistics['total_frames_processed'] += 1
    #         if success and (session.anatomical_features or session.dynamic_features):
    #             self.statistics['total_embeddings_generated'] += 1
            
    #         response = {
    #             'session_id': session_id,
    #             'status': session.status.value,
    #             'phase': session.current_phase.value,
    #             'progress': session.sequence_progress,
    #             'message': message,
    #             'frames_processed': session.frames_processed,
    #             'valid_captures': session.valid_captures,
    #             'duration': session.duration,
    #             'frame_processed': success,
    #             'is_real_processing': True,
    #             'no_simulation': True
    #         }

    #         # NUEVO: Incluir información del gesto detectado para captura secuencial
    #         if success:
    #             try:
    #                 # Obtener el último gesto procesado desde el pipeline
    #                 pipeline = self.pipeline
    #                 if hasattr(pipeline, 'last_processing_result') and pipeline.last_processing_result:
    #                     gesture_result = pipeline.last_processing_result.gesture_result
    #                     if gesture_result:
    #                         response['current_gesture'] = gesture_result.gesture_name
    #                         response['gesture_confidence'] = gesture_result.confidence
    #                     else:
    #                         response['current_gesture'] = 'None'
    #                         response['gesture_confidence'] = 0.0
    #                 else:
    #                     response['current_gesture'] = 'None'
    #                     response['gesture_confidence'] = 0.0
    #             except:
    #                 response['current_gesture'] = 'None'
    #                 response['gesture_confidence'] = 0.0
    #         else:
    #             response['current_gesture'] = 'None'
    #             response['gesture_confidence'] = 0.0
    
    #         # Si es verificación, incluir información de secuencia
    #         if session.mode == AuthenticationMode.VERIFICATION:
    #             response.update({
    #                 'required_sequence': session.required_sequence,
    #                 'captured_sequence': session.gesture_sequence_captured,
    #                 'sequence_complete': len(session.gesture_sequence_captured) >= len(session.required_sequence) if session.required_sequence else False
    #             })
            
    #         # Información de características capturadas
    #         response.update({
    #             'anatomical_features_captured': len(session.anatomical_features),
    #             'dynamic_features_captured': len(session.dynamic_features),
    #             'average_quality': np.mean(session.quality_scores) if session.quality_scores else 0.0,
    #             'average_confidence': np.mean(session.confidence_scores) if session.confidence_scores else 0.0,
    #             # NUEVO: Incluir embeddings reales para identificación secuencial
    #             #'anatomical_embedding': session.anatomical_features[-1] if session.anatomical_features else None,
    #             #'dynamic_embedding': session.dynamic_features[-1] if session.dynamic_features else None,
    #             'has_embeddings': len(session.anatomical_features) > 0
    #         })
            
    #         # Verificar si podemos proceder al matching
    #         if session.current_phase == AuthenticationPhase.TEMPLATE_MATCHING:
    #             auth_result = self._perform_real_authentication_matching(session)
                
    #             # INCLUIR RESULTADO COMPLETO EN RESPONSE
    #             response['authentication_result'] = {
    #                 'success': auth_result.success,
    #                 'user_id': auth_result.user_id,
    #                 'matched_user_id': auth_result.matched_user_id,
    #                 'anatomical_score': auth_result.anatomical_score,
    #                 'dynamic_score': auth_result.dynamic_score,
    #                 'fused_score': auth_result.fused_score,
    #                 'confidence': auth_result.confidence,
    #                 'duration': auth_result.duration,
    #                 'feedback_token': session.feedback_token if hasattr(session, 'feedback_token') else None,
    #                 'is_real_result': True
    #             }
                
    #             # Completar sesión
    #             # final_status = AuthenticationStatus.AUTHENTICATED if auth_result.success else AuthenticationStatus.REJECTED
    #             # self._complete_real_authentication(session, final_status)
                
    #             # Completar sesión
    #             final_status = AuthenticationStatus.AUTHENTICATED if auth_result.success else AuthenticationStatus.REJECTED

    #             #Determinar user_id según el modo
    #             final_user_id = session.user_id
                
    #             # Solo para IDENTIFICACIÓN: usar matched_user_id si está disponible
    #             if session.mode == AuthenticationMode.IDENTIFICATION:
    #                 if auth_result.matched_user_id:
    #                     final_user_id = auth_result.matched_user_id
    #                 else:
    #                     final_user_id = 'unknown'  # Fallback para identificación fallida
    #             # Para VERIFICACIÓN: final_user_id ya tiene session.user_id correcto
                
                
    #             # GUARDAR INTENTO DE AUTENTICACIÓN EN HISTORIAL
    #             attempt = AuthenticationAttempt(
    #                 attempt_id=str(uuid.uuid4()),
    #                 user_id=auth_result.user_id or auth_result.matched_user_id or "unknown",
    #                 timestamp=time.time(),
    #                 auth_type="verification" if session.mode == AuthenticationMode.VERIFICATION else "identification",
    #                 result="success" if auth_result.success else "failed",
    #                 confidence=auth_result.confidence,
    #                 anatomical_score=auth_result.anatomical_score,
    #                 dynamic_score=auth_result.dynamic_score,
    #                 fused_score=auth_result.fused_score,
    #                 ip_address=session.metadata.get('ip_address', 'unknown') if hasattr(session, 'metadata') else 'unknown',
    #                 device_info=str(session.metadata.get('device_info', '')) if hasattr(session, 'metadata') else '',
    #                 failure_reason=", ".join(auth_result.risk_factors) if not auth_result.success and auth_result.risk_factors else None,

    #                 metadata={
    #                     'session_id': session.session_id,
    #                     'security_level': session.security_level.value if hasattr(session, 'security_level') else 'standard',
    #                     'duration': auth_result.duration,
    #                     'frames_processed': auth_result.frames_processed,
    #                     'gestures_captured': auth_result.gestures_captured if hasattr(auth_result, 'gestures_captured') else []
    #                 }
    #             )

    #             # Guardar en base de datos
    #             self.database.store_authentication_attempt(attempt)
    #             logger.info(f"Intento de autenticación guardado: {attempt.attempt_id}")

    #             # ENVIAR RESULTADO AL PLUGIN (si tiene callback_url configurado)
    #             if session.callback_url and session.session_token:
    #                 try:
    #                     logger.info(f"📤 Enviando resultado de autenticación al Plugin")
    #                     logger.info(f"   Callback URL: {session.callback_url}")
                        
    #                     # Obtener email del usuario
    #                     user_email = None
    #                     if final_user_id and final_user_id != 'unknown':
    #                         user_profile = self.database.get_user(final_user_id)
    #                         if user_profile:
    #                             user_email = user_profile.email
                        
    #                     if user_email:
    #                         webhook_service = get_plugin_webhook_service()
    #                         webhook_service.set_api_key("sk_live_009f37683c1868404039fdf3d5c6e28b")
                            
    #                         success_webhook = webhook_service.send_authentication_result(
    #                             callback_url=session.callback_url,
    #                             user_id=final_user_id,
    #                             email=user_email,
    #                             session_token=session.session_token,
    #                             authenticated=auth_result.success,
    #                             confidence=auth_result.confidence
    #                         )
                            
    #                         if success_webhook:
    #                             logger.info(f"Resultado enviado exitosamente al Plugin")
    #                         else:
    #                             logger.warning(f"No se pudo enviar resultado al Plugin")
    #                     else:
    #                         logger.warning(f"No se pudo obtener email del usuario {final_user_id}")
                            
    #                 except Exception as e:
    #                     logger.error(f"Error enviando resultado al Plugin: {e}")
    #                     # No fallar la autenticación si falla el envío al Plugin
                        
    #             self._complete_real_authentication(session, final_status)

    #             # MARCAR COMO COMPLETADO
    #             response['session_completed'] = True
    #             response['final_status'] = final_status.value
                
    #             # LOG PARA CONFIRMAR
    #             logger.info(f"Resultado incluido en response - success={auth_result.success}")

    #         return response  # Retornar ANTES de que se cierre la sesión
                        
    #     except Exception as e:
    #         logger.error(f"Error procesando frame de autenticación REAL: {e}")
    #         return {
    #             'error': str(e),
    #             'is_real': True,
    #             'no_simulation': True
    #         }
    
    
    def process_real_authentication_frame(self, session_id: str, frame_image: np.ndarray) -> Dict[str, Any]:
        """
        Procesa un frame recibido del FRONTEND para autenticación.
        
        Args:
            session_id: ID de la sesión
            frame_image: Frame capturado desde el frontend (numpy array BGR)
            
        Returns:
            Información del frame procesado y estado de la sesión
        """
        try:
            # Limpiar sesiones expiradas
            self.session_manager.cleanup_expired_real_sessions()
            
            # Obtener sesión
            session = self.session_manager.get_real_session(session_id)
            if not session:
                return {'error': 'Sesión no encontrada o expirada', 'is_real': True}
            
            # Verificar timeout
            if session.duration > self.config.total_timeout:
                self._complete_real_authentication(session, AuthenticationStatus.TIMEOUT)
                # return {'status': 'timeout', 'message': 'Sesión expirada', 'is_real': True}
                return {
                    'error': 'session_timeout',
                    'error_type': 'timeout_total',
                    'status': 'timeout',
                    'details': {
                        'reason': 'timeout_total',  # Puede ser: timeout_total, timeout_inactividad, timeout_por_gesto
                        'duration': round(session.duration, 1),
                        'gestures_captured': len(session.gesture_sequence_captured),
                        'gestures_required': 3,
                        'frames_processed': session.frames_processed,
                        'time_limit': self.config.total_timeout
                    },
                    'message': f'Tiempo máximo agotado ({self.config.total_timeout}s)',
                    'is_real': True
                }
            
            # PROCESAR FRAME RECIBIDO DEL FRONTEND
            success, message = self.pipeline.process_frame_for_real_authentication(session, frame_image)
            
            self.statistics['total_frames_processed'] += 1
            if success and (session.anatomical_features or session.dynamic_features):
                self.statistics['total_embeddings_generated'] += 1
            
            response = {
                'session_id': session_id,
                'status': session.status.value,
                'phase': session.current_phase.value,
                'progress': session.sequence_progress,
                'message': message,
                'frames_processed': session.frames_processed,
                'valid_captures': session.valid_captures,
                'duration': session.duration,
                'frame_processed': success,
                'is_real_processing': True,
                'no_simulation': True
            }

            # NUEVO: Incluir información del gesto detectado para captura secuencial
            if success:
                try:
                    # Obtener el último gesto procesado desde el pipeline
                    pipeline = self.pipeline
                    if hasattr(pipeline, 'last_processing_result') and pipeline.last_processing_result:
                        gesture_result = pipeline.last_processing_result.gesture_result
                        if gesture_result:
                            response['current_gesture'] = gesture_result.gesture_name
                            response['gesture_confidence'] = gesture_result.confidence
                        else:
                            response['current_gesture'] = 'None'
                            response['gesture_confidence'] = 0.0
                    else:
                        response['current_gesture'] = 'None'
                        response['gesture_confidence'] = 0.0
                except:
                    response['current_gesture'] = 'None'
                    response['gesture_confidence'] = 0.0
            else:
                response['current_gesture'] = 'None'
                response['gesture_confidence'] = 0.0
        
            # Si es verificación, incluir información de secuencia
            if session.mode == AuthenticationMode.VERIFICATION:
                response.update({
                    'required_sequence': session.required_sequence,
                    'captured_sequence': session.gesture_sequence_captured,
                    'sequence_complete': len(session.gesture_sequence_captured) >= len(session.required_sequence) if session.required_sequence else False
                })
            
            # Información de características capturadas
            response.update({
                'anatomical_features_captured': len(session.anatomical_features),
                'dynamic_features_captured': len(session.dynamic_features),
                'average_quality': np.mean(session.quality_scores) if session.quality_scores else 0.0,
                'average_confidence': np.mean(session.confidence_scores) if session.confidence_scores else 0.0,
                'has_embeddings': len(session.anatomical_features) > 0
            })
            
            # Verificar si podemos proceder al matching
            if session.current_phase == AuthenticationPhase.TEMPLATE_MATCHING:
                auth_result = self._perform_real_authentication_matching(session)
                
                # INCLUIR RESULTADO COMPLETO EN RESPONSE
                response['authentication_result'] = {
                    'success': auth_result.success,
                    'user_id': auth_result.user_id,
                    'matched_user_id': auth_result.matched_user_id,
                    'anatomical_score': auth_result.anatomical_score,
                    'dynamic_score': auth_result.dynamic_score,
                    'fused_score': auth_result.fused_score,
                    'confidence': auth_result.confidence,
                    'duration': auth_result.duration,
                    'feedback_token': session.feedback_token if hasattr(session, 'feedback_token') else None,
                    'is_real_result': True,
                    'is_locked': auth_result.is_locked if hasattr(auth_result, 'is_locked') else False,
                    'lockout_info': auth_result.lockout_info if hasattr(auth_result, 'lockout_info') else None
                }
                
                # Completar sesión
                final_status = AuthenticationStatus.AUTHENTICATED if auth_result.success else AuthenticationStatus.REJECTED

                # Determinar user_id según el modo
                final_user_id = session.user_id
                
                # Solo para IDENTIFICACIÓN: usar matched_user_id si está disponible
                if session.mode == AuthenticationMode.IDENTIFICATION:
                    if auth_result.matched_user_id:
                        final_user_id = auth_result.matched_user_id
                    else:
                        final_user_id = 'unknown'  # Fallback para identificación fallida
                # Para VERIFICACIÓN: final_user_id ya tiene session.user_id correcto
                
                # GUARDAR INTENTO DE AUTENTICACIÓN EN HISTORIAL
                attempt = AuthenticationAttempt(
                    attempt_id=str(uuid.uuid4()),
                    user_id=auth_result.user_id or auth_result.matched_user_id or "unknown",
                    timestamp=time.time(),
                    auth_type="verification" if session.mode == AuthenticationMode.VERIFICATION else "identification",
                    result="success" if auth_result.success else "failed",
                    confidence=auth_result.confidence,
                    anatomical_score=auth_result.anatomical_score,
                    dynamic_score=auth_result.dynamic_score,
                    fused_score=auth_result.fused_score,
                    ip_address=session.metadata.get('ip_address', 'unknown') if hasattr(session, 'metadata') else 'unknown',
                    device_info=str(session.metadata.get('device_info', '')) if hasattr(session, 'metadata') else '',
                    failure_reason=", ".join(auth_result.risk_factors) if not auth_result.success and auth_result.risk_factors else None,
                    metadata={
                        'session_id': session.session_id,
                        'security_level': session.security_level.value if hasattr(session, 'security_level') else 'standard',
                        'duration': auth_result.duration,
                        'frames_processed': auth_result.frames_processed,
                        'gestures_captured': auth_result.gestures_captured if hasattr(auth_result, 'gestures_captured') else []
                    }
                )

                # Guardar en base de datos
                self.database.store_authentication_attempt(attempt)
                logger.info(f"Intento de autenticación guardado: {attempt.attempt_id}")

                # ENVIAR RESULTADO AL PLUGIN (si tiene callback_url configurado)
                if session.callback_url and session.session_token:
                    try:
                        logger.info(f"📤 Enviando resultado de autenticación al Plugin")
                        logger.info(f"   Callback URL: {session.callback_url}")
                        
                        # Obtener email del usuario
                        user_email = None
                        if final_user_id and final_user_id != 'unknown':
                            user_profile = self.database.get_user(final_user_id)
                            if user_profile:
                                user_email = user_profile.email
                        
                        if user_email:
                            webhook_service = get_plugin_webhook_service()
                            webhook_service.set_api_key("sk_live_009f37683c1868404039fdf3d5c6e28b")
                            
                            success_webhook = webhook_service.send_authentication_result(
                                callback_url=session.callback_url,
                                user_id=final_user_id,
                                email=user_email,
                                session_token=session.session_token,
                                authenticated=auth_result.success,
                                confidence=auth_result.confidence
                            )
                            
                            if success_webhook:
                                logger.info(f"Resultado enviado exitosamente al Plugin")
                            else:
                                logger.warning(f"No se pudo enviar resultado al Plugin")
                        else:
                            logger.warning(f"No se pudo obtener email del usuario {final_user_id}")
                            
                    except Exception as e:
                        logger.error(f"Error enviando resultado al Plugin: {e}")
                        # No fallar la autenticación si falla el envío al Plugin
                        
                self._complete_real_authentication(session, final_status)

                # MARCAR COMO COMPLETADO
                response['session_completed'] = True
                response['final_status'] = final_status.value
                
                # LOG PARA CONFIRMAR
                logger.info(f"Resultado incluido en response - success={auth_result.success}")

            return response  # Retornar ANTES de que se cierre la sesión
                        
        except Exception as e:
            logger.error(f"Error procesando frame de autenticación REAL: {e}")
            return {
                'error': str(e),
                'is_real': True,
                'no_simulation': True
            }
    
    def _perform_real_authentication_matching(self, session: RealAuthenticationAttempt) -> RealAuthenticationResult:
        """Realiza el matching biométrico."""
        try:
            logger.info(f"Iniciando matching biométrico para sesión {session.session_id}")
            
            session.current_phase = AuthenticationPhase.SCORE_FUSION
            
            # Promediar características capturadas
            if not session.anatomical_features and not session.dynamic_features:
                raise Exception("No hay características capturadas para matching")
            
            avg_anatomical = None
            if session.anatomical_features:
                avg_anatomical = np.mean(session.anatomical_features, axis=0)
                logger.info(f"Promedio de {len(session.anatomical_features)} embeddings anatómicos calculado")
            
            avg_dynamic = None
            if session.dynamic_features:
                avg_dynamic = np.mean(session.dynamic_features, axis=0)
                logger.info(f"Promedio de {len(session.dynamic_features)} embeddings dinámicos calculado")
            
            session.current_phase = AuthenticationPhase.TEMPLATE_MATCHING
            
            # Realizar matching según el modo
            if session.mode == AuthenticationMode.VERIFICATION:
                result = self._perform_real_verification(session, avg_anatomical, avg_dynamic)
            else:
                result = self._perform_real_identification(session, avg_anatomical, avg_dynamic)
            
            session.current_phase = AuthenticationPhase.DECISION_MAKING
            
            # Aplicar umbral de seguridad
            threshold = self.config.security_thresholds[session.security_level.value]
            result.success = result.fused_score >= threshold
            
            logger.info(f"Matching biométrico completado:")
            logger.info(f"  - Score fusionado: {result.fused_score:.4f}")
            logger.info(f"  - Umbral requerido: {threshold:.4f}")
            logger.info(f"  - Resultado: {'AUTENTICADO' if result.success else 'RECHAZADO'}")
            
            # Auditoría
            if self.config.enable_audit_logging:
                audit_id = self.security_auditor.log_authentication_attempt(session)
                result.audit_log_id = audit_id
            
            # Actualizar estadísticas
            if result.success:
                self.statistics[f'{session.mode.value}_success'] += 1
            else:
                self.statistics[f'{session.mode.value}_errors'] += 1
            
            session.current_phase = AuthenticationPhase.COMPLETED
            
            # GUARDAR RESULTADO EN SESIÓN PARA FEEDBACK
            session.last_auth_result = result
            
            return result
            
        except Exception as e:
            logger.error(f"Error en matching: {e}")
            session.current_phase = AuthenticationPhase.FAILED
            
            return RealAuthenticationResult(
                attempt_id=session.attempt_id,
                success=False,
                user_id=session.user_id,
                confidence=0.0,
                security_level=session.security_level,
                authentication_mode=session.mode,
                duration=session.duration,
                frames_processed=session.frames_processed,
                gestures_captured=session.gesture_sequence_captured,
                risk_factors=[f"Error en matching: {str(e)}"]
            )
    
    def _perform_real_verification(self, session: RealAuthenticationAttempt, anatomical_emb: Optional[np.ndarray], dynamic_emb: Optional[np.ndarray]) -> RealAuthenticationResult:
        """Realiza verificación 1:1."""
        try:
            
            is_locked, remaining_minutes = self.database.check_if_locked(session.user_id)
            
            if is_locked:
                logger.warning(f"Intento de verificación bloqueado para usuario {session.user_id}")
                logger.warning(f"Tiempo restante de bloqueo: {remaining_minutes} minutos")
                
                user_profile = self.database.get_user(session.user_id)
                lockout_until_timestamp = user_profile.lockout_until if user_profile else None
                
                lockout_datetime = None
                if lockout_until_timestamp:
                    from datetime import datetime
                    lockout_datetime = datetime.fromtimestamp(lockout_until_timestamp).isoformat()
                
                return RealAuthenticationResult(
                    attempt_id=session.attempt_id,
                    success=False,
                    user_id=session.user_id,
                    anatomical_score=0.0,
                    dynamic_score=0.0,
                    fused_score=0.0,
                    confidence=0.0,
                    security_level=session.security_level,
                    authentication_mode=AuthenticationMode.VERIFICATION,
                    duration=session.duration,
                    frames_processed=session.frames_processed,
                    gestures_captured=session.gesture_sequence_captured,
                    average_quality=0.0,
                    average_confidence=0.0,
                    risk_factors=[f"Cuenta bloqueada por {remaining_minutes} minutos debido a múltiples intentos fallidos"],
                    is_locked=True,
                    lockout_info={
                        "remaining_minutes": remaining_minutes,
                        "locked_until": lockout_datetime,
                        "reason": "multiple_failed_attempts",
                        "max_attempts": settings.MAX_FAILED_ATTEMPTS
                    }
                )
            logger.info(f"Realizando verificación 1:1 para usuario {session.user_id}")
            
            # OBTENER TEMPLATES DEL USUARIO
            user_templates = self.database.list_user_templates(session.user_id)
            
            if not user_templates:
                logger.error(f"No hay templates para usuario {session.user_id}")
                return self._create_failed_auth_result(session, "No hay templates de referencia para el usuario")
            
            logger.info(f"Templates encontrados para usuario {session.user_id}: {len(user_templates)}")
            
            # OBTENER REFERENCIAS A REDES GLOBALES - CORRECCIÓN CRÍTICA
            anatomical_network = get_real_siamese_anatomical_network()
            dynamic_network = get_real_siamese_dynamic_network()
            
            logger.info(f"Referencias a redes obtenidas:")
            logger.info(f"  - Red anatómica disponible: {anatomical_network is not None}")
            logger.info(f"  - Red anatómica entrenada: {anatomical_network.is_trained if anatomical_network else False}")
            logger.info(f"  - Red anatómica base_network: {anatomical_network.base_network is not None if anatomical_network else False}")
            logger.info(f"  - Red dinámica disponible: {dynamic_network is not None}")
            logger.info(f"  - Red dinámica entrenada: {dynamic_network.is_trained if dynamic_network else False}")
            logger.info(f"  - Red dinámica base_network: {dynamic_network.base_network is not None if dynamic_network else False}")
            
            # SEPARAR TEMPLATES POR MODALIDAD
            anatomical_refs = []
            dynamic_refs = []
            templates_processed = 0
            
            for i, template in enumerate(user_templates):
                try:
                    logger.info(f"Procesando template {i+1}/{len(user_templates)}: {template.template_id[:30]}...")
                    
                    template_processed_by_any_method = False
                    
                    # MÉTODO 1: Templates con embeddings separados (formato nuevo)
                    if hasattr(template, 'anatomical_embedding') and template.anatomical_embedding is not None:
                        anatomical_refs.append(template.anatomical_embedding)
                        logger.info(f"  Embedding anatómico agregado (método 1)")
                        templates_processed += 1
                        template_processed_by_any_method = True
                        
                    if hasattr(template, 'dynamic_embedding') and template.dynamic_embedding is not None:
                        dynamic_refs.append(template.dynamic_embedding)
                        logger.info(f"  Embedding dinámico agregado (método 1)")
                        templates_processed += 1
                        template_processed_by_any_method = True
                    
                    # MÉTODO 2: Templates con template_data
                    if not template_processed_by_any_method and hasattr(template, 'template_data') and template.template_data is not None:
                        template_type = getattr(template, 'template_type', None)
                        
                        if template_type == TemplateType.ANATOMICAL:
                            anatomical_refs.append(template.template_data)
                            logger.info(f"  Template anatómico agregado (método 2)")
                            templates_processed += 1
                            template_processed_by_any_method = True
                            
                        elif template_type == TemplateType.DYNAMIC:
                            dynamic_refs.append(template.template_data)
                            logger.info(f"  Template dinámico agregado (método 2)")
                            templates_processed += 1
                            template_processed_by_any_method = True
                    
                    # MÉTODO 3: Templates Bootstrap - CONVERSIÓN CON MÉTODOS CORRECTOS
                    if not template_processed_by_any_method:
                        metadata = getattr(template, 'metadata', {})
                        bootstrap_mode = metadata.get('bootstrap_mode', False)
                        
                        if bootstrap_mode:
                            # SUB-MÉTODO 3A: Bootstrap Anatómico (bootstrap_features)
                            bootstrap_features = metadata.get('bootstrap_features', None)
                            if bootstrap_features:
                                logger.info(f"  Template Bootstrap anatómico detectado: {len(bootstrap_features)} características")
                                
                                try:
                                    if isinstance(bootstrap_features, list):
                                        bootstrap_features = np.array(bootstrap_features, dtype=np.float32)
                                    
                                    # CONVERSIÓN CON MÉTODO CORRECTO: base_network.predict()
                                    if (anatomical_network and 
                                        anatomical_network.is_trained and 
                                        anatomical_network.base_network is not None):
                                        
                                        features_array = bootstrap_features.reshape(1, -1)
                                        
                                        # Verificar dimensiones
                                        if features_array.shape[1] != anatomical_network.input_dim:
                                            logger.error(f"  Dimensión incorrecta: {features_array.shape[1]} != {anatomical_network.input_dim}")
                                            continue
                                        
                                        # Generar embedding usando red base entrenada
                                        bootstrap_embedding = anatomical_network.base_network.predict(features_array, verbose=0)[0]
                                        
                                        # Validar embedding generado
                                        if (bootstrap_embedding is not None and 
                                            not np.any(np.isnan(bootstrap_embedding)) and 
                                            not np.allclose(bootstrap_embedding, 0.0, atol=1e-6)):
                                            
                                            anatomical_refs.append(bootstrap_embedding)
                                            logger.info(f"  Bootstrap anatómico convertido a embedding (180→128 dim)")
                                            logger.info(f"      Embedding norm: {np.linalg.norm(bootstrap_embedding):.4f}")
                                            templates_processed += 1
                                            template_processed_by_any_method = True
                                        else:
                                            logger.error(f"  Embedding anatómico generado es inválido")
                                            logger.error(f"      Contains NaN: {np.any(np.isnan(bootstrap_embedding)) if bootstrap_embedding is not None else 'None'}")
                                            logger.error(f"      Is zero vector: {np.allclose(bootstrap_embedding, 0.0) if bootstrap_embedding is not None else 'None'}")
                                    else:
                                        logger.error(f"  Red anatómica no disponible para convertir Bootstrap")
                                        logger.error(f"      - Red disponible: {anatomical_network is not None}")
                                        logger.error(f"      - Red entrenada: {anatomical_network.is_trained if anatomical_network else False}")
                                        logger.error(f"      - Base network: {anatomical_network.base_network is not None if anatomical_network else False}")
                                        
                                except Exception as conv_error:
                                    logger.error(f"  Error convirtiendo Bootstrap anatómico: {conv_error}")
                                    import traceback
                                    logger.error(f"      Traceback: {traceback.format_exc()}")
                            
                            # SUB-MÉTODO 3B: Bootstrap Dinámico (temporal_sequence) - CORREGIDO
                            elif not template_processed_by_any_method:
                                temporal_sequence = metadata.get('temporal_sequence', None)
                                has_temporal_data = metadata.get('has_temporal_data', False)
                                
                                if temporal_sequence and has_temporal_data:
                                    logger.info(f"  Template Bootstrap dinámico detectado: secuencia temporal")
                                    
                                    try:
                                        if isinstance(temporal_sequence, list):
                                            temporal_sequence = np.array(temporal_sequence, dtype=np.float32)
                                        
                                        logger.info(f"      Secuencia shape: {temporal_sequence.shape}")
                                        
                                        # CONVERSIÓN CON TEMPORAL_SEQUENCE
                                        if (dynamic_network and 
                                            dynamic_network.is_trained and 
                                            dynamic_network.base_network is not None):
                                            
                                            # Usar temporal_sequence directamente (NO promediar)
                                            temporal_array = temporal_sequence
                                            feature_dim = getattr(dynamic_network, 'feature_dim', 320)
                                            sequence_length = getattr(dynamic_network, 'sequence_length', 50)
                                            
                                            # Ajustar longitud de secuencia
                                            if temporal_array.shape[0] > sequence_length:
                                                temporal_array = temporal_array[:sequence_length]
                                            elif temporal_array.shape[0] < sequence_length:
                                                padding = np.zeros((sequence_length - temporal_array.shape[0], temporal_array.shape[1]))
                                                temporal_array = np.vstack([temporal_array, padding])
                                            
                                            # Ajustar dimensión de features
                                            if temporal_array.shape[1] != feature_dim:
                                                if temporal_array.shape[1] > feature_dim:
                                                    temporal_array = temporal_array[:, :feature_dim]
                                                else:
                                                    padding = np.zeros((temporal_array.shape[0], feature_dim - temporal_array.shape[1]))
                                                    temporal_array = np.hstack([temporal_array, padding])
                                            
                                            sequence = temporal_array.reshape(1, sequence_length, feature_dim)
                                            
                                            logger.info(f"      Preparada secuencia para red: {sequence.shape}")
                                            
                                            # Generar embedding usando red base entrenada
                                            bootstrap_dynamic_embedding = dynamic_network.base_network.predict(sequence, verbose=0)[0]
                                            
                                            # Validar embedding generado
                                            if (bootstrap_dynamic_embedding is not None and 
                                                not np.any(np.isnan(bootstrap_dynamic_embedding)) and 
                                                not np.allclose(bootstrap_dynamic_embedding, 0.0, atol=1e-6)):
                                                
                                                dynamic_refs.append(bootstrap_dynamic_embedding)
                                                logger.info(f"  Bootstrap dinámico convertido a embedding")
                                                logger.info(f"      Embedding norm: {np.linalg.norm(bootstrap_dynamic_embedding):.4f}")
                                                templates_processed += 1
                                                template_processed_by_any_method = True
                                            else:
                                                logger.error(f"  Embedding dinámico generado es inválido")
                                                logger.error(f"      Contains NaN: {np.any(np.isnan(bootstrap_dynamic_embedding)) if bootstrap_dynamic_embedding is not None else 'None'}")
                                                logger.error(f"      Is zero vector: {np.allclose(bootstrap_dynamic_embedding, 0.0) if bootstrap_dynamic_embedding is not None else 'None'}")
                                        else:
                                            logger.error(f"  Red dinámica no disponible para convertir Bootstrap")
                                            logger.error(f"      - Red disponible: {dynamic_network is not None}")
                                            logger.error(f"      - Red entrenada: {dynamic_network.is_trained if dynamic_network else False}")
                                            logger.error(f"      - Base network: {dynamic_network.base_network is not None if dynamic_network else False}")
                                            
                                    except Exception as conv_error:
                                        logger.error(f"  Error convirtiendo Bootstrap dinámico: {conv_error}")
                                        import traceback
                                        logger.error(f"      Traceback: {traceback.format_exc()}")
                    
                    # MÉTODO 4: Fallback con modality
                    if (not template_processed_by_any_method and 
                        hasattr(template, 'template_data') and template.template_data is not None and
                        hasattr(template, 'modality')):
                        
                        if template.modality == 'anatomical':
                            anatomical_refs.append(template.template_data)
                            logger.info(f"  Template anatómico agregado (método 4 - modality)")
                            templates_processed += 1
                            template_processed_by_any_method = True
                            
                        elif template.modality == 'dynamic':
                            dynamic_refs.append(template.template_data)
                            logger.info(f"  Template dinámico agregado (método 4 - modality)")
                            templates_processed += 1
                            template_processed_by_any_method = True
                    
                    # REPORTE FINAL
                    if not template_processed_by_any_method:
                        logger.info(f"  Template sin datos utilizables")
                        
                except Exception as template_error:
                    logger.error(f"Error procesando template {i+1}: {template_error}")
                    import traceback
                    logger.error(f"   Traceback: {traceback.format_exc()}")
                    continue
            
            logger.info(f"RESUMEN DE PROCESAMIENTO:")
            logger.info(f"  Templates procesados: {templates_processed}/{len(user_templates)}")
            logger.info(f"  Referencias anatómicas: {len(anatomical_refs)}")
            logger.info(f"  Referencias dinámicas: {len(dynamic_refs)}")
            logger.info(f"  Total referencias: {len(anatomical_refs) + len(dynamic_refs)}")
            
            # VERIFICAR QUE TENEMOS TEMPLATES UTILIZABLES
            if not anatomical_refs and not dynamic_refs:
                logger.error("CRÍTICO: No se pudieron extraer embeddings de ningún template")
                logger.error("DEBUG: Verificar formato de templates en la base de datos")
                
                # Diagnóstico adicional
                if user_templates:
                    sample_template = user_templates[0]
                    logger.error(f"DEBUG: Ejemplo de template - Tipo: {type(sample_template)}")
                    logger.error(f"DEBUG: Atributos del template: {[attr for attr in dir(sample_template) if not attr.startswith('_')]}")
                    
                return self._create_failed_auth_result(session, "Error: No se pudieron procesar los templates del usuario")
            
            # CREAR SCORES INDIVIDUALES CORRECTOS
            individual_scores = RealIndividualScores(
                anatomical_score=0.0,
                dynamic_score=0.0,
                anatomical_confidence=0.0,
                dynamic_confidence=0.0,
                user_id=session.user_id,
                timestamp=time.time(),
                metadata={
                    'anatomical_refs_count': len(anatomical_refs),
                    'dynamic_refs_count': len(dynamic_refs),
                    'total_templates_found': len(user_templates),
                    'templates_processed': templates_processed,
                    'session_quality': np.mean(session.quality_scores) if session.quality_scores else 1.0,
                    'session_confidence': np.mean(session.confidence_scores) if session.confidence_scores else 1.0
                }
            )
            
            # CALCULAR SCORES ANATÓMICOS
            if anatomical_emb is not None and anatomical_refs:
                logger.info(f"Calculando similitudes anatómicas con {len(anatomical_refs)} referencias...")
                anatomical_similarities = []
                
                for j, ref_emb in enumerate(anatomical_refs):
                    try:
                        # Convertir a numpy si es necesario
                        if isinstance(ref_emb, list):
                            ref_emb = np.array(ref_emb, dtype=np.float32)
                        
                        # Verificar dimensionalidad antes de calcular similitud
                        if anatomical_emb.shape[0] != ref_emb.shape[0]:
                            logger.error(f"  Dimensiones incompatibles: consulta={anatomical_emb.shape[0]}, ref={ref_emb.shape[0]}")
                            continue
                        
                        # Verificar que no hay NaN o infinitos
                        if np.any(np.isnan(ref_emb)) or np.any(np.isinf(ref_emb)):
                            logger.error(f"  Template de referencia {j+1} contiene NaN o infinitos")
                            continue
                            
                        similarity = self._calculate_real_similarity(anatomical_emb, ref_emb)
                        anatomical_similarities.append(similarity)
                        logger.info(f"  Similitud anatómica {j+1}: {similarity:.4f}")
                    except Exception as sim_error:
                        logger.error(f"Error calculando similitud anatómica {j+1}: {sim_error}")
                        continue
                
                #if anatomical_similarities:
                    #individual_scores.anatomical_score = np.max(anatomical_similarities)
                    #individual_scores.anatomical_confidence = np.mean(anatomical_similarities)
                    #logger.info(f"Score anatómico FINAL: {individual_scores.anatomical_score:.4f}")
                    #logger.info(f"Confianza anatómica: {individual_scores.anatomical_confidence:.4f}")
                if anatomical_similarities:
                    # CAMBIO: De MAX a VOTING
                    individual_scores.anatomical_score = calculate_score_with_voting(
                        anatomical_similarities,
                        vote_threshold=0.85,
                        min_vote_ratio=0.5
                    )
                    individual_scores.anatomical_confidence = np.mean(anatomical_similarities)
                    logger.info(f"  Score anatómico FINAL: {individual_scores.anatomical_score:.4f}")
                    logger.info(f"  Confianza anatómica: {individual_scores.anatomical_confidence:.4f}")
                else:
                    logger.error("No se pudieron calcular similitudes anatómicas válidas")
            else:
                if anatomical_emb is None:
                    logger.info("No hay embedding anatómico de consulta")
                if not anatomical_refs:
                    logger.info("No hay referencias anatómicas")
            
            # CALCULAR SCORES DINÁMICOS
            if dynamic_emb is not None and dynamic_refs:
                logger.info(f"Calculando similitudes dinámicas con {len(dynamic_refs)} referencias...")
                dynamic_similarities = []
                
                for j, ref_emb in enumerate(dynamic_refs):
                    try:
                        # Convertir a numpy si es necesario
                        if isinstance(ref_emb, list):
                            ref_emb = np.array(ref_emb, dtype=np.float32)
                        
                        # Verificar dimensionalidad antes de calcular similitud
                        if dynamic_emb.shape[0] != ref_emb.shape[0]:
                            logger.error(f"  Dimensiones incompatibles: consulta={dynamic_emb.shape[0]}, ref={ref_emb.shape[0]}")
                            continue
                        
                        # Verificar que no hay NaN o infinitos
                        if np.any(np.isnan(ref_emb)) or np.any(np.isinf(ref_emb)):
                            logger.error(f"  Template de referencia {j+1} contiene NaN o infinitos")
                            continue
                            
                        similarity = self._calculate_real_similarity(dynamic_emb, ref_emb)
                        dynamic_similarities.append(similarity)
                        logger.info(f"  Similitud dinámica {j+1}: {similarity:.4f}")
                    except Exception as sim_error:
                        logger.error(f"Error calculando similitud dinámica {j+1}: {sim_error}")
                        continue
                
                #if dynamic_similarities:
                    #individual_scores.dynamic_score = np.max(dynamic_similarities)
                    #individual_scores.dynamic_confidence = np.mean(dynamic_similarities)
                    #logger.info(f"Score dinámico FINAL: {individual_scores.dynamic_score:.4f}")
                    #logger.info(f"Confianza dinámica: {individual_scores.dynamic_confidence:.4f}")
                if dynamic_similarities:
                    # CAMBIO: De MAX a VOTING
                    individual_scores.dynamic_score = calculate_score_with_voting(
                        dynamic_similarities,
                        vote_threshold=0.85,
                        min_vote_ratio=0.5
                    )
                    individual_scores.dynamic_confidence = np.mean(dynamic_similarities)
                    logger.info(f"  Score dinámico FINAL: {individual_scores.dynamic_score:.4f}")
                    logger.info(f"  Confianza dinámica: {individual_scores.dynamic_confidence:.4f}")
                else:
                    logger.error("No se pudieron calcular similitudes dinámicas válidas")
            else:
                if dynamic_emb is None:
                    logger.info("No hay embedding dinámico de consulta")
                if not dynamic_refs:
                    logger.info("No hay referencias dinámicas")
            
            # FUSIÓN DE SCORES
            logger.info("🔗 Iniciando fusión de scores...")
            fused_score = self.fusion_system.fuse_real_scores(individual_scores)
            logger.info(f"Score fusionado: {fused_score.fused_score:.4f}")
            logger.info(f"Confianza fusionada: {fused_score.confidence:.4f}")
            
            # return RealAuthenticationResult(
            #     attempt_id=session.attempt_id,
            #     success=False,  # Se determinará por umbral en matching
            #     user_id=session.user_id,
            #     anatomical_score=individual_scores.anatomical_score,
            #     dynamic_score=individual_scores.dynamic_score,
            #     fused_score=fused_score.fused_score,
            #     confidence=fused_score.confidence,
            #     security_level=session.security_level,
            #     authentication_mode=AuthenticationMode.VERIFICATION,
            #     duration=session.duration,
            #     frames_processed=session.frames_processed,
            #     gestures_captured=session.gesture_sequence_captured,
            #     average_quality=np.mean(session.quality_scores) if session.quality_scores else 0.0,
            #     average_confidence=np.mean(session.confidence_scores) if session.confidence_scores else 0.0
            # )
            
            verification_threshold = 0.75
            verification_success = fused_score.fused_score >= verification_threshold
            
            result = RealAuthenticationResult(
                attempt_id=session.attempt_id,
                success=verification_success,
                user_id=session.user_id,
                anatomical_score=individual_scores.anatomical_score,
                dynamic_score=individual_scores.dynamic_score,
                fused_score=fused_score.fused_score,
                confidence=fused_score.confidence,
                security_level=session.security_level,
                authentication_mode=AuthenticationMode.VERIFICATION,
                duration=session.duration,
                frames_processed=session.frames_processed,
                gestures_captured=session.gesture_sequence_captured,
                average_quality=np.mean(session.quality_scores) if session.quality_scores else 0.0,
                average_confidence=np.mean(session.confidence_scores) if session.confidence_scores else 0.0,
                risk_factors=[]
            )
            
            if verification_success:
                self.database.reset_failed_attempts(session.user_id)
                logger.info(f"Contador de intentos fallidos reseteado para {session.user_id}")
            else:
                if settings.ENABLE_LOCKOUT:
                    new_count = self.database.record_failed_attempt(session.user_id)
                    logger.warning(f"Intento fallido registrado. Total: {new_count}/{settings.MAX_FAILED_ATTEMPTS}")
                    
                    if new_count >= settings.MAX_FAILED_ATTEMPTS:
                        lockout_until = self.database.lock_account(
                            session.user_id,
                            settings.LOCKOUT_DURATION_MINUTES
                        )
                        
                        logger.error(f"Cuenta {session.user_id} bloqueada por {settings.LOCKOUT_DURATION_MINUTES} minutos")
                        
                        result.risk_factors.append(f"Cuenta bloqueada por {settings.LOCKOUT_DURATION_MINUTES} minutos")
                        
                        # ACTUALIZAR RESULTADO CON INFORMACIÓN DE BLOQUEO
                        from datetime import datetime
                        lockout_datetime = datetime.fromtimestamp(lockout_until).isoformat()
                        result.is_locked = True
                        result.lockout_info = {
                            "remaining_minutes": settings.LOCKOUT_DURATION_MINUTES,
                            "locked_until": lockout_datetime,
                            "reason": "multiple_failed_attempts",
                            "max_attempts": settings.MAX_FAILED_ATTEMPTS
                        }
                        
                        if settings.ENABLE_LOCKOUT_EMAIL:
                            try:
                                user_profile = self.database.get_user(session.user_id)
                                if user_profile and hasattr(user_profile, 'email') and user_profile.email:
                                    email_sent = send_lockout_alert_email(
                                        user_id=session.user_id,
                                        username=user_profile.username,
                                        user_email=user_profile.email,
                                        failed_attempts=new_count,
                                        lockout_until=lockout_until,
                                        duration_minutes=settings.LOCKOUT_DURATION_MINUTES
                                    )
                                    if email_sent:
                                        logger.info(f"Email de alerta enviado a {user_profile.email}")
                                    else:
                                        logger.warning(f"No se pudo enviar email de alerta a {user_profile.email}")
                                else:
                                    logger.warning(f"Usuario {session.user_id} no tiene email configurado")
                            except Exception as email_error:
                                logger.error(f"Error enviando email de alerta: {email_error}")
                    else:
                        attempts_remaining = settings.MAX_FAILED_ATTEMPTS - new_count
                        result.risk_factors.append(f"Intentos restantes: {attempts_remaining}")
                        logger.warning(f"Intentos restantes: {attempts_remaining}")
            
            return result
            
        except Exception as e:
            logger.error(f"ERROR CRÍTICO en verificación: {e}")
            import traceback
            logger.error(f"Traceback completo: {traceback.format_exc()}")
            return self._create_failed_auth_result(session, f"Error crítico en verificación: {str(e)}")

    
    def _create_failed_auth_result(self, session: RealAuthenticationAttempt, reason: str) -> RealAuthenticationResult:
        """Crea un resultado de autenticación fallido con información detallada."""
        return RealAuthenticationResult(
            attempt_id=session.attempt_id,
            success=False,
            user_id=session.user_id,
            anatomical_score=0.0,
            dynamic_score=0.0,
            fused_score=0.0,
            confidence=0.0,
            security_level=session.security_level,
            authentication_mode=AuthenticationMode.VERIFICATION,
            duration=session.duration,
            frames_processed=session.frames_processed,
            gestures_captured=session.gesture_sequence_captured,
            average_quality=0.0,
            average_confidence=0.0,
            risk_factors=[reason]
        )
        
    def _perform_real_identification(self, session: RealAuthenticationAttempt,
                               anatomical_emb: Optional[np.ndarray],
                               dynamic_emb: Optional[np.ndarray]) -> RealAuthenticationResult:
        """
        Identificación 1:N con filtrado por secuencia + verificación 1:1.
        
        Flujo:
        1. Captura secuencia de gestos del usuario
        2. FILTRADO: Busca usuarios con esa misma secuencia
        3. VERIFICACIÓN 1:1: Solo contra candidatos filtrados
        4. Selecciona mejor score que supere umbral
        """
        try:
            logger.info(f"╔══════════════════════════════════════════════════════════════╗")
            logger.info(f"║         INICIANDO IDENTIFICACIÓN 1:N CON FILTRADO           ║")
            logger.info(f"╚══════════════════════════════════════════════════════════════╝")
            
            # ========================================================================
            # PASO 1: OBTENER SECUENCIA DE GESTOS CAPTURADA
            # ========================================================================
            captured_sequence = getattr(session, 'gesture_sequence_captured', [])
            
            logger.info(f"")
            logger.info(f"PASO 1: SECUENCIA CAPTURADA")
            logger.info(f"   Gestos detectados: {captured_sequence}")
            logger.info(f"   Total gestos: {len(captured_sequence)}")
            
            # Validar que tenemos secuencia completa
            if not captured_sequence or len(captured_sequence) < 3:
                logger.error(f"Secuencia incompleta: se necesitan 3 gestos, solo hay {len(captured_sequence)}")
                return RealAuthenticationResult(
                    attempt_id=getattr(session, 'attempt_id', str(uuid.uuid4())),
                    success=False,
                    user_id=None,
                    matched_user_id=None,
                    anatomical_score=0.0,
                    dynamic_score=0.0,
                    fused_score=0.0,
                    confidence=0.0,
                    security_level=getattr(session, 'security_level', 'standard'),
                    authentication_mode='identification',
                    duration=getattr(session, 'duration', 0.0),
                    frames_processed=getattr(session, 'frames_processed', 0),
                    gestures_captured=captured_sequence,
                    average_quality=0.0,
                    average_confidence=0.0,
                    risk_factors=["Secuencia incompleta"]
                )
            
            # Tomar solo los primeros 3 gestos (por si hay más)
            target_sequence = captured_sequence[:3]
            logger.info(f"   Secuencia objetivo (3 gestos): {target_sequence}")
            
            # ========================================================================
            # PASO 2: FILTRADO POR SECUENCIA (CRÍTICO)
            # ========================================================================
            logger.info(f"")
            logger.info(f"╔══════════════════════════════════════════════════════════════╗")
            logger.info(f"║              PASO 2: FILTRADO POR SECUENCIA                 ║")
            logger.info(f"╚══════════════════════════════════════════════════════════════╝")
            
            matching_users = self._find_users_with_sequence(target_sequence)
            
            if not matching_users:
                logger.info(f"")
                logger.info(f"IDENTIFICACIÓN FALLIDA: FILTRADO POR SECUENCIA")
                logger.info(f"   Secuencia buscada: {target_sequence}")
                logger.info(f"   Resultado: Ningún usuario tiene esa secuencia registrada")
                logger.info(f"   Decisión: NO IDENTIFICADO")
                
                return RealAuthenticationResult(
                    attempt_id=getattr(session, 'attempt_id', str(uuid.uuid4())),
                    success=False,
                    user_id=None,
                    matched_user_id=None,
                    anatomical_score=0.0,
                    dynamic_score=0.0,
                    fused_score=0.0,
                    confidence=0.0,
                    security_level=getattr(session, 'security_level', 'standard'),
                    authentication_mode='identification',
                    duration=getattr(session, 'duration', 0.0),
                    frames_processed=getattr(session, 'frames_processed', 0),
                    gestures_captured=target_sequence,
                    average_quality=0.0,
                    average_confidence=0.0,
                    risk_factors=["No hay usuarios con esa secuencia"]
                )
            
            logger.info(f"")
            logger.info(f"FILTRADO COMPLETADO: {len(matching_users)} CANDIDATO(S) ENCONTRADO(S)")
            for idx, user in enumerate(matching_users, 1):
                logger.info(f"   {idx}. {user['user_id']} ({user['username']}) - Secuencia: {user['sequence']}")
            
            # ========================================================================
            # PASO 3: VERIFICACIÓN 1:1 CON CADA CANDIDATO
            # ========================================================================
            logger.info(f"")
            logger.info(f"╔══════════════════════════════════════════════════════════════╗")
            logger.info(f"║          PASO 3: VERIFICACIÓN 1:1 POR CANDIDATO            ║")
            logger.info(f"╚══════════════════════════════════════════════════════════════╝")
            
            # Obtener umbral de verificación
            try:
                if hasattr(self.config, 'security_thresholds'):
                    verification_threshold = self.config.security_thresholds.get(
                        session.security_level.value if hasattr(session, 'security_level') else 'standard',
                        0.75
                    )
                else:
                    verification_threshold = 0.75
            except Exception:
                verification_threshold = 0.75
            
            logger.info(f"   Umbral de verificación: {verification_threshold:.4f}")
            logger.info(f"   Total candidatos a verificar: {len(matching_users)}")
            
            best_verification_result = None
            best_score = 0.0
            best_user_id = None
            
            # Verificar cada candidato
            for idx, user_data in enumerate(matching_users, 1):
                user_id = user_data['user_id']
                username = user_data['username']
                
                logger.info(f"")
                logger.info(f"═══════════════════════════════════════════════════════════════")
                logger.info(f"CANDIDATO {idx}/{len(matching_users)}: {user_id} ({username})")
                logger.info(f"═══════════════════════════════════════════════════════════════")
                
                try:
                    # Crear sesión temporal para verificación 1:1
                    import copy
                    temp_session = copy.deepcopy(session)
                    temp_session.user_id = user_id
                    temp_session.mode = AuthenticationMode.VERIFICATION
                    
                    logger.info(f"   Llamando a verificación 1:1...")
                    
                    # LLAMAR AL SISTEMA DE VERIFICACIÓN YA IMPLEMENTADO
                    verification_result = self._perform_real_verification(
                        session=temp_session,
                        anatomical_emb=anatomical_emb,
                        dynamic_emb=dynamic_emb
                    )
                    
                    # Verificar si el score supera el umbral
                    is_verified = verification_result.fused_score >= verification_threshold
                    
                    logger.info(f"")
                    logger.info(f"   RESULTADOS DE VERIFICACIÓN:")
                    logger.info(f"      Score anatómico: {verification_result.anatomical_score:.4f}")
                    logger.info(f"      Score dinámico: {verification_result.dynamic_score:.4f}")
                    logger.info(f"      Score fusionado: {verification_result.fused_score:.4f}")
                    logger.info(f"      Confianza: {verification_result.confidence:.4f}")
                    logger.info(f"      Umbral requerido: {verification_threshold:.4f}")
                    logger.info(f"      Decisión: {'VERIFICADO' if is_verified else 'RECHAZADO'}")
                    
                    # Actualizar mejor resultado si aplica
                    if is_verified and verification_result.fused_score > best_score:
                        best_verification_result = verification_result
                        best_score = verification_result.fused_score
                        best_user_id = user_id
                        logger.info(f"      MEJOR CANDIDATO ACTUALIZADO")
                        logger.info(f"         Nuevo mejor score: {best_score:.4f}")
                    
                except Exception as candidate_error:
                    logger.error(f"   Error verificando candidato {user_id}: {candidate_error}")
                    import traceback
                    logger.error(f"   Traceback: {traceback.format_exc()}")
                    continue
            
            # ========================================================================
            # PASO 4: DECISIÓN FINAL
            # ========================================================================
            logger.info(f"")
            logger.info(f"╔══════════════════════════════════════════════════════════════╗")
            logger.info(f"║                   PASO 4: DECISIÓN FINAL                    ║")
            logger.info(f"╚══════════════════════════════════════════════════════════════╝")
            
            logger.info(f"")
            logger.info(f"RESUMEN DE VERIFICACIONES:")
            logger.info(f"   Total candidatos procesados: {len(matching_users)}")
            logger.info(f"   Mejor resultado: {best_user_id if best_verification_result else 'NINGUNO'}")
            if best_verification_result:
                logger.info(f"   Mejor score: {best_score:.4f}")
                logger.info(f"   Umbral requerido: {verification_threshold:.4f}")
            
            # Verificar si tenemos un candidato exitoso
            if best_verification_result and best_user_id and best_score >= verification_threshold:
                # Buscar datos del usuario para el resultado
                matched_user_data = next((u for u in matching_users if u['user_id'] == best_user_id), None)
                matched_username = matched_user_data['username'] if matched_user_data else 'Sin nombre'
                
                logger.info(f"")
                logger.info(f"╔══════════════════════════════════════════════════════════════╗")
                logger.info(f"║              IDENTIFICACIÓN EXITOSA                      ║")
                logger.info(f"╚══════════════════════════════════════════════════════════════╝")
                logger.info(f"")
                logger.info(f"🎉 Usuario identificado: {best_user_id} ({matched_username})")
                logger.info(f"   Score anatómico: {best_verification_result.anatomical_score:.4f}")
                logger.info(f"   Score dinámico: {best_verification_result.dynamic_score:.4f}")
                logger.info(f"   Score fusionado: {best_score:.4f}")
                logger.info(f"   Confianza: {best_verification_result.confidence:.4f}")
                logger.info(f"   Secuencia coincidente: {target_sequence}")
                logger.info(f"   Método: Filtrado por secuencia + Verificación biométrica")
                
                return RealAuthenticationResult(
                    attempt_id=getattr(session, 'attempt_id', str(uuid.uuid4())),
                    success=True,
                    user_id=None,
                    matched_user_id=best_user_id,
                    anatomical_score=best_verification_result.anatomical_score,
                    dynamic_score=best_verification_result.dynamic_score,
                    fused_score=best_score,
                    confidence=best_verification_result.confidence,
                    security_level=getattr(session, 'security_level', 'standard'),
                    authentication_mode='identification',
                    duration=getattr(session, 'duration', 0.0),
                    frames_processed=getattr(session, 'frames_processed', 0),
                    gestures_captured=target_sequence,
                    average_quality=np.mean(session.quality_scores) if hasattr(session, 'quality_scores') and session.quality_scores else 0.0,
                    average_confidence=np.mean(session.confidence_scores) if hasattr(session, 'confidence_scores') and session.confidence_scores else 0.0,
                    # metadata={
                    #     'sequence_matched': True,
                    #     'captured_sequence': target_sequence,
                    #     'is_real_biometric_match': True,
                    #     'verification_based': True,
                    #     'total_candidates_filtered': len(matching_users),
                    #     'matched_username': matched_username
                    # }
                )
            else:
                logger.info(f"")
                logger.info(f"╔══════════════════════════════════════════════════════════════╗")
                logger.info(f"║              IDENTIFICACIÓN FALLIDA                      ║")
                logger.info(f"╚══════════════════════════════════════════════════════════════╝")
                logger.info(f"")
                logger.info(f"   Razón: Ningún candidato pasó la verificación biométrica")
                logger.info(f"   Candidatos evaluados: {len(matching_users)}")
                logger.info(f"   Mejor score obtenido: {best_score:.4f}")
                logger.info(f"   Umbral requerido: {verification_threshold:.4f}")
                logger.info(f"   Secuencia: {target_sequence}")
                
                return RealAuthenticationResult(
                    attempt_id=getattr(session, 'attempt_id', str(uuid.uuid4())),
                    success=False,
                    user_id=None,
                    matched_user_id=None,
                    anatomical_score=best_verification_result.anatomical_score if best_verification_result else 0.0,
                    dynamic_score=best_verification_result.dynamic_score if best_verification_result else 0.0,
                    fused_score=best_score,
                    confidence=best_verification_result.confidence if best_verification_result else 0.0,
                    security_level=getattr(session, 'security_level', 'standard'),
                    authentication_mode='identification',
                    duration=getattr(session, 'duration', 0.0),
                    frames_processed=getattr(session, 'frames_processed', 0),
                    gestures_captured=target_sequence,
                    average_quality=np.mean(session.quality_scores) if hasattr(session, 'quality_scores') and session.quality_scores else 0.0,
                    average_confidence=np.mean(session.confidence_scores) if hasattr(session, 'confidence_scores') and session.confidence_scores else 0.0,
                    risk_factors=["Score insuficiente para identificación"],
                )
                
        except Exception as e:
            logger.error(f"")
            logger.error(f"╔══════════════════════════════════════════════════════════════╗")
            logger.error(f"║           ERROR CRÍTICO EN IDENTIFICACIÓN                ║")
            logger.error(f"╚══════════════════════════════════════════════════════════════╝")
            logger.error(f"")
            logger.error(f"Error: {e}")
            import traceback
            logger.error(f"Traceback completo:")
            logger.error(traceback.format_exc())
            
            return RealAuthenticationResult(
                attempt_id=getattr(session, 'attempt_id', str(uuid.uuid4())),
                success=False,
                user_id=None,
                matched_user_id=None,
                anatomical_score=0.0,
                dynamic_score=0.0,
                fused_score=0.0,
                confidence=0.0,
                security_level=getattr(session, 'security_level', 'standard'),
                authentication_mode='identification',
                duration=0.0,
                frames_processed=0,
                gestures_captured=getattr(session, 'gesture_sequence_captured', [])[:3],
                average_quality=0.0,
                average_confidence=0.0,
                risk_factors=[f"Error crítico: {str(e)}"]
            )


    def _find_users_with_sequence(self, target_sequence: List[str]) -> List[Dict[str, Any]]:
        """
        Busca usuarios que tengan exactamente la secuencia de gestos especificada.
        
        Args:
            target_sequence: Lista de 3 gestos (ej: ["Victory", "Thumb_Up", "Open_Palm"])
            
        Returns:
            Lista de diccionarios con user_id, username, sequence de usuarios coincidentes
        """
        try:
            logger.info(f"Buscando usuarios con secuencia: {target_sequence}")
            
            matching_users = []
            
            # Obtener todos los usuarios de la base de datos
            all_users = self.database.list_users()
            
            logger.info(f"   Total usuarios en base de datos: {len(all_users)}")
            logger.info(f"")
            
            # Buscar coincidencias
            for user_profile in all_users:
                try:
                    # Obtener secuencia del usuario
                    user_sequence = getattr(user_profile, 'gesture_sequence', None)
                    
                    if user_sequence and isinstance(user_sequence, list) and len(user_sequence) == 3:
                        logger.info(f"   Usuario {user_profile.user_id}:")
                        logger.info(f"      Secuencia: {user_sequence}")
                        
                        # COMPARACIÓN EXACTA
                        if user_sequence == target_sequence:
                            matching_users.append({
                                'user_id': user_profile.user_id,
                                'username': getattr(user_profile, 'username', user_profile.user_id),
                                'sequence': user_sequence
                            })
                            logger.info(f"      COINCIDENCIA ENCONTRADA")
                        else:
                            logger.info(f"      No coincide")
                    else:
                        logger.info(f"   Usuario {user_profile.user_id}: Sin secuencia válida (tiene {len(user_sequence) if user_sequence else 0} gestos)")
                        
                except Exception as user_error:
                    logger.warning(f"   Error procesando usuario {getattr(user_profile, 'user_id', 'unknown')}: {user_error}")
                    continue
            
            logger.info(f"")
            logger.info(f"RESULTADO DE BÚSQUEDA:")
            logger.info(f"   Usuarios totales: {len(all_users)}")
            logger.info(f"   Coincidencias encontradas: {len(matching_users)}")
            
            return matching_users
            
        except Exception as e:
            logger.error(f"Error buscando usuarios con secuencia: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []
    
            
        
    def _calculate_real_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Calcula similitud entre dos embeddings."""
        try:
            if embedding1 is None or embedding2 is None:
                return 0.0
            
            # Normalizar vectores
            norm1 = np.linalg.norm(embedding1)
            norm2 = np.linalg.norm(embedding2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            embedding1_norm = embedding1 / norm1
            embedding2_norm = embedding2 / norm2
            
            # Similitud coseno
            cosine_similarity = np.dot(embedding1_norm, embedding2_norm)
            
            # Convertir a rango [0, 1]
            similarity = (cosine_similarity + 1) / 2
            
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error calculando similitud: {e}")
            return 0.0
    
    # def _complete_real_authentication(self, session: RealAuthenticationAttempt, final_status: AuthenticationStatus):
    #     """Completa sesión de autenticación."""
    #     try:
    #         logger.info(f"Completando autenticación: {session.session_id} - Estado: {final_status.value}")
            
    #         # Cerrar sesión
    #         self.session_manager.close_real_session(session.session_id, final_status)
            
    #         # Actualizar estadísticas finales
    #         if final_status == AuthenticationStatus.AUTHENTICATED:
    #             logger.info(f"Autenticación exitosa - Usuario: {session.user_id or 'identificación'}")
    #         else:
    #             logger.info(f"Autenticación fallida - Razón: {final_status.value}")
            
    #     except Exception as e:
    #         logger.error(f"Error completando autenticación: {e}")
    
    def _complete_real_authentication(self, session: RealAuthenticationAttempt, final_status: AuthenticationStatus):
        """Completa el proceso de autenticación."""
        try:
            logger.info(f"Completando autenticación: {session.session_id} - Estado: {final_status.value}")
            
            # Cerrar sesión
            self.session_manager.close_real_session(session.session_id, final_status)
            
            # Actualizar estadísticas finales
            if final_status == AuthenticationStatus.AUTHENTICATED:
                logger.info(f"Autenticación exitosa - Usuario: {session.user_id or 'identificación'}")
            else:
                logger.info(f"Autenticación fallida - Razón: {final_status.value}")
            
            # # GUARDAR INTENTO EN SUPABASE PARA MÉTRICAS
            # if final_status in [AuthenticationStatus.AUTHENTICATED, AuthenticationStatus.REJECTED]:
            #     try:
            #         system_decision = 'authenticated' if final_status == AuthenticationStatus.AUTHENTICATED else 'rejected'
                    
            #         # OBTENER EMAIL Y USERNAME DEL USUARIO
            #         user_profile = self.database.get_user(session.user_id)
            #         user_email = user_profile.email if user_profile else "unknown@example.com"
            #         username = user_profile.username if user_profile else session.user_id
                    
            #         # EXTRAER SCORES DEL RESULTADO DE AUTENTICACIÓN
            #         anatomical_score = 0.0
            #         dynamic_score = 0.0
            #         fused_score = 0.0
            #         confidence = 0.0
            #         gestures_captured = []
                    
            #         if hasattr(session, 'last_auth_result') and session.last_auth_result:
            #             anatomical_score = session.last_auth_result.anatomical_score
            #             dynamic_score = session.last_auth_result.dynamic_score
            #             fused_score = session.last_auth_result.fused_score
            #             confidence = session.last_auth_result.confidence
            #             gestures_captured = session.last_auth_result.gestures_captured
            #         elif hasattr(session, 'final_score'):
            #             fused_score = session.final_score
            #             confidence = session.final_score
                    
            #         # Gestos de la sesión si no están en el resultado
            #         if not gestures_captured and hasattr(session, 'gesture_sequence_captured'):
            #             gestures_captured = session.gesture_sequence_captured
                        
            #         feedback_data = self.feedback_service.save_authentication_attempt(
            #             session_id=session.attempt_id,
            #             user_id=session.user_id,
            #             username=username,  # Username real
            #             mode='verification' if session.mode == AuthenticationMode.VERIFICATION else 'identification',
            #             system_decision=system_decision,
            #             confidence=confidence,
            #             ip_address=session.ip_address,
            #             duration=session.duration,
            #             user_email=user_email,
            #             anatomical_score=anatomical_score,
            #             dynamic_score=dynamic_score,
            #             fused_score=fused_score,
            #             gestures_captured=gestures_captured
            #         )
                    
            #         # Guardar token de feedback en la sesión
            #         session.feedback_token = feedback_data['feedback_token']
                    
            #         logger.info(f"Intento guardado en Supabase - Token: {feedback_data['feedback_token']}")
                    
            #     except Exception as e:
            #         logger.error(f"Error guardando intento en Supabase: {e}")
            #         # No fallar la autenticación si falla el guardado
            # GUARDAR INTENTO EN SUPABASE PARA MÉTRICAS
            if final_status in [AuthenticationStatus.AUTHENTICATED, AuthenticationStatus.REJECTED]:
                try:
                    system_decision = 'authenticated' if final_status == AuthenticationStatus.AUTHENTICATED else 'rejected'
                    
                    # EXTRAER SCORES DEL RESULTADO DE AUTENTICACIÓN
                    anatomical_score = 0.0
                    dynamic_score = 0.0
                    fused_score = 0.0
                    confidence = 0.0
                    gestures_captured = []
                    all_candidates = []
                    top_match_score = None
                    
                    if hasattr(session, 'last_auth_result') and session.last_auth_result:
                        anatomical_score = session.last_auth_result.anatomical_score
                        dynamic_score = session.last_auth_result.dynamic_score
                        fused_score = session.last_auth_result.fused_score
                        confidence = session.last_auth_result.confidence
                        gestures_captured = session.last_auth_result.gestures_captured
                        
                        # Datos específicos de identificación
                        if hasattr(session.last_auth_result, 'all_candidates'):
                            all_candidates = session.last_auth_result.all_candidates
                        if hasattr(session.last_auth_result, 'top_match_score'):
                            top_match_score = session.last_auth_result.top_match_score
                    
                    elif hasattr(session, 'final_score'):
                        fused_score = session.final_score
                        confidence = session.final_score
                    
                    if not gestures_captured and hasattr(session, 'gesture_sequence_captured'):
                        gestures_captured = session.gesture_sequence_captured
                    
                    # USAR SERVICIO CORRECTO SEGÚN MODO
                    if session.mode == AuthenticationMode.VERIFICATION:
                        # ========================================
                        # VERIFICACIÓN 1:1 → authentication_attempts
                        # ========================================
                        user_profile = self.database.get_user(session.user_id)
                        user_email = user_profile.email if user_profile else "unknown@example.com"
                        username = user_profile.username if user_profile else session.user_id
                        
                        logger.info(f"Guardando VERIFICACIÓN: user={session.user_id}, decision={system_decision}")
                        
                        feedback_data = self.feedback_service.save_authentication_attempt(
                            session_id=session.attempt_id,
                            user_id=session.user_id,
                            username=username,
                            mode='verification',
                            system_decision=system_decision,
                            confidence=confidence,
                            ip_address=session.ip_address,
                            duration=session.duration,
                            user_email=user_email,
                            anatomical_score=anatomical_score,
                            dynamic_score=dynamic_score,
                            fused_score=fused_score,
                            gestures_captured=gestures_captured
                        )
                        
                        if feedback_data and 'feedback_token' in feedback_data:
                            session.feedback_token = feedback_data['feedback_token']
                            logger.info(f"Verificación guardada con feedback_token: {feedback_data['feedback_token']}")
                    
                    elif session.mode == AuthenticationMode.IDENTIFICATION:
                        # ========================================
                        # IDENTIFICACIÓN 1:N → identification_attempts
                        # ========================================
                        identified_user_id = None
                        username = None
                        user_email = None
                        
                        # Obtener datos del usuario identificado (si existe)
                        if hasattr(session, 'last_auth_result') and session.last_auth_result:
                            if hasattr(session.last_auth_result, 'matched_user_id') and session.last_auth_result.matched_user_id:
                                identified_user_id = session.last_auth_result.matched_user_id
                                user_profile = self.database.get_user(identified_user_id)
                                if user_profile:
                                    username = user_profile.username
                                    user_email = user_profile.email
                        
                        logger.info(f"Guardando IDENTIFICACIÓN: user={identified_user_id or 'unknown'}, decision={system_decision}")
                        
                        identification_data = self.identification_service.save_identification_attempt(
                            session_id=session.attempt_id,
                            identified_user_id=identified_user_id,
                            username=username,
                            user_email=user_email,
                            system_decision=system_decision,
                            confidence=confidence,
                            anatomical_score=anatomical_score,
                            dynamic_score=dynamic_score,
                            fused_score=fused_score,
                            all_candidates=all_candidates,
                            top_match_score=top_match_score,
                            gestures_captured=gestures_captured,
                            ip_address=session.ip_address,
                            duration=session.duration
                        )
                        
                        if identification_data:
                            logger.info(f"Identificación guardada: {identification_data['session_id']}")
                    
                except Exception as e:
                    logger.error(f"Error guardando intento de autenticación: {str(e)}")
            
            
        except Exception as e:
            logger.error(f"Error completando autenticación: {e}")
        
    def get_real_authentication_status(self, session_id: str) -> Dict[str, Any]:
        """Obtiene estado detallado de una sesión de autenticación."""
        try:
            session = self.session_manager.get_real_session(session_id)
            if not session:
                return {
                    'error': 'Sesión no encontrada',
                    'is_real': True
                }
            
            return {
                'session_id': session_id,
                'attempt_id': session.attempt_id,
                'mode': session.mode.value,
                'user_id': session.user_id,
                'status': session.status.value,
                'phase': session.current_phase.value,
                'security_level': session.security_level.value,
                'duration': session.duration,
                'progress': session.sequence_progress,
                'frames_processed': session.frames_processed,
                'required_sequence': session.required_sequence,
                'captured_sequence': session.gesture_sequence_captured,
                'anatomical_features_count': len(session.anatomical_features),
                'dynamic_features_count': len(session.dynamic_features),
                'average_quality': np.mean(session.quality_scores) if session.quality_scores else 0.0,
                'average_confidence': np.mean(session.confidence_scores) if session.confidence_scores else 0.0,
                'is_real_session': True,
                'no_simulation': True
            }
            
        except Exception as e:
            logger.error(f"Error obteniendo estado de autenticación: {e}")
            return {
                'error': str(e),
                'is_real': True
            }
    
    def cancel_real_authentication(self, session_id: str) -> bool:
        """Cancela una sesión de autenticación."""
        try:
            session = self.session_manager.get_real_session(session_id)
            if not session:
                logger.error(f"Sesión {session_id} no encontrada para cancelar")
                return False
            
            self.session_manager.close_real_session(session_id, AuthenticationStatus.CANCELLED)
            
            logger.info(f"Sesión de autenticación {session_id} cancelada")
            return True
            
        except Exception as e:
            logger.error(f"Error cancelando autenticación: {e}")
            return False
    
    # ====================================================================
    # INTERFAZ DE ENROLLMENT
    # ====================================================================
    
    def start_real_enrollment(self, user_id: str, username: str, 
                             gesture_sequence: List[str],
                             progress_callback: Optional[Callable] = None,
                             error_callback: Optional[Callable] = None) -> str:
        """
        Inicia proceso de enrollment.
        
        Args:
            user_id: ID único del usuario
            username: Nombre del usuario
            gesture_sequence: Secuencia de gestos a capturar
            progress_callback: Callback de progreso (opcional)
            error_callback: Callback de errores (opcional)
            
        Returns:
            ID de sesión de enrollment
        """
        try:
            return self.enrollment_system.start_real_enrollment(
                user_id=user_id,
                username=username,
                gesture_sequence=gesture_sequence,
                progress_callback=progress_callback,
                error_callback=error_callback
            )
        except Exception as e:
            logger.error(f"Error iniciando enrollment: {e}")
            raise
    
    def process_enrollment_frame(self, session_id: str) -> Dict[str, Any]:
        """
        Procesa un frame para una sesión de enrollment.
        """
        try:
            # CAMBIAR ESTA LÍNEA:
            # return self.enrollment_system.process_enrollment_frame(session_id)
            
            # POR ESTE CÓDIGO COMPLETO:
            if session_id not in self.enrollment_system.active_sessions:
                return {'error': 'Sesión no encontrada', 'is_real': True}
            
            session = self.enrollment_system.active_sessions[session_id]
            
            if session.status not in [EnrollmentStatus.COLLECTING_SAMPLES, EnrollmentStatus.IN_PROGRESS]:
                return {
                    'error': f'Sesión no está recolectando muestras: {session.status.value}',
                    'is_real': True,
                    'status': session.status.value
                }
            
            # PROCESAR FRAME CON FEEDBACK VISUAL INTEGRADO
            sample, visual_feedback = self._process_frame_with_feedback(session)
            
            # Información básica del estado
            info = {
                'session_id': session_id,
                'status': session.status.value,
                'phase': session.current_phase.value,
                'progress': session.progress_percentage,
                'current_gesture': session.current_gesture,
                'current_gesture_index': session.current_gesture_index,
                'total_gestures': len(session.gesture_sequence),
                'samples_collected': session.successful_samples,
                'samples_needed': session.total_samples_needed,
                'failed_samples': session.failed_samples,
                'duration': session.duration,
                'sample_captured': sample is not None,
                'is_real_processing': True,
                'no_simulation': True,
                'bootstrap_mode': self.enrollment_system.bootstrap_mode,  # NUEVO
                'visual_feedback': visual_feedback      # NUEVO
            }
            
            # Agregar información de muestra si se capturó
            if sample:
                info.update({
                    'sample_id': sample.sample_id,
                    'sample_quality': sample.quality_assessment.quality_score if sample.quality_assessment else 0.0,
                    'sample_confidence': sample.confidence,
                    'sample_gesture': sample.gesture_name,
                    'anatomical_embedding_generated': sample.anatomical_embedding is not None,
                    'dynamic_embedding_generated': sample.dynamic_embedding is not None,
                    'sample_validation_errors': sample.validation_errors,
                    'is_bootstrap_sample': getattr(sample, 'is_bootstrap', self.enrollment_system.bootstrap_mode)  # NUEVO
                })
                
                # Actualizar estadísticas
                self.enrollment_system.stats['total_samples_captured'] += 1
                if sample.anatomical_embedding is not None:
                    self.enrollment_system.stats['total_real_templates_generated'] += 1
                if sample.dynamic_embedding is not None:
                    self.enrollment_system.stats['total_real_templates_generated'] += 1
            
            # Verificar si sesión completada
            if session.status in [EnrollmentStatus.COMPLETED, EnrollmentStatus.FAILED, EnrollmentStatus.CANCELLED]:
                self.enrollment_system._finalize_real_session(session)
                info['session_completed'] = True
                info['final_status'] = session.status.value
                
                # NUEVO: Si completamos bootstrap, verificar entrenamiento
                if session.status == EnrollmentStatus.COMPLETED and self.enrollment_system.bootstrap_mode:
                    training_attempted = self.enrollment_system._attempt_bootstrap_training()
                    info['bootstrap_training_attempted'] = training_attempted
            
            return info
            
        except Exception as e:
            logger.error(f"Error procesando frame de enrollment: {e}")
            return {
                'error': str(e),
                'is_real': True,
                'no_simulation': True
            }
    
    def get_enrollment_status(self, session_id: str) -> Dict[str, Any]:
        """Obtiene estado de enrollment."""
        try:
            return self.enrollment_system.get_enrollment_status(session_id)
        except Exception as e:
            logger.error(f"Error obteniendo estado de enrollment: {e}")
            return {'error': str(e), 'is_real': True}
    
    def cancel_real_enrollment(self, session_id: str) -> bool:
        """Cancela enrollment."""
        try:
            return self.enrollment_system.cancel_enrollment(session_id)
        except Exception as e:
            logger.error(f"Error cancelando enrollment: {e}")
            return False
    
    # ====================================================================
    # ESTADÍSTICAS Y GESTIÓN
    # ====================================================================
    
    def get_real_system_statistics(self) -> Dict[str, Any]:
        """Obtiene estadísticas completas del sistema."""
        try:
            # Estadísticas de autenticación
            auth_stats = dict(self.statistics)
            
            # Estadísticas de sesiones
            session_stats = self.session_manager.get_real_session_stats()
            
            # Estadísticas de base de datos
            db_stats = self.database.get_database_stats()
            
            # Estadísticas de seguridad
            security_stats = self.security_auditor.get_security_metrics()
            
            # Estadísticas de enrollment
            enrollment_stats = self.enrollment_system.get_system_stats()
            
            # CORRECCIÓN: Verificar redes antes de acceder a is_trained
            anatomical_trained = False
            dynamic_trained = False
            
            # Verificar red anatómica (pipeline primero, global como fallback)
            if (hasattr(self.pipeline, 'anatomical_network') and 
                self.pipeline.anatomical_network is not None and
                hasattr(self.pipeline.anatomical_network, 'is_trained')):
                anatomical_trained = self.pipeline.anatomical_network.is_trained
            elif '_real_siamese_anatomical_instance' in globals():
                global_anat = globals()['_real_siamese_anatomical_instance']
                if global_anat and hasattr(global_anat, 'is_trained'):
                    anatomical_trained = global_anat.is_trained
            
            # Verificar red dinámica (pipeline primero, global como fallback)
            if (hasattr(self.pipeline, 'dynamic_network') and 
                self.pipeline.dynamic_network is not None and
                hasattr(self.pipeline.dynamic_network, 'is_trained')):
                dynamic_trained = self.pipeline.dynamic_network.is_trained
            elif '_real_siamese_dynamic_instance' in globals():
                global_dyn = globals()['_real_siamese_dynamic_instance']
                if global_dyn and hasattr(global_dyn, 'is_trained'):
                    dynamic_trained = global_dyn.is_trained
            
            return {
                'authentication': auth_stats,
                'sessions': session_stats,
                'database': db_stats.__dict__,
                'security': security_stats,
                'enrollment': enrollment_stats,
                'system_status': {
                    'initialized': self.is_initialized,
                    'active_sessions': len(self.session_manager.active_sessions),
                    'total_users': db_stats.total_users,
                    'total_templates': db_stats.total_templates,
                    'pipeline_ready': self.pipeline.is_initialized,
                    'networks_trained': anatomical_trained and dynamic_trained,  # LÍNEA CORREGIDA
                    'is_real_system': True,
                    'no_simulation': True,
                    'version': '2.0_real'
                }
            }
            
        except Exception as e:
            logger.error(f"Error obteniendo estadísticas: {e}")
            return {
                'error': str(e),
                'is_real_system': True
            }
    
    def get_real_available_users(self) -> List[Dict[str, Any]]:
        """Obtiene lista de usuarios disponibles para autenticación."""
        try:
            users = self.database.list_users()
            
            user_list = []
            for user in users:
                if user.total_templates > 0:  # Solo usuarios con templates
                    user_list.append({
                        'user_id': user.user_id,
                        'username': user.username,
                        'total_templates': user.total_templates,
                        'success_rate': getattr(user, 'verification_success_rate', 0.0),
                        'last_activity': getattr(user, 'last_activity', time.time()),
                        'gesture_sequence': getattr(user, 'gesture_sequence', []),
                        'enrollment_date': getattr(user, 'enrollment_date', time.time()),
                        'is_real_user': True
                    })
            
            logger.info(f"Usuarios disponibles: {len(user_list)}")
            return user_list
            
        except Exception as e:
            logger.error(f"Error obteniendo usuarios: {e}")
            return []
    
    def cleanup_real_system(self):
        """Limpia recursos del sistema."""
        try:
            logger.info("Limpiando sistema de autenticación")
            
            # Cancelar todas las sesiones activas
            for session_id in list(self.session_manager.active_sessions.keys()):
                self.cancel_real_authentication(session_id)
            
            # Limpiar pipeline
            self.pipeline.cleanup()
            
            # Limpiar enrollment
            self.enrollment_system.cleanup()
            
            self.is_initialized = False
            
            logger.info("Sistema de autenticación limpiado completamente")
            
        except Exception as e:
            logger.error(f"Error limpiando sistema: {e}")

# ====================================================================
# FUNCIÓN DE CONVENIENCIA PARA INSTANCIA GLOBAL
# ====================================================================

# Instancia global
_real_authentication_system_instance = None

def get_real_authentication_system(config_override: Optional[Dict[str, Any]] = None) -> RealAuthenticationSystem:
    """
    Obtiene una instancia global del sistema de autenticación.
    
    Args:
        config_override: Configuración personalizada (opcional)
        
    Returns:
        Instancia de RealAuthenticationSystem
    """
    global _real_authentication_system_instance
    
    if _real_authentication_system_instance is None:
        _real_authentication_system_instance = RealAuthenticationSystem(config_override)
    
    return _real_authentication_system_instance

# Alias para compatibilidad con código existente
AuthenticationSystem = RealAuthenticationSystem
get_authentication_system = get_real_authentication_system