// import React, { useState } from 'react'
// import { Card, CardHeader, CardTitle, CardContent, Button } from '../../components/ui'
// import { AlertCircle, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react'
// import { personalityApi } from '../../lib/api/personality'

// const PersonalityQuestionnaire = ({ userId, username, onComplete }) => {
//   const [responses, setResponses] = useState(Array(10).fill(0))
//   const [currentQuestion, setCurrentQuestion] = useState(0)
//   const [error, setError] = useState(null)
//   const [loading, setLoading] = useState(false)

//   const questions = [
//     "¿Te consideras una persona reservada y que suele hablar poco?",
//     "¿Sueles tratar a las personas con amabilidad y consideración?",
//     "¿Dirías que a veces eres un poco descuidado/a o desorganizado/a?",
//     "¿Te mantienes calmado/a y manejas bien el estrés en la mayoría de situaciones?",
//     "¿Prefieres realizar actividades o tareas que sean tradicionales o rutinarias?",
//     "¿Te consideras sociable y disfrutas pasar tiempo con otras personas?",
//     "¿En ocasiones puedes tener actitudes fuertes o generar conflictos con otras personas?",
//     "¿Sueles planificar tus actividades y cumplirlas con responsabilidad?",
//     "¿Te preocupas con facilidad o te pones nervioso/a rápidamente?",
//     "¿Tienes curiosidad y te gusta aprender sobre distintos temas?"
//   ]

//   const scaleLabels = [
//     "Totalmente en desacuerdo",
//     "En desacuerdo",
//     "Neutral",
//     "De acuerdo",
//     "Totalmente de acuerdo"
//   ]

//   const handleResponseSelect = (value) => {
//     const newResponses = [...responses]
//     newResponses[currentQuestion] = value
//     setResponses(newResponses)
//     setError(null)
//   }

//   const handleNext = () => {
//     if (responses[currentQuestion] === 0) {
//       setError('Por favor selecciona una respuesta antes de continuar')
//       return
//     }

//     if (currentQuestion < questions.length - 1) {
//       setCurrentQuestion(currentQuestion + 1)
//     } else {
//       handleSubmit()
//     }
//   }

//   const handlePrevious = () => {
//     if (currentQuestion > 0) {
//       setCurrentQuestion(currentQuestion - 1)
//       setError(null)
//     }
//   }

//   const handleSubmit = async () => {
//     if (responses.some(r => r === 0)) {
//       setError('Por favor responde todas las preguntas')
//       return
//     }

//     try {
//       setLoading(true)
//       setError(null)

//       console.log('Enviando cuestionario:')
//       console.log('  Usuario:', userId)
//       console.log('  Respuestas:', responses)

//       const result = await personalityApi.submitQuestionnaire(userId, responses)

//       console.log('Cuestionario guardado exitosamente')
//       console.log('  Respuestas guardadas:', result.raw_responses)

//       if (onComplete) {
//         onComplete(result)
//       }

//     } catch (err) {
//       console.error('Error guardando cuestionario:', err)
//       setError(err.response?.data?.detail || 'Error al guardar el cuestionario')
//     } finally {
//       setLoading(false)
//     }
//   }

//   const answeredCount = responses.filter(r => r !== 0).length
//   const progress = (answeredCount / questions.length) * 100

//   return (
//     <div className="max-w-3xl mx-auto px-4">
//       <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        
//         {/* Header */}
//         <div className="bg-gradient-to-r from-slate-100 via-blue-50 to-slate-100 border-b border-gray-200 px-6 py-4">
//           <div className="text-center">
//             <h2 className="text-2xl font-bold text-gray-800 mb-1">
//               Cuestionario de personalidad
//             </h2>
//             <p className="text-sm text-gray-600">
//               Hola <span className="font-semibold text-blue-600">{username}</span>, completa estas 10 preguntas breves
//             </p>
//           </div>
//         </div>

//         <div className="p-6">
          
//           {/* Barra de progreso */}
//           <div className="mb-6">
//             <div className="flex justify-between items-center mb-2">
//               <span className="text-sm font-medium text-gray-700">
//                 Pregunta {currentQuestion + 1} de {questions.length}
//               </span>
//               <span className="text-sm font-semibold text-blue-600">
//                 {answeredCount}/{questions.length}
//               </span>
//             </div>
            
//             <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
//               <div 
//                 className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
//                 style={{ width: `${progress}%` }}
//               />
//             </div>
//           </div>

//           {/* Pregunta actual */}
//           <div className="mb-6">
//             <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 mb-4 border border-blue-100">
//               <h3 className="text-base font-bold text-gray-800 leading-relaxed">
//                 {questions[currentQuestion]}
//               </h3>
//             </div>

//             {/* Opciones de respuesta */}
//             <div className="space-y-2">
//               {scaleLabels.map((label, index) => {
//                 const value = index + 1
//                 const isSelected = responses[currentQuestion] === value
                
//                 return (
//                   <button
//                     key={value}
//                     onClick={() => handleResponseSelect(value)}
//                     disabled={loading}
//                     className={`
//                       w-full p-3 rounded-lg border-2 text-left transition-all duration-200
//                       ${isSelected
//                         ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-cyan-50 shadow-md'
//                         : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
//                       }
//                       ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
//                     `}
//                   >
//                     <div className="flex items-center gap-3">
//                       <div className={`
//                         w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
//                         ${isSelected
//                           ? 'bg-blue-500 text-white'
//                           : 'bg-gray-200 text-gray-600'
//                         }
//                       `}>
//                         {value}
//                       </div>
                      
//                       <span className={`
//                         text-sm font-medium flex-1
//                         ${isSelected ? 'text-blue-700' : 'text-gray-700'}
//                       `}>
//                         {label}
//                       </span>
                      
//                       {isSelected && (
//                         <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
//                       )}
//                     </div>
//                   </button>
//                 )
//               })}
//             </div>
//           </div>

//           {/* Error */}
//           {error && (
//             <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
//               <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
//               <p className="text-sm text-red-700">{error}</p>
//             </div>
//           )}

//           {/* Botones de navegación */}
//           <div className="flex justify-between items-center gap-3">
//             <Button
//               onClick={handlePrevious}
//               disabled={currentQuestion === 0 || loading}
//               className="px-6 h-11 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
//             >
//               <ArrowLeft className="w-4 h-4 mr-2" />
//               Anterior
//             </Button>

//             <Button
//               onClick={handleNext}
//               disabled={loading}
//               className="px-6 h-11 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg"
//             >
//               {loading ? (
//                 <div className="flex items-center gap-2">
//                   <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
//                   Guardando...
//                 </div>
//               ) : currentQuestion === questions.length - 1 ? (
//                 <>
//                   Finalizar
//                   <CheckCircle className="w-4 h-4 ml-2" />
//                 </>
//               ) : (
//                 <>
//                   Siguiente
//                   <ArrowRight className="w-4 h-4 ml-2" />
//                 </>
//               )}
//             </Button>
//           </div>

//           {/* Indicador de preguntas */}
//           <div className="mt-5 flex justify-center gap-1.5">
//             {questions.map((_, index) => (
//               <div
//                 key={index}
//                 className={`
//                   h-1.5 rounded-full transition-all duration-300
//                   ${index === currentQuestion
//                     ? 'bg-blue-600 w-6'
//                     : responses[index] !== 0
//                       ? 'bg-blue-400 w-1.5'
//                       : 'bg-gray-300 w-1.5'
//                   }
//                 `}
//               />
//             ))}
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }

// export default PersonalityQuestionnaire


import React, { useState } from 'react'
import { Button } from '../../components/ui'
import { AlertCircle, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react'
import { personalityApi } from '../../lib/api/personality'

const PersonalityQuestionnaire = ({ userId, username, onComplete }) => {
  const [responses, setResponses] = useState(Array(10).fill(0))
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const questions = [
    "¿Te consideras una persona reservada y que suele hablar poco?",
    "¿Sueles tratar a las personas con amabilidad y consideración?",
    "¿Dirías que a veces eres un poco descuidado/a o desorganizado/a?",
    "¿Te mantienes calmado/a y manejas bien el estrés en la mayoría de situaciones?",
    "¿Prefieres realizar actividades o tareas que sean tradicionales o rutinarias?",
    "¿Te consideras sociable y disfrutas pasar tiempo con otras personas?",
    "¿En ocasiones puedes tener actitudes fuertes o generar conflictos con otras personas?",
    "¿Sueles planificar tus actividades y cumplirlas con responsabilidad?",
    "¿Te preocupas con facilidad o te pones nervioso/a rápidamente?",
    "¿Tienes curiosidad y te gusta aprender sobre distintos temas?"
  ]

  const scaleLabels = [
    "Totalmente en desacuerdo",
    "En desacuerdo",
    "Neutral",
    "De acuerdo",
    "Totalmente de acuerdo"
  ]

  const handleResponseSelect = (value) => {
    const newResponses = [...responses]
    newResponses[currentQuestion] = value
    setResponses(newResponses)
    setError(null)
  }

  const handleNext = () => {
    if (responses[currentQuestion] === 0) {
      setError('Por favor selecciona una respuesta antes de continuar')
      return
    }

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      handleSubmit()
    }
  }

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
      setError(null)
    }
  }

  const handleSubmit = async () => {
    if (responses.some(r => r === 0)) {
      setError('Por favor responde todas las preguntas')
      return
    }

    try {
      setLoading(true)
      setError(null)

      console.log('Enviando cuestionario:')
      console.log('  Usuario:', userId)
      console.log('  Respuestas:', responses)

      const result = await personalityApi.submitQuestionnaire(userId, responses)

      console.log('Cuestionario guardado exitosamente')
      console.log('  Respuestas guardadas:', result.raw_responses)

      if (onComplete) {
        onComplete(result)
      }

    } catch (err) {
      console.error('Error guardando cuestionario:', err)
      setError(err.response?.data?.detail || 'Error al guardar el cuestionario')
    } finally {
      setLoading(false)
    }
  }

  const answeredCount = responses.filter(r => r !== 0).length
  const progress = (answeredCount / questions.length) * 100

  return (
    <div className="max-w-3xl mx-auto">
      
      {/* Divider superior */}
      <div className="relative mb-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="px-4 bg-white text-sm font-semibold text-gray-500">
            Cuestionario de personalidad
          </span>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-gray-700">
            Pregunta {currentQuestion + 1} de {questions.length}
          </span>
          <span className="text-sm font-semibold" style={{ color: '#05A8F9' }}>
            {answeredCount}/{questions.length}
          </span>
        </div>
        
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full transition-all duration-500"
            style={{ 
              width: `${progress}%`,
              background: 'linear-gradient(to right, #00B8D4, #00ACC1)'
            }}
          />
        </div>
      </div>

      {/* Pregunta actual */}
      <div className="mb-6">
        <div 
          className="rounded-xl p-5 mb-6 border-2"
          style={{ 
            backgroundColor: '#F0F9FF',
            borderColor: '#BFDBFE'
          }}
        >
          <h3 className="text-lg font-bold text-gray-600 leading-relaxed">
            {questions[currentQuestion]}
          </h3>
        </div>

        {/* Opciones de respuesta */}
        <div className="space-y-3">
          {scaleLabels.map((label, index) => {
            const value = index + 1
            const isSelected = responses[currentQuestion] === value
            
            return (
              <button
                key={value}
                onClick={() => handleResponseSelect(value)}
                disabled={loading}
                className={`
                  w-full p-4 rounded-xl border-2 text-left transition-all duration-200
                  ${isSelected
                    ? 'shadow-md'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                  }
                  ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                style={{
                  borderColor: isSelected ? '#05A8F9' : undefined,
                  backgroundColor: isSelected ? '#F0F9FF' : undefined
                }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                      backgroundColor: isSelected ? '#05A8F9' : '#E5E7EB',
                      color: isSelected ? '#FFFFFF' : '#6B7280'
                    }}
                  >
                    {value}
                  </div>
                  
                  <span 
                    className="text-sm font-medium flex-1"
                    style={{
                      color: isSelected ? '#1E3A8A' : '#374151'
                    }}
                  >
                    {label}
                  </span>
                  
                  {isSelected && (
                    <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#05A8F9' }} />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {/* Botones de navegación */}
      <div className="flex justify-between items-center gap-4 mb-6">
        <Button
          onClick={handlePrevious}
          disabled={currentQuestion === 0 || loading}
          className="px-6 py-3 font-bold rounded-full transition-all duration-300 text-sm tracking-wide flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: currentQuestion === 0 || loading ? '#D1D5DB' : 'linear-gradient(to right, #00B8D4, #00ACC1)',
            color: '#FFFFFF',
            boxShadow: currentQuestion === 0 || loading ? 'none' : '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Anterior</span>
        </Button>

        <Button
          onClick={handleNext}
          disabled={loading}
          className="px-6 py-3 font-bold rounded-full transition-all duration-300 text-sm tracking-wide flex items-center gap-2"
          style={{
            background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
            color: '#FFFFFF',
            boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
          }}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Guardando...</span>
            </>
          ) : currentQuestion === questions.length - 1 ? (
            <>
              <span>Finalizar</span>
              <CheckCircle className="w-4 h-4" />
            </>
          ) : (
            <>
              <span>Siguiente</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>

      {/* Indicador de preguntas */}
      <div className="flex justify-center gap-2">
        {questions.map((_, index) => (
          <div
            key={index}
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: index === currentQuestion ? '24px' : '8px',
              backgroundColor: index === currentQuestion
                ? '#05A8F9'
                : responses[index] !== 0
                  ? '#93C5FD'
                  : '#D1D5DB'
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default PersonalityQuestionnaire