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
        title = "Respuesta registrada"
        message = "Tu confirmación ha sido guardada exitosamente."
        detail = "Gracias por ayudarnos a mantener la seguridad de tu cuenta."
        border_color = "#10b981"
        icon_bg = "#ecfdf5"
        icon_color = "#10b981"
    else:
        title = "Alerta recibida"
        message = "Hemos registrado tu reporte de actividad sospechosa."
        detail = "Nuestro equipo de seguridad ha sido notificado."
        border_color = "#ef4444"
        icon_bg = "#fef2f2"
        icon_color = "#ef4444"
    
    return f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
        <style>
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: #f9fafb;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }}
            .card {{
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-top: 4px solid {border_color};
                border-radius: 12px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                max-width: 500px;
                width: 100%;
            }}
            .card-header {{
                padding: 40px 40px 0 40px;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                gap: 20px;
            }}
            .icon-container {{
                flex-shrink: 0;
                width: 56px;
                height: 56px;
                border-radius: 12px;
                background: {icon_bg};
                display: flex;
                align-items: center;
                justify-content: center;
            }}
            .card-body {{
                padding: 24px 40px 40px 40px;
                text-align: center;
            }}
            .title {{
                font-size: 22px;
                font-weight: 600;
                color: #111827;
                margin-bottom: 12px;
                letter-spacing: -0.3px;
            }}
            .message {{
                font-size: 16px;
                color: #374151;
                line-height: 1.6;
                margin-bottom: 12px;
            }}
            .detail {{
                font-size: 14px;
                color: #6b7280;
                line-height: 1.6;
                margin-bottom: 32px;
            }}
            .footer {{
                font-size: 13px;
                color: #9ca3af;
                text-align: center;
                padding-top: 24px;
                border-top: 1px solid #f3f4f6;
            }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="card-header">
                <div class="icon-container">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="{icon_color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <h1 class="title">{title}</h1>
            </div>
            <div class="card-body">
                <p class="message">{message}</p>
                <p class="detail">{detail}</p>
                <div class="footer">
                    Puedes cerrar esta ventana de forma segura
                </div>
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
        <title>Respuesta previa</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: #f9fafb;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .card {
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-top: 4px solid #f59e0b;
                border-radius: 12px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                max-width: 500px;
                width: 100%;
            }
            .card-header {
                padding: 40px 40px 0 40px;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                gap: 20px;
            }
            .icon-container {
                flex-shrink: 0;
                width: 56px;
                height: 56px;
                border-radius: 12px;
                background: #fef3c7;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .card-body {
                padding: 24px 40px 40px 40px;
                text-align: center;
            }
            .title {
                font-size: 22px;
                font-weight: 600;
                color: #111827;
                margin-bottom: 12px;
                letter-spacing: -0.3px;
            }
            .message {
                font-size: 16px;
                color: #374151;
                line-height: 1.6;
                margin-bottom: 12px;
            }
            .detail {
                font-size: 14px;
                color: #6b7280;
                line-height: 1.6;
                margin-bottom: 32px;
            }
            .footer {
                font-size: 13px;
                color: #9ca3af;
                text-align: center;
                padding-top: 24px;
                border-top: 1px solid #f3f4f6;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="card-header">
                <div class="icon-container">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                </div>
                <h1 class="title">Respuesta registrada</h1>
            </div>
            <div class="card-body">
                <p class="message">Este enlace ya fue utilizado anteriormente.</p>
                <p class="detail">Tu respuesta original ha sido guardada y no puede modificarse por seguridad.</p>
                <div class="footer">
                    Puedes cerrar esta ventana de forma segura
                </div>
            </div>
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
        <title>Error de validación</title>
        <style>
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: #f9fafb;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }}
            .card {{
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-top: 4px solid #ef4444;
                border-radius: 12px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                max-width: 500px;
                width: 100%;
            }}
            .card-header {{
                padding: 40px 40px 0 40px;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                gap: 20px;
            }}
            .icon-container {{
                flex-shrink: 0;
                width: 56px;
                height: 56px;
                border-radius: 12px;
                background: #fef2f2;
                display: flex;
                align-items: center;
                justify-content: center;
            }}
            .card-body {{
                padding: 24px 40px 40px 40px;
                text-align: center;
            }}
            .title {{
                font-size: 22px;
                font-weight: 600;
                color: #111827;
                margin-bottom: 12px;
                letter-spacing: -0.3px;
            }}
            .message {{
                font-size: 16px;
                color: #374151;
                line-height: 1.6;
                margin-bottom: 12px;
            }}
            .detail {{
                font-size: 14px;
                color: #6b7280;
                line-height: 1.6;
                margin-bottom: 32px;
            }}
            .footer {{
                font-size: 13px;
                color: #9ca3af;
                text-align: center;
                padding-top: 24px;
                border-top: 1px solid #f3f4f6;
            }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="card-header">
                <div class="icon-container">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                </div>
                <h1 class="title">Error de validación</h1>
            </div>
            <div class="card-body">
                <p class="message">{error_message}</p>
                <p class="detail">Si el problema persiste, contacta al equipo de soporte técnico.</p>
                <div class="footer">
                    Puedes cerrar esta ventana de forma segura
                </div>
            </div>
        </div>
    </body>
    </html>
    """