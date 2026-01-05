import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react'
import { Camera, CameraOff } from 'lucide-react'
import { Button } from '../ui'

// export default function WebcamCapture({ onFrame, isActive = true }) {
const WebcamCapture = forwardRef(({ onFrame, isActive = true }, ref) => {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)
  const mountedRef = useRef(true)

  // EXPONER stopCamera al componente padre
  useImperativeHandle(ref, () => ({
    stopCamera: () => {
      console.log('[WebcamCapture] stopCamera llamado externamente')
      stopCamera()
    }
  }))

  useEffect(() => {
    let timeoutId = null
    mountedRef.current = true
    
    const initCamera = async () => {
      if (!mountedRef.current || !isActive) return
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (mountedRef.current && isActive) {
        startCamera()
      }
    }
    
    if (isActive) {
      timeoutId = setTimeout(initCamera, 300)
    } else {
      stopCamera()
    }

    return () => {
      mountedRef.current = false
      if (timeoutId) clearTimeout(timeoutId)
      stopCamera()
    }
  }, [isActive])

  useEffect(() => {
    if (isStreaming && onFrame) {
      intervalRef.current = setInterval(() => {
        captureAndSendFrame()
      }, 200)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isStreaming, onFrame])

  const startCamera = async () => {
    try {
      console.log('[WebcamCapture] Iniciando acceso a cámara')
      
      if (videoRef.current?.srcObject) {
        console.log('[WebcamCapture] Stream existente detectado - liberando')
        stopCamera()
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      let retries = 3
      let stream = null
      
      while (retries > 0 && !stream && mountedRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user'
            }
          })
          break
          
        } catch (err) {
          console.error(`[WebcamCapture] Error intento ${4 - retries}/3:`, err.name, err.message)
          
          retries--
          if (retries > 0) {
            const waitTime = (4 - retries) * 500
            await new Promise(resolve => setTimeout(resolve, waitTime))
          } else {
            throw err
          }
        }
      }

      if (videoRef.current && stream && mountedRef.current) {
        videoRef.current.srcObject = stream
        setIsStreaming(true)
        setError(null)
        console.log('[WebcamCapture] Cámara iniciada exitosamente')
      } else if (!mountedRef.current && stream) {
        console.log('[WebcamCapture] Componente desmontado - liberando stream')
        stream.getTracks().forEach(track => track.stop())
      }
      
    } catch (err) {
      console.error('[WebcamCapture] Error final:', err.name, err.message)
      
      let errorMessage = 'No se pudo acceder a la cámara'
      if (err.name === 'NotReadableError') {
        errorMessage = 'Cámara en uso por otra aplicación. Cierra otras apps que usen la cámara.'
      } else if (err.name === 'NotAllowedError') {
        errorMessage = 'Permiso de cámara denegado. Permite el acceso en la configuración del navegador.'
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No se encontró ninguna cámara conectada.'
      }
      
      if (mountedRef.current) {
        setError(errorMessage)
      }
    }
  }

  // const stopCamera = () => {
  //   if (intervalRef.current) {
  //     clearInterval(intervalRef.current)
  //     intervalRef.current = null
  //   }

  //   if (videoRef.current?.srcObject) {
  //     const stream = videoRef.current.srcObject
  //     const tracks = stream.getTracks()
      
  //     tracks.forEach(track => track.stop())
  //     videoRef.current.srcObject = null
      
  //     if (mountedRef.current) {
  //       setIsStreaming(false)
  //     }
      
  //     console.log('[WebcamCapture] Cámara liberada')
  //   }
  // }

  const stopCamera = () => {
    console.log('[WebcamCapture] Deteniendo cámara...')
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject
      const tracks = stream.getTracks()
      
      tracks.forEach(track => {
        track.stop()
        console.log(`[WebcamCapture] Track ${track.kind} detenido`)
      })
      videoRef.current.srcObject = null
      
      if (mountedRef.current) {
        setIsStreaming(false)
      }
      
      console.log('[WebcamCapture] ✓ Cámara liberada completamente')
    }
  }

  const captureAndSendFrame = () => {
    if (!videoRef.current || !canvasRef.current || !onFrame) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    
    if (video.videoWidth === 0 || video.videoHeight === 0) return
    
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    
    try {
      const base64Image = canvas.toDataURL('image/jpeg', 0.9)
      
      if (base64Image && base64Image.startsWith('data:image')) {
        onFrame(base64Image)
      }
    } catch (error) {
      console.error('[WebcamCapture] Error convirtiendo frame:', error)
    }
  }

  return (
    <div className="relative">
      {error ? (
        <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
          <div className="text-center px-4">
            <CameraOff className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-sm mb-2">{error}</p>
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
})


WebcamCapture.displayName = 'WebcamCapture'

export default WebcamCapture