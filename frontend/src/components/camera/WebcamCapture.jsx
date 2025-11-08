import { useRef, useEffect, useState } from 'react'
import { Camera, CameraOff } from 'lucide-react'
import { Button } from '../ui'

export default function WebcamCapture({ onFrame, isActive = true }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (isActive) {
      // ⚠️ AGREGAR DELAY ANTES DE INICIAR CÁMARA
      const timer = setTimeout(() => {
        startCamera()
      }, 500)  // ← 500ms de delay para liberar recursos del backend
      
      return () => {
        clearTimeout(timer)
        stopCamera()
      }
    } else {
      stopCamera()
    }

    return () => stopCamera()
  }, [isActive])

  useEffect(() => {
    if (isStreaming && onFrame) {
      // Capturar y enviar frames cada 200ms (5 fps)
      intervalRef.current = setInterval(() => {
        captureAndSendFrame()
      }, 200)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isStreaming, onFrame])

  const startCamera = async () => {
    try {
      // ⚠️ VERIFICAR DISPOSITIVOS DISPONIBLES
      const existingDevices = await navigator.mediaDevices.enumerateDevices()
      console.log('📷 Dispositivos de video disponibles:', existingDevices.filter(d => d.kind === 'videoinput').length)
      
      // ⚠️ REINTENTAR CON BACKOFF SI FALLA (máximo 3 intentos)
      let retries = 3
      let stream = null
      
      while (retries > 0 && !stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user'
            }
          })
          break  // Éxito - salir del loop
        } catch (err) {
          retries--
          if (retries > 0) {
            console.log(`⚠️ Reintento ${4 - retries}/3 en 500ms...`)
            await new Promise(resolve => setTimeout(resolve, 500))
          } else {
            throw err  // Sin más reintentos - lanzar error
          }
        }
      }

      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream
        setIsStreaming(true)
        setError(null)
        console.log('✅ Cámara iniciada correctamente')
      }
    } catch (err) {
      setError('No se pudo acceder a la cámara')
      console.error('❌ Error al acceder a la cámara:', err)
      console.error('Detalles:', {
        name: err.name,
        message: err.message
      })
    }
  }

  const stopCamera = () => {
    // Detener intervalo de captura
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Detener stream de cámara
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks()
      tracks.forEach(track => track.stop())
      videoRef.current.srcObject = null
      setIsStreaming(false)
      console.log('📷 Cámara detenida y liberada')
    }
  }

  const captureAndSendFrame = () => {
    if (videoRef.current && canvasRef.current && onFrame) {
      const video = videoRef.current
      const canvas = canvasRef.current
      
      // Asegurarse de que el video tenga dimensiones válidas
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        return
      }
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0)
      
      // Convertir a base64
      try {
        const base64Image = canvas.toDataURL('image/jpeg', 0.9)
        
        if (base64Image && base64Image.startsWith('data:image')) {
          // Enviar base64 al callback
          onFrame(base64Image)
        } else {
          console.warn('⚠️ Frame capturado pero formato inválido')
        }
      } catch (error) {
        console.error('❌ Error convirtiendo frame a base64:', error)
      }
    }
  }

  return (
    <div className="relative">
      {error ? (
        <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
          <div className="text-center">
            <CameraOff className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={startCamera}
            >
              Reintentar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg bg-gray-900"
          />
          
          {/* Canvas oculto para captura de frames */}
          <canvas ref={canvasRef} className="hidden" />
          
          {isStreaming && (
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                CAPTURANDO
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}