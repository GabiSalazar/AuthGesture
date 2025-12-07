/**
 * API Client para Panel de Administración
 * Gestión de usuarios, métricas y configuración del sistema
 */

import apiClient from './client'

export const adminApi = {
  // ========================================
  // GESTIÓN DE USUARIOS
  // ========================================

  /**
   * Obtiene lista de todos los usuarios registrados con filtros
   */
  async getUsers(filters = {}) {
    const params = new URLSearchParams()
    
    if (filters.search) params.append('search', filters.search)
    if (filters.gender) params.append('gender', filters.gender)
    if (filters.min_age) params.append('min_age', filters.min_age)
    if (filters.max_age) params.append('max_age', filters.max_age)
    if (filters.sort_by) params.append('sort_by', filters.sort_by)
    if (filters.sort_order) params.append('sort_order', filters.sort_order)
    
    const queryString = params.toString()
    const url = `/biometric-database/users${queryString ? `?${queryString}` : ''}`
    
    const response = await apiClient.get(url)
    return response.data
  },

  /**
   * Obtiene detalles de un usuario específico
   */
  async getUserDetails(userId) {
    const response = await apiClient.get(`/biometric-database/users/${userId}`)
    return response.data
  },

  /**
   * Obtiene templates biométricos de un usuario
   */
  async getUserTemplates(userId) {
    const response = await apiClient.get(`/biometric-database/users/${userId}/templates`)
    return response.data
  },

  /**
   * Obtiene historial de autenticaciones de un usuario
   */
  async getUserAuthAttempts(userId, limit = 50) {
    const response = await apiClient.get(`/biometric-database/users/${userId}/auth-attempts`, {
      params: { limit }
    })
    return response.data
  },

  /**
   * Obtiene historial de autenticaciones de un usuario
   */
  async getUserAuthAttempts(userId, limit = 50) {
    const response = await apiClient.get(`/biometric-database/users/${userId}/auth-attempts`, {
      params: { limit }
    })
    return response.data
  },

  /**
   * Obtiene TODOS los intentos de autenticación del sistema
   */
  async getAllAuthAttempts(limit = 500) {
    const response = await apiClient.get('/authentication/all-attempts', {
      params: { limit }
    })
    return response.data
  },

  /**
   * Obtiene TODOS los intentos de IDENTIFICACIÓN del sistema
   */
  async getAllIdentificationAttempts(limit = 500) {
    const response = await apiClient.get('/authentication/all-identification-attempts', {
      params: { limit }
    })
    return response.data
  },
  
  /**
   * Obtiene estadísticas globales de autenticación
   */
  async getAuthStats() {
    const response = await apiClient.get('/authentication/stats')
    return response.data
  },

  /**
   * Actualiza información de un usuario
   */
  async updateUser(userId, updates) {
    const response = await apiClient.patch(`/biometric-database/users/${userId}`, updates)
    return response.data
  },

  /**
   * Elimina un usuario del sistema
   */
  async deleteUser(userId) {
    const response = await apiClient.delete(`/biometric-database/users/${userId}`)
    return response.data
  },

  // ========================================
  // ESTADÍSTICAS Y MÉTRICAS
  // ========================================

  /**
   * Obtiene estadísticas generales del sistema
   */
  async getSystemStats() {
    const response = await apiClient.get('/system/status')
    return response.data
  },

  /**
   * Obtiene estadísticas de la base de datos biométrica
   */
  async getDatabaseStats() {
    const response = await apiClient.get('/biometric-database/stats')
    return response.data
  },

  /**
   * Obtiene métricas de autenticación
   */
  async getAuthenticationMetrics(period = '30d') {
    const response = await apiClient.get('/authentication/metrics', {
      params: { period }
    })
    return response.data
  },

  /**
   * Obtiene métricas de enrollment
   */
  async getEnrollmentMetrics(period = '30d') {
    const response = await apiClient.get('/enrollment/metrics', {
      params: { period }
    })
    return response.data
  },

  /**
   * Obtiene logs del sistema
   */
  async getSystemLogs(limit = 100, level = 'all') {
    const response = await apiClient.get('/system/logs', {
      params: { limit, level }
    })
    return response.data
  },

  /**
   * Obtiene usuarios activos en tiempo real
   */
  async getActiveUsers() {
    const response = await apiClient.get('/system/active-users')
    return response.data
  },

  // ========================================
  // CONFIGURACIÓN DEL SISTEMA
  // ========================================

  /**
   * Obtiene configuración completa del sistema
   */
  async getSystemConfig() {
    const response = await apiClient.get('/config/all')
    return response.data
  },

  /**
   * Actualiza un parámetro de configuración
   */
  async updateConfigParam(key, value) {
    const response = await apiClient.put('/config/set', {
      key,
      value
    })
    return response.data
  },

  /**
   * Obtiene estado de las redes neuronales
   */
  async getNetworksStatus() {
    const [anatomical, dynamic, fusion] = await Promise.all([
      apiClient.get('/siamese-anatomical/stats'),
      apiClient.get('/siamese-dynamic/stats'),
      apiClient.get('/score-fusion/stats')
    ])
    
    return {
      anatomical: anatomical.data,
      dynamic: dynamic.data,
      fusion: fusion.data
    }
  },

  /**
   * Reentrena las redes neuronales
   */
  async retrainNetworks(force = false) {
    const response = await apiClient.post('/system/retrain', {
      force_retrain: force
    })
    return response.data
  },

  /**
   * Obtiene usuarios pendientes de reentrenamiento
   */
  async getPendingRetrainUsers() {
    const response = await apiClient.get('/system/pending-retrain')
    return response.data
  },

  /**
   * Verifica estado de bootstrap
   */
  async getBootstrapStatus() {
    const response = await apiClient.get('/enrollment/bootstrap-status')
    return response.data
  },

  /**
   * Exporta base de datos biométrica
   */
  async exportDatabase() {
    const response = await apiClient.get('/biometric-database/export', {
      responseType: 'blob'
    })
    return response.data
  },

  /**
   * Crea backup del sistema
   */
  async createBackup() {
    const response = await apiClient.post('/system/backup')
    return response.data
  },

  /**
   * Obtiene información de backups disponibles
   */
  async getBackups() {
    const response = await apiClient.get('/system/backups')
    return response.data
  },

  // ========================================
  // GESTIÓN DE GESTOS
  // ========================================

  /**
   * Obtiene estadísticas de gestos más usados
   */
  async getGestureStats() {
    const response = await apiClient.get('/sequence-manager/gesture-stats')
    return response.data
  },

  /**
   * Obtiene lista de gestos disponibles
   */
  async getAvailableGestures() {
    const response = await apiClient.get('/mediapipe/gestures')
    return response.data
  }
}