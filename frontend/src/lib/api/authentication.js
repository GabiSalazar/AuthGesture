// /**
//  * API Client para endpoints de autenticación
//  */

// import apiClient from './client'

// export const authenticationApi = {
//   /**
//    * Obtiene usuarios disponibles para autenticación
//    */
//   getAvailableUsers: async () => {
//     try {
//       const { data } = await apiClient.get('/authentication/users')
//       return data
//     } catch (error) {
//       console.error('Error obteniendo usuarios:', error)
//       throw error
//     }
//   },

//   /**
//    * Inicia verificación 1:1
//    */
//   startVerification: async (userId, securityLevel = 'standard') => {
//     try {
//       const { data } = await apiClient.post('/authentication/verify/start', {
//         user_id: userId,
//         security_level: securityLevel,
//         required_sequence: null,
//         ip_address: 'localhost'
//       })
//       return data
//     } catch (error) {
//       console.error('Error iniciando verificación:', error)
//       throw error
//     }
//   },

//   /**
//    * Inicia identificación 1:N
//    */
//   startIdentification: async (securityLevel = 'standard') => {
//     try {
//       const { data } = await apiClient.post('/authentication/identify/start', {
//         security_level: securityLevel,
//         ip_address: 'localhost'
//       })
//       return data
//     } catch (error) {
//       console.error('Error iniciando identificación:', error)
//       throw error
//     }
//   },

//   /**
//    * Procesa un frame de autenticación
//    */
//   processFrame: async (sessionId) => {
//     try {
//       const { data } = await apiClient.get(`/authentication/${sessionId}/frame`)
//       return data
//     } catch (error) {
//       console.error('Error procesando frame:', error)
//       throw error
//     }
//   },

//   /**
//    * Obtiene el estado de una sesión
//    */
//   getSessionStatus: async (sessionId) => {
//     try {
//       const { data } = await apiClient.get(`/authentication/${sessionId}/status`)
//       return data
//     } catch (error) {
//       console.error('Error obteniendo estado:', error)
//       throw error
//     }
//   },

//   /**
//    * Cancela una sesión de autenticación
//    */
//   cancelSession: async (sessionId) => {
//     try {
//       const { data } = await apiClient.post(`/authentication/${sessionId}/cancel`)
//       return data
//     } catch (error) {
//       console.error('Error cancelando sesión:', error)
//       throw error
//     }
//   },

//   /**
//    * Obtiene estadísticas del sistema
//    */
//   getStats: async () => {
//     try {
//       const { data } = await apiClient.get('/authentication/stats')
//       return data
//     } catch (error) {
//       console.error('Error obteniendo estadísticas:', error)
//       throw error
//     }
//   },

//   /**
//    * Inicializa el sistema de autenticación
//    */
//   initialize: async () => {
//     try {
//       const { data } = await apiClient.post('/authentication/initialize')
//       return data
//     } catch (error) {
//       console.error('Error inicializando sistema:', error)
//       throw error
//     }
//   }
// }

// export default authenticationApi



/**
 * API Client para endpoints de autenticación
 */
import apiClient from './client'

export const authenticationApi = {
  /**
   * Obtiene usuarios disponibles para autenticación
   */
  getAvailableUsers: async () => {
    try {
      const { data } = await apiClient.get('/authentication/users')
      return data
    } catch (error) {
      console.error('Error obteniendo usuarios:', error)
      throw error
    }
  },

  /**
 * Busca un usuario específico por email
 */
  getUserByEmail: async (email) => {
    try {
      const { data } = await apiClient.get(`/authentication/user/by-email/${encodeURIComponent(email)}`)
      return data
    } catch (error) {
      console.error('Error buscando usuario por email:', error)
      throw error
    }
  },

  /**
   * Inicia verificación 1:1
   */
  // startVerification: async (userId, securityLevel = 'standard') => {
  //   try {
  //     const { data } = await apiClient.post('/authentication/verify/start', {
  //       user_id: userId,
  //       security_level: securityLevel,
  //       required_sequence: null,
  //       ip_address: 'localhost'
  //     })
  //     return data
  //   } catch (error) {
  //     console.error('Error iniciando verificación:', error)
  //     throw error
  //   }
  // },

  /**
   * Inicia verificación 1:1
   */
  startVerification: async (userId, securityLevel = 'standard', sessionToken = null, callbackUrl = null) => {
    try {
      const { data } = await apiClient.post('/authentication/verify/start', {
        user_id: userId,
        security_level: securityLevel,
        required_sequence: null,
        ip_address: 'localhost',
        session_token: sessionToken,
        callback_url: callbackUrl
      })
      return data
    } catch (error) {
      console.error('Error iniciando verificación:', error)
      throw error
    }
  },

  /**
   * Inicia identificación 1:N
   */
  startIdentification: async (securityLevel = 'standard') => {
    try {
      const { data } = await apiClient.post('/authentication/identify/start', {
        security_level: securityLevel,
        ip_address: 'localhost'
      })
      return data
    } catch (error) {
      console.error('Error iniciando identificación:', error)
      throw error
    }
  },

  /**
   * Procesa un frame de autenticación (POST con base64)
   */
  processFrame: async (sessionId, frameBase64) => {
    try {
      const { data } = await apiClient.post(`/authentication/${sessionId}/process-frame`, {
        frame: frameBase64
      })
      return data
    } catch (error) {
      console.error('Error procesando frame:', error)
      throw error
    }
  },

  /**
   * Obtiene el estado de una sesión
   */
  getSessionStatus: async (sessionId) => {
    try {
      const { data } = await apiClient.get(`/authentication/${sessionId}/status`)
      return data
    } catch (error) {
      console.error('Error obteniendo estado:', error)
      throw error
    }
  },

  /**
   * Cancela una sesión de autenticación
   */
  cancelSession: async (sessionId) => {
    try {
      const { data } = await apiClient.post(`/authentication/${sessionId}/cancel`)
      return data
    } catch (error) {
      console.error('Error cancelando sesión:', error)
      throw error
    }
  },

  /**
   * Obtiene estadísticas del sistema
   */
  getStats: async () => {
    try {
      const { data } = await apiClient.get('/authentication/stats')
      return data
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error)
      throw error
    }
  },

  /**
   * Inicializa el sistema de autenticación
   */
  initialize: async () => {
    try {
      const { data } = await apiClient.post('/authentication/initialize')
      return data
    } catch (error) {
      console.error('Error inicializando sistema:', error)
      throw error
    }
  }
}

export default authenticationApi