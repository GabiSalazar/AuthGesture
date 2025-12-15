"""
Servicio para gestión de intentos de identificación (1:N)
SIN sistema de feedback (a diferencia de la verificación)
"""

from datetime import datetime, timezone
from app.core.supabase_client import get_supabase_client
import logging

logger = logging.getLogger(__name__)


class IdentificationService:
    """
    Servicio para registrar intentos de identificación biométrica 1:N
    """
    
    def __init__(self):
        self.supabase = get_supabase_client()
    
    def save_identification_attempt(
        self,
        session_id: str,
        identified_user_id: str = None,  # NULL si no se identificó
        username: str = None,
        user_email: str = None,
        system_decision: str = 'rejected',
        confidence: float = 0.0,
        anatomical_score: float = 0.0,
        dynamic_score: float = 0.0,
        fused_score: float = 0.0,
        all_candidates: list = None,
        top_match_score: float = None,
        gestures_captured: list = None,
        ip_address: str = None,
        duration: float = None
    ):
        """
        Guarda un intento de identificación en identification_attempts.
        
        Args:
            session_id: ID de la sesión
            identified_user_id: ID del usuario identificado (None si falló)
            username: Nombre del usuario identificado (None si falló)
            user_email: Email del usuario identificado (None si falló)
            system_decision: 'authenticated' o 'rejected'
            confidence: Score de confianza final
            anatomical_score: Score anatómico
            dynamic_score: Score dinámico
            fused_score: Score fusionado
            all_candidates: Lista de candidatos con scores
            top_match_score: Score del mejor candidato
            gestures_captured: Lista de gestos capturados
            ip_address: IP del intento
            duration: Duración del proceso
        
        Returns:
            dict: Datos del intento guardado o None si falla
        """
        try:
            # DATOS PARA identification_attempts (SIN feedback)
            data = {
                'session_id': session_id,
                'identified_user_id': identified_user_id,
                'username': username,
                'user_email': user_email,
                'system_decision': system_decision,
                'confidence': confidence,
                'anatomical_score': anatomical_score,
                'dynamic_score': dynamic_score,
                'fused_score': fused_score,
                'all_candidates': all_candidates or [],
                'top_match_score': top_match_score or fused_score,
                'gestures_captured': gestures_captured or [],
                'ip_address': ip_address,
                'duration': duration,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            # INSERTAR EN identification_attempts
            response = self.supabase.table('identification_attempts').insert(data).execute()
            
            logger.info(
                f"Identificación guardada: session={session_id}, "
                f"user={identified_user_id or 'unknown'}, decision={system_decision}"
            )
            
            return {
                'session_id': session_id,
                'identified_user_id': identified_user_id,
                'system_decision': system_decision,
                'table': 'identification_attempts'
            }
            
        except Exception as e:
            logger.error(f"Error guardando identificación: {str(e)}")
            return None
    
    def get_identification_stats(self, user_id: str = None):
        """
        Obtiene estadísticas de identificaciones.
        
        Args:
            user_id: Filtrar por usuario específico (opcional)
        
        Returns:
            dict: Estadísticas de identificación
        """
        try:
            query = self.supabase.table('identification_attempts').select('*')
            
            if user_id:
                query = query.eq('identified_user_id', user_id)
            
            response = query.execute()
            attempts = response.data
            
            total = len(attempts)
            authenticated = len([a for a in attempts if a['system_decision'] == 'authenticated'])
            rejected = len([a for a in attempts if a['system_decision'] == 'rejected'])
            
            avg_confidence = sum(a['confidence'] for a in attempts) / total if total > 0 else 0
            
            return {
                'total_attempts': total,
                'authenticated': authenticated,
                'rejected': rejected,
                'success_rate': (authenticated / total * 100) if total > 0 else 0,
                'average_confidence': avg_confidence
            }
            
        except Exception as e:
            logger.error(f"Error obteniendo stats de identificación: {str(e)}")
            return None
    
    def get_user_identifications(self, user_id: str, limit: int = 10):
        """
        Obtiene historial de identificaciones de un usuario.
        
        Args:
            user_id: ID del usuario
            limit: Número máximo de registros
        
        Returns:
            list: Lista de identificaciones
        """
        try:
            response = self.supabase.table('identification_attempts')\
                .select('*')\
                .eq('identified_user_id', user_id)\
                .order('timestamp', desc=True)\
                .limit(limit)\
                .execute()
            
            return response.data
            
        except Exception as e:
            logger.error(f"Error obteniendo identificaciones de usuario: {str(e)}")
            return []


# INSTANCIA GLOBAL
_identification_service = None

def get_identification_service():
    """Obtiene instancia global del servicio de identificación."""
    global _identification_service
    if _identification_service is None:
        _identification_service = IdentificationService()
    return _identification_service