"""
Script de prueba para webhook del Plugin
Prueba directa sin pasar por todo el flujo
"""
from app.services.plugin_webhook_service import get_plugin_webhook_service

# Configuración de prueba
CALLBACK_URL = "https://webhook.site/3a349afb-9d38-4004-a3e0-98a0019068d3"
API_KEY = "sk_live_009f37683c1868404039fdf3d5c6e28b"

# Datos artificiales
user_id = "user_prueba_artificial_12345"
email = "artificial@test.com"
session_token = "TOKEN_ARTIFICIAL_999"
raw_responses = "5,4,3,5,4,3,5,4,3,5"

print("=" * 70)
print("🧪 PRUEBA DE WEBHOOK CON DATOS ARTIFICIALES")
print("=" * 70)
print(f"📤 Enviando a: {CALLBACK_URL}")
print(f"👤 User ID: {user_id}")
print(f"📧 Email: {email}")
print(f"🎫 Token: {session_token}")
print(f"📊 Respuestas: {raw_responses}")
print("=" * 70)

# Obtener servicio
webhook_service = get_plugin_webhook_service()
webhook_service.set_api_key(API_KEY)

# Enviar
success = webhook_service.send_registration_result(
    callback_url=CALLBACK_URL,
    user_id=user_id,
    email=email,
    session_token=session_token,
    raw_responses=raw_responses
)

print("=" * 70)
if success:
    print("✅ WEBHOOK ENVIADO EXITOSAMENTE")
    print("👉 Revisa webhook.site para ver el resultado")
else:
    print("❌ ERROR ENVIANDO WEBHOOK")
    print("👉 Revisa los logs arriba")
print("=" * 70)