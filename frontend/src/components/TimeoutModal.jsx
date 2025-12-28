import React from 'react'

const TimeoutModal = ({ timeoutInfo, onRetry, onCancel }) => {
  if (!timeoutInfo) return null

  const getTitle = () => {
    switch (timeoutInfo.type) {
      case 'timeout_total':
        return 'Tiempo agotado'
      case 'timeout_inactividad':
        return 'Sin actividad detectada'
      case 'timeout_secuencia_incorrecta':
        return 'Secuencia incorrecta'
      case 'session_cleaned':
        return 'Sesión finalizada'
      default:
        return 'Verificación detenida'
    }
  }

  const getMessage = () => {
    if (timeoutInfo.message) {
      return timeoutInfo.message
    }

    switch (timeoutInfo.type) {
      case 'timeout_total':
        return `El tiempo máximo de ${timeoutInfo.timeLimit || 45} segundos ha sido excedido`
      case 'timeout_inactividad':
        return `No se detectó mano durante ${timeoutInfo.inactivity_limit || 15} segundos`
      case 'timeout_secuencia_incorrecta':
        return 'Se mantuvo un gesto incorrecto por demasiado tiempo. Verifica tu secuencia registrada.'
      case 'session_cleaned':
        return 'La sesión fue cerrada por timeout'
      default:
        return 'La verificación no pudo completarse'
    }
  }

  const getProgressMessage = () => {
    const captured = timeoutInfo.gesturesCaptured || 0
    const required = timeoutInfo.gesturesRequired || 3
    
    if (captured === 0) {
      return ''
    } else if (captured < required) {
      return `Se capturaron ${captured} de ${required} gestos necesarios`
    }
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Icono y Título */}
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="ml-4 text-xl font-semibold text-gray-900">
            {getTitle()}
          </h3>
        </div>

        {/* Mensaje Principal */}
        <div className="mb-4">
          <p className="text-gray-700 mb-2">
            {getMessage()}
          </p>
          
          {/* Progreso */}
          {getProgressMessage() && (
            <p className="text-sm text-gray-600 mt-2">
              {getProgressMessage()}
            </p>
          )}

          {/* Duración */}
          {timeoutInfo.duration > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              Duración: {timeoutInfo.duration.toFixed(1)} segundos
            </p>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="flex gap-3 mt-6">
        <button
            onClick={onRetry}
            className="flex-1 h-11 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-400/25 hover:shadow-xl hover:shadow-blue-400/35 transition-all duration-300"
        >
            Intentar de nuevo
        </button>
        <button
            onClick={onCancel}
            className="flex-1 h-11 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
        >
            Cancelar
        </button>
        </div>

      </div>
    </div>
  )
}

export default TimeoutModal