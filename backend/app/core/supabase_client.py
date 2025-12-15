"""
Cliente de Supabase para guardar feedback de autenticación
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

# Cargar variables de entorno
load_dotenv()

logger = logging.getLogger(__name__)

# Configuración desde .env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Cliente global (singleton)
_supabase_client: Client = None


def get_supabase_client() -> Client:
    """
    Obtiene cliente de Supabase (singleton).
    
    Returns:
        Cliente de Supabase configurado
        
    Raises:
        ValueError: Si las credenciales no están configuradas
    """
    global _supabase_client
    
    if _supabase_client is None:
        # Validar que existan las credenciales
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError(
                "ERROR: SUPABASE_URL y SUPABASE_KEY deben estar configurados en .env"
            )
        
        # Crear cliente sin opciones adicionales
        try:
            _supabase_client = create_client(
                supabase_url=SUPABASE_URL,
                supabase_key=SUPABASE_KEY
            )
            logger.info("Cliente de Supabase inicializado correctamente")
        except Exception as e:
            logger.error(f"Error creando cliente: {e}")
            raise
    
    return _supabase_client


def test_supabase_connection() -> bool:
    """
    Prueba la conexión a Supabase.
    
    Returns:
        True si la conexión es exitosa
    """
    try:
        client = get_supabase_client()
        # Intentar hacer una query simple
        response = client.table('authentication_attempts').select('id').limit(1).execute()
        logger.info("Conexión a Supabase exitosa")
        return True
    except Exception as e:
        logger.error(f"Error conectando a Supabase: {e}")
        import traceback
        traceback.print_exc()
        return False