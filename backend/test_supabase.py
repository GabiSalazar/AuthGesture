"""
Script de prueba para verificar conexión a Supabase
"""
from app.core.supabase_client import get_supabase_client, test_supabase_connection

print("🧪 Probando conexión a Supabase...")
print("-" * 50)

# Probar conexión
if test_supabase_connection():
    print("✅ ¡Conexión exitosa!")
    print("✅ Cliente de Supabase funcionando correctamente")
else:
    print("❌ Error de conexión")
    print("Verifica tu .env con las credenciales correctas")