"""
Script de prueba para webhook de autenticación
"""
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Agregar el directorio raíz al path para importar módulos
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.services.plugin_webhook_service import get_plugin_webhook_service

# Configuración desde .env
CALLBACK_URL = os.getenv('TEST_CALLBACK_URL', "https://webhook.site/3a349afb-9d38-4004-a3e0-98a0019068d3")
API_KEY = os.getenv('PLUGIN_API_KEY')

if not API_KEY:
    raise ValueError("ERROR: PLUGIN_API_KEY no configurado en .env")

# Datos de prueba
user_id = "user_prueba_auth_12345"
email = "test_auth@example.com"
session_token = "AUTH_TOKEN_TEST_999"
authenticated = True
confidence = 0.87

def main():
    print("=" * 70)
    print("PRUEBA DE WEBHOOK DE AUTENTICACION")
    print("=" * 70)
    print(f"Enviando a: {CALLBACK_URL}")
    print(f"User ID: {user_id}")
    print(f"Email: {email}")
    print(f"Token: {session_token}")
    print(f"Autenticado: {authenticated}")
    print(f"Confianza: {confidence}")
    print(f"API Key: {API_KEY[:20]}..." if len(API_KEY) > 20 else f"API Key: {API_KEY}")
    print("=" * 70)
    
    try:
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
            print("WEBHOOK ENVIADO EXITOSAMENTE")
            print("Revisa webhook.site para ver el resultado")
            print("Deberias ver un JWT firmado en el campo 'jwt'")
            print("\nPayload esperado:")
            print("   - user_id: string")
            print("   - email: string")
            print("   - session_token: string")
            print("   - authenticated: boolean")
            print("   - confidence: float")
            print("   - timestamp: ISO datetime")
            print("   - jwt: JWT token firmado")
        else:
            print("ERROR ENVIANDO WEBHOOK")
            print("Revisa los logs arriba para mas detalles")
        print("=" * 70)
        
    except Exception as e:
        print("=" * 70)
        print(f"EXCEPCION DURANTE LA PRUEBA: {str(e)}")
        print(f"Tipo: {type(e).__name__}")
        import traceback
        print("\nStack trace completo:")
        traceback.print_exc()
        print("=" * 70)
        sys.exit(1)

if __name__ == "__main__":
    main()