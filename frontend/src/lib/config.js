// Configuración de API según ambiente
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
const API_ROOT = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:8000'

export const config = {
  apiUrl: API_BASE_URL,
  apiRoot: API_ROOT,  // ← Para endpoints que NO usan /api/v1
  endpoints: {
    admin: {
      login: `${API_BASE_URL}/admin/login`,
      verifyToken: `${API_BASE_URL}/admin/verify-token`,
      health: `${API_BASE_URL}/admin/health`
    },
    apiKeys: {
      current: `${API_BASE_URL}/api-keys/current`,
      generate: `${API_BASE_URL}/api-keys/generate`,
      regenerate: `${API_BASE_URL}/api-keys/regenerate`
    },
    personality: {
      submit: `${API_BASE_URL}/personality/submit`,
      profile: (userId) => `${API_BASE_URL}/personality/profile/${userId}`,
      check: (userId) => `${API_BASE_URL}/personality/check/${userId}`
    },
    feedback: {
      verificationMetrics: `${API_BASE_URL}/feedback/metrics/verification`,
      identificationMetrics: `${API_BASE_URL}/feedback/metrics/identification`
    },
    email: {
      verifyCode: `${API_ROOT}/api/email/verify-code`,
      resendCode: `${API_ROOT}/api/email/resend-code`
    },
    enrollment: {
      sendOTP: `${API_BASE_URL}/enrollment/send-otp`
    },
    system: {
      stats: `${API_BASE_URL}/system/stats`,
      logs: `${API_BASE_URL}/system/logs`,
      users: `${API_BASE_URL}/system/users`
    },
    auth: {
      attempts: `${API_BASE_URL}/auth/attempts`,
      stats: `${API_BASE_URL}/auth/stats`
    }
  }
}

export default config