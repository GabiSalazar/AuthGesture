import { useState, useEffect } from 'react'
import { adminApi } from '../../../lib/api/admin'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogClose,
  Badge,
  Spinner,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button
} from '../../../components/ui'
import {
  User,
  Mail,
  Phone,
  Calendar,
  Users as UsersIcon,
  FileText,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Download
} from 'lucide-react'

export default function UserDetailsModal({ user, open, onClose }) {
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState([])
  const [authAttempts, setAuthAttempts] = useState([])
  const [activeTab, setActiveTab] = useState('info') // 'info', 'templates', 'history'

  useEffect(() => {
    if (open && user) {
      loadUserData()
    }
  }, [open, user])

  const loadUserData = async () => {
    try {
      setLoading(true)
      
      const [templatesRes, attemptsRes] = await Promise.all([
        adminApi.getUserTemplates(user.user_id),
        adminApi.getUserAuthAttempts(user.user_id, 50)
      ])
      
      setTemplates(templatesRes.templates || [])
      setAuthAttempts(attemptsRes.attempts || [])
    } catch (err) {
      console.error('Error cargando datos del usuario:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatAuthDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getGestureEmoji = (gesture) => {
    const emojis = {
      'Open_Palm': '🖐️',
      'Closed_Fist': '✊',
      'Victory': '✌️',
      'Thumb_Up': '👍',
      'Thumb_Down': '👎',
      'Pointing_Up': '☝️',
      'ILoveYou': '🤟'
    }
    return emojis[gesture] || '👋'
  }

  const exportToCSV = () => {
    // Exportar historial de autenticaciones a CSV
    const headers = ['Fecha', 'Tipo', 'Resultado', 'Confidence', 'Anatómico', 'Dinámico', 'Fusionado', 'IP']
    const rows = authAttempts.map(attempt => [
      attempt.date,
      attempt.auth_type,
      attempt.result,
      attempt.confidence,
      attempt.anatomical_score,
      attempt.dynamic_score,
      attempt.fused_score,
      attempt.ip_address || 'N/A'
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `user_${user.user_id}_history.csv`
    a.click()
  }

  if (!user) return null

  return (
    <Dialog open={open} onClose={onClose} size="xl">
      <DialogHeader>
        <DialogTitle>Detalles del Usuario</DialogTitle>
        <DialogClose onClose={onClose} />
      </DialogHeader>

      <DialogContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'info'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <User className="w-4 h-4 inline mr-2" />
                Información
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'templates'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Templates ({templates.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                Historial ({authAttempts.length})
              </button>
            </div>

            {/* Tab: Información */}
            {activeTab === 'info' && (
              <div className="space-y-6">
                {/* Información Personal */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Información Personal
                  </h3>
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-500">Nombre Completo</p>
                      <p className="text-base font-medium text-gray-900">{user.username}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">User ID</p>
                      <p className="text-base font-mono text-gray-900">{user.user_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Mail className="w-4 h-4" /> Email
                      </p>
                      <p className="text-base text-gray-900">{user.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone className="w-4 h-4" /> Teléfono
                      </p>
                      <p className="text-base text-gray-900">{user.phone_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Edad</p>
                      <p className="text-base text-gray-900">{user.age} años</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Género</p>
                      <Badge variant={user.gender === 'Masculino' ? 'primary' : 'info'}>
                        {user.gender}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="w-4 h-4" /> Fecha de Registro
                      </p>
                      <p className="text-base text-gray-900">{formatDate(user.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="w-4 h-4" /> Última Actividad
                      </p>
                      <p className="text-base text-gray-900">{formatDate(user.last_activity)}</p>
                    </div>
                  </div>
                </div>

                {/* Secuencia de Gestos */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Secuencia de Gestos
                  </h3>
                  <div className="flex gap-4 bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-lg border border-blue-200">
                    {user.gesture_sequence?.map((gesture, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-2">
                        <div className="text-5xl">{getGestureEmoji(gesture)}</div>
                        <div className="text-xs font-medium text-gray-700">
                          {gesture.replace('_', ' ')}
                        </div>
                        <Badge variant="primary" className="text-xs">
                          #{idx + 1}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Estadísticas */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Estadísticas Biométricas
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-700 mb-1">Total Templates</p>
                      <p className="text-2xl font-bold text-blue-900">{user.total_templates}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <p className="text-sm text-green-700 mb-1">Enrollments</p>
                      <p className="text-2xl font-bold text-green-900">{user.total_enrollments}</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <p className="text-sm text-purple-700 mb-1">Tasa de Éxito</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {user.verification_success_rate?.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Templates */}
            {activeTab === 'templates' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Templates Biométricos
                  </h3>
                  <p className="text-sm text-gray-500">
                    Total: {templates.length} templates
                  </p>
                </div>
                
                {templates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay templates disponibles
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Gesto</TableHead>
                          <TableHead>Quality Score</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Bootstrap</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {templates.map((template, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Badge variant={
                                template.template_type === 'anatomical' ? 'primary' : 'info'
                              }>
                                {template.template_type === 'anatomical' ? 'Anatómico' : 'Dinámico'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-xl mr-2">
                                {getGestureEmoji(template.gesture_name)}
                              </span>
                              {template.gesture_name}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      template.quality_score >= 0.8
                                        ? 'bg-green-500'
                                        : template.quality_score >= 0.6
                                        ? 'bg-yellow-500'
                                        : 'bg-red-500'
                                    }`}
                                    style={{ width: `${template.quality_score * 100}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium">
                                  {(template.quality_score * 100).toFixed(0)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {(template.confidence * 100).toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {formatDate(template.created_at)}
                            </TableCell>
                            <TableCell>
                              {template.is_bootstrap ? (
                                <Badge variant="warning">Bootstrap</Badge>
                              ) : (
                                <Badge variant="success">Normal</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Historial */}
            {activeTab === 'history' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Historial de Autenticaciones
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportToCSV}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Exportar CSV
                  </Button>
                </div>

                {authAttempts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay intentos de autenticación registrados
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Resultado</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Scores</TableHead>
                          <TableHead>IP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {authAttempts.map((attempt, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-sm text-gray-600">
                              {formatAuthDate(attempt.date)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                attempt.auth_type === 'verification' ? 'primary' : 'info'
                              }>
                                {attempt.auth_type === 'verification' ? 'Verificación' : 'Identificación'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {attempt.result === 'success' ? (
                                <Badge variant="success" className="flex items-center gap-1 w-fit">
                                  <CheckCircle className="w-3 h-3" />
                                  Exitoso
                                </Badge>
                              ) : (
                                <Badge variant="danger" className="flex items-center gap-1 w-fit">
                                  <XCircle className="w-3 h-3" />
                                  Fallido
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">
                                {(attempt.confidence * 100).toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500">A:</span>
                                  <span className="font-mono">{attempt.anatomical_score.toFixed(3)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500">D:</span>
                                  <span className="font-mono">{attempt.dynamic_score.toFixed(3)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500">F:</span>
                                  <span className="font-mono font-bold">{attempt.fused_score.toFixed(3)}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {attempt.ip_address || 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}