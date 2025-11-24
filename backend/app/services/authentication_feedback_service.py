"""
Servicio para gestionar feedback de autenticación y calcular métricas
"""
import uuid
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from app.core.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class AuthenticationFeedbackService:
    """
    Servicio para guardar intentos de autenticación y procesar feedback.
    Calcula métricas TP/FP/TN/FN para evaluación del sistema.
    """
    
    def __init__(self):
        self.client = get_supabase_client()
    
    def save_authentication_attempt(
        self,
        session_id: str,
        user_id: str,
        username: str,
        mode: str,
        system_decision: str,
        confidence: float,
        ip_address: str = "localhost",
        duration: float = 0.0
    ) -> Dict[str, Any]:
        """
        Guarda un intento de autenticación en Supabase.
        
        Args:
            session_id: ID de la sesión
            user_id: ID del usuario
            username: Nombre del usuario
            mode: 'verification' o 'identification'
            system_decision: 'authenticated' o 'rejected'
            confidence: Confianza del sistema (0-1)
            ip_address: IP del cliente
            duration: Duración del proceso
            
        Returns:
            Diccionario con id y feedback_token
        """
        try:
            # Generar token único para feedback
            feedback_token = str(uuid.uuid4())
            
            # Datos a insertar
            data = {
                'session_id': session_id,
                'user_id': user_id,
                'username': username,
                'mode': mode,
                'system_decision': system_decision,
                'confidence': confidence,
                'feedback_token': feedback_token,
                'ip_address': ip_address,
                'duration': duration,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            # Insertar en Supabase
            result = self.client.table('authentication_attempts').insert(data).execute()
            
            logger.info(f"✅ Intento guardado: {user_id} - {system_decision}")
            
            return {
                'id': result.data[0]['id'],
                'feedback_token': feedback_token
            }
            
        except Exception as e:
            logger.error(f"❌ Error guardando intento: {e}")
            raise
    
    def update_user_feedback(
        self,
        feedback_token: str,
        user_feedback: str
    ) -> bool:
        """
        Actualiza el feedback del usuario.
        
        Args:
            feedback_token: Token único del intento
            user_feedback: 'was_me' o 'not_me'
            
        Returns:
            True si se actualizó correctamente
        """
        try:
            # Actualizar registro
            result = self.client.table('authentication_attempts')\
                .update({
                    'user_feedback': user_feedback,
                    'feedback_timestamp': datetime.utcnow().isoformat()
                })\
                .eq('feedback_token', feedback_token)\
                .execute()
            
            if result.data:
                logger.info(f"✅ Feedback actualizado: {feedback_token} -> {user_feedback}")
                return True
            else:
                logger.warning(f"⚠️ Token no encontrado: {feedback_token}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error actualizando feedback: {e}")
            return False
    
    def get_attempt_by_token(self, feedback_token: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene un intento por su token.
        
        Args:
            feedback_token: Token único
            
        Returns:
            Datos del intento o None
        """
        try:
            result = self.client.table('authentication_attempts')\
                .select('*')\
                .eq('feedback_token', feedback_token)\
                .execute()
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            logger.error(f"❌ Error obteniendo intento: {e}")
            return None
    
    def calculate_metrics(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Calcula métricas de autenticación (TP, FP, TN, FN).
        
        Args:
            user_id: Filtrar por usuario específico (opcional)
            
        Returns:
            Diccionario con todas las métricas
        """
        try:
            # Obtener todos los intentos con feedback
            query = self.client.table('authentication_attempts')\
                .select('system_decision, user_feedback, mode')\
                .neq('user_feedback', 'null')
            
            if user_id:
                query = query.eq('user_id', user_id)
            
            result = query.execute()
            attempts = result.data
            
            # Inicializar contadores
            tp = fp = tn = fn = 0
            
            # Calcular métricas
            for attempt in attempts:
                system = attempt['system_decision']
                feedback = attempt['user_feedback']
                
                if system == 'authenticated' and feedback == 'was_me':
                    tp += 1  # True Positive: Sistema acertó
                elif system == 'authenticated' and feedback == 'not_me':
                    fp += 1  # False Positive: Sistema falló (dejó pasar impostor)
                elif system == 'rejected' and feedback == 'not_me':
                    tn += 1  # True Negative: Sistema acertó (bloqueó impostor)
                elif system == 'rejected' and feedback == 'was_me':
                    fn += 1  # False Negative: Sistema falló (bloqueó usuario real)
            
            # Calcular métricas derivadas
            total = tp + fp + tn + fn
            
            accuracy = (tp + tn) / total if total > 0 else 0
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0
            f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
            
            far = fp / (fp + tn) if (fp + tn) > 0 else 0  # False Acceptance Rate
            frr = fn / (fn + tp) if (fn + tp) > 0 else 0  # False Rejection Rate
            
            return {
                'true_positives': tp,
                'false_positives': fp,
                'true_negatives': tn,
                'false_negatives': fn,
                'total_samples': total,
                'accuracy': round(accuracy, 4),
                'precision': round(precision, 4),
                'recall': round(recall, 4),
                'f1_score': round(f1_score, 4),
                'far': round(far, 4),
                'frr': round(frr, 4)
            }
            
        except Exception as e:
            logger.error(f"❌ Error calculando métricas: {e}")
            return {}


# Instancia global
_feedback_service: Optional[AuthenticationFeedbackService] = None


def get_feedback_service() -> AuthenticationFeedbackService:
    """Obtiene instancia global del servicio"""
    global _feedback_service
    
    if _feedback_service is None:
        _feedback_service = AuthenticationFeedbackService()
    
    return _feedback_service