"""
Script de prueba para webhook de autenticación
"""
import os
from dotenv import load_dotenv
from app.services.plugin_webhook_service import get_plugin_webhook_service

# Cargar variables de entorno
load_dotenv()

# Configuración desde .env
CALLBACK_URL = os.getenv('TEST_CALLBACK_URL', "https://webhook.site/3a349afb-9d38-4004-a3e0-98a0019068d3")
API_KEY = os.getenv('PLUGIN_API_KEY')

if not API_KEY:
    raise ValueError("❌ PLUGIN_API_KEY no configurado en .env - Agrega PLUGIN_API_KEY=tu_api_key al archivo .env")

# Datos de prueba
user_id = "user_prueba_auth_12345"
email = "test_auth@example.com"
session_token = "AUTH_TOKEN_TEST_999"
authenticated = True
confidence = 0.87

print("=" * 70)
print("🧪 PRUEBA DE WEBHOOK DE AUTENTICACIÓN")
print("=" * 70)
print(f"📤 Enviando a: {CALLBACK_URL}")
print(f"👤 User ID: {user_id}")
print(f"📧 Email: {email}")
print(f"🎫 Token: {session_token}")
print(f"✅ Autenticado: {authenticated}")
print(f"📊 Confianza: {confidence}")
print(f"🔑 API Key: {API_KEY[:20]}..." if len(API_KEY) > 20 else f"🔑 API Key: {API_KEY}")
print("=" * 70)

# Obtener servicio
webhook_service = get_plugin_webhook_service()
webhook_service.set_api_key(API_KEY)

# Enviar
success = webhook_service.send_authentication_result(
    callback_url=CALLBACK_URL,
    user_id=user_id,
    email=email,
    session_token=session_token,
    authenticated=authenticated,
    confidence=confidence
)

print("=" * 70)
if success:
    print("✅ WEBHOOK ENVIADO EXITOSAMENTE")
    print("👉 Revisa webhook.site para ver el resultado")
    print("👉 Deberías ver un JWT firmado en el campo 'jwt'")
else:
    print("❌ ERROR ENVIANDO WEBHOOK")
    print("👉 Revisa los logs arriba")
print("=" * 70)