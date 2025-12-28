"""
API endpoints para System Logs
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from app.dependencies.auth import require_admin_token
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import os
import re

router = APIRouter(prefix="/logs", tags=["System Logs"])


@router.get("/", dependencies=[Depends(require_admin_token)])
async def get_system_logs(
    level: Optional[str] = Query(None, description="Filtrar por nivel: INFO, WARNING, ERROR"),
    module: Optional[str] = Query(None, description="Filtrar por módulo"),
    limit: int = Query(100, ge=1, le=1000, description="Número de líneas a retornar"),
    search: Optional[str] = Query(None, description="Buscar texto en logs")
):
    """
    Obtiene logs del sistema con filtros opcionales.
    
    Parámetros:
    - level: INFO, WARNING, ERROR, DEBUG
    - module: Nombre del módulo (ej: enrollment, authentication)
    - limit: Máximo de líneas (1-1000)
    - search: Buscar texto específico
    """
    try:
        # Ruta del archivo de logs
        log_file = "biometric_data/logs/system.log"
        
        if not os.path.exists(log_file):
            return {
                "status": "success",
                "logs": [],
                "total": 0,
                "message": "Archivo de log no encontrado"
            }
        
        # Leer archivo de logs
        with open(log_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Procesar y filtrar logs
        logs = []
        for line in lines[-limit*10:]:  # Leer más líneas para luego filtrar
            # Parse log line
            # Formato esperado: 2025-01-13 10:23:45 - module - LEVEL - message
            match = re.match(
                r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*-\s*(\w+)\s*-\s*(\w+)\s*-\s*(.*)',
                line.strip()
            )
            
            if match:
                timestamp, log_module, log_level, message = match.groups()
                
                # Aplicar filtros
                if level and log_level != level.upper():
                    continue
                
                if module and module.lower() not in log_module.lower():
                    continue
                
                if search and search.lower() not in message.lower():
                    continue
                
                logs.append({
                    "timestamp": timestamp,
                    "module": log_module,
                    "level": log_level,
                    "message": message
                })
        
        # Limitar resultados
        logs = logs[-limit:]
        
        return {
            "status": "success",
            "logs": logs,
            "total": len(logs),
            "filters_applied": {
                "level": level,
                "module": module,
                "search": search,
                "limit": limit
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo logs: {str(e)}")


@router.get("/stats", dependencies=[Depends(require_admin_token)])
async def get_log_stats():
    """Obtiene estadísticas de logs"""
    try:
        log_file = "biometric_data/logs/system.log"
        
        if not os.path.exists(log_file):
            return {
                "status": "success",
                "stats": {
                    "total_lines": 0,
                    "file_size_mb": 0,
                    "levels": {}
                }
            }
        
        # Obtener tamaño del archivo
        file_size = os.path.getsize(log_file) / (1024 * 1024)  # MB
        
        # Contar líneas y niveles
        levels = {"INFO": 0, "WARNING": 0, "ERROR": 0, "DEBUG": 0}
        total_lines = 0
        
        with open(log_file, 'r', encoding='utf-8') as f:
            for line in f:
                total_lines += 1
                for level in levels.keys():
                    if level in line:
                        levels[level] += 1
                        break
        
        return {
            "status": "success",
            "stats": {
                "total_lines": total_lines,
                "file_size_mb": round(file_size, 2),
                "levels": levels,
                "file_path": log_file
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo estadísticas: {str(e)}")


@router.delete("/clear", dependencies=[Depends(require_admin_token)])
async def clear_logs():
    """Limpia el archivo de logs (con precaución)"""
    try:
        log_file = "biometric_data/logs/system.log"
        
        if os.path.exists(log_file):
            # Crear backup antes de limpiar
            backup_file = f"{log_file}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            os.rename(log_file, backup_file)
            
            # Crear nuevo archivo vacío
            open(log_file, 'w').close()
            
            return {
                "status": "success",
                "message": "Logs limpiados exitosamente",
                "backup_file": backup_file
            }
        else:
            return {
                "status": "success",
                "message": "No hay logs para limpiar"
            }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error limpiando logs: {str(e)}")