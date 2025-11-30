"""
Servicio de notificación por email para bloqueos de cuenta
Envía alertas cuando una cuenta es bloqueada por múltiples intentos fallidos
"""

import os
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def send_lockout_alert_email(
    user_id: str,
    username: str,
    user_email: str,
    failed_attempts: int,
    lockout_until: float,
    duration_minutes: int
) -> bool:
    """
    Envia email de alerta cuando una cuenta es bloqueada por intentos fallidos.
    
    Args:
        user_id: ID del usuario bloqueado
        username: Nombre del usuario
        user_email: Email del usuario
        failed_attempts: Número de intentos fallidos
        lockout_until: Timestamp cuando expira el bloqueo
        duration_minutes: Duración del bloqueo en minutos
        
    Returns:
        bool: True si el email se envió exitosamente
    """
    try:
        api_key = os.getenv('SENDGRID_API_KEY')
        from_email = os.getenv('SENDGRID_FROM_EMAIL', 'noreply@authgesture.com')
        from_name = os.getenv('SENDGRID_FROM_NAME', 'Auth-Gesture Sistema Biométrico')
        
        if not api_key:
            logger.error("SENDGRID_API_KEY no configurada")
            return False
        
        if not user_email:
            logger.error(f"Usuario {user_id} no tiene email configurado")
            return False
        
        lockout_datetime = datetime.fromtimestamp(lockout_until).strftime('%d/%m/%Y %H:%M:%S')
        failed_datetime = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
        
        html_content = f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alerta de Seguridad - Cuenta Bloqueada</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f1f5f9;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07); overflow: hidden;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 40px 32px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                                ALERTA DE SEGURIDAD
                            </h1>
                            <p style="margin: 12px 0 0 0; color: #fecaca; font-size: 15px; font-weight: 500;">
                                Cuenta bloqueada temporalmente
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Contenido principal -->
                    <tr>
                        <td style="padding: 40px 40px 32px 40px;">
                            
                            <!-- Mensaje de alerta -->
                            <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 32px; border-radius: 6px;">
                                <p style="margin: 0; color: #991b1b; font-size: 16px; font-weight: 600; line-height: 1.5;">
                                    Se han detectado múltiples intentos fallidos de verificación biométrica en tu cuenta.
                                </p>
                            </div>
                            
                            <!-- Detalles del incidente -->
                            <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin-bottom: 32px;">
                                <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 18px; font-weight: 600;">
                                    Detalles del Incidente
                                </h2>
                                
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="padding: 8px 0; color: #64748b; font-size: 14px; font-weight: 500;">
                                            Usuario:
                                        </td>
                                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">
                                            {username}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #64748b; font-size: 14px; font-weight: 500;">
                                            ID de Usuario:
                                        </td>
                                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right; font-family: 'Courier New', monospace;">
                                            {user_id}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #64748b; font-size: 14px; font-weight: 500;">
                                            Intentos fallidos:
                                        </td>
                                        <td style="padding: 8px 0; color: #dc2626; font-size: 14px; font-weight: 700; text-align: right;">
                                            {failed_attempts} intentos consecutivos
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #64748b; font-size: 14px; font-weight: 500;">
                                            Fecha y hora:
                                        </td>
                                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">
                                            {failed_datetime}
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            
                            <!-- Estado de la cuenta -->
                            <div style="background-color: #fef2f2; border: 2px solid #fecaca; padding: 24px; border-radius: 8px; margin-bottom: 32px; text-align: center;">
                                <div style="background-color: #dc2626; color: #ffffff; display: inline-block; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 16px;">
                                    CUENTA BLOQUEADA
                                </div>
                                <p style="margin: 0 0 12px 0; color: #991b1b; font-size: 15px; font-weight: 600;">
                                    Tu cuenta estará bloqueada hasta:
                                </p>
                                <p style="margin: 0; color: #1e293b; font-size: 20px; font-weight: 700;">
                                    {lockout_datetime}
                                </p>
                                <p style="margin: 12px 0 0 0; color: #64748b; font-size: 14px;">
                                    Duración del bloqueo: aproximadamente {duration_minutes} minutos
                                </p>
                            </div>
                            
                            <!-- Sección: ¿No fuiste tú? -->
                            <div style="background-color: #fff7ed; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 24px; border-radius: 6px;">
                                <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px; font-weight: 600;">
                                    ¿NO FUISTE TÚ?
                                </h3>
                                <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">
                                    Si NO reconoces estos intentos de acceso, tu cuenta podría estar comprometida. Por favor, contacta al administrador del sistema de inmediato.
                                </p>
                            </div>
                            
                            <!-- Sección: ¿Fuiste tú? -->
                            <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; border-radius: 6px;">
                                <h3 style="margin: 0 0 12px 0; color: #166534; font-size: 16px; font-weight: 600;">
                                    ¿FUISTE TÚ?
                                </h3>
                                <p style="margin: 0 0 12px 0; color: #15803d; font-size: 14px; line-height: 1.6;">
                                    Tu cuenta se desbloqueará automáticamente en {duration_minutes} minutos. Asegúrate de realizar correctamente la secuencia de gestos durante la verificación.
                                </p>
                            </div>
                            
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 32px 40px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px; text-align: center; font-weight: 500;">
                                Auth-Gesture
                            </p>
                            <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.5;">
                                Este es un email automático de seguridad. Por favor no respondas.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        """
        
        message = Mail(
            from_email=Email(from_email, from_name),
            to_emails=To(user_email),
            subject='ALERTA DE SEGURIDAD: Cuenta bloqueada por intentos fallidos - Auth-Gesture',
            html_content=Content("text/html", html_content)
        )
        
        sg_client = SendGridAPIClient(api_key)
        response = sg_client.send(message)
        
        if response.status_code in [200, 201, 202]:
            logger.info(f"Email de alerta de bloqueo enviado a {user_email} para usuario {user_id}")
            return True
        else:
            logger.error(f"Error enviando email de alerta: Status {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"Error enviando email de alerta de bloqueo: {e}")
        import traceback
        traceback.print_exc()
        return False


def get_lockout_notification_service():
    """
    Función helper para mantener consistencia con otros servicios.
    """
    return {
        'send_lockout_alert_email': send_lockout_alert_email
    }