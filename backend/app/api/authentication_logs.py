"""
API Router para Authentication Logs
Endpoints para el panel de administración de autenticaciones
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
import time
import logging

from app.core.supabase_biometric_storage import get_biometric_database

router = APIRouter(prefix="/authentication", tags=["Authentication Logs"])
logger = logging.getLogger(__name__)


@router.get("/all-attempts")
async def get_all_authentication_attempts(
    limit: int = Query(500, ge=1, le=1000, description="Máximo número de intentos a retornar"),
    offset: int = Query(0, ge=0, description="Offset para paginación")
):
    """
    Obtiene TODOS los intentos de autenticación del sistema.
    
    Diseñado para el panel de administración - Tab "Autenticaciones".
    Retorna todos los intentos de todos los usuarios ordenados por timestamp descendente.
    """
    try:
        db = get_biometric_database()
        
        print("\n ENDPOINT /all-attempts LLAMADO")
        print(f"   Limit: {limit}, Offset: {offset}")
        
        #  USAR MÉTODO DIRECTO DE SUPABASE
        logger.info(f"Obteniendo intentos directamente desde Supabase...")
        all_attempts = db.get_all_auth_attempts(limit=None)
        
        print(f"    Intentos retornados del método: {len(all_attempts)}")
        logger.info(f"Total de intentos obtenidos: {len(all_attempts)}")
        
        # Si no hay intentos, devolver respuesta vacía válida
        if len(all_attempts) == 0:
            print("   NONo hay intentos - retornando respuesta vacía")
            return {
                "status": "success",
                "total_attempts": 0,
                "returned_attempts": 0,
                "attempts": [],
                "pagination": {
                    "limit": limit,
                    "offset": offset,
                    "has_more": False
                },
                "message": "No hay intentos de autenticación registrados en el sistema"
            }
        
        # Los intentos ya vienen ordenados por timestamp descendente desde Supabase
        
        # Aplicar limit y offset
        paginated_attempts = all_attempts[offset:offset + limit]
        
        print(f"   Intentos paginados: {len(paginated_attempts)}")
        
        # Formatear datos para el frontend
        attempts_data = []
        for attempt in paginated_attempts:
            try:
                attempts_data.append({
                    "attempt_id": attempt.attempt_id,
                    "user_id": attempt.user_id,
                    "timestamp": attempt.timestamp,
                    "date": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(attempt.timestamp)),
                    "auth_type": attempt.auth_type,
                    "result": attempt.result,
                    "confidence": round(attempt.confidence, 4),
                    "anatomical_score": round(attempt.anatomical_score, 4),
                    "dynamic_score": round(attempt.dynamic_score, 4),
                    "fused_score": round(attempt.fused_score, 4),
                    "ip_address": attempt.ip_address or "N/A",
                    "device_info": attempt.device_info or "N/A",
                    "failure_reason": attempt.failure_reason or None,
                    "metadata": attempt.metadata or {}
                })
            except Exception as format_error:
                logger.error(f"Error formateando intento: {format_error}")
                continue
        
        print(f"    Intentos formateados: {len(attempts_data)}")
        logger.info(f" Retornando {len(attempts_data)} intentos formateados")
        
        return {
            "status": "success",
            "total_attempts": len(all_attempts),
            "returned_attempts": len(attempts_data),
            "attempts": attempts_data,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "has_more": (offset + limit) < len(all_attempts)
            }
        }
        
    except Exception as e:
        print(f"   ERROR en endpoint: {e}")
        logger.error(f"Error obteniendo intentos de autenticación: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/stats")
async def get_authentication_stats():
    """
    Obtiene estadísticas globales de autenticación.
    
    Retorna:
    - Total de intentos
    - Intentos exitosos/fallidos
    - Tasa de éxito
    - Promedio de confidence
    - Distribución por tipo (verification/identification)
    - Intentos en las últimas 24h, 7d, 30d
    """
    try:
        db = get_biometric_database()
        
        #  USAR MÉTODO DIRECTO
        all_attempts = db.get_all_auth_attempts(limit=None)
        
        if len(all_attempts) == 0:
            return {
                "status": "success",
                "total_attempts": 0,
                "successful_attempts": 0,
                "failed_attempts": 0,
                "success_rate": 0,
                "avg_confidence": 0,
                "by_type": {
                    "verification": 0,
                    "identification": 0
                },
                "recent": {
                    "last_24h": 0,
                    "last_7d": 0,
                    "last_30d": 0
                },
                "message": "No hay datos de autenticación"
            }
        
        # Calcular estadísticas
        total = len(all_attempts)
        successful = len([a for a in all_attempts if a.result == 'success'])
        failed = len([a for a in all_attempts if a.result == 'failed'])
        
        # Tasa de éxito
        success_rate = successful / total if total > 0 else 0
        
        # Promedio de confidence
        avg_confidence = sum([a.confidence for a in all_attempts]) / total if total > 0 else 0
        
        # Por tipo
        verifications = len([a for a in all_attempts if a.auth_type == 'verification'])
        identifications = len([a for a in all_attempts if a.auth_type == 'identification'])
        
        # Intentos recientes
        now = time.time()
        last_24h = len([a for a in all_attempts if (now - a.timestamp) <= 86400])  # 24 horas
        last_7d = len([a for a in all_attempts if (now - a.timestamp) <= 604800])  # 7 días
        last_30d = len([a for a in all_attempts if (now - a.timestamp) <= 2592000])  # 30 días
        
        return {
            "status": "success",
            "total_attempts": total,
            "successful_attempts": successful,
            "failed_attempts": failed,
            "success_rate": round(success_rate, 4),
            "avg_confidence": round(avg_confidence, 4),
            "by_type": {
                "verification": verifications,
                "identification": identifications
            },
            "recent": {
                "last_24h": last_24h,
                "last_7d": last_7d,
                "last_30d": last_30d
            }
        }
        
    except Exception as e:
        logger.error(f"Error calculando estadísticas de autenticación: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/all-identification-attempts")
async def get_all_identification_attempts(
    limit: int = Query(500, ge=1, le=1000, description="Máximo número de intentos a retornar")
):
    """
    Obtiene TODOS los intentos de IDENTIFICACIÓN (1:N) del sistema.
    
    Diseñado para el panel de administración - Tab "Autenticaciones".
    """
    try:
        db = get_biometric_database()
        
        logger.info(f"Obteniendo intentos de IDENTIFICACIÓN desde Supabase...")
        all_attempts = db.get_all_identification_attempts(limit=limit)
        
        logger.info(f"Total de intentos de identificación obtenidos: {len(all_attempts)}")
        
        if len(all_attempts) == 0:
            return {
                "status": "success",
                "total_attempts": 0,
                "returned_attempts": 0,
                "attempts": [],
                "message": "No hay intentos de identificación registrados"
            }
        
        # Formatear datos
        attempts_data = []
        for attempt in all_attempts:
            try:
                attempts_data.append({
                    "attempt_id": attempt.attempt_id,
                    "user_id": attempt.user_id,
                    "username": attempt.metadata.get('username', 'Unknown'),
                    "timestamp": attempt.timestamp,
                    "date": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(attempt.timestamp)),
                    "auth_type": "identification",
                    "result": attempt.result,
                    "confidence": round(attempt.confidence, 4),
                    "anatomical_score": round(attempt.anatomical_score, 4),
                    "dynamic_score": round(attempt.dynamic_score, 4),
                    "fused_score": round(attempt.fused_score, 4),
                    "ip_address": attempt.ip_address or "N/A",
                    "device_info": attempt.device_info or "N/A",
                    "gestures_captured": attempt.metadata.get('gestures_captured', []),
                    "all_candidates": attempt.metadata.get('all_candidates', []),
                    "top_match_score": attempt.metadata.get('top_match_score'),
                    "metadata": attempt.metadata
                })
            except Exception as format_error:
                logger.error(f"Error formateando intento: {format_error}")
                continue
        
        logger.info(f" Retornando {len(attempts_data)} intentos de identificación")
        
        return {
            "status": "success",
            "total_attempts": len(all_attempts),
            "returned_attempts": len(attempts_data),
            "attempts": attempts_data
        }
        
    except Exception as e:
        logger.error(f"Error obteniendo intentos de identificación: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/recent")
async def get_recent_authentication_attempts(
    limit: int = Query(10, ge=1, le=50, description="Número de intentos recientes"),
    result: Optional[str] = Query(None, description="Filtrar por resultado: 'success' o 'failed'")
):
    """
    Obtiene los intentos de autenticación más recientes.
    
    Útil para el Dashboard principal - vista rápida de actividad reciente.
    """
    try:
        db = get_biometric_database()
        
        #  USAR MÉTODO DIRECTO
        all_attempts = db.get_all_auth_attempts(limit=None)
        
        # Filtrar por resultado si se especifica
        if result:
            all_attempts = [a for a in all_attempts if a.result == result]
        
        # Ordenar por timestamp descendente
        all_attempts.sort(key=lambda x: x.timestamp, reverse=True)
        
        # Limitar resultados
        recent_attempts = all_attempts[:limit]
        
        # Formatear
        attempts_data = []
        for attempt in recent_attempts:
            attempts_data.append({
                "attempt_id": attempt.attempt_id,
                "user_id": attempt.user_id,
                "timestamp": attempt.timestamp,
                "date": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(attempt.timestamp)),
                "auth_type": attempt.auth_type,
                "result": attempt.result,
                "confidence": round(attempt.confidence, 4),
                "fused_score": round(attempt.fused_score, 4),
                "ip_address": attempt.ip_address or "N/A"
            })
        
        return {
            "status": "success",
            "total_returned": len(attempts_data),
            "attempts": attempts_data
        }
        
    except Exception as e:
        logger.error(f"Error obteniendo intentos recientes: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
