/**
 * API Client para endpoints de personalidad
 * Integración con backend de perfiles de personalidad
 */

import apiClient from './client'

export const personalityApi = {
  /**
   * Envía las respuestas del cuestionario de personalidad
   * 
   * @param {string} userId - ID del usuario
   * @param {number[]} responses - Array de 10 respuestas (1-5)
   * @returns {Promise<Object>} Confirmación de guardado
   */
  submitQuestionnaire: async (userId, responses) => {
    try {
      console.log(' Enviando cuestionario:', { userId, responses })
      
      const { data } = await apiClient.post('/personality/submit', {
        user_id: userId,
        responses: responses
      })
      
      console.log('Cuestionario guardado:', data)
      return data
      
    } catch (error) {
      console.error('Error enviando cuestionario:', error)
      console.error('   Detalle:', error.response?.data?.detail)
      throw error
    }
  },

  /**
   * Obtiene el perfil de personalidad completo de un usuario
   * 
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object>} Perfil de personalidad
   */
  getProfile: async (userId) => {
    try {
      console.log('📥 Obteniendo perfil de personalidad:', userId)
      
      const { data } = await apiClient.get(`/personality/profile/${userId}`)
      
      console.log('Perfil obtenido:', data)
      return data
      
    } catch (error) {
      console.error('Error obteniendo perfil:', error)
      throw error
    }
  },

  /**
   * Verifica si un usuario tiene perfil de personalidad
   * 
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object>} Estado de completitud
   */
  checkProfile: async (userId) => {
    try {
      console.log('Verificando perfil de personalidad:', userId)
      
      const { data } = await apiClient.get(`/personality/check/${userId}`)
      
      console.log('Verificación:', data)
      return data
      
    } catch (error) {
      console.error('Error verificando perfil:', error)
      throw error
    }
  },

  /**
   * Health check del módulo de personalidad
   * 
   * @returns {Promise<Object>} Estado del módulo
   */
  healthCheck: async () => {
    try {
      const { data } = await apiClient.get('/personality/health')
      return data
    } catch (error) {
      console.error('Error en health check:', error)
      throw error
    }
  }
}

// Exportar también como default
export default personalityApi