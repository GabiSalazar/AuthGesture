"""
SERVICIO UNIFICADO DE EMAIL CON FALLBACK
SendGrid (primario) -> Resend (respaldo)
"""

import os
import logging
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class EmailService:
    """
    Servicio unificado de email con fallback.
    Intenta SendGrid primero, si falla usa Resend.
    """
    
    def __init__(self):
        # SendGrid
        self.sendgrid_api_key = os.getenv('SENDGRID_API_KEY')
        self.sendgrid_from_email = os.getenv('SENDGRID_FROM_EMAIL', 'noreply@authgesture.com')
        self.sendgrid_from_name = os.getenv('SENDGRID_FROM_NAME', 'Auth-Gesture Sistema Biométrico')
        
        # Resend
        self.resend_api_key = os.getenv('RESEND_API_KEY')
        
        # Verificar configuración
        if self.sendgrid_api_key:
            logger.info("✓ SendGrid configurado (primario)")
        else:
            logger.warning("✗ SendGrid NO configurado")
            
        if self.resend_api_key:
            logger.info("✓ Resend configurado (respaldo)")
        else:
            logger.warning("✗ Resend NO configurado")
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None
    ) -> dict:
        """
        Envía un email usando SendGrid, si falla usa Resend.
        
        Args:
            to_email: Email destino
            subject: Asunto del email
            html_content: Contenido HTML
            from_email: Email remitente (opcional)
            from_name: Nombre remitente (opcional)
            
        Returns:
            dict con 'success', 'provider' y 'error' (si aplica)
        """
        from_email = from_email or self.sendgrid_from_email
        from_name = from_name or self.sendgrid_from_name
        
        # INTENTO 1: SendGrid
        if self.sendgrid_api_key:
            result = self._send_with_sendgrid(to_email, subject, html_content, from_email, from_name)
            if result['success']:
                return result
            else:
                logger.warning(f"SendGrid falló: {result.get('error')}. Intentando con Resend...")
        
        # INTENTO 2: Resend (fallback)
        if self.resend_api_key:
            result = self._send_with_resend(to_email, subject, html_content, from_email, from_name)
            if result['success']:
                return result
            else:
                logger.error(f"Resend también falló: {result.get('error')}")
                return result
        
        # Ningún proveedor disponible
        return {
            'success': False,
            'provider': None,
            'error': 'No hay proveedores de email configurados'
        }
    
    def _send_with_sendgrid(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        from_email: str,
        from_name: str
    ) -> dict:
        """Envía email usando SendGrid."""
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail, Email, To, Content
            
            message = Mail(
                from_email=Email(from_email, from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            sg_client = SendGridAPIClient(self.sendgrid_api_key)
            response = sg_client.send(message)
            
            if response.status_code in [200, 201, 202]:
                logger.info(f"✓ Email enviado con SendGrid a {to_email}")
                return {
                    'success': True,
                    'provider': 'sendgrid',
                    'status_code': response.status_code
                }
            else:
                return {
                    'success': False,
                    'provider': 'sendgrid',
                    'error': f'Status code: {response.status_code}'
                }
                
        except Exception as e:
            logger.error(f"Error SendGrid: {e}")
            return {
                'success': False,
                'provider': 'sendgrid',
                'error': str(e)
            }
    
    def _send_with_resend(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        from_email: str,
        from_name: str
    ) -> dict:
        """Envía email usando Resend."""
        try:
            import resend
            
            resend.api_key = self.resend_api_key
            
            params = {
                "from": f"{from_name} <{from_email}>",
                "to": [to_email],
                "subject": subject,
                "html": html_content
            }
            
            email = resend.Emails.send(params)
            
            logger.info(f"✓ Email enviado con Resend a {to_email} (ID: {email.get('id')})")
            return {
                'success': True,
                'provider': 'resend',
                'email_id': email.get('id')
            }
            
        except Exception as e:
            logger.error(f"Error Resend: {e}")
            return {
                'success': False,
                'provider': 'resend',
                'error': str(e)
            }


# ============================================================================
# INSTANCIA GLOBAL
# ============================================================================

_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Obtiene instancia global del servicio de email."""
    global _email_service
    
    if _email_service is None:
        _email_service = EmailService()
    
    return _email_service