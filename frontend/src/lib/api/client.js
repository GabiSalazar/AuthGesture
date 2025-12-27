// import axios from 'axios'

// const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

// export const apiClient = axios.create({
//   baseURL: API_BASE_URL,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// })

// // ============================================================================
// // INTERCEPTOR DE AUTENTICACIÓN - Agrega token admin automáticamente
// // ============================================================================
// apiClient.interceptors.request.use(
//   (config) => {
//     // Obtener token del sessionStorage
//     const token = sessionStorage.getItem('admin_token')
    
//     // Si existe token, agregarlo al header Authorization
//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`
//     }
    
//     // Logging en desarrollo
//     if (import.meta.env.DEV) {
//       console.log('API Request:', config.method?.toUpperCase(), config.url)
//       if (token) {
//         console.log('  ✓ Token incluido')
//       }
//     }
    
//     return config
//   },
//   (error) => {
//     return Promise.reject(error)
//   }
// )

// // ============================================================================
// // INTERCEPTOR DE RESPUESTA - Maneja errores de autenticación
// // ============================================================================
// apiClient.interceptors.response.use(
//   (response) => {
//     if (import.meta.env.DEV) {
//       console.log('API Response:', response.status, response.config.url)
//     }
//     return response
//   },
//   (error) => {
//     if (import.meta.env.DEV) {
//       console.error('API Error:', error.response?.status, error.config?.url)
//     }
    
//     // Si recibimos 401 Unauthorized, limpiar sesión y redirigir al login
//     if (error.response?.status === 401) {
//       const currentPath = window.location.pathname
      
//       // Solo limpiar y redirigir si NO estamos ya en la página de login
//       if (!currentPath.includes('/admin/login')) {
//         console.warn('Token inválido o expirado. Redirigiendo al login...')
//         sessionStorage.removeItem('admin_token')
//         sessionStorage.removeItem('admin_username')
//         sessionStorage.removeItem('admin_expires_at')
        
//         // Redirigir al login
//         window.location.href = '/admin/login'
//       }
//     }
    
//     return Promise.reject(error)
//   }
// )

// export default apiClient

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

// ============================================================================
// CLIENTE PÚBLICO - Sin autenticación automática
// Usado por: Enrollment, Verification, Identification, ForgotSequence
// ============================================================================
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor básico solo para logging (NO agrega token, NO redirige)
if (import.meta.env.DEV) {
  apiClient.interceptors.request.use((config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url)
    return config
  })

  apiClient.interceptors.response.use(
    (response) => {
      console.log('API Response:', response.status, response.config.url)
      return response
    },
    (error) => {
      console.error('API Error:', error.response?.status, error.config?.url)
      return Promise.reject(error)
    }
  )
}

// ============================================================================
// CLIENTE ADMIN - Con autenticación automática
// Usado por: AdminPanel, SystemManagement, AuthenticationLogs, etc.
// ============================================================================
export const adminApiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor que agrega token automáticamente
adminApiClient.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('admin_token')
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    if (import.meta.env.DEV) {
      console.log('Admin API Request:', config.method?.toUpperCase(), config.url)
      if (token) {
        console.log('  ✓ Token incluido')
      }
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor que maneja errores 401 (SOLO para rutas admin)
adminApiClient.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log('Admin API Response:', response.status, response.config.url)
    }
    return response
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error('Admin API Error:', error.response?.status, error.config?.url)
    }
    
    // Redirigir al login SOLO si es 401
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname
      
      if (!currentPath.includes('/admin/login')) {
        console.warn('Token inválido o expirado. Redirigiendo al login...')
        sessionStorage.removeItem('admin_token')
        sessionStorage.removeItem('admin_username')
        sessionStorage.removeItem('admin_expires_at')
        
        window.location.href = '/admin/login'
      }
    }
    
    return Promise.reject(error)
  }
)

// Exportar apiClient como default para compatibilidad
export default apiClient