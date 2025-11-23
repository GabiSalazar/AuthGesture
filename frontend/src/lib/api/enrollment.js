/**
 * API Client para endpoints de enrollment
 * VERSION CORREGIDA - Sin emojis
 */

import apiClient from './client'

export const enrollmentApi = {
  /**
   * Obtiene el estado del modo bootstrap
   * FUNCION CRITICA PARA EL DASHBOARD
   */
  getBootstrapStatus: async () => {
    try {
      const { data } = await apiClient.get('/enrollment/bootstrap/status')
      return data
    } catch (error) {
      console.error('Error obteniendo bootstrap status:', error)
      throw error
    }
  },

  /**
   * Inicia una nueva sesión de enrollment
   */
  startEnrollment: async (username, email, phoneNumber, age, gender, gestureSequence = null) => {
    try {
      const { data } = await apiClient.post('/enrollment/start', {
        username: username,
        email: email,
        phone_number: phoneNumber,
        age: age,
        gender: gender,
        gesture_sequence: gestureSequence
      })
      return data
    } catch (error) {
      console.error('Error iniciando enrollment:', error)
      throw error
    }
  },

  validateUnique: async (field, value) => {
    try {
      const { data } = await apiClient.post('/enrollment/validate-unique', {
        field: field,
        value: value
      })
      return data
    } catch (error) {
      console.error('Error validando campo único:', error)
      throw error
    }
  },

  /**
   * Procesa un frame durante el enrollment
   * IMPORTANTE: frameData debe ser base64 encoded
   */
  processFrame: async (sessionId, frameData) => {
    try {
      const { data } = await apiClient.post('/enrollment/process-frame', {
        session_id: sessionId,
        frame_data: frameData,
        //current_gesture_index: currentGestureIndex
      })
      return data
    } catch (error) {
      console.error('Error procesando frame:', error)
      throw error
    }
  },

  /**
   * Alternativa: Procesar frame usando FormData (Blob)
   * Usa esto si prefieres enviar el frame como archivo
   */
  processFrameBlob: async (sessionId, frameBlob, currentGestureIndex) => {
    try {
      const formData = new FormData()
      formData.append('frame', frameBlob, 'frame.jpg')
      formData.append('session_id', sessionId)
      formData.append('current_gesture_index', currentGestureIndex)
      
      const { data } = await apiClient.post(
        `/enrollment/${sessionId}/frame`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      )
      return data
    } catch (error) {
      console.error('Error procesando frame (blob):', error)
      throw error
    }
  },

  verifyCode: async (userId, code) => {
    try {
      console.log('Verificando código:', { userId, code })
      // Usar URL absoluta porque el router de email no usa /api/v1
      const response = await fetch('http://localhost:8000/api/email/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          code: code
        })
      })
      const data = await response.json()
      console.log('Código verificado:', data)
      return data
    } catch (error) {
      console.error('Error verificando código:', error)
      throw error
    }
  },

  resendCode: async (userId, username, email) => {
    try {
      console.log('🔄 Reenviando código a:', email)
      const response = await fetch('http://localhost:8000/api/email/resend-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          username: username,
          email: email
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error reenviando código')
      }
      
      const data = await response.json()
      console.log('✅ Código reenviado:', data)
      return data
    } catch (error) {
      console.error('❌ Error reenviando código:', error)
      throw error
    }
  },

  /**
   * Obtiene el estado de una sesión de enrollment
   */
  getSessionStatus: async (sessionId) => {
    try {
      const { data } = await apiClient.get(`/enrollment/status/${sessionId}`)
      return data
    } catch (error) {
      console.error('Error obteniendo estado de sesión:', error)
      throw error
    }
  },

  /**
   * Completa una sesión de enrollment
   */
  completeEnrollment: async (sessionId) => {
    try {
      const { data } = await apiClient.post(`/enrollment/complete/${sessionId}`)
      return data
    } catch (error) {
      console.error('Error completando enrollment:', error)
      throw error
    }
  },

  /**
   * Cancela una sesión de enrollment
   */
  cancelEnrollment: async (sessionId) => {
    try {
      const { data } = await apiClient.delete(`/enrollment/cancel/${sessionId}`)
      return data
    } catch (error) {
      console.error('Error cancelando enrollment:', error)
      throw error
    }
  },

  /**
   * Lista todas las sesiones de enrollment activas
   */
  listSessions: async () => {
    try {
      const { data } = await apiClient.get('/enrollment/sessions')
      return data
    } catch (error) {
      console.error('Error listando sesiones:', error)
      throw error
    }
  },

  /**
   * Obtiene los gestos disponibles para enrollment
   */
  getAvailableGestures: async () => {
    try {
      const { data } = await apiClient.get('/enrollment/available-gestures')
      return data
    } catch (error) {
      console.error('Error obteniendo gestos disponibles:', error)
      throw error
    }
  },

  /**
   * Obtiene la configuración de enrollment
   */
  getConfig: async () => {
    try {
      const { data } = await apiClient.get('/enrollment/config')
      return data
    } catch (error) {
      console.error('Error obteniendo configuración:', error)
      throw error
    }
  },

  /**
   * Obtiene estadísticas del sistema de enrollment
   */
  getStats: async () => {
    try {
      const { data } = await apiClient.get('/enrollment/stats')
      return data
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error)
      throw error
    }
  },

  /**
   * Fuerza el entrenamiento (solo para testing/admin)
   */
  forceTraining: async () => {
    try {
      const { data } = await apiClient.post('/enrollment/force-training')
      return data
    } catch (error) {
      console.error('Error forzando entrenamiento:', error)
      throw error
    }
  }
}

// Exportar también como default
export default enrollmentApi