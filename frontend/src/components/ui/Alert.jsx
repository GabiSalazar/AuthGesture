import { cn } from '../../utils/cn'
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

export function Alert({ 
  variant = 'info', 
  children, 
  className 
}) {
  const variants = {
    success: {
      container: 'bg-green-50 border-green-200 text-green-800',
      icon: CheckCircle,
      iconColor: 'text-green-600'
    },
    danger: {
      container: 'bg-red-50 border-red-200 text-red-800',
      icon: AlertCircle,
      iconColor: 'text-red-600'
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      icon: AlertTriangle,
      iconColor: 'text-yellow-600'
    },
    info: {
      container: 'bg-blue-50 border-blue-200 text-blue-800',
      icon: Info,
      iconColor: 'text-blue-600'
    }
  }

  const config = variants[variant] || variants.info
  const Icon = config.icon

  return (
    <div className={cn(
      "p-4 rounded-lg border flex items-start gap-3",
      config.container,
      className
    )}>
      <Icon className={cn("w-5 h-5 flex-shrink-0", config.iconColor)} />
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}