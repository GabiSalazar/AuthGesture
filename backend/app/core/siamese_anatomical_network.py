# =============================================================================
# MÓDULO 9: SIAMESE_ANATOMICAL_NETWORK
# Red Siamesa para características anatómicas
# =============================================================================
import os
import numpy as np
import logging
from typing import List, Dict, Tuple, Optional, Any, Union
from dataclasses import dataclass, field
from enum import Enum
import time
import json
from pathlib import Path
import math


# TensorFlow/Keras imports
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers, Model, optimizers, callbacks
    from tensorflow.keras.metrics import binary_accuracy
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    logging.warning("TensorFlow no disponible - red siamesa anatómica limitada")

# Scikit-learn imports
try:
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import roc_curve, auc, confusion_matrix, accuracy_score
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logging.warning("Scikit-learn no disponible - métricas limitadas")

# Importar módulos anteriores
try:
    from app.core.config_manager import get_config, get_logger, log_error, log_info
    from app.core.anatomical_features_extractor import AnatomicalFeatureVector, get_anatomical_features_extractor
except ImportError:
    def get_config(key, default=None): 
        return default
    def get_logger(): 
        return print
    def log_error(msg, exc=None): 
        logging.error(f"ERROR: {msg}")
    def log_info(msg): 
        logging.info(f"INFO: {msg}")

# Logger
logger = logging.getLogger(__name__)


class DistanceMetric(Enum):
    """Métricas de distancia para redes siamesas."""
    EUCLIDEAN = "euclidean"
    COSINE = "cosine"
    MANHATTAN = "manhattan"
    MINKOWSKI = "minkowski"


class LossFunction(Enum):
    """Funciones de pérdida para entrenamiento."""
    CONTRASTIVE = "contrastive"
    TRIPLET = "triplet"
    BINARY_CROSSENTROPY = "binary_crossentropy"


class TrainingMode(Enum):
    """Modos de entrenamiento."""
    GENUINE_IMPOSTOR = "genuine_impostor"
    TRIPLET_LOSS = "triplet_loss"
    CLASSIFICATION = "classification"


@dataclass
class RealBiometricSample:
    """Muestra biométrica con características anatómicas."""
    user_id: str
    sample_id: str
    features: np.ndarray
    gesture_name: str
    confidence: float
    timestamp: float
    hand_side: str = "unknown"
    quality_score: float = 1.0
    session_id: str = "default"
    capture_conditions: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RealTrainingPair:
    """Par de entrenamiento para red siamesa."""
    sample1: RealBiometricSample
    sample2: RealBiometricSample
    is_genuine: bool
    distance: Optional[float] = None


@dataclass
class RealModelMetrics:
    """Métricas de evaluación del modelo."""
    far: float
    frr: float
    eer: float
    auc_score: float
    accuracy: float
    threshold: float
    precision: float
    recall: float
    f1_score: float
    
    total_genuine_pairs: int
    total_impostor_pairs: int
    users_in_test: int
    cross_validation_score: float
    roc_fpr: List[float] = field(default_factory=list)
    roc_tpr: List[float] = field(default_factory=list)


@dataclass
class RealTrainingHistory:
    """Historial de entrenamiento."""
    loss: List[float] = field(default_factory=list)
    val_loss: List[float] = field(default_factory=list)
    accuracy: List[float] = field(default_factory=list)
    val_accuracy: List[float] = field(default_factory=list)
    learning_rate: List[float] = field(default_factory=list)
    epoch_times: List[float] = field(default_factory=list)
    
    far_history: List[float] = field(default_factory=list)
    frr_history: List[float] = field(default_factory=list)
    eer_history: List[float] = field(default_factory=list)
    best_epoch: int = 0
    total_training_time: float = 0.0

class RealSiameseAnatomicalNetwork:
    """
    Red Siamesa para autenticación biométrica basada en características anatómicas.
    Implementa arquitectura twin network para comparar características únicas de manos.
    """
    
    def __init__(self, embedding_dim: int = 64, input_dim: int = 180):
        """Inicializa la red siamesa anatómica REAL."""
        
        if not TF_AVAILABLE:
            raise ImportError("TensorFlow no disponible - no se puede usar red siamesa")
        
        self.logger = get_logger()
        
        # Configuración del modelo
        self.embedding_dim = embedding_dim
        self.input_dim = input_dim
        self.config = self._load_real_siamese_config()
        
        # Arquitectura del modelo
        self.base_network = None
        self.siamese_model = None
        self.is_compiled = False
        
        # Estado de entrenamiento
        self.training_history = RealTrainingHistory()
        self.is_trained = False
        self.optimal_threshold = 0.5
        
        # Dataset y métricas
        self.real_training_samples: List[RealBiometricSample] = []
        self.real_validation_samples: List[RealBiometricSample] = []
        self.current_metrics: Optional[RealModelMetrics] = None
        
        # Rutas de guardado
        self.model_save_path = self._get_real_model_save_path()
        
        # Estadísticas de entrenamiento
        self.users_trained_count = 0
        self.total_genuine_pairs = 0
        self.total_impostor_pairs = 0
        
        print("RealSiameseAnatomicalNetwork inicializada")
    
    def _load_real_siamese_config(self) -> Dict[str, Any]:
        """Carga configuración de la red siamesa anatómica."""
        default_config = {
            # Arquitectura de red
            'hidden_layers': [128, 64],
            'activation': 'relu',
            'dropout_rate': 0.2,
            'batch_normalization': True,
            'l2_regularization': 0.001,
            
            # Entrenamiento
            'learning_rate': 0.001,
            'batch_size': 32,
            'epochs': 100,
            'patience': 15,
            'validation_split': 0.2,
            
            # Requisitos para datos 
            'min_users_for_training': 2,
            'min_samples_per_user': 15,
            'max_samples_per_user': 50,
            'min_sessions_per_user': 1,
            
            # Función de pérdida y optimización
            'loss_function': 'contrastive',
            'distance_metric': 'euclidean',
            'margin': 1.5,
            'alpha': 0.2,
            
            # Validación
            'use_stratified_split': True,
            'cross_validation_folds': 5,
            'threshold_optimization': 'eer',
            'quality_threshold': 80.0,
            
            # Augmentación
            'use_real_augmentation': True,
            'temporal_jitter': 0.02,
            'noise_from_real_variance': True,
            
            # Evaluación
            'require_independent_test': True,
            'min_test_users': 1,
            'performance_monitoring': True,
        }
        
        return get_config('biometric.siamese_anatomical', default_config)
    
    def _get_real_model_save_path(self) -> str:
        """Obtiene ruta REAL para guardar modelo entrenado."""
        models_dir = get_config('paths.models', 'biometric_data/models')
        return str(Path(models_dir) / 'anatomical_model.h5')
    
    def load_real_training_data_from_database(self, database) -> bool:
        """
        Carga datos anatómicos desde la base de datos biométrica.
        Procesa templates anatómicos y extrae características de 180D.
        """
        try:
            print("=== CARGANDO DATOS ANATÓMICOS DESDE BASE DE DATOS ===")
            
            # Obtener todos los usuarios
            real_users = database.list_users()
            
            if len(real_users) < self.config.get('min_users_for_training', 2):
                print(f"Insuficientes usuarios: {len(real_users)} < 2")
                return False
            
            print(f"Usuarios encontrados: {len(real_users)}")
            
            # Limpiar muestras existentes
            self.real_training_samples.clear()
            
            users_with_sufficient_data = 0
            total_samples_loaded = 0
            
            for user in real_users:
                try:
                    print(f"Procesando usuario: {user.username} ({user.user_id})")
                    
                    # Obtener todos los templates del usuario
                    user_templates_list = []
                    for template_id, template in database.templates.items():
                        if template.user_id == user.user_id:
                            user_templates_list.append(template)
                    
                    if not user_templates_list:
                        print(f"   Usuario {user.user_id} sin templates")
                        continue
                    
                    print(f"   Templates encontrados: {len(user_templates_list)}")
                    
                    # Filtrar templates anatómicos
                    anatomical_templates = []
                    dynamic_templates = []
                    for template in user_templates_list:
                        template_type_str = str(template.template_type)
                        template_id = template.template_id
                        
                        if ('anatomical' in template_type_str.lower() and 
                            '_bootstrap_dynamic_' not in template_id):
                            anatomical_templates.append(template)
                        elif 'dynamic' in template_type_str.lower():
                            dynamic_templates.append(template)
                            
                    print(f"   Templates anatómicos: {len(anatomical_templates)}")
                    print(f"   Templates dinámicos: {len(dynamic_templates)} (omitidos - red anatómica)")

                    
                    # Procesar templates anatómicos
                    user_anatomical_samples = []
                    
                    for template in anatomical_templates:
                        try:
                            bootstrap_features = template.metadata.get('bootstrap_features', None)
                            
                            if bootstrap_features is not None:
                                features_to_process = []
                                
                                if isinstance(bootstrap_features, list) and len(bootstrap_features) > 0:
                                    if isinstance(bootstrap_features[0], list):
                                        features_to_process = bootstrap_features
                                    elif isinstance(bootstrap_features[0], (int, float)):
                                        if len(bootstrap_features) == 180:
                                            features_to_process = [bootstrap_features]
                                
                                for idx, anatomical_features in enumerate(features_to_process):
                                    if len(anatomical_features) == 180:
                                        anatomical_sample = RealBiometricSample(
                                            user_id=user.user_id,
                                            sample_id=f"{template.template_id}_{idx}",
                                            features=np.array(anatomical_features, dtype=np.float32),
                                            gesture_name=template.gesture_name,
                                            confidence=template.confidence,
                                            timestamp=getattr(template, 'created_at', time.time()),
                                            quality_score=template.quality_score,
                                            metadata={
                                                'data_source': template.metadata.get('data_source', 'enrollment_capture'),
                                                'bootstrap_mode': template.metadata.get('bootstrap_mode', True),
                                                'feature_dimension': len(anatomical_features),
                                                'template_id': template.template_id,
                                                'sample_index': idx
                                            }
                                        )
                                        
                                        user_anatomical_samples.append(anatomical_sample)
                        
                        except Exception as e:
                            print(f"   Error procesando template {template.template_id}: {e}")
                            continue
                    
                    # Validar usuario con datos suficientes
                    min_anatomical_samples = max(3, self.config.get('min_samples_per_user', 15) // 5)
                    
                    if len(user_anatomical_samples) >= min_anatomical_samples:
                        users_with_sufficient_data += 1
                        total_samples_loaded += len(user_anatomical_samples)
                        self.real_training_samples.extend(user_anatomical_samples)
                        
                        # Calcular estadísticas por gesto
                        gesture_counts = {}
                        for sample in user_anatomical_samples:
                            gesture_name = sample.gesture_name
                            if gesture_name not in gesture_counts:
                                gesture_counts[gesture_name] = 0
                            gesture_counts[gesture_name] += 1
                            
                        print(f"Usuario anatómico válido: {user.username}")
                        print(f"   Muestras anatómicas: {len(user_anatomical_samples)}")
                        print(f"   Gestos únicos: {len(gesture_counts)}")
                        for gesture, count in gesture_counts.items():
                            print(f"      • {gesture}: {count} muestras anatómicas")
                    else:
                        logger.warning(f"   Usuario {user.user_id} con pocas muestras anatómicas: {len(user_anatomical_samples)} < {min_anatomical_samples}")
                    
                except Exception as e:
                    print(f"Error procesando usuario {user.user_id}: {e}")
                    continue
            
            # Validación final
            min_users_required = self.config.get('min_users_for_training', 2)
            min_total_samples = 6
            
            if users_with_sufficient_data < min_users_required:
                print("USUARIOS INSUFICIENTES PARA ENTRENAMIENTO")
                return False
            
            if total_samples_loaded < min_total_samples:
                print("MUESTRAS ANATÓMICAS INSUFICIENTES")
                return False
            
            print(f"Total muestras cargadas: {len(self.real_training_samples)} (sin dividir)")

            # Actualizar contador de usuarios
            self.users_trained_count = users_with_sufficient_data
            
            print("=" * 60)
            print("DATOS ANATÓMICOS REALES CARGADOS")
            print("=" * 60)
            print(f"Usuarios: {users_with_sufficient_data}")
            print(f"Total muestras: {total_samples_loaded}")
            print(f"Promedio por usuario: {total_samples_loaded/users_with_sufficient_data:.1f}")
            print("=" * 60)
            
            # Estadísticas detalladas por gesto
            gesture_stats = {}
            all_samples = self.real_training_samples + self.real_validation_samples
            for sample in all_samples:
                gesture_name = sample.gesture_name
                if gesture_name not in gesture_stats:
                    gesture_stats[gesture_name] = 0
                gesture_stats[gesture_name] += 1
            
            print(f"DISTRIBUCIÓN POR GESTO:")
            for gesture, count in gesture_stats.items():
                print(f"   • {gesture}: {count} muestras anatómicas")
            
            # Estadísticas por usuario
            user_stats = {}
            for sample in all_samples:
                if sample.user_id not in user_stats:
                    user_stats[sample.user_id] = 0
                user_stats[sample.user_id] += 1
            
            print(f"DISTRIBUCIÓN POR USUARIO:")
            for user_id, count in user_stats.items():
                user_name = next((u.username for u in real_users if u.user_id == user_id), user_id)
                print(f"   • {user_name} ({user_id}): {count} muestras")

            # CORRECCIÓN: Actualizar contador de usuarios entrenados
            self.users_trained_count = len(user_stats)
            print(f"Usuarios con datos suficientes registrados: {self.users_trained_count}")
            
            return True
            
        except Exception as e:
            print(f"ERROR CARGANDO DATOS: {e}")
            return False
        
    def validate_real_data_quality(self) -> bool:
        """Valida calidad de los datos cargados."""
        try:
            if not self.real_training_samples:
                print("No hay datos para validar")
                return False
            
            # Agrupar por usuario
            users_data = {}
            for sample in self.real_training_samples:
                if sample.user_id not in users_data:
                    users_data[sample.user_id] = []
                users_data[sample.user_id].append(sample)
            
            quality_issues = []
            
            # 1. Verificar variabilidad inter-usuario
            all_features = np.array([sample.features for sample in self.real_training_samples])
            user_means = {}
            for user_id, samples in users_data.items():
                user_features = np.array([s.features for s in samples])
                user_means[user_id] = np.mean(user_features, axis=0)
            
            user_ids = list(user_means.keys())
            min_inter_user_distance = float('inf')
            
            for i in range(len(user_ids)):
                for j in range(i + 1, len(user_ids)):
                    distance = np.linalg.norm(user_means[user_ids[i]] - user_means[user_ids[j]])
                    min_inter_user_distance = min(min_inter_user_distance, distance)
            
            if min_inter_user_distance < 0.1:
                quality_issues.append(f"Usuarios muy similares (distancia: {min_inter_user_distance:.4f})")
            
            # 2. Verificar variabilidad intra-usuario
            for user_id, samples in users_data.items():
                if len(samples) > 1:
                    user_features = np.array([s.features for s in samples])
                    user_std = np.std(user_features, axis=0)
                    mean_std = np.mean(user_std)
                    
                    num_users = len(users_data)
                    if num_users <= 2:
                        variability_threshold = 6.0
                    elif num_users <= 5:
                        variability_threshold = 6.0
                    else:
                        variability_threshold = 4.5
                    
                    if mean_std > variability_threshold:
                        quality_issues.append(f"Usuario {user_id} con alta variabilidad: {mean_std:.4f}")
                    elif mean_std < 0.001:
                        quality_issues.append(f"Usuario {user_id} con baja variabilidad: {mean_std:.6f}")
            
            # 3. Verificar distribución de gestos
            gesture_distribution = {}
            for sample in self.real_training_samples:
                gesture = sample.gesture_name
                if gesture not in gesture_distribution:
                    gesture_distribution[gesture] = 0
                gesture_distribution[gesture] += 1
            
            if len(gesture_distribution) < 3:
                quality_issues.append(f"Pocos tipos de gestos: {len(gesture_distribution)}")
            
            quality_scores = [getattr(s, 'quality_score', 1.0) for s in self.real_training_samples]

            # 4. Verificar calidad de muestras individuales
            low_quality_samples = []
            
            for sample in self.real_training_samples:
                quality = getattr(sample, 'quality_score', 1.0)
                if quality <= 1.5:
                    if quality < 0.8:
                        low_quality_samples.append(sample)
                else:
                    if quality < 80.0:
                        low_quality_samples.append(sample)
            
            if len(low_quality_samples) > len(self.real_training_samples) * 0.2:
                quality_issues.append(f"Muchas muestras de baja calidad: {len(low_quality_samples)}/{len(self.real_training_samples)}")
            
            # Verificar sesiones por usuario (relajado para few-shot learning)
            session_counts = {}
            for user_id, samples in users_data.items():
                sessions = set(getattr(s, 'session_id', 'default') for s in samples)
                session_counts[user_id] = len(sessions)
                
                if len(sessions) < 1:
                    # Solo advertencia, no error crítico para few-shot learning
                    print(f"Usuario {user_id} con {len(sessions)} sesión(es) - OK para redes siamesas")
                    
            # Reportar resultados
            if quality_issues:
                print("Problemas de calidad detectados:")
                for issue in quality_issues:
                    print(f"  - {issue}")
                return False
            
            print("✓ Validación de calidad de datos: EXITOSA")
            print(f"  - Usuarios: {len(users_data)}")
            print(f"  - Distancia mínima inter-usuario: {min_inter_user_distance:.4f}")
            print(f"  - Tipos de gestos: {len(gesture_distribution)}")
            print(f"  - Distribución de gestos: {gesture_distribution}")
            print(f"  - Sesiones promedio por usuario: {np.mean(list(session_counts.values())):.1f}")
            
            return True
            
        except Exception as e:
            print(f"Error validando calidad: {e}")
            return False
    
    def create_real_training_pairs(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Crea pares de entrenamiento genuinos e impostores."""
        try:
            if not self.real_training_samples:
                raise ValueError("No hay muestras para crear pares")
            
            print("Creando pares de entrenamiento...")
            
            # Agrupar muestras por usuario
            real_user_samples = {}
            for sample in self.real_training_samples:
                if sample.user_id not in real_user_samples:
                    real_user_samples[sample.user_id] = []
                real_user_samples[sample.user_id].append(sample)
            
            # Filtrar usuarios con suficientes muestras
            min_samples = self.config['min_samples_per_user']
            valid_real_users = {uid: samples for uid, samples in real_user_samples.items() 
                               if len(samples) >= min_samples}
            
            if len(valid_real_users) < 2:
                raise ValueError(f"Redes siamesas necesitan mínimo 2 usuarios con {min_samples}+ muestras")
            
            real_pairs = []
            
            # Crear pares genuinos (misma persona)
            genuine_pairs_created = 0
            for user_id, samples in valid_real_users.items():
                user_genuine_pairs = 0
                
                for i in range(len(samples)):
                    for j in range(i + 1, len(samples)):
                        session_i = getattr(samples[i], 'session_id', 'default')
                        session_j = getattr(samples[j], 'session_id', 'default')
                        
                        if session_i != session_j or (session_i == 'default' and session_j == 'default'):
                            real_pairs.append(RealTrainingPair(samples[i], samples[j], is_genuine=True))
                            user_genuine_pairs += 1
                            genuine_pairs_created += 1
                
                print(f"Usuario {user_id}: {user_genuine_pairs} pares genuinos")
            
            # Crear pares impostores (personas diferentes)
            user_ids = list(valid_real_users.keys())
            impostor_pairs_created = 0
            
            if len(user_ids) == 2:
                # Caso especial: 2 usuarios
                user_id1, user_id2 = user_ids[0], user_ids[1]
                samples1 = valid_real_users[user_id1]
                samples2 = valid_real_users[user_id2]
                
                max_possible_impostors = len(samples1) * len(samples2)
                target_impostor_pairs = min(
                    max_possible_impostors,
                    int(genuine_pairs_created * 0.7)
                )
                
                print(f"Modo 2 usuarios: Creando {target_impostor_pairs} pares impostores de {max_possible_impostors} posible")
                
                pairs_created = 0
                for s1 in samples1:
                    for s2 in samples2:
                        if pairs_created < target_impostor_pairs:
                            real_pairs.append(RealTrainingPair(s1, s2, is_genuine=False))
                            pairs_created += 1
                            impostor_pairs_created += 1
                        else:
                            break
                    if pairs_created >= target_impostor_pairs:
                        break
            # else:
            #     # Caso normal: 3+ usuarios
            #     target_impostor_pairs = max(
            #         int(genuine_pairs_created * 0.4),
            #         min(genuine_pairs_created, 200)
            #     )
                
            #     for i, user_id1 in enumerate(user_ids):
            #         for j, user_id2 in enumerate(user_ids[i + 1:], i + 1):
            #             samples1 = valid_real_users[user_id1]
            #             samples2 = valid_real_users[user_id2]
                        
            #             max_pairs_between = min(50, len(samples1) * len(samples2) // 2)
            #             pairs_between = 0
            else:
                # Caso normal: 3+ usuarios
                target_impostor_pairs = max(
                    int(genuine_pairs_created * 0.4),
                    min(genuine_pairs_created, 200)
                )
                
                # CÁLCULO DINÁMICO: Distribuir target entre combinaciones
                n_user_combinations = len(user_ids) * (len(user_ids) - 1) // 2
                pairs_per_combination = math.ceil(target_impostor_pairs / n_user_combinations)
                
                print(f"Distribución dinámica: {target_impostor_pairs} pares entre {n_user_combinations} combinaciones")
                print(f"Objetivo por combinación: {pairs_per_combination} pares")
                
                for i, user_id1 in enumerate(user_ids):
                    for j, user_id2 in enumerate(user_ids[i + 1:], i + 1):
                        samples1 = valid_real_users[user_id1]
                        samples2 = valid_real_users[user_id2]
                        
                        # Límite físico: lo máximo posible entre estos dos usuarios
                        max_possible_between = len(samples1) * len(samples2) // 2
                        # Límite efectivo: el menor entre lo calculado y lo posible
                        max_pairs_between = min(pairs_per_combination, max_possible_between)
                        pairs_between = 0
                        
                        for s1 in samples1:
                            for s2 in samples2:
                                if impostor_pairs_created < target_impostor_pairs and pairs_between < max_pairs_between:
                                    real_pairs.append(RealTrainingPair(s1, s2, is_genuine=False))
                                    impostor_pairs_created += 1
                                    pairs_between += 1
                                else:
                                    break
                            if pairs_between >= max_pairs_between:
                                break
                        
                        if impostor_pairs_created >= target_impostor_pairs:
                            break
                    if impostor_pairs_created >= target_impostor_pairs:
                        break
            
            # Validación
            min_impostor_ratio = 0.15 if len(user_ids) == 2 else 0.2
            
            if impostor_pairs_created < genuine_pairs_created * min_impostor_ratio:
                logger.warning(f"Balance subóptimo: {impostor_pairs_created} impostores vs {genuine_pairs_created} genuinos")
                logger.warning(f"Ratio: {impostor_pairs_created/(genuine_pairs_created + impostor_pairs_created):.1%}")

                if impostor_pairs_created < 10:
                    raise ValueError("Balance inadecuado para entrenamiento")
            else:
                print(f"Balance aceptable: {impostor_pairs_created} impostores ({impostor_pairs_created/(genuine_pairs_created + impostor_pairs_created):.1%})")
                
            # Convertir a arrays numpy
            features_a = np.array([pair.sample1.features for pair in real_pairs])
            features_b = np.array([pair.sample2.features for pair in real_pairs])
            labels = np.array([1.0 if pair.is_genuine else 0.0 for pair in real_pairs])
            
            # Shuffle
            indices = np.random.permutation(len(labels))
            features_a = features_a[indices]
            features_b = features_b[indices]
            labels = labels[indices]
            
            self.total_genuine_pairs = genuine_pairs_created
            self.total_impostor_pairs = impostor_pairs_created
            
            print(f"Pares creados exitosamente:")
            print(f"  - Genuinos: {genuine_pairs_created}")
            print(f"  - Impostores: {impostor_pairs_created}")
            print(f"  - Total: {len(real_pairs)}")
            print(f"  - Usuarios involucrados: {len(valid_real_users)}")
            print(f"  - Ratio genuinos/impostores: {genuine_pairs_created/impostor_pairs_created:.2f}" if impostor_pairs_created > 0 else "  - Solo pares genuinos")
            
            return features_a, features_b, labels
            
        except Exception as e:
            print(f"Error creando pares de entrenamiento: {e}")
            raise
        
    def build_real_base_network(self) -> Model:
        """Construye la red base para embeddings anatómicos."""
        try:
            print("Construyendo red base para características anatómicas...")
            
            # Input layer
            input_layer = layers.Input(shape=(self.input_dim,), name='anatomical_features_real')
            
            x = input_layer
            
            # Normalización de entrada
            x = layers.BatchNormalization(name='input_normalization')(x)
            
            # Capas ocultas progresivas
            for i, units in enumerate(self.config['hidden_layers']):
                x = layers.Dense(
                    units,
                    activation=self.config['activation'],
                    kernel_regularizer=keras.regularizers.l2(self.config['l2_regularization']),
                    name=f'dense_real_{i+1}'
                )(x)
                
                if self.config['batch_normalization']:
                    x = layers.BatchNormalization(name=f'batch_norm_real_{i+1}')(x)
                
                x = layers.Dropout(self.config['dropout_rate'], name=f'dropout_real_{i+1}')(x)
            
            # Capa de embedding final
            embedding = layers.Dense(
                self.embedding_dim,
                activation='linear',
                name='embedding_real'
            )(x)
            
            # Normalización L2 del embedding
            embedding_normalized = layers.Lambda(
                lambda x: tf.nn.l2_normalize(x, axis=1),
                name='l2_normalize_real'
            )(embedding)
            
            # Crear modelo
            base_model = Model(inputs=input_layer, outputs=embedding_normalized, name='base_network_real')
            
            self.base_network = base_model
            
            total_params = base_model.count_params()
            print(f"Red base construida: {self.input_dim} → {self.embedding_dim}")
            print(f"  - Parámetros: {total_params:,}")
            print(f"  - Capas ocultas: {self.config['hidden_layers']}")
            print(f"  - Regularización L2: {self.config['l2_regularization']}")
            print(f"  - Dropout: {self.config['dropout_rate']}")
            
            return base_model
            
        except Exception as e:
            print(f"Error construyendo red base: {e}")
            raise
    
    def build_real_siamese_model(self) -> Model:
        """Construye el modelo siamés completo."""
        try:
            if self.base_network is None:
                self.build_real_base_network()
            
            print("Construyendo modelo siamés...")
            
            # Inputs para las dos ramas
            input_a = layers.Input(shape=(self.input_dim,), name='input_a_real')
            input_b = layers.Input(shape=(self.input_dim,), name='input_b_real')
            
            # Procesar con red base (pesos compartidos)
            embedding_a = self.base_network(input_a)
            embedding_b = self.base_network(input_b)
            
            # Calcular distancia entre embeddings
            if self.config['distance_metric'] == 'euclidean':
                distance = layers.Lambda(
                    lambda embeddings: tf.sqrt(tf.reduce_sum(tf.square(embeddings[0] - embeddings[1]), axis=1, keepdims=True)),
                    name='euclidean_distance_real'
                )([embedding_a, embedding_b])
            elif self.config['distance_metric'] == 'cosine':
                distance = layers.Lambda(
                    lambda embeddings: 1.0 - tf.reduce_sum(embeddings[0] * embeddings[1], axis=1, keepdims=True),
                    name='cosine_distance_real'
                )([embedding_a, embedding_b])
            else:
                distance = layers.Lambda(
                    lambda embeddings: tf.sqrt(tf.reduce_sum(tf.square(embeddings[0] - embeddings[1]), axis=1, keepdims=True)),
                    name='euclidean_distance_real'
                )([embedding_a, embedding_b])
            
            # Crear modelo siamés
            siamese_model = Model(
                inputs=[input_a, input_b], 
                outputs=distance, 
                name='siamese_anatomical_real'
            )
            
            self.siamese_model = siamese_model
            
            total_params = siamese_model.count_params()
            print(f"Modelo siamés construido: {total_params:,} parámetros")
            print(f"  - Métrica: {self.config['distance_metric']}")
            
            return siamese_model
            
        except Exception as e:
            print(f"Error construyendo modelo siamés: {e}")
            raise
    
    def _contrastive_loss_real(self, y_true, y_pred):
        """Función de pérdida contrastiva REAL."""
        margin = self.config['margin']
        
        loss_genuine = y_true * tf.square(y_pred)
        loss_impostor = (1 - y_true) * tf.square(tf.maximum(margin - y_pred, 0))
        
        return tf.reduce_mean(loss_genuine + loss_impostor)
    
    def _far_metric_real(self, y_true, y_pred):
        """Métrica FAR REAL con threshold dinámico."""
        y_pred_flat = tf.reshape(y_pred, [-1])
        y_true_flat = tf.reshape(y_true, [-1])
        
        threshold = tf.reduce_mean(y_pred_flat)
        
        predictions = tf.cast(y_pred_flat < threshold, tf.float32)
        
        impostor_mask = tf.cast(y_true_flat == 0, tf.float32)
        false_accepts = tf.reduce_sum(predictions * impostor_mask)
        total_impostors = tf.reduce_sum(impostor_mask)
        
        return tf.cond(
            total_impostors > 0,
            lambda: false_accepts / total_impostors,
            lambda: 0.0
        )
    
    def _frr_metric_real(self, y_true, y_pred):
        """Métrica FRR REAL con threshold dinámico."""
        y_pred_flat = tf.reshape(y_pred, [-1])
        y_true_flat = tf.reshape(y_true, [-1])
        
        threshold = tf.reduce_mean(y_pred_flat)
        
        predictions = tf.cast(y_pred_flat < threshold, tf.float32)
        
        genuine_mask = tf.cast(y_true_flat == 1, tf.float32)
        false_rejects = tf.reduce_sum((1 - predictions) * genuine_mask)
        total_genuines = tf.reduce_sum(genuine_mask)
        
        return tf.cond(
            total_genuines > 0,
            lambda: false_rejects / total_genuines,
            lambda: 0.0
        )
    
    def compile_real_model(self):
        """Compila el modelo siamés."""
        try:
            if self.siamese_model is None:
                self.build_real_siamese_model()
            
            print("Compilando modelo siamés...")
            
            optimizer = optimizers.Adam(learning_rate=self.config['learning_rate'])
            
            if self.config['loss_function'] == 'contrastive':
                loss_function = self._contrastive_loss_real
            elif self.config['loss_function'] == 'binary_crossentropy':
                loss_function = 'binary_crossentropy'
            else:
                loss_function = self._contrastive_loss_real
            
            self.siamese_model.compile(
                optimizer=optimizer,
                loss=loss_function,
                metrics=[self._far_metric_real, self._frr_metric_real]
            )
            
            self.is_compiled = True
            
            print(f"Modelo compilado:")
            print(f"  - Optimizador: Adam (lr={self.config['learning_rate']})")
            print(f"  - Pérdida: {self.config['loss_function']}")
            
        except Exception as e:
            print(f"Error compilando modelo: {e}")
            raise
    
    #NUEVO
    def _create_real_training_callbacks(self) -> List:
        """Crea callbacks REALES para el entrenamiento."""
        callback_list = []
        
        # Early stopping
        early_stopping = callbacks.EarlyStopping(
            monitor='val_loss',
            patience=self.config['patience'],
            restore_best_weights=True,
            verbose=1
        )
        callback_list.append(early_stopping)
        
        # Reduce learning rate
        reduce_lr = callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=self.config['patience'] // 2,
            min_lr=1e-7,
            verbose=1
        )
        callback_list.append(reduce_lr)
        
        # Model checkpoint
        checkpoint_path = str(self.model_save_path)
        Path(checkpoint_path).parent.mkdir(parents=True, exist_ok=True)
        
        checkpoint = callbacks.ModelCheckpoint(
            checkpoint_path,
            monitor='val_loss',
            save_best_only=True,
            save_weights_only=False,
            verbose=1
        )
        callback_list.append(checkpoint)
        
        return callback_list
    #NUEVO
    # def _update_real_training_history(self, history, training_time: float):
    #     """Actualiza el historial de entrenamiento REAL."""
    #     try:
    #         self.training_history.loss = history.history['loss']
    #         self.training_history.val_loss = history.history['val_loss']
            
    #         if 'far_metric_real' in history.history:
    #             self.training_history.far_history = history.history['far_metric_real']
    #         if 'frr_metric_real' in history.history:
    #             self.training_history.frr_history = history.history['frr_metric_real']
            
    #         self.training_history.total_training_time = training_time
    #         self.training_history.best_epoch = np.argmin(self.training_history.val_loss)
            
    #         print("Historial actualizado")
            
    #     except Exception as e:
    #         print(f"Error actualizando historial: {e}")
    
    def _update_real_training_history(self, history, training_time: float):
        """Actualiza el historial de entrenamiento."""
        try:
            self.training_history.loss = history.history['loss']
            self.training_history.val_loss = history.history['val_loss']
            
            # TensorFlow guarda las métricas con '_' al inicio
            if '_far_metric_real' in history.history:
                self.training_history.far_history = history.history['_far_metric_real']
            if '_frr_metric_real' in history.history:
                self.training_history.frr_history = history.history['_frr_metric_real']
            
            self.training_history.total_training_time = training_time
            self.training_history.best_epoch = np.argmin(self.training_history.val_loss)
            
            print("Historial actualizado")
            
        except Exception as e:
            print(f"Error actualizando historial: {e}")
        
    def train_with_real_data(self, database, validation_split: float = 0.2) -> RealTrainingHistory:
        """Entrena el modelo con datos REALES de usuarios."""
        try:
            print("=== INICIANDO ENTRENAMIENTO ===")
            
            # 1. Cargar datos
            if not self.load_real_training_data_from_database(database):
                raise ValueError("No se pudieron cargar datos suficientes")
            
            # 2. Validar calidad
            if not self.validate_real_data_quality():
                raise ValueError("Datos no cumplen criterios de calidad")
            
            # 3. Crear pares
            features_a, features_b, labels = self.create_real_training_pairs()


            # ============================================================
            # LOGS CRÍTICOS: Verificar embeddings ANTES de entrenar
            # ============================================================
            print("=" * 80)
            print("ANÁLISIS DE EMBEDDINGS PRE-ENTRENAMIENTO")
            print("=" * 80)

            # Verificar si hay embeddings pregenerados en las muestras
            embeddings_pregenerados = 0
            embeddings_generados_on_fly = 0

            for sample in self.real_training_samples:
                if hasattr(sample, 'metadata') and 'template_id' in sample.metadata:
                    embeddings_pregenerados += 1
                else:
                    embeddings_generados_on_fly += 1

            print(f"MUESTRAS CON EMBEDDINGS PREGENERADOS: {embeddings_pregenerados}")
            print(f"MUESTRAS CON EMBEDDINGS ON-THE-FLY: {embeddings_generados_on_fly}")

            # Analizar distribución de features_a (primer elemento de cada par)
            print(f"\nANÁLISIS DE FEATURES USADAS EN ENTRENAMIENTO:")
            print(f"Total pares creados: {len(labels)}")
            print(f"Shape features_a: {features_a.shape}")
            print(f"Shape features_b: {features_b.shape}")

            # Estadísticas de los embeddings
            features_all = np.vstack([features_a, features_b])
            print(f"\nESTADÍSTICAS DE EMBEDDINGS:")
            print(f"  Mean: {np.mean(features_all):.6f}")
            print(f"  Std: {np.std(features_all):.6f}")
            print(f"  Min: {np.min(features_all):.6f}")
            print(f"  Max: {np.max(features_all):.6f}")

            # Verificar normas L2 de los embeddings (deberían estar normalizados)
            norms_a = np.linalg.norm(features_a, axis=1)
            norms_b = np.linalg.norm(features_b, axis=1)
            print(f"\nNORMAS L2 DE EMBEDDINGS:")
            print(f"  features_a - Mean norm: {np.mean(norms_a):.6f}, Std: {np.std(norms_a):.6f}")
            print(f"  features_b - Mean norm: {np.mean(norms_b):.6f}, Std: {np.std(norms_b):.6f}")

            # Calcular distancias preliminares
            sample_distances = []
            for i in range(min(100, len(features_a))):
                dist = np.linalg.norm(features_a[i] - features_b[i])
                sample_distances.append(dist)

            print(f"\nDISTANCIAS PRELIMINARES (100 pares):")
            print(f"  Mean: {np.mean(sample_distances):.6f}")
            print(f"  Std: {np.std(sample_distances):.6f}")
            print(f"  Min: {np.min(sample_distances):.6f}")
            print(f"  Max: {np.max(sample_distances):.6f}")

            print("=" * 80)
            
            # 4. División estratificada
            print(f"Dividiendo {len(labels)} pares de entrenamiento...")
            
            genuine_indices = np.where(labels == 1)[0]
            impostor_indices = np.where(labels == 0)[0]
            
            validation_split = 0.15
            n_val_genuine = max(5, int(len(genuine_indices) * validation_split))
            n_val_impostor = max(5, int(len(impostor_indices) * validation_split))
            
            print(f"Pares disponibles: {len(genuine_indices)} genuinos, {len(impostor_indices)} impostores")
            print(f"Para validación: {n_val_genuine} genuinos, {n_val_impostor} impostores")

            np.random.seed(42)
            val_genuine = np.random.choice(genuine_indices, n_val_genuine, replace=False)
            val_impostor = np.random.choice(impostor_indices, n_val_impostor, replace=False)
            
            val_indices = np.concatenate([val_genuine, val_impostor])
            train_indices = np.setdiff1d(np.arange(len(labels)), val_indices)
            
            print(f"División: {len(train_indices)} entrenamiento, {len(val_indices)} validación")
            print(f"TOTAL USADO: {len(train_indices) + len(val_indices)} de {len(labels)} pares disponibles")
            
            train_a, train_b, train_labels = features_a[train_indices], features_b[train_indices], labels[train_indices]
            val_a, val_b, val_labels = features_a[val_indices], features_b[val_indices], labels[val_indices]
            
            print(f"División de datos REALES:")
            print(f"  - Entrenamiento: {len(train_labels)} pares")
            print(f"  - Validación: {len(val_labels)} pares")
            print(f"  - Genuinos entrenamiento: {np.sum(train_labels)}")
            print(f"  - Impostores entrenamiento: {np.sum(1-train_labels)}")
            
            # 5. Compilar
            if not self.is_compiled:
                self.compile_real_model()
            
            # 6. Callbacks
            callbacks_list = self._create_real_training_callbacks()
            
            # 7. Entrenar
            print("Iniciando entrenamiento con datos...")
            start_time = time.time()
            
            history = self.siamese_model.fit(
                [train_a, train_b], train_labels,
                batch_size=self.config['batch_size'],
                epochs=self.config['epochs'],
                validation_data=([val_a, val_b], val_labels),
                callbacks=callbacks_list,
                verbose=1
            )
            
            training_time = time.time() - start_time
            
            # 8. Actualizar historial
            self._update_real_training_history(history, training_time)
            self.is_trained = True
            
            # 9. Evaluar
            final_metrics = self.evaluate_real_model(val_a, val_b, val_labels)
            self.current_metrics = final_metrics
            
            print("=== ENTRENAMIENTO COMPLETADO ===")
            print(f"  - Tiempo: {training_time:.2f}s")
            print(f"  - Épocas: {len(history.history['loss'])}")
            print(f"  - EER: {final_metrics.eer:.4f}")
            print(f"  - AUC: {final_metrics.auc_score:.4f}")
            print(f"  - Threshold óptimo: {final_metrics.threshold:.4f}")
            
            self.is_trained = True
            print("✓ Red anatómica marcada como entrenada")
            
            # Guardar modelo
            if self.save_real_model():
                print("✓ Modelo anatómico guardado con metadatos")
            
            return self.training_history
            
        except Exception as e:
            print(f"Error durante entrenamiento: {e}")
            raise
    
    def _create_user_stratified_split(self, validation_split: float) -> Tuple[np.ndarray, np.ndarray]:
        """Crea división estratificada por usuarios REALES."""
        try:
            print(f"Iniciando división con {len(self.real_training_samples)} pares totales")
            
            # Agrupar índices por usuario
            user_indices = {}
            for i, sample in enumerate(self.real_training_samples):
                if sample.user_id not in user_indices:
                    user_indices[sample.user_id] = []
                user_indices[sample.user_id].append(i)
            
            # Dividir usuarios (no muestras)
            user_ids = list(user_indices.keys())
            
            # VALIDACIÓN PREVIA
            if len(user_ids) < 3:
                logger.warning(f"Solo {len(user_ids)} usuarios - usando división MANUAL por muestras")
                
                # DIVISIÓN MANUAL QUE USA TODOS LOS DATOS
                all_indices = np.arange(len(self.real_training_samples))
                labels_for_split = np.array([1.0 if pair.is_genuine else 0.0 for pair in self.real_training_samples])
                
                # Separar por tipo de par
                genuine_indices = all_indices[labels_for_split == 1]
                impostor_indices = all_indices[labels_for_split == 0]
                
                # Dividir cada tipo proporcionalmente
                n_val_genuine = max(3, int(len(genuine_indices) * validation_split))
                n_val_impostor = max(3, int(len(impostor_indices) * validation_split))
                
                # Selección aleatoria estratificada
                np.random.seed(42)
                val_genuine = np.random.choice(genuine_indices, n_val_genuine, replace=False)
                val_impostor = np.random.choice(impostor_indices, n_val_impostor, replace=False)
                
                val_indices = np.concatenate([val_genuine, val_impostor])
                train_indices = np.setdiff1d(all_indices, val_indices)
                
                print(f"División manual exitosa:")
                print(f"  - Entrenamiento: {len(train_indices)} pares")
                print(f"  - Validación: {len(val_indices)} pares") 
                print(f"  - TOTAL USADO: {len(train_indices) + len(val_indices)} de {len(all_indices)}")
                
                return train_indices, val_indices
            
            else:
                # CON SUFICIENTES USUARIOS: DIVISIÓN POR USUARIOS
                train_users, val_users = train_test_split(
                    user_ids, 
                    test_size=validation_split,
                    random_state=42
                )
    
                # Obtener índices de muestras para cada conjunto
                train_sample_indices = []
                val_sample_indices = []
                
                for user_id in train_users:
                    train_sample_indices.extend(user_indices[user_id])
                
                for user_id in val_users:
                    val_sample_indices.extend(user_indices[user_id])
                
                print(f"División estratificada por usuarios REALES:")
                print(f"  - Usuarios entrenamiento: {len(train_users)}")
                print(f"  - Usuarios validación: {len(val_users)}")
                
                return np.array(train_sample_indices), np.array(val_sample_indices)
                
        except Exception as e:
            print("Error en división estratificada por usuarios", e)
            # Fallback que usa TODOS los datos
            total_samples = len(self.real_training_samples)
            val_size = int(total_samples * validation_split)
            train_size = total_samples - val_size
            
            return np.arange(train_size), np.arange(train_size, total_samples)
    
    def _create_real_training_callbacks(self) -> List:
        """Crea callbacks REALES para el entrenamiento."""
        callback_list = []
        
        # Early stopping
        early_stopping = callbacks.EarlyStopping(
            monitor='val_loss',
            patience=self.config['patience'],
            restore_best_weights=True,
            verbose=1
        )
        callback_list.append(early_stopping)
        
        # Reduce learning rate on plateau
        reduce_lr = callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=self.config['patience'] // 2,
            min_lr=1e-7,
            verbose=1
        )
        callback_list.append(reduce_lr)
        
        # Model checkpoint
        #checkpoint_path = os.path.join(self.model_save_path, 'anatomical_model.h5')
        checkpoint_path = str(self.model_save_path)
        os.makedirs(os.path.dirname(checkpoint_path), exist_ok=True)
        
        checkpoint = callbacks.ModelCheckpoint(
            checkpoint_path,
            monitor='val_loss',
            save_best_only=True,
            save_weights_only=False,
            verbose=1
        )
        callback_list.append(checkpoint)
        
        return callback_list
    
    # def _update_real_training_history(self, history, training_time: float):
    #     """Actualiza el historial de entrenamiento."""
    #     try:
    #         self.training_history.loss = history.history['loss']
    #         self.training_history.val_loss = history.history['val_loss']
            
    #         # Métricas adicionales si están disponibles
    #         if 'far_metric_real' in history.history:
    #             self.training_history.far_history = history.history['far_metric_real']
    #         if 'frr_metric_real' in history.history:
    #             self.training_history.frr_history = history.history['frr_metric_real']
            
    #         # Información de entrenamiento
    #         self.training_history.total_training_time = training_time
    #         self.training_history.best_epoch = np.argmin(self.training_history.val_loss)
            
    #         print("Historial de entrenamiento actualizado")
            
    #     except Exception as e:
    #         log_error("Error actualizando historial", e)
    
    def evaluate_real_model(self, features_a: np.ndarray, features_b: np.ndarray, 
                    labels: np.ndarray) -> RealModelMetrics:
        """Evalúa el modelo."""
        try:
            if not self.is_trained:
                print("Modelo no está entrenado")
                raise ValueError("Modelo no entrenado")
            
            print("Evaluando modelo...")
            
            # Predecir distancias
            distances = self.siamese_model.predict([features_a, features_b])
            distances = distances.flatten()
            
            total_samples = len(labels)
            genuine_count = int(np.sum(labels == 1))
            impostor_count = int(np.sum(labels == 0))
            
            if total_samples == 0:
                raise ValueError("No hay datos para evaluar")
            
            use_robust_method = total_samples < 20
            
            if use_robust_method:
                print(f"Dataset pequeño ({total_samples}) - método robusto")
                
                if genuine_count > 0 and impostor_count > 0:
                    genuine_distances = distances[labels == 1]
                    impostor_distances = distances[labels == 0]
                    
                    self.genuine_scores = (1.0 / (1.0 + genuine_distances)).tolist()
                    self.impostor_scores = (1.0 / (1.0 + impostor_distances)).tolist()
                    
                    genuine_median = np.median(genuine_distances)
                    impostor_median = np.median(impostor_distances)
                    
                    eer_threshold = (genuine_median + impostor_median) / 2.0
                    
                    print(f"  Threshold calculado: mediana genuinos={genuine_median:.4f}, impostores={impostor_median:.4f}")

                elif genuine_count > 0:
                    eer_threshold = np.percentile(distances[labels == 1], 75)
                    print("  Solo genuinos disponibles - usando percentil 75")

                elif impostor_count > 0:
                    eer_threshold = np.percentile(distances[labels == 0], 25)
                    print("  Solo impostores disponibles - usando percentil 25")

                else:
                    eer_threshold = np.mean(distances)
                    print("  Fallback - usando promedio de distancias")

                
                predictions = distances < eer_threshold
                
                if impostor_count > 0:
                    false_accepts = np.sum((predictions == 1) & (labels == 0))
                    far = false_accepts / impostor_count
                else:
                    far = 0.0
                
                if genuine_count > 0:
                    false_rejects = np.sum((predictions == 0) & (labels == 1))
                    frr = false_rejects / genuine_count
                else:
                    frr = 0.0
                
                eer = (far + frr) / 2.0
                
                try:
                    if genuine_count > 0 and impostor_count > 0:
                        fpr, tpr, _ = roc_curve(labels, 1 - distances)
                        auc_score = auc(fpr, tpr)
                        
                        sample_indices = np.linspace(0, len(fpr)-1, min(100, len(fpr)), dtype=int)
                        roc_fpr_sampled = fpr[sample_indices].tolist()
                        roc_tpr_sampled = tpr[sample_indices].tolist()
                    else:
                        auc_score = 0.5
                        roc_fpr_sampled = []
                        roc_tpr_sampled = []
                except Exception:
                    auc_score = 0.5
                    roc_fpr_sampled = []
                    roc_tpr_sampled = []
            else:
                print(f"Dataset grande ({total_samples} muestras) - método estándar")
                
                try:
                    genuine_distances = distances[labels == 1] if genuine_count > 0 else np.array([])
                    impostor_distances = distances[labels == 0] if impostor_count > 0 else np.array([])
                    self.genuine_scores = (1.0 / (1.0 + genuine_distances)).tolist()
                    self.impostor_scores = (1.0 / (1.0 + impostor_distances)).tolist()
                    fpr, tpr, thresholds = roc_curve(labels, 1 - distances)
                    auc_score = auc(fpr, tpr)
                    # Samplear puntos ROC para enviar al frontend (máximo 100 puntos)
                    sample_indices = np.linspace(0, len(fpr)-1, min(100, len(fpr)), dtype=int)
                    roc_fpr_sampled = fpr[sample_indices].tolist()
                    roc_tpr_sampled = tpr[sample_indices].tolist()
                    
                    fnr = 1 - tpr
                    eer_idx = np.nanargmin(np.absolute(fnr - fpr))
                    eer_threshold = thresholds[eer_idx]
                    eer = fpr[eer_idx]
                    
                    print(f"  EER calculado: {eer:.4f} con threshold: {eer_threshold:.4f}")

                except Exception:
                    print(f"Error en cálculo ROC estándar: {e}")

                    genuine_distances = distances[labels == 1] if genuine_count > 0 else []
                    impostor_distances = distances[labels == 0] if impostor_count > 0 else []
                    
                    if len(genuine_distances) > 0 and len(impostor_distances) > 0:
                        eer_threshold = (np.median(genuine_distances) + np.median(impostor_distances)) / 2.0
                    else:
                        eer_threshold = np.mean(distances)
                    
                    auc_score = 0.5
                    eer = 0.5
                    roc_fpr_sampled = []
                    roc_tpr_sampled = []
                
                predictions = distances < eer_threshold
                
                try:
                    cm = confusion_matrix(labels, predictions)
                    if cm.shape == (2, 2):
                        tn, fp, fn, tp = cm.ravel()
                        far = fp / (fp + tn) if (fp + tn) > 0 else 0.0
                        frr = fn / (fn + tp) if (fn + tp) > 0 else 0.0
                    else:
                        if impostor_count > 0:
                            far = np.sum((predictions == 1) & (labels == 0)) / impostor_count
                        else:
                            far = 0.0
                        if genuine_count > 0:
                            frr = np.sum((predictions == 0) & (labels == 1)) / genuine_count
                        else:
                            frr = 0.0
                except Exception:
                    far = np.sum((predictions == 1) & (labels == 0)) / max(1, impostor_count)
                    frr = np.sum((predictions == 0) & (labels == 1)) / max(1, genuine_count)
            
            accuracy = accuracy_score(labels, predictions)
            
            tp = np.sum((predictions == 1) & (labels == 1))
            fp = np.sum((predictions == 1) & (labels == 0))
            fn = np.sum((predictions == 0) & (labels == 1))
            tn = np.sum((predictions == 0) & (labels == 0))
            
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
            
            if genuine_count > 0:
                estimated_users = max(2, int((1 + np.sqrt(1 + 8 * genuine_count)) / 2))
            else:
                estimated_users = max(2, total_samples // 8)
            
            metrics = RealModelMetrics(
                far=float(far),
                frr=float(frr),
                eer=float(eer),
                auc_score=float(auc_score),
                accuracy=float(accuracy),
                threshold=float(eer_threshold),
                precision=float(precision),
                recall=float(recall),
                f1_score=float(f1_score),
                total_genuine_pairs=genuine_count,
                total_impostor_pairs=impostor_count,
                users_in_test=estimated_users,
                cross_validation_score=0.0,
                roc_fpr=roc_fpr_sampled,
                roc_tpr=roc_tpr_sampled
            )
            
            self.optimal_threshold = eer_threshold

            # ============================================================
            # LOGS CRÍTICOS: Análisis del threshold calculado
            # ============================================================
            print("=" * 80)
            print("ANÁLISIS DETALLADO DEL THRESHOLD CALCULADO")
            print("=" * 80)
            print(f"Threshold calculado: {eer_threshold:.6f}")
            print(f"Método usado: {'Robusto (dataset pequeño)' if use_robust_method else 'Estándar (ROC)'}")

            if genuine_count > 0:
                genuine_distances = distances[labels == 1]
                print(f"\nDISTANCIAS GENUINAS:")
                print(f"  Count: {genuine_count}")
                print(f"  Mean: {np.mean(genuine_distances):.6f}")
                print(f"  Median: {np.median(genuine_distances):.6f}")
                print(f"  Std: {np.std(genuine_distances):.6f}")
                print(f"  Min: {np.min(genuine_distances):.6f}")
                print(f"  Max: {np.max(genuine_distances):.6f}")
                print(f"  Percentile 25: {np.percentile(genuine_distances, 25):.6f}")
                print(f"  Percentile 75: {np.percentile(genuine_distances, 75):.6f}")

            if impostor_count > 0:
                impostor_distances = distances[labels == 0]
                print(f"\nDISTANCIAS IMPOSTORES:")
                print(f"  Count: {impostor_count}")
                print(f"  Mean: {np.mean(impostor_distances):.6f}")
                print(f"  Median: {np.median(impostor_distances):.6f}")
                print(f"  Std: {np.std(impostor_distances):.6f}")
                print(f"  Min: {np.min(impostor_distances):.6f}")
                print(f"  Max: {np.max(impostor_distances):.6f}")
                print(f"  Percentile 25: {np.percentile(impostor_distances, 25):.6f}")
                print(f"  Percentile 75: {np.percentile(impostor_distances, 75):.6f}")

            if genuine_count > 0 and impostor_count > 0:
                separation = np.mean(impostor_distances) - np.mean(genuine_distances)
                print(f"\nSEPARACIÓN ENTRE DISTRIBUCIONES:")
                print(f"  Separación media: {separation:.6f}")
                print(f"  Ratio (impostor/genuine): {np.mean(impostor_distances)/np.mean(genuine_distances):.2f}x")

            print("=" * 80)

            # Logging detallado y adaptativo
            method_used = "Robusto (dataset pequeño)" if use_robust_method else "Estándar (dataset grande)"
            print("Evaluación REAL completada:")
            print(f"  - Método utilizado: {method_used}")
            print(f"  - FAR: {far:.4f} ({fp} falsos positivos de {impostor_count} impostores)")
            print(f"  - FRR: {frr:.4f} ({fn} falsos negativos de {genuine_count} genuinos)")
            print(f"  - EER: {eer:.4f}")
            print(f"  - AUC: {auc_score:.4f}")
            print(f"  - Accuracy: {accuracy:.4f}")
            print(f"  - Threshold óptimo: {eer_threshold:.4f}")
            print(f"  - Pares genuinos evaluados: {genuine_count}")
            print(f"  - Pares impostores evaluados: {impostor_count}")
            print(f"  - Usuarios estimados en test: {estimated_users}")
            
            return metrics
            
        except Exception as e:
            print(f"Error evaluando modelo: {e}")
            raise
        
    
    # def recalculate_threshold_from_database(self, database) -> bool:
    #     """
    #     Recalcula threshold óptimo usando embeddings actuales de la base de datos.
    #     Usado después de regenerar embeddings post-reentrenamiento.
    #     """
    #     try:
    #         print("=== RECALCULANDO THRESHOLD CON EMBEDDINGS REGENERADOS ===")
            
    #         # 1. Cargar TODOS los templates actuales
    #         all_users = database.list_users()
    #         user_embeddings = {}
            
    #         for user in all_users:
    #             templates = database.list_user_templates(user.user_id)
    #             anatomical_templates = [t for t in templates if str(t.template_type).lower().find('anatomical') != -1]
                
    #             embeddings = []
    #             for template in anatomical_templates:
    #                 if template.anatomical_embedding is not None:
    #                     embeddings.append(template.anatomical_embedding)
                
    #             if embeddings:
    #                 user_embeddings[user.user_id] = np.array(embeddings)
                    
            
    #         if len(user_embeddings) < 2:
    #             print("Se necesitan al menos 2 usuarios para recalcular threshold")
    #             return False
            
    #         print(f"Usuarios con embeddings: {len(user_embeddings)}")

    #         # ============================================================
    #         # LOGS CRÍTICOS: Verificar embeddings REGENERADOS
    #         # ============================================================
    #         print("\nANÁLISIS DE EMBEDDINGS REGENERADOS POR USUARIO:")
    #         for user_id, embeddings in user_embeddings.items():
    #             print(f"\n  Usuario: {user_id}")
    #             print(f"    Templates: {len(embeddings)}")
    #             print(f"    Shape embeddings: {embeddings.shape}")
                
    #             # Estadísticas de embeddings de este usuario
    #             print(f"    Mean: {np.mean(embeddings):.6f}")
    #             print(f"    Std: {np.std(embeddings):.6f}")
                
    #             # Normas L2 (deberían estar cerca de 1.0 si están normalizados)
    #             norms = np.linalg.norm(embeddings, axis=1)
    #             print(f"    Normas L2:")
    #             print(f"      Mean: {np.mean(norms):.6f}")
    #             print(f"      Min: {np.min(norms):.6f}")
    #             print(f"      Max: {np.max(norms):.6f}")
                
    #             # Si las normas están muy lejos de 1.0, es una señal de problema
    #             if np.mean(norms) < 0.9 or np.mean(norms) > 1.1:
    #                 logger.warning(f"ADVERTENCIA: Normas L2 fuera de rango esperado!")
            
    #         # 2. Crear pares genuinos e impostores
    #         features_a = []
    #         features_b = []
    #         labels = []
            
    #         user_ids = list(user_embeddings.keys())
            
    #         # Pares genuinos
    #         for user_id in user_ids:
    #             embeddings = user_embeddings[user_id]
    #             for i in range(len(embeddings)):
    #                 for j in range(i + 1, len(embeddings)):
    #                     features_a.append(embeddings[i])
    #                     features_b.append(embeddings[j])
    #                     labels.append(1)
            
    #         # Pares impostores
    #         for i, user_id1 in enumerate(user_ids):
    #             for j, user_id2 in enumerate(user_ids[i + 1:], i + 1):
    #                 emb1 = user_embeddings[user_id1]
    #                 emb2 = user_embeddings[user_id2]
                    
    #                 max_pairs = min(50, len(emb1) * len(emb2) // 2)
    #                 count = 0
                    
    #                 for e1 in emb1:
    #                     for e2 in emb2:
    #                         if count < max_pairs:
    #                             features_a.append(e1)
    #                             features_b.append(e2)
    #                             labels.append(0)
    #                             count += 1
    #                         else:
    #                             break
    #                     if count >= max_pairs:
    #                         break
            
    #         features_a = np.array(features_a)
    #         features_b = np.array(features_b)
    #         labels = np.array(labels)
            
    #         print(f"Pares creados: {np.sum(labels)} genuinos, {np.sum(1-labels)} impostores")
            
    #         # 3. Evaluar con nuevos embeddings
    #         metrics = self.evaluate_real_model(features_a, features_b, labels)
    #         self.current_metrics = metrics
            
    #         print(f"✓ Threshold recalculado: {metrics.threshold:.4f}")
    #         print(f"  - FAR: {metrics.far:.4f}")
    #         print(f"  - FRR: {metrics.frr:.4f}")
    #         print(f"  - EER: {metrics.eer:.4f}")
            
    #         # 4. Guardar modelo actualizado
    #         return self.save_real_model()
            
    #     except Exception as e:
    #         print(f"Error recalculando threshold: {e}")
    #         import traceback
    #         traceback.print_exc()
    #         return False
    
    # def recalculate_threshold_from_database(self, database) -> bool:
    #     """
    #     Recalcula threshold óptimo usando embeddings actuales de la base de datos.
    #     Usado después de regenerar embeddings post-reentrenamiento.
    #     """
    #     try:
    #         print("=" * 80)
    #         print("=== RECALCULANDO THRESHOLD CON EMBEDDINGS REGENERADOS ===")
    #         print("=" * 80)
            
    #         # 1. Cargar TODOS los templates actuales
    #         all_users = database.list_users()
    #         user_embeddings = {}
            
    #         print(f"\nTOTAL USUARIOS EN SISTEMA: {len(all_users)}")
            
    #         for idx, user in enumerate(all_users, 1):
    #             print(f"\n{'─' * 60}")
    #             print(f"USUARIO {idx}/{len(all_users)}: {user.username}")
    #             print(f"  ID: {user.user_id}")
    #             print(f"{'─' * 60}")
                
    #             templates = database.list_user_templates(user.user_id)
    #             print(f"  Templates totales recuperados: {len(templates)}")
                
    #             anatomical_templates = [t for t in templates if str(t.template_type).lower().find('anatomical') != -1]
    #             print(f"  Templates filtrados como anatomicos: {len(anatomical_templates)}")
                
    #             embeddings = []
    #             templates_con_embedding = 0
    #             templates_sin_embedding = 0
                
    #             for template in anatomical_templates:
    #                 embedding_added = False
                    
    #                 # CASO 1: Embedding guardado (usuario normal)
    #                 if template.anatomical_embedding is not None:
    #                     templates_con_embedding += 1
    #                     embeddings.append(template.anatomical_embedding)
    #                     embedding_added = True
    #                     print(f"     Template {template.template_id[:20]}... - Embedding GUARDADO usado")
                        
    #                     if len(embeddings) == 1:
    #                         emb_array = np.array(template.anatomical_embedding)
    #                         print(f"       Primer embedding GUARDADO:")
    #                         print(f"       Shape: {emb_array.shape}")
    #                         print(f"       Norm: {np.linalg.norm(emb_array):.6f}")
    #                         print(f"       Mean: {np.mean(emb_array):.6f}")
                    
    #                 # CASO 2: Sin embedding pero con bootstrap_features (usuario bootstrap)
    #                 elif template.metadata and template.metadata.get('bootstrap_features'):
    #                     bootstrap_features = template.metadata.get('bootstrap_features')
                        
    #                     # Convertir a numpy array
    #                     if isinstance(bootstrap_features, list):
    #                         bootstrap_features = np.array(bootstrap_features, dtype=np.float32)
                        
    #                     print(f"     Template {template.template_id[:20]}... - USUARIO BOOTSTRAP detectado")
    #                     print(f"       bootstrap_features shape: {bootstrap_features.shape}")
                        
    #                     # Promediar si hay múltiples vectores
    #                     if bootstrap_features.ndim == 2:
    #                         print(f"       Promediando {bootstrap_features.shape[0]} vectores...")
    #                         bootstrap_features = np.mean(bootstrap_features, axis=0)
                        
    #                     # Generar embedding TEMPORAL con red reentrenada (NO guardar)
    #                     embedding = self.base_network.predict(bootstrap_features.reshape(1, -1), verbose=0)[0]
                        
    #                     embeddings.append(embedding)
    #                     templates_con_embedding += 1
    #                     embedding_added = True
                        
    #                     print(f"       Embedding temporal generado: shape={embedding.shape}")
    #                     print(f"       Embedding norm: {np.linalg.norm(embedding):.6f}")
    #                     print(f"       [TEMPORAL] NO guardado (solo para threshold)")
                    
    #                 # CASO 3: Sin embedding ni features
    #                 if not embedding_added:
    #                     templates_sin_embedding += 1
    #                     print(f"     Template {template.template_id[:20]}... - SIN datos para generar embedding")
                
    #             print(f"  Templates CON embedding anatomico: {templates_con_embedding}")
    #             print(f"  Templates SIN embedding anatomico: {templates_sin_embedding}")
    #             print(f"  Embeddings recolectados: {len(embeddings)}")
                
    #             if embeddings:
    #                 user_embeddings[user.user_id] = np.array(embeddings)
    #                 print(f"  [OK] Usuario AGREGADO con {len(embeddings)} embeddings")
    #             else:
    #                 print(f"  [SKIP] Usuario OMITIDO (sin embeddings validos)")
            
    #         print("\n" + "=" * 80)
    #         print(f"RESUMEN FINAL:")
    #         print(f"  Usuarios totales procesados: {len(all_users)}")
    #         print(f"  Usuarios CON embeddings: {len(user_embeddings)}")
    #         print(f"  Usuarios SIN embeddings: {len(all_users) - len(user_embeddings)}")
    #         print("=" * 80)
            
    #         if len(user_embeddings) < 2:
    #             print("\n[ERROR] Se necesitan al menos 2 usuarios con embeddings para recalcular threshold")
    #             print(f"   Encontrados: {len(user_embeddings)} usuarios con embeddings")
    #             print(f"   Requeridos: 2 usuarios minimo")
                
    #             if len(user_embeddings) == 1:
    #                 only_user = list(user_embeddings.keys())[0]
    #                 print(f"\n   Usuario unico con embeddings: {only_user}")
    #             elif len(user_embeddings) == 0:
    #                 print(f"\n   [WARNING] NINGUN usuario tiene embeddings anatomicos validos")
                
    #             return False
            
    #         print(f"\n[OK] Suficientes usuarios para recalculo: {len(user_embeddings)}")

    #         # ============================================================
    #         # LOGS CRITICOS: Verificar embeddings REGENERADOS
    #         # ============================================================
    #         print("\n" + "=" * 80)
    #         print("ANALISIS DETALLADO DE EMBEDDINGS REGENERADOS")
    #         print("=" * 80)
            
    #         for user_id, embeddings in user_embeddings.items():
    #             user_obj = next((u for u in all_users if u.user_id == user_id), None)
    #             user_name = user_obj.username if user_obj else "Unknown"
                
    #             print(f"\nUsuario: {user_name} ({user_id})")
    #             print(f"   Templates con embeddings: {len(embeddings)}")
    #             print(f"   Shape del array: {embeddings.shape}")
                
    #             # Estadisticas de embeddings de este usuario
    #             print(f"   Estadisticas:")
    #             print(f"      Mean: {np.mean(embeddings):.6f}")
    #             print(f"      Std: {np.std(embeddings):.6f}")
    #             print(f"      Min: {np.min(embeddings):.6f}")
    #             print(f"      Max: {np.max(embeddings):.6f}")
                
    #             # Normas L2 (deberian estar cerca de 1.0 si estan normalizados)
    #             norms = np.linalg.norm(embeddings, axis=1)
    #             print(f"   Normas L2:")
    #             print(f"      Mean: {np.mean(norms):.6f}")
    #             print(f"      Min: {np.min(norms):.6f}")
    #             print(f"      Max: {np.max(norms):.6f}")
                
    #             # Si las normas estan muy lejos de 1.0, es una senal de problema
    #             if np.mean(norms) < 0.9 or np.mean(norms) > 1.1:
    #                 print(f"      [WARNING] Normas L2 fuera de rango esperado!")
            
    #         print("\n" + "=" * 80)
            
    #         # 2. Crear pares genuinos e impostores
    #         print("\nCREANDO PARES PARA EVALUACION...")
    #         features_a = []
    #         features_b = []
    #         labels = []
            
    #         user_ids = list(user_embeddings.keys())
            
    #         # Pares genuinos
    #         genuine_count = 0
    #         for user_id in user_ids:
    #             embeddings = user_embeddings[user_id]
    #             user_pairs = 0
    #             for i in range(len(embeddings)):
    #                 for j in range(i + 1, len(embeddings)):
    #                     features_a.append(embeddings[i])
    #                     features_b.append(embeddings[j])
    #                     labels.append(1)
    #                     genuine_count += 1
    #                     user_pairs += 1
    #             print(f"  Usuario {user_id[:20]}...: {user_pairs} pares genuinos")
            
    #         # Pares impostores
    #         impostor_count = 0
    #         for i, user_id1 in enumerate(user_ids):
    #             for j, user_id2 in enumerate(user_ids[i + 1:], i + 1):
    #                 emb1 = user_embeddings[user_id1]
    #                 emb2 = user_embeddings[user_id2]
                    
    #                 max_pairs = min(50, len(emb1) * len(emb2) // 2)
    #                 count = 0
                    
    #                 for e1 in emb1:
    #                     for e2 in emb2:
    #                         if count < max_pairs:
    #                             features_a.append(e1)
    #                             features_b.append(e2)
    #                             labels.append(0)
    #                             impostor_count += 1
    #                             count += 1
    #                         else:
    #                             break
    #                     if count >= max_pairs:
    #                         break
            
    #         features_a = np.array(features_a)
    #         features_b = np.array(features_b)
    #         labels = np.array(labels)
            
    #         print(f"\nPARES CREADOS:")
    #         print(f"  Genuinos: {genuine_count}")
    #         print(f"  Impostores: {impostor_count}")
    #         print(f"  Total: {len(labels)}")
    #         print(f"  Ratio: {genuine_count/impostor_count:.2f}:1" if impostor_count > 0 else "  Ratio: N/A")
            
    #         # 3. Evaluar con nuevos embeddings
    #         print(f"\nEVALUANDO MODELO CON NUEVOS EMBEDDINGS...")
    #         metrics = self.evaluate_real_model(features_a, features_b, labels)
    #         self.current_metrics = metrics
            
    #         print(f"\nTHRESHOLD RECALCULADO:")
    #         print(f"  Threshold: {metrics.threshold:.6f}")
    #         print(f"  FAR: {metrics.far:.6f}")
    #         print(f"  FRR: {metrics.frr:.6f}")
    #         print(f"  EER: {metrics.eer:.6f}")
    #         print(f"  AUC: {metrics.auc_score:.6f}")
            
    #         # 4. Guardar modelo actualizado
    #         print(f"\nGUARDANDO MODELO CON THRESHOLD ACTUALIZADO...")
    #         save_success = self.save_real_model()
            
    #         if save_success:
    #             print(f"[OK] Modelo guardado exitosamente")
    #         else:
    #             print(f"[ERROR] Error al guardar modelo")
            
    #         print("=" * 80)
    #         return save_success
            
    #     except Exception as e:
    #         print("\n" + "=" * 80)
    #         print(f"[ERROR] ERROR RECALCULANDO THRESHOLD: {e}")
    #         print("=" * 80)
    #         import traceback
    #         traceback.print_exc()
    #         return False
        
    def recalculate_threshold_from_database(self, database) -> bool:
        """
        Recalcula threshold óptimo REGENERANDO embeddings desde features 180D.
        Usado después de reentrenar - usa la RED NUEVA para todos los usuarios.
        """
        try:
            print("=" * 80)
            print("=== RECALCULANDO THRESHOLD CON RED RECIEN ENTRENADA ===")
            print("=" * 80)
            print("\n[INICIO] Proceso de recalculacion de threshold")
            print("[INFO] Timestamp:", time.strftime("%Y-%m-%d %H:%M:%S"))
            print("\n[ESTRATEGIA] Pasos a seguir:")
            print("   1. Cargar FEATURES ORIGINALES (180D) de TODOS los usuarios")
            print("   2. Crear pares genuinos/impostores con features 180D")
            print("   3. Evaluar con red RECIEN ENTRENADA (genera embeddings on-the-fly)")
            print("   4. Calcular threshold optimo")
            print("   5. ACTUALIZAR embeddings guardados en BD (usuarios normales)")
            print("   6. Guardar modelo con nuevo threshold")
            
            # ============================================================
            # FASE 1: CARGAR FEATURES 180D (NO EMBEDDINGS VIEJOS)
            # ============================================================
            print("\n" + "=" * 80)
            print("FASE 1: CARGANDO FEATURES ANATOMICAS ORIGINALES (180D)")
            print("=" * 80)
            print("[FASE 1] Iniciando carga de features anatomicas de 180 dimensiones")
            
            all_users = database.list_users()
            print(f"[FASE 1] Total usuarios registrados en sistema: {len(all_users)}")
            
            if len(all_users) == 0:
                print("[FASE 1] [ERROR] No hay usuarios en el sistema")
                return False
            
            print(f"[FASE 1] Usuarios encontrados:")
            for idx, user in enumerate(all_users, 1):
                print(f"[FASE 1]    {idx}. {user.username} (ID: {user.user_id})")
            
            user_features_180d = {}  # {user_id: [array_180d, array_180d, ...]}
            user_template_ids = {}   # {user_id: [template_id, template_id, ...]}
            
            total_features_cargadas = 0
            total_templates_procesados = 0
            
            for idx, user in enumerate(all_users, 1):
                print(f"\n{'─' * 60}")
                print(f"[FASE 1] PROCESANDO USUARIO {idx}/{len(all_users)}")
                print(f"[FASE 1]    Username: {user.username}")
                print(f"[FASE 1]    User ID: {user.user_id}")
                print(f"{'─' * 60}")
                
                # Obtener templates del usuario
                print(f"[FASE 1] Consultando templates del usuario en base de datos...")
                templates = database.list_user_templates(user.user_id)
                print(f"[FASE 1] Templates totales recuperados: {len(templates)}")
                total_templates_procesados += len(templates)
                
                if len(templates) == 0:
                    print(f"[FASE 1] [WARNING] Usuario sin templates en base de datos")
                    continue
                
                # Filtrar solo templates anatomicos
                print(f"[FASE 1] Filtrando templates anatomicos...")
                anatomical_templates = []
                for t in templates:
                    template_type_str = str(t.template_type).lower()
                    if template_type_str.find('anatomical') != -1:
                        anatomical_templates.append(t)
                        print(f"[FASE 1]    - Template {t.template_id[:20]}... tipo: {t.template_type} -> ANATOMICO")
                    else:
                        print(f"[FASE 1]    - Template {t.template_id[:20]}... tipo: {t.template_type} -> OMITIDO (no anatomico)")
                
                print(f"[FASE 1] Templates anatomicos encontrados: {len(anatomical_templates)}")
                
                if len(anatomical_templates) == 0:
                    print(f"[FASE 1] [WARNING] Usuario sin templates anatomicos")
                    continue
                
                features_list = []
                template_ids_list = []
                templates_con_features = 0
                templates_sin_features = 0
                
                print(f"[FASE 1] Extrayendo features de {len(anatomical_templates)} templates anatomicos...")
                
                for t_idx, template in enumerate(anatomical_templates, 1):
                    print(f"\n[FASE 1]    Template {t_idx}/{len(anatomical_templates)}: {template.template_id[:30]}...")
                    
                    features_loaded = False
                    
                    # Verificar metadata
                    if not template.metadata:
                        print(f"[FASE 1]       [ERROR] Template sin metadata")
                        templates_sin_features += 1
                        continue
                    
                    print(f"[FASE 1]       Metadata presente: SI")
                    print(f"[FASE 1]       Verificando campo 'bootstrap_features'...")
                    
                    # CARGAR FEATURES 180D
                    if template.metadata.get('bootstrap_features'):
                        bootstrap_features = template.metadata.get('bootstrap_features')
                        
                        print(f"[FASE 1]       Campo 'bootstrap_features' encontrado")
                        print(f"[FASE 1]       Tipo de datos: {type(bootstrap_features)}")
                        
                        # Convertir a numpy array
                        if isinstance(bootstrap_features, list):
                            print(f"[FASE 1]       Convirtiendo lista a numpy array...")
                            bootstrap_features = np.array(bootstrap_features, dtype=np.float32)
                            print(f"[FASE 1]       Conversion exitosa")
                        
                        print(f"[FASE 1]       Shape de bootstrap_features: {bootstrap_features.shape}")
                        print(f"[FASE 1]       Numero de dimensiones: {bootstrap_features.ndim}")
                        
                        # Validar dimensión - CASO 1D
                        if bootstrap_features.ndim == 1:
                            print(f"[FASE 1]       Procesando features 1D...")
                            
                            if bootstrap_features.shape[0] == 180:
                                print(f"[FASE 1]       [OK] Dimension correcta: {bootstrap_features.shape[0]} == 180")
                                
                                features_list.append(bootstrap_features)
                                template_ids_list.append(template.template_id)
                                templates_con_features += 1
                                total_features_cargadas += 1
                                features_loaded = True
                                
                                print(f"[FASE 1]       [SUCCESS] Features 180D cargadas exitosamente")
                                
                                if len(features_list) == 1:
                                    print(f"[FASE 1]       *** PRIMERA MUESTRA - ESTADISTICAS DETALLADAS ***")
                                    print(f"[FASE 1]          Shape: {bootstrap_features.shape}")
                                    print(f"[FASE 1]          Dtype: {bootstrap_features.dtype}")
                                    print(f"[FASE 1]          Mean: {np.mean(bootstrap_features):.6f}")
                                    print(f"[FASE 1]          Std: {np.std(bootstrap_features):.6f}")
                                    print(f"[FASE 1]          Min: {np.min(bootstrap_features):.6f}")
                                    print(f"[FASE 1]          Max: {np.max(bootstrap_features):.6f}")
                                    print(f"[FASE 1]          Primeros 5 valores: {bootstrap_features[:5]}")
                                    print(f"[FASE 1]          Ultimos 5 valores: {bootstrap_features[-5:]}")
                            else:
                                print(f"[FASE 1]       [ERROR] Dimension incorrecta: {bootstrap_features.shape[0]} != 180")
                                templates_sin_features += 1
                        
                        # Validar dimensión - CASO 2D
                        elif bootstrap_features.ndim == 2:
                            print(f"[FASE 1]       [WARNING] Features 2D detectadas: {bootstrap_features.shape}")
                            print(f"[FASE 1]       Aplicando promedio para obtener vector 1D...")
                            
                            features_1d = np.mean(bootstrap_features, axis=0)
                            print(f"[FASE 1]       Shape despues de promediar: {features_1d.shape}")
                            
                            if features_1d.shape[0] == 180:
                                print(f"[FASE 1]       [OK] Dimension correcta despues de promediar: 180")
                                
                                features_list.append(features_1d)
                                template_ids_list.append(template.template_id)
                                templates_con_features += 1
                                total_features_cargadas += 1
                                features_loaded = True
                                
                                print(f"[FASE 1]       [SUCCESS] Features 180D promediadas y cargadas")
                            else:
                                print(f"[FASE 1]       [ERROR] Dimension incorrecta despues de promediar: {features_1d.shape[0]} != 180")
                                templates_sin_features += 1
                        else:
                            print(f"[FASE 1]       [ERROR] Numero de dimensiones no soportado: {bootstrap_features.ndim}")
                            templates_sin_features += 1
                    else:
                        print(f"[FASE 1]       [ERROR] Campo 'bootstrap_features' NO encontrado en metadata")
                        templates_sin_features += 1
                    
                    if not features_loaded:
                        print(f"[FASE 1]       [SKIP] Template omitido - sin features validas")
                
                # Resumen del usuario
                print(f"\n[FASE 1] *** RESUMEN USUARIO: {user.username} ***")
                print(f"[FASE 1]    Templates anatomicos procesados: {len(anatomical_templates)}")
                print(f"[FASE 1]    Templates CON features 180D: {templates_con_features}")
                print(f"[FASE 1]    Templates SIN features 180D: {templates_sin_features}")
                print(f"[FASE 1]    Features recolectadas: {len(features_list)}")
                
                if features_list:
                    user_features_180d[user.user_id] = features_list
                    user_template_ids[user.user_id] = template_ids_list
                    print(f"[FASE 1]    [SUCCESS] Usuario AGREGADO con {len(features_list)} muestras 180D")
                else:
                    print(f"[FASE 1]    [WARNING] Usuario OMITIDO (sin features validas)")
            
            # Resumen FASE 1
            print("\n" + "=" * 80)
            print("RESUMEN COMPLETO FASE 1")
            print("=" * 80)
            print(f"[FASE 1] Templates totales procesados: {total_templates_procesados}")
            print(f"[FASE 1] Features totales cargadas: {total_features_cargadas}")
            print(f"[FASE 1] Usuarios totales en sistema: {len(all_users)}")
            print(f"[FASE 1] Usuarios CON features 180D: {len(user_features_180d)}")
            print(f"[FASE 1] Usuarios SIN features 180D: {len(all_users) - len(user_features_180d)}")
            
            print(f"\n[FASE 1] Detalle por usuario:")
            for user_id, features in user_features_180d.items():
                user_obj = next((u for u in all_users if u.user_id == user_id), None)
                user_name = user_obj.username if user_obj else "Unknown"
                print(f"[FASE 1]    - {user_name} (ID: {user_id[:30]}...): {len(features)} muestras")
            print("=" * 80)
            
            # Validacion minima de usuarios
            if len(user_features_180d) < 2:
                print("\n[FASE 1] [ERROR CRITICO] Insuficientes usuarios con features")
                print(f"[FASE 1]    Usuarios encontrados: {len(user_features_180d)}")
                print(f"[FASE 1]    Usuarios requeridos: 2 minimo")
                print("[FASE 1] No se puede continuar con recalculo de threshold")
                return False
            
            print(f"\n[FASE 1] [SUCCESS] Validacion exitosa: {len(user_features_180d)} usuarios disponibles")
            
            # ============================================================
            # FASE 2: CREAR PARES CON FEATURES 180D
            # ============================================================
            print("\n" + "=" * 80)
            print("FASE 2: CREANDO PARES GENUINOS/IMPOSTORES CON FEATURES 180D")
            print("=" * 80)
            print("[FASE 2] Iniciando creacion de pares para evaluacion")
            
            features_a = []  # Features 180D
            features_b = []  # Features 180D
            labels = []      # 1=genuino, 0=impostor
            
            user_ids = list(user_features_180d.keys())
            print(f"[FASE 2] Total usuarios para crear pares: {len(user_ids)}")
            
            # Pares genuinos (mismo usuario)
            print(f"\n[FASE 2] --- CREANDO PARES GENUINOS (mismo usuario) ---")
            genuine_count = 0
            genuine_per_user = {}
            
            for user_id in user_ids:
                user_features = user_features_180d[user_id]
                user_obj = next((u for u in all_users if u.user_id == user_id), None)
                user_name = user_obj.username if user_obj else "Unknown"
                user_pairs = 0
                
                print(f"[FASE 2] Procesando usuario: {user_name}")
                print(f"[FASE 2]    Muestras disponibles: {len(user_features)}")
                print(f"[FASE 2]    Combinaciones posibles: {len(user_features) * (len(user_features) - 1) // 2}")
                
                for i in range(len(user_features)):
                    for j in range(i + 1, len(user_features)):
                        features_a.append(user_features[i])
                        features_b.append(user_features[j])
                        labels.append(1)  # Genuino
                        genuine_count += 1
                        user_pairs += 1
                
                genuine_per_user[user_id] = user_pairs
                print(f"[FASE 2]    Pares genuinos creados: {user_pairs}")
            
            print(f"\n[FASE 2] Total pares genuinos: {genuine_count}")
            
            # Pares impostores (diferentes usuarios)
            print(f"\n[FASE 2] --- CREANDO PARES IMPOSTORES (diferentes usuarios) ---")
            impostor_count = 0
            impostor_combinations = []
            
            total_combinations = (len(user_ids) * (len(user_ids) - 1)) // 2
            print(f"[FASE 2] Combinaciones de usuarios posibles: {total_combinations}")
            
            for i, user_id1 in enumerate(user_ids):
                for j, user_id2 in enumerate(user_ids[i + 1:], i + 1):
                    user_obj1 = next((u for u in all_users if u.user_id == user_id1), None)
                    user_obj2 = next((u for u in all_users if u.user_id == user_id2), None)
                    user_name1 = user_obj1.username if user_obj1 else "Unknown"
                    user_name2 = user_obj2.username if user_obj2 else "Unknown"
                    
                    feat1 = user_features_180d[user_id1]
                    feat2 = user_features_180d[user_id2]
                    
                    print(f"\n[FASE 2] Combinacion: {user_name1} vs {user_name2}")
                    print(f"[FASE 2]    Muestras {user_name1}: {len(feat1)}")
                    print(f"[FASE 2]    Muestras {user_name2}: {len(feat2)}")
                    print(f"[FASE 2]    Pares posibles: {len(feat1) * len(feat2)}")
                    
                    # Limitar pares impostores para balance
                    max_pairs = min(100, len(feat1) * len(feat2))
                    print(f"[FASE 2]    Limite aplicado: {max_pairs} pares")
                    
                    pair_count = 0
                    
                    for f1 in feat1:
                        for f2 in feat2:
                            if pair_count < max_pairs:
                                features_a.append(f1)
                                features_b.append(f2)
                                labels.append(0)  # Impostor
                                impostor_count += 1
                                pair_count += 1
                            else:
                                break
                        if pair_count >= max_pairs:
                            break
                    
                    impostor_combinations.append((user_name1, user_name2, pair_count))
                    print(f"[FASE 2]    Pares impostores creados: {pair_count}")
            
            print(f"\n[FASE 2] Total pares impostores: {impostor_count}")
            
            # Convertir a arrays numpy
            print(f"\n[FASE 2] Convirtiendo listas a arrays numpy...")
            features_a = np.array(features_a, dtype=np.float32)
            features_b = np.array(features_b, dtype=np.float32)
            labels = np.array(labels, dtype=np.float32)
            print(f"[FASE 2] Conversion completada")
            
            # Resumen FASE 2
            print("\n" + "=" * 80)
            print("RESUMEN COMPLETO FASE 2")
            print("=" * 80)
            print(f"[FASE 2] PARES GENUINOS:")
            print(f"[FASE 2]    Total: {genuine_count}")
            for user_id, count in genuine_per_user.items():
                user_obj = next((u for u in all_users if u.user_id == user_id), None)
                user_name = user_obj.username if user_obj else "Unknown"
                print(f"[FASE 2]       - {user_name}: {count} pares")
            
            print(f"\n[FASE 2] PARES IMPOSTORES:")
            print(f"[FASE 2]    Total: {impostor_count}")
            for name1, name2, count in impostor_combinations:
                print(f"[FASE 2]       - {name1} vs {name2}: {count} pares")
            
            print(f"\n[FASE 2] TOTALES:")
            print(f"[FASE 2]    Pares genuinos: {genuine_count}")
            print(f"[FASE 2]    Pares impostores: {impostor_count}")
            print(f"[FASE 2]    Total pares: {len(labels)}")
            if impostor_count > 0:
                ratio = genuine_count / impostor_count
                print(f"[FASE 2]    Ratio genuinos/impostores: {ratio:.2f}:1")
            
            print(f"\n[FASE 2] DIMENSIONES DE ARRAYS:")
            print(f"[FASE 2]    Shape features_a: {features_a.shape}  <- DEBE SER (N, 180)")
            print(f"[FASE 2]    Shape features_b: {features_b.shape}  <- DEBE SER (N, 180)")
            print(f"[FASE 2]    Shape labels: {labels.shape}")
            print(f"[FASE 2]    Dtype features_a: {features_a.dtype}")
            print(f"[FASE 2]    Dtype features_b: {features_b.dtype}")
            print(f"[FASE 2]    Dtype labels: {labels.dtype}")
            print("=" * 80)
            
            # VALIDACIÓN CRÍTICA DE DIMENSIONES
            print(f"\n[FASE 2] VALIDACION CRITICA DE DIMENSIONES:")
            validation_passed = True
            
            if features_a.shape[1] != 180:
                print(f"[FASE 2] [ERROR] features_a dimension incorrecta: {features_a.shape[1]} != 180")
                validation_passed = False
            else:
                print(f"[FASE 2] [OK] features_a dimension correcta: 180")
            
            if features_b.shape[1] != 180:
                print(f"[FASE 2] [ERROR] features_b dimension incorrecta: {features_b.shape[1]} != 180")
                validation_passed = False
            else:
                print(f"[FASE 2] [OK] features_b dimension correcta: 180")
            
            if features_a.shape[0] != features_b.shape[0]:
                print(f"[FASE 2] [ERROR] Numero de pares no coincide: {features_a.shape[0]} != {features_b.shape[0]}")
                validation_passed = False
            else:
                print(f"[FASE 2] [OK] Numero de pares coincide: {features_a.shape[0]}")
            
            if features_a.shape[0] != labels.shape[0]:
                print(f"[FASE 2] [ERROR] Numero de labels no coincide: {features_a.shape[0]} != {labels.shape[0]}")
                validation_passed = False
            else:
                print(f"[FASE 2] [OK] Numero de labels coincide: {labels.shape[0]}")
            
            if not validation_passed:
                print(f"\n[FASE 2] [ERROR CRITICO] Validacion de dimensiones FALLIDA")
                print(f"[FASE 2] No se puede continuar con evaluacion")
                return False
            
            print(f"\n[FASE 2] [SUCCESS] Todas las validaciones pasaron correctamente")
            print(f"[FASE 2] Arrays listos para evaluate_real_model()")
            
            # ============================================================
            # FASE 3: EVALUAR CON RED NUEVA
            # ============================================================
            print("\n" + "=" * 80)
            print("FASE 3: EVALUANDO CON RED RECIEN ENTRENADA")
            print("=" * 80)
            print("[FASE 3] Iniciando evaluacion del modelo")
            print("[FASE 3] La red generara embeddings 64D on-the-fly desde features 180D")
            print("[FASE 3] y calculara threshold optimo basado en rendimiento actual")
            
            print(f"\n[FASE 3] Verificando estado del modelo antes de evaluar:")
            print(f"[FASE 3]    Modelo compilado: {self.is_compiled}")
            print(f"[FASE 3]    Modelo entrenado: {self.is_trained}")
            print(f"[FASE 3]    Base network existe: {self.base_network is not None}")
            print(f"[FASE 3]    Siamese model existe: {self.siamese_model is not None}")
            
            if not self.is_trained:
                print(f"[FASE 3] [WARNING] Modelo no marcado como entrenado, pero continuando...")
            
            print(f"\n[FASE 3] Llamando a evaluate_real_model()...")
            print(f"[FASE 3]    Input features_a shape: {features_a.shape}")
            print(f"[FASE 3]    Input features_b shape: {features_b.shape}")
            print(f"[FASE 3]    Input labels shape: {labels.shape}")
            print(f"[FASE 3] Procesando...")
            
            metrics = self.evaluate_real_model(features_a, features_b, labels)
            
            print(f"\n[FASE 3] evaluate_real_model() completado exitosamente")
            print(f"[FASE 3] Objeto de metricas recibido: {type(metrics)}")
            
            self.current_metrics = metrics
            print(f"[FASE 3] Metricas almacenadas en self.current_metrics")
            
            # Resumen FASE 3
            print("\n" + "=" * 80)
            print("RESUMEN COMPLETO FASE 3")
            print("=" * 80)
            print("[FASE 3] THRESHOLD RECALCULADO EXITOSAMENTE")
            print(f"\n[FASE 3] METRICAS CALCULADAS:")
            print(f"[FASE 3]    Threshold optimo: {metrics.threshold:.6f}")
            print(f"[FASE 3]    FAR (False Accept Rate): {metrics.far:.6f} = {metrics.far*100:.2f}%")
            print(f"[FASE 3]       Objetivo: <1% (<0.01)")
            print(f"[FASE 3]       Estado: {'PASS' if metrics.far < 0.01 else 'REVISAR'}")
            print(f"[FASE 3]    FRR (False Reject Rate): {metrics.frr:.6f} = {metrics.frr*100:.2f}%")
            print(f"[FASE 3]       Objetivo: <5% (<0.05)")
            print(f"[FASE 3]       Estado: {'PASS' if metrics.frr < 0.05 else 'REVISAR'}")
            print(f"[FASE 3]    EER (Equal Error Rate): {metrics.eer:.6f} = {metrics.eer*100:.2f}%")
            print(f"[FASE 3]       Objetivo: <3% (<0.03)")
            print(f"[FASE 3]       Estado: {'PASS' if metrics.eer < 0.03 else 'REVISAR'}")
            print(f"[FASE 3]    AUC Score: {metrics.auc_score:.6f}")
            print(f"[FASE 3]       Objetivo: >0.95")
            print(f"[FASE 3]       Estado: {'PASS' if metrics.auc_score > 0.95 else 'REVISAR'}")
            print(f"[FASE 3]    Accuracy: {metrics.accuracy:.6f} = {metrics.accuracy*100:.2f}%")
            print("=" * 80)
            
            # ============================================================
            # FASE 4: ACTUALIZAR EMBEDDINGS EN BD
            # ============================================================
            print("\n" + "=" * 80)
            print("FASE 4: ACTUALIZANDO EMBEDDINGS EN BASE DE DATOS")
            print("=" * 80)
            print("[FASE 4] Iniciando actualizacion de embeddings con red nueva")
            print("[FASE 4] Se regeneraran todos los embeddings y se guardaran en BD")
            
            embeddings_actualizados = 0
            embeddings_fallidos = 0
            usuarios_actualizados = 0
            
            for user_idx, (user_id, features_list) in enumerate(user_features_180d.items(), 1):
                user_obj = next((u for u in all_users if u.user_id == user_id), None)
                user_name = user_obj.username if user_obj else "Unknown"
                template_ids = user_template_ids[user_id]
                
                print(f"\n[FASE 4] Usuario {user_idx}/{len(user_features_180d)}: {user_name}")
                print(f"[FASE 4]    User ID: {user_id}")
                print(f"[FASE 4]    Templates a actualizar: {len(features_list)}")
                
                usuario_success = True
                
                for idx, (features, template_id) in enumerate(zip(features_list, template_ids), 1):
                    print(f"\n[FASE 4]    Template {idx}/{len(features_list)}")
                    print(f"[FASE 4]       Template ID: {template_id[:40]}...")
                    
                    try:
                        # Validar features
                        print(f"[FASE 4]       Validando features...")
                        print(f"[FASE 4]          Shape: {features.shape}")
                        print(f"[FASE 4]          Dtype: {features.dtype}")
                        
                        if features.shape[0] != 180:
                            print(f"[FASE 4]       [ERROR] Dimension incorrecta: {features.shape[0]} != 180")
                            embeddings_fallidos += 1
                            usuario_success = False
                            continue
                        
                        # Generar nuevo embedding con red entrenada
                        print(f"[FASE 4]       Generando nuevo embedding con base_network...")
                        features_reshaped = features.reshape(1, -1)
                        print(f"[FASE 4]          Features reshaped: {features_reshaped.shape}")
                        
                        new_embedding = self.base_network.predict(features_reshaped, verbose=0)[0]
                        print(f"[FASE 4]          Embedding generado: {new_embedding.shape}")
                        
                        # Normalizar embedding
                        print(f"[FASE 4]       Normalizando embedding...")
                        embedding_norm = np.linalg.norm(new_embedding)
                        print(f"[FASE 4]          Norma L2 antes: {embedding_norm:.6f}")
                        
                        if embedding_norm > 0:
                            new_embedding = new_embedding / embedding_norm
                            embedding_norm_after = np.linalg.norm(new_embedding)
                            print(f"[FASE 4]          Norma L2 despues: {embedding_norm_after:.6f}")
                        else:
                            print(f"[FASE 4]       [WARNING] Norma es cero, no se normaliza")
                        
                        # Estadisticas del nuevo embedding
                        if idx == 1:
                            print(f"[FASE 4]       Estadisticas del nuevo embedding (primera muestra):")
                            print(f"[FASE 4]          Mean: {np.mean(new_embedding):.6f}")
                            print(f"[FASE 4]          Std: {np.std(new_embedding):.6f}")
                            print(f"[FASE 4]          Min: {np.min(new_embedding):.6f}")
                            print(f"[FASE 4]          Max: {np.max(new_embedding):.6f}")
                        
                        # Actualizar en base de datos
                        print(f"[FASE 4]       Actualizando en base de datos...")
                        try:
                            template = database.get_template(template_id)
                            
                            if template:
                                print(f"[FASE 4]          Template recuperado de BD")
                                
                                # Guardar embedding viejo para comparacion
                                old_embedding = template.anatomical_embedding
                                if old_embedding is not None:
                                    print(f"[FASE 4]          Embedding anterior existe: SI (shape: {np.array(old_embedding).shape})")
                                else:
                                    print(f"[FASE 4]          Embedding anterior existe: NO")
                                
                                # Actualizar con nuevo embedding
                                template.anatomical_embedding = new_embedding
                                print(f"[FASE 4]          Nuevo embedding asignado a template")
                                
                                database._save_template(template)
                                print(f"[FASE 4]          Template actualizado en BD")
                                
                                embeddings_actualizados += 1
                                print(f"[FASE 4]       [SUCCESS] Embedding actualizado exitosamente")
                                
                            else:
                                print(f"[FASE 4]       [ERROR] Template no encontrado en BD")
                                embeddings_fallidos += 1
                                usuario_success = False
                        
                        except Exception as e:
                            print(f"[FASE 4]       [ERROR] Error actualizando BD: {type(e).__name__}")
                            print(f"[FASE 4]          Mensaje: {str(e)}")
                            embeddings_fallidos += 1
                            usuario_success = False
                            
                    except Exception as e:
                        print(f"[FASE 4]       [ERROR] Error generando embedding: {type(e).__name__}")
                        print(f"[FASE 4]          Mensaje: {str(e)}")
                        embeddings_fallidos += 1
                        usuario_success = False
                
                if usuario_success:
                    usuarios_actualizados += 1
                    print(f"\n[FASE 4]    [SUCCESS] Usuario {user_name} completado: {len(features_list)}/{len(features_list)} templates actualizados")
                else:
                    print(f"\n[FASE 4]    [WARNING] Usuario {user_name} con errores")
            
            # Resumen FASE 4
            print("\n" + "=" * 80)
            print("RESUMEN COMPLETO FASE 4")
            print("=" * 80)
            print(f"[FASE 4] ACTUALIZACION DE EMBEDDINGS:")
            print(f"[FASE 4]    Usuarios procesados: {len(user_features_180d)}")
            print(f"[FASE 4]    Usuarios actualizados completamente: {usuarios_actualizados}")
            print(f"[FASE 4]    Templates totales: {sum(len(f) for f in user_features_180d.values())}")
            print(f"[FASE 4]    Embeddings actualizados exitosamente: {embeddings_actualizados}")
            print(f"[FASE 4]    Embeddings fallidos: {embeddings_fallidos}")
            
            if embeddings_fallidos > 0:
                print(f"[FASE 4]    [WARNING] Hubo {embeddings_fallidos} fallos en actualizacion")
            else:
                print(f"[FASE 4]    [SUCCESS] Todos los embeddings actualizados sin errores")
            print("=" * 80)
            
            # ============================================================
            # FASE 5: GUARDAR MODELO CON THRESHOLD ACTUALIZADO
            # ============================================================
            print("\n" + "=" * 80)
            print("FASE 5: GUARDANDO MODELO CON THRESHOLD ACTUALIZADO")
            print("=" * 80)
            print("[FASE 5] Iniciando guardado del modelo")
            print(f"[FASE 5] Threshold a guardar: {metrics.threshold:.6f}")
            
            print(f"\n[FASE 5] Llamando a save_real_model()...")
            save_success = self.save_real_model()
            
            print(f"\n[FASE 5] Resultado de save_real_model(): {save_success}")
            
            # Resumen FASE 5
            print("\n" + "=" * 80)
            print("RESUMEN COMPLETO FASE 5")
            print("=" * 80)
            if save_success:
                print("[FASE 5] [SUCCESS] Modelo guardado exitosamente")
                print(f"[FASE 5]    Threshold guardado: {metrics.threshold:.6f}")
                print(f"[FASE 5]    Metricas guardadas: SI")
            else:
                print("[FASE 5] [ERROR] Error al guardar modelo")
                print("[FASE 5]    El modelo no se guardo correctamente")
            print("=" * 80)
            
            # ============================================================
            # RESUMEN FINAL COMPLETO
            # ============================================================
            print("\n" + "=" * 80)
            print("RESUMEN FINAL COMPLETO - RECALCULACION DE THRESHOLD")
            print("=" * 80)
            print(f"\n[RESUMEN] Timestamp finalizacion: {time.strftime('%Y-%m-%d %H:%M:%S')}")
            
            print(f"\n[RESUMEN] FASE 1 - CARGA DE FEATURES:")
            print(f"[RESUMEN]    Usuarios procesados: {len(all_users)}")
            print(f"[RESUMEN]    Usuarios con features: {len(user_features_180d)}")
            print(f"[RESUMEN]    Features totales: {total_features_cargadas}")
            print(f"[RESUMEN]    Estado: SUCCESS")
            
            print(f"\n[RESUMEN] FASE 2 - CREACION DE PARES:")
            print(f"[RESUMEN]    Pares genuinos: {genuine_count}")
            print(f"[RESUMEN]    Pares impostores: {impostor_count}")
            print(f"[RESUMEN]    Total pares: {len(labels)}")
            print(f"[RESUMEN]    Estado: SUCCESS")
            
            print(f"\n[RESUMEN] FASE 3 - EVALUACION Y THRESHOLD:")
            print(f"[RESUMEN]    Threshold calculado: {metrics.threshold:.6f}")
            print(f"[RESUMEN]    FAR: {metrics.far:.4f} ({metrics.far*100:.2f}%)")
            print(f"[RESUMEN]    FRR: {metrics.frr:.4f} ({metrics.frr*100:.2f}%)")
            print(f"[RESUMEN]    EER: {metrics.eer:.4f} ({metrics.eer*100:.2f}%)")
            print(f"[RESUMEN]    AUC: {metrics.auc_score:.4f}")
            print(f"[RESUMEN]    Accuracy: {metrics.accuracy:.4f} ({metrics.accuracy*100:.2f}%)")
            print(f"[RESUMEN]    Estado: SUCCESS")
            
            print(f"\n[RESUMEN] FASE 4 - ACTUALIZACION EMBEDDINGS:")
            print(f"[RESUMEN]    Embeddings actualizados: {embeddings_actualizados}")
            print(f"[RESUMEN]    Embeddings fallidos: {embeddings_fallidos}")
            print(f"[RESUMEN]    Estado: {'SUCCESS' if embeddings_fallidos == 0 else 'WARNING'}")
            
            print(f"\n[RESUMEN] FASE 5 - GUARDADO DE MODELO:")
            print(f"[RESUMEN]    Modelo guardado: {'SI' if save_success else 'NO'}")
            print(f"[RESUMEN]    Estado: {'SUCCESS' if save_success else 'ERROR'}")
            
            print(f"\n[RESUMEN] ESTADO FINAL: {'SUCCESS - PROCESO COMPLETADO' if save_success else 'ERROR - REVISAR LOGS'}")
            print("=" * 80)
            
            return save_success
            
        except Exception as e:
            print("\n" + "=" * 80)
            print("[ERROR CRITICO] ERROR EN RECALCULACION DE THRESHOLD")
            print("=" * 80)
            print(f"[ERROR] Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"[ERROR] Tipo de excepcion: {type(e).__name__}")
            print(f"[ERROR] Mensaje de error: {str(e)}")
            print(f"\n[ERROR] Stack trace completo:")
            import traceback
            traceback.print_exc()
            print("=" * 80)
            return False
    
    def predict_similarity_real(self, features1: np.ndarray, features2: np.ndarray) -> float:
        """Predice similitud entre dos vectores."""
        try:
            if not self.is_trained:
                raise ValueError("Modelo no entrenado")
            
            if self.siamese_model is None:
                raise ValueError("Modelo no inicializado")
            
            if len(features1) != self.input_dim or len(features2) != self.input_dim:
                raise ValueError(f"Dimensiones incorrectas")
            
            features1 = np.array(features1, dtype=np.float32).reshape(1, -1)
            features2 = np.array(features2, dtype=np.float32).reshape(1, -1)
            
            distance = self.siamese_model.predict([features1, features2])[0][0]
            
            similarity = 1.0 / (1.0 + distance)
            similarity = np.clip(similarity, 0.0, 1.0)
            
            print(f"Predicción: distancia={distance:.4f}, similitud={similarity:.4f}")
            
            return float(similarity)
            
        except Exception as e:
            print(f"Error en predicción: {e}")
            return 0.0
    
    def authenticate_real(self, query_features: np.ndarray, 
                         reference_templates: List[np.ndarray]) -> Tuple[bool, float, Dict[str, Any]]:
        """Autentica usuario comparando con templates."""
        try:
            if not self.is_trained:
                print("Modelo no está entrenado para autenticación")
                return False, 0.0, {'error': 'Modelo no entrenado'}
            
            if not reference_templates:
                print("No hay templates de referencia")
                return False, 0.0, {'error': 'Sin templates'}
            
            print(f"Autenticación: comparando con {len(reference_templates)} templates")
            
            similarities = []
            for i, template in enumerate(reference_templates):
                try:
                    similarity = self.predict_similarity_real(query_features, template)
                    similarities.append(similarity)
                    print(f"  Template {i+1}: {similarity:.4f}")
                except Exception as e:
                    print(f"Error con template {i+1}: {e}")
                    continue
            
            if not similarities:
                return False, 0.0, {'error': 'Error en similitudes'}
            
            max_similarity = np.max(similarities)
            mean_similarity = np.mean(similarities)
            std_similarity = np.std(similarities)
            
            threshold_decision = max_similarity > self.optimal_threshold
            
            consistency_bonus = 0.0
            if len(similarities) > 1:
                high_similarities = [s for s in similarities if s > self.optimal_threshold]
                consistency_bonus = len(high_similarities) / len(similarities) * 0.1
            
            final_score = min(1.0, max_similarity + consistency_bonus)
            is_authentic = threshold_decision and final_score > self.optimal_threshold
            
            details = {
                'max_similarity': max_similarity,
                'mean_similarity': mean_similarity,
                'std_similarity': std_similarity,
                'num_references': len(reference_templates),
                'threshold_used': self.optimal_threshold,
                'consistency_bonus': consistency_bonus,
                'final_score': final_score,
                'similarities': similarities,
                'model_trained': self.is_trained,
                'authentication_method': 'real_siamese_anatomical'
            }
                        
            print(f"Resultado autenticación:")
            print(f"  - Auténtico: {is_authentic}")
            print(f"  - Score máximo: {max_similarity:.4f}")
            print(f"  - Score final: {final_score:.4f}")
            print(f"  - Threshold: {self.optimal_threshold:.4f}")
            print(f"  - Templates consultados: {len(reference_templates)}")
            
            return is_authentic, final_score, details
            
        except Exception as e:
            print(f"Error en autenticación: {e}")
            return False, 0.0, {'error': str(e)}
    
    def save_real_model(self, filepath: Optional[str] = None) -> bool:
        """Guarda el modelo REAL entrenado."""
        try:
            if not self.is_trained:
                print("No hay modelo entrenado para guardar")
                return False
            
            if filepath is None:
                models_dir = Path(get_config('paths.models', 'biometric_data/models'))
                filepath = models_dir / 'anatomical_model.h5'
            
            model_path = Path(filepath)
            model_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Guardar modelo
            self.siamese_model.save(str(model_path))
            
            # Guardar metadatos
            from datetime import datetime
            metadata = {
                'embedding_dim': int(self.embedding_dim),
                'input_dim': int(self.input_dim),
                'optimal_threshold': float(self.optimal_threshold),
                'is_trained': True,
                'training_samples': int(self.total_genuine_pairs + self.total_impostor_pairs),
                'users_trained_count': int(self.users_trained_count),
                'total_genuine_pairs': int(self.total_genuine_pairs),
                'total_impostor_pairs': int(self.total_impostor_pairs),
                'save_timestamp': datetime.now().isoformat(),
                'version': '2.0',
                'config': self.config
            }
            
            # if self.current_metrics:
            #     metadata['metrics'] = {
            #         'far': float(self.current_metrics.far),
            #         'frr': float(self.current_metrics.frr),
            #         'eer': float(self.current_metrics.eer),
            #         'auc_score': float(self.current_metrics.auc_score),
            #         'accuracy': float(self.current_metrics.accuracy),
            #         'threshold': float(self.current_metrics.threshold),
            #         'precision': float(self.current_metrics.precision),
            #         'recall': float(self.current_metrics.recall),
            #         'f1_score': float(self.current_metrics.f1_score)
            #     }
            
            # metadata_path = model_path.with_suffix('.json')
            # with open(metadata_path, 'w') as f:
            #     json.dump(metadata, f, indent=2)
            
            if self.current_metrics:
                metadata['metrics'] = {
                    'far': float(self.current_metrics.far),
                    'frr': float(self.current_metrics.frr),
                    'eer': float(self.current_metrics.eer),
                    'auc_score': float(self.current_metrics.auc_score),
                    'accuracy': float(self.current_metrics.accuracy),
                    'threshold': float(self.current_metrics.threshold),
                    'precision': float(self.current_metrics.precision),
                    'recall': float(self.current_metrics.recall),
                    'f1_score': float(self.current_metrics.f1_score)
                }
                
                # ============ AGREGAR TODO ESTE BLOQUE ============ #
                # 1. ROC CURVE (si está disponible en current_metrics)
                if hasattr(self.current_metrics, 'roc_fpr') and self.current_metrics.roc_fpr:
                    metadata['roc_curve'] = {
                        'fpr': [float(x) for x in self.current_metrics.roc_fpr],
                        'tpr': [float(x) for x in self.current_metrics.roc_tpr]
                    }
                
                # 2. CONFUSION MATRIX (calcular desde métricas)
                if self.current_metrics.total_genuine_pairs > 0 and self.current_metrics.total_impostor_pairs > 0:
                    # Calcular valores de confusion matrix desde métricas
                    total_genuine = self.current_metrics.total_genuine_pairs
                    total_impostor = self.current_metrics.total_impostor_pairs
                    
                    fn = int(self.current_metrics.frr * total_genuine)  # False Negatives
                    tp = total_genuine - fn  # True Positives
                    fp = int(self.current_metrics.far * total_impostor)  # False Positives
                    tn = total_impostor - fp  # True Negatives
                    
                    metadata['confusion_matrix'] = {
                        'true_positives': int(tp),
                        'false_positives': int(fp),
                        'true_negatives': int(tn),
                        'false_negatives': int(fn)
                    }
                # ================================================== #

            # 3. TRAINING HISTORY (agregar FUERA del if self.current_metrics)
            if self.training_history and hasattr(self.training_history, 'loss') and self.training_history.loss:
                metadata['training_history'] = {
                    'loss': [float(x) for x in self.training_history.loss],
                    'val_loss': [float(x) for x in self.training_history.val_loss],
                    'epochs': list(range(1, len(self.training_history.loss) + 1))
                }
                
                # Agregar FAR/FRR history si están disponibles
                if hasattr(self.training_history, 'far_history') and self.training_history.far_history:
                    metadata['training_history']['far_history'] = [float(x) for x in self.training_history.far_history]
                if hasattr(self.training_history, 'frr_history') and self.training_history.frr_history:
                    metadata['training_history']['frr_history'] = [float(x) for x in self.training_history.frr_history]

            # 4. SCORE DISTRIBUTIONS (si se guardaron en evaluate)
            if hasattr(self, 'genuine_scores') and hasattr(self, 'impostor_scores'):
                metadata['score_distributions'] = {
                    'genuine_scores': [float(x) for x in self.genuine_scores],
                    'impostor_scores': [float(x) for x in self.impostor_scores]
                }

            metadata_path = model_path.with_suffix('.json')
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            print(f"Modelo anatómico guardado: {model_path}")
            print(f"Metadatos: {metadata_path}")
            return True
            
        except Exception as e:
            print(f"Error guardando modelo: {e}")
            return False
    
    # def load_real_model(self, filepath: Optional[str] = None) -> bool:
    #     """Carga un modelo REAL previamente entrenado."""
    #     try:
    #         if filepath is None:
    #             models_dir = Path(get_config('paths.models', 'biometric_data/models'))
    #             filepath = models_dir / 'anatomical_model.h5'
            
    #         model_path = Path(filepath)
            
    #         if not model_path.exists():
    #             print(f"Modelo no existe: {model_path}")
    #             return False
            
    #         # Construir arquitectura
    #         if not self.base_network:
    #             self.build_real_base_network()
            
    #         if not self.siamese_model:
    #             self.build_real_siamese_model()
            
    #         if not self.is_compiled:
    #             self.compile_real_model()
            
    #         # Cargar pesos
    #         self.siamese_model.load_weights(str(model_path))
    #         self.is_trained = True
    #         self.is_compiled = True
            
    #         print(f"Modelo anatómico cargado: {model_path}")
    #         print(f"Parámetros: {self.siamese_model.count_params():,}")
            
    #         return True
            
    #     except Exception as e:
    #         print(f"Error cargando modelo: {e}")
    #         self.is_trained = False
    #         return False
    
    def load_real_model(self, filepath: Optional[str] = None) -> bool:
        """Carga un modelo REAL previamente entrenado."""
        try:
            if filepath is None:
                models_dir = Path(get_config('paths.models', 'biometric_data/models'))
                filepath = models_dir / 'anatomical_model.h5'
            
            model_path = Path(filepath)
            
            if not model_path.exists():
                print(f"Modelo no existe: {model_path}")
                return False
            
            # Construir arquitectura
            if not self.base_network:
                self.build_real_base_network()
            
            if not self.siamese_model:
                self.build_real_siamese_model()
            
            if not self.is_compiled:
                self.compile_real_model()
            
            # Cargar pesos
            self.siamese_model.load_weights(str(model_path))
            self.is_trained = True
            self.is_compiled = True
            
            print(f"✓ Modelo anatómico cargado: {model_path}")
            print(f"✓ Parámetros: {self.siamese_model.count_params():,}")
            
            # ============================================================
            # NUEVO: Cargar metadatos y métricas desde JSON
            # ============================================================
            metadata_path = model_path.with_suffix('.json')
            if metadata_path.exists():
                try:
                    import json
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                    
                    # Restaurar metadatos básicos
                    self.optimal_threshold = metadata.get('optimal_threshold', 0.5)
                    self.users_trained_count = metadata.get('users_trained_count', 0)
                    self.total_genuine_pairs = metadata.get('total_genuine_pairs', 0)
                    self.total_impostor_pairs = metadata.get('total_impostor_pairs', 0)
                    
                    print(f"✓ Metadatos cargados:")
                    print(f"  - Usuarios entrenados: {self.users_trained_count}")
                    print(f"  - Pares genuinos: {self.total_genuine_pairs}")
                    print(f"  - Pares impostores: {self.total_impostor_pairs}")
                    print(f"  - Threshold óptimo: {self.optimal_threshold:.4f}")
                    
                    # Restaurar métricas biométricas
                    if 'metrics' in metadata:
                        metrics_data = metadata['metrics']
                        
                        # Crear objeto RealModelMetrics
                        self.current_metrics = RealModelMetrics(
                            far=metrics_data.get('far', 0.0),
                            frr=metrics_data.get('frr', 0.0),
                            eer=metrics_data.get('eer', 0.0),
                            auc_score=metrics_data.get('auc_score', 0.0),
                            accuracy=metrics_data.get('accuracy', 0.0),
                            threshold=metrics_data.get('threshold', 0.0),
                            precision=metrics_data.get('precision', 0.0),
                            recall=metrics_data.get('recall', 0.0),
                            f1_score=metrics_data.get('f1_score', 0.0),
                            total_genuine_pairs=self.total_genuine_pairs,
                            total_impostor_pairs=self.total_impostor_pairs,
                            users_in_test=self.users_trained_count,
                            cross_validation_score=0.0
                        )
                        
                        print(f"✓ Métricas biométricas restauradas:")
                        print(f"  - FAR: {self.current_metrics.far:.4f}")
                        print(f"  - FRR: {self.current_metrics.frr:.4f}")
                        print(f"  - EER: {self.current_metrics.eer:.4f}")
                        print(f"  - AUC: {self.current_metrics.auc_score:.4f}")
                        print(f"  - Accuracy: {self.current_metrics.accuracy:.4f}")
                    else:
                        logger.warning("⚠ No se encontraron métricas en metadatos")
                        self.current_metrics = None
                        
                except Exception as e:
                    print(f"Error cargando metadatos: {e}")
                    # Continuar aunque falle la carga de metadatos
                    self.current_metrics = None
            else:
                logger.warning(f"⚠ Archivo de metadatos no encontrado: {metadata_path}")
                self.current_metrics = None
            # ============================================================
            
            return True
            
        except Exception as e:
            print(f"Error cargando modelo: {e}")
            self.is_trained = False
            return False
    
    def get_real_model_summary(self) -> Dict[str, Any]:
        """Obtiene resumen completo del modelo REAL."""
        summary = {
            "architecture": {
                "embedding_dim": self.embedding_dim,
                "input_dim": self.input_dim,
                "hidden_layers": self.config['hidden_layers'],
                "total_parameters": self.siamese_model.count_params() if self.siamese_model else 0,
                "distance_metric": self.config['distance_metric'],
                "model_type": "Real Siamese Anatomical Network"
            },
            "training": {
                "is_trained": self.is_trained,
                "users_trained": self.users_trained_count,
                "genuine_pairs": self.total_genuine_pairs,
                "impostor_pairs": self.total_impostor_pairs,
                "optimal_threshold": self.optimal_threshold,
                "training_time": getattr(self.training_history, 'total_training_time', 0),
                "data_source": "real_users_database"
            },
            "performance": {},
            "status": {
                "model_compiled": self.is_compiled,
                "base_network_built": self.base_network is not None,
                "siamese_model_built": self.siamese_model is not None,
                "ready_for_inference": self.is_trained and self.is_compiled,
                "version": "2.0"
            }
        }
        
        if self.current_metrics:
            summary["performance"] = {
                "far": self.current_metrics.far,
                "frr": self.current_metrics.frr,
                "eer": self.current_metrics.eer,
                "auc_score": self.current_metrics.auc_score,
                "accuracy": self.current_metrics.accuracy,
                "optimal_threshold": self.current_metrics.threshold
            }
        
        return summary


# ===== INSTANCIA GLOBAL =====
_real_siamese_anatomical_instance = None

def get_real_siamese_anatomical_network(embedding_dim: int = 64, 
                                       input_dim: int = 180) -> RealSiameseAnatomicalNetwork:
    """Obtiene instancia global de la red siamesa anatómica REAL."""
    global _real_siamese_anatomical_instance
    
    if _real_siamese_anatomical_instance is None:
        _real_siamese_anatomical_instance = RealSiameseAnatomicalNetwork(embedding_dim, input_dim)
    
    # Verificar modelo guardado
    if not _real_siamese_anatomical_instance.is_trained:
        try:
            models_dir = Path('biometric_data/models')
            model_path = models_dir / 'anatomical_model.h5'
            
            if model_path.exists():
                print(f"Cargando modelo anatómico: {model_path}")
                try:
                    if _real_siamese_anatomical_instance.siamese_model is None:
                        _real_siamese_anatomical_instance.build_real_base_network()
                        _real_siamese_anatomical_instance.build_real_siamese_model()
                        _real_siamese_anatomical_instance.compile_real_model()
                    
                    _real_siamese_anatomical_instance.siamese_model.load_weights(str(model_path))
                    _real_siamese_anatomical_instance.is_trained = True
                    
                    print(f"Red anatómica cargada: {model_path}")
                    print(f"Estado: is_trained = {_real_siamese_anatomical_instance.is_trained}")
                    
                except Exception as load_error:
                    logger.warning(f"Error cargando modelo: {load_error}")
            else:
                print(f"No se encontró modelo guardado: {model_path}")
        
        except Exception as e:
            logger.warning(f"Error verificando modelo: {e}")
    
    return _real_siamese_anatomical_instance


# Alias para compatibilidad
SiameseAnatomicalNetwork = RealSiameseAnatomicalNetwork
get_siamese_anatomical_network = get_real_siamese_anatomical_network