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
  const [inactiveLoading, setInactiveLoading] = useState(false)
  const [inactiveSuccess, setInactiveSuccess] = useState(false)

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

  const handleMarkInactive = async () => {
    try {
      setInactiveLoading(true)
      setError('')

      // Llamar API para marcar como inactivo
      await adminApi.updateUser(user.user_id, { is_active: false })

      setInactiveSuccess(true)

      // Cerrar modal después de 1.5 segundos
      setTimeout(() => {
        if (onSuccess) onSuccess()
        onClose()
        // Reset estado
        setConfirmText('')
        setInactiveSuccess(false)
      }, 1500)

    } catch (err) {
      console.error('Error marcando usuario como inactivo:', err)
      setError(
        err.response?.data?.detail || 
        'Error al marcar usuario como inactivo. Por favor intenta de nuevo.'
      )
    } finally {
      setInactiveLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading && !inactiveLoading) {
      setConfirmText('')
      setError('')
      setSuccess(false)
      setInactiveSuccess(false)
      onClose()
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onClose={handleClose} size="md">
      <DialogHeader className="bg-gradient-to-r from-[#FEF2F2] to-[#FEE2E2] border-b-2 border-[#FCA5A5]">
        <DialogTitle className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-600">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">Confirmar eliminación</span>
        </DialogTitle>
        <DialogClose onClose={handleClose} />
      </DialogHeader>

      <DialogContent className="space-y-6">
        
        {/* Mensaje de advertencia */}
        <Alert 
          variant="danger" 
          className="flex items-start gap-3 bg-[#FEF2F2] border-2 border-[#FCA5A5] rounded-xl p-4"
        >
          <div>
            <p className="font-semibold text-red-900 mb-1">¡Acción Irreversible!</p>
            <p className="text-sm text-red-800">
              Esta acción eliminará permanentemente al usuario y todos sus datos asociados:
            </p>
          </div>
        </Alert>

        {/* Información del usuario a eliminar */}
        <div className="bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
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

        {/* Mensaje de éxito */}
        {success && (
          <Alert 
            variant="success" 
            className="flex items-center gap-2 bg-[#F0FDF4] border-2 border-[#86EFAC] rounded-xl"
          >
            <span className="text-sm font-medium text-[#065F46]">Usuario eliminado exitosamente</span>
          </Alert>
        )}

        {/* Mensaje de éxito para inactivo */}
        {inactiveSuccess && (
          <Alert 
            variant="success" 
            className="flex items-center gap-2 bg-[#F0FDF4] border-2 border-[#86EFAC] rounded-xl"
          >
            <span className="text-sm font-medium text-[#065F46]">Usuario marcado como inactivo exitosamente</span>
          </Alert>
        )}

        {/* Mensaje de error */}
        {error && (
          <Alert 
            variant="danger" 
            className="flex items-center gap-2 bg-[#FEF2F2] border-2 border-[#FCA5A5] rounded-xl"
          >
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-[#991B1B]">{error}</span>
          </Alert>
        )}

        {/* Input de confirmación */}
        {!success && !inactiveSuccess && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Para confirmar <strong>eliminación permanente</strong>, escribe <span className="font-bold text-red-600">ELIMINAR</span>
            </label>
            <Input
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value)
                setError('')
              }}
              placeholder="Escribe ELIMINAR"
              className={`border-2 rounded-xl transition-all duration-300 ${
                confirmText === 'ELIMINAR' ? 'border-red-500' : 'border-[#E0F2FE]'
              }`}
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2">
              Debes escribir exactamente "ELIMINAR" (en mayúsculas) para habilitar el botón de eliminación.
            </p>
          </div>
        )}
      </DialogContent>

      <DialogFooter className="border-t-2 border-[#E0F2FE] bg-gray-50 flex-col sm:flex-row gap-3">
        {/* Botón Cancelar */}
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={loading || inactiveLoading}
          className="border-2 border-[#E0F2FE] text-gray-600 hover:bg-gray-100 rounded-xl"
        >
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>

        {/* Botón Marcar como Inactivo */}
        <Button
          type="button"
          variant="secondary"
          onClick={handleMarkInactive}
          disabled={inactiveLoading || loading || success || inactiveSuccess}
          className="border-2 rounded-xl font-bold transition-all duration-300 hover:shadow-xl hover:scale-105"
          style={{
            backgroundColor: inactiveLoading || loading || success || inactiveSuccess ? '#9CA3AF' : '#6B7280',
            color: 'white',
            borderColor: '#6B7280',
            boxShadow: inactiveLoading || loading || success || inactiveSuccess
              ? 'none'
              : '0 4px 12px 0 rgba(107, 114, 128, 0.3)'
          }}
          onMouseEnter={(e) => {
            if (!inactiveLoading && !loading && !success && !inactiveSuccess) {
              e.currentTarget.style.backgroundColor = '#4B5563'
              e.currentTarget.style.boxShadow = '0 8px 20px 0 rgba(107, 114, 128, 0.4)'
            }
          }}
          onMouseLeave={(e) => {
            if (!inactiveLoading && !loading && !success && !inactiveSuccess) {
              e.currentTarget.style.backgroundColor = '#6B7280'
              e.currentTarget.style.boxShadow = '0 4px 12px 0 rgba(107, 114, 128, 0.3)'
            }
          }}
        >
          {inactiveLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Marcando...
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 mr-2" />
              Marcar como inactivo
            </>
          )}
        </Button>

        {/* Botón Eliminar (requiere confirmación) */}
        <Button
          type="button"
          variant="danger"
          onClick={handleDelete}
          disabled={loading || confirmText !== 'ELIMINAR' || success || inactiveSuccess}
          className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all duration-300 hover:shadow-xl hover:scale-105"
          style={{
            boxShadow: loading || confirmText !== 'ELIMINAR' || success || inactiveSuccess
              ? 'none'
              : '0 4px 12px 0 rgba(220, 38, 38, 0.4)'
          }}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Eliminando...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar permanentemente
            </>
          )}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}