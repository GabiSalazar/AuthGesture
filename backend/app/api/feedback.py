"""
Endpoints para gestión de feedback de autenticación
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from typing import Optional
import logging

from app.services.authentication_feedback_service import get_feedback_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.get("/confirm", response_class=HTMLResponse)
async def confirm_feedback(
    token: str = Query(..., description="Token único del intento de autenticación"),
    response: str = Query(..., description="Respuesta del usuario: 'was_me' o 'not_me'")
):
    """
    Endpoint para recibir confirmación de feedback del usuario.
    
    Este endpoint es llamado cuando el usuario hace click en los botones del email.
    
    Args:
        token: Token único generado al guardar el intento
        response: 'was_me' o 'not_me'
        
    Returns:
        Página HTML de confirmación
    """
    try:
        logger.info(f"📧 Feedback recibido - Token: {token[:20]}..., Respuesta: {response}")
        
        # Validar respuesta
        if response not in ['was_me', 'not_me']:
            raise HTTPException(
                status_code=400,
                detail="Respuesta inválida. Debe ser 'was_me' o 'not_me'"
            )
        
        # Obtener servicio
        service = get_feedback_service()
        
        # Verificar que el intento existe
        attempt = service.get_attempt_by_token(token)
        if not attempt:
            logger.warning(f"⚠️ Token no encontrado: {token}")
            return _generate_error_page("Token inválido o expirado")
        
        # Verificar si ya tiene feedback
        if attempt.get('user_feedback'):
            logger.info(f"ℹ️ Intento ya tiene feedback: {attempt['user_feedback']}")
            return _generate_already_responded_page()
        
        # Actualizar feedback
        success = service.update_user_feedback(token, response)
        
        if success:
            logger.info(f"✅ Feedback guardado exitosamente")
            
            # Determinar tipo de feedback para mensaje personalizado
            was_correct = (
                (attempt['system_decision'] == 'authenticated' and response == 'was_me') or
                (attempt['system_decision'] == 'rejected' and response == 'not_me')
            )
            
            return _generate_success_page(response, was_correct)
        else:
            logger.error(f"❌ Error guardando feedback")
            return _generate_error_page("Error al procesar tu respuesta")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error procesando feedback: {e}")
        return _generate_error_page("Error interno del servidor")


@router.get("/metrics/verification")
async def get_verification_metrics(user_id: Optional[str] = None):
    """
    Obtiene métricas de verificación (TP, FP, TN, FN).
    
    Args:
        user_id: Filtrar por usuario específico (opcional)
        
    Returns:
        Diccionario con métricas calculadas
    """
    try:
        logger.info(f"📊 Calculando métricas - Usuario: {user_id or 'todos'}")
        
        service = get_feedback_service()
        metrics = service.calculate_metrics(user_id=user_id)
        
        if not metrics:
            return {
                'error': 'No hay datos suficientes para calcular métricas',
                'user_id': user_id,
                'metrics': {}
            }
        
        logger.info(f"✅ Métricas calculadas: Accuracy={metrics.get('accuracy', 0):.2%}")
        
        return {
            'success': True,
            'user_id': user_id,
            'metrics': metrics,
            'interpretation': {
                'true_positives': 'Sistema autenticó correctamente',
                'false_positives': 'Sistema autenticó a impostor',
                'true_negatives': 'Sistema bloqueó impostor correctamente',
                'false_negatives': 'Sistema bloqueó usuario legítimo',
                'accuracy': 'Porcentaje de decisiones correctas',
                'precision': 'De los autenticados, cuántos eran correctos',
                'recall': 'De los intentos legítimos, cuántos fueron autenticados',
                'far': 'Tasa de aceptación falsa',
                'frr': 'Tasa de rechazo falso'
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Error calculando métricas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ====================================================================
# FUNCIONES AUXILIARES PARA GENERAR PÁGINAS HTML
# ====================================================================

def _generate_success_page(response: str, was_correct: bool) -> str:
    """Genera página HTML de éxito."""
    
    if response == 'was_me':
        emoji = "✅"
        title = "Confirmación Recibida"
        message = "Gracias por confirmar que fuiste tú."
    else:
        emoji = "🚨"
        title = "Alerta de Seguridad Recibida"
        message = "Gracias por reportar este intento no autorizado."
    
    accuracy_message = ""
    if was_correct:
        accuracy_message = '<p style="color: #10b981; font-weight: 500;">El sistema funcionó correctamente en este caso.</p>'
    else:
        accuracy_message = '<p style="color: #f59e0b; font-weight: 500;">Estamos mejorando la precisión del sistema con tu feedback.</p>'
    
    return f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }}
            .container {{
                background: white;
                padding: 3rem;
                border-radius: 1rem;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
                max-width: 500px;
            }}
            .emoji {{
                font-size: 4rem;
                margin-bottom: 1rem;
            }}
            h1 {{
                color: #1f2937;
                margin-bottom: 1rem;
                font-size: 1.75rem;
            }}
            p {{
                color: #6b7280;
                line-height: 1.6;
                margin-bottom: 0.5rem;
            }}
            .footer {{
                margin-top: 2rem;
                padding-top: 1rem;
                border-top: 1px solid #e5e7eb;
                color: #9ca3af;
                font-size: 0.875rem;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="emoji">{emoji}</div>
            <h1>{title}</h1>
            <p>{message}</p>
            {accuracy_message}
            <p style="margin-top: 1.5rem;">Tu feedback nos ayuda a mejorar la seguridad del sistema biométrico.</p>
            <div class="footer">
                <p>Auth-Gesture System</p>
                <p>Puedes cerrar esta ventana</p>
            </div>
        </div>
    </body>
    </html>
    """


def _generate_already_responded_page() -> str:
    """Genera página HTML cuando ya se respondió."""
    return """
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ya Respondido</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
                background: white;
                padding: 3rem;
                border-radius: 1rem;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
                max-width: 500px;
            }
            .emoji {
                font-size: 4rem;
                margin-bottom: 1rem;
            }
            h1 {
                color: #1f2937;
                margin-bottom: 1rem;
            }
            p {
                color: #6b7280;
                line-height: 1.6;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="emoji">ℹ️</div>
            <h1>Ya Respondiste</h1>
            <p>Ya registramos tu respuesta anteriormente.</p>
            <p style="margin-top: 1rem;">Puedes cerrar esta ventana.</p>
        </div>
    </body>
    </html>
    """


def _generate_error_page(error_message: str) -> str:
    """Genera página HTML de error."""
    return f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }}
            .container {{
                background: white;
                padding: 3rem;
                border-radius: 1rem;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
                max-width: 500px;
            }}
            .emoji {{
                font-size: 4rem;
                margin-bottom: 1rem;
            }}
            h1 {{
                color: #dc2626;
                margin-bottom: 1rem;
            }}
            p {{
                color: #6b7280;
                line-height: 1.6;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="emoji">❌</div>
            <h1>Error</h1>
            <p>{error_message}</p>
            <p style="margin-top: 1rem;">Si el problema persiste, contacta al administrador.</p>
        </div>
    </body>
    </html>
    """