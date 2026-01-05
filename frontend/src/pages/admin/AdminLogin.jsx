import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, User, Eye, EyeOff, Shield, AlertCircle, ArrowLeft, Sparkles } from 'lucide-react'
import config from '../../lib/config'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // const response = await fetch('http://localhost:8000/api/v1/admin/login', {
      const response = await fetch(config.endpoints.admin.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Error en autenticación')
      }

      // Guardar token en sessionStorage
      sessionStorage.setItem('admin_token', data.token)
      sessionStorage.setItem('admin_username', formData.username)
      sessionStorage.setItem('admin_expires_at', data.expires_at)

      // Redirigir al dashboard
      navigate('/admin/dashboard')
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  return (
    <div className="fixed inset-0 flex">
      
      {/* ========================================
          PANEL LATERAL CYAN (DESKTOP)
      ======================================== */}
      <div 
        className="hidden lg:flex lg:w-2/5 h-screen sticky top-0 flex-col justify-between p-12"
        style={{ backgroundColor: '#0291B9' }}
      >
        {/* Título centrado - arriba */}
        <div className="flex justify-center">
          <span className="text-2xl font-black uppercase tracking-tight text-white select-none">
            Auth-Gesture
          </span>
        </div>

        {/* Logo/Video grande - centrado */}
        <div className="flex items-center justify-center flex-1">
          <video
            src="/videito.mp4"  
            className="w-124 h-124 object opacity-95"
            autoPlay
            loop
            muted
            playsInline
          />
        </div>

        {/* Badge admin - abajo */}
        <div className="flex justify-center">
          <div 
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 rounded-full backdrop-blur-sm border border-white/30"
          >
            <Shield className="w-4 h-4 text-white" />
            <span className="text-sm font-semibold text-white">
              Panel de Administración
            </span>
          </div>
        </div>
      </div>

      {/* ========================================
          ÁREA DE CONTENIDO
      ======================================== */}
      <div className="flex-1 bg-white h-screen overflow-y-auto">
        
        {/* Header móvil */}
        
        <div 
          className="lg:hidden flex items-center justify-between px-3 py-2 border-b"
          style={{ backgroundColor: '#0291B9' }}
        >
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" style={{ color: '#fbfbfbff' }}/>
          </button>
          
          <span 
            className="absolute left-1/2 transform -translate-x-1/2 text-xl font-black uppercase tracking-tight"
            style={{ color: '#fbfbfbff' }}
          >
            Auth-Gesture
          </span>
          
          <video
            src="/videito.mp4"
            className="hidden sm:block w-25 h-16 object-contain opacity-95"
            autoPlay
            loop
            muted
            playsInline
          />
        </div>

        {/* Contenido principal centrado */}
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] lg:min-h-screen px-6 py-12">
          
          <div className="w-full max-w-lg space-y-8">
            
            {/* Card principal */}
            <div 
              className="bg-white rounded-3xl border-2 shadow-2xl p-8 sm:p-10"
              style={{ borderColor: '#E0F2FE' }}
            >
              {/* Título del formulario */}
              <div className="text-center space-y-3 mb-8">
                <div className="flex items-center justify-center gap-3">
                  <div 
                    className="p-3 rounded-full"
                    style={{ backgroundColor: '#F4FCFF' }}
                  >
                    <Shield className="w-8 h-8" style={{ color: '#05A8F9' }} />
                  </div>
                </div>
               
              </div>

              {/* Línea divisora */}
              <div 
                className="relative flex items-center justify-center my-8"
              >
                <div 
                  className="absolute inset-0 flex items-center"
                  style={{ top: '50%' }}
                >
                  <div 
                    className="w-full border-t"
                    style={{ borderColor: '#E0F2FE' }}
                  />
                </div>
                <div className="relative px-4 bg-white">
                  <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    Credenciales
                  </span>
                </div>
              </div>

              {/* Formulario */}
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Alerta de error */}
                {error && (
                  <div 
                    className="p-4 rounded-xl border-2 flex items-start gap-3"
                    style={{ 
                      backgroundColor: '#FEF2F2',
                      borderColor: '#FCA5A5'
                    }}
                  >
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-red-900">
                        Error de autenticación
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        {error}
                      </p>
                    </div>
                  </div>
                )}

                {/* Campo Usuario */}
                <div className="space-y-2">
                  <label htmlFor="username" className="block text-sm font-bold text-gray-700">
                    Usuario
                  </label>
                  <div className="relative">
                    <User 
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10"
                    />
                    <input
                      type="text"
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      required
                      placeholder="Ingresa tu usuario"
                      autoComplete="username"
                      disabled={loading}
                      className="w-full pl-12 pr-4 py-4 border-2 rounded-xl focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-medium"
                      style={{
                        borderColor: '#E0F2FE'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#05A8F9'
                        e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#E0F2FE'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Campo Contraseña */}
                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-bold text-gray-700">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock 
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      placeholder="Ingresa tu contraseña"
                      autoComplete="current-password"
                      disabled={loading}
                      className="w-full pl-12 pr-12 py-4 border-2 rounded-xl focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-medium"
                      style={{
                        borderColor: '#E0F2FE'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#05A8F9'
                        e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#E0F2FE'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                      className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors disabled:opacity-50"
                      style={{ color: '#6B7280' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#05A8F9'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Botón Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 text-white font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                    boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
                  }}
                >
                  {loading ? (
                    <>
                      <div 
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                      />
                      <span>Verificando...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5" />
                      <span>Iniciar sesión</span>
                    </>
                  )}
                </button>
              </form>

              {/* Info adicional */}
              <div 
                className="mt-8 pt-6 border-t-2"
                style={{ borderColor: '#E0F2FE' }}
              >
                <p className="text-xs text-gray-500 text-center">
                  Acceso restringido a administradores del sistema
                </p>
              </div>
            </div>

            {/* Link volver */}
            <div className="text-center">
              <button
                onClick={() => navigate('/')}
                className="text-sm font-semibold inline-flex items-center gap-2 transition-colors group"
                style={{ color: '#05A8F9' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#00ACC1'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#05A8F9'}
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}