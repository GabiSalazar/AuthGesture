/**
 * API Client para endpoints del sistema biométrico
 * VERSIÓN COMPLETA CON TODOS LOS ENDPOINTS
 */

import apiClient from './client'

export const systemApi = {
  // ========================================
  // ESTADO Y SALUD DEL SISTEMA
  // ========================================

  /**
   * Obtiene el estado actual del sistema
   */
  getStatus: async () => {
    try {
      const { data } = await apiClient.get('/system/status')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo estado del sistema:', error)
      throw error
    }
  },

  /**
   * Obtiene el estado detallado del sistema (para debugging)
   */
  getDetailedStatus: async () => {
    try {
      const { data } = await apiClient.get('/system/status/detailed')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo estado detallado:', error)
      throw error
    }
  },

  /**
   * Health check del sistema
   */
  getHealth: async () => {
    try {
      const { data } = await apiClient.get('/system/health')
      return data
    } catch (error) {
      console.error('❌ Error en health check:', error)
      throw error
    }
  },

  /**
   * Obtiene estadísticas del sistema
   */
  getStatistics: async () => {
    try {
      const { data } = await apiClient.get('/system/statistics')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error)
      throw error
    }
  },

  /**
   * Obtiene el estado de los módulos del sistema
   */
  getModulesStatus: async () => {
    try {
      const { data } = await apiClient.get('/system/modules')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo estado de módulos:', error)
      throw error
    }
  },

  // ========================================
  // INICIALIZACIÓN Y ENTRENAMIENTO
  // ========================================

  /**
   * Inicializa el sistema biométrico
   */
  initialize: async () => {
    try {
      const { data } = await apiClient.post('/system/initialize')
      return data
    } catch (error) {
      console.error('❌ Error inicializando sistema:', error)
      throw error
    }
  },

  /**
   * Entrena las redes neuronales (primera vez)
   */
  trainNetworks: async () => {
    try {
      const { data } = await apiClient.post('/system/train')
      return data
    } catch (error) {
      console.error('❌ Error entrenando redes:', error)
      throw error
    }
  },

  /**
   * Reentrena las redes neuronales
   * @param {boolean} force - Forzar reentrenamiento aunque ya estén entrenadas
   */
  retrainNetworks: async (force = false) => {
    try {
      const { data } = await apiClient.post(`/system/retrain?force=${force}`)
      return data
    } catch (error) {
      console.error('❌ Error reentrenando redes:', error)
      throw error
    }
  },

  /**
   * Obtiene usuarios pendientes de reentrenamiento
   */
  getPendingRetrainUsers: async () => {
    try {
      const { data } = await apiClient.get('/system/pending-retrain')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo usuarios pendientes:', error)
      throw error
    }
  },

  /**
   * Obtiene umbrales de autenticación del sistema
   */
  getAuthenticationThresholds: async () => {
    try {
      const { data } = await apiClient.get('/score-fusion/authentication-thresholds')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo umbrales de autenticación:', error)
      throw error
    }
  },

  // ========================================
  // MÉTRICAS DE REDES NEURONALES
  // ========================================

  /**
   * Obtiene métricas de la red anatómica
   */
  getAnatomicalNetworkMetrics: async () => {
    try {
      const { data } = await apiClient.get('/siamese-anatomical/metrics')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo métricas de red anatómica:', error)
      throw error
    }
  },

  /**
   * Obtiene métricas de la red dinámica
   */
  getDynamicNetworkMetrics: async () => {
    try {
      const { data } = await apiClient.get('/siamese-dynamic/metrics')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo métricas de red dinámica:', error)
      throw error
    }
  },

  /**
   * Obtiene configuración del sistema de fusión
   */
  getFusionConfig: async () => {
    try {
      const { data } = await apiClient.get('/score-fusion/config')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo configuración de fusión:', error)
      throw error
    }
  },

  /**
   * Obtiene resumen del sistema de fusión
   */
  getFusionSummary: async () => {
    try {
      const { data } = await apiClient.get('/score-fusion/summary')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo resumen de fusión:', error)
      throw error
    }
  },

  /**
   * Obtiene pesos de fusión optimizados
   */
  getFusionWeights: async () => {
    try {
      const { data } = await apiClient.get('/score-fusion/weights')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo pesos de fusión:', error)
      throw error
    }
  },

  /**
   * Limpia recursos del sistema (cámara, MediaPipe, etc)
   */
  cleanupResources: async () => {
    try {
      const { data } = await apiClient.post('/system/cleanup')
      return data
    } catch (error) {
      console.error('❌ Error limpiando recursos:', error)
      throw error
    }
  },

  // ========================================
  // CONFIGURACIÓN DEL SISTEMA
  // ========================================

  /**
   * Obtiene toda la configuración del sistema
   */
  getFullConfig: async () => {
    try {
      const { data } = await apiClient.get('/config/all')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo configuración completa:', error)
      throw error
    }
  },

  /**
   * Obtiene información del sistema
   */
  getSystemInfo: async () => {
    try {
      const { data } = await apiClient.get('/config/system-info')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo información del sistema:', error)
      throw error
    }
  },

  /**
   * Obtiene configuración de captura
   */
  getCaptureSettings: async () => {
    try {
      const { data } = await apiClient.get('/config/capture-settings')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo configuración de captura:', error)
      throw error
    }
  },

  /**
   * Obtiene umbrales de calidad
   */
  getThresholds: async () => {
    try {
      const { data } = await apiClient.get('/config/thresholds')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo umbrales:', error)
      throw error
    }
  },

  /**
   * Obtiene configuración de cámara
   */
  getCameraSettings: async () => {
    try {
      const { data } = await apiClient.get('/config/camera-settings')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo configuración de cámara:', error)
      throw error
    }
  },

  /**
   * Obtiene rutas configuradas
   */
  getPaths: async () => {
    try {
      const { data } = await apiClient.get('/config/paths')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo rutas:', error)
      throw error
    }
  },

  // ========================================
  // LOGS DEL SISTEMA
  // ========================================

  /**
   * Obtiene logs del sistema con filtros
   * @param {Object} filters - Filtros opcionales
   * @param {string} filters.level - INFO, WARNING, ERROR, DEBUG
   * @param {string} filters.module - Nombre del módulo
   * @param {number} filters.limit - Número de líneas (1-1000)
   * @param {string} filters.search - Buscar texto
   */
  getLogs: async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      
      if (filters.level) params.append('level', filters.level)
      if (filters.module) params.append('module', filters.module)
      if (filters.limit) params.append('limit', filters.limit)
      if (filters.search) params.append('search', filters.search)
      
      const { data } = await apiClient.get(`/logs/?${params.toString()}`)
      return data
    } catch (error) {
      console.error('❌ Error obteniendo logs:', error)
      throw error
    }
  },

  /**
   * Obtiene estadísticas de logs
   */
  getLogStats: async () => {
    try {
      const { data } = await apiClient.get('/logs/stats')
      return data
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de logs:', error)
      throw error
    }
  },

  /**
   * Limpia los logs del sistema
   */
  clearLogs: async () => {
    try {
      const { data } = await apiClient.delete('/logs/clear')
      return data
    } catch (error) {
      console.error('❌ Error limpiando logs:', error)
      throw error
    }
  }
}

// Exportar también como default
export default systemApi