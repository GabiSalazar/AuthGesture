"""
EMAIL VERIFICATION SERVICE
Maneja códigos OTP para verificación de email usando Supabase
"""

import logging
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

try:
    from app.core.supabase_client import get_supabase_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logger.warning("Supabase no disponible para EmailVerificationService")


class EmailVerificationService:
    """Servicio para gestionar verificación de email con OTP."""
    
    def __init__(self):
        """Inicializa el servicio."""
        self.supabase_client = None
        
        if SUPABASE_AVAILABLE:
            try:
                self.supabase_client = get_supabase_client()
                logger.info("EmailVerificationService inicializado con Supabase")
            except Exception as e:
                logger.error(f"Error conectando a Supabase: {e}")
    
    def generate_otp(self, length: int = 6) -> str:
        """
        Genera un código OTP aleatorio.
        
        Args:
            length: Longitud del código (default: 6)
        
        Returns:
            Código OTP numérico
        """
        return ''.join(secrets.choice(string.digits) for _ in range(length))
    
    def create_verification(self, user_id: str, email: str) -> Optional[str]:
        """
        Crea un nuevo registro de verificación con OTP.
        
        Args:
            user_id: ID del usuario
            email: Email a verificar
        
        Returns:
            Código OTP generado o None si hay error
        """
        try:
            if not self.supabase_client:
                logger.error("Supabase no disponible")
                return None
            
            # Generar OTP
            otp_code = self.generate_otp()
            
            # Calcular expiración (10 minutos)
            expires_at = datetime.now() + timedelta(minutes=10)
            
            # Insertar en Supabase
            data = {
                'user_id': user_id,
                'email': email,
                'otp_code': otp_code,
                'expires_at': expires_at.isoformat(),
                'verified': False,
                'attempts': 0
            }
            
            result = self.supabase_client.table('email_verifications')\
                .insert(data)\
                .execute()
            
            logger.info(f"✅ Verificación creada para {email}")
            logger.info(f"   OTP: {otp_code}")
            logger.info(f"   Expira: {expires_at}")
            
            return otp_code
            
        except Exception as e:
            logger.error(f"Error creando verificación: {e}")
            return None
    
    def verify_otp(self, email: str, otp_code: str) -> Dict[str, Any]:
        """
        Verifica un código OTP.
        
        Args:
            email: Email a verificar
            otp_code: Código OTP ingresado
        
        Returns:
            Dict con resultado de verificación
        """
        try:
            if not self.supabase_client:
                return {
                    'success': False,
                    'error': 'Supabase no disponible'
                }
            
            # Buscar registro más reciente no verificado
            result = self.supabase_client.table('email_verifications')\
                .select('*')\
                .eq('email', email)\
                .eq('verified', False)\
                .order('created_at', desc=True)\
                .limit(1)\
                .execute()
            
            if not result.data:
                return {
                    'success': False,
                    'error': 'No hay verificación pendiente para este email'
                }
            
            verification = result.data[0]
            
            # Verificar expiración
            expires_at = datetime.fromisoformat(verification['expires_at'])
            if datetime.now() > expires_at:
                return {
                    'success': False,
                    'error': 'El código ha expirado. Solicita uno nuevo.'
                }
            
            # Verificar intentos
            if verification['attempts'] >= 3:
                return {
                    'success': False,
                    'error': 'Máximo de intentos alcanzado. Solicita un nuevo código.'
                }
            
            # Verificar código
            if verification['otp_code'] != otp_code:
                # Incrementar contador de intentos
                self.supabase_client.table('email_verifications')\
                    .update({'attempts': verification['attempts'] + 1})\
                    .eq('id', verification['id'])\
                    .execute()
                
                remaining = 3 - (verification['attempts'] + 1)
                return {
                    'success': False,
                    'error': f'Código incorrecto. Te quedan {remaining} intentos.'
                }
            
            # ✅ CÓDIGO CORRECTO
            # Marcar como verificado
            self.supabase_client.table('email_verifications')\
                .update({
                    'verified': True,
                    'verified_at': datetime.now().isoformat()
                })\
                .eq('id', verification['id'])\
                .execute()
            
            # Actualizar user_profile
            self.supabase_client.table('user_profiles')\
                .update({'email_verified': True})\
                .eq('user_id', verification['user_id'])\
                .execute()
            
            logger.info(f"✅ Email verificado exitosamente: {email}")
            
            return {
                'success': True,
                'user_id': verification['user_id'],
                'message': 'Email verificado exitosamente'
            }
            
        except Exception as e:
            logger.error(f"Error verificando OTP: {e}")
            return {
                'success': False,
                'error': f'Error del servidor: {str(e)}'
            }
    
    def get_verification_status(self, email: str) -> Dict[str, Any]:
        """
        Obtiene el estado de verificación de un email.
        
        Args:
            email: Email a consultar
        
        Returns:
            Dict con estado de verificación
        """
        try:
            if not self.supabase_client:
                return {'verified': False, 'error': 'Supabase no disponible'}
            
            # Buscar verificación más reciente
            result = self.supabase_client.table('email_verifications')\
                .select('*')\
                .eq('email', email)\
                .order('created_at', desc=True)\
                .limit(1)\
                .execute()
            
            if not result.data:
                return {
                    'verified': False,
                    'has_pending': False
                }
            
            verification = result.data[0]
            
            return {
                'verified': verification['verified'],
                'has_pending': not verification['verified'],
                'expires_at': verification['expires_at'] if not verification['verified'] else None,
                'attempts': verification['attempts'] if not verification['verified'] else 0
            }
            
        except Exception as e:
            logger.error(f"Error obteniendo estado: {e}")
            return {'verified': False, 'error': str(e)}
    
    def resend_otp(self, email: str) -> Optional[str]:
        """
        Reenvía un código OTP (crea uno nuevo).
        
        Args:
            email: Email para reenviar
        
        Returns:
            Nuevo código OTP o None
        """
        try:
            if not self.supabase_client:
                return None
            
            # Obtener user_id desde email
            user_result = self.supabase_client.table('user_profiles')\
                .select('user_id')\
                .eq('email', email)\
                .execute()
            
            if not user_result.data:
                logger.error(f"No se encontró usuario con email {email}")
                return None
            
            user_id = user_result.data[0]['user_id']
            
            # Crear nueva verificación
            return self.create_verification(user_id, email)
            
        except Exception as e:
            logger.error(f"Error reenviando OTP: {e}")
            return None


# Instancia global
_email_verification_service = None

def get_email_verification_service() -> EmailVerificationService:
    """Obtiene instancia global del servicio."""
    global _email_verification_service
    
    if _email_verification_service is None:
        _email_verification_service = EmailVerificationService()
    
    return _email_verification_service