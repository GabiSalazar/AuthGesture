"""
Servicio para enviar webhooks al Plugin
Comunicación P2 → P1
"""
import requests
import logging
from typing import Dict, Any, Optional
from jose import jwt
from datetime import datetime, timedelta

from app.config import settings

logger = logging.getLogger(__name__)


class PluginWebhookService:
    """Servicio para enviar resultados al Plugin"""
    
    def __init__(self):
        self.api_key = None
        self.timeout = 30  # 30 segundos timeout
    
    def set_api_key(self, api_key: str):
        """Establece la API Key para autenticación"""
        self.api_key = api_key
    
    def send_registration_result(
        self,
        callback_url: str,
        user_id: str,
        email: str,
        session_token: str,
        raw_responses: str
    ) -> bool:
        """
        Envía resultado de registro al Plugin.
        
        Args:
            callback_url: URL del Plugin
            user_id: ID del usuario registrado
            email: Email del usuario
            session_token: Token de sesión del Plugin
            raw_responses: Respuestas del cuestionario (4,4,4,4,4,4,4,4,4,4)
        
        Returns:
            True si se envió exitosamente
        """
        try:
            logger.info(f"📤 Enviando resultado de registro al Plugin")
            logger.info(f"   Callback URL: {callback_url}")
            logger.info(f"   User ID: {user_id}")
            logger.info(f"   Email: {email}")
            logger.info(f"   Session Token: {session_token}")
            
            # Preparar payload
            # payload = {
            #     "user_id": user_id,
            #     "email": email,
            #     "session_token": session_token,
            #     "raw_responses": raw_responses,
            #     "action": "registro"
            # }
            
            # # Preparar headers
            # headers = {
            #     "Content-Type": "application/json"
            # }
            
            # # Agregar API Key si está disponible
            # if self.api_key:
            #     headers["Authorization"] = f"Bearer {self.api_key}"
            
            # # Hacer POST request
            # response = requests.post(
            #     callback_url,
            #     json=payload,
            #     headers=headers,
            #     timeout=self.timeout
            # )
            
            # Generar JWT con los datos en el payload
            jwt_payload = {
                "user_id": user_id,
                "email": email,
                "raw_responses": raw_responses,
                "session_token": session_token,
                "action": "registro",
                "timestamp": datetime.utcnow().isoformat(),
                "exp": datetime.utcnow() + timedelta(hours=settings.BIOMETRIC_JWT_EXPIRATION_HOURS)
            }
            
            # Firmar el JWT con la Secret Key compartida
            jwt_token = jwt.encode(
                jwt_payload,
                settings.BIOMETRIC_JWT_SECRET,
                algorithm="HS256"
            )
            
            logger.info(f"JWT generado para registro")
            
            # Preparar headers (SIN API Key, SIN Authorization)
            headers = {
                "Content-Type": "application/json"
            }

            # Body con JWT como campo "jwt_token"
            body = {
                "jwt_token": jwt_token
            }

            # Hacer POST request
            response = requests.post(
                callback_url,
                json=body,
                headers=headers,
                timeout=self.timeout
            )

            
            # Verificar respuesta
            if response.status_code in [200, 201, 202]:
                logger.info(f"Resultado enviado exitosamente al Plugin")
                logger.info(f"   Status: {response.status_code}")
                return True
            else:
                logger.warning(f"Plugin respondió con status: {response.status_code}")
                logger.warning(f"   Response: {response.text}")
                return False
        
        except requests.exceptions.Timeout:
            logger.error(f"Timeout enviando al Plugin (>{self.timeout}s)")
            return False
        
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Error de conexión con Plugin: {e}")
            return False
        
        except Exception as e:
            logger.error(f"Error enviando resultado al Plugin: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    def send_authentication_result(
        self,
        callback_url: str,
        user_id: str,
        email: str,
        session_token: str,
        authenticated: bool,
        confidence: float = None
    ) -> bool:
        """
        Envía resultado de autenticación al Plugin.
        
        Args:
            callback_url: URL del Plugin
            user_id: ID del usuario
            email: Email del usuario
            session_token: Token de sesión
            authenticated: Si la autenticación fue exitosa
            confidence: Nivel de confianza (opcional)
        
        Returns:
            True si se envió exitosamente
        """
        try:
            logger.info(f"Enviando resultado de autenticación al Plugin")
            logger.info(f"Callback URL: {callback_url}")
            logger.info(f"User ID: {user_id}")
            logger.info(f"Authenticated: {authenticated}")
            
            # Generar JWT con los datos en el payload
            jwt_payload = {
                "user_id": user_id,
                "email": email,
                "session_token": session_token,
                "authenticated": authenticated,
                "action": "autenticacion",
                "timestamp": datetime.utcnow().isoformat(),
                "exp": datetime.utcnow() + timedelta(hours=settings.BIOMETRIC_JWT_EXPIRATION_HOURS)
            }
            
            if confidence is not None:
                jwt_payload["confidence"] = confidence
            
            # Firmar el JWT con la Secret Key compartida
            jwt_token = jwt.encode(
                jwt_payload,
                settings.BIOMETRIC_JWT_SECRET,
                algorithm="HS256"
            )
            
            logger.info(f"JWT generado para autenticación")
            
            # Preparar headers (SIN API Key, SIN Authorization)
            # headers = {
            #     "Content-Type": "application/json"
            # }
            
            # Preparar headers con API Key
            headers = {
                "Content-Type": "application/json"
            }

            # Agregar API Key si está configurada
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
                logger.info("API Key agregada al header de autenticación")
            else:
                logger.warning("No se configuró API Key para el webhook de autenticación")


            # Body con JWT como campo "jwt_token"
            body = {
                "jwt_token": jwt_token
            }

            # Hacer POST request
            response = requests.post(
                callback_url,
                json=body,
                headers=headers,
                timeout=self.timeout
            )
            
            if response.status_code in [200, 201, 202]:
                logger.info(f"Resultado enviado exitosamente al Plugin")
                return True
            else:
                logger.warning(f"Plugin respondió con status: {response.status_code}")
                return False
        
        except Exception as e:
            logger.error(f"Error enviando autenticación al Plugin: {e}")
            return False


# Instancia global
_webhook_service = None


def get_plugin_webhook_service() -> PluginWebhookService:
    """Obtiene instancia global del servicio de webhook"""
    global _webhook_service
    if _webhook_service is None:
        _webhook_service = PluginWebhookService()
    return _webhook_service