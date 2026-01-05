"""
API Endpoints para gestión del sistema biométrico
VERSIÓN CORREGIDA - SOLO SISTEMA
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional, List

from app.core.system_manager import get_system_manager
from app.dependencies.auth import require_admin_token

router = APIRouter()


class SystemStatusResponse(BaseModel):
    """Response de estado del sistema"""
    initialization_level: str
    users_count: int
    networks_trained: bool
    database_ready: bool
    enrollment_active: bool
    authentication_active: bool
    bootstrap_mode: bool
    can_train: bool  # ← AGREGADO
    uptime: str
    version: str
    status: str
    error_message: Optional[str] = None


class TrainingResponse(BaseModel):
    """Response de entrenamiento"""
    success: bool
    trained: bool
    message: str
    anatomical_trained: bool
    dynamic_trained: bool
    networks_trained: bool
    authentication_active: bool
    bootstrap_mode: bool
    training_details: Optional[Dict[str, Any]] = None

class PendingRetrainResponse(BaseModel):
    """Response de usuarios pendientes de reentrenamiento"""
    pending_count: int
    pending_users: List[Dict[str, Any]]
    can_retrain: bool
    message: str

@router.get("/system/status", response_model=SystemStatusResponse, dependencies=[Depends(require_admin_token)])

async def get_system_status():
    """
    Obtiene el estado actual del sistema.
    
    Returns:
        SystemStatusResponse con información completa del estado
    """
    try:
        manager = get_system_manager()
        status_data = manager.get_system_status()
        
        # Convertir uptime_seconds a string legible
        uptime_seconds = status_data.get('uptime_seconds', 0)
        hours = int(uptime_seconds // 3600)
        minutes = int((uptime_seconds % 3600) // 60)
        seconds = int(uptime_seconds % 60)
        uptime_str = f"{hours}h {minutes}m {seconds}s"
        
        # Determinar si se puede entrenar
        users_count = status_data.get('users_count', 0)
        networks_trained = status_data.get('networks_trained', False)
        can_train = users_count >= 2 and not networks_trained
        
        # Construir response con todos los campos requeridos
        response = SystemStatusResponse(
            status=status_data.get('status', 'unknown'),
            initialization_level=status_data.get('initialization_level', 'NONE'),
            users_count=users_count,
            networks_trained=networks_trained,
            database_ready=status_data.get('database_ready', False),
            enrollment_active=status_data.get('enrollment_active', False),
            authentication_active=status_data.get('authentication_active', False),
            bootstrap_mode=status_data.get('bootstrap_mode', False),
            can_train=can_train,  # ← AGREGADO
            uptime=uptime_str,
            version="2.0.0",
            error_message=status_data.get('error_message')
        )
        
        print(f"System Status: users={users_count}, trained={networks_trained}, can_train={can_train}")
        
        return response
        
    except Exception as e:
        import traceback
        error_detail = f"Error obteniendo estado: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR en get_system_status: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)


@router.get("/system/status/detailed")
async def get_detailed_system_status():
    """
    Obtiene el estado detallado del sistema (sin validación Pydantic).
    Útil para debugging.
    
    Returns:
        Dict con toda la información del sistema
    """
    try:
        manager = get_system_manager()
        status_data = manager.get_system_status()
        
        # Agregar información adicional
        users_count = status_data.get('users_count', 0)
        networks_trained = status_data.get('networks_trained', False)
        
        status_data['version'] = "2.0.0"
        status_data['can_train'] = users_count >= 2 and not networks_trained
        status_data['component_status'] = {
            'camera': 'initialized' if hasattr(manager, 'camera_manager') else 'not_initialized',
            'mediapipe': 'initialized' if hasattr(manager, 'mediapipe_processor') else 'not_initialized',
            'anatomical_network': 'trained' if networks_trained else 'not_trained',
            'dynamic_network': 'trained' if networks_trained else 'not_trained',
            'database': 'ready' if status_data.get('database_ready') else 'not_ready',
            'enrollment': 'active' if status_data.get('enrollment_active') else 'inactive',
            'authentication': 'active' if status_data.get('authentication_active') else 'inactive'
        }
        
        return {
            "success": True,
            "data": status_data
        }
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR en get_detailed_system_status: {error_trace}")
        return {
            "success": False,
            "error": str(e),
            "traceback": error_trace
        }


@router.post("/system/initialize", dependencies=[Depends(require_admin_token)])
async def initialize_system():
    """
    Inicializa el sistema biométrico.
    
    Returns:
        Dict con resultado de la inicialización
    """
    try:
        manager = get_system_manager()
        
        # Verificar si ya está inicializado
        if manager.state.initialization_level.value > 0:
            return {
                "initialized": True,
                "message": "Sistema ya inicializado",
                "level": manager.state.initialization_level.name,
                "level_value": manager.state.initialization_level.value,
                "users_count": manager.state.users_count,
                "can_train": manager.state.users_count >= 2 and not manager.state.networks_trained
            }
        
        # Inicializar sistema
        print("Inicializando sistema...")
        success = manager.initialize_system()
        
        if not success:
            error_msg = manager.state.error_message or "Error inicializando sistema"
            print(f"Error en inicialización: {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
        
        print(f"Sistema inicializado - Nivel: {manager.state.initialization_level.name}")
        
        return {
            "initialized": True,
            "message": "Sistema inicializado exitosamente",
            "level": manager.state.initialization_level.name,
            "level_value": manager.state.initialization_level.value,
            "users_count": manager.state.users_count,
            "enrollment_active": manager.state.enrollment_active,
            "bootstrap_mode": manager.state.bootstrap_mode,
            "can_train": manager.state.users_count >= 2 and not manager.state.networks_trained
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Error en inicialización: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)


@router.post("/system/train", response_model=TrainingResponse, dependencies=[Depends(require_admin_token)])

async def train_networks():
    """
    Entrena las redes neuronales del sistema.
    
    Returns:
        TrainingResponse con resultado del entrenamiento
    """
    try:
        manager = get_system_manager()
        
        print(f"Iniciando entrenamiento - Usuarios: {manager.state.users_count}")
        
        # Verificar que haya suficientes usuarios
        if manager.state.users_count < 2:
            error_msg = f"Se necesitan al menos 2 usuarios registrados. Actualmente: {manager.state.users_count}"
            print(f"{error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Entrenar redes
        result = manager.train_networks()
        
        if not result.get('success', False):
            error_msg = result.get('message', 'Error entrenando redes')
            print(f"Error en entrenamiento: {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
        
        print(f"Entrenamiento exitoso")
        print(f"   - Red anatómica: {result.get('anatomical_trained', False)}")
        print(f"   - Red dinámica: {result.get('dynamic_trained', False)}")
        
        return TrainingResponse(
            success=True,
            trained=True,
            message=result.get('message', 'Redes entrenadas exitosamente'),
            anatomical_trained=result.get('anatomical_trained', False),
            dynamic_trained=result.get('dynamic_trained', False),
            networks_trained=manager.state.networks_trained,
            authentication_active=manager.state.authentication_active,
            bootstrap_mode=manager.state.bootstrap_mode,
            training_details=result.get('details')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Error en entrenamiento: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)


@router.post("/system/retrain", response_model=TrainingResponse)
async def retrain_networks(force: bool = True): 
    """
    Reentrena las redes neuronales.
    
    Args:
        force: Si True, fuerza el reentrenamiento aunque ya estén entrenadas
    
    Returns:
        TrainingResponse con resultado del reentrenamiento
    """
    try:
        manager = get_system_manager()
        
        print(f"Iniciando REENTRENAMIENTO - Usuarios: {manager.state.users_count}, Force: {force}")
        
        # Verificar que haya suficientes usuarios
        if manager.state.users_count < 2:
            error_msg = f"Se necesitan al menos 2 usuarios. Actualmente: {manager.state.users_count}"
            print(f"{error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Reentrenar (siempre con force=True para reentrenamiento)
        result = manager.train_networks(force=force)
        
        if not result.get('success', False):
            error_msg = result.get('message', 'Error reentrenando redes')
            print(f"Error en reentrenamiento: {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
        
        print(f"Reentrenamiento exitoso")
        print(f"   - Red anatómica: {result.get('anatomical_trained', False)}")
        print(f"   - Red dinámica: {result.get('dynamic_trained', False)}")
        
        return TrainingResponse(
            success=True,
            trained=True,
            message=result.get('message', 'Redes reentrenadas exitosamente'),
            anatomical_trained=result.get('anatomical_trained', False),
            dynamic_trained=result.get('dynamic_trained', False),
            networks_trained=manager.state.networks_trained,
            authentication_active=manager.state.authentication_active,
            bootstrap_mode=manager.state.bootstrap_mode,
            training_details=result.get('details')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Error en reentrenamiento: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)

@router.get("/system/pending-retrain", response_model=PendingRetrainResponse)
async def get_pending_retrain_users():
    """
    Obtiene lista de usuarios pendientes de reentrenamiento.
    
    Returns:
        PendingRetrainResponse con usuarios pendientes
    """
    try:
        manager = get_system_manager()
        
        # Verificar que las redes estén entrenadas
        if not manager.state.networks_trained:
            return PendingRetrainResponse(
                pending_count=0,
                pending_users=[],
                can_retrain=False,
                message="Las redes no han sido entrenadas aún"
            )
        
        # Obtener usuarios pendientes
        pending_users = manager.get_pending_retrain_users()
        
        print(f"Usuarios pendientes de reentrenamiento: {len(pending_users)}")
        for user in pending_users:
            print(f"   - {user['username']} ({user['user_id']}): {user['total_templates']} templates")
        
        return PendingRetrainResponse(
            pending_count=len(pending_users),
            pending_users=pending_users,
            can_retrain=len(pending_users) > 0,
            message=f"{len(pending_users)} usuario(s) pendiente(s) de reentrenamiento" if pending_users else "No hay usuarios pendientes"
        )
        
    except Exception as e:
        import traceback
        error_detail = f"Error obteniendo usuarios pendientes: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)

@router.get("/system/modules")
async def get_modules_status():
    """
    Obtiene el estado de todos los módulos del sistema.
    
    Returns:
        Dict con estado de cada módulo
    """
    try:
        manager = get_system_manager()
        
        modules_info = {
            "success": True,
            "modules": manager.state.modules_loaded,
            "total_modules": len(manager.state.modules_loaded),
            "all_loaded": all(manager.state.modules_loaded.values()),
            "modules_detail": []
        }
        
        # Agregar detalles de cada módulo
        for module_name, loaded in manager.state.modules_loaded.items():
            modules_info["modules_detail"].append({
                "name": module_name,
                "loaded": loaded,
                "status": "Cargado" if loaded else "No cargado"
            })
        
        return modules_info
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR en get_modules_status: {error_trace}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/system/statistics", dependencies=[Depends(require_admin_token)])

async def get_system_statistics():
    """
    Obtiene estadísticas del sistema.
    
    Returns:
        Dict con estadísticas de uso
    """
    try:
        manager = get_system_manager()
        status = manager.get_system_status()
        
        # Calcular estadísticas adicionales
        statistics = status.get('statistics', {})
        
        # Agregar info de base de datos
        if hasattr(manager, 'database') and manager.database:
            try:
                users = manager.database.list_users()
                templates_by_user = {}
                total_templates = 0
                
                for user_id in users:
                    templates = manager.database.list_user_templates(user_id)
                    templates_by_user[user_id] = len(templates)
                    total_templates += len(templates)
                
                statistics['templates_by_user'] = templates_by_user
                statistics['total_templates'] = total_templates
                statistics['avg_templates_per_user'] = total_templates / len(users) if users else 0
            except Exception as e:
                print(f"Error calculando estadísticas de templates: {e}")
        
        return {
            "success": True,
            "statistics": statistics,
            "users_count": status.get('users_count', 0),
            "networks_trained": status.get('networks_trained', False),
            "enrollment_active": status.get('enrollment_active', False),
            "authentication_active": status.get('authentication_active', False),
            "can_train": status.get('users_count', 0) >= 2 and not status.get('networks_trained', False)
        }
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR en get_system_statistics: {error_trace}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/system/cleanup")
async def cleanup_resources():
    """
    Limpia recursos del sistema (cámara, MediaPipe, etc).
    
    Returns:
        Dict con resultado de la limpieza
    """
    try:
        print("Limpiando recursos del sistema...")
        manager = get_system_manager()
        manager.cleanup_resources()
        
        print("Recursos limpiados exitosamente")
        
        return {
            "success": True,
            "message": "Recursos limpiados exitosamente"
        }
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR en cleanup_resources: {error_trace}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/system/health")
async def system_health_check():
    """
    Health check básico del sistema.
    
    Returns:
        Dict con estado de salud
    """
    try:
        manager = get_system_manager()
        
        # Sistema saludable si:
        # - Al menos nivel 2 de inicialización
        # - Base de datos lista
        # - Enrollment activo
        is_healthy = (
            manager.state.initialization_level.value >= 2 and
            manager.state.database_ready and
            manager.state.enrollment_active
        )
        
        health_status = {
            "healthy": is_healthy,
            "status": "healthy" if is_healthy else "degraded",
            "initialization_level": manager.state.initialization_level.name,
            "initialization_level_value": manager.state.initialization_level.value,
            "database_ready": manager.state.database_ready,
            "enrollment_active": manager.state.enrollment_active,
            "authentication_active": manager.state.authentication_active,
            "networks_trained": manager.state.networks_trained,
            "users_count": manager.state.users_count,
            "can_train": manager.state.users_count >= 2 and not manager.state.networks_trained,
            "version": "2.0.0",
            "checks": {
                "initialization": manager.state.initialization_level.value >= 2,
                "database": manager.state.database_ready,
                "enrollment": manager.state.enrollment_active,
                "authentication": manager.state.authentication_active
            }
        }
        
        print(f"Health Check - Status: {health_status['status']}")
        
        return health_status
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR en system_health_check: {error_trace}")
        return {
            "healthy": False,
            "status": "error",
            "error": str(e),
            "traceback": error_trace
        }