import { X } from 'lucide-react'
import { cn } from '../../utils/cn'

export function Dialog({ open, onClose, children, size = 'md' }) {
  if (!open) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-7xl'
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className={cn(
            "relative w-full bg-white rounded-lg shadow-xl",
            sizeClasses[size]
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export function DialogHeader({ children, className }) {
  return (
    <div className={cn("px-6 py-4 border-b border-gray-200", className)}>
      {children}
    </div>
  )
}

export function DialogTitle({ children, className }) {
  return (
    <h2 className={cn("text-xl font-semibold text-gray-900", className)}>
      {children}
    </h2>
  )
}

export function DialogContent({ children, className }) {
  return (
    <div className={cn("px-6 py-4 max-h-[70vh] overflow-y-auto", className)}>
      {children}
    </div>
  )
}

export function DialogFooter({ children, className }) {
  return (
    <div className={cn("px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3", className)}>
      {children}
    </div>
  )
}

export function DialogClose({ onClose, className }) {
  return (
    <button
      onClick={onClose}
      className={cn(
        "absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors",
        className
      )}
    >
      <X className="w-5 h-5" />
    </button>
  )
}