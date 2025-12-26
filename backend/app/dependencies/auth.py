"""
Dependencias de autenticación para proteger endpoints
"""
import os
from fastapi import Header, HTTPException, Depends
from jose import jwt, JWTError
from datetime import datetime

async def require_admin_token(authorization: str = Header(None)):
    """
    Dependency que requiere token JWT válido de administrador.
    
    Uso en endpoints:
        @router.get("/endpoint", dependencies=[Depends(require_admin_token)])
        
    Args:
        authorization: Header Authorization con formato "Bearer <token>"
        
    Returns:
        dict: Payload del JWT decodificado
        
    Raises:
        HTTPException 401: Si el token es inválido o falta
        HTTPException 403: Si el usuario no es admin
    """
    # Verificar que el header exista
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Token de autenticación requerido. Use: Authorization: Bearer <token>"
        )
    
    # Extraer token del header "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Formato de token inválido. Use: Bearer <token>"
        )
    
    token = parts[1]
    
    # Validar JWT
    try:
        # Obtener secret desde variables de entorno
        jwt_secret = os.getenv("ADMIN_JWT_SECRET", "default_secret_change_me")
        
        # Decodificar y verificar token
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        
        # Verificar que no esté expirado (jose ya lo hace automáticamente)
        # Verificar que sea rol admin
        if payload.get("role") != "admin":
            raise HTTPException(
                status_code=403,
                detail="Acceso denegado. Se requiere rol de administrador"
            )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token expirado. Por favor, inicie sesión nuevamente"
        )
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Token inválido"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error validando token: {str(e)}"
        )


# Alias corto para facilitar el uso
RequireAdmin = Depends(require_admin_token)