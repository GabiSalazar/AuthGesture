"""
API para gestión y consulta de la Biometric Database.

Incluye endpoints de salud, estadísticas, usuarios, templates,
integridad, backups e información de configuración.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import numpy as np

from app.core.supabase_biometric_storage import (
    get_biometric_database,
    TemplateType,
    BiometricQuality,
    SearchStrategy
)

from app.dependencies.auth import require_admin_token

router = APIRouter(prefix="/biometric-database", tags=["Biometric Database"])

class DatabaseStatsResponse(BaseModel):
    """Respuesta con estadísticas de la base de datos"""
    total_users: int
    total_templates: int
    anatomical_templates: int
    dynamic_templates: int
    multimodal_templates: int
    database_size_mb: float


class UserProfileResponse(BaseModel):
    """Respuesta con perfil de usuario"""
    user_id: str
    username: str
    total_templates: int
    gesture_sequence: List[str]
    total_enrollments: int
    verification_success_rate: float

class UpdateUserRequest(BaseModel):
    """Request para actualizar usuario"""
    username: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    gesture_sequence: Optional[List[str]] = None
    is_active: Optional[bool] = None


@router.get("/health")
async def biometric_database_health_check():
    """Verifica el estado del módulo de Biometric Database"""
    try:
        db = get_biometric_database()
        
        return {
            "status": "healthy",
            "module": "Biometric Database",
            "initialized": True,
            "message": " Módulo 13 cargado correctamente",
            "total_users": len(db.users),
            "total_templates": len(db.templates),
            "database_path": str(db.db_path),
            "encryption_enabled": db.config.get('encryption_enabled', False)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en Biometric Database: {str(e)}")


@router.get("/stats", response_model=DatabaseStatsResponse, dependencies=[Depends(require_admin_token)])
async def get_database_stats():
    """Obtiene estadísticas de la base de datos"""
    try:
        db = get_biometric_database()
        stats = db.get_database_stats()
        
        return {
            "total_users": stats.total_users,
            "total_templates": stats.total_templates,
            "anatomical_templates": stats.anatomical_templates,
            "dynamic_templates": stats.dynamic_templates,
            "multimodal_templates": stats.multimodal_templates,
            "database_size_mb": stats.total_size_mb
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/summary")
async def get_database_summary():
    """Obtiene resumen completo de la base de datos"""
    try:
        db = get_biometric_database()
        summary = db.get_summary()
        
        return {
            "status": "success",
            "summary": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/users", dependencies=[Depends(require_admin_token)])
async def list_all_users(
    search: Optional[str] = None,
    gender: Optional[str] = None,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc"
):
    """
    Lista los usuarios registrados aplicando filtros y ordenamiento.

    Args:
        search (str|None): texto para buscar por username o email
        gender (str|None): filtrar por género
        min_age (int|None): edad mínima
        max_age (int|None): edad máxima
        sort_by (str): campo de ordenamiento
        sort_order (str): orden ascendente o descendente

    Returns:
        dict:
            - status (str): estado de la operación
            - total (int): número de usuarios retornados
            - filters_applied (dict): filtros utilizados
            - users (list[dict]): listado de usuarios formateados
    """
    try:
        db = get_biometric_database()
        users = db.list_users()
        
        # ========================================
        # APLICAR FILTROS
        # ========================================
        filtered_users = users
        
        # Filtro de búsqueda por nombre o email
        if search:
            search_lower = search.lower().strip()
            filtered_users = [
                u for u in filtered_users
                if (search_lower in u.username.lower() or 
                    search_lower in (u.email.lower() if hasattr(u, 'email') and u.email else ''))
            ]
        
        # Filtro por género
        if gender:
            filtered_users = [
                u for u in filtered_users 
                if hasattr(u, 'gender') and u.gender == gender
            ]
        
        # Filtro por edad mínima
        if min_age is not None:
            filtered_users = [
                u for u in filtered_users 
                if hasattr(u, 'age') and u.age >= min_age
            ]
        
        # Filtro por edad máxima
        if max_age is not None:
            filtered_users = [
                u for u in filtered_users 
                if hasattr(u, 'age') and u.age <= max_age
            ]
        
        # ========================================
        # ORDENAMIENTO
        # ========================================
        reverse = (sort_order.lower() == "desc")
        
        if sort_by == "username":
            filtered_users.sort(key=lambda u: u.username.lower(), reverse=reverse)
        elif sort_by == "age":
            filtered_users.sort(
                key=lambda u: u.age if hasattr(u, 'age') else 0, 
                reverse=reverse
            )
        elif sort_by == "templates":
            filtered_users.sort(key=lambda u: u.total_templates, reverse=reverse)
        elif sort_by == "last_activity":
            filtered_users.sort(key=lambda u: u.last_activity, reverse=reverse)
        else:  # created_at por defecto
            filtered_users.sort(key=lambda u: u.created_at, reverse=reverse)
        
        # ========================================
        # FORMATEAR RESPUESTA
        # ========================================
        users_data = []
        for user in filtered_users:
            user_dict = {
                "user_id": user.user_id,
                "username": user.username,
                "email": user.email if hasattr(user, 'email') else None,
                "phone_number": user.phone_number if hasattr(user, 'phone_number') else None,
                "age": user.age if hasattr(user, 'age') else None,
                "gender": user.gender if hasattr(user, 'gender') else None,
                "gesture_sequence": user.gesture_sequence or [],
                "total_templates": user.total_templates,
                "total_enrollments": user.total_enrollments,
                "verification_success_rate": round(user.verification_success_rate, 2),
                "created_at": user.created_at,
                "last_activity": user.last_activity
            }
            users_data.append(user_dict)
        
        return {
            "status": "success",
            "total": len(users_data),
            "filters_applied": {
                "search": search,
                "gender": gender,
                "min_age": min_age,
                "max_age": max_age,
                "sort_by": sort_by,
                "sort_order": sort_order
            },
            "users": users_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/users/{user_id}", dependencies=[Depends(require_admin_token)])
async def get_user_profile(user_id: str):
    """
    Obtiene el perfil detallado de un usuario específico

    Args:
        user_id (str): identificador del usuario

    Returns:
        dict:
            - status (str): estado de la operación
            - user (dict): información completa del usuario
                - user_id (str)
                - username (str)
                - total_templates (int)
                - anatomical_templates (int)
                - dynamic_templates (int)
                - multimodal_templates (int)
                - gesture_sequence (list[str])
                - total_enrollments (int)
                - total_verifications (int)
                - successful_verifications (int)
                - verification_success_rate (float)
                - created_at
                - updated_at
                - last_activity
                - metadata (dict)
    """
    try:
        db = get_biometric_database()
        user = db.get_user(user_id)
        
        if not user:
            raise HTTPException(status_code=404, detail=f"Usuario {user_id} no encontrado")
        
        return {
            "status": "success",
            "user": {
                "user_id": user.user_id,
                "username": user.username,
                "total_templates": user.total_templates,
                "anatomical_templates": len(user.anatomical_templates),
                "dynamic_templates": len(user.dynamic_templates),
                "multimodal_templates": len(user.multimodal_templates),
                "gesture_sequence": user.gesture_sequence or [],
                "total_enrollments": user.total_enrollments,
                "total_verifications": user.total_verifications,
                "successful_verifications": user.successful_verifications,
                "verification_success_rate": user.verification_success_rate,
                "created_at": user.created_at,
                "updated_at": user.updated_at,
                "last_activity": user.last_activity,
                "metadata": user.metadata
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/users/{user_id}/templates", dependencies=[Depends(require_admin_token)])
async def get_user_templates(user_id: str):
    """
    Obtiene los templates biométricos asociados a un usuario.

    Args:
        user_id (str): identificador del usuario

    Returns:
        dict:
            - status (str): estado de la operación
            - user_id (str): id del usuario
            - total_templates (int): número de templates retornados
            - templates (list[dict]): información de los templates del usuario
    """
    try:
        db = get_biometric_database()
        
        user = db.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail=f"Usuario {user_id} no encontrado")
        
        templates = db.list_user_templates(user_id)
        
        templates_data = []
        for template in templates:
            templates_data.append({
                "template_id": template.template_id,
                "template_type": template.template_type.value,
                "gesture_name": template.gesture_name,
                "quality_score": template.quality_score,
                "quality_level": template.quality_level.value,
                "confidence": template.confidence,
                "has_anatomical": template.anatomical_embedding is not None,
                "has_dynamic": template.dynamic_embedding is not None,
                "created_at": template.created_at,
                "verification_count": template.verification_count,
                "success_rate": template.success_rate,
                "is_bootstrap": template.metadata.get('bootstrap_mode', False)
            })
        
        return {
            "status": "success",
            "user_id": user_id,
            "total_templates": len(templates_data),
            "templates": templates_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/templates/{template_id}")
async def get_template_details(template_id: str):
    """
    Obtiene los detalles completos de un template biométrico.

    Args:
        template_id (str): identificador del template

    Returns:
        dict:
            - status (str): estado de la operación
            - template (dict): información detallada del template
    """
    try:
        db = get_biometric_database()
        template = db.get_template(template_id)
        
        if not template:
            raise HTTPException(status_code=404, detail=f"Template {template_id} no encontrado")
        
        return {
            "status": "success",
            "template": {
                "template_id": template.template_id,
                "user_id": template.user_id,
                "template_type": template.template_type.value,
                "gesture_name": template.gesture_name,
                "hand_side": template.hand_side,
                "quality_score": template.quality_score,
                "quality_level": template.quality_level.value,
                "confidence": template.confidence,
                "has_anatomical_embedding": template.anatomical_embedding is not None,
                "has_dynamic_embedding": template.dynamic_embedding is not None,
                "anatomical_embedding_shape": template.anatomical_embedding.shape if template.anatomical_embedding is not None else None,
                "dynamic_embedding_shape": template.dynamic_embedding.shape if template.dynamic_embedding is not None else None,
                "created_at": template.created_at,
                "updated_at": template.updated_at,
                "last_used": template.last_used,
                "enrollment_session": template.enrollment_session,
                "verification_count": template.verification_count,
                "success_count": template.success_count,
                "success_rate": template.success_rate,
                "is_encrypted": template.is_encrypted,
                "checksum": template.checksum,
                "is_bootstrap": template.metadata.get('bootstrap_mode', False),
                "metadata": template.metadata
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.delete("/users/{user_id}", dependencies=[Depends(require_admin_token)])
async def delete_user(user_id: str):
    """
    Elimina un usuario y todos los templates asociados.

    Args:
        user_id (str): identificador del usuario

    Returns:
        dict:
            - status (str): estado de la operación
            - message (str): confirmación de eliminación
    """
    try:
        db = get_biometric_database()
        
        if user_id not in db.users:
            raise HTTPException(status_code=404, detail=f"Usuario {user_id} no encontrado")
        
        success = db.delete_user(user_id)
        
        if success:
            return {
                "status": "success",
                "message": f"Usuario {user_id} eliminado exitosamente"
            }
        else:
            raise HTTPException(status_code=500, detail="Error eliminando usuario")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.patch("/users/{user_id}")
async def update_user(user_id: str, request: UpdateUserRequest):
    """
    Actualiza la información de un usuario.

    Args:
        user_id (str): identificador del usuario
        request (UpdateUserRequest): datos a actualizar

    Returns:
        dict:
            - status (str): estado de la operación
            - message (str): confirmación de actualización
    """
    try:
        db = get_biometric_database()
        
        if user_id not in db.users:
            raise HTTPException(status_code=404, detail=f"Usuario {user_id} no encontrado")
        
        # Preparar updates
        updates = {}
        if request.username is not None:
            updates['username'] = request.username
        if request.email is not None:
            updates['email'] = request.email
        if request.phone_number is not None:
            updates['phone_number'] = request.phone_number
        if request.age is not None:
            updates['age'] = request.age
        if request.gender is not None:
            updates['gender'] = request.gender
        if request.gesture_sequence is not None:
            updates['gesture_sequence'] = request.gesture_sequence
        if request.is_active is not None:
            updates['is_active'] = request.is_active
        
        success = db.update_user(user_id, updates)
        
        if success:
            return {
                "status": "success",
                "message": f"Usuario {user_id} actualizado exitosamente"
            }
        else:
            raise HTTPException(status_code=400, detail="Error actualizando usuario")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/users/{user_id}/auth-attempts", dependencies=[Depends(require_admin_token)])
async def get_user_auth_attempts(user_id: str, limit: int = 50):
    """
    Obtiene el historial de intentos de autenticación de un usuario.

    Args:
        user_id (str): identificador del usuario
        limit (int): número máximo de intentos a retornar

    Returns:
        dict:
            - status (str): estado de la operación
            - user_id (str): id del usuario
            - total_attempts (int): cantidad de intentos retornados
            - attempts (list[dict]): intentos de autenticación formateados
    """
    try:
        import time
        db = get_biometric_database()
        
        if user_id not in db.users:
            raise HTTPException(status_code=404, detail=f"Usuario {user_id} no encontrado")
        
        attempts = db.get_user_auth_attempts(user_id, limit=limit)
        
        print(f"Formateando {len(attempts)} intentos...")
        
        attempts_data = []
        for a in attempts:
            try:
                # Manejar timestamp con seguridad
                timestamp_value = a.timestamp if a.timestamp else time.time()
                date_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(timestamp_value))
                
                attempts_data.append({
                    "attempt_id": str(a.attempt_id) if a.attempt_id else "unknown",
                    "timestamp": timestamp_value,
                    "date": date_str,
                    "auth_type": a.auth_type if a.auth_type else "unknown",
                    "result": a.result if a.result else "failed",
                    "confidence": round(float(a.confidence), 3) if a.confidence is not None else 0.0,
                    "anatomical_score": round(float(a.anatomical_score), 3) if a.anatomical_score is not None else 0.0,
                    "dynamic_score": round(float(a.dynamic_score), 3) if a.dynamic_score is not None else 0.0,
                    "fused_score": round(float(a.fused_score), 3) if a.fused_score is not None else 0.0,
                    "ip_address": a.ip_address if a.ip_address else "N/A",
                    "failure_reason": a.failure_reason if a.failure_reason else None
                })
            except Exception as format_error:
                print(f"Error formateando intento {getattr(a, 'attempt_id', 'unknown')}: {format_error}")
                import traceback
                traceback.print_exc()
                continue
        
        print(f"Intentos formateados exitosamente: {len(attempts_data)}")
        
        return {
            "status": "success",
            "user_id": user_id,
            "total_attempts": len(attempts_data),
            "attempts": attempts_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR EN ENDPOINT: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.delete("/templates/{template_id}", dependencies=[Depends(require_admin_token)])
async def delete_template(template_id: str):
    """
    Elimina un template biométrico específico.

    Args:
        template_id (str): identificador del template

    Returns:
        dict:
            - status (str): estado de la operación
            - message (str): confirmación de eliminación
    """
    try:
        db = get_biometric_database()
        
        if template_id not in db.templates:
            raise HTTPException(status_code=404, detail=f"Template {template_id} no encontrado")
        
        success = db.delete_template(template_id)
        
        if success:
            return {
                "status": "success",
                "message": f"Template {template_id} eliminado exitosamente"
            }
        else:
            raise HTTPException(status_code=500, detail="Error eliminando template")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/bootstrap/stats")
async def get_bootstrap_stats():
    """
    Obtiene estadísticas de los templates en modo Bootstrap.

    Returns:
        dict:
            - status (str): estado de la operación
            - bootstrap_stats (dict): estadísticas generadas por la base
    """
    try:
        db = get_biometric_database()
        stats = db.get_bootstrap_stats()
        
        return {
            "status": "success",
            "bootstrap_stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/bootstrap/templates")
async def get_bootstrap_templates(user_id: Optional[str] = None):
    """
    Obtiene templates biométricos en modo Bootstrap.

    Args:
        user_id (str|None): filtra templates por usuario

    Returns:
        dict:
            - status (str): estado de la operación
            - total_bootstrap_templates (int): número de templates retornados
            - user_filter (str|None): filtro de usuario aplicado
            - templates (list[dict]): templates Bootstrap formateados
    """
    try:
        db = get_biometric_database()
        templates = db.get_bootstrap_templates(user_id)
        
        templates_data = []
        for template in templates:
            templates_data.append({
                "template_id": template.template_id,
                "user_id": template.user_id,
                "gesture_name": template.gesture_name,
                "quality_score": template.quality_score,
                "has_anatomical_raw": template.metadata.get('has_anatomical_raw', False),
                "has_temporal_data": template.metadata.get('has_temporal_data', False),
                "created_at": template.created_at
            })
        
        return {
            "status": "success",
            "total_bootstrap_templates": len(templates_data),
            "user_filter": user_id,
            "templates": templates_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/integrity/verify")
async def verify_database_integrity():
    """
    Verifica la integridad de la base de datos biométrica.

    Returns:
        dict:
            - status (str): estado de la operación
            - integrity_report (dict): resultado de la verificación
    """
    try:
        db = get_biometric_database()
        integrity_report = db.verify_integrity()
        
        return {
            "status": "success",
            "integrity_report": integrity_report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/backup/create")
async def create_database_backup():
    """
    Crea un backup de la base de datos biométrica.

    Returns:
        dict:
            - status (str): estado de la operación
            - message (str): confirmación de creación del backup
    """
    try:
        db = get_biometric_database()
        success = db.create_backup()
        
        if success:
            return {
                "status": "success",
                "message": "Backup creado exitosamente"
            }
        else:
            raise HTTPException(status_code=500, detail="Error creando backup")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/indices/stats")
async def get_indices_stats():
    """
    Obtiene estadísticas de los índices vectoriales biométricos.

    Returns:
        dict:
            - status (str): estado de la operación
            - anatomical_index (dict): estadísticas del índice anatómico
            - dynamic_index (dict): estadísticas del índice dinámico
    """
    try:
        db = get_biometric_database()
        
        anatomical_stats = db.anatomical_index.get_stats()
        dynamic_stats = db.dynamic_index.get_stats()
        
        return {
            "status": "success",
            "anatomical_index": anatomical_stats,
            "dynamic_index": dynamic_stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/config", dependencies=[Depends(require_admin_token)])
async def get_database_config():
    """
    Obtiene la configuración actual de la base de datos biométrica.

    Returns:
        dict:
            - status (str): estado de la operación
            - config (dict): parámetros de configuración expuestos
    """
    try:
        db = get_biometric_database()
        
        return {
            "status": "success",
            "config": {
                "encryption_enabled": db.config.get('encryption_enabled', False),
                "auto_backup": db.config.get('auto_backup', True),
                "search_strategy": db.config.get('search_strategy', 'linear'),
                "max_templates_per_user": db.config.get('max_templates_per_user', 50),
                "debug_mode": db.config.get('debug_mode', False),
                "database_path": str(db.db_path)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    

@router.get("/debug/paths")
async def debug_database_paths():
    """
    Endpoint de depuración para verificar rutas y estado de archivos de la base de datos.

    Returns:
        dict:
            - status (str): estado de la operación
            - database_path (str): ruta relativa de la base
            - database_path_absolute (str): ruta absoluta
            - users_dir (str): directorio de usuarios
            - users_dir_exists (bool): existencia del directorio
            - users_files_count (int): archivos de usuarios
            - templates_dir (str): directorio de templates
            - templates_dir_exists (bool): existencia del directorio
            - templates_files_count (int): archivos de templates
            - users_in_memory (int): usuarios cargados en memoria
            - templates_in_memory (int): templates cargados en memoria
            - current_working_directory (str): directorio de trabajo actual
    """
    try:
        db = get_biometric_database()
        
        import os
        
        return {
            "status": "success",
            "database_path": str(db.db_path),
            "database_path_absolute": str(db.db_path.absolute()),
            "users_dir": str(db.db_path / 'users'),
            "users_dir_exists": (db.db_path / 'users').exists(),
            "users_files_count": len(list((db.db_path / 'users').glob('*.json'))) if (db.db_path / 'users').exists() else 0,
            "templates_dir": str(db.db_path / 'templates'),
            "templates_dir_exists": (db.db_path / 'templates').exists(),
            "templates_files_count": len(list((db.db_path / 'templates').glob('*.json'))) if (db.db_path / 'templates').exists() else 0,
            "users_in_memory": len(db.users),
            "templates_in_memory": len(db.templates),
            "current_working_directory": os.getcwd()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")