"""
Servicio para funcionalidad "Olvidaste tu secuencia"
Maneja envío de OTP, verificación y preparación para re-registro
"""

import logging
from datetime import datetime
from typing import Optional, Dict, Any

from app.core.supabase_biometric_storage import get_biometric_database
from app.core.email_verification import get_email_verification_system

logger = logging.getLogger(__name__)


class ForgotSequenceService:
    """Servicio para recuperación de secuencia de gestos"""
    
    def __init__(self):
        """Inicializa el servicio"""
        self.database = get_biometric_database()
        self.email_service = get_email_verification_system()
        logger.info("ForgotSequenceService inicializado")
    
    def send_otp_for_forgot_sequence(self, email: str) -> Dict[str, Any]:
        """
        Envía código OTP al email del usuario para recuperación de secuencia.
        """
        try:
            email = email.lower().strip()
            logger.info(f"Intentando enviar OTP para forgot sequence: {email}")
            
            # Buscar usuario ACTIVO con ese email
            user = self.database.get_user_by_email(email, active_only=True)
            
            if not user:
                logger.warning(f"No se encontró usuario activo con email: {email}")
                return {
                    'success': False,
                    'message': 'No se encontró un usuario activo con ese email'
                }
            
            logger.info(f"Usuario encontrado: {user.user_id}")
            
            # Generar y enviar OTP (igual que en enrollment)
            success = self.email_service.send_verification_email(
                user_id=user.user_id,
                username=user.username,
                email=email
            )
            
            if not success:
                logger.error(f"Error enviando email con OTP para {email}")
                return {
                    'success': False,
                    'message': 'Error enviando código de verificación'
                }
            
            logger.info(f"Email con OTP enviado exitosamente a: {email}")
            
            return {
                'success': True,
                'message': 'Código enviado correctamente',
                'email': email
            }
            
        except Exception as e:
            logger.error(f"Error enviando OTP para forgot sequence: {e}")
            return {
                'success': False,
                'message': 'Error enviando código de verificación'
            }
    
    def verify_otp_and_get_sequence(self, email: str, otp_code: str) -> Dict[str, Any]:
        """
        Verifica código OTP y retorna información del usuario.
        COPIA EXACTA del patrón de /verify-code que YA FUNCIONA
        """
        try:
            email = email.lower().strip()
            logger.info(f"Verificando OTP para: {email}")
            
            # Validar formato (igual que verify-code existente)
            if not otp_code or len(otp_code) != 6 or not otp_code.isdigit():
                return {
                    'success': False,
                    'message': 'Código inválido. Debe ser de 6 dígitos.'
                }
            
            # Buscar usuario por email
            user = self.database.get_user_by_email(email, active_only=True)
            
            if not user:
                return {
                    'success': False,
                    'message': 'Usuario no encontrado'
                }
            
            # Cargar verificación por user_id (igual que verify-code)
            verification = self.email_service._load_verification(user.user_id)
            
            if not verification:
                return {
                    'success': False,
                    'message': 'No se encontró verificación pendiente.'
                }
            
            # Ya verificado
            if verification.verified:
                return {
                    'success': True,
                    'message': 'Email ya verificado.',
                    'user_id': verification.user_id,
                    'username': user.username,
                    'gesture_sequence': user.gesture_sequence,
                    'can_reenroll': True
                }
            
            # Expirado (igual que verify-code)
            # Expirado (igual que verify-code)
            expires_at = datetime.fromisoformat(verification.expires_at)
            # Remover timezone si existe para comparación
            if expires_at.tzinfo is not None:
                expires_at = expires_at.replace(tzinfo=None)
            if datetime.now() > expires_at:
                return {
                    'success': False,
                    'message': 'Código expirado. Solicita uno nuevo.'
                }
            
            # Verificar código (igual que verify-code)
            if verification.token != otp_code:
                return {
                    'success': False,
                    'message': 'Código incorrecto.'
                }
            
            # Marcar como verificado (igual que verify-code)
            verification.verified = True
            verification.verification_date = datetime.now().isoformat()
            self.email_service._save_verification(verification)
            
            logger.info(f"Código verificado: {verification.email}")
            
            return {
                'success': True,
                'user_id': user.user_id,
                'username': user.username,
                'gesture_sequence': user.gesture_sequence,
                'can_reenroll': True
            }
            
        except Exception as e:
            logger.error(f"Error verificando OTP: {e}")
            return {
                'success': False,
                'message': 'Error verificando código'
            }
    
    def resend_otp_for_forgot_sequence(self, email: str) -> Dict[str, Any]:
        """
        Reenvía código OTP (copia exacta del patrón /resend-code existente)
        """
        try:
            email = email.lower().strip()
            logger.info(f"Intentando reenviar OTP para: {email}")
            
            # Buscar usuario
            user = self.database.get_user_by_email(email, active_only=True)
            
            if not user:
                return {
                    'success': False,
                    'message': 'Usuario no encontrado'
                }
            
            # Cargar verificación existente
            verification = self.email_service._load_verification(user.user_id)
            
            if verification:
                # Verificar cooldown (60 segundos - igual que el existente)
                created_at = datetime.fromisoformat(verification.created_at)
                # Remover timezone si existe
                if created_at.tzinfo is not None:
                    created_at = created_at.replace(tzinfo=None)
                    
                elapsed = (datetime.now() - created_at).total_seconds()
                
                if elapsed < 60:
                    remaining = int(60 - elapsed)
                    return {
                        'success': False,
                        'message': f'Espera {remaining} segundos antes de reenviar'
                    }
            
            # Enviar nuevo código (igual que send_otp)
            success = self.email_service.send_verification_email(
                user_id=user.user_id,
                username=user.username,
                email=email
            )
            
            if not success:
                return {
                    'success': False,
                    'message': 'Error al reenviar el código'
                }
            
            logger.info(f"Código reenviado a: {email}")
            
            return {
                'success': True,
                'message': 'Código reenviado exitosamente'
            }
            
        except Exception as e:
            logger.error(f"Error reenviando código: {e}")
            return {
                'success': False,
                'message': 'Error al reenviar código'
            }
    
    def initiate_reenrollment(self, user_id: str) -> Dict[str, Any]:
        """
        Desactiva usuario actual y prepara datos para re-registro.
        
        Flujo:
        1. Renombra user_id actual agregando _inactive_timestamp
        2. Marca usuario como inactivo (is_active = False)
        3. Actualiza todas las tablas relacionadas con CASCADE
        4. Libera el user_id original para reutilización
        5. Retorna datos necesarios para el nuevo enrollment
        
        Args:
            user_id: ID del usuario actual a desactivar
            
        Returns:
            Dict con:
                - success: bool
                - message: str
                - original_user_id: str (el ID que se reutilizará)
                - user_data: dict (email, phone, age, gender, etc)
                - personality_profile: dict o None
                - reuse_personality: bool
        """
        try:
            print("=" * 80)
            print(f"INICIANDO RE-ENROLLMENT")
            print("=" * 80)
            print(f"Usuario a desactivar: {user_id}")
            logger.info(f"Iniciando proceso de re-registro para: {user_id}")
            
            # Desactivar usuario y renombrar su ID
            result = self.database.deactivate_user_and_rename(
                user_id, 
                reason="forgot_sequence_reenroll"
            )
            
            # ============================================================================
            # LIMPIAR EMAIL DEL USUARIO INACTIVO PARA LIBERAR CONSTRAINT
            # ============================================================================
            try:
                inactive_user_id = result['new_inactive_id']
                
                # Generar email fake único para el usuario inactivo
                fake_email = f"{inactive_user_id}@inactive.deleted"
                
                # Actualizar email del usuario inactivo para liberar constraint
                self.database.supabase.table('users').update({
                    'email': fake_email,
                    'updated_at': datetime.now().isoformat()
                }).eq('user_id', inactive_user_id).execute()
                
                print(f"✓ Email del usuario inactivo cambiado a: {fake_email}")
                logger.info(f"Email del usuario inactivo actualizado para permitir re-registro")
                
            except Exception as e:
                print(f"Error limpiando email del usuario inactivo: {e}")
                logger.warning(f"Error limpiando email del usuario inactivo: {e}")
                # No fallar, continuar
                
            
            if not result['success']:
                print(f"ERROR: No se pudo desactivar usuario {user_id}")
                logger.error(f"Error desactivando usuario {user_id}")
                return {
                    'success': False,
                    'message': 'Error desactivando usuario'
                }
            
            print(f"Usuario desactivado exitosamente:")
            print(f"   ID original: {result['original_user_id']}")
            print(f"   ID inactivo: {result['new_inactive_id']}")
            logger.info(f"Usuario desactivado: {user_id} -> {result['new_inactive_id']}")
            logger.info(f"ID original liberado: {result['original_user_id']}")
            
            # Convertir personality profile a dict si existe
            personality_profile_dict = None
            if result.get('personality_profile'):
                try:
                    personality_profile_dict = result['personality_profile'].to_dict()
                    print(f"Perfil de personalidad obtenido para reutilizar")
                    logger.info(f"Perfil de personalidad obtenido para reutilizar")
                except Exception as e:
                    print(f"Error convirtiendo perfil de personalidad: {e}")
                    logger.warning(f"Error convirtiendo perfil de personalidad a dict: {e}")
            else:
                print(f"No hay perfil de personalidad para reutilizar")
            
            print("=" * 80)
            print(f"RE-ENROLLMENT PREPARADO")
            print("=" * 80)
            print(f"ID que se reutilizará: {result['original_user_id']}")
            print(f"Email: {result['user_data'].get('email')}")
            print(f"Username: {result['user_data'].get('username')}")
            print(f"Reutilizar personalidad: {personality_profile_dict is not None}")
            print("=" * 80)
            
            # Retornar datos para el nuevo enrollment
            return {
                'success': True,
                'message': 'Usuario desactivado. Listo para re-registro',
                'original_user_id': result['original_user_id'],  # ID que se reutilizará
                'user_data': result['user_data'],  # email, phone, age, gender, username, gesture_sequence
                'personality_profile': personality_profile_dict,  # Perfil a reutilizar
                'reuse_personality': personality_profile_dict is not None
            }
            
        except ValueError as e:
            print(f"ERROR DE VALIDACIÓN: {e}")
            logger.error(f"Error de validación en reenrollment: {e}")
            return {
                'success': False,
                'message': str(e)
            }
        except Exception as e:
            print(f"ERROR CRÍTICO: {e}")
            logger.error(f"Error iniciando reenrollment: {e}")
            import traceback
            print(f"Traceback:")
            traceback.print_exc()
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                'success': False,
                'message': 'Error preparando re-registro'
            }


_forgot_sequence_service = None

def get_forgot_sequence_service() -> ForgotSequenceService:
    """Obtiene instancia global del servicio"""
    global _forgot_sequence_service
    
    if _forgot_sequence_service is None:
        _forgot_sequence_service = ForgotSequenceService()
    
    return _forgot_sequence_service