import { useState, useEffect } from 'react'
import { systemApi } from '../../../lib/api/system'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Spinner,
  Badge,
  Alert
} from '../../../components/ui'
import {
  Brain,
  Activity,
  Target,
  Zap,
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Network
} from 'lucide-react'

export default function AINetworks() {
  const [activeTab, setActiveTab] = useState('anatomical') // 'anatomical' | 'dynamic' | 'fusion' | 'metrics'
  
  // Estado de redes
  const [anatomicalMetrics, setAnatomicalMetrics] = useState(null)
  const [dynamicMetrics, setDynamicMetrics] = useState(null)
  const [fusionConfig, setFusionConfig] = useState(null)
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
      const [anatomical, dynamic, fusion, weights, metricsResponse] = await Promise.all([
        systemApi.getAnatomicalNetworkMetrics(),
        systemApi.getDynamicNetworkMetrics(),
        systemApi.getFusionConfig(),
        systemApi.getFusionWeights(),
        fetch('http://localhost:8000/api/v1/feedback/metrics/verification')
          .then(res => res.json())
          .catch(() => ({ metrics: null }))
      ])
      
      setAnatomicalMetrics(anatomical)
      setDynamicMetrics(dynamic)
      setFusionConfig(fusion)
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

      // Simular progreso
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
      return <Badge variant="success" className="flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        Entrenada
      </Badge>
    }
    return <Badge variant="warning" className="flex items-center gap-1">
      <AlertCircle className="w-3 h-3" />
      Sin entrenar
    </Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">IA y Redes Neuronales</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Métricas y estado de las redes siamesas
          </p>
        </div>
        <Button
          onClick={handleRetrain}
          disabled={retraining}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          <RefreshCw className={`w-4 h-4 ${retraining ? 'animate-spin' : ''}`} />
          {retraining ? 'Reentrenando...' : 'Reentrenar Redes'}
        </Button>
      </div>

      {/* Progress Bar */}
      {retraining && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Progreso del entrenamiento</span>
                <span className="text-gray-600">{retrainProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 transition-all duration-500"
                  style={{ width: `${retrainProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado General */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Red Anatómica</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                  {anatomicalMetrics?.training_metrics?.final_accuracy || '--'}%
                </p>
              </div>
              {getStatusBadge(anatomicalMetrics?.is_trained)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Red Dinámica</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                  {dynamicMetrics?.training_metrics?.final_accuracy || '--'}%
                </p>
              </div>
              {getStatusBadge(dynamicMetrics?.is_trained)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pesos de Fusión</p>
                <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">
                  {fusionWeights?.weights?.anatomical ? 
                    `${(fusionWeights.weights.anatomical * 100).toFixed(0)}% / ${(fusionWeights.weights.dynamic * 100).toFixed(0)}%` 
                    : '--'}
                </p>
              </div>
              <Brain className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('anatomical')}
          className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'anatomical'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Network className="w-4 h-4 inline mr-2" />
          Red Anatómica
        </button>
        <button
          onClick={() => setActiveTab('dynamic')}
          className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'dynamic'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Activity className="w-4 h-4 inline mr-2" />
          Red Dinámica
        </button>
        <button
          onClick={() => setActiveTab('fusion')}
          className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'fusion'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Zap className="w-4 h-4 inline mr-2" />
          Fusión
        </button>
        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'metrics'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Métricas Biométricas
        </button>
      </div>

      {/* Contenido de Red Anatómica */}
      {activeTab === 'anatomical' && anatomicalMetrics && (
        <NetworkDetails
          metrics={anatomicalMetrics}
          networkType="anatomical"
        />
      )}

      {/* Contenido de Red Dinámica */}
      {activeTab === 'dynamic' && dynamicMetrics && (
        <NetworkDetails
          metrics={dynamicMetrics}
          networkType="dynamic"
        />
      )}

      {/* Contenido de Fusión */}
      {activeTab === 'fusion' && fusionConfig && fusionWeights && (
        <FusionDetails
          config={fusionConfig}
          weights={fusionWeights}
        />
      )}

      {/* Contenido de Métricas Biométricas */}
      {activeTab === 'metrics' && (
        <BiometricMetricsPanel metrics={biometricMetrics} />
      )}
    </div>
  )
}

// Componente para métricas biométricas (VP, FP, VN, FN)
function BiometricMetricsPanel({ metrics }) {
  if (!metrics || metrics.total_samples === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              No hay métricas disponibles
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Las métricas biométricas se calculan cuando los usuarios responden 
              los correos de feedback. Realiza algunas autenticaciones para ver 
              los datos aquí.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getMetricColor = (value, isNegative = false) => {
    if (isNegative) {
      // Para FP y FN: menos es mejor
      return value <= 2 ? 'text-green-600 bg-green-50 border-green-200' : value <= 5 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' : 'text-red-600 bg-red-50 border-red-200'
    } else {
      // Para VP y VN: más es mejor
      return value >= 10 ? 'text-green-600 bg-green-50 border-green-200' : value >= 5 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' : 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Matriz de Confusión */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Matriz de Confusión - Resultados de Autenticación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* Verdaderos Positivos (VP) */}
            <div className={`p-6 rounded-lg border-2 ${getMetricColor(metrics.true_positives)}`}>
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <span className="text-3xl font-bold">{metrics.true_positives}</span>
              </div>
              <h4 className="font-semibold text-sm mb-1">Verdaderos Positivos (VP)</h4>
              <p className="text-xs opacity-75">
                Sistema autenticó correctamente al usuario legítimo
              </p>
            </div>

            {/* Falsos Positivos (FP) */}
            <div className={`p-6 rounded-lg border-2 ${getMetricColor(metrics.false_positives, true)}`}>
              <div className="flex items-center justify-between mb-2">
                <XCircle className="w-8 h-8 text-red-600" />
                <span className="text-3xl font-bold">{metrics.false_positives}</span>
              </div>
              <h4 className="font-semibold text-sm mb-1">Falsos Positivos (FP)</h4>
              <p className="text-xs opacity-75">
                Sistema autenticó incorrectamente a un impostor
              </p>
            </div>

            {/* Falsos Negativos (FN) */}
            <div className={`p-6 rounded-lg border-2 ${getMetricColor(metrics.false_negatives, true)}`}>
              <div className="flex items-center justify-between mb-2">
                <AlertCircle className="w-8 h-8 text-orange-600" />
                <span className="text-3xl font-bold">{metrics.false_negatives}</span>
              </div>
              <h4 className="font-semibold text-sm mb-1">Falsos Negativos (FN)</h4>
              <p className="text-xs opacity-75">
                Sistema rechazó incorrectamente a un usuario legítimo
              </p>
            </div>

            {/* Verdaderos Negativos (VN) */}
            <div className={`p-6 rounded-lg border-2 ${getMetricColor(metrics.true_negatives)}`}>
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-8 h-8 text-blue-600" />
                <span className="text-3xl font-bold">{metrics.true_negatives}</span>
              </div>
              <h4 className="font-semibold text-sm mb-1">Verdaderos Negativos (VN)</h4>
              <p className="text-xs opacity-75">
                Sistema bloqueó correctamente a un impostor
              </p>
            </div>
          </div>

          {/* Total de muestras */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Total de muestras analizadas: <span className="font-bold">{metrics.total_samples}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Métricas Derivadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Métricas de Rendimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Accuracy</p>
              <p className="text-2xl font-bold text-blue-600">
                {(metrics.accuracy * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Decisiones correctas</p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Precision</p>
              <p className="text-2xl font-bold text-green-600">
                {(metrics.precision * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Autenticaciones correctas</p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Recall</p>
              <p className="text-2xl font-bold text-purple-600">
                {(metrics.recall * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Usuarios identificados</p>
            </div>

            <div className="p-4 bg-indigo-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">F1 Score</p>
              <p className="text-2xl font-bold text-indigo-600">
                {(metrics.f1_score * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Métrica combinada</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas Biométricas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Tasas de Error Biométrico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">FAR (False Acceptance Rate)</p>
              <p className="text-2xl font-bold text-red-600">
                {(metrics.far * 100).toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Tasa de aceptación de impostores
              </p>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">FRR (False Rejection Rate)</p>
              <p className="text-2xl font-bold text-orange-600">
                {(metrics.frr * 100).toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Tasa de rechazo de usuarios legítimos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente auxiliar para detalles de red
function NetworkDetails({ metrics, networkType }) {
  const getMetricColor = (value, metric) => {
    if (metric === 'accuracy') return value >= 95 ? 'text-green-600' : value >= 90 ? 'text-yellow-600' : 'text-red-600'
    if (metric === 'far' || metric === 'frr') return value <= 2 ? 'text-green-600' : value <= 5 ? 'text-yellow-600' : 'text-red-600'
    if (metric === 'eer') return value <= 3 ? 'text-green-600' : value <= 5 ? 'text-yellow-600' : 'text-red-600'
    return 'text-gray-900'
  }

  const isDynamic = networkType === 'dynamic'

  return (
    <div className="space-y-6">
      {/* Métricas de Entrenamiento */}
      {metrics.training_metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <TrendingUp className="w-5 h-5" />
              Métricas de Entrenamiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Accuracy Final</p>
                <p className={`text-lg sm:text-2xl font-bold ${getMetricColor(metrics.training_metrics.final_accuracy, 'accuracy')}`}>
                  {metrics.training_metrics.final_accuracy}%
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Loss Final</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {metrics.training_metrics.final_loss}
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Total Epochs</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {metrics.training_metrics.total_epochs}
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Best Accuracy</p>
                <p className={`text-lg sm:text-2xl font-bold ${getMetricColor(metrics.training_metrics.best_accuracy, 'accuracy')}`}>
                  {metrics.training_metrics.best_accuracy}%
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Tiempo Total</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {metrics.training_metrics.training_time}s
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Métricas Biométricas */}
      {metrics.biometric_metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Target className="w-5 h-5" />
              Métricas Biométricas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-xs sm:text-sm text-red-700 mb-1">FAR</p>
                <p className={`text-xl sm:text-2xl font-bold ${getMetricColor(metrics.biometric_metrics.far, 'far')}`}>
                  {metrics.biometric_metrics.far}%
                </p>
                <p className="text-xs text-red-600 mt-1">False Accept Rate</p>
              </div>
              <div className="p-3 sm:p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-xs sm:text-sm text-yellow-700 mb-1">FRR</p>
                <p className={`text-xl sm:text-2xl font-bold ${getMetricColor(metrics.biometric_metrics.frr, 'frr')}`}>
                  {metrics.biometric_metrics.frr}%
                </p>
                <p className="text-xs text-yellow-600 mt-1">False Reject Rate</p>
              </div>
              <div className="p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs sm:text-sm text-green-700 mb-1">EER</p>
                <p className={`text-xl sm:text-2xl font-bold ${getMetricColor(metrics.biometric_metrics.eer, 'eer')}`}>
                  {metrics.biometric_metrics.eer}%
                </p>
                <p className="text-xs text-green-600 mt-1">Equal Error Rate</p>
              </div>
              <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs sm:text-sm text-blue-700 mb-1">AUC</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-900">
                  {metrics.biometric_metrics.auc_score}%
                </p>
                <p className="text-xs text-blue-600 mt-1">Area Under Curve</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4">
              <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Accuracy</p>
                <p className="text-base sm:text-lg font-bold text-gray-900">
                  {metrics.biometric_metrics.accuracy}%
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Precision</p>
                <p className="text-base sm:text-lg font-bold text-gray-900">
                  {metrics.biometric_metrics.precision}%
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Recall</p>
                <p className="text-base sm:text-lg font-bold text-gray-900">
                  {metrics.biometric_metrics.recall}%
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-500 mb-1">F1 Score</p>
                <p className="text-base sm:text-lg font-bold text-gray-900">
                  {metrics.biometric_metrics.f1_score}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Arquitectura */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <BarChart3 className="w-5 h-5" />
            Arquitectura de Red
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Para red dinámica: mostrar Sequence Length */}
            {isDynamic && metrics.architecture.sequence_length && (
              <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Sequence Length</p>
                <p className="text-base sm:text-lg font-bold text-gray-900">
                  {metrics.architecture.sequence_length}
                </p>
              </div>
            )}

            {/* Para red dinámica: mostrar Feature Dim */}
            {isDynamic && metrics.architecture.feature_dim && (
              <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Feature Dim</p>
                <p className="text-base sm:text-lg font-bold text-gray-900">
                  {metrics.architecture.feature_dim}
                </p>
              </div>
            )}

            {/* Para red anatómica: mostrar Input Dim */}
            {!isDynamic && metrics.architecture.input_dim && (
              <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-500 mb-1">Input Dim</p>
                <p className="text-base sm:text-lg font-bold text-gray-900">
                  {metrics.architecture.input_dim}
                </p>
              </div>
            )}

            <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Embedding Dim</p>
              <p className="text-base sm:text-lg font-bold text-gray-900">
                {metrics.architecture.embedding_dim}
              </p>
            </div>
            
            <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Total Parámetros</p>
              <p className="text-base sm:text-lg font-bold text-gray-900">
                {metrics.architecture.total_parameters.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Capas de la red */}
          <div className="mt-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Capas:</p>
            <div className="flex flex-wrap gap-2">
              {metrics.architecture.layers && metrics.architecture.layers.length > 0 ? (
                metrics.architecture.layers.map((layer, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs sm:text-sm">
                    {typeof layer === 'number' ? `Dense(${layer})` : layer}
                  </Badge>
                ))
              ) : (
                <span className="text-xs sm:text-sm text-gray-500">No disponible</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente auxiliar para detalles de fusión
function FusionDetails({ config, weights }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Zap className="w-5 h-5" />
            Configuración de Fusión
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Estrategia</p>
              <p className="text-base sm:text-lg font-bold text-gray-900">
                {config.config.fusion_strategy}
              </p>
            </div>
            <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Calibración</p>
              <p className="text-base sm:text-lg font-bold text-gray-900">
                {config.config.calibration_method}
              </p>
            </div>
            <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Optimización</p>
              <p className="text-base sm:text-lg font-bold text-gray-900">
                {config.config.weight_optimization}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Target className="w-5 h-5" />
            Pesos Optimizados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 sm:p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
              <p className="text-xs sm:text-sm text-blue-700 mb-2">Peso Anatómico</p>
              <p className="text-3xl sm:text-4xl font-bold text-blue-900">
                {weights.weights && weights.weights.anatomical 
                  ? `${(weights.weights.anatomical * 100).toFixed(0)}%`
                  : '---'}
              </p>
              <p className="text-xs text-blue-600 mt-2">Características estáticas</p>
            </div>
            <div className="p-4 sm:p-6 bg-purple-50 rounded-lg border-2 border-purple-200">
              <p className="text-xs sm:text-sm text-purple-700 mb-2">Peso Dinámico</p>
              <p className="text-3xl sm:text-4xl font-bold text-purple-900">
                {weights.weights && weights.weights.dynamic
                  ? `${(weights.weights.dynamic * 100).toFixed(0)}%`
                  : '---'}
              </p>
              <p className="text-xs text-purple-600 mt-2">Características temporales</p>
            </div>
          </div>

          <div className="mt-4 p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-green-800">
              <CheckCircle className="w-4 h-4" />
              <span>Umbral óptimo: <strong>{weights.optimal_threshold || '---'}</strong></span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}