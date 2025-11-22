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
  const [activeTab, setActiveTab] = useState('anatomical') // 'anatomical' | 'dynamic' | 'fusion'
  
  // Estado de redes
  const [anatomicalMetrics, setAnatomicalMetrics] = useState(null)
  const [dynamicMetrics, setDynamicMetrics] = useState(null)
  const [fusionConfig, setFusionConfig] = useState(null)
  const [fusionWeights, setFusionWeights] = useState(null)
  
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
      const [anatomical, dynamic, fusion, weights] = await Promise.all([
        systemApi.getAnatomicalNetworkMetrics(),
        systemApi.getDynamicNetworkMetrics(),
        systemApi.getFusionConfig(),
        systemApi.getFusionWeights()
      ])
      
      setAnatomicalMetrics(anatomical)
      setDynamicMetrics(dynamic)
      setFusionConfig(fusion)
      setFusionWeights(weights)
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