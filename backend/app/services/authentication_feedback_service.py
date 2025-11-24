"""
Servicio para gestionar feedback de autenticacion y calcular metricas
"""
import uuid
import logging
import os
from datetime import datetime
from typing import Dict, Any, Optional, List
from app.core.supabase_client import get_supabase_client
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class AuthenticationFeedbackService:
    """
    Servicio para guardar intentos de autenticacion y procesar feedback.
    Calcula metricas TP/FP/TN/FN para evaluacion del sistema.
    """
    
    def __init__(self):
        self.client = get_supabase_client()
    
    def send_feedback_email(
        self,
        user_email: str,
        username: str,
        feedback_token: str,
        system_decision: str,
        mode: str
    ) -> bool:
        """
        Envia email de feedback con botones SI/NO.
        
        Args:
            user_email: Email del usuario
            username: Nombre del usuario
            feedback_token: Token unico para los botones
            system_decision: 'authenticated' o 'rejected'
            mode: 'verification' o 'identification'
            
        Returns:
            True si se envio correctamente
        """
        try:
            # Configuracion
            api_key = os.getenv('SENDGRID_API_KEY')
            from_email = os.getenv('SENDGRID_FROM_EMAIL')
            from_name = os.getenv('SENDGRID_FROM_NAME', 'Auth-Gesture Sistema Biometrico')
            backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
            
            if not api_key or not from_email:
                logger.error("SendGrid no esta configurado correctamente en .env")
                return False
            
            # URLs de los botones
            confirm_url = f"{backend_url}/api/v1/feedback/confirm?token={feedback_token}&response=was_me"
            deny_url = f"{backend_url}/api/v1/feedback/confirm?token={feedback_token}&response=not_me"
            
            # Determinar textos segun decision del sistema
            if system_decision == 'authenticated':
                result_text = '<strong style="color: #10b981;">autenticacion exitosa</strong>'
                result_emoji = 'Autenticado'
            else:
                result_text = '<strong style="color: #ef4444;">acceso rechazado</strong>'
                result_emoji = 'Rechazado'
            
            mode_text = 'verificacion biometrica' if mode == 'verification' else 'identificacion biometrica'
            
            # Construir HTML
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Confirmacion de Acceso</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        
        <h2 style="color: #3b82f6; margin-bottom: 20px;">Acceso a tu cuenta</h2>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Hola <strong>{username}</strong>,
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Detectamos un intento de {result_text} en tu cuenta mediante {mode_text}.
        </p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Tipo:</strong> {mode.capitalize()}</p>
            <p style="margin: 5px 0;"><strong>Resultado:</strong> {result_emoji}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
        </div>
        
        <p style="color: #333; font-size: 18px; font-weight: bold; margin: 30px 0; text-align: center;">
            Fuiste tu quien intento acceder?
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{confirm_url}" style="display: inline-block; background-color: #10b981; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px; font-size: 16px;">
                SI, FUI YO
            </a>
            
            <a href="{deny_url}" style="display: inline-block; background-color: #ef4444; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px; font-size: 16px;">
                NO FUI YO
            </a>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px; text-align: center; padding: 15px; background-color: #fff3cd; border-radius: 5px;">
            Si no fuiste tu, haz click en "NO FUI YO" para que podamos tomar medidas de seguridad.
        </p>
        
        <p style="color: #999; font-size: 13px; margin-top: 20px; text-align: center;">
            Esta confirmacion nos ayuda a mejorar la precision del sistema biometrico y garantizar tu seguridad.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #999; font-size: 12px; text-align: center;">
            <strong>Auth-Gesture - Sistema Biometrico de Gestos de Mano</strong><br>
            Este es un email automatico, por favor no respondas.<br>
            Si tienes dudas, contacta al administrador del sistema.
        </p>
    </div>
</body>
</html>
            """
            
            # Crear mensaje de SendGrid
            message = Mail(
                from_email=Email(from_email, from_name),
                to_emails=To(user_email),
                subject='Confirmacion de acceso - Auth-Gesture',
                html_content=Content("text/html", html_content)
            )
            
            # Enviar con SendGrid
            sg_client = SendGridAPIClient(api_key)
            response = sg_client.send(message)
            
            if response.status_code in [200, 201, 202]:
                logger.info(f"Email de feedback enviado a {user_email}")
                return True
            else:
                logger.error(f"Error enviando email: Status {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Error enviando email de feedback: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def save_authentication_attempt(
        self,
        session_id: str,
        user_id: str,
        username: str,
        mode: str,
        system_decision: str,
        confidence: float,
        user_email: str,
        ip_address: str = "localhost",
        duration: float = 0.0
    ) -> Dict[str, Any]:
        """
        Guarda un intento de autenticacion en Supabase y envia email de feedback.
        
        Args:
            session_id: ID de la sesion
            user_id: ID del usuario
            username: Nombre del usuario
            mode: 'verification' o 'identification'
            system_decision: 'authenticated' o 'rejected'
            confidence: Confianza del sistema (0-1)
            user_email: Email del usuario (REQUERIDO para enviar feedback)
            ip_address: IP del cliente
            duration: Duracion del proceso
            
        Returns:
            Diccionario con id y feedback_token
        """
        try:
            # Generar token unico para feedback
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
            
            logger.info(f"Intento guardado: {user_id} - {system_decision}")
            
            # ENVIAR EMAIL DE FEEDBACK AUTOMATICAMENTE
            try:
                if user_email:
                    email_sent = self.send_feedback_email(
                        user_email=user_email,
                        username=username,
                        feedback_token=feedback_token,
                        system_decision=system_decision,
                        mode=mode
                    )
                    if email_sent:
                        logger.info(f"Email de feedback enviado a {user_email}")
                    else:
                        logger.warning(f"No se pudo enviar email a {user_email}")
                else:
                    logger.warning(f"No se proporciono email para usuario {user_id}")
                    
            except Exception as e:
                logger.error(f"Error enviando email: {e}")
                # No fallar la autenticacion si el email falla
            
            return {
                'id': result.data[0]['id'],
                'feedback_token': feedback_token
            }
            
        except Exception as e:
            logger.error(f"Error guardando intento: {e}")
            raise
    
    def update_user_feedback(
        self,
        feedback_token: str,
        user_feedback: str
    ) -> bool:
        """
        Actualiza el feedback del usuario.
        
        Args:
            feedback_token: Token unico del intento
            user_feedback: 'was_me' o 'not_me'
            
        Returns:
            True si se actualizo correctamente
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
                logger.info(f"Feedback actualizado: {feedback_token} -> {user_feedback}")
                return True
            else:
                logger.warning(f"Token no encontrado: {feedback_token}")
                return False
                
        except Exception as e:
            logger.error(f"Error actualizando feedback: {e}")
            return False
    
    def get_attempt_by_token(self, feedback_token: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene un intento por su token.
        
        Args:
            feedback_token: Token unico
            
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
            logger.error(f"Error obteniendo intento: {e}")
            return None
    
    def calculate_metrics(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Calcula metricas de autenticacion (TP, FP, TN, FN).
        
        Args:
            user_id: Filtrar por usuario especifico (opcional)
            
        Returns:
            Diccionario con todas las metricas
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
            
            # Calcular metricas
            for attempt in attempts:
                system = attempt['system_decision']
                feedback = attempt['user_feedback']
                
                if system == 'authenticated' and feedback == 'was_me':
                    tp += 1  # True Positive: Sistema acerto
                elif system == 'authenticated' and feedback == 'not_me':
                    fp += 1  # False Positive: Sistema fallo (dejo pasar impostor)
                elif system == 'rejected' and feedback == 'not_me':
                    tn += 1  # True Negative: Sistema acerto (bloqueo impostor)
                elif system == 'rejected' and feedback == 'was_me':
                    fn += 1  # False Negative: Sistema fallo (bloqueo usuario real)
            
            # Calcular metricas derivadas
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
            logger.error(f"Error calculando metricas: {e}")
            return {}


# Instancia global
_feedback_service: Optional[AuthenticationFeedbackService] = None


def get_feedback_service() -> AuthenticationFeedbackService:
    """Obtiene instancia global del servicio"""
    global _feedback_service
    
    if _feedback_service is None:
        _feedback_service = AuthenticationFeedbackService()
    
    return _feedback_service