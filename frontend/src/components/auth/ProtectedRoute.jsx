import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Spinner } from '../ui'
import config from '../../lib/config'

export default function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null)
  const [isVerifying, setIsVerifying] = useState(true)

  useEffect(() => {
    verifyAuth()
  }, [])

  const verifyAuth = async () => {
    try {
      const token = sessionStorage.getItem('admin_token')
      
      if (!token) {
        setIsAuthenticated(false)
        setIsVerifying(false)
        return
      }

      // Verificar token con el backend
      // const response = await fetch('http://localhost:8000/api/v1/admin/verify-token', {
      const response = await fetch(config.endpoints.admin.verifyToken, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      })

      if (response.ok) {
        setIsAuthenticated(true)
      } else {
        // Token inválido o expirado
        sessionStorage.removeItem('admin_token')
        sessionStorage.removeItem('admin_username')
        sessionStorage.removeItem('admin_expires_at')
        setIsAuthenticated(false)
      }
    } catch (error) {
      console.error('Error verificando autenticación:', error)
      setIsAuthenticated(false)
    } finally {
      setIsVerifying(false)
    }
  }

  // Mientras verifica, mostrar spinner
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  // Si no está autenticado, redirigir al login
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }

  // Si está autenticado, mostrar el contenido
  return children
}