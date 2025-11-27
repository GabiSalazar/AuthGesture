"""
API routers package
"""

from app.api import (
    roi, 
    config, 
    camera, 
    mediapipe, 
    quality, 
    reference_area, 
    anatomical_features, 
    dynamic_features,
    sequence_manager,
    siamese_anatomical,
    siamese_dynamic,
    feature_preprocessor,
    score_fusion,
    biometric_database,
    enrollment,
    authentication,
    system,
    feedback,
    admin,
    api_keys,
    biometric_plugin
)

__all__ = [
    'roi', 
    'config', 
    'camera', 
    'mediapipe', 
    'quality', 
    'reference_area', 
    'anatomical_features', 
    'dynamic_features',
    'sequence_manager',
    'siamese_anatomical',
    'siamese_dynamic',
    'feature_preprocessor',
    'score_fusion',
    'biometric_database',
    'enrollment',
    'authentication',
    'system',
    'feedback',
    'admin',
    'api_keys',
    'biometric_plugin'
]