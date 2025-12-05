/**
 * API Client para autenticación general
 * Login, registro, forgot sequence, etc.
 */
import apiClient from './client'

export const authApi = {
  /**
   * Envía código OTP para recuperar secuencia de gestos
   */
  sendForgotSequenceOTP: async (email) => {
    try {
      const { data } = await apiClient.post('/forgot-sequence/send-otp', { email })
      return data
    } catch (error) {
      console.error('Error enviando OTP:', error)
      throw error
    }
  },
  
  /**
   * Verifica código OTP y obtiene secuencia de gestos
   */
  verifyForgotSequenceOTP: async (email, otpCode) => {
    try {
      const { data } = await apiClient.post('/forgot-sequence/verify-otp', {
        email,
        otp_code: otpCode
      })
      return data
    } catch (error) {
      console.error('Error verificando OTP:', error)
      throw error
    }
  },
  
  /**
   * Reenvía código OTP al email del usuario
   */
  resendForgotSequenceOTP: async (email) => {
    try {
      const { data } = await apiClient.post('/forgot-sequence/resend-otp', { email })
      return data
    } catch (error) {
      console.error('Error reenviando OTP:', error)
      throw error
    }
  },
  
  /**
   * Inicia proceso de re-registro desactivando usuario actual
   */
  initiateReenrollment: async (userId) => {
    try {
      const { data } = await apiClient.post('/forgot-sequence/initiate-reenroll', {
        user_id: userId
      })
      return data
    } catch (error) {
      console.error('Error iniciando reenrollment:', error)
      throw error
    }
  }
}