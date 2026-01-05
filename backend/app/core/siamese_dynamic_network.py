"""
MÓDULO 10: SIAMESE_DYNAMIC_NETWORK
Red Siamesa REAL para características dinámicas temporales (100% SIN SIMULACIÓN)
"""

import numpy as np
import logging
from typing import List, Dict, Tuple, Optional, Any, Union
from dataclasses import dataclass, field
from enum import Enum
import time
import json
from pathlib import Path
from datetime import datetime
from sklearn.metrics import roc_curve, auc as compute_auc

# TensorFlow/Keras imports
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers, Model, optimizers, callbacks
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    logging.warning("TensorFlow no disponible - red siamesa dinámica limitada")

# Scikit-learn imports
try:
    from sklearn.metrics import roc_auc_score, accuracy_score, precision_recall_curve, roc_curve, auc, confusion_matrix
    from sklearn.model_selection import train_test_split
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logging.warning("Scikit-learn no disponible - métricas limitadas")

# Importar módulos anteriores
try:
    from app.core.config_manager import get_config, get_logger, log_error, log_info
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


def log_warning(message: str):
    """Función de conveniencia para logging de warnings."""
    try:
        logger.warning(message)
    except:
        print(f"WARNING: {message}")


@dataclass
class RealDynamicSample:
    """Muestra de secuencia dinámica temporal de usuario."""
    user_id: str
    sequence_id: str
    temporal_features: np.ndarray
    gesture_sequence: List[str]
    transition_types: List[str]
    timestamp: float
    duration: float
    quality_score: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RealTemporalPair:
    """Par de secuencias temporales para entrenamiento."""
    sample1: RealDynamicSample
    sample2: RealDynamicSample
    is_genuine: bool
    temporal_distance: Optional[float] = None
    confidence: float = 1.0


@dataclass
class RealTemporalMetrics:
    """Métricas específicas para evaluación temporal."""
    far: float
    frr: float
    eer: float
    auc_score: float
    accuracy: float
    threshold: float
    precision: float
    recall: float
    f1_score: float
    sequence_correlation: float
    temporal_consistency: float
    rhythm_similarity: float
    validation_samples: int
    roc_fpr: List[float] = field(default_factory=list)
    roc_tpr: List[float] = field(default_factory=list)


@dataclass
class RealTemporalTrainingHistory:
    """Historial de entrenamiento para modelo temporal."""
    loss: List[float] = field(default_factory=list)
    val_loss: List[float] = field(default_factory=list)
    accuracy: List[float] = field(default_factory=list)
    val_accuracy: List[float] = field(default_factory=list)
    sequence_accuracy: List[float] = field(default_factory=list)
    temporal_loss: List[float] = field(default_factory=list)
    learning_rate: List[float] = field(default_factory=list)
    epoch_times: List[float] = field(default_factory=list)
    far_history: List[float] = field(default_factory=list)
    frr_history: List[float] = field(default_factory=list)
    eer_history: List[float] = field(default_factory=list)
    best_epoch: int = 0
    total_training_time: float = 0.0


class RealSiameseDynamicNetwork:
    """
    Red Siamesa para autenticación biométrica basada en características dinámicas temporales.
    Implementa arquitectura twin network con LSTM/BiLSTM para procesar secuencias.
    """
    
    def __init__(self, embedding_dim: int = 128, sequence_length: int = 50, feature_dim: int = 320):
        """Inicializa la red siamesa dinámica."""
        
        if not TF_AVAILABLE:
            raise ImportError("TensorFlow no disponible")
        
        self.logger = get_logger()
        
        # Configuración del modelo
        self.embedding_dim = embedding_dim
        self.sequence_length = sequence_length
        self.feature_dim = feature_dim
        self.config = self._load_real_dynamic_config()
        
        # Arquitectura del modelo
        self.base_network = None
        self.siamese_model = None
        self.is_compiled = False
        
        # Estado de entrenamiento
        self.training_history = RealTemporalTrainingHistory()
        self.is_trained = False
        self.optimal_threshold = 0.5
        
        # Dataset REAL y métricas
        self.real_training_samples: List[RealDynamicSample] = []
        self.real_validation_samples: List[RealDynamicSample] = []
        self.current_metrics: Optional[RealTemporalMetrics] = None
        
        # Rutas de guardado
        self.model_save_path = self._get_real_model_save_path()
        
        # Estadísticas
        self.users_trained_count = 0
        
        print("RealSiameseDynamicNetwork inicializada")
    
    def _load_real_dynamic_config(self) -> Dict[str, Any]:
        """Carga configuración de la red siamesa dinámica."""
        real_config = {
            'sequence_processing': 'bidirectional_lstm',
            'lstm_units': [128, 64],
            'dropout_rate': 0.3,
            'recurrent_dropout': 0.2,
            'dense_layers': [256, 128],
            'temporal_pooling': 'attention',
            'sequence_normalization': 'layer_norm',
            
            'use_masking': True,
            'return_sequences': False,
            'stateful': False,
            'max_sequence_length': 50,
            'min_sequence_length': 5,
            
            'learning_rate': 5e-4,
            'batch_size': 32,
            'epochs': 100,
            'early_stopping_patience': 10,
            'reduce_lr_patience': 8,
            'min_lr': 1e-6,
            
            'loss_function': 'contrastive',
            'margin': 0.8,
            'distance_metric': 'euclidean',
            
            'min_samples_per_user': 15,
            'min_users_for_training': 2,
            'quality_threshold': 80.0,
            'temporal_consistency_threshold': 0.7,
            
            'use_temporal_augmentation': True,
            'time_shift_range': 0.1,
            'speed_variation_range': 0.2,
            'noise_level': 0.01,
        }
        
        print("Configuración de red dinámica cargada")
        return real_config
    
    def _get_real_model_save_path(self) -> Path:
        """Obtiene ruta para guardar modelos."""
        models_dir = Path(get_config('paths.models', 'biometric_data/models'))
        return models_dir / 'dynamic_model.h5'
    
    def build_real_base_network(self) -> Model:
        """Construye la red base temporal con BiLSTM."""
        try:
            print("Construyendo red base temporal...")
            
            # Input layer para secuencias temporales
            input_layer = layers.Input(
                shape=(self.sequence_length, self.feature_dim), 
                name='real_dynamic_sequence'
            )
            
            x = input_layer
            
            # Masking para secuencias de longitud variable
            if self.config['use_masking']:
                x = layers.Masking(mask_value=0.0, name='real_sequence_masking')(x)
                print("  - Masking aplicado para secuencias variables")
            
            # Normalización de secuencias
            if self.config['sequence_normalization'] == 'layer_norm':
                x = layers.LayerNormalization(name='real_sequence_layer_norm')(x)
                print("  - Layer normalization aplicada")
            
            # Capas temporales
            x = self._build_real_temporal_layers(x)
            
            # Pooling temporal
            x = self._build_real_temporal_pooling(x)
            
            # Capas densas finales
            for i, units in enumerate(self.config['dense_layers']):
                x = layers.Dense(
                    units, 
                    activation='relu',
                    name=f'real_dense_temporal_{i+1}',
                    kernel_regularizer=keras.regularizers.l2(0.001)
                )(x)
                
                if self.config['dropout_rate'] > 0:
                    x = layers.Dropout(
                        self.config['dropout_rate'], 
                        name=f'real_dropout_temporal_{i+1}'
                    )(x)
            
            # Embedding final
            embedding = layers.Dense(
                self.embedding_dim, 
                activation='linear',
                name='real_temporal_embedding',
                kernel_regularizer=keras.regularizers.l2(0.001)
            )(x)
            
            # Normalización L2
            embedding_normalized = layers.Lambda(
                lambda x: tf.nn.l2_normalize(x, axis=1), 
                name='real_l2_normalize_temporal'
            )(embedding)
            
            # Crear modelo base
            base_model = Model(
                inputs=input_layer, 
                outputs=embedding_normalized, 
                name='real_temporal_base_network'
            )
            
            self.base_network = base_model
            
            total_params = base_model.count_params()
            print(f"Red base temporal construida: ({self.sequence_length}, {self.feature_dim}) → {self.embedding_dim}")
            print(f"  - Parámetros totales: {total_params:,}")
            print(f"  - Arquitectura: {self.config['sequence_processing']}")
            print(f"  - LSTM units: {self.config['lstm_units']}")
            print(f"  - Dropout: {self.config['dropout_rate']}")
            print(f"  - Pooling: {self.config['temporal_pooling']}")
            
            return base_model
            
        except Exception as e:
            logger.error(f"Error construyendo red base temporal: {e}")
            raise
    
    def _build_real_temporal_layers(self, x):
        """Construye las capas temporales (LSTM/BiLSTM)."""
        try:
            lstm_units = self.config['lstm_units']
            processing_type = self.config['sequence_processing']
            
            print(f"=== CONSTRUYENDO CAPAS TEMPORALES ===")
            print(f"Input tensor shape: {x.shape}")
            print(f"Processing type: {processing_type}")
            print(f"LSTM units: {lstm_units}")
            print(f"Temporal pooling: {self.config['temporal_pooling']}")
            
            for i, units in enumerate(lstm_units):
                print(f"--- Capa LSTM {i+1}/{len(lstm_units)} ---")
                
                # IMPORTANTE: Si usamos pooling personalizado, todas las capas retornan secuencias
                if self.config['temporal_pooling'] in ['attention', 'last']:
                    return_sequences = True
                    print(f"Capa {i+1}: return_sequences=True (pooling personalizado detectado)")
                else:
                    return_sequences = i < len(lstm_units) - 1
                    print(f"Capa {i+1}: return_sequences={return_sequences} (pooling estándar)")
                
                print(f"Antes de construir capa {i+1}: tensor shape = {x.shape}")
                
                if processing_type == 'bidirectional_lstm':
                    print(f"Construyendo Bidirectional LSTM con {units} unidades...")
                    try:
                        x = layers.Bidirectional(
                            layers.LSTM(
                                units,
                                return_sequences=return_sequences,
                                dropout=self.config['dropout_rate'],
                                recurrent_dropout=self.config['recurrent_dropout'],
                                kernel_regularizer=keras.regularizers.l2(0.001),
                                name=f'real_lstm_{i+1}'
                            ),
                            name=f'real_bidirectional_lstm_{i+1}'
                        )(x)
                        print(f"✓ Bidirectional LSTM {i+1} construido exitosamente")
                        print(f"Después de BiLSTM {i+1}: tensor shape = {x.shape}")
                    except Exception as lstm_error:
                        logger.error(f"ERROR en BiLSTM {i+1}: {lstm_error}")
                        logger.error(f"Config dropout: {self.config['dropout_rate']}")
                        logger.error(f"Config recurrent_dropout: {self.config['recurrent_dropout']}")
                        raise
                        
                elif processing_type == 'lstm':
                    print(f"Construyendo LSTM simple con {units} unidades...")
                    try:
                        x = layers.LSTM(
                            units,
                            return_sequences=return_sequences,
                            dropout=self.config['dropout_rate'],
                            recurrent_dropout=self.config['recurrent_dropout'],
                            kernel_regularizer=keras.regularizers.l2(0.001),
                            name=f'real_lstm_{i+1}'
                        )(x)
                        print(f"✓ LSTM {i+1} construido exitosamente")
                        print(f"Después de LSTM {i+1}: tensor shape = {x.shape}")
                    except Exception as lstm_error:
                        logger.error(f"ERROR en LSTM {i+1}: {lstm_error}")
                        raise
                        
                elif processing_type == 'gru':
                    print(f"Construyendo GRU con {units} unidades...")
                    try:
                        x = layers.GRU(
                            units,
                            return_sequences=return_sequences,
                            dropout=self.config['dropout_rate'],
                            recurrent_dropout=self.config['recurrent_dropout'],
                            kernel_regularizer=keras.regularizers.l2(0.001),
                            name=f'real_gru_{i+1}'
                        )(x)
                        print(f"✓ GRU {i+1} construido exitosamente")
                        print(f"Después de GRU {i+1}: tensor shape = {x.shape}")
                    except Exception as gru_error:
                        logger.error(f"ERROR en GRU {i+1}: {gru_error}")
                        raise
                
                # Normalización entre capas
                if i < len(lstm_units) - 1:
                    print(f"Aplicando LayerNormalization después de capa {i+1}...")
                    try:
                        x = layers.LayerNormalization(name=f'real_layer_norm_{i+1}')(x)
                        print(f"✓ LayerNormalization {i+1} aplicada exitosamente")
                        print(f"Después de LayerNorm {i+1}: tensor shape = {x.shape}")
                    except Exception as norm_error:
                        logger.error(f"ERROR en LayerNormalization {i+1}: {norm_error}")
                        raise
                else:
                    print(f"Última capa: omitiendo LayerNormalization")
            
            print(f"=== CAPAS TEMPORALES COMPLETADAS ===")
            print(f"Shape final: {x.shape}")
            print(f"Total capas construidas: {len(lstm_units)}")

            
            return x
            
        except Exception as e:
            logger.error(f"=== ERROR CONSTRUYENDO CAPAS TEMPORALES ===")
            logger.error(f"Error: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    def _build_real_temporal_pooling(self, x):
        """Construye el pooling temporal con attention mechanism."""
        try:
            pooling_type = self.config['temporal_pooling']
            print(f"=== CONSTRUYENDO POOLING TEMPORAL ===")
            print(f"Input tensor shape: {x.shape}")
            print(f"Pooling type: {pooling_type}")
            print(f"self.sequence_length: {self.sequence_length}")

            
            if pooling_type == 'attention':
                print("--- CONSTRUYENDO ATTENTION MECHANISM ---")
                
                try:
                    # 1. Crear contexto global
                    print("Paso 1: Global context...")
                    global_context = layers.GlobalAveragePooling1D(name='real_global_context')(x)
                    print(f"Global context shape: {global_context.shape}")
                    
                    # 2. Expandir contexto
                    print("Paso 2: Expandiendo context...")
                    print(f"Usando self.sequence_length = {self.sequence_length}")

                    global_context_expanded = layers.RepeatVector(
                        self.sequence_length, 
                        name='real_context_expanded'
                    )(global_context)
                    print(f"Context expanded shape: {global_context_expanded.shape}")
                    
                    # 3. Concatenar
                    print("Paso 3: Concatenando...")
                    print(f"Shapes para concatenar: x={x.shape}, context_expanded={global_context_expanded.shape}")

                    combined = layers.Concatenate(
                        axis=-1, 
                        name='real_combined_features'
                    )([x, global_context_expanded])
                    print(f"Combined features shape: {combined.shape}")
                    
                    # 4. Attention scores
                    print("Paso 4: Attention scores...")
                    attention_scores = layers.Dense(
                        1, 
                        activation='tanh', 
                        name='real_attention_scores'
                    )(combined)
                    print(f"Attention scores shape: {attention_scores.shape}")
                    print(f"Dense output dtype: {attention_scores.dtype}")
                    
                    # 5. Normalizar con softmax
                    print("Paso 5: Normalizado con softmax...")
                    print(f"ANTES del Softmax - attention_scores shape: {attention_scores.shape}")

                    attention_scores_squeezed = layers.Lambda(
                        lambda x: tf.squeeze(x, axis=-1),
                        name='real_attention_squeeze'
                    )(attention_scores)
                    print(f"Squeezed shape: {attention_scores_squeezed.shape}")
                    
                    attention_weights = layers.Softmax(
                        axis=1, 
                        name='real_attention_weights'
                    )(attention_scores_squeezed)
                    print(f"Attention weights shape: {attention_weights.shape}")
                    
                    # 6. Weighted average
                    print("Paso 6: Weighted average...")
                    attention_weights_expanded = layers.Lambda(
                        lambda x: tf.expand_dims(x, axis=-1),
                        name='real_attention_expand'
                    )(attention_weights)
                    print(f"Weights expanded shape: {attention_weights_expanded.shape}")
                    
                    weighted_output = layers.Lambda(
                        lambda inputs: tf.reduce_sum(inputs[0] * inputs[1], axis=1),
                        name='real_weighted_sum'
                    )([x, attention_weights_expanded])
                    print(f"Weighted output shape: {weighted_output.shape}")
                    
                    x = weighted_output
                    print("✓ Attention mechanism completado")
                    
                except Exception as attention_error:
                    logger.error(f"ERROR EN ATTENTION: {attention_error}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")
                    raise
                    
            elif pooling_type == 'max':
                print("Aplicando GlobalMaxPooling1D...")
                x = layers.GlobalMaxPooling1D(name='real_max_pooling')(x)
                print(f"Max pooling shape: {x.shape}")
                
            elif pooling_type == 'average':
                print("Aplicando GlobalAveragePooling1D...")
                x = layers.GlobalAveragePooling1D(name='real_avg_pooling')(x)
                print(f"Average pooling shape: {x.shape}")
                
            elif pooling_type == 'last':
                print("Tomando último timestep...")
                x = layers.Lambda(
                    lambda inputs: inputs[:, -1, :], 
                    name='real_last_timestep'
                )(x)
                print(f"Last timestep shape: {x.shape}")
                
            else:
                logger.warning(f"Pooling desconocido: {pooling_type}, usando average")
                x = layers.GlobalAveragePooling1D(name='real_default_pooling')(x)
                print(f"Default pooling shape: {x.shape}")
            
            print(f"=== POOLING COMPLETADO ===")
            print(f"Output shape: {x.shape}")
            return x
            
        except Exception as e:
            logger.error(f"=== ERROR EN POOLING ===")
            logger.error(f"Error: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            # Fallback
            logger.warning("Aplicando pooling de emergencia")
            try:
                x = layers.GlobalAveragePooling1D(name='real_emergency_pooling')(x)
                print(f"Emergency pooling shape: {x.shape}")
                return x
            except Exception as fallback_error:
                logger.error(f"Error en fallback: {fallback_error}")
                raise
    
    def build_real_siamese_model(self) -> Model:
        """Construye el modelo siamés temporal completo."""
        try:
            if self.base_network is None:
                self.build_real_base_network()
            
            print("Construyendo modelo siamés temporal...")
            
            # Inputs para las dos ramas
            input_a = layers.Input(
                shape=(self.sequence_length, self.feature_dim), 
                name='real_input_sequence_a'
            )
            input_b = layers.Input(
                shape=(self.sequence_length, self.feature_dim), 
                name='real_input_sequence_b'
            )
            
            # Procesar con red base (pesos compartidos)
            embedding_a = self.base_network(input_a)
            embedding_b = self.base_network(input_b)
            
            # Calcular distancia
            if self.config['distance_metric'] == 'euclidean':
                distance = layers.Lambda(
                    lambda embeddings: tf.sqrt(tf.reduce_sum(tf.square(embeddings[0] - embeddings[1]), axis=1, keepdims=True)),
                    name='real_euclidean_distance'
                )([embedding_a, embedding_b])
                
            elif self.config['distance_metric'] == 'manhattan':
                distance = layers.Lambda(
                    lambda embeddings: tf.reduce_sum(tf.abs(embeddings[0] - embeddings[1]), axis=1, keepdims=True),
                    name='real_manhattan_distance'
                )([embedding_a, embedding_b])
                
            elif self.config['distance_metric'] == 'cosine':
                distance = layers.Lambda(
                    lambda embeddings: 1 - tf.reduce_sum(embeddings[0] * embeddings[1], axis=1, keepdims=True),
                    name='real_cosine_distance'
                )([embedding_a, embedding_b])
            
            # Crear modelo siamés
            siamese_model = Model(
                inputs=[input_a, input_b], 
                outputs=distance,
                name='real_siamese_dynamic_network'
            )
            
            self.siamese_model = siamese_model
            
            total_params = siamese_model.count_params()
            print(f"Modelo siamés temporal construido: {total_params:,} parámetros")
            print(f"  - Métrica de distancia: {self.config['distance_metric']}")
            print(f"  - Arquitectura: Twin network con pesos compartidos")
            print(f"  - Base network: {self.base_network.count_params():,} parámetros")
            
            return siamese_model
            
        except Exception as e:
            logger.error(f"Error construyendo modelo siamés: {e}")
            raise
    
    def compile_real_model(self):
        """Compila el modelo siamés temporal."""
        try:
            if self.siamese_model is None:
                self.build_real_siamese_model()
            
            print("Compilando modelo siamés temporal...")
            
            optimizer = optimizers.Adam(
                learning_rate=5e-4,
                clipnorm=1.0,
                clipvalue=0.5
            )
            
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
            print(f"  - Funcion de pérdida: {self.config['loss_function']}")
            
        except Exception as e:
            logger.error(f"Error compilando modelo temporal: {e}")
            raise
    
    def _contrastive_loss_real(self, y_true, y_pred):
        """Función de pérdida contrastiva."""
        epsilon = 1e-8
        margin = tf.constant(self.config.get('margin', 1.0), dtype=tf.float32)
        
        distance = tf.sqrt(tf.square(y_pred) + epsilon)
        
        square_pred = tf.square(distance)
        margin_square = tf.square(tf.maximum(margin - distance, 0.0))
        
        return tf.reduce_mean(y_true * square_pred + (1 - y_true) * margin_square)
    
    def _far_metric_real(self, y_true, y_pred):
        """Métrica FAR (False Accept Rate) con threshold dinámico."""
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
        """Métrica FRR (False Reject Rate) con threshold dinámico."""
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
    
    def load_real_temporal_data_from_database(self, database) -> bool:
        """
        Carga datos temporales desde la base de datos biométrica.
        Maneja usuarios Bootstrap y Normales.
        """
        try:
            print("=== CARGANDO DATOS TEMPORALES===")
            print("Buscando templates con datos temporales para red dinámica...")
            
            # Obtener usuarios
            real_users = database.list_users()
            
            if len(real_users) < self.config.get('min_users_for_training', 2):
                logger.error(f"Insuficientes usuarios: {len(real_users)} < {self.config.get('min_users_for_training', 2)}")
                return False
            
            print(f"Usuarios encontrados: {len(real_users)}")
            
            # Limpiar muestras
            self.real_training_samples.clear()
            
            users_with_sufficient_data = 0
            total_samples_loaded = 0
            
            for user in real_users:
                try:
                    print(f"Procesando usuario: {user.username} ({user.user_id})")
                    
                    # Obtener templates
                    user_templates_list = []
                    for template_id, template in database.templates.items():
                        if template.user_id == user.user_id:
                            user_templates_list.append(template)
                    
                    if not user_templates_list:
                        print(f"  Usuario {user.user_id} sin templates, omitiendo")
                        continue
                    
                    print(f"   Templates encontrados: {len(user_templates_list)}")
                    
                    # Filtrar templates con datos temporales
                    temporal_templates = []
                    for template in user_templates_list:
                        template_type_str = str(template.template_type).lower()
                        has_temporal_sequence = (template.metadata.get('temporal_sequence') is not None and 
                                               isinstance(template.metadata.get('temporal_sequence'), list) and
                                               len(template.metadata.get('temporal_sequence', [])) >= 5)
                        has_individual_sequences = (template.metadata.get('individual_temporal_sequences') is not None and
                                                  isinstance(template.metadata.get('individual_temporal_sequences'), list) and
                                                  len(template.metadata.get('individual_temporal_sequences', [])) > 1)
                        
                        if 'dynamic' in template_type_str or has_temporal_sequence or has_individual_sequences:
                            temporal_templates.append(template)
                    
                    print(f"   Templates con datos temporales: {len(temporal_templates)}")
                    
                    # Procesar templates temporales
                    user_temporal_samples = []
                    
                    for template in temporal_templates:
                        try:
                            temporal_sequence = template.metadata.get('temporal_sequence', None)
                            individual_sequences = template.metadata.get('individual_temporal_sequences', [])
                            
                            has_individual_data = individual_sequences and len(individual_sequences) > 1
                            has_temporal_sequence = temporal_sequence and len(temporal_sequence) >= 5
                            
                            if has_temporal_sequence or has_individual_data:
                                print(f"   Procesando template: {template.gesture_name}")
                                print(f"       Tipo: {template.template_type}")

                                
                                # PROCESAR SECUENCIAS INDIVIDUALES (USUARIOS NORMALES)
                                if has_individual_data:
                                    print(f"       {len(individual_sequences)} secuencias individuales")
                                    
                                    sequences_loaded = 0
                                    for seq_idx, sequence in enumerate(individual_sequences):
                                        if len(sequence) >= 5:
                                            sequence_array = np.array(sequence, dtype=np.float32)
                                            
                                            if len(sequence_array.shape) == 2 and sequence_array.shape[1] == self.feature_dim:
                                                dynamic_sample = RealDynamicSample(
                                                    user_id=user.user_id,
                                                    sequence_id=f"{template.template_id}_preserved_{seq_idx}",
                                                    temporal_features=sequence_array,
                                                    gesture_sequence=[template.gesture_name] * len(sequence_array),
                                                    transition_types=['hold'] * max(1, len(sequence_array)-1),
                                                    timestamp=getattr(template, 'created_at', time.time()) + (seq_idx * 0.1),
                                                    duration=len(sequence_array) * 0.033,
                                                    quality_score=template.quality_score,
                                                    metadata={
                                                        'data_source': template.metadata.get('data_source', 'enrollment_capture'),
                                                        'bootstrap_mode': False,
                                                        'sequence_length': len(sequence_array),
                                                        'feature_dim': sequence_array.shape[1],
                                                        'user_type': 'Normal_Preserved',
                                                        'original_samples_used': len(individual_sequences),
                                                        'sequence_index': seq_idx,
                                                        'confidence': template.confidence,
                                                        'gesture_name': template.gesture_name,
                                                        'parent_template_id': template.template_id
                                                    }
                                                )
                                                user_temporal_samples.append(dynamic_sample)
                                                sequences_loaded += 1
                                    
                                    print(f"       Secuencias preservadas cargadas: {sequences_loaded}")

                                # PROCESAR SECUENCIA TEMPORAL (BOOTSTRAP)
                                elif has_temporal_sequence:
                                    print(f"       Secuencia: {len(temporal_sequence)} frames")
                                    
                                    temporal_array = np.array(temporal_sequence, dtype=np.float32)
                                    
                                    if len(temporal_array.shape) == 2 and temporal_array.shape[1] == self.feature_dim:
                                        dynamic_sample = RealDynamicSample(
                                            user_id=user.user_id,
                                            sequence_id=template.template_id,
                                            temporal_features=temporal_array,
                                            gesture_sequence=[template.gesture_name] * len(temporal_sequence),
                                            transition_types=['hold'] * max(1, len(temporal_sequence)-1),
                                            timestamp=getattr(template, 'created_at', time.time()),
                                            duration=len(temporal_sequence) * 0.033,
                                            quality_score=template.quality_score,
                                            metadata={
                                                'data_source': template.metadata.get('data_source', 'enrollment_capture'),
                                                'bootstrap_mode': template.metadata.get('bootstrap_mode', True),
                                                'sequence_length': len(temporal_sequence),
                                                'feature_dim': temporal_array.shape[1],
                                                'user_type': 'Bootstrap',
                                                'confidence': template.confidence,
                                                'gesture_name': template.gesture_name
                                            }
                                        )
                                        user_temporal_samples.append(dynamic_sample)
                                        print(f"       Bootstrap: {len(temporal_sequence)} frames")
                                    else:
                                        logger.warning(f"       Dimensiones incorrectas: {temporal_array.shape}")
                                else:
                                    logger.warning(f"   Template sin datos temporales válidos")
                        
                        except Exception as e:
                            logger.error(f"   Error procesando template: {e}")
                            continue
                    
                    # Validar usuario
                    min_temporal_samples = 1
                    
                    if len(user_temporal_samples) >= min_temporal_samples:
                        users_with_sufficient_data += 1
                        total_samples_loaded += len(user_temporal_samples)
                        self.real_training_samples.extend(user_temporal_samples)
                        
                        gesture_counts = {}
                        for sample in user_temporal_samples:
                            gesture_name = sample.metadata.get('gesture_name', 'Unknown')
                            gesture_counts[gesture_name] = gesture_counts.get(gesture_name, 0) + 1
                        
                        print(f"Usuario temporal válido: {user.username}")
                        print(f"   Secuencias temporales cargadas: {len(user_temporal_samples)}")
                        print(f"   Gestos únicos: {len(gesture_counts)}")
                        for gesture, count in gesture_counts.items():
                            print(f"      • {gesture}: {count} secuencias temporales")
                    else:
                        logger.warning(f"   Usuario {user.user_id} con pocas secuencias temporales: {len(user_temporal_samples)} < {min_temporal_samples}")
                    
                except Exception as e:
                    logger.error(f"Error procesando usuario {user.user_id}: {e}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")
                    continue
            
            # Validación final
            min_users_required = 2
            min_total_samples = 10
            
            if users_with_sufficient_data < min_users_required:
                logger.error("=" * 60)
                logger.error("USUARIOS INSUFICIENTES")
                logger.error("=" * 60)
                logger.error(f"Válidos: {users_with_sufficient_data} < {min_users_required}")
                return False
            
            if total_samples_loaded < min_total_samples:
                logger.error("=" * 60)
                logger.error("MUESTRAS INSUFICIENTES")
                logger.error("=" * 60)
                logger.error(f"Muestras cargadas: {total_samples_loaded} < {min_total_samples}")
                return False
            
            # División train/validation
            try:
                user_ids = [sample.user_id for sample in self.real_training_samples]
                
                train_samples, val_samples = train_test_split(
                    self.real_training_samples,
                    test_size=0.2,
                    random_state=42,
                    stratify=user_ids
                )
                
                self.real_training_samples = train_samples
                self.real_validation_samples = val_samples
                
                print(f"División estratificada: Train {len(train_samples)}, Val {len(val_samples)}")
                
            except Exception as e:
                logger.warning(f"División simple aplicada: {e}")
                split_idx = int(0.8 * len(self.real_training_samples))
                self.real_validation_samples = self.real_training_samples[split_idx:]
                self.real_training_samples = self.real_training_samples[:split_idx]
            
            print("=" * 60)
            print("DATOS TEMPORALES REALES CARGADOS EXITOSAMENTE")
            print("=" * 60)
            print(f"Usuarios con datos temporales suficientes: {users_with_sufficient_data}")
            print(f"Total secuencias temporales REALES cargadas: {total_samples_loaded}")
            print(f"Promedio secuencias por usuario: {total_samples_loaded/users_with_sufficient_data:.1f}")
            print(f"Dimensiones por frame: {self.feature_dim}")
            
            # Actualizar contador
            all_samples = self.real_training_samples + self.real_validation_samples
            user_stats = {}
            for sample in all_samples:
                user_stats[sample.user_id] = user_stats.get(sample.user_id, 0) + 1
            
            print(f"DISTRIBUCIÓN POR USUARIO:")
            for user_id, count in user_stats.items():
                user_name = next((u.username for u in real_users if u.user_id == user_id), user_id)
                log_info(f"   • {user_name} ({user_id}): {count} secuencias")
                
            self.users_trained_count = len(user_stats)
            
            # Reporte final
            print("=" * 60)
            print("DATOS TEMPORALES CARGADOS")
            print("=" * 60)
            print(f"Usuarios: {users_with_sufficient_data}")
            print(f"Total secuencias: {total_samples_loaded}")
            print(f"Promedio/usuario: {total_samples_loaded/users_with_sufficient_data:.1f}")
            print(f"Dimensiones: {self.feature_dim}")
            print(f"Usuarios registrados: {self.users_trained_count}")
            print("=" * 60)
            
            return True
            
        except Exception as e:
            logger.error("=" * 60)
            logger.error("ERROR CARGANDO DATOS TEMPORALES")
            logger.error("=" * 60)
            logger.error(f"Error: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            logger.error("=" * 60)
            return False
        
    def validate_real_temporal_data_quality(self) -> bool:
        """Valida la calidad de los datos temporales."""
        try:
            print("Validando calidad de datos temporales...")
            
            if len(self.real_training_samples) == 0:
                logger.error("No hay muestras de entrenamiento")
                return False
            
            # Validar calidad mínima
            high_quality_samples = [
                s for s in self.real_training_samples 
                if getattr(s, 'quality_score', 100.0) >= 80.0
            ]
            
            quality_ratio = len(high_quality_samples) / len(self.real_training_samples)
            print(f"Alta calidad: {len(high_quality_samples)}/{len(self.real_training_samples)} ({quality_ratio:.1%})")
            
            if quality_ratio < 0.7:
                logger.warning("Baja proporción de alta calidad")
            
            # Validar dimensiones
            for i, sample in enumerate(self.real_training_samples[:10]):
                if sample.temporal_features.shape[1] != self.feature_dim:
                    logger.error(f"Dimensión incorrecta en muestra {i}: esperado {self.feature_dim}, obtenido {sample.temporal_features.shape[1]}")
                    return False
            
            # Validar longitudes
            sequence_lengths = [sample.temporal_features.shape[0] for sample in self.real_training_samples]
            min_length = min(sequence_lengths)
            max_length = max(sequence_lengths)
            avg_length = sum(sequence_lengths) / len(sequence_lengths)
            
            print(f"Longitudes de secuencia - Min: {min_length}, Max: {max_length}, Avg: {avg_length:.1f}")
            
            if min_length < 5:
                logger.error(f"Secuencia muy corta: {min_length} frames < 5 mínimo")
                return False
            
            # Validar usuarios
            unique_users = set(sample.user_id for sample in self.real_training_samples)
            min_users_required = self.config.get('min_users_for_training', 2)
            
            if len(unique_users) < min_users_required:
                logger.error(f"Insuficientes usuarios: {len(unique_users)} < {min_users_required}")
                return False
            
            print(f"Usuarios únicos: {len(unique_users)}")
            print("✓ Validación de calidad completada")
            return True
            
        except Exception as e:
            logger.error(f"Error validando calidad: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False
    
    def create_real_temporal_pairs(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Crea pares de secuencias temporales."""
        try:
            print("Creando pares temporales...")
            
            pairs_a = []
            pairs_b = []
            labels = []
            
            samples = self.real_training_samples
            n_samples = len(samples)
            
            # Crear pares genuinos
            user_samples = {}
            for sample in samples:
                if sample.user_id not in user_samples:
                    user_samples[sample.user_id] = []
                user_samples[sample.user_id].append(sample)
            
            genuine_pairs = 0
            for user_id, user_sample_list in user_samples.items():
                if len(user_sample_list) >= 2:
                    for i in range(len(user_sample_list)):
                        for j in range(i + 1, len(user_sample_list)):
                            sample1 = user_sample_list[i]
                            sample2 = user_sample_list[j]
                            
                            seq1 = self._pad_or_truncate_sequence(sample1.temporal_features)
                            seq2 = self._pad_or_truncate_sequence(sample2.temporal_features)
                            
                            pairs_a.append(seq1)
                            pairs_b.append(seq2)
                            labels.append(1)
                            genuine_pairs += 1
            
            print(f"Pares genuinos creados: {genuine_pairs}")
            
            # Crear pares impostores
            impostor_pairs = 0
            target_impostor_pairs = genuine_pairs #Balancear clases
            
            users_list = list(user_samples.keys())
            while impostor_pairs < target_impostor_pairs:
                user1_idx = np.random.randint(0, len(users_list))
                user2_idx = np.random.randint(0, len(users_list))
                
                if user1_idx != user2_idx:
                    user1_id = users_list[user1_idx]
                    user2_id = users_list[user2_idx]
                    
                    sample1 = np.random.choice(user_samples[user1_id])
                    sample2 = np.random.choice(user_samples[user2_id])
                    
                    seq1 = self._pad_or_truncate_sequence(sample1.temporal_features)
                    seq2 = self._pad_or_truncate_sequence(sample2.temporal_features)
                    
                    pairs_a.append(seq1)
                    pairs_b.append(seq2)
                    labels.append(0)
                    impostor_pairs += 1
            
            print(f"Pares impostores creados: {impostor_pairs}")
            
            # Convertir a arrays
            pairs_a = np.array(pairs_a, dtype=np.float32)
            pairs_b = np.array(pairs_b, dtype=np.float32)
            labels = np.array(labels, dtype=np.float32)
            
            # Mezclar
            indices = np.random.permutation(len(labels))
            pairs_a = pairs_a[indices]
            pairs_b = pairs_b[indices]
            labels = labels[indices]
            
            print(f"Pares temporales creados: {len(labels)}")
            print(f"  - Genuinos: {np.sum(labels)} ({np.mean(labels):.1%})")
            print(f"  - Impostores: {np.sum(1-labels)} ({1-np.mean(labels):.1%})")
            print(f"  - Shape: {pairs_a.shape}, {pairs_b.shape}")
            
            return pairs_a, pairs_b, labels
            
        except Exception as e:
            logger.error(f"Error creando pares: {e}")
            raise
    
    def _pad_or_truncate_sequence(self, sequence: np.ndarray) -> np.ndarray:
        """Ajusta la secuencia a la longitud fija requerida."""
        current_length = sequence.shape[0]
        
        if current_length >= self.sequence_length:
            return sequence[:self.sequence_length]
        else:
            padding = np.zeros((self.sequence_length - current_length, self.feature_dim))
            return np.vstack([sequence, padding])
        
    def train_with_real_data(self, database, validation_split: float = 0.2) -> RealTemporalTrainingHistory:
        """Entrena el modelo con datos temporales."""
        try:
            start_time = time.time()
            print("=== INICIANDO ENTRENAMIENTO TEMPORA ===")
            
            # 1. Cargar datos
            if not self.load_real_temporal_data_from_database(database):
                raise ValueError("No se pudieron cargar datos temporales suficientes")
            
            # 2. Validar calidad
            if not self.validate_real_temporal_data_quality():
                raise ValueError("Datos temporales no cumplen criterios de calidad")
            
            # 3. Compilar modelo
            if not self.is_compiled:
                self.compile_real_model()
            
            # 4. Crear pares
            pairs_a, pairs_b, labels = self.create_real_temporal_pairs()
            
            # 5. Callbacks
            callbacks_list = self._setup_real_training_callbacks()
            
            # 6. Logs pre-entrenamiento
            print(f"=== CONFIGURACIÓN PRE-ENTRENAMIENTO ===")
            print(f"Learning rate: {self.siamese_model.optimizer.learning_rate.numpy()}")
            print(f"Margen contrastive loss: {self.config.get('margin', 'NO DEFINIDO')}")
            print(f"Batch size: {self.config['batch_size']}")
            print(f"Total parámetros: {self.siamese_model.count_params()}")
            print(f"Pares entrenamiento: {len(labels)}")
            print(f"Shape: {pairs_a.shape}, {pairs_b.shape}")
            
            # 7. Entrenar
            print("Iniciando entrenamiento temporal...")
            history = self.siamese_model.fit(
                [pairs_a, pairs_b],
                labels,
                batch_size=self.config['batch_size'],
                epochs=self.config['epochs'],
                validation_split=validation_split,
                callbacks=callbacks_list,
                verbose=1
            )
            
            # 8. Actualizar estado
            self.is_trained = True
            # self.training_history.loss = history.history['loss']
            # self.training_history.val_loss = history.history['val_loss']
            training_time = time.time() - start_time
            self._update_real_training_history(history, training_time)
            
            # 9. Evaluar
            metrics = self.evaluate_real_model(pairs_a, pairs_b, labels)
            self.current_metrics = metrics
            
            # 10. Guardar modelo entrenado
            self.save_real_model()
            
            # total_time = time.time() - start_time
            # self.training_history.total_training_time = total_time
            
            
            
            print("Iniciando entrenamiento temporal REAL...")
            print(f"✓ Entrenamiento temporal REAL completado")
            print(f"  - Tiempo total: {self.training_history.total_training_time:.1f}s")
            print(f"  - Épocas entrenadas: {len(history.history['loss'])}")
            print(f"  - Mejor pérdida: {min(history.history['val_loss']):.4f}")
            print(f"  - EER final: {metrics.eer:.3f}")
            print(f"  - AUC final: {metrics.auc_score:.3f}")
            
            # Marcar como entrenado
            self.is_trained = True
            print("✓ Red dinámica marcada como entrenada")
            
            return self.training_history
            
        except Exception as e:
            logger.error(f"Error en entrenamiento: {e}")
            raise
    
    def _setup_real_training_callbacks(self) -> List[callbacks.Callback]:
        """Configura callbacks para entrenamiento REAL."""
        callbacks_list = []
        
        # LOG: Configuración inicial
        print(f"=== CONFIGURANDO CALLBACKS DE ENTRENAMIENTO ===")
        print(f"Early stopping patience: {self.config['early_stopping_patience']}")
        print(f"Reduce LR patience: {self.config['reduce_lr_patience']}")
        print(f"Min LR: {self.config['min_lr']}")
        
        # Early stopping
        early_stopping = callbacks.EarlyStopping(
            monitor='val_loss',
            patience=self.config['early_stopping_patience'],
            restore_best_weights=True,
            verbose=1
        )
        callbacks_list.append(early_stopping)
        print(f"✓ Early stopping configurado: patience={self.config['early_stopping_patience']}")
        
        # Reduce learning rate
        reduce_lr = callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=self.config['reduce_lr_patience'],
            min_lr=self.config['min_lr'],
            verbose=1
        )
        callbacks_list.append(reduce_lr)
        print(f"✓ ReduceLROnPlateau configurado: patience={self.config['reduce_lr_patience']}, factor=0.5")
        
        # Model checkpoint
        checkpoint = callbacks.ModelCheckpoint(
            filepath=str(self.model_save_path),
            monitor='val_loss',
            save_best_only=True,
            verbose=1
        )
        callbacks_list.append(checkpoint)
        print(f"✓ ModelCheckpoint configurado: {self.model_save_path}")
        
        # CALLBACK CRÍTICO: Monitor de Learning Rate y métricas
        class LRAndMetricsMonitor(callbacks.Callback):
            def on_epoch_end(self, epoch, logs=None):
                if logs is None:
                    logs = {}
                
                current_lr = float(self.model.optimizer.learning_rate)
                train_loss = logs.get('loss', 0)
                val_loss = logs.get('val_loss', 0)
                
                print(f"MONITOR ÉPOCA {epoch+1}:")
                print(f"  ┣━ Learning Rate: {current_lr:.2e}")
                print(f"  ┣━ Train Loss: {train_loss:.6f}")
                print(f"  ┗━ Val Loss: {val_loss:.6f}")
                
                # ALERTA si hay cambio súbito
                if hasattr(self, 'prev_val_loss') and self.prev_val_loss is not None:
                    loss_change = abs(val_loss - self.prev_val_loss)
                    if loss_change > 0.1:
                        print(f"  ALERTA: Cambio súbito val_loss = {loss_change:.6f}")
                
                self.prev_val_loss = val_loss
                
            def on_train_begin(self, logs=None):
                initial_lr = float(self.model.optimizer.learning_rate)
                print(f"INICIO ENTRENAMIENTO: LR inicial = {initial_lr:.2e}")
                self.prev_val_loss = None
        
        callbacks_list.append(LRAndMetricsMonitor())
        print(f"✓ Monitor de LR configurado")
        
        # Monitor de gradientes para detectar explosión
        class GradientMonitor(callbacks.Callback):
            def on_epoch_begin(self, epoch, logs=None):
                # Solo monitorear después de época 15 (cerca del colapso)
                if epoch >= 15:
                    print(f"MONITORING GRADIENTES - Época {epoch+1}")
            
            def on_epoch_end(self, epoch, logs=None):
                if epoch >= 15 and logs is not None:  # Solo épocas críticas
                    try:
                        # Obtener pesos del modelo
                        weights = self.model.get_weights()
                        weight_norms = [np.linalg.norm(w) for w in weights if w.size > 0]
                        max_weight_norm = max(weight_norms) if weight_norms else 0.0
                        
                        current_lr = float(self.model.optimizer.learning_rate)
                        train_loss = logs.get('loss', 0)
                        
                        print(f"GRADIENTES ÉPOCA {epoch+1}:")
                        print(f"  ┣━ Max Weight Norm: {max_weight_norm:.6f}")
                        print(f"  ┣━ LR × Loss: {current_lr * train_loss:.8f}")
                        print(f"  ┗━ Estabilidad: {'OK' if max_weight_norm < 50.0 else 'INESTABLE'}")
                        
                        if max_weight_norm > 100.0:
                            print(f"PESOS EXPLOSIVOS DETECTADOS: {max_weight_norm:.6f}")
                            
                    except Exception as e:
                        print(f"Error monitoreando gradientes: {e}")
        
        callbacks_list.append(GradientMonitor())
        print(f"✓ Monitor de gradientes configurado")
        
        # NUEVO: Monitor de estabilidad de gradientes (solo logging)
        class GradientStabilityMonitor(callbacks.Callback):
            def on_train_begin(self, logs=None):
                self.prev_loss = None
                
            def on_batch_end(self, batch, logs=None):
                if logs and self.prev_loss is not None:
                    current_loss = logs.get('loss', 0)
                    if current_loss > self.prev_loss * 3.0:  # Spike 3x o más
                        logger.warning(f"Batch {batch}: Loss spike detected - Gradient clipping should handle this")
                        print(f"Loss: {self.prev_loss:.6f} → {current_loss:.6f}")
                        print(f"Ratio: {current_loss/self.prev_loss:.2f}x")
                self.prev_loss = logs.get('loss', 0) if logs else 0
        
        callbacks_list.append(GradientStabilityMonitor())
        print(f"✓ Monitor de estabilidad de gradientes configurado")
        
        # Monitor detallado de colapso por batch
        class DetailedCollapseMonitor(callbacks.Callback):
            def on_train_begin(self, logs=None):
                self.epoch = 0
                self.prev_batch_loss = None
                self.stable_batches = 0
                self.total_batches = 0
                
            def on_epoch_begin(self, epoch, logs=None):
                self.epoch = epoch
                self.prev_batch_loss = None
                self.batch_losses = []
                if epoch >= 20:
                    print(f"MONITOREANDO COLAPSO ÉPOCA {epoch+1} - Análisis por batch")
            
            def on_batch_end(self, batch, logs=None):
                self.total_batches += 1
                
                if self.epoch >= 20:  # Solo monitorear épocas críticas
                    if logs is None:
                        logs = {}
                        
                    current_loss = logs.get('loss', 0)
                    current_lr = float(self.model.optimizer.learning_rate)
                    self.batch_losses.append(current_loss)
                    
                    # Log cada 10 batches o si hay cambio súbito
                    if batch % 10 == 0 or (self.prev_batch_loss and current_loss > self.prev_batch_loss * 3.0):
                        print(f"Época {self.epoch+1}, Batch {batch}: loss={current_loss:.6f}, lr={current_lr:.2e}")
                    
                    # Detectar salto súbito entre batches
                    if self.prev_batch_loss is not None:
                        loss_ratio = current_loss / self.prev_batch_loss if self.prev_batch_loss > 0 else 1.0
                        
                        if loss_ratio > 5.0:  # Loss se multiplica por 5+
                            logger.error(f"COLAPSO SÚBITO DETECTADO:")
                            logger.error(f"   Época {self.epoch+1}, Batch {batch}")
                            logger.error(f"   Loss salto: {self.prev_batch_loss:.6f} → {current_loss:.6f}")
                            logger.error(f"   Ratio: {loss_ratio:.2f}x")
                            logger.error(f"   Learning Rate: {current_lr:.2e}")
                            
                            # Información del contexto
                            if len(self.batch_losses) > 5:
                                recent_losses = self.batch_losses[-5:]
                                logger.error(f"   Últimos 5 losses: {[f'{l:.6f}' for l in recent_losses]}")
                    
                    self.prev_batch_loss = current_loss
            
            def on_epoch_end(self, epoch, logs=None):
                if epoch >= 20 and self.batch_losses:
                    # Estadísticas de la época
                    min_loss = min(self.batch_losses)
                    max_loss = max(self.batch_losses)
                    avg_loss = sum(self.batch_losses) / len(self.batch_losses)
                    
                    print(f"ESTADÍSTICAS ÉPOCA {epoch+1}:")
                    print(f"  ┣━ Loss mínimo: {min_loss:.6f}")
                    print(f"  ┣━ Loss máximo: {max_loss:.6f}")
                    print(f"  ┣━ Loss promedio: {avg_loss:.6f}")
                    print(f"  ┗━ Variabilidad: {max_loss/min_loss:.2f}x")
        
        callbacks_list.append(DetailedCollapseMonitor())
        print(f"✓ Monitor de colapso por batch configurado")
        
        # Monitor de métricas de validación por epoch
        class ValidationMonitor(callbacks.Callback):
            def on_epoch_end(self, epoch, logs=None):
                if epoch >= 20 and logs is not None:
                    val_far = logs.get('val__far_metric_real', 0)
                    val_frr = logs.get('val__frr_metric_real', 0)
                    train_far = logs.get('_far_metric_real', 0)
                    train_frr = logs.get('_frr_metric_real', 0)
                    
                    print(f"MÉTRICAS DETALLADAS ÉPOCA {epoch+1}:")
                    print(f"  ┣━ Train FAR: {train_far:.6f}, FRR: {train_frr:.6f}")
                    print(f"  ┗━ Val FAR: {val_far:.6f}, FRR: {val_frr:.6f}")
        
        callbacks_list.append(ValidationMonitor())
        print(f"✓ Monitor de métricas de validación configurado")
        
        # Monitor anti-NaN
        class NaNStoppingCallback(callbacks.Callback):
            def on_batch_end(self, batch, logs=None):
                if logs:
                    import tensorflow as tf
                    current_loss = logs.get('loss', 0)
                    if tf.math.is_nan(current_loss) or tf.math.is_inf(current_loss):
                        logger.error(f"NaN/Inf detectado en batch {batch} - Deteniendo entrenamiento")
                        self.model.stop_training = True
            
            def on_epoch_end(self, epoch, logs=None):
                if logs:
                    import tensorflow as tf
                    val_loss = logs.get('val_loss', 0)
                    if tf.math.is_nan(val_loss) or tf.math.is_inf(val_loss):
                        logger.error(f"NaN/Inf en validación época {epoch} - Deteniendo entrenamiento")
                        self.model.stop_training = True
        
        callbacks_list.append(NaNStoppingCallback())
        print(f"✓ Monitor anti-NaN configurado")
        
        print(f"=== TOTAL CALLBACKS: {len(callbacks_list)} configurados ===")
        
        return callbacks_list

    def _update_real_training_history(self, history, training_time: float):
        """Actualiza el historial de entrenamiento temporal."""
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
            
            print("Historial temporal actualizado")
            
        except Exception as e:
            logger.error(f"Error actualizando historial temporal: {e}")

    def evaluate_real_model(self, sequences_a: np.ndarray, sequences_b: np.ndarray, 
                        labels: np.ndarray) -> RealTemporalMetrics:
        """Evalúa el modelo temporal con métricas específicas."""
        try:
            print("Evaluando modelo temporal...")
            
            # Predicciones
            distances = self.siamese_model.predict([sequences_a, sequences_b])
            distances = distances.flatten()
            
            # Convertir a similitudes
            similarities = 1.0 / (1.0 + distances)
            
            # Guardar scores como atributos de clase para JSON
            genuine_mask = (labels == 1)
            impostor_mask = (labels == 0)
            self.genuine_scores = similarities[genuine_mask].tolist()
            self.impostor_scores = similarities[impostor_mask].tolist()
            
            # Calcular métricas a diferentes umbrales
            thresholds = np.linspace(0, 1, 1000)
            fars = []
            frrs = []
            
            for threshold in thresholds:
                predictions = (similarities >= threshold).astype(int)
                
                genuine_mask = (labels == 1)
                impostor_mask = (labels == 0)
                
                # FAR: falsos aceptados / total impostores
                false_accepts = np.sum((predictions == 1) & impostor_mask)
                total_impostors = np.sum(impostor_mask)
                far = false_accepts / total_impostors if total_impostors > 0 else 0
                
                # FRR: falsos rechazados / total genuinos
                false_rejects = np.sum((predictions == 0) & genuine_mask)
                total_genuines = np.sum(genuine_mask)
                frr = false_rejects / total_genuines if total_genuines > 0 else 0
                
                fars.append(far)
                frrs.append(frr)
            
            # Encontrar EER
            fars = np.array(fars)
            frrs = np.array(frrs)
            eer_idx = np.argmin(np.abs(fars - frrs))
            eer = (fars[eer_idx] + frrs[eer_idx]) / 2
            optimal_threshold = thresholds[eer_idx]
            
            # Otras métricas
            optimal_predictions = (similarities >= optimal_threshold).astype(int)
            accuracy = accuracy_score(labels, optimal_predictions)
            auc_score_val = roc_auc_score(labels, similarities)
            
            # Calcular curva ROC completa para visualización
            fpr_roc, tpr_roc, _ = roc_curve(labels, similarities)

            # Samplear puntos ROC (máximo 100 puntos)
            sample_indices = np.linspace(0, len(fpr_roc)-1, min(100, len(fpr_roc)), dtype=int)
            roc_fpr_sampled = fpr_roc[sample_indices].tolist()
            roc_tpr_sampled = tpr_roc[sample_indices].tolist()

            # Precision, recall, F1 usando optimal_threshold
            tn, fp, fn, tp = confusion_matrix(labels, optimal_predictions).ravel()
            
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
            
            # Métricas temporales específicas
            sequence_correlation = self._calculate_sequence_correlation_real(sequences_a, sequences_b, labels)
            temporal_consistency = self._calculate_temporal_consistency_real(similarities, labels)
            rhythm_similarity = self._calculate_rhythm_similarity_real(sequences_a, sequences_b, labels)
            
            # Crear objeto de métricas
            metrics = RealTemporalMetrics(
                far=fars[eer_idx],
                frr=frrs[eer_idx],
                eer=eer,
                auc_score=auc_score_val,
                accuracy=accuracy,
                threshold=optimal_threshold,
                precision=precision,
                recall=recall,
                f1_score=f1_score,
                sequence_correlation=sequence_correlation,
                temporal_consistency=temporal_consistency,
                rhythm_similarity=rhythm_similarity,
                validation_samples=len(labels),
                roc_fpr=roc_fpr_sampled,
                roc_tpr=roc_tpr_sampled
            )
            
            # Actualizar threshold
            self.optimal_threshold = optimal_threshold
            
            print("✓ Evaluación temporal completada:")
            print(f"  - EER: {eer:.3f}")
            print(f"  - AUC: {auc_score_val:.3f}")
            print(f"  - Accuracy: {accuracy:.3f}")
            print(f"  - Threshold óptimo: {optimal_threshold:.3f}")
            print(f"  - Correlación secuencial: {sequence_correlation:.3f}")
            print(f"  - Consistencia temporal: {temporal_consistency:.3f}")
            print(f"  - Genuinos evaluados: {int(np.sum(labels))}")
            print(f"  - Impostores evaluados: {int(np.sum(1 - labels))}")
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error evaluando modelo: {e}")
            raise
    
    
    def _calculate_sequence_correlation_real(self, sequences_a: np.ndarray, 
                                           sequences_b: np.ndarray, labels: np.ndarray) -> float:
        """Calcula correlación promedio entre secuencias genuinas."""
        try:
            genuine_mask = (labels == 1)
            if np.sum(genuine_mask) == 0:
                return 0.0
            
            genuine_a = sequences_a[genuine_mask]
            genuine_b = sequences_b[genuine_mask]
            
            correlations = []
            for seq_a, seq_b in zip(genuine_a, genuine_b):
                flat_a = seq_a.flatten()
                flat_b = seq_b.flatten()
                corr = np.corrcoef(flat_a, flat_b)[0, 1]
                if not np.isnan(corr):
                    correlations.append(corr)
            
            return np.mean(correlations) if correlations else 0.0
            
        except Exception:
            return 0.0
    
    def _calculate_temporal_consistency_real(self, similarities: np.ndarray, labels: np.ndarray) -> float:
        """Calcula consistencia temporal en predicciones."""
        try:
            genuine_similarities = similarities[labels == 1]
            impostor_similarities = similarities[labels == 0]
            
            if len(genuine_similarities) == 0 or len(impostor_similarities) == 0:
                return 0.0
            
            genuine_mean = np.mean(genuine_similarities)
            impostor_mean = np.mean(impostor_similarities)
            separation = abs(genuine_mean - impostor_mean)
            
            return min(separation, 1.0)
            
        except Exception:
            return 0.0
    
    def _calculate_rhythm_similarity_real(self, sequences_a: np.ndarray, 
                                        sequences_b: np.ndarray, labels: np.ndarray) -> float:
        """Calcula similitud en patrones de ritmo temporal."""
        try:
            genuine_mask = (labels == 1)
            if np.sum(genuine_mask) == 0:
                return 0.0
            
            genuine_a = sequences_a[genuine_mask]
            genuine_b = sequences_b[genuine_mask]
            
            rhythm_similarities = []
            for seq_a, seq_b in zip(genuine_a, genuine_b):
                rhythm_a = np.std(seq_a, axis=1)
                rhythm_b = np.std(seq_b, axis=1)
                
                rhythm_sim = np.corrcoef(rhythm_a, rhythm_b)[0, 1]
                if not np.isnan(rhythm_sim):
                    rhythm_similarities.append(rhythm_sim)
            
            return np.mean(rhythm_similarities) if rhythm_similarities else 0.0
            
        except Exception:
            return 0.0
    
    def recalculate_threshold_from_database(self, database) -> bool:
        """
        Recalcula threshold óptimo REGENERANDO embeddings desde secuencias temporales.
        Usado después de reentrenar - usa la RED NUEVA para todos los usuarios.
        
        Similar a red anatómica pero para datos TEMPORALES:
        - Carga secuencias temporales originales (no features 180D)
        - Procesa temporal_sequence desde metadata
        - Actualiza dynamic_embedding (no anatomical_embedding)
        - Padding/truncate a 50 frames
        """
        try:
            print("=" * 80)
            print("=== RECALCULANDO THRESHOLD DINÁMICO CON RED RECIEN ENTRENADA ===")
            print("=" * 80)
            print("\n[INICIO] Proceso de recalculacion de threshold dinámico")
            print("[INFO] Timestamp:", time.strftime("%Y-%m-%d %H:%M:%S"))
            print("\n[ESTRATEGIA] Pasos a seguir:")
            print("   1. Cargar SECUENCIAS TEMPORALES originales de TODOS los usuarios")
            print("   2. Crear pares genuinos/impostores con secuencias temporales")
            print("   3. Evaluar con red RECIEN ENTRENADA (genera embeddings on-the-fly)")
            print("   4. Calcular threshold optimo")
            print("   5. ACTUALIZAR embeddings dinamicos guardados en BD")
            print("   6. Guardar modelo con threshold actualizado")
            
            # ============================================================
            # FASE 1: CARGAR SECUENCIAS TEMPORALES
            # ============================================================
            print("\n" + "=" * 80)
            print("FASE 1: CARGANDO SECUENCIAS TEMPORALES ORIGINALES")
            print("=" * 80)
            
            all_users = database.list_users()
            print(f"[FASE 1] Total usuarios en sistema: {len(all_users)}")
            
            # Diccionario: user_id -> lista de (template_id, temporal_sequence)
            user_temporal_data = {}
            total_sequences_loaded = 0
            users_with_data = 0
            
            for user in all_users:
                print(f"\n[FASE 1] Procesando usuario: {user.username} ({user.user_id})")
                
                # Obtener templates del usuario
                user_templates = database.list_user_templates(user.user_id)
                print(f"[FASE 1]    Templates encontrados: {len(user_templates)}")
                
                user_sequences = []
                
                for template in user_templates:
                    try:
                        # Buscar temporal_sequence en metadata
                        temporal_sequence = template.metadata.get('temporal_sequence')
                        
                        if temporal_sequence is not None and len(temporal_sequence) >= 5:
                            # Convertir a numpy array
                            sequence_array = np.array(temporal_sequence, dtype=np.float32)
                            
                            # Validar dimensiones
                            if len(sequence_array.shape) == 2 and sequence_array.shape[1] == self.feature_dim:
                                user_sequences.append({
                                    'template_id': template.template_id,
                                    'sequence': sequence_array,
                                    'gesture_name': template.gesture_name,
                                    'quality_score': template.quality_score
                                })
                                print(f"[FASE 1]       Secuencia cargada: {template.gesture_name} ({len(sequence_array)} frames)")
                            else:
                                print(f"[FASE 1]       [SKIP] Dimensiones incorrectas: {sequence_array.shape}")
                        
                    except Exception as e:
                        print(f"[FASE 1]       [ERROR] Error procesando template: {e}")
                        continue
                
                if len(user_sequences) > 0:
                    user_temporal_data[user.user_id] = user_sequences
                    users_with_data += 1
                    total_sequences_loaded += len(user_sequences)
                    print(f"[FASE 1]    Usuario válido: {len(user_sequences)} secuencias temporales")
                else:
                    print(f"[FASE 1]    [WARNING] Usuario sin secuencias temporales válidas")
            
            # Validación FASE 1
            if users_with_data < 2:
                print(f"\n[FASE 1] [ERROR] Usuarios insuficientes: {users_with_data} < 2")
                return False
            
            if total_sequences_loaded < 10:
                print(f"\n[FASE 1] [ERROR] Secuencias insuficientes: {total_sequences_loaded} < 10")
                return False
            
            print("\n" + "=" * 80)
            print("RESUMEN COMPLETO FASE 1")
            print("=" * 80)
            print(f"[FASE 1] CARGA DE SECUENCIAS TEMPORALES:")
            print(f"[FASE 1]    Usuarios procesados: {len(all_users)}")
            print(f"[FASE 1]    Usuarios con secuencias: {users_with_data}")
            print(f"[FASE 1]    Secuencias totales: {total_sequences_loaded}")
            print(f"[FASE 1]    Estado: SUCCESS")
            print("=" * 80)
            
            # ============================================================
            # FASE 2: CREAR PARES GENUINOS E IMPOSTORES
            # ============================================================
            print("\n" + "=" * 80)
            print("FASE 2: CREANDO PARES DE SECUENCIAS TEMPORALES")
            print("=" * 80)
            
            sequences_a = []
            sequences_b = []
            labels = []
            
            # Pares genuinos (mismo usuario)
            genuine_pairs = 0
            for user_id, sequences_list in user_temporal_data.items():
                if len(sequences_list) >= 2:
                    for i in range(len(sequences_list)):
                        for j in range(i + 1, len(sequences_list)):
                            seq1 = self._pad_or_truncate_sequence(sequences_list[i]['sequence'])
                            seq2 = self._pad_or_truncate_sequence(sequences_list[j]['sequence'])
                            
                            sequences_a.append(seq1)
                            sequences_b.append(seq2)
                            labels.append(1)
                            genuine_pairs += 1
            
            print(f"[FASE 2] Pares genuinos creados: {genuine_pairs}")
            
            # Pares impostores (diferentes usuarios)
            impostor_pairs = 0
            target_impostor_pairs = min(genuine_pairs, 300)  # Limitar impostores
            
            user_ids_list = list(user_temporal_data.keys())
            while impostor_pairs < target_impostor_pairs:
                idx1 = np.random.randint(0, len(user_ids_list))
                idx2 = np.random.randint(0, len(user_ids_list))
                
                if idx1 != idx2:
                    user1_id = user_ids_list[idx1]
                    user2_id = user_ids_list[idx2]
                    
                    seq1_data = np.random.choice(user_temporal_data[user1_id])
                    seq2_data = np.random.choice(user_temporal_data[user2_id])
                    
                    seq1 = self._pad_or_truncate_sequence(seq1_data['sequence'])
                    seq2 = self._pad_or_truncate_sequence(seq2_data['sequence'])
                    
                    sequences_a.append(seq1)
                    sequences_b.append(seq2)
                    labels.append(0)
                    impostor_pairs += 1
            
            print(f"[FASE 2] Pares impostores creados: {impostor_pairs}")
            
            # Convertir a arrays
            sequences_a = np.array(sequences_a, dtype=np.float32)
            sequences_b = np.array(sequences_b, dtype=np.float32)
            labels = np.array(labels, dtype=np.float32)
            
            print("\n" + "=" * 80)
            print("RESUMEN COMPLETO FASE 2")
            print("=" * 80)
            print(f"[FASE 2] CREACION DE PARES:")
            print(f"[FASE 2]    Pares genuinos: {genuine_pairs}")
            print(f"[FASE 2]    Pares impostores: {impostor_pairs}")
            print(f"[FASE 2]    Total pares: {len(labels)}")
            print(f"[FASE 2]    Estado: SUCCESS")
            print("=" * 80)
            
            # ============================================================
            # FASE 3: EVALUAR CON RED NUEVA
            # ============================================================
            print("\n" + "=" * 80)
            print("FASE 3: EVALUANDO CON RED RECIEN ENTRENADA")
            print("=" * 80)
            
            print(f"[FASE 3] Llamando a evaluate_real_model()...")
            metrics = self.evaluate_real_model(sequences_a, sequences_b, labels)
            
            self.current_metrics = metrics
            
            print("\n" + "=" * 80)
            print("RESUMEN COMPLETO FASE 3")
            print("=" * 80)
            print(f"[FASE 3] EVALUACION Y THRESHOLD:")
            print(f"[FASE 3]    Threshold calculado: {metrics.threshold:.6f}")
            print(f"[FASE 3]    FAR: {metrics.far:.4f} ({metrics.far*100:.2f}%)")
            print(f"[FASE 3]    FRR: {metrics.frr:.4f} ({metrics.frr*100:.2f}%)")
            print(f"[FASE 3]    EER: {metrics.eer:.4f} ({metrics.eer*100:.2f}%)")
            print(f"[FASE 3]    AUC: {metrics.auc_score:.4f}")
            print(f"[FASE 3]    Accuracy: {metrics.accuracy:.4f} ({metrics.accuracy*100:.2f}%)")
            print(f"[FASE 3]    Estado: SUCCESS")
            print("=" * 80)
            
            # ============================================================
            # FASE 4: ACTUALIZAR EMBEDDINGS DINÁMICOS EN BD
            # ============================================================
            print("\n" + "=" * 80)
            print("FASE 4: ACTUALIZANDO EMBEDDINGS DINAMICOS EN BASE DE DATOS")
            print("=" * 80)
            
            embeddings_updated = 0
            embeddings_failed = 0
            users_updated_count = 0
            
            for user_id, sequences_list in user_temporal_data.items():
                print(f"\n[FASE 4] Usuario: {user_id}")
                print(f"[FASE 4]    Total templates a actualizar: {len(sequences_list)}")
                
                user_success = 0
                user_fails = 0
                
                for seq_data in sequences_list:
                    template_id = seq_data['template_id']
                    sequence = seq_data['sequence']
                    
                    print(f"\n[FASE 4]    Template {user_success + user_fails + 1}/{len(sequences_list)}")
                    print(f"[FASE 4]       Template ID: {template_id[:40]}...")
                    
                    try:
                        # Preprocesar secuencia
                        seq_padded = self._pad_or_truncate_sequence(sequence)
                        seq_batch = np.expand_dims(seq_padded, axis=0)
                        
                        print(f"[FASE 4]       Secuencia preprocesada: {seq_batch.shape}")
                        
                        # Generar nuevo embedding con base_network
                        new_embedding = self.base_network.predict(seq_batch, verbose=0)[0]
                        
                        print(f"[FASE 4]       Nuevo embedding generado: {new_embedding.shape}")
                        
                        # Normalizar
                        norm = np.linalg.norm(new_embedding)
                        if norm > 0:
                            new_embedding = new_embedding / norm
                        
                        print(f"[FASE 4]       Embedding normalizado (L2 norm: {np.linalg.norm(new_embedding):.6f})")
                        
                        # Actualizar en BD
                        template = database.get_template(template_id)
                        
                        if template:
                            print(f"[FASE 4]       Template recuperado de BD")
                            
                            # Verificar embedding anterior
                            old_embedding = template.dynamic_embedding
                            if old_embedding is not None:
                                print(f"[FASE 4]       Embedding anterior existe: SI (shape: {np.array(old_embedding).shape})")
                            else:
                                print(f"[FASE 4]       Embedding anterior existe: NO")
                            
                            # Asignar nuevo embedding (como numpy array, NO .tolist())
                            template.dynamic_embedding = new_embedding
                            print(f"[FASE 4]       Nuevo embedding asignado a template")
                            
                            # Guardar en BD
                            database._save_template(template)
                            print(f"[FASE 4]       Template actualizado en BD")
                            print(f"[FASE 4]       [SUCCESS] Embedding actualizado exitosamente")
                            
                            embeddings_updated += 1
                            user_success += 1
                        else:
                            print(f"[FASE 4]       [ERROR] Template no encontrado en BD")
                            embeddings_failed += 1
                            user_fails += 1
                    
                    except Exception as e:
                        print(f"[FASE 4]       [ERROR] Error actualizando BD: {type(e).__name__}")
                        print(f"[FASE 4]          Mensaje: {str(e)}")
                        embeddings_failed += 1
                        user_fails += 1
                
                if user_success == len(sequences_list):
                    users_updated_count += 1
                    print(f"\n[FASE 4]    [SUCCESS] Usuario completado: {user_success}/{len(sequences_list)} templates actualizados")
                else:
                    print(f"\n[FASE 4]    [WARNING] Usuario parcial: {user_success}/{len(sequences_list)} actualizados, {user_fails} fallidos")
            
            print("\n" + "=" * 80)
            print("RESUMEN COMPLETO FASE 4")
            print("=" * 80)
            print(f"[FASE 4] ACTUALIZACION DE EMBEDDINGS DINAMICOS:")
            print(f"[FASE 4]    Usuarios procesados: {users_with_data}")
            print(f"[FASE 4]    Usuarios actualizados completamente: {users_updated_count}")
            print(f"[FASE 4]    Templates totales: {total_sequences_loaded}")
            print(f"[FASE 4]    Embeddings actualizados exitosamente: {embeddings_updated}")
            print(f"[FASE 4]    Embeddings fallidos: {embeddings_failed}")
            
            if embeddings_failed > 0:
                print(f"[FASE 4]    [WARNING] Hubo {embeddings_failed} fallos en actualizacion")
            else:
                print(f"[FASE 4]    [SUCCESS] Todos los embeddings actualizados sin errores")
            
            print("=" * 80)
            
            # ============================================================
            # FASE 5: GUARDAR MODELO CON THRESHOLD ACTUALIZADO
            # ============================================================
            print("\n" + "=" * 80)
            print("FASE 5: GUARDANDO MODELO CON THRESHOLD ACTUALIZADO")
            print("=" * 80)
            print(f"[FASE 5] Iniciando guardado del modelo")
            print(f"[FASE 5] Threshold a guardar: {metrics.threshold:.6f}")
            
            print(f"\n[FASE 5] Llamando a save_real_model()...")
            save_success = self.save_real_model()
            
            print(f"\n[FASE 5] Resultado de save_real_model(): {save_success}")
            
            print("\n" + "=" * 80)
            print("RESUMEN COMPLETO FASE 5")
            print("=" * 80)
            
            if save_success:
                print(f"[FASE 5] [SUCCESS] Modelo guardado exitosamente")
                print(f"[FASE 5]    Threshold guardado: {metrics.threshold:.6f}")
                print(f"[FASE 5]    Metricas guardadas: SI")
            else:
                print(f"[FASE 5] [ERROR] Error al guardar modelo")
                print(f"[FASE 5]    El threshold no se persiste al disco")
            
            print("=" * 80)
            
            # ============================================================
            # RESUMEN FINAL
            # ============================================================
            print("\n" + "=" * 80)
            print("RESUMEN FINAL COMPLETO - RECALCULACION DE THRESHOLD DINAMICO")
            print("=" * 80)
            
            print(f"\n[RESUMEN] Timestamp finalizacion: {time.strftime('%Y-%m-%d %H:%M:%S')}")
            
            print(f"\n[RESUMEN] FASE 1 - CARGA DE SECUENCIAS:")
            print(f"[RESUMEN]    Usuarios procesados: {len(all_users)}")
            print(f"[RESUMEN]    Usuarios con secuencias: {users_with_data}")
            print(f"[RESUMEN]    Secuencias totales: {total_sequences_loaded}")
            print(f"[RESUMEN]    Estado: SUCCESS")
            
            print(f"\n[RESUMEN] FASE 2 - CREACION DE PARES:")
            print(f"[RESUMEN]    Pares genuinos: {genuine_pairs}")
            print(f"[RESUMEN]    Pares impostores: {impostor_pairs}")
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
            print(f"[RESUMEN]    Embeddings actualizados: {embeddings_updated}")
            print(f"[RESUMEN]    Embeddings fallidos: {embeddings_failed}")
            if embeddings_failed > 0:
                print(f"[RESUMEN]    Estado: WARNING")
            else:
                print(f"[RESUMEN]    Estado: SUCCESS")
            
            print(f"\n[RESUMEN] FASE 5 - GUARDADO DE MODELO:")
            print(f"[RESUMEN]    Modelo guardado: {'SI' if save_success else 'NO'}")
            print(f"[RESUMEN]    Estado: {'SUCCESS' if save_success else 'ERROR'}")
            
            print(f"\n[RESUMEN] ESTADO FINAL: {'SUCCESS - PROCESO COMPLETADO' if save_success else 'PARTIAL - REVISAR LOGS'}")
            print("=" * 80)
            
            # Mensaje final para usuario
            if save_success:
                print(f"✓ Threshold dinámico recalculado y guardado exitosamente")
                print(f"   Nuevo threshold: {metrics.threshold:.4f}")
                print(f"   FAR: {metrics.far:.4f}")
                print(f"   FRR: {metrics.frr:.4f}")
                print(f"   EER: {metrics.eer:.4f}")
            
            return save_success
            
        except Exception as e:
            print("\n" + "=" * 80)
            print("[ERROR] ERROR RECALCULANDO THRESHOLD DINAMICO")
            print("=" * 80)
            print(f"[ERROR] Tipo: {type(e).__name__}")
            print(f"[ERROR] Mensaje: {str(e)}")
            print("=" * 80)
            import traceback
            traceback.print_exc()
            return False
        
    def predict_temporal_similarity_real(self, sequence1: np.ndarray, sequence2: np.ndarray) -> float:
        """Predice similitud temporal entre dos secuencias."""
        try:
            if not self.is_trained:
                logger.error("Modelo temporal no está entrenado")
                raise ValueError("Modelo no entrenado")
            
            if self.siamese_model is None:
                logger.error("Modelo siamés temporal no inicializado")
                raise ValueError("Modelo no inicializado")
            
            # Validar dimensiones
            if sequence1.shape[1] != self.feature_dim or sequence2.shape[1] != self.feature_dim:
                logger.error(f"Dimensiones incorrectas: esperado (*, {self.feature_dim}), "
                         f"recibido {sequence1.shape}, {sequence2.shape}")
                raise ValueError("Dimensiones incorrectas")
            
            # Ajustar secuencias
            seq1_padded = self._pad_or_truncate_sequence(sequence1)
            seq2_padded = self._pad_or_truncate_sequence(sequence2)
            
            # Preparar datos
            seq1_batch = np.array([seq1_padded], dtype=np.float32)
            seq2_batch = np.array([seq2_padded], dtype=np.float32)
            
            # Predecir distancia
            distance = self.siamese_model.predict([seq1_batch, seq2_batch])[0][0]
            
            # Convertir a similitud
            similarity = 1.0 / (1.0 + distance)
            similarity = np.clip(similarity, 0.0, 1.0)
            
            print(f"Predicción temporal: distancia={distance:.4f}, similitud={similarity:.4f}")
            
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error en predicción: {e}")
            raise
    
    # def save_real_model(self) -> bool:
    #     """Guarda el modelo temporal entrenado."""
    #     try:
    #         if not self.is_trained or self.siamese_model is None:
    #             logger.warning("Modelo no entrenado")
    #             return False
            
    #         # Guardar modelo
    #         self.siamese_model.save(str(self.model_save_path))
            
    #         # Guardar metadatos
    #         metadata = {
    #             'embedding_dim': self.embedding_dim,
    #             'sequence_length': self.sequence_length,
    #             'feature_dim': self.feature_dim,
    #             'config': self.config,
    #             'optimal_threshold': self.optimal_threshold,
    #             'is_trained': self.is_trained,
    #             'training_samples': len(self.real_training_samples),
    #             'users_trained_count': self.users_trained_count,
    #             'save_timestamp': datetime.now().isoformat(),
    #             'version': '2.0'
    #         }
            
    #         if self.current_metrics:
    #             metadata['metrics'] = {
    #                 'eer': self.current_metrics.eer,
    #                 'auc_score': self.current_metrics.auc_score,
    #                 'accuracy': self.current_metrics.accuracy,
    #                 'far': self.current_metrics.far,
    #                 'frr': self.current_metrics.frr
    #             }
    def save_real_model(self) -> bool:
        """Guarda el modelo temporal entrenado."""
        try:
            if not self.is_trained or self.siamese_model is None:
                logger.warning("Modelo no entrenado")
                return False
            
            # Guardar modelo
            self.siamese_model.save(str(self.model_save_path))
            
            # Guardar metadatos
            metadata = {
                'embedding_dim': self.embedding_dim,
                'sequence_length': self.sequence_length,
                'feature_dim': self.feature_dim,
                'config': self.config,
                'optimal_threshold': self.optimal_threshold,
                'is_trained': self.is_trained,
                'training_samples': len(self.real_training_samples),
                'users_trained_count': self.users_trained_count,
                'save_timestamp': datetime.now().isoformat(),
                'version': '2.0'
            }
            
            # ============================================================
            # GUARDAR TODAS LAS MÉTRICAS BIOMÉTRICAS
            # ============================================================
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
                    'f1_score': float(self.current_metrics.f1_score),
                    'sequence_correlation': float(self.current_metrics.sequence_correlation),
                    'temporal_consistency': float(self.current_metrics.temporal_consistency),
                    'rhythm_similarity': float(self.current_metrics.rhythm_similarity)
                }
                
                print(f"✓ Métricas guardadas:")
                print(f"  - FAR: {self.current_metrics.far:.4f}")
                print(f"  - FRR: {self.current_metrics.frr:.4f}")
                print(f"  - EER: {self.current_metrics.eer:.4f}")
                print(f"  - AUC: {self.current_metrics.auc_score:.4f}")

            # 1. ROC CURVE
            if hasattr(self.current_metrics, 'roc_fpr') and self.current_metrics.roc_fpr:
                metadata['roc_curve'] = {
                    'fpr': [float(x) for x in self.current_metrics.roc_fpr],
                    'tpr': [float(x) for x in self.current_metrics.roc_tpr]
                }
                print(f"✓ ROC curve guardada: {len(self.current_metrics.roc_fpr)} puntos")

            # 2. CONFUSION MATRIX
            if self.current_metrics.validation_samples > 0:
                # Estimar desde métricas
                total_genuine = int(self.current_metrics.validation_samples * 0.5)  # Asumiendo balance 50/50
                total_impostor = self.current_metrics.validation_samples - total_genuine
                
                fn = int(self.current_metrics.frr * total_genuine)
                tp = total_genuine - fn
                fp = int(self.current_metrics.far * total_impostor)
                tn = total_impostor - fp
                
                metadata['confusion_matrix'] = {
                    'true_positives': int(tp),
                    'false_positives': int(fp),
                    'true_negatives': int(tn),
                    'false_negatives': int(fn)
                }
                print(f"✓ Confusion matrix guardada")

            # 3. TRAINING HISTORY
            if self.training_history and hasattr(self.training_history, 'loss') and self.training_history.loss:
                metadata['training_history'] = {
                    'loss': [float(x) for x in self.training_history.loss],
                    'val_loss': [float(x) for x in self.training_history.val_loss],
                    'epochs': list(range(1, len(self.training_history.loss) + 1))
                }
                
                # Agregar FAR/FRR history si están disponibles
                if hasattr(self.training_history, 'far_history') and self.training_history.far_history:
                    metadata['training_history']['far_history'] = [float(x) for x in self.training_history.far_history]
                    print(f"✓ FAR history guardado: {len(self.training_history.far_history)} valores")
                if hasattr(self.training_history, 'frr_history') and self.training_history.frr_history:
                    metadata['training_history']['frr_history'] = [float(x) for x in self.training_history.frr_history]
                    print(f"✓ FRR history guardado: {len(self.training_history.frr_history)} valores")
                
                print(f"✓ Training history guardado: {len(self.training_history.loss)} epochs")

            # 4. SCORE DISTRIBUTIONS
            if hasattr(self, 'genuine_scores') and hasattr(self, 'impostor_scores'):
                metadata['score_distributions'] = {
                    'genuine_scores': [float(x) for x in self.genuine_scores],
                    'impostor_scores': [float(x) for x in self.impostor_scores]
                }
                print(f"✓ Score distributions guardadas: {len(self.genuine_scores)} genuinos, {len(self.impostor_scores)} impostores")


            metadata_path = self.model_save_path.with_suffix('.json')
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            print(f"✓ Modelo guardado: {self.model_save_path}")
            print(f"✓ Metadatos: {metadata_path}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error guardando modelo: {e}")
            return False
    
    # def load_real_model(self) -> bool:
    #     """Carga un modelo temporal REAL pre-entrenado."""
    #     try:
    #         if not self.model_save_path.exists():
    #             logger.warning(f"Archivo de modelo no encontrado: {self.model_save_path}")
    #             return False
            
    #         # Cargar modelo de Keras
    #         self.siamese_model = keras.models.load_model(
    #             str(self.model_save_path),
    #             custom_objects={
    #                 'contrastive_loss_real': self._contrastive_loss_real,
    #                 'far_metric_real': self._far_metric_real,
    #                 'frr_metric_real': self._frr_metric_real
    #             }
    #         )
            
    #         # Cargar metadatos
    #         metadata_path = self.model_save_path.with_suffix('.json')
    #         if metadata_path.exists():
    #             with open(metadata_path, 'r') as f:
    #                 metadata = json.load(f)
                
    #             self.optimal_threshold = metadata.get('optimal_threshold', 0.5)
    #             self.is_trained = metadata.get('is_trained', True)
                
    #             print(f"✓ Modelo temporal REAL cargado: {self.model_save_path}")
    #             print(f"  - Umbral óptimo: {self.optimal_threshold}")
    #             print(f"  - Muestras de entrenamiento: {metadata.get('training_samples', 'N/A')}")
    #             print(f"  - Versión: {metadata.get('version', 'N/A')}")
            
    #         self.is_compiled = True
            
    #         return True
            
    #     except Exception as e:
    #         logger.error("Error cargando modelo temporal REAL", e)
    #         return False

    def load_real_model(self) -> bool:
        """Carga un modelo temporal REAL pre-entrenado."""
        try:
            if not self.model_save_path.exists():
                logger.warning(f"Archivo de modelo no encontrado: {self.model_save_path}")
                return False
            
            # Cargar modelo de Keras
            self.siamese_model = keras.models.load_model(
                str(self.model_save_path),
                custom_objects={
                    'contrastive_loss_real': self._contrastive_loss_real,
                    'far_metric_real': self._far_metric_real,
                    'frr_metric_real': self._frr_metric_real
                }
            )
            
            print(f"✓ Modelo temporal REAL cargado: {self.model_save_path}")
            
            # ============================================================
            # Cargar metadatos y métricas desde JSON
            # ============================================================
            metadata_path = self.model_save_path.with_suffix('.json')
            if metadata_path.exists():
                try:
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                    
                    # Restaurar metadatos básicos
                    self.optimal_threshold = metadata.get('optimal_threshold', 0.5)
                    self.is_trained = metadata.get('is_trained', True)
                    
                    print(f"✓ Metadatos cargados:")
                    print(f"  - Umbral óptimo: {self.optimal_threshold:.4f}")
                    print(f"  - Muestras de entrenamiento: {metadata.get('training_samples', 'N/A')}")
                    print(f"  - Versión: {metadata.get('version', 'N/A')}")
                    
                    # Restaurar métricas biométricas
                    if 'metrics' in metadata:
                        metrics_data = metadata['metrics']
                        
                        # Crear objeto RealTemporalMetrics
                        self.current_metrics = RealTemporalMetrics(
                            far=metrics_data.get('far', 0.0),
                            frr=metrics_data.get('frr', 0.0),
                            eer=metrics_data.get('eer', 0.0),
                            auc_score=metrics_data.get('auc_score', 0.0),
                            accuracy=metrics_data.get('accuracy', 0.0),
                            threshold=metrics_data.get('threshold', 0.0),
                            precision=metrics_data.get('precision', 0.0),
                            recall=metrics_data.get('recall', 0.0),
                            f1_score=metrics_data.get('f1_score', 0.0),
                            sequence_correlation=metrics_data.get('sequence_correlation', 0.0),
                            temporal_consistency=metrics_data.get('temporal_consistency', 0.0),
                            rhythm_similarity=metrics_data.get('rhythm_similarity', 0.0),
                            validation_samples=metadata.get('training_samples', 0)
                        )
                        
                        print(f"✓ Métricas biométricas temporales restauradas:")
                        print(f"  - FAR: {self.current_metrics.far:.4f}")
                        print(f"  - FRR: {self.current_metrics.frr:.4f}")
                        print(f"  - EER: {self.current_metrics.eer:.4f}")
                        print(f"  - AUC: {self.current_metrics.auc_score:.4f}")
                        print(f"  - Accuracy: {self.current_metrics.accuracy:.4f}")
                    else:
                        logger.warning("⚠ No se encontraron métricas en metadatos")
                        self.current_metrics = None
                        
                except Exception as e:
                    logger.error(f"Error cargando metadatos: {e}")
                    # Continuar aunque falle la carga de metadatos
                    self.current_metrics = None
            else:
                logger.warning(f"⚠ Archivo de metadatos no encontrado: {metadata_path}")
                self.current_metrics = None
            # ============================================================
            
            self.is_compiled = True
            
            return True
            
        except Exception as e:
            logger.error(f"Error cargando modelo temporal REAL: {e}")
            return False
        
    def get_real_model_summary(self) -> Dict[str, Any]:
        """Obtiene resumen completo del modelo temporal REAL."""
        try:
            total_params = self.siamese_model.count_params() if self.siamese_model else 0
            base_params = self.base_network.count_params() if self.base_network else 0
            
            summary = {
                "architecture": {
                    "model_type": "Real Siamese Dynamic Network",
                    "embedding_dim": self.embedding_dim,
                    "sequence_length": self.sequence_length,
                    "feature_dim": self.feature_dim,
                    "total_parameters": total_params,
                    "base_network_parameters": base_params,
                    "lstm_units": self.config['lstm_units'],
                    "sequence_processing": self.config['sequence_processing'],
                    "temporal_pooling": self.config['temporal_pooling'],
                    "distance_metric": self.config['distance_metric']
                },
                "training": {
                    "is_trained": self.is_trained,
                    "training_samples": len(self.real_training_samples),
                    "validation_samples": len(self.real_validation_samples),
                    "users_trained": self.users_trained_count,
                    "optimal_threshold": self.optimal_threshold,
                    "training_time": self.training_history.total_training_time
                },
                "config": self.config,
                "status": {
                    "ready_for_inference": self.is_trained and self.is_compiled,
                    "model_saved": self.model_save_path.exists(),
                    "version": "2.0"
                }
            }
            
            if self.current_metrics:
                summary["performance"] = {
                    "eer": self.current_metrics.eer,
                    "auc_score": self.current_metrics.auc_score,
                    "accuracy": self.current_metrics.accuracy,
                    "far": self.current_metrics.far,
                    "frr": self.current_metrics.frr,
                    "optimal_threshold": self.current_metrics.threshold,
                    "sequence_correlation": self.current_metrics.sequence_correlation,
                    "temporal_consistency": self.current_metrics.temporal_consistency,
                    "rhythm_similarity": self.current_metrics.rhythm_similarity
                }
            
            return summary
            
        except Exception as e:
            logger.error(f"Error obteniendo resumen: {e}")
            return {}


# ===== INSTANCIA GLOBAL =====
_real_siamese_dynamic_instance = None

def get_real_siamese_dynamic_network(embedding_dim: int = 128, 
                                   sequence_length: int = 50,
                                   feature_dim: int = 320) -> RealSiameseDynamicNetwork:
    """
    Obtiene instancia global de la red siamesa dinámica REAL.
    Verifica si hay modelo entrenado guardado y lo carga automáticamente.
    """
    global _real_siamese_dynamic_instance
    
    if _real_siamese_dynamic_instance is None:
        _real_siamese_dynamic_instance = RealSiameseDynamicNetwork(embedding_dim, sequence_length, feature_dim)
    
    # Verificar modelo guardado
    if not _real_siamese_dynamic_instance.is_trained:
        try:
            models_dir = Path('biometric_data/models')
            model_path = models_dir / 'dynamic_model.h5'
            
            if model_path.exists():
                print(f"Cargando modelo dinámico: {model_path}")
                try:
                    if _real_siamese_dynamic_instance.siamese_model is None:
                        _real_siamese_dynamic_instance.build_real_base_network()
                        _real_siamese_dynamic_instance.build_real_siamese_model()
                        _real_siamese_dynamic_instance.compile_real_model()
                    
                    _real_siamese_dynamic_instance.siamese_model.load_weights(str(model_path))
                    _real_siamese_dynamic_instance.is_trained = True
                    
                    print(f"Red dinámica cargada: {model_path}")
                    print(f"Estado: is_trained = {_real_siamese_dynamic_instance.is_trained}")
                    
                except Exception as load_error:
                    logger.warning(f"Error cargando modelo: {load_error}")
            else:
                print(f"No se encontró modelo guardado: {model_path}")
        
        except Exception as e:
            logger.warning(f"Error verificando modelo: {e}")
    
    return _real_siamese_dynamic_instance


# Alias para compatibilidad
SiameseDynamicNetwork = RealSiameseDynamicNetwork
get_siamese_dynamic_network = get_real_siamese_dynamic_network