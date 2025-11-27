from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional

class Settings(BaseSettings):
    # ============================================================================
    # INFORMACIÓN DEL PROYECTO
    # ============================================================================
    PROJECT_NAME: str = "Biometric Gesture System"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    
    # ============================================================================
    # SERVIDOR
    # ============================================================================
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    
    # ============================================================================
    # CORS
    # ============================================================================
    BACKEND_CORS_ORIGINS: list = ["http://localhost:5173", "http://localhost:3000"]
    
    # ============================================================================
    # URLs DE LA APLICACIÓN (NUEVO)
    # ============================================================================
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"
    
    # ============================================================================
    # RUTAS
    # ============================================================================
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    BIOMETRIC_DATA_DIR: Path = BASE_DIR / "biometric_data"
    MODELS_DIR: Path = BASE_DIR / "models"
    
    # ============================================================================
    # RUTAS DE DATOS BIOMÉTRICOS (NUEVO)
    # ============================================================================
    BIOMETRIC_DATA_PATH: str = "biometric_data"
    EMAIL_VERIFICATIONS_PATH: str = "biometric_data/email_verifications"
    
    # ============================================================================
    # SENDGRID - VERIFICACIÓN DE EMAIL (NUEVO)
    # ============================================================================
    SENDGRID_API_KEY: Optional[str] = None
    SENDGRID_TEMPLATE_ID: Optional[str] = None
    SENDGRID_FROM_EMAIL: str = "noreply@sistemabiometrico.com"
    SENDGRID_FROM_NAME: str = "Sistema Biométrico"
    
    # ========================================================================
    # RESEND - VERIFICACIÓN DE EMAIL (NUEVO)
    # ========================================================================
    RESEND_API_KEY: Optional[str] = None
    EMAIL_FROM: str = "gabriela.a.salazar.m@gmail.com"
    EMAIL_FROM_NAME: str = "Sistema Biométrico"

    # ============================================================================
    # CONFIGURACIÓN DE VERIFICACIÓN DE EMAIL (NUEVO)
    # ============================================================================
    EMAIL_VERIFICATION_EXPIRY_MINUTES: int = 30
    EMAIL_RESEND_COOLDOWN_SECONDS: int = 60
    
    # ============================================================================
    # MEDIAPIPE
    # ============================================================================
    MEDIAPIPE_MODEL_PATH: Optional[str] = None
    
    # ============================================================================
    # CÁMARA
    # ============================================================================
    CAMERA_WIDTH: int = 1280
    CAMERA_HEIGHT: int = 720
    CAMERA_FPS: int = 30
    
    # ============================================================================
    # UMBRALES
    # ============================================================================
    HAND_CONFIDENCE_THRESHOLD: float = 0.9
    GESTURE_CONFIDENCE_THRESHOLD: float = 0.6
    
    # ============================================================================
    # SUPABASE
    # ============================================================================
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    
    # ============================================================================
    # SEGURIDAD
    # ============================================================================
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # ============================================================================
    # ADMIN AUTHENTICATION
    # ============================================================================
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "change_me_in_env"
    ADMIN_JWT_SECRET: str = "change_me_in_env_this_is_not_secure"
    ADMIN_JWT_EXPIRATION_HOURS: int = 8
    
    # BIOMETRIC JWT (para comunicación con Plugin)
    BIOMETRIC_JWT_SECRET: str = "CHANGE_ME_IN_ENV_FILE_NOT_SECURE"
    BIOMETRIC_JWT_EXPIRATION_HOURS: int = 1

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()