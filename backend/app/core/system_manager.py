"""
System Manager - Gestor principal del sistema biométrico para FastAPI
Arquitectura: 15 módulos en 4 capas funcionales
"""

import time
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import numpy as np

from app.core.config_manager import get_logger, get_config
# from app.core.biometric_database import get_biometric_database
from app.core.supabase_biometric_storage import get_biometric_database
from app.core.enrollment_system import get_real_enrollment_system
from app.core.authentication_system import get_real_authentication_system
from app.core.siamese_anatomical_network import get_real_siamese_anatomical_network
from app.core.siamese_dynamic_network import get_real_siamese_dynamic_network
from app.core.camera_manager import get_camera_manager, release_camera
from app.core.mediapipe_processor import get_mediapipe_processor, release_mediapipe
from app.core.anatomical_features_extractor import get_anatomical_features_extractor
from app.core.dynamic_features_extractor import get_real_dynamic_features_extractor
from app.core.sequence_manager import get_sequence_manager
from app.core.quality_validator import get_quality_validator
from app.core.reference_area_manager import get_reference_area_manager

logger = get_logger()


# ====================================================================
# ENUMERACIONES Y ESTADO DEL SISTEMA
# ====================================================================

class SystemMode(Enum):
    """Modos principales del sistema."""
    BASIC_SETUP = "basic_setup"
    ENROLLMENT_READY = "enrollment_ready"
    TRAINING_READY = "training_ready"
    FULL_SYSTEM = "full_system"
    ERROR = "error"


class InitializationLevel(Enum):
    """Niveles de inicialización progresiva."""
    NONE = 0
    BASIC_COMPONENTS = 1
    FEATURE_EXTRACTION = 2
    NEURAL_NETWORKS = 3
    FULL_PIPELINE = 4


@dataclass
class SystemState:
    """Estado actual del sistema."""
    initialization_level: InitializationLevel = InitializationLevel.NONE
    users_count: int = 0
    networks_trained: bool = False
    database_ready: bool = False
    enrollment_active: bool = False
    authentication_active: bool = False
    bootstrap_mode: bool = False  # Modo para primeros usuarios
    error_message: Optional[str] = None
    
    # Estadísticas de componentes
    modules_loaded: Dict[str, bool] = field(default_factory=dict)
    last_training_time: Optional[str] = None
    total_enrollments: int = 0
    total_authentications: int = 0
    total_verifications: int = 0
    total_identifications: int = 0


# ====================================================================
# GESTOR PRINCIPAL DEL SISTEMA
# ====================================================================

class BiometricSystemManager:
    """
    Gestor principal del sistema biométrico para FastAPI.
    
    Coordina todos los 15 módulos del sistema organizados en 4 capas:
    - CAPA 1: Componentes básicos (config, cámara, mediapipe, validación, áreas)
    - CAPA 2: Extracción de características (anatómicas, dinámicas, secuencias)
    - CAPA 3: Redes neuronales (siamesas anatómica/dinámica, preprocesador, fusión)
    - CAPA 4: Sistema completo (base de datos, enrollment, autenticación)
    
    Basado en BiometricGestureSystemReal del notebook MAIN.py
    """
    
    _instance = None
    _initialized = False
    
    # Módulos requeridos del sistema (15 módulos)
    REQUIRED_MODULES = {
        'config_manager': 'ConfigManager',
        'camera_manager': 'CameraManager',
        'mediapipe_processor': 'MediaPipeProcessor',
        'quality_validator': 'QualityValidator',
        'reference_area_manager': 'ReferenceAreaManager',
        'anatomical_features_extractor': 'AnatomicalFeaturesExtractor',
        'dynamic_features_extractor': 'RealDynamicFeaturesExtractor',
        'sequence_manager': 'SequenceManager',
        'siamese_anatomical_network': 'RealSiameseAnatomicalNetwork',
        'siamese_dynamic_network': 'RealSiameseDynamicNetwork',
        'feature_preprocessor': 'RealFeaturePreprocessor',
        'score_fusion_system': 'RealScoreFusionSystem',
        'biometric_database': 'BiometricDatabase',
        'enrollment_system': 'RealEnrollmentSystem',
        'authentication_system': 'RealAuthenticationSystem'
    }
    
    def __new__(cls):
        """Singleton pattern - Una sola instancia del sistema."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Inicializa el gestor (solo una vez)."""
        if self._initialized:
            return
        
        self.state = SystemState()
        self.start_time = time.time()
        
        # Componentes principales (Módulos 13-15)
        self.database = None
        self.enrollment_system = None
        self.authentication_system = None
        
        # Redes neuronales (Módulos 9-10)
        self.anatomical_network = None
        self.dynamic_network = None
        
        # Componentes auxiliares (Nivel 1)
        self.camera_manager = None
        self.mediapipe_processor = None
        self.quality_validator = None
        self.reference_area_manager = None
        
        # Extractores (Nivel 2)
        self.anatomical_extractor = None
        self.dynamic_extractor = None
        self.sequence_manager = None
        
        print("=" * 80)
        print("BiometricSystemManager v2.0.0 Real Edition Iniciado")
        print("Arquitectura: 15 Módulos + Main | 4 Capas Funcionales")
        print("Características: Redes siamesas, fusión multimodal, templates biométricos")
        print("=" * 80)
        
        self._initialized = True
    
    def verify_modules(self) -> Tuple[bool, List[str]]:
        """
        Verifica que todos los módulos requeridos estén disponibles.
        Equivalente a verify_notebook_modules() del MAIN.
        
        Returns:
            Tuple[bool, List[str]]: (todos_disponibles, módulos_faltantes)
        """
        missing = []
        
        print("VERIFICANDO MÓDULOS DEL SISTEMA...")
        print("=" * 80)
        
        for module_name, class_name in self.REQUIRED_MODULES.items():
            try:
                # Intentar importar el módulo
                module_path = f"app.core.{module_name}"
                __import__(module_path)
                
                self.state.modules_loaded[class_name] = True
                print(f"{class_name}")
                
            except ImportError as e:
                self.state.modules_loaded[class_name] = False
                missing.append(class_name)
                logger.error(f"{class_name} NO disponible: {e}")
        
        all_available = len(missing) == 0
        
        if all_available:
            print(f"\nTODOS LOS {len(self.REQUIRED_MODULES)} MÓDULOS DISPONIBLES")
        else:
            logger.error(f"\nFALTAN {len(missing)} MÓDULOS:")
            for module in missing:
                logger.error(f"   - {module}")
        
        print("=" * 80)
        return all_available, missing
    
    def initialize_system(self) -> bool:
        """
        Inicializa el sistema completo de forma progresiva.
        Equivalente a initialize_real_progressive() del MAIN.
        
        Returns:
            bool: True si la inicialización fue exitosa
        """
        try:
            print("\n" + "=" * 80)
            print("INICIANDO INICIALIZACIÓN PROGRESIVA DEL SISTEMA")
            print("=" * 80)
            
            # Paso 0: Verificar módulos
            modules_ok, missing = self.verify_modules()
            if not modules_ok:
                self.state.error_message = f"Módulos faltantes: {', '.join(missing)}"
                logger.error("Error inicializando sistema biométrico")
                logger.error(f"Detalle del error: {self.state.error_message}")
                return False
            
            # ================================================================
            # NIVEL 1: COMPONENTES BÁSICOS
            # ================================================================
            print("\nNIVEL 1: Inicializando Componentes Básicos")
            print("-" * 80)
            
            if not self._initialize_real_basic_components():
                self.state.error_message = "Error en Nivel 1 (Componentes Básicos)"
                logger.error("Error inicializando sistema biométrico")
                logger.error(f"Detalle del error: {self.state.error_message}")
                return False
            
            self.state.initialization_level = InitializationLevel.BASIC_COMPONENTS
            print("NIVEL 1 COMPLETADO: Componentes básicos listos\n")
            
            # ================================================================
            # NIVEL 2: EXTRACTORES DE CARACTERÍSTICAS
            # ================================================================
            print("NIVEL 2: Inicializando Extractores de Características")
            print("-" * 80)
            
            if not self._initialize_real_feature_extractors():
                self.state.error_message = "Error en Nivel 2 (Extractores)"
                logger.error("Error inicializando sistema biométrico")
                logger.error(f"Detalle del error: {self.state.error_message}")
                return False
            
            self.state.initialization_level = InitializationLevel.FEATURE_EXTRACTION
            self.state.enrollment_active = True  # Enrollment siempre disponible
            print("NIVEL 2 COMPLETADO: Extractores listos\n")
            
            # ================================================================
            # NIVEL 3: REDES NEURONALES
            # ================================================================
            print("NIVEL 3: Verificando Redes Neuronales")
            print("-" * 80)
            
            networks_trained = self._check_real_networks_trained()
            self.state.networks_trained = networks_trained
            self.state.initialization_level = InitializationLevel.NEURAL_NETWORKS
            
            if networks_trained:
                print("NIVEL 3 COMPLETADO: Redes entrenadas y cargadas\n")
            else:
                logger.warning("NIVEL 3 PARCIAL: Redes necesitan entrenamiento")
                print(f"Usuarios actuales: {self.state.users_count}")
                print(f"Mínimo requerido: 2 usuarios para entrenar")
                
                # Activar modo bootstrap
                if self.state.users_count < 2:
                    self.state.bootstrap_mode = True
                    print("MODO BOOTSTRAP ACTIVADO: Permitir enrollment sin redes\n")
            
            # ================================================================
            # NIVEL 4: PIPELINE COMPLETO
            # ================================================================
            print("NIVEL 4: Inicializando Pipeline Completo")
            print("-" * 80)
            
            if self._initialize_real_authentication_system():
                self.state.authentication_active = True
                self.state.initialization_level = InitializationLevel.FULL_PIPELINE
                print("NIVEL 4 COMPLETADO: Sistema 100% funcional\n")
            else:
                print("NIVEL 4 PARCIAL: Enrollment disponible, autenticación pendiente\n")
            
            # Resumen final
            self._print_initialization_summary()
            
            print("=" * 80)
            print("SISTEMA INICIALIZADO CORRECTAMENTE")
            print("=" * 80)
            return True
            
        except Exception as e:
            logger.error(f"Error inicializando sistema biométrico", exc_info=True)
            logger.error(f"Detalle del error: {str(e)}")
            self.state.error_message = str(e)
            return False
    
    def _initialize_real_basic_components(self) -> bool:
        """
        NIVEL 1: Inicializa componentes básicos.
        Equivalente a _initialize_real_basic_components() del MAIN notebook.
        
        ORDEN CRÍTICO (igual al notebook):
        1. Base de datos
        2. Cámara
        3. MediaPipe
        4. Validadores
        """
        try:
            # ============================================================
            # 1. BASE DE DATOS
            # ============================================================
            print("Inicializando Base de Datos...")
            
            self.database = get_biometric_database()
            
            # Verificar usuarios existentes
            users = self.database.list_users()
            self.state.users_count = len(users)
            self.state.database_ready = True
            
            print(f"Base de datos lista: {self.state.users_count} usuarios registrados")
            
            # Obtener estadísticas
            try:
                db_stats = self.database.get_database_stats()
                total_templates = db_stats.get('total_templates', 0)
                print(f"Templates totales: {total_templates}")
            except:
                pass
            
            # ============================================================
            # 2. CÁMARA (CRÍTICO: Antes de extractores dinámicos)
            # ============================================================
            print("Inicializando Cámara...")
            self.camera_manager = get_camera_manager()
            print("Cámara (instancia global)")
            
            # ============================================================
            # 3. MEDIAPIPE (CRÍTICO: Antes de extractores dinámicos)
            # ============================================================
            print("Inicializando MediaPipe...")
            self.mediapipe_processor = get_mediapipe_processor()
            
            if hasattr(self.mediapipe_processor, 'initialize'):
                if not self.mediapipe_processor.initialize():
                    logger.error("✗ ERROR: No se pudo inicializar MediaPipe")
                    return False
            
            print("MediaPipe")
            
            # ============================================================
            # 4. VALIDADORES (Opcional pero recomendado)
            # ============================================================
            try:
                self.quality_validator = get_quality_validator()
                self.reference_area_manager = get_reference_area_manager()
                print("Validadores de calidad")
            except Exception as e:
                logger.warning(f"Validadores no inicializados: {e}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error en componentes básicos: {e}", exc_info=True)
            return False
    
    def _initialize_real_feature_extractors(self) -> bool:
        """
        NIVEL 2: Inicializa extractores de características.
        Equivalente a _initialize_real_feature_extractors() del MAIN notebook.
        
        IMPORTANTE: MediaPipe y Camera YA deben estar inicializados del Nivel 1
        
        ORDEN (igual al notebook):
        1. AnatomicalFeaturesExtractor
        2. RealDynamicFeaturesExtractor (requiere MediaPipe)
        3. SequenceManager
        4. EnrollmentSystem
        """
        try:
            # ============================================================
            # 1. ANATOMICAL FEATURES EXTRACTOR
            # ============================================================
            print("  Inicializando AnatomicalFeaturesExtractor...")
            self.anatomical_extractor = get_anatomical_features_extractor()
            print("  AnatomicalFeaturesExtractor inicializado")
            
            # ============================================================
            # 2. DYNAMIC FEATURES EXTRACTOR (requiere MediaPipe del Nivel 1)
            # ============================================================
            print("  Inicializando RealDynamicFeaturesExtractor...")
            
            # CRÍTICO: Verificar que MediaPipe esté disponible
            if self.mediapipe_processor is None:
                logger.error("ERROR: MediaPipeProcessor no está inicializado antes que DynamicFeaturesExtractor.")
                return False
            
            self.dynamic_extractor = get_real_dynamic_features_extractor()
            print("  RealDynamicFeaturesExtractor inicializado")
            
            # ============================================================
            # 3. SEQUENCE MANAGER
            # ============================================================
            print("  Inicializando SequenceManager...")
            self.sequence_manager = get_sequence_manager()
            print("  SequenceManager inicializado")
            
            # ============================================================
            # 4. ENROLLMENT SYSTEM
            # ============================================================
            print("Inicializando Sistema de Enrollment...")
            self.enrollment_system = get_real_enrollment_system()
            
            # Verificar modo bootstrap
            bootstrap = self.enrollment_system.check_bootstrap_mode()
            if bootstrap:
                print("Modo Bootstrap detectado - Primeros usuarios")
                self.state.bootstrap_mode = True
            
            print("Sistema de enrollment listo")
            
            return True
            
        except Exception as e:
            logger.error(f"Error en extractores: {e}", exc_info=True)
            return False
    
    def _check_real_networks_trained(self) -> bool:
        """
        NIVEL 3: Verifica si las redes están entrenadas.
        Equivalente a _check_real_networks_trained() del MAIN.
        """
        try:
            print("Verificando estado de redes neuronales...")
            
            # Obtener instancias de las redes
            self.anatomical_network = get_real_siamese_anatomical_network()
            self.dynamic_network = get_real_siamese_dynamic_network()
            
            # Verificar si están entrenadas
            anatomical_trained = self.anatomical_network.is_trained
            dynamic_trained = self.dynamic_network.is_trained
            
            print(f"  Red anatómica: {'Entrenada' if anatomical_trained else 'No entrenada'}")
            print(f"  Red dinámica: {'Entrenada' if dynamic_trained else 'No entrenada'}")
            
            both_trained = anatomical_trained and dynamic_trained
            
            if both_trained:
                print("Ambas redes están entrenadas y listas")
            else:
                logger.warning("Las redes necesitan entrenamiento")
                print(f"Se requieren al menos 2 usuarios para entrenar")
            
            return both_trained
            
        except Exception as e:
            logger.error(f"Error verificando redes: {e}", exc_info=True)
            return False
    
    def _initialize_real_authentication_system(self) -> bool:
        """
        NIVEL 4: Inicializa sistema de autenticación.
        Equivalente a _initialize_real_authentication_system() del MAIN.
        """
        try:
            if not self.state.networks_trained:
                logger.warning("Redes no entrenadas - Autenticación no disponible aún")
                return False
            
            print("Inicializando Sistema de Autenticación...")
            self.authentication_system = get_real_authentication_system()
            
            print("Sistema de autenticación listo")
            return True
            
        except Exception as e:
            logger.error(f"Error en sistema de autenticación: {e}", exc_info=True)
            return False
    
    def _print_initialization_summary(self):
        """Imprime resumen de la inicialización."""
        print("\n" + "=" * 80)
        print("RESUMEN DE INICIALIZACIÓN")
        print("=" * 80)
        print(f"  Nivel alcanzado: {self.state.initialization_level.name}")
        print(f"  Usuarios registrados: {self.state.users_count}")
        print(f"  Redes entrenadas: {'Sí' if self.state.networks_trained else 'No'}")
        print(f"  Enrollment: {'Activo' if self.state.enrollment_active else 'Inactivo'}")
        print(f"  Autenticación: {'Activa' if self.state.authentication_active else 'Inactiva'}")
        print(f"  Bootstrap: {'Activo' if self.state.bootstrap_mode else 'Inactivo'}")
        print("=" * 80 + "\n")
    
    def get_system_status(self) -> Dict[str, Any]:
        """
        Obtiene el estado actual del sistema.
        
        Returns:
            Dict con información completa del estado
        """
        uptime = time.time() - self.start_time
        
        return {
            'status': 'operational' if self.state.initialization_level == InitializationLevel.FULL_PIPELINE else 'partial',
            'initialization_level': self.state.initialization_level.name,
            'initialization_level_value': self.state.initialization_level.value,
            'users_count': self.state.users_count,
            'networks_trained': self.state.networks_trained,
            'database_ready': self.state.database_ready,
            'enrollment_active': self.state.enrollment_active,
            'authentication_active': self.state.authentication_active,
            'bootstrap_mode': self.state.bootstrap_mode,
            'error_message': self.state.error_message,
            'uptime_seconds': uptime,
            'modules_loaded': self.state.modules_loaded,
            'statistics': {
                'total_enrollments': self.state.total_enrollments,
                'total_authentications': self.state.total_authentications,
                'total_verifications': self.state.total_verifications,
                'total_identifications': self.state.total_identifications
            }
        }
    
    def train_networks(self, force: bool = False) -> Dict[str, Any]:
        """
        Entrena o reentrena las redes neuronales.
        CORREGIDO: Manejo de RealTrainingHistory objects
        
        Args:
            force: Si True, fuerza reentrenamiento incluso si ya están entrenadas
        
        Returns:
            Dict con resultado del entrenamiento
        """
        result = {
            'success': False,
            'message': '',
            'anatomical_trained': False,
            'dynamic_trained': False
        }
        
        try:
            # Verificar que haya suficientes usuarios
            if self.state.users_count < 2:
                result['message'] = f"Se requieren al menos 2 usuarios. Actualmente: {self.state.users_count}"
                logger.warning(result['message'])
                return result
            
            print("=" * 80)
            print("INICIANDO ENTRENAMIENTO DE REDES NEURONALES")
            print("=" * 80)
            
            # Verificar si ya están entrenadas
            if self.state.networks_trained and not force:
                print("Las redes ya están entrenadas")
                print("Usa force=True para reentrenar")
                result['success'] = True
                result['message'] = "Redes ya entrenadas (usa force=True para reentrenar)"
                result['anatomical_trained'] = self.anatomical_network.is_trained
                result['dynamic_trained'] = self.dynamic_network.is_trained
                return result
            
            # ============================================================
            # ENTRENAR RED ANATÓMICA
            # ============================================================
            print("\nEntrenando Red Siamesa Anatómica...")
            print("-" * 80)
            
            anatomical_result = self.anatomical_network.train_with_real_data(self.database)
            
            # CORREGIDO: Verificar tipo de resultado
            if hasattr(anatomical_result, '__dict__'):
                # Es un objeto RealTrainingHistory
                anatomical_success = getattr(anatomical_result, 'success', True)
                anatomical_message = getattr(anatomical_result, 'message', 'Training completed')
            elif isinstance(anatomical_result, dict):
                # Ya es un diccionario
                anatomical_success = anatomical_result.get('success', False)
                anatomical_message = anatomical_result.get('message', 'Unknown result')
            else:
                # Resultado desconocido, asumimos éxito si no hay excepción
                anatomical_success = True
                anatomical_message = 'Training completed'
            
            if anatomical_success:
                print("Red anatómica entrenada exitosamente")
                result['anatomical_trained'] = True
            else:
                logger.error(f"Error entrenando red anatómica: {anatomical_message}")
                result['message'] = f"Error en red anatómica: {anatomical_message}"
                return result
            
            # ============================================================
            # ENTRENAR RED DINÁMICA
            # ============================================================
            print("\nEntrenando Red Siamesa Dinámica...")
            print("-" * 80)
            
            dynamic_result = self.dynamic_network.train_with_real_data(self.database)
            
            # CORREGIDO: Verificar tipo de resultado
            if hasattr(dynamic_result, '__dict__'):
                # Es un objeto RealTrainingHistory
                dynamic_success = getattr(dynamic_result, 'success', True)
                dynamic_message = getattr(dynamic_result, 'message', 'Training completed')
            elif isinstance(dynamic_result, dict):
                # Ya es un diccionario
                dynamic_success = dynamic_result.get('success', False)
                dynamic_message = dynamic_result.get('message', 'Unknown result')
            else:
                # Resultado desconocido, asumimos éxito si no hay excepción
                dynamic_success = True
                dynamic_message = 'Training completed'
            
            if dynamic_success:
                print("Red dinámica entrenada exitosamente")
                result['dynamic_trained'] = True
            else:
                logger.error(f"Error entrenando red dinámica: {dynamic_message}")
                result['message'] = f"Error en red dinámica: {dynamic_message}"
                return result
            
            # ============================================================
            # RESULTADO FINAL
            # ============================================================
            both_trained = result['anatomical_trained'] and result['dynamic_trained']
            
            if both_trained:
                self.state.networks_trained = True
                self.state.last_training_time = time.strftime("%Y-%m-%d %H:%M:%S")
                
                # Inicializar autenticación si no estaba activa
                if not self.state.authentication_active:
                    try:
                        if self._initialize_real_authentication_system():
                            self.state.authentication_active = True
                            self.state.initialization_level = InitializationLevel.FULL_PIPELINE
                            print("Sistema de autenticación activado")
                    except Exception as auth_error:
                        logger.warning(f"No se pudo activar autenticación: {auth_error}")
                        # No es crítico, las redes están entrenadas
                
                result['success'] = True
                result['message'] = "Ambas redes entrenadas exitosamente"
                print("\nENTRENAMIENTO COMPLETADO EXITOSAMENTE")
                print(f"   - Red Anatómica: Entrenada")
                print(f"   - Red Dinámica: Entrenada")
                print(f"   - Usuarios entrenados: {self.state.users_count}")
                print(f"   - Autenticación: {'Activa' if self.state.authentication_active else 'Inactiva'}")
                
                # NUEVO: Guardar tracking de usuarios entrenados
                try:
                    from pathlib import Path
                    import json
                    from datetime import datetime
                    
                    # Obtener lista de usuarios incluidos en este entrenamiento
                    all_users = self.database.list_users()
                    trained_user_ids = [user.user_id for user in all_users]
                    
                    tracking_info = {
                        'users_trained': trained_user_ids,
                        'users_count': len(trained_user_ids),
                        'timestamp': datetime.now().isoformat(),
                        'anatomical_trained': True,
                        'dynamic_trained': True
                    }
                    
                    tracking_path = Path('biometric_data') / 'last_training.json'
                    tracking_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    with open(tracking_path, 'w') as f:
                        json.dump(tracking_info, f, indent=2)
                    
                    print(f"Tracking guardado: {len(trained_user_ids)} usuarios incluidos")
                    
                except Exception as tracking_error:
                    print(f"Advertencia guardando tracking: {tracking_error}")
                
                # NUEVO: FASE 2 - Regenerar embeddings si es reentrenamiento
                # FASE 2 - Regenerar embeddings si es reentrenamiento
                if force:  # Es un reentrenamiento
                    print("\n" + "=" * 80)
                    print("FASE 2: REGENERACIÓN DE EMBEDDINGS")
                    print("=" * 80)
                    print("Regenerando embeddings de usuarios normales con redes reentrenadas...")
                    
                    regeneration_success = self.regenerate_normal_user_embeddings()
                    
                    if regeneration_success:
                        print("Regeneración completada exitosamente")
                        print("   Todos los embeddings actualizados con las nuevas redes")
                    else:
                        print("Advertencia: Algunos embeddings no se regeneraron")
                        print("   El sistema seguirá funcionando, pero revisa los logs")
                    
                    print("=" * 80)
                    
                    print("=" * 80)

                    # ============================================================
                    # LOGS CRÍTICOS: Estado ANTES del recálculo de threshold
                    # ============================================================
                    print("\n" + "=" * 80)
                    print("ESTADO ANTES DE RECALCULAR THRESHOLD")
                    print("=" * 80)
                    print(f"Threshold anatómico ACTUAL: {self.anatomical_network.optimal_threshold:.6f}")

                    if self.anatomical_network.current_metrics:
                        print(f"Métricas ACTUALES de entrenamiento:")
                        print(f"  FAR: {self.anatomical_network.current_metrics.far:.6f}")
                        print(f"  FRR: {self.anatomical_network.current_metrics.frr:.6f}")
                        print(f"  EER: {self.anatomical_network.current_metrics.eer:.6f}")
                        print(f"  Threshold en métricas: {self.anatomical_network.current_metrics.threshold:.6f}")

                    # Verificar embeddings en base de datos
                    all_users = self.database.list_users()
                    print(f"\nUSUARIOS EN BASE DE DATOS: {len(all_users)}")

                    for user in all_users:
                        templates = self.database.list_user_templates(user.user_id)
                        anatomical_templates = [t for t in templates if 'anatomical' in str(t.template_type).lower()]
                        
                        print(f"\n  Usuario: {user.username}")
                        print(f"    Templates anatómicos: {len(anatomical_templates)}")
                        
                        for template in anatomical_templates[:3]:  # Solo primeros 3 para no saturar
                            if template.anatomical_embedding is not None:
                                emb = np.array(template.anatomical_embedding)
                                norm = np.linalg.norm(emb)
                                print(f"    Template {template.template_id[:12]}...")
                                print(f"      Embedding shape: {emb.shape}")
                                print(f"      Embedding norm: {norm:.6f}")
                                print(f"      Updated at: {getattr(template, 'updated_at', 'N/A')}")
                                print(f"      Mean value: {np.mean(emb):.6f}")

                    print("=" * 80)


                    # ============================================================
                    # FASE 3 - Recalcular thresholds con embeddings regenerados
                    # ============================================================
                    print("\n" + "=" * 80)
                    print("FASE 3: RECALCULANDO THRESHOLDS CON EMBEDDINGS REGENERADOS")
                    print("=" * 80)
                    
                    # Recalcular threshold anatómico
                    print("\nRecalculando threshold de red anatómica...")
                    try:
                        threshold_anatomical = self.anatomical_network.recalculate_threshold_from_database(self.database)
                        
                        if threshold_anatomical:
                            print("✓ Threshold anatómico recalculado y guardado exitosamente")
                            if self.anatomical_network.current_metrics:
                                print(f"   Nuevo threshold: {self.anatomical_network.current_metrics.threshold:.4f}")
                                print(f"   FAR: {self.anatomical_network.current_metrics.far:.4f}")
                                print(f"   FRR: {self.anatomical_network.current_metrics.frr:.4f}")
                                print(f"   EER: {self.anatomical_network.current_metrics.eer:.4f}")
                        else:
                            print("Advertencia: No se pudo recalcular threshold anatómico")
                            print("   El sistema usará el threshold anterior")
                            
                    except Exception as e:
                        print(f"Error recalculando threshold anatómico: {e}")
                        print("   El sistema usará el threshold anterior")
                        

                        
                    
                    # ============================================================
                    # LOGS CRÍTICOS: Estado DESPUÉS del recálculo de threshold
                    # ============================================================
                    print("\n" + "=" * 80)
                    print("ESTADO DESPUÉS DE RECALCULAR THRESHOLD")
                    print("=" * 80)
                    print(f"Threshold anatómico NUEVO: {self.anatomical_network.optimal_threshold:.6f}")

                    if self.anatomical_network.current_metrics:
                        print(f"Métricas NUEVAS después de recálculo:")
                        print(f"  FAR: {self.anatomical_network.current_metrics.far:.6f}")
                        print(f"  FRR: {self.anatomical_network.current_metrics.frr:.6f}")
                        print(f"  EER: {self.anatomical_network.current_metrics.eer:.6f}")
                        print(f"  Threshold en métricas: {self.anatomical_network.current_metrics.threshold:.6f}")
                        print(f"  AUC: {self.anatomical_network.current_metrics.auc_score:.6f}")

                    print("=" * 80)

      
                    
            else:
                result['message'] = "Entrenamiento parcial o fallido"
                logger.warning("\nENTRENAMIENTO INCOMPLETO")
            
            print("=" * 80)
            
            return result
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            result['message'] = f"Error durante entrenamiento: {str(e)}"
            logger.error(f"Error en entrenamiento: {e}", exc_info=True)
            print(f"\nERROR EN ENTRENAMIENTO:")
            print(error_trace)
            return result
    
    def get_pending_retrain_users(self) -> List[Dict[str, Any]]:
        """
        Identifica usuarios que AÚN NO fueron incluidos en el entrenamiento.
        
        Returns:
            Lista de diccionarios con información de usuarios pendientes
        """
        try:
            from pathlib import Path
            import json
            
            all_users = self.database.list_users()
            
            print(f"Total usuarios en sistema: {len(all_users)}")
            for user in all_users:
                print(f"   - {user.username} (ID: {user.user_id})")
            
            # Leer tracking del último entrenamiento
            tracking_path = Path('biometric_data') / 'last_training.json'
            
            # CRÍTICO: Si no existe tracking, NO ASUMIR NADA
            if not tracking_path.exists():
                logger.warning("No existe archivo de tracking (last_training.json)")
                logger.warning("   No se puede determinar qué usuarios están entrenados")
                logger.warning("   Retornando lista vacía - entrena las redes primero")
                return []
            
            # Leer tracking existente
            try:
                with open(tracking_path, 'r') as f:
                    last_training = json.load(f)
                    trained_user_ids = last_training.get('users_trained', [])
                    print(f"Último entrenamiento incluía: {trained_user_ids}")
            except Exception as e:
                logger.error(f"Error leyendo tracking: {e}")
                logger.error("   No se puede determinar usuarios pendientes")
                return []
            
            # Detectar usuarios NUEVOS (no en trained_user_ids)
            pending_users = []
            for user in all_users:
                print(f"Verificando usuario: {user.username} (ID: {user.user_id})")
                
                if user.user_id not in trained_user_ids:
                    pending_users.append({
                        'user_id': user.user_id,
                        'username': user.username,
                        'total_templates': user.total_templates
                    })
                    print(f"Usuario pendiente agregado: {user.username} (ID: {user.user_id})")
                else:
                    print(f" Usuario ya entrenado: {user.username} (ID: {user.user_id})")
            
            print(f"RESULTADO FINAL: {len(pending_users)} usuarios pendientes")
            
            return pending_users
            
        except Exception as e:
            logger.error(f"Error obteniendo usuarios pendientes: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []

        
    def regenerate_normal_user_embeddings(self) -> bool:
        """
        Regenera embeddings de usuarios normales (no bootstrap) después del reentrenamiento.
        
        Returns:
            True si la regeneración fue exitosa
        """
        try:
            print("=== REGENERACIÓN DE EMBEDDINGS POST-REENTRENAMIENTO ===")
            
            # Verificar redes
            if not self.anatomical_network.is_trained or not self.dynamic_network.is_trained:
                logger.error("Redes no están entrenadas")
                return False
            
            print("Redes disponibles")
            
            # Identificar usuarios normales (no bootstrap)
            all_users = self.database.list_users()
            normal_users = []
            
            for user in all_users:
                user_templates = self.database.list_user_templates(user.user_id)
                is_bootstrap = any(template.metadata.get('bootstrap_mode', False) 
                                 for template in user_templates)
                if not is_bootstrap:
                    normal_users.append(user)
            
            if not normal_users:
                print("No hay usuarios normales para regenerar")
                return True
            
            print(f"Regenerando embeddings para {len(normal_users)} usuarios normales...")
            
            total_regenerated = 0
            total_errors = 0
            
            for user in normal_users:
                try:
                    print(f"Procesando: {user.username}")
                    user_templates = self.database.list_user_templates(user.user_id)
                    
                    for template in user_templates:
                        try:
                            regenerated = self._regenerate_single_template(template)
                            if regenerated:
                                total_regenerated += 1
                            else:
                                total_errors += 1
                        except Exception as e:
                            logger.error(f"Error en template {template.template_id[:12]}: {e}")
                            total_errors += 1
                            
                except Exception as e:
                    logger.error(f"Error en usuario {user.username}: {e}")
                    continue
            
            # Resumen
            print("=" * 60)
            print(f"Templates regenerados: {total_regenerated}")
            print(f"Errores: {total_errors}")
            print("=" * 60)
            
            return total_regenerated > 0
            
        except Exception as e:
            logger.error(f"Error crítico en regeneración: {e}")
            return False

    # def _regenerate_single_template(self, template) -> bool:
    #     """Regenera embeddings de un template específico."""
    #     try:
    #         from pathlib import Path
    #         import json
            
    #         template_id = template.template_id
    #         print(f"   Regenerando: {template_id[:12]}...")
            
    #         # Cargar metadatos JSON
    #         json_file = Path("biometric_data") / "templates" / f"{template_id}.json"
    #         if not json_file.exists():
    #             return False
            
    #         with open(json_file, 'r') as f:
    #             json_data = json.load(f)
            
    #         # CRÍTICO: Deserializar metadata si es string
    #         metadata_raw = json_data.get('metadata', {})
            
    #         if isinstance(metadata_raw, str):
    #             # Metadata está serializado como string, deserializar
    #             try:
    #                 metadata = json.loads(metadata_raw)
    #                 print(f"      Metadata deserializado correctamente")
    #             except json.JSONDecodeError as e:
    #                 print(f"      ERROR deserializando metadata: {e}")
    #                 return False
    #         else:
    #             # Metadata ya es dict
    #             metadata = metadata_raw
            
    #         regenerated = False
            
    #         # REGENERACIÓN ANATÓMICA
    #         if str(template.template_type) == 'TemplateType.ANATOMICAL':
    #             bootstrap_features = metadata.get('bootstrap_features', [])
                
    #             if bootstrap_features and self.anatomical_network.is_trained:
    #                 features_array = np.array(bootstrap_features, dtype=np.float32)
                    
    #                 # Promediar si hay múltiples vectores
    #                 if features_array.ndim == 2:
    #                     features_array = np.mean(features_array, axis=0)
                    
    #                 # Generar nuevo embedding
    #                 new_embedding = self.anatomical_network.base_network.predict(
    #                     features_array.reshape(1, -1), verbose=0
    #                 )[0]
                    
    #                 # Actualizar template
    #                 template.anatomical_embedding = new_embedding
    #                 self.database._save_template(template)
                    
    #                 print(f"      Embedding anatómico regenerado")
    #                 regenerated = True
            
    #         # REGENERACIÓN DINÁMICA
    #         elif str(template.template_type) == 'TemplateType.DYNAMIC':
    #             temporal_sequence = metadata.get('temporal_sequence', [])
                
    #             if temporal_sequence and self.dynamic_network.is_trained:
    #                 sequence_array = np.array(temporal_sequence, dtype=np.float32)
                    
    #                 # Ajustar dimensiones (50×320)
    #                 if len(sequence_array.shape) == 2:
    #                     seq_length = len(sequence_array)
    #                     if seq_length > 50:
    #                         sequence_array = sequence_array[:50]
    #                     elif seq_length < 50:
    #                         padding = np.zeros((50 - seq_length, 320))
    #                         sequence_array = np.vstack([sequence_array, padding])
                        
    #                     # Generar nuevo embedding
    #                     new_embedding = self.dynamic_network.base_network.predict(
    #                         sequence_array.reshape(1, 50, 320), verbose=0
    #                     )[0]
                        
    #                     # Actualizar template
    #                     template.dynamic_embedding = new_embedding
    #                     self.database._save_template(template)
                        
    #                     print(f"      Embedding dinámico regenerado")
    #                     regenerated = True
            
    #         return regenerated
            
    #     except Exception as e:
    #         print(f"   Error: {e}")
    #         return False
    
    # def _regenerate_single_template(self, template) -> bool:
    #     """Regenera embeddings de un template específico - VERSION CON LOGS DETALLADOS."""
    #     try:
    #         from pathlib import Path
    #         import json
            
    #         template_id = template.template_id
    #         print(f"\n   === REGENERANDO TEMPLATE: {template_id[:20]} ===")
    #         print(f"      Tipo: {template.template_type}")
            
    #         # ============================================================
    #         # PASO 1: CARGAR ARCHIVO JSON
    #         # ============================================================
    #         json_file = Path("biometric_data") / "templates" / f"{template_id}.json"
    #         print(f"      Buscando archivo: {json_file}")
            
    #         if not json_file.exists():
    #             print(f"      ✗ ARCHIVO JSON NO EXISTE")
    #             return False
            
    #         print(f"      ✓ Archivo JSON encontrado")
            
    #         with open(json_file, 'r') as f:
    #             json_data = json.load(f)
            
    #         print(f"      ✓ JSON cargado correctamente")
            
    #         # ============================================================
    #         # PASO 2: DESERIALIZAR METADATA
    #         # ============================================================
    #         metadata_raw = json_data.get('metadata', {})
    #         print(f"      Tipo de metadata_raw: {type(metadata_raw)}")
            
    #         if isinstance(metadata_raw, str):
    #             print(f"      → Metadata es STRING, deserializando...")
    #             try:
    #                 metadata = json.loads(metadata_raw)
    #                 print(f"      ✓ Metadata deserializado correctamente")
    #                 print(f"      → Keys en metadata: {list(metadata.keys())[:5]}")
    #             except json.JSONDecodeError as e:
    #                 print(f"      ✗ ERROR deserializando metadata: {e}")
    #                 return False
    #         else:
    #             print(f"      → Metadata ya es DICT")
    #             metadata = metadata_raw
    #             print(f"      → Keys en metadata: {list(metadata.keys())[:5]}")
            
    #         regenerated = False
            
    #         # ============================================================
    #         # PASO 3A: REGENERACIÓN ANATÓMICA
    #         # ============================================================
    #         template_type_str = str(template.template_type)
    #         print(f"      Template type string: '{template_type_str}'")
            
    #         if template_type_str == 'TemplateType.ANATOMICAL':
    #             print(f"      → Es template ANATÓMICO")
                
    #             # Verificar bootstrap_features
    #             bootstrap_features = metadata.get('bootstrap_features', [])
    #             print(f"      → bootstrap_features presente: {bool(bootstrap_features)}")
    #             print(f"      → bootstrap_features length: {len(bootstrap_features) if bootstrap_features else 0}")
                
    #             # Verificar red entrenada
    #             print(f"      → Red anatómica entrenada: {self.anatomical_network.is_trained}")
                
    #             if not bootstrap_features:
    #                 print(f"      ✗ NO HAY bootstrap_features en metadata")
    #                 return False
                
    #             if not self.anatomical_network.is_trained:
    #                 print(f"      ✗ Red anatómica NO está entrenada")
    #                 return False
                
    #             print(f"      ✓ Condiciones cumplidas, generando embedding...")
                
    #             features_array = np.array(bootstrap_features, dtype=np.float32)
    #             print(f"      → features_array shape inicial: {features_array.shape}")
                
    #             # Promediar si hay múltiples vectores
    #             if features_array.ndim == 2:
    #                 print(f"      → Promediando múltiples vectores...")
    #                 features_array = np.mean(features_array, axis=0)
    #                 print(f"      → features_array shape después de promediar: {features_array.shape}")
                
    #             # Generar nuevo embedding
    #             print(f"      → Llamando a red anatómica.predict()...")
    #             new_embedding = self.anatomical_network.base_network.predict(
    #                 features_array.reshape(1, -1), verbose=0
    #             )[0]
    #             print(f"      → new_embedding shape: {new_embedding.shape}")
    #             print(f"      → new_embedding primeros 5 valores: {new_embedding[:5]}")
                
    #             # Actualizar template
    #             print(f"      → Actualizando template en base de datos...")
    #             template.anatomical_embedding = new_embedding
    #             self.database._save_template(template)
                
    #             print(f"      ✓✓✓ EMBEDDING ANATÓMICO REGENERADO EXITOSAMENTE")
    #             regenerated = True
            
    #         # ============================================================
    #         # PASO 3B: REGENERACIÓN DINÁMICA
    #         # ============================================================
    #         elif template_type_str == 'TemplateType.DYNAMIC':
    #             print(f"      → Es template DINÁMICO")
                
    #             # Verificar temporal_sequence
    #             temporal_sequence = metadata.get('temporal_sequence', [])
    #             print(f"      → temporal_sequence presente: {bool(temporal_sequence)}")
    #             print(f"      → temporal_sequence length: {len(temporal_sequence) if temporal_sequence else 0}")
                
    #             # Verificar red entrenada
    #             print(f"      → Red dinámica entrenada: {self.dynamic_network.is_trained}")
                
    #             if not temporal_sequence:
    #                 print(f"      ✗ NO HAY temporal_sequence en metadata")
    #                 return False
                
    #             if not self.dynamic_network.is_trained:
    #                 print(f"      ✗ Red dinámica NO está entrenada")
    #                 return False
                
    #             print(f"      ✓ Condiciones cumplidas, generando embedding...")
                
    #             sequence_array = np.array(temporal_sequence, dtype=np.float32)
    #             print(f"      → sequence_array shape inicial: {sequence_array.shape}")
    #             print(f"      → sequence_array ndim: {sequence_array.ndim}")
                
    #             # Ajustar dimensiones (50×320)
    #             if len(sequence_array.shape) == 2:
    #                 seq_length = len(sequence_array)
    #                 print(f"      → Secuencia es 2D, longitud: {seq_length}")
                    
    #                 if seq_length > 50:
    #                     print(f"      → Truncando de {seq_length} a 50 frames")
    #                     sequence_array = sequence_array[:50]
    #                 elif seq_length < 50:
    #                     print(f"      → Padding de {seq_length} a 50 frames")
    #                     padding = np.zeros((50 - seq_length, 320))
    #                     sequence_array = np.vstack([sequence_array, padding])
                    
    #                 print(f"      → sequence_array shape final: {sequence_array.shape}")
                    
    #                 # Generar nuevo embedding
    #                 print(f"      → Llamando a red dinámica.predict()...")
    #                 new_embedding = self.dynamic_network.base_network.predict(
    #                     sequence_array.reshape(1, 50, 320), verbose=0
    #                 )[0]
    #                 print(f"      → new_embedding shape: {new_embedding.shape}")
    #                 print(f"      → new_embedding primeros 5 valores: {new_embedding[:5]}")
                    
    #                 # Actualizar template
    #                 print(f"      → Actualizando template en base de datos...")
    #                 template.dynamic_embedding = new_embedding
    #                 self.database._save_template(template)
                    
    #                 print(f"      ✓✓✓ EMBEDDING DINÁMICO REGENERADO EXITOSAMENTE")
    #                 regenerated = True
    #             else:
    #                 print(f"      ✗ sequence_array NO es 2D (shape: {sequence_array.shape})")
    #                 return False
            
    #         else:
    #             print(f"      ✗ TIPO DE TEMPLATE NO RECONOCIDO: '{template_type_str}'")
    #             return False
            
    #         print(f"   === FIN REGENERACIÓN (success={regenerated}) ===\n")
    #         return regenerated
            
    #     except Exception as e:
    #         print(f"   ✗✗✗ EXCEPCIÓN EN REGENERACIÓN: {e}")
    #         import traceback
    #         traceback.print_exc()
    #         return False
        
    def _regenerate_single_template(self, template) -> bool:
        """Regenera embeddings de un template específico - VERSION SUPABASE."""
        try:
            import json
            
            template_id = template.template_id
            print(f"\n   === REGENERANDO TEMPLATE: {template_id[:20]} ===")
            print(f"      Tipo: {template.template_type}")
            
            # ============================================================
            # OBTENER METADATA DESDE SUPABASE (NO DESDE ARCHIVO)
            # ============================================================
            metadata_raw = template.metadata
            print(f"      Metadata raw type: {type(metadata_raw)}")
            
            if not metadata_raw:
                print(f"      ✗ Template NO tiene metadata")
                return False
            
            # Deserializar metadata si es string
            if isinstance(metadata_raw, str):
                print(f"      → Deserializando metadata JSON...")
                try:
                    metadata = json.loads(metadata_raw)
                    print(f"      ✓ Metadata deserializado")
                except json.JSONDecodeError as e:
                    print(f"      ✗ Error deserializando: {e}")
                    return False
            elif isinstance(metadata_raw, dict):
                print(f"      → Metadata ya es dict")
                metadata = metadata_raw
            else:
                print(f"      ✗ Metadata tipo desconocido: {type(metadata_raw)}")
                return False
            
            print(f"      → Keys en metadata: {list(metadata.keys())[:5]}")
            
            regenerated = False
            template_type_str = str(template.template_type)
            
            # ============================================================
            # REGENERACIÓN ANATÓMICA
            # ============================================================
            if template_type_str == 'TemplateType.ANATOMICAL':
                print(f"      → Template ANATÓMICO")
                
                bootstrap_features = metadata.get('bootstrap_features', [])
                print(f"      → bootstrap_features: {bool(bootstrap_features)}")
                
                if not bootstrap_features:
                    print(f"      ✗ NO hay bootstrap_features")
                    return False
                
                if not self.anatomical_network.is_trained:
                    print(f"      ✗ Red anatómica no entrenada")
                    return False
                
                print(f"      ✓ Generando nuevo embedding anatómico...")
                
                features_array = np.array(bootstrap_features, dtype=np.float32)
                print(f"      → Shape inicial: {features_array.shape}")
                
                # Promediar si hay múltiples vectores
                if features_array.ndim == 2:
                    print(f"      → Promediando múltiples vectores")
                    features_array = np.mean(features_array, axis=0)
                    print(f"      → Shape después: {features_array.shape}")
                
                # Generar nuevo embedding
                new_embedding = self.anatomical_network.base_network.predict(
                    features_array.reshape(1, -1), verbose=0
                )[0]
                
                print(f"      → Nuevo embedding shape: {new_embedding.shape}")
                print(f"      → Primeros valores: {new_embedding[:3]}")
                
                # ACTUALIZAR en Supabase
                template.anatomical_embedding = new_embedding
                self.database._save_template(template)
                
                print(f"      ✓✓✓ EMBEDDING ANATÓMICO REGENERADO Y GUARDADO")
                regenerated = True
            
            # ============================================================
            # REGENERACIÓN DINÁMICA
            # ============================================================
            elif template_type_str == 'TemplateType.DYNAMIC':
                print(f"      → Template DINÁMICO")
                
                temporal_sequence = metadata.get('temporal_sequence', [])
                print(f"      → temporal_sequence: {bool(temporal_sequence)}")
                
                if not temporal_sequence:
                    print(f"      ✗ NO hay temporal_sequence")
                    return False
                
                if not self.dynamic_network.is_trained:
                    print(f"      ✗ Red dinámica no entrenada")
                    return False
                
                print(f"      ✓ Generando nuevo embedding dinámico...")
                
                sequence_array = np.array(temporal_sequence, dtype=np.float32)
                print(f"      → Shape inicial: {sequence_array.shape}")
                
                # Ajustar dimensiones (50×320)
                if sequence_array.ndim == 2:
                    seq_length = sequence_array.shape[0]
                    print(f"      → Secuencia 2D, longitud: {seq_length}")
                    
                    if seq_length > 50:
                        print(f"      → Truncando a 50")
                        sequence_array = sequence_array[:50]
                    elif seq_length < 50:
                        print(f"      → Padding a 50")
                        padding = np.zeros((50 - seq_length, 320))
                        sequence_array = np.vstack([sequence_array, padding])
                    
                    print(f"      → Shape final: {sequence_array.shape}")
                    
                    # Generar nuevo embedding
                    new_embedding = self.dynamic_network.base_network.predict(
                        sequence_array.reshape(1, 50, 320), verbose=0
                    )[0]
                    
                    print(f"      → Nuevo embedding shape: {new_embedding.shape}")
                    print(f"      → Primeros valores: {new_embedding[:3]}")
                    
                    # ACTUALIZAR en Supabase
                    template.dynamic_embedding = new_embedding
                    self.database._save_template(template)
                    
                    print(f"      ✓✓✓ EMBEDDING DINÁMICO REGENERADO Y GUARDADO")
                    regenerated = True
                else:
                    print(f"      ✗ Sequence no es 2D")
                    return False
            
            else:
                print(f"      ✗ Tipo desconocido: {template_type_str}")
                return False
            
            return regenerated
            
        except Exception as e:
            print(f"   ✗✗✗ ERROR: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def cleanup_resources(self):
        """
        Limpia recursos del sistema (cámara, MediaPipe, etc).
        """
        try:
            print("\nLimpiando recursos del sistema...")
            
            # Liberar cámara
            try:
                release_camera()
                print("  Cámara liberada")
            except Exception as e:
                logger.warning(f"  Error liberando cámara: {e}")
            
            # Liberar MediaPipe
            try:
                release_mediapipe()
                print("  MediaPipe liberado")
            except Exception as e:
                logger.warning(f"  Error liberando MediaPipe: {e}")
            
            print("Recursos liberados")
            
        except Exception as e:
            logger.error(f"Error en cleanup: {e}")
    
    def regenerate_template(self, user_id: str, template_type: str = 'anatomical') -> Dict[str, Any]:
        """
        Regenera un template específico de un usuario.
        Útil después de reentrenar redes.
        
        Args:
            user_id: ID del usuario
            template_type: Tipo de template ('anatomical' o 'dynamic')
        
        Returns:
            Dict con resultado de la operación
        """
        result = {
            'success': False,
            'message': ''
        }
        
        try:
            if not self.database or not self.state.networks_trained:
                result['message'] = "Sistema no listo para regenerar templates"
                return result
            
            # Obtener templates del usuario
            templates = self.database.get_user_templates(user_id, template_type)
            
            if not templates:
                result['message'] = f"No se encontraron templates {template_type} para usuario {user_id}"
                return result
            
            regenerated_count = 0
            
            for template in templates:
                metadata = template.metadata or {}
                
                # REGENERACIÓN ANATÓMICA
                if template_type == 'anatomical':
                    raw_features_list = metadata.get('raw_anatomical_features', [])
                    
                    if raw_features_list and self.anatomical_network.is_trained:
                        try:
                            # Promediar características
                            avg_features = np.mean(raw_features_list, axis=0)
                            
                            if len(avg_features) == self.anatomical_network.input_dim:
                                # Regenerar embedding
                                new_embedding = self.anatomical_network.base_network.predict(
                                    avg_features.reshape(1, -1)
                                )[0]
                                
                                # Actualizar template
                                template.anatomical_embedding = new_embedding
                                self.database._save_template(template)
                                
                                regenerated_count += 1
                                print(f"Template anatómico regenerado para {user_id}")
                        except Exception as e:
                            logger.error(f"Error regenerando template anatómico: {e}")
                
                # REGENERACIÓN DINÁMICA
                elif template_type == 'dynamic':
                    temporal_sequence = metadata.get('temporal_sequence', [])
                    
                    if temporal_sequence and self.dynamic_network.is_trained:
                        try:
                            sequence_array = np.array(temporal_sequence, dtype=np.float32)
                            
                            # Ajustar dimensiones
                            expected_seq_length = self.dynamic_network.sequence_length
                            expected_feature_dim = self.dynamic_network.feature_dim
                            
                            if len(sequence_array.shape) == 2:
                                seq_length, feature_dim = sequence_array.shape
                                
                                # Ajustar longitud
                                if seq_length > expected_seq_length:
                                    sequence_array = sequence_array[:expected_seq_length]
                                elif seq_length < expected_seq_length:
                                    padding = np.zeros((expected_seq_length - seq_length, feature_dim))
                                    sequence_array = np.vstack([sequence_array, padding])
                                
                                # Ajustar features
                                if feature_dim > expected_feature_dim:
                                    sequence_array = sequence_array[:, :expected_feature_dim]
                                elif feature_dim < expected_feature_dim:
                                    padding = np.zeros((sequence_array.shape[0], expected_feature_dim - feature_dim))
                                    sequence_array = np.hstack([sequence_array, padding])
                                
                                # Regenerar embedding
                                sequence_input = sequence_array.reshape(1, expected_seq_length, expected_feature_dim)
                                new_embedding = self.dynamic_network.base_network.predict(sequence_input)[0]
                                
                                # Actualizar template
                                template.dynamic_embedding = new_embedding
                                self.database._save_template(template)
                                
                                regenerated_count += 1
                                print(f"Template dinámico regenerado para {user_id}")
                        except Exception as e:
                            logger.error(f"Error regenerando template dinámico: {e}")
            
            if regenerated_count > 0:
                result['success'] = True
                result['message'] = f"{regenerated_count} template(s) regenerado(s)"
            else:
                result['message'] = "No se pudieron regenerar templates"
            
            return result
            
        except Exception as e:
            result['message'] = f"Error: {str(e)}"
            logger.error(f"Error regenerando templates: {e}")
            return result
    
    def get_database_statistics(self) -> Dict[str, Any]:
        """
        Obtiene estadísticas completas de la base de datos.
        
        Returns:
            Dict con estadísticas
        """
        if not self.database:
            return {}
        
        try:
            stats = self.database.get_database_stats()
            return stats
        except Exception as e:
            logger.error(f"Error obteniendo estadísticas: {e}")
            return {}


    # ====================================================================
    # MÉTODOS DE ENROLLMENT (WRAPPERS PARA LA API)
    # ====================================================================

    def start_enrollment_session(
            self, 
            user_id: str, 
            username: str,
            email: Optional[str] = None,
            phone_number: Optional[str] = None,
            age: Optional[int] = None,
            gender: Optional[str] = None,
            gesture_sequence: Optional[List[str]] = None,
            session_token: Optional[str] = None,
            callback_url: Optional[str] = None
        ) -> Dict[str, Any]:
        """
        Inicia sesión de enrollment (wrapper para la API).
        
        Args:
            user_id: ID del usuario
            username: Nombre del usuario
            email: Correo electrónico del usuario (opcional)
            phone_number: Teléfono del usuario (opcional)
            age: Edad del usuario (opcional)
            gender: Género del usuario (opcional)
            gesture_sequence: Secuencia de gestos (opcional)
        
        Returns:
            Dict con información de la sesión
        """
        try:
            if not self.enrollment_system:
                return {
                    'success': False,
                    'message': 'Sistema de enrollment no disponible'
                }
            
            # Usar secuencia por defecto si no se proporciona
            if not gesture_sequence:
                gesture_sequence = ["thumbs_up", "peace", "ok"]
            
            # Iniciar enrollment (pasando los nuevos datos)
            session_id = self.enrollment_system.start_real_enrollment(
                user_id=user_id,
                username=username,
                email=email,              # Nuevo
                phone_number=phone_number,              # Nuevo
                age=age,                  # Nuevo
                gender=gender,            # Nuevo
                gesture_sequence=gesture_sequence,
                session_token=session_token,    # NUEVO
                callback_url=callback_url,      # NUEVO
                progress_callback=None,
                error_callback=None
            )
            
            # Obtener información de la sesión
            session = self.enrollment_system.active_sessions.get(session_id)
            
            if not session:
                return {
                    'success': False,
                    'message': 'Error obteniendo sesión'
                }
            
            return {
                'success': True,
                'message': 'Sesión iniciada correctamente',
                'session': {
                    'session_id': session_id,
                    'user_id': user_id,
                    'username': username,
                    'email': email,                    # Nuevo
                    'phone_number': phone_number,                    # Nuevo
                    'age': age,                        # Nuevo
                    'gender': gender,                  # Nuevo
                    'gesture_sequence': gesture_sequence,
                    'total_gestures': len(gesture_sequence),
                    'samples_per_gesture': self.enrollment_system.config.samples_per_gesture,
                    'total_samples_needed': len(gesture_sequence) * self.enrollment_system.config.samples_per_gesture,
                    'bootstrap_mode': self.enrollment_system.bootstrap_mode
                }
            }
            
        except Exception as e:
            print(f"Error iniciando enrollment session: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'message': f'Error: {str(e)}'
            }

    def process_enrollment_frame(self, session_id: str, frame: np.ndarray, 
                                current_gesture_index: int) -> Dict[str, Any]:
        """
        Procesa un frame de enrollment (wrapper para la API).
        
        Args:
            session_id: ID de la sesión
            frame: Frame de la cámara (numpy array BGR)
            current_gesture_index: Índice del gesto actual
        
        Returns:
            Dict con resultado del procesamiento
        """
        try:
            if not self.enrollment_system:
                return {
                    'success': False,
                    'message': 'Sistema de enrollment no disponible'
                }
            
            # Procesar frame usando el método correcto
            result = self.enrollment_system.process_enrollment_frame_with_image(
                session_id=session_id,
                frame_image=frame
            )
            
            # Adaptar respuesta al formato esperado por la API
            session = self.enrollment_system.active_sessions.get(session_id)
            
            if not session:
                return {
                    'success': False,
                    'message': 'Sesión no encontrada',
                    'error': 'Session not found'
                }
            
            samples_this_gesture = len([
                s for s in session.samples 
                if s.gesture_name == session.current_gesture
            ])
            
            gesture_completed = samples_this_gesture >= self.enrollment_system.config.samples_per_gesture
            all_completed = session.status.value == 'completed'
            
            return {
                'success': result.get('sample_captured', False) or True,
                'message': result.get('message', 'Frame procesado'),
                'current_gesture': session.current_gesture,
                'current_gesture_index': session.current_gesture_index,
                'samples_captured': samples_this_gesture,
                'samples_needed': self.enrollment_system.config.samples_per_gesture,
                'gesture_completed': gesture_completed,
                'all_gestures_completed': all_completed,
                'quality_score': result.get('quality_score'),
                'feedback': result.get('message'),
                'error': result.get('error')
            }
            
        except Exception as e:
            print(f"Error procesando frame: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'message': f'Error: {str(e)}',
                'error': str(e)
            }

    def get_enrollment_session_status(self, session_id: str) -> Dict[str, Any]:
        """
        Obtiene estado de una sesión de enrollment.
        
        Args:
            session_id: ID de la sesión
        
        Returns:
            Dict con estado de la sesión
        """
        try:
            if not self.enrollment_system:
                return {
                    'success': False,
                    'message': 'Sistema de enrollment no disponible'
                }
            
            session = self.enrollment_system.active_sessions.get(session_id)
            
            if not session:
                return {
                    'success': False,
                    'message': 'Sesión no encontrada'
                }
            
            samples_this_gesture = len([
                s for s in session.samples 
                if s.gesture_name == session.current_gesture
            ])
            
            return {
                'success': True,
                'message': 'Estado obtenido',
                'session': {
                    'active': session.status.value in ['in_progress', 'collecting_samples'],
                    'user_id': session.user_id,
                    'username': session.username,
                    'current_gesture': session.current_gesture,
                    'current_gesture_index': session.current_gesture_index,
                    'total_gestures': len(session.gesture_sequence),
                    'samples_captured': samples_this_gesture,
                    'samples_needed': self.enrollment_system.config.samples_per_gesture,
                    'progress_percentage': session.progress_percentage
                }
            }
            
        except Exception as e:
            print(f"Error obteniendo estado: {e}")
            return {
                'success': False,
                'message': f'Error: {str(e)}'
            }

    def complete_enrollment_session(self, session_id: str) -> Dict[str, Any]:
        """
        Completa una sesión de enrollment.
        
        Args:
            session_id: ID de la sesión
        
        Returns:
            Dict con resultado
        """
        try:
            if not self.enrollment_system:
                return {
                    'success': False,
                    'message': 'Sistema de enrollment no disponible'
                }
            
            session = self.enrollment_system.active_sessions.get(session_id)
            
            if not session:
                return {
                    'success': False,
                    'message': 'Sesión no encontrada'
                }
            
            # Finalizar enrollment
            self.enrollment_system.workflow._finalize_real_enrollment(session)
            
            return {
                'success': True,
                'message': 'Enrollment completado',
                'user_id': session.user_id,
                'username': session.username,
                'templates_created': len(session.samples),
                'enrollment_time': session.duration
            }
            
        except Exception as e:
            print(f"Error completando enrollment: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'message': f'Error: {str(e)}'
            }

    def cancel_enrollment_session(self, session_id: str) -> Dict[str, Any]:
        """
        Cancela una sesión de enrollment.
        
        Args:
            session_id: ID de la sesión
        
        Returns:
            Dict con resultado
        """
        try:
            if not self.enrollment_system:
                return {
                    'success': False,
                    'message': 'Sistema de enrollment no disponible'
                }
            
            success = self.enrollment_system.cancel_enrollment(session_id)
            
            return {
                'success': success,
                'message': 'Sesión cancelada' if success else 'Error cancelando sesión'
            }
            
        except Exception as e:
            print(f"Error cancelando enrollment: {e}")
            return {
                'success': False,
                'message': f'Error: {str(e)}'
            }

    def list_enrollment_sessions(self) -> List[Dict[str, Any]]:
        """Lista todas las sesiones activas."""
        try:
            if not self.enrollment_system:
                return []
            
            sessions = []
            for session_id, session in self.enrollment_system.active_sessions.items():
                sessions.append({
                    'session_id': session_id,
                    'user_id': session.user_id,
                    'username': session.username,
                    'status': session.status.value,
                    'progress': session.progress_percentage
                })
            
            return sessions
            
        except Exception as e:
            print(f"Error listando sesiones: {e}")
            return []

    def get_available_gestures(self) -> List[str]:
        """Obtiene lista de gestos disponibles."""
        return ["thumbs_up", "peace", "ok", "fist", "palm"]

    def get_enrollment_config(self) -> Dict[str, Any]:
        """Obtiene configuración de enrollment."""
        try:
            if not self.enrollment_system:
                return {}
            
            return {
                'samples_per_gesture': self.enrollment_system.config.samples_per_gesture,
                'quality_threshold': self.enrollment_system.config.quality_threshold,
                'min_confidence': self.enrollment_system.config.min_confidence,
                'bootstrap_mode': self.enrollment_system.bootstrap_mode
            }
            
        except Exception as e:
            print(f"Error obteniendo config: {e}")
            return {}
    
# ====================================================================
# FUNCIONES GLOBALES
# ====================================================================

_system_manager_instance = None

def get_system_manager() -> BiometricSystemManager:
    """
    Obtiene la instancia global del gestor del sistema.
    
    Returns:
        BiometricSystemManager: Instancia única del gestor (Singleton)
    """
    global _system_manager_instance
    
    if _system_manager_instance is None:
        _system_manager_instance = BiometricSystemManager()
    
    return _system_manager_instance


def initialize_system_on_startup() -> bool:
    """
    Función helper para inicializar el sistema al arrancar FastAPI.
    Llama a initialize_system() del manager global.
    
    Returns:
        bool: True si la inicialización fue exitosa
    """
    manager = get_system_manager()
    return manager.initialize_system()


def get_system_status() -> Dict[str, Any]:
    """
    Obtiene el estado actual del sistema (función helper).
    
    Returns:
        Dict con el estado del sistema
    """
    manager = get_system_manager()
    return manager.get_system_status()


def cleanup_system_resources():
    """
    Limpia recursos del sistema (función helper para shutdown).
    """
    manager = get_system_manager()
    manager.cleanup_resources()