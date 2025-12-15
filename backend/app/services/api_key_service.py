"""
Servicio para gestionar API Keys del sistema biométrico
Comunicación segura entre Plugin ↔ Sistema Biométrico
"""
import secrets
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from app.core.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class APIKeyService:
    """
    Servicio para gestión de API Keys.
    Permite generar, validar y regenerar claves para comunicación Plugin ↔ Backend.
    """
    
    def __init__(self):
        self.client = get_supabase_client()
        self.table_name = 'api_keys'
    
    def generate_api_key(self) -> str:
        """
        Genera una API Key segura en formato sk_live_XXXXXXXX.
        
        Returns:
            API Key generada (32 caracteres después del prefijo)
        """
        # Generar 32 caracteres aleatorios seguros
        random_part = secrets.token_hex(16)  # 16 bytes = 32 caracteres hex
        
        # Formato: sk_live_XXXXXXXX
        api_key = f"sk_live_{random_part}"
        
        return api_key
    
    def create_new_api_key(self, created_by: str = "admin") -> Dict[str, Any]:
        """
        Crea una nueva API Key y la guarda en Supabase.
        IMPORTANTE: Desactiva todas las claves anteriores (solo 1 activa a la vez).
        
        Args:
            created_by: Usuario que genera la clave
            
        Returns:
            Diccionario con id, key, created_at
            
        Raises:
            Exception: Si hay error al guardar en Supabase
        """
        try:
            # 1. Desactivar todas las claves anteriores
            self.client.table(self.table_name).update({
                'is_active': False
            }).eq('is_active', True).execute()
            
            logger.info("Claves anteriores desactivadas")
            
            # 2. Generar nueva clave
            new_key = self.generate_api_key()
            
            # 3. Insertar en Supabase
            data = {
                'key': new_key,
                'created_by': created_by,
                'is_active': True,
                'created_at': datetime.utcnow().isoformat(),
                'usage_count': 0
            }
            
            result = self.client.table(self.table_name).insert(data).execute()
            
            logger.info(f"Nueva API Key generada: {new_key[:20]}...")
            
            return {
                'id': result.data[0]['id'],
                'key': result.data[0]['key'],
                'created_at': result.data[0]['created_at'],
                'is_active': result.data[0]['is_active']
            }
            
        except Exception as e:
            logger.error(f"Error creando API Key: {e}")
            raise
    
    def get_current_api_key(self) -> Optional[Dict[str, Any]]:
        """
        Obtiene la API Key activa actual.
        
        Returns:
            Diccionario con datos de la clave o None si no existe
        """
        try:
            result = self.client.table(self.table_name)\
                .select('*')\
                .eq('is_active', True)\
                .order('created_at', desc=True)\
                .limit(1)\
                .execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            
            return None
            
        except Exception as e:
            logger.error(f"Error obteniendo API Key: {e}")
            return None
    
    def validate_api_key(self, api_key: str) -> bool:
        """
        Valida si una API Key es válida y está activa.
        También incrementa el contador de uso.
        
        Args:
            api_key: La clave a validar
            
        Returns:
            True si la clave es válida y activa
        """
        try:
            # Buscar clave en Supabase
            result = self.client.table(self.table_name)\
                .select('*')\
                .eq('key', api_key)\
                .eq('is_active', True)\
                .execute()
            
            if result.data and len(result.data) > 0:
                # Clave válida - actualizar uso
                key_data = result.data[0]
                
                # Incrementar contador y actualizar última vez usada
                self.client.table(self.table_name)\
                    .update({
                        'usage_count': key_data['usage_count'] + 1,
                        'last_used_at': datetime.utcnow().isoformat()
                    })\
                    .eq('id', key_data['id'])\
                    .execute()
                
                logger.info(f"API Key válida - Usos: {key_data['usage_count'] + 1}")
                return True
            
            logger.warning(f"API Key inválida o inactiva")
            return False
            
        except Exception as e:
            logger.error(f"Error validando API Key: {e}")
            return False
    
    def regenerate_api_key(self, created_by: str = "admin") -> Dict[str, Any]:
        """
        Regenera la API Key (invalida la anterior y crea una nueva).
        Alias de create_new_api_key para claridad semántica.
        
        Args:
            created_by: Usuario que regenera la clave
            
        Returns:
            Diccionario con nueva API Key
        """
        logger.info("Regenerando API Key...")
        return self.create_new_api_key(created_by)
    
    def get_api_key_stats(self) -> Dict[str, Any]:
        """
        Obtiene estadísticas de uso de las API Keys.
        
        Returns:
            Diccionario con estadísticas
        """
        try:
            current_key = self.get_current_api_key()
            
            if not current_key:
                return {
                    'has_active_key': False,
                    'total_usage': 0,
                    'last_used': None
                }
            
            return {
                'has_active_key': True,
                'key_preview': current_key['key'][:20] + '...',
                'created_at': current_key['created_at'],
                'total_usage': current_key['usage_count'],
                'last_used': current_key.get('last_used_at'),
                'created_by': current_key.get('created_by')
            }
            
        except Exception as e:
            logger.error(f"Error obteniendo estadísticas: {e}")
            return {
                'has_active_key': False,
                'error': str(e)
            }


# Instancia global (singleton)
_api_key_service: Optional[APIKeyService] = None


def get_api_key_service() -> APIKeyService:
    """
    Obtiene instancia global del servicio de API Keys.
    
    Returns:
        Instancia de APIKeyService
    """
    global _api_key_service
    
    if _api_key_service is None:
        _api_key_service = APIKeyService()
        logger.info("APIKeyService inicializado")
    
    return _api_key_service