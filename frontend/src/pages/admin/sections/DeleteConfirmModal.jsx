import { useState } from 'react'
import { adminApi } from '../../../lib/api/admin'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
  DialogClose,
  Button,
  Alert,
  Input
} from '../../../components/ui'
import {
  AlertTriangle,
  Trash2,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

export default function DeleteConfirmModal({ user, open, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleDelete = async () => {
    // Validar confirmación
    if (confirmText !== 'ELIMINAR') {
      setError('Debes escribir exactamente "ELIMINAR" para confirmar')
      return
    }

    try {
      setLoading(true)
      setError('')

      // Llamar API para eliminar usuario
      await adminApi.deleteUser(user.user_id)

      setSuccess(true)

      // Cerrar modal después de 1.5 segundos
      setTimeout(() => {
        if (onSuccess) onSuccess()
        onClose()
        // Reset estado
        setConfirmText('')
        setSuccess(false)
      }, 1500)

    } catch (err) {
      console.error('Error eliminando usuario:', err)
      setError(
        err.response?.data?.detail || 
        'Error al eliminar usuario. Por favor intenta de nuevo.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setConfirmText('')
      setError('')
      setSuccess(false)
      onClose()
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onClose={handleClose} size="md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          Confirmar Eliminación
        </DialogTitle>
        <DialogClose onClose={handleClose} />
      </DialogHeader>

      <DialogContent>
        <div className="space-y-6">
          {/* Mensaje de advertencia */}
          <Alert variant="danger" className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">¡Acción Irreversible!</p>
              <p className="text-sm">
                Esta acción eliminará permanentemente al usuario y todos sus datos asociados:
              </p>
            </div>
          </Alert>

          {/* Información del usuario a eliminar */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-3">Usuario a eliminar:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Nombre:</span>
                <span className="font-medium text-gray-900">{user.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium text-gray-900">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">User ID:</span>
                <span className="font-mono text-xs text-gray-900">{user.user_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Templates:</span>
                <span className="font-medium text-gray-900">{user.total_templates}</span>
              </div>
            </div>
          </div>

          {/* Listado de lo que se eliminará */}
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <h4 className="font-semibold text-red-900 mb-2">Se eliminarán:</h4>
            <ul className="space-y-1 text-sm text-red-800">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                Perfil de usuario y datos personales
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                {user.total_templates} templates biométricos (anatómicos y dinámicos)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                Historial de autenticaciones
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                Secuencia de gestos personalizada
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                Estadísticas y métricas asociadas
              </li>
            </ul>
          </div>

          {/* Mensaje de éxito */}
          {success && (
            <Alert variant="success" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Usuario eliminado exitosamente
            </Alert>
          )}

          {/* Mensaje de error */}
          {error && (
            <Alert variant="danger" className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </Alert>
          )}

          {/* Input de confirmación */}
          {!success && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Para confirmar, escribe <span className="font-bold text-red-600">ELIMINAR</span>
              </label>
              <Input
                value={confirmText}
                onChange={(e) => {
                  setConfirmText(e.target.value)
                  setError('')
                }}
                placeholder="Escribe ELIMINAR"
                className={confirmText === 'ELIMINAR' ? 'border-red-500' : ''}
                disabled={loading}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Debes escribir exactamente "ELIMINAR" (en mayúsculas) para habilitar el botón de eliminación.
              </p>
            </div>
          )}
        </div>
      </DialogContent>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={loading}
        >
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={handleDelete}
          disabled={loading || confirmText !== 'ELIMINAR' || success}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Eliminando...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar Definitivamente
            </>
          )}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}