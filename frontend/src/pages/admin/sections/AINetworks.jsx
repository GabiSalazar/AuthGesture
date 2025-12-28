import { useState, useEffect } from 'react'
import { systemApi } from '../../../lib/api/system'
import {
  Brain,
  Activity,
  Target,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Network
} from 'lucide-react'
import config from '../../../lib/config'

export default function AINetworks() {
  // Estado de redes
  const [anatomicalMetrics, setAnatomicalMetrics] = useState(null)
  const [dynamicMetrics, setDynamicMetrics] = useState(null)
  const [fusionWeights, setFusionWeights] = useState(null)
  const [biometricMetrics, setBiometricMetrics] = useState(null)
  
  // Estado de UI
  const [loading, setLoading] = useState(true)
  const [retraining, setRetraining] = useState(false)
  const [retrainProgress, setRetrainProgress] = useState(0)

  useEffect(() => {
    loadNetworksData()
  }, [])

  const loadNetworksData = async () => {
    try {
      setLoading(true)
      const token = sessionStorage.getItem('admin_token')
      const [anatomical, dynamic, weights, metricsResponse] = await Promise.all([
        systemApi.getAnatomicalNetworkMetrics(),
        systemApi.getDynamicNetworkMetrics(),
        systemApi.getFusionWeights(),
        fetch(config.endpoints.feedback.verificationMetrics, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
          .then(res => res.json())
          .catch(() => ({ metrics: null }))
      ])
      
      setAnatomicalMetrics(anatomical)
      setDynamicMetrics(dynamic)
      setFusionWeights(weights)
      setBiometricMetrics(metricsResponse.metrics || null)
    } catch (err) {
      console.error('Error cargando datos de redes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRetrain = async () => {
    if (!confirm('¿Reentrenar las redes neuronales?\n\nEsto puede tardar 2-5 minutos y afectará el sistema.')) {
      return
    }

    try {
      setRetraining(true)
      setRetrainProgress(10)

      const interval = setInterval(() => {
        setRetrainProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval)
            return 90
          }
          return prev + 10
        })
      }, 500)

      await systemApi.retrainNetworks(true)
      
      clearInterval(interval)
      setRetrainProgress(100)
      
      setTimeout(async () => {
        await loadNetworksData()
        setRetraining(false)
        setRetrainProgress(0)
        alert('Redes reentrenadas exitosamente!')
      }, 1000)
      
    } catch (err) {
      console.error('Error reentrenando:', err)
      alert('Error al reentrenar las redes')
      setRetraining(false)
      setRetrainProgress(0)
    }
  }

  const getStatusBadge = (isTrained) => {
    if (isTrained) {
      return (
        <span 
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
          style={{ backgroundColor: '#F0FDF4', color: '#065F46' }}
        >
          <CheckCircle className="w-3 h-3" />
          Entrenada
        </span>
      )
    }
    return (
      <span 
        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
        style={{ backgroundColor: '#FFFBEB', color: '#92400E' }}
      >
        <AlertCircle className="w-3 h-3" />
        Sin entrenar
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div 
            className="w-12 h-12 mx-auto border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#05A8F9', borderTopColor: 'transparent' }}
          />
          <p className="text-gray-600 text-sm font-medium">
            Cargando métricas de IA...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* ========================================
          HEADER
      ======================================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-600">
            IA y Redes Neuronales
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Métricas y estado de las redes siamesas
          </p>
        </div>
        <button
          onClick={handleRetrain}
          disabled={retraining}
          className="flex items-center gap-2 px-5 py-2.5 text-white font-bold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          style={{
            background: retraining 
              ? 'linear-gradient(to right, #9CA3AF, #6B7280)'
              : 'linear-gradient(to right, #00B8D4, #00ACC1)',
            boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
          }}
        >
          <RefreshCw className={`w-4 h-4 ${retraining ? 'animate-spin' : ''}`} />
          {retraining ? 'Reentrenando...' : 'Reentrenar Redes'}
        </button>
      </div>

      {/* ========================================
          PROGRESS BAR
      ======================================== */}
      {retraining && (
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6"
          style={{ borderColor: '#E0F2FE' }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-gray-900">Progreso del entrenamiento</span>
              <span className="font-bold" style={{ color: '#05A8F9' }}>
                {retrainProgress}%
              </span>
            </div>
            <div 
              className="w-full rounded-full h-3 overflow-hidden"
              style={{ backgroundColor: '#E0F2FE' }}
            >
              <div
                className="h-3 transition-all duration-500 rounded-full"
                style={{ 
                  width: `${retrainProgress}%`,
                  background: 'linear-gradient(to right, #00B8D4, #00ACC1)'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================
          ESTADO GENERAL - 3 CARDS
      ======================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Red Anatómica */}
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6"
          style={{ borderColor: '#E0F2FE' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Red Anatómica
              </p>
              <p className="text-3xl font-black mb-3" style={{ color: '#05A8F9' }}>
                {anatomicalMetrics?.training_metrics?.final_accuracy || '--'}%
              </p>
              {getStatusBadge(anatomicalMetrics?.is_trained)}
            </div>
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: '#EFF6FF' }}
            >
              <Network className="w-7 h-7 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Red Dinámica */}
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6"
          style={{ borderColor: '#E0F2FE' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Red Dinámica
              </p>
              <p className="text-3xl font-black mb-3" style={{ color: '#05A8F9' }}>
                {dynamicMetrics?.training_metrics?.final_accuracy || '--'}%
              </p>
              {getStatusBadge(dynamicMetrics?.is_trained)}
            </div>
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: '#F5F3FF' }}
            >
              <Activity className="w-7 h-7 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Pesos de Fusión */}
        <div 
          className="bg-white rounded-2xl border-2 shadow-lg p-6"
          style={{ borderColor: '#E0F2FE' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                Pesos de Fusión
              </p>
              <p className="text-2xl font-black" style={{ color: '#05A8F9' }}>
                {fusionWeights?.weights?.anatomical ? 
                  `${(fusionWeights.weights.anatomical * 100).toFixed(0)}% / ${(fusionWeights.weights.dynamic * 100).toFixed(0)}%` 
                  : '50% / 50%'}
              </p>
            </div>
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: '#F0FDF4' }}
            >
              <Brain className="w-7 h-7 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================
          TAB ÚNICO
      ======================================== */}
      <div className="flex items-center gap-2 border-b-2 overflow-x-auto" style={{ borderColor: '#E0F2FE' }}>
        <button
          className="flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all whitespace-nowrap border-b-4"
          style={{ 
            borderColor: '#05A8F9',
            backgroundColor: '#F4FCFF',
            color: '#05A8F9'
          }}
        >
          <BarChart3 className="w-4 h-4" />
          Métricas Biométricas
        </button>
      </div>

      {/* ========================================
          CONTENIDO
      ======================================== */}
      <BiometricMetricsPanel metrics={biometricMetrics} />
    </div>
  )
}

/* ========================================
   COMPONENTE: BIOMETRIC METRICS PANEL
======================================== */
function BiometricMetricsPanel({ metrics }) {
  if (!metrics || metrics.total_samples === 0) {
    return (
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-12"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="text-center max-w-md mx-auto">
          <BarChart3 className="w-16 h-16 mx-auto mb-4" style={{ color: '#E0F2FE' }} />
          <h3 className="text-lg font-black text-gray-900 mb-2">
            No hay métricas disponibles
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Las métricas biométricas se calculan cuando los usuarios responden 
            los correos de feedback. Realiza algunas autenticaciones para ver 
            los datos aquí.
          </p>
        </div>
      </div>
    )
  }

  const getMetricColor = (value, isNegative = false) => {
    if (isNegative) {
      return value <= 2 
        ? { bg: '#F0FDF4', border: '#86EFAC', text: 'text-green-800' }
        : value <= 5 
          ? { bg: '#FFFBEB', border: '#FCD34D', text: 'text-yellow-800' }
          : { bg: '#FEF2F2', border: '#FCA5A5', text: 'text-red-800' }
    } else {
      return value >= 10 
        ? { bg: '#F0FDF4', border: '#86EFAC', text: 'text-green-800' }
        : value >= 5 
          ? { bg: '#FFFBEB', border: '#FCD34D', text: 'text-yellow-800' }
          : { bg: '#F3F4F6', border: '#E5E7EB', text: 'text-gray-800' }
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Matriz de Confusión */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Target className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Matriz de confusión
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {/* VP */}
          <div 
            className={`p-6 rounded-xl border-2 ${getMetricColor(metrics.true_positives).text}`}
            style={{ 
              backgroundColor: getMetricColor(metrics.true_positives).bg,
              borderColor: getMetricColor(metrics.true_positives).border
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <span className="text-4xl font-black">{metrics.true_positives}</span>
            </div>
            <h4 className="font-black text-sm mb-1">Verdaderos Positivos (VP)</h4>
            <p className="text-xs opacity-75">
              Sistema autenticó correctamente al usuario legítimo
            </p>
          </div>

          {/* FP */}
          <div 
            className={`p-6 rounded-xl border-2 ${getMetricColor(metrics.false_positives, true).text}`}
            style={{ 
              backgroundColor: getMetricColor(metrics.false_positives, true).bg,
              borderColor: getMetricColor(metrics.false_positives, true).border
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <XCircle className="w-8 h-8 text-red-600" />
              <span className="text-4xl font-black">{metrics.false_positives}</span>
            </div>
            <h4 className="font-black text-sm mb-1">Falsos Positivos (FP)</h4>
            <p className="text-xs opacity-75">
              Sistema autenticó incorrectamente a un impostor
            </p>
          </div>

          {/* FN */}
          <div 
            className={`p-6 rounded-xl border-2 ${getMetricColor(metrics.false_negatives, true).text}`}
            style={{ 
              backgroundColor: getMetricColor(metrics.false_negatives, true).bg,
              borderColor: getMetricColor(metrics.false_negatives, true).border
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <AlertCircle className="w-8 h-8 text-orange-600" />
              <span className="text-4xl font-black">{metrics.false_negatives}</span>
            </div>
            <h4 className="font-black text-sm mb-1">Falsos Negativos (FN)</h4>
            <p className="text-xs opacity-75">
              Sistema rechazó incorrectamente a un usuario legítimo
            </p>
          </div>

          {/* VN */}
          <div 
            className={`p-6 rounded-xl border-2 ${getMetricColor(metrics.true_negatives).text}`}
            style={{ 
              backgroundColor: getMetricColor(metrics.true_negatives).bg,
              borderColor: getMetricColor(metrics.true_negatives).border
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <CheckCircle className="w-8 h-8 text-blue-600" />
              <span className="text-4xl font-black">{metrics.true_negatives}</span>
            </div>
            <h4 className="font-black text-sm mb-1">Verdaderos Negativos (VN)</h4>
            <p className="text-xs opacity-75">
              Sistema bloqueó correctamente a un impostor
            </p>
          </div>
        </div>

        {/* Total */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Total de muestras analizadas: <span className="font-black">{metrics.total_samples}</span>
          </p>
        </div>
      </div>

      {/* Métricas Derivadas */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Métricas de rendimiento
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-blue-700">
              Accuracy
            </p>
            <p className="text-3xl font-black text-blue-900">
              {(metrics.accuracy * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-blue-600 mt-2 font-medium">
              Decisiones correctas
            </p>
          </div>

          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-green-700">
              Precision
            </p>
            <p className="text-3xl font-black text-green-900">
              {(metrics.precision * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-green-600 mt-2 font-medium">
              Autenticaciones correctas
            </p>
          </div>

          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-purple-700">
              Recall
            </p>
            <p className="text-3xl font-black text-purple-900">
              {(metrics.recall * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-purple-600 mt-2 font-medium">
              Usuarios identificados
            </p>
          </div>

          <div 
            className="p-5 rounded-xl border-2"
            style={{ backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-indigo-700">
              F1 Score
            </p>
            <p className="text-3xl font-black text-indigo-900">
              {(metrics.f1_score * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-indigo-600 mt-2 font-medium">
              Métrica combinada
            </p>
          </div>
        </div>
      </div>

      {/* Tasas de Error */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5" style={{ color: '#05A8F9' }} />
          <h3 className="text-lg font-black text-gray-900">
            Tasas de error biométrico
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <div 
            className="p-6 rounded-xl border-2"
            style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-red-700">
              FAR (False Acceptance Rate)
            </p>
            <p className="text-4xl font-black text-red-900">
              {(metrics.far * 100).toFixed(2)}%
            </p>
            <p className="text-xs text-red-600 mt-2 font-medium">
              Tasa de aceptación de impostores
            </p>
          </div>

          <div 
            className="p-6 rounded-xl border-2"
            style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-orange-700">
              FRR (False Rejection Rate)
            </p>
            <p className="text-4xl font-black text-orange-900">
              {(metrics.frr * 100).toFixed(2)}%
            </p>
            <p className="text-xs text-orange-600 mt-2 font-medium">
              Tasa de rechazo de usuarios legítimos
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}