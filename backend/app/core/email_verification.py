# """
# MÓDULO DE VERIFICACIÓN DE EMAIL
# Sistema para enviar y verificar emails de confirmación usando SendGrid
# """

# import os
# import json
# import secrets
# import hashlib
# from datetime import datetime, timedelta
# from pathlib import Path
# from typing import Optional, Dict, Any
# from dataclasses import dataclass, asdict
# from sendgrid import SendGridAPIClient
# from sendgrid.helpers.mail import Mail, Email, To, Content
# from dotenv import load_dotenv

# # Cargar variables de entorno
# load_dotenv()

# # ============================================================================
# # ESTRUCTURAS DE DATOS
# # ============================================================================

# @dataclass
# class EmailVerificationToken:
#     """Token de verificación de email"""
#     user_id: str
#     email: str
#     token: str
#     created_at: str
#     expires_at: str
#     verified: bool = False
#     verification_date: Optional[str] = None
#     attempts: int = 0
#     max_attempts: int = 3


# @dataclass
# class EmailVerificationResult:
#     """Resultado de verificación"""
#     success: bool
#     message: str
#     user_id: Optional[str] = None
#     email: Optional[str] = None


# # ============================================================================
# # CLASE PRINCIPAL
# # ============================================================================

# class EmailVerificationSystem:
#     """
#     Sistema de verificación de emails con SendGrid
#     """
    
#     def __init__(self):
#         """Inicializa el sistema de verificación"""
        
#         # Configuración desde .env
#         self.api_key = os.getenv('SENDGRID_API_KEY')
#         self.template_id = os.getenv('SENDGRID_TEMPLATE_ID')
#         self.from_email = os.getenv('SENDGRID_FROM_EMAIL', 'noreply@sistemabiometrico.com')
#         self.from_name = os.getenv('SENDGRID_FROM_NAME', 'Sistema Biométrico')
#         self.frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
#         self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
#         self.expiry_minutes = int(os.getenv('EMAIL_VERIFICATION_EXPIRY_MINUTES', '30'))
        
#         # Directorio de verificaciones
#         self.verification_dir = Path(os.getenv('EMAIL_VERIFICATIONS_PATH', 'biometric_data/email_verifications'))
#         self.verification_dir.mkdir(parents=True, exist_ok=True)
        
#         # Cliente SendGrid
#         if not self.api_key:
#             raise ValueError("SENDGRID_API_KEY no está configurada en .env")
        
#         self.sg_client = SendGridAPIClient(self.api_key)
        
#         print("EmailVerificationSystem inicializado")
#         print(f"Email desde: {self.from_email}")
#         print(f" Expiración: {self.expiry_minutes} minutos")
    
#     # ========================================================================
#     # GENERACIÓN DE TOKENS
#     # ========================================================================
    
#     def generate_verification_code(self, user_id: str, email: str) -> EmailVerificationToken:
#         """
#         Genera código de verificación de 6 dígitos
        
#         Args:
#             user_id: ID del usuario
#             email: Email a verificar
            
#         Returns:
#             EmailVerificationToken con código
#         """
#         # Código de 6 dígitos
#         import random
#         code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
        
#         # Timestamps
#         now = datetime.now()
#         expires = now + timedelta(minutes=self.expiry_minutes)
        
#         # Crear estructura
#         verification = EmailVerificationToken(
#             user_id=user_id,
#             email=email.lower().strip(),
#             token=code,  # Ahora es código de 6 dígitos
#             created_at=now.isoformat(),
#             expires_at=expires.isoformat(),
#             verified=False
#         )
        
#         # Guardar en archivo
#         self._save_verification(verification)
        
#         print(f"Código generado para {user_id}: {code}")
#         return verification
    
#     # ========================================================================
#     # ENVÍO DE EMAILS
#     # ========================================================================
    
#     def send_verification_email(self, user_id: str, username: str, email: str) -> bool:
#         """
#         Envía email de verificación con código de 6 dígitos
        
#         Args:
#             user_id: ID del usuario
#             username: Nombre del usuario
#             email: Email destino
            
#         Returns:
#             bool indicando éxito/fallo
#         """
#         try:
#             # Generar código de 6 dígitos
#             verification = self.generate_verification_code(user_id, email)
            
#             # El código a mostrar en el email
#             verification_code = verification.token
            
#             # Construir email HTML con código
#             html_content = self._build_verification_email_html(
#                 username=username,
#                 verification_code=verification_code,
#                 expiry_minutes=self.expiry_minutes
#             )
            
#             # Crear mensaje de SendGrid
#             message = Mail(
#                 from_email=Email(self.from_email, self.from_name),
#                 to_emails=To(email),
#                 subject='Código de Verificación - Auth-Gesture',
#                 html_content=Content("text/html", html_content)
#             )
            
#             # Enviar con SendGrid
#             response = self.sg_client.send(message)
            
#             if response.status_code in [200, 201, 202]:
#                 print(f"Email enviado exitosamente a {email}")
#                 print(f"🔑 Código de verificación: {verification_code}")
#                 return True
#             else:
#                 print(f"Error enviando email: {response.status_code}")
#                 return False
                
#         except Exception as e:
#             print(f"Error en send_verification_email: {e}")
#             return False
    
#     # ========================================================================
#     # VERIFICACIÓN DE TOKENS
#     # ========================================================================
    
#     def verify_token(self, token: str) -> EmailVerificationResult:
#         """
#         Verifica token de email
        
#         Args:
#             token: Token a verificar
            
#         Returns:
#             EmailVerificationResult con resultado
#         """
#         try:
#             # Buscar token en archivos
#             verification = self._find_verification_by_token(token)
            
#             if not verification:
#                 return EmailVerificationResult(
#                     success=False,
#                     message="Token inválido o no encontrado"
#                 )
            
#             # Verificar si ya fue usado
#             if verification.verified:
#                 return EmailVerificationResult(
#                     success=False,
#                     message="Este email ya fue verificado anteriormente",
#                     user_id=verification.user_id,
#                     email=verification.email
#                 )
            
#             # Verificar expiración
#             expires_at = datetime.fromisoformat(verification.expires_at)
#             if datetime.now() > expires_at:
#                 return EmailVerificationResult(
#                     success=False,
#                     message="El token ha expirado. Solicita uno nuevo."
#                 )
            
#             # Verificar límite de intentos
#             if verification.attempts >= verification.max_attempts:
#                 return EmailVerificationResult(
#                     success=False,
#                     message="Límite de intentos excedido. Solicita un nuevo token."
#                 )
            
#             # Marcar como verificado
#             verification.verified = True
#             verification.verification_date = datetime.now().isoformat()
#             verification.attempts += 1
            
#             # Guardar cambios
#             self._save_verification(verification)
            
#             print(f"Email verificado exitosamente: {verification.email}")
            
#             return EmailVerificationResult(
#                 success=True,
#                 message="Email verificado exitosamente",
#                 user_id=verification.user_id,
#                 email=verification.email
#             )
            
#         except Exception as e:
#             print(f"Error verificando token: {e}")
#             return EmailVerificationResult(
#                 success=False,
#                 message=f"Error verificando token: {str(e)}"
#             )
    
#     # ========================================================================
#     # VERIFICACIÓN DE ESTADO
#     # ========================================================================
    
#     def is_email_verified(self, user_id: str) -> bool:
#         """
#         Verifica si un usuario tiene email verificado
        
#         Args:
#             user_id: ID del usuario
            
#         Returns:
#             bool indicando si está verificado
#         """
#         verification = self._load_verification(user_id)
#         if verification:
#             return verification.verified
#         return False
    
#     def can_resend_email(self, user_id: str) -> tuple[bool, str]:
#         """
#         Verifica si se puede reenviar email
        
#         Args:
#             user_id: ID del usuario
            
#         Returns:
#             (puede_reenviar, mensaje)
#         """
#         verification = self._load_verification(user_id)
        
#         if not verification:
#             return True, "No hay verificación pendiente"
        
#         if verification.verified:
#             return False, "Email ya verificado"
        
#         # Verificar cooldown (60 segundos)
#         cooldown = int(os.getenv('EMAIL_RESEND_COOLDOWN_SECONDS', '60'))
#         created_at = datetime.fromisoformat(verification.created_at)
#         elapsed = (datetime.now() - created_at).total_seconds()
        
#         if elapsed < cooldown:
#             remaining = int(cooldown - elapsed)
#             return False, f"Espera {remaining} segundos antes de reenviar"
        
#         return True, "Puede reenviar"
    
#     # ========================================================================
#     # PLANTILLA HTML
#     # ========================================================================
    
#     def _build_verification_email_html(self, username: str, verification_code: str, expiry_minutes: int) -> str:
#         """Construye HTML del email con código de verificación - Diseño del sistema"""
        
#         html = f"""
#         <!DOCTYPE html>
#         <html lang="es">
#         <head>
#             <meta charset="UTF-8">
#             <meta name="viewport" content="width=device-width, initial-scale=1.0">
#             <title>Código de Verificación</title>
#         </head>
#         <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #1e3a8a 0%, #0891b2 100%); min-height: 100vh;">
#             <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, #1e3a8a 0%, #0891b2 100%); min-height: 100vh; padding: 40px 20px;">
#                 <tr>
#                     <td align="center">
#                         <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3); overflow: hidden;">
                            
#                             <!-- Header con gradiente -->
#                             <tr>
#                                 <td style="background: linear-gradient(135deg, #1e3a8a 0%, #0891b2 100%); padding: 40px 40px 30px 40px; text-align: center;">
#                                     <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
#                                         Auth-Gesture
#                                     </h1>
#                                     <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px; font-weight: 400;">
#                                         Autenticación Biométrica por Gestos
#                                     </p>
#                                 </td>
#                             </tr>
                            
#                             <!-- Contenido -->
#                             <tr>
#                                 <td style="padding: 50px 40px;">
#                                     <h2 style="margin: 0 0 16px 0; color: #1e293b; font-size: 24px; font-weight: 700;">
#                                         Hola {username}
#                                     </h2>
                                    
#                                     <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
#                                         Para completar tu registro, utiliza el siguiente código de verificación:
#                                     </p>
                                    
#                                     <!-- Código de verificación -->
#                                     <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
#                                         <tr>
#                                             <td align="center" style="padding: 32px 0;">
#                                                 <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0891b2 100%); border-radius: 12px; padding: 24px 40px; display: inline-block;">
#                                                     <p style="margin: 0; color: rgba(255, 255, 255, 0.7); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
#                                                         Código de verificación
#                                                     </p>
#                                                     <p style="margin: 0; color: #ffffff; font-size: 42px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
#                                                         {verification_code}
#                                                     </p>
#                                                 </div>
#                                             </td>
#                                         </tr>
#                                     </table>
                                    
#                                     <!-- Información -->
#                                     <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 24px 0;">
#                                         <p style="margin: 0 0 12px 0; color: #334155; font-size: 14px; line-height: 1.6;">
#                                             <strong style="color: #1e293b;">Importante:</strong> Este código expirará en <strong>{expiry_minutes} minutos</strong>.
#                                         </p>
#                                         <p style="margin: 0; color: #334155; font-size: 14px; line-height: 1.6;">
#                                             Si no solicitaste este código, puedes ignorar este mensaje.
#                                         </p>
#                                     </div>
                                    
#                                     <p style="margin: 24px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
#                                         Una vez verificado, podrás completar tu registro biométrico.
#                                     </p>
#                                 </td>
#                             </tr>
                            
#                             <!-- Footer -->
#                             <tr>
#                                 <td style="background-color: #f8fafc; padding: 30px 40px; border-top: 1px solid #e2e8f0;">
#                                     <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; line-height: 1.5;">
#                                         Este correo fue enviado por <strong style="color: #475569;">Auth-Gesture</strong>
#                                     </p>
#                                     <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
#                                         authgesture.com | Sistema de autenticación biométrica por gestos
#                                     </p>
#                                 </td>
#                             </tr>
                            
#                         </table>
                        
#                         <!-- Texto legal -->
#                         <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin-top: 20px;">
#                             <tr>
#                                 <td style="text-align: center; padding: 0 20px;">
#                                     <p style="margin: 0; color: rgba(255, 255, 255, 0.8); font-size: 12px; line-height: 1.5;">
#                                         Este es un correo automático, por favor no respondas.
#                                     </p>
#                                 </td>
#                             </tr>
#                         </table>
                        
#                     </td>
#                 </tr>
#             </table>
#         </body>
#         </html>
#         """
        
#         return html
    
#     # ========================================================================
#     # PERSISTENCIA
#     # ========================================================================
    
#     def _save_verification(self, verification: EmailVerificationToken):
#         """Guarda verificación en archivo"""
#         file_path = self.verification_dir / f"{verification.user_id}.json"
#         with open(file_path, 'w') as f:
#             json.dump(asdict(verification), f, indent=2)
    
#     def _load_verification(self, user_id: str) -> Optional[EmailVerificationToken]:
#         """Carga verificación desde archivo"""
#         file_path = self.verification_dir / f"{user_id}.json"
#         if not file_path.exists():
#             return None
        
#         try:
#             with open(file_path, 'r') as f:
#                 data = json.load(f)
#                 return EmailVerificationToken(**data)
#         except Exception as e:
#             print(f"Error cargando verificación: {e}")
#             return None
    
#     def _find_verification_by_token(self, token: str) -> Optional[EmailVerificationToken]:
#         """Busca verificación por token"""
#         for file_path in self.verification_dir.glob("*.json"):
#             try:
#                 with open(file_path, 'r') as f:
#                     data = json.load(f)
#                     if data.get('token') == token:
#                         return EmailVerificationToken(**data)
#             except Exception:
#                 continue
#         return None
    
#     def cleanup_expired_verifications(self):
#         """Limpia verificaciones expiradas"""
#         count = 0
#         for file_path in self.verification_dir.glob("*.json"):
#             try:
#                 with open(file_path, 'r') as f:
#                     data = json.load(f)
#                     expires_at = datetime.fromisoformat(data['expires_at'])
#                     if datetime.now() > expires_at and not data.get('verified'):
#                         file_path.unlink()
#                         count += 1
#             except Exception:
#                 continue
        
#         if count > 0:
#             print(f"🗑️  Limpiados {count} tokens expirados")


# # ============================================================================
# # INSTANCIA GLOBAL
# # ============================================================================

# _email_verification_system = None

# def get_email_verification_system() -> EmailVerificationSystem:
#     """Obtiene instancia global del sistema"""
#     global _email_verification_system
#     if _email_verification_system is None:
#         _email_verification_system = EmailVerificationSystem()
#     return _email_verification_system


"""
MÓDULO DE VERIFICACIÓN DE EMAIL CON SUPABASE
Sistema para enviar y verificar emails usando SendGrid + Supabase PostgreSQL
"""

import os
import json
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from dotenv import load_dotenv

# IMPORTAR CLIENTE SUPABASE
from app.core.supabase_client import get_supabase_client

# Cargar variables de entorno
load_dotenv()

# ============================================================================
# ESTRUCTURAS DE DATOS
# ============================================================================

@dataclass
class EmailVerificationToken:
    """Token de verificación de email"""
    user_id: str
    email: str
    token: str
    created_at: str
    expires_at: str
    verified: bool = False
    verification_date: Optional[str] = None
    attempts: int = 0
    max_attempts: int = 3


@dataclass
class EmailVerificationResult:
    """Resultado de verificación"""
    success: bool
    message: str
    user_id: Optional[str] = None
    email: Optional[str] = None


# ============================================================================
# CLASE PRINCIPAL
# ============================================================================

class EmailVerificationSystem:
    """
    Sistema de verificación de emails con SendGrid + Supabase
    """
    
    def __init__(self):
        """Inicializa el sistema de verificación"""
        
        # Configuración desde .env
        self.api_key = os.getenv('SENDGRID_API_KEY')
        self.template_id = os.getenv('SENDGRID_TEMPLATE_ID')
        self.from_email = os.getenv('SENDGRID_FROM_EMAIL', 'noreply@sistemabiometrico.com')
        self.from_name = os.getenv('SENDGRID_FROM_NAME', 'Sistema Biométrico')
        self.frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
        self.expiry_minutes = int(os.getenv('EMAIL_VERIFICATION_EXPIRY_MINUTES', '30'))
        
        # CLIENTE SUPABASE (reemplaza filesystem)
        self.supabase = get_supabase_client()
        
        # Cliente SendGrid
        if not self.api_key:
            raise ValueError("SENDGRID_API_KEY no está configurada en .env")
        
        self.sg_client = SendGridAPIClient(self.api_key)
        
        print("EmailVerificationSystem inicializado con Supabase")
        print(f"Email desde: {self.from_email}")
        print(f" Expiración: {self.expiry_minutes} minutos")
    
    # ========================================================================
    # GENERACIÓN DE TOKENS
    # ========================================================================
    
    def generate_verification_code(self, user_id: str, email: str) -> EmailVerificationToken:
        """
        Genera código de verificación de 6 dígitos
        
        Args:
            user_id: ID del usuario
            email: Email a verificar
            
        Returns:
            EmailVerificationToken con código
        """
        # Código de 6 dígitos
        import random
        code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
        
        # Timestamps
        now = datetime.now()
        expires = now + timedelta(minutes=self.expiry_minutes)
        
        # Crear estructura
        verification = EmailVerificationToken(
            user_id=user_id,
            email=email.lower().strip(),
            token=code,  # Ahora es código de 6 dígitos
            created_at=now.isoformat(),
            expires_at=expires.isoformat(),
            verified=False
        )
        
        # GUARDAR EN SUPABASE
        self._save_verification(verification)
        
        print(f"Código generado para {user_id}: {code}")
        return verification
    
    # ========================================================================
    # ENVÍO DE EMAILS
    # ========================================================================
    
    def send_verification_email(self, user_id: str, username: str, email: str) -> bool:
        """
        Envía email de verificación con código de 6 dígitos
        
        Args:
            user_id: ID del usuario
            username: Nombre del usuario
            email: Email destino
            
        Returns:
            bool indicando éxito/fallo
        """
        try:
            # Generar código de 6 dígitos
            verification = self.generate_verification_code(user_id, email)
            
            # El código a mostrar en el email
            verification_code = verification.token
            
            # Construir email HTML con código
            html_content = self._build_verification_email_html(
                username=username,
                verification_code=verification_code,
                expiry_minutes=self.expiry_minutes
            )
            
            # Crear mensaje de SendGrid
            message = Mail(
                from_email=Email(self.from_email, self.from_name),
                to_emails=To(email),
                subject='Código de Verificación - Auth-Gesture',
                html_content=Content("text/html", html_content)
            )
            
            # Enviar con SendGrid
            response = self.sg_client.send(message)
            
            if response.status_code in [200, 201, 202]:
                print(f"Email enviado exitosamente a {email}")
                print(f"🔑 Código de verificación: {verification_code}")
                return True
            else:
                print(f"Error enviando email: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"Error en send_verification_email: {e}")
            return False
    
    # ========================================================================
    # VERIFICACIÓN DE TOKENS
    # ========================================================================
    
    def verify_token(self, token: str) -> EmailVerificationResult:
        """
        Verifica token de email
        
        Args:
            token: Token a verificar
            
        Returns:
            EmailVerificationResult con resultado
        """
        try:
            # BUSCAR TOKEN EN SUPABASE
            verification = self._find_verification_by_token(token)
            
            if not verification:
                return EmailVerificationResult(
                    success=False,
                    message="Token inválido o no encontrado"
                )
            
            # Verificar si ya fue usado
            if verification.verified:
                return EmailVerificationResult(
                    success=False,
                    message="Este email ya fue verificado anteriormente",
                    user_id=verification.user_id,
                    email=verification.email
                )
            
            # Verificar expiración
            expires_at = datetime.fromisoformat(verification.expires_at)
            if datetime.now() > expires_at:
                return EmailVerificationResult(
                    success=False,
                    message="El token ha expirado. Solicita uno nuevo."
                )
            
            # Verificar límite de intentos
            if verification.attempts >= verification.max_attempts:
                return EmailVerificationResult(
                    success=False,
                    message="Límite de intentos excedido. Solicita un nuevo token."
                )
            
            # Marcar como verificado
            verification.verified = True
            verification.verification_date = datetime.now().isoformat()
            verification.attempts += 1
            
            # GUARDAR CAMBIOS EN SUPABASE
            self._save_verification(verification)
            
            print(f"Email verificado exitosamente: {verification.email}")
            
            return EmailVerificationResult(
                success=True,
                message="Email verificado exitosamente",
                user_id=verification.user_id,
                email=verification.email
            )
            
        except Exception as e:
            print(f"Error verificando token: {e}")
            return EmailVerificationResult(
                success=False,
                message=f"Error verificando token: {str(e)}"
            )
    
    # ========================================================================
    # VERIFICACIÓN DE ESTADO
    # ========================================================================
    
    def is_email_verified(self, user_id: str) -> bool:
        """
        Verifica si un usuario tiene email verificado
        
        Args:
            user_id: ID del usuario
            
        Returns:
            bool indicando si está verificado
        """
        verification = self._load_verification(user_id)
        if verification:
            return verification.verified
        return False
    
    def can_resend_email(self, user_id: str) -> tuple[bool, str]:
        """
        Verifica si se puede reenviar email
        
        Args:
            user_id: ID del usuario
            
        Returns:
            (puede_reenviar, mensaje)
        """
        verification = self._load_verification(user_id)
        
        if not verification:
            return True, "No hay verificación pendiente"
        
        if verification.verified:
            return False, "Email ya verificado"
        
        # Verificar cooldown (60 segundos)
        cooldown = int(os.getenv('EMAIL_RESEND_COOLDOWN_SECONDS', '60'))
        created_at = datetime.fromisoformat(verification.created_at)
        elapsed = (datetime.now() - created_at).total_seconds()
        
        if elapsed < cooldown:
            remaining = int(cooldown - elapsed)
            return False, f"Espera {remaining} segundos antes de reenviar"
        
        return True, "Puede reenviar"
    
    # ========================================================================
    # PLANTILLA HTML (IDÉNTICA - NO CAMBIÓ)
    # ========================================================================
    
    def _build_verification_email_html(self, username: str, verification_code: str, expiry_minutes: int) -> str:
        """Construye HTML del email con código de verificación - Diseño del sistema"""
        
        html = f"""
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Código de Verificación</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #1e3a8a 0%, #0891b2 100%); min-height: 100vh;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, #1e3a8a 0%, #0891b2 100%); min-height: 100vh; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3); overflow: hidden;">
                            
                            <!-- Header con gradiente -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #1e3a8a 0%, #0891b2 100%); padding: 40px 40px 30px 40px; text-align: center;">
                                    <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                                        Auth-Gesture
                                    </h1>
                                    <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px; font-weight: 400;">
                                        Autenticación Biométrica por Gestos
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Contenido -->
                            <tr>
                                <td style="padding: 50px 40px;">
                                    <h2 style="margin: 0 0 16px 0; color: #1e293b; font-size: 24px; font-weight: 700;">
                                        Hola {username}
                                    </h2>
                                    
                                    <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                                        Para completar tu registro, utiliza el siguiente código de verificación:
                                    </p>
                                    
                                    <!-- Código de verificación -->
                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                        <tr>
                                            <td align="center" style="padding: 32px 0;">
                                                <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0891b2 100%); border-radius: 12px; padding: 24px 40px; display: inline-block;">
                                                    <p style="margin: 0; color: rgba(255, 255, 255, 0.7); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                                                        Código de verificación
                                                    </p>
                                                    <p style="margin: 0; color: #ffffff; font-size: 42px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                                                        {verification_code}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Información -->
                                    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 24px 0;">
                                        <p style="margin: 0 0 12px 0; color: #334155; font-size: 14px; line-height: 1.6;">
                                            <strong style="color: #1e293b;">Importante:</strong> Este código expirará en <strong>{expiry_minutes} minutos</strong>.
                                        </p>
                                        <p style="margin: 0; color: #334155; font-size: 14px; line-height: 1.6;">
                                            Si no solicitaste este código, puedes ignorar este mensaje.
                                        </p>
                                    </div>
                                    
                                    <p style="margin: 24px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                                        Una vez verificado, podrás completar tu registro biométrico.
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #f8fafc; padding: 30px 40px; border-top: 1px solid #e2e8f0;">
                                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                                        Este correo fue enviado por <strong style="color: #475569;">Auth-Gesture</strong>
                                    </p>
                                    <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                                        authgesture.com | Sistema de autenticación biométrica por gestos
                                    </p>
                                </td>
                            </tr>
                            
                        </table>
                        
                        <!-- Texto legal -->
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin-top: 20px;">
                            <tr>
                                <td style="text-align: center; padding: 0 20px;">
                                    <p style="margin: 0; color: rgba(255, 255, 255, 0.8); font-size: 12px; line-height: 1.5;">
                                        Este es un correo automático, por favor no respondas.
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
        
        return html
    
    # ========================================================================
    # PERSISTENCIA CON SUPABASE (REEMPLAZÓ FILESYSTEM)
    # ========================================================================
    
    # def _save_verification(self, verification: EmailVerificationToken):
    #     """Guarda verificación en Supabase"""
    #     try:
    #         verification_data = {
    #             'user_id': verification.user_id,
    #             'email': verification.email,
    #             'token': verification.token,
    #             'created_at': verification.created_at,
    #             'expires_at': verification.expires_at,
    #             'verified': verification.verified,
    #             'verification_date': verification.verification_date,
    #             'attempts': verification.attempts,
    #             'max_attempts': verification.max_attempts
    #         }
            
    #         # UPSERT EN SUPABASE
    #         self.supabase.table('email_verifications').upsert(
    #             verification_data,
    #             on_conflict='user_id'
    #         ).execute()
            
    #         print(f"Verificación guardada en Supabase para {verification.user_id}")
            
    #     except Exception as e:
    #         print(f"Error guardando verificación en Supabase: {e}")
    #         raise
    
    def _save_verification(self, verification: EmailVerificationToken):
        """Guarda verificación en Supabase"""
        try:
            verification_data = {
                'user_id': verification.user_id,
                'email': verification.email,
                'token': verification.token,
                'created_at': verification.created_at,
                'expires_at': verification.expires_at,
                'verified': verification.verified,
                'verification_date': verification.verification_date,
                'attempts': verification.attempts,
                'max_attempts': verification.max_attempts
            }
            
            # Si está marcando como verified, hacer UPDATE
            if verification.verified and verification.verification_date:
                self.supabase.table('email_verifications')\
                    .update(verification_data)\
                    .eq('user_id', verification.user_id)\
                    .eq('token', verification.token)\
                    .execute()
            else:
                # Crear nueva verificación
                self.supabase.table('email_verifications')\
                    .insert(verification_data)\
                    .execute()
            
            print(f"Verificación guardada en Supabase para {verification.user_id}")
            
        except Exception as e:
            print(f"Error guardando verificación en Supabase: {e}")
            raise
    
    # def _load_verification(self, user_id: str) -> Optional[EmailVerificationToken]:
    #     """Carga verificación desde Supabase"""
    #     try:
    #         # SELECT DESDE SUPABASE
    #         response = self.supabase.table('email_verifications').select('*').eq('user_id', user_id).execute()
            
    #         if not response.data:
    #             return None
            
    #         data = response.data[0]
            
    #         return EmailVerificationToken(
    #             user_id=data['user_id'],
    #             email=data['email'],
    #             token=data['token'],
    #             created_at=data['created_at'],
    #             expires_at=data['expires_at'],
    #             verified=data.get('verified', False),
    #             verification_date=data.get('verification_date'),
    #             attempts=data.get('attempts', 0),
    #             max_attempts=data.get('max_attempts', 3)
    #         )
            
    #     except Exception as e:
    #         print(f"Error cargando verificación desde Supabase: {e}")
    #         return None
    
    def _load_verification(self, user_id: str) -> Optional[EmailVerificationToken]:
        """Carga verificación desde Supabase"""
        try:
            # SELECT DESDE SUPABASE - ORDENAR POR MÁS RECIENTE
            response = self.supabase.table('email_verifications')\
                .select('*')\
                .eq('user_id', user_id)\
                .order('created_at', desc=True)\
                .limit(1)\
                .execute()
            
            if not response.data:
                return None
            
            data = response.data[0]
            
            return EmailVerificationToken(
                user_id=data['user_id'],
                email=data['email'],
                token=data['token'],
                created_at=data['created_at'],
                expires_at=data['expires_at'],
                verified=data.get('verified', False),
                verification_date=data.get('verification_date'),
                attempts=data.get('attempts', 0),
                max_attempts=data.get('max_attempts', 3)
            )
            
        except Exception as e:
            print(f"Error cargando verificación desde Supabase: {e}")
            return None
    
    def _find_verification_by_token(self, token: str) -> Optional[EmailVerificationToken]:
        """Busca verificación por token en Supabase"""
        try:
            # SELECT POR TOKEN EN SUPABASE
            response = self.supabase.table('email_verifications').select('*').eq('token', token).execute()
            
            if not response.data:
                return None
            
            data = response.data[0]
            
            return EmailVerificationToken(
                user_id=data['user_id'],
                email=data['email'],
                token=data['token'],
                created_at=data['created_at'],
                expires_at=data['expires_at'],
                verified=data.get('verified', False),
                verification_date=data.get('verification_date'),
                attempts=data.get('attempts', 0),
                max_attempts=data.get('max_attempts', 3)
            )
            
        except Exception as e:
            print(f"Error buscando token en Supabase: {e}")
            return None
    
    def cleanup_expired_verifications(self):
        """Limpia verificaciones expiradas de Supabase"""
        try:
            now = datetime.now().isoformat()
            
            # DELETE DESDE SUPABASE
            response = self.supabase.table('email_verifications').delete().lt('expires_at', now).eq('verified', False).execute()
            
            count = len(response.data) if response.data else 0
            
            if count > 0:
                print(f"🗑️  Limpiados {count} tokens expirados desde Supabase")
            
        except Exception as e:
            print(f"Error limpiando verificaciones en Supabase: {e}")


# ============================================================================
# INSTANCIA GLOBAL
# ============================================================================

_email_verification_system = None

def get_email_verification_system() -> EmailVerificationSystem:
    """Obtiene instancia global del sistema"""
    global _email_verification_system
    if _email_verification_system is None:
        _email_verification_system = EmailVerificationSystem()
    return _email_verification_system