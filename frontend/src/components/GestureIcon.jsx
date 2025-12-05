import { Hand } from 'lucide-react'

const GESTURE_ICONS = {
    'Open_Palm': '✋',
    'Closed_Fist': '✊',
    'Victory': '✌️',
    'Thumb_Up': '👍',
    'Thumb_Down': '👎',
    'Pointing_Up': '☝️',
    'ILoveYou': '🤟'
}

const GESTURE_NAMES = {
    'Open_Palm': 'Palma Abierta',
    'Closed_Fist': 'Puño Cerrado',
    'Victory': 'Victoria',
    'Thumb_Up': 'Pulgar Arriba',
    'Thumb_Down': 'Pulgar Abajo',
    'Pointing_Up': 'Señalar Arriba',
    'ILoveYou': 'Te Amo'
}

export default function GestureIcon({ gesture, size = 'medium', showLabel = false, className = '' }) {
  const sizeClasses = {
    small: 'text-3xl',
    medium: 'text-5xl',
    large: 'text-7xl'
  }
  
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className={sizeClasses[size]}>
        {GESTURE_ICONS[gesture] || <Hand className="w-12 h-12" />}
      </div>
      {showLabel && (
        <span className="text-sm text-gray-600 font-medium">
          {GESTURE_NAMES[gesture] || gesture}
        </span>
      )}
    </div>
  )
}