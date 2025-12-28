import { useState, useEffect } from 'react'
import {
  Key,
  Copy,
  RotateCw,
  Zap,
  Shield,
  CheckCircle
} from 'lucide-react'
import config from '../../../lib/config'

export default function SystemManagement() {
  const [apiKeyData, setApiKeyData] = useState(null)
  const [loadingApiKey, setLoadingApiKey] = useState(false)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  useEffect(() => {
    loadCurrentApiKey()
  }, [])

  const loadCurrentApiKey = async () => {
    try {
      setLoadingApiKey(true)
      const token = sessionStorage.getItem('admin_token')
      const response = await fetch(config.endpoints.apiKeys.current, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      
      setApiKeyData(data.exists ? {
        key: data.key,
        created_at: data.created_at,
        usage_count: data.usage_count,
        last_used_at: data.last_used_at
      } : null)
    } catch (err) {
      console.error('Error cargando API Key:', err)
    } finally {
      setLoadingApiKey(false)
    }
  }

  const handleGenerateApiKey = async () => {
    if (apiKeyData) {
      if (!confirm('Ya existe una API Key. Generar una nueva invalidará la actual. ¿Continuar?')) {
        return
      }
    }

    try {
      setGeneratingKey(true)
      const token = sessionStorage.getItem('admin_token')
      const response = await fetch(config.endpoints.apiKeys.generate, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      
      if (data.success) {
        setApiKeyData({
          key: data.key,
          created_at: data.created_at,
          usage_count: 0,
          last_used_at: null
        })
        alert('API Key generada exitosamente')
      }
    } catch (err) {
      console.error('Error generando API Key:', err)
      alert('Error al generar API Key')
    } finally {
      setGeneratingKey(false)
    }
  }

  const handleRegenerateApiKey = async () => {
    if (!confirm('ADVERTENCIA\n\nAl regenerar la API Key:\n\n• La clave actual dejará de funcionar\n• El Plugin no podrá autenticarse hasta actualizar la nueva clave\n• Esta acción no se puede deshacer\n\n¿Estás seguro de continuar?')) {
      return
    }

    try {
      setGeneratingKey(true)
      const token = sessionStorage.getItem('admin_token')
      const response = await fetch(config.endpoints.apiKeys.regenerate, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      
      if (data.success) {
        setApiKeyData({
          key: data.key,
          created_at: data.created_at,
          usage_count: 0,
          last_used_at: null
        })
        alert('API Key regenerada exitosamente\n\nIMPORTANTE: Actualiza esta nueva clave en el Plugin')
      }
    } catch (err) {
      console.error('Error regenerando API Key:', err)
      alert('Error al regenerar API Key')
    } finally {
      setGeneratingKey(false)
    }
  }

  const handleCopyApiKey = () => {
    if (apiKeyData?.key) {
      navigator.clipboard.writeText(apiKeyData.key)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca'
    const date = new Date(dateString)
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-gray-600">
          Gestión de API Keys
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Administra las claves de acceso para el Plugin
        </p>
      </div>

      {/* Contenido */}
      {loadingApiKey ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div 
              className="w-12 h-12 mx-auto border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#05A8F9', borderTopColor: 'transparent' }}
            />
            <p className="text-gray-600 text-sm font-medium">
              Cargando API Key...
            </p>
          </div>
        </div>
      ) : (
        <>

          {/* API Key existente */}
          {apiKeyData ? (
            <div 
              className="bg-white rounded-2xl border-2 shadow-lg p-6"
              style={{ borderColor: '#E0F2FE' }}
            >
              <div className="flex items-center gap-2 mb-6">
                <Key className="w-5 h-5" style={{ color: '#05A8F9' }} />
                <h3 className="text-lg font-black text-gray-900">
                  API Key activa
                </h3>
              </div>

              <div className="space-y-6">
                {/* Clave */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Clave activa
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={apiKeyData.key}
                      readOnly
                      className="flex-1 px-4 py-3 border-2 rounded-xl font-mono text-sm text-gray-900"
                      style={{ 
                        backgroundColor: '#F9FAFB',
                        borderColor: '#E0F2FE'
                      }}
                    />
                    <button
                      onClick={handleCopyApiKey}
                      className="flex items-center gap-2 px-5 py-3 font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
                      style={{
                        background: copiedKey 
                          ? 'linear-gradient(to right, #10B981, #059669)'
                          : 'linear-gradient(to right, #00B8D4, #00ACC1)',
                        color: 'white'
                      }}
                    >
                      {copiedKey ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Información */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide mb-2 text-blue-700">
                      Fecha de Creación
                    </p>
                    <p className="text-sm font-bold text-blue-900">
                      {formatDate(apiKeyData.created_at)}
                    </p>
                  </div>
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
                      Veces Utilizada
                    </p>
                    <p className="text-3xl font-black text-green-900">
                      {apiKeyData.usage_count || 0}
                    </p>
                  </div>
                  <div 
                    className="p-5 rounded-xl border-2"
                    style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide mb-2 text-purple-700">
                      Último Uso
                    </p>
                    <p className="text-sm font-bold text-purple-900">
                      {formatDate(apiKeyData.last_used_at)}
                    </p>
                  </div>
                </div>

                {/* Botón Regenerar */}
                <div className="border-t-2 pt-6" style={{ borderColor: '#E0F2FE' }}>
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="text-sm font-black text-gray-900 mb-1">
                        Regenerar API Key
                      </h4>
                      <p className="text-sm text-gray-600">
                        Genera una nueva clave e invalida la actual. El Plugin dejará de funcionar 
                        hasta que actualices la nueva clave en su configuración.
                      </p>
                    </div>
                    <button
                      onClick={handleRegenerateApiKey}
                      disabled={generatingKey}
                      className="flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl transition-all duration-300 border-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: 'white',
                        borderColor: '#FCA5A5',
                        color: '#EF4444'
                      }}
                      onMouseEnter={(e) => {
                        if (!generatingKey) {
                          e.currentTarget.style.backgroundColor = '#FEF2F2'
                          e.currentTarget.style.borderColor = '#F87171'
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white'
                        e.currentTarget.style.borderColor = '#FCA5A5'
                      }}
                    >
                      {generatingKey ? (
                        <>
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          <span>Regenerando...</span>
                        </>
                      ) : (
                        <>
                          <RotateCw className="w-4 h-4" />
                          <span>Regenerar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div 
              className="bg-white rounded-2xl border-2 shadow-lg p-12"
              style={{ borderColor: '#E0F2FE' }}
            >
              <div className="text-center max-w-md mx-auto">
                <div 
                  className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
                  style={{ backgroundColor: '#F4FCFF' }}
                >
                  <Key className="w-10 h-10" style={{ color: '#05A8F9' }} />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-3">
                  No hay API Key configurada
                </h3>
                <p className="text-sm text-gray-600 mb-8 leading-relaxed">
                  Genera una API Key para permitir la comunicación segura entre el Plugin 
                  y el Sistema Biométrico.
                </p>
                <button
                  onClick={handleGenerateApiKey}
                  disabled={generatingKey}
                  className="inline-flex items-center gap-2 px-8 py-3 font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                    color: 'white'
                  }}
                >
                  {generatingKey ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generando...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      <span>Autogenerar API Key</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}