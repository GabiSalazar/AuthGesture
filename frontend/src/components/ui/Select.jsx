import { cn } from '../../utils/cn'

export function Select({ 
  label, 
  error, 
  className,
  children,
  ...props 
}) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        className={cn(
          "w-full px-3 py-2 border rounded-lg transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          "bg-white cursor-pointer",
          error 
            ? "border-red-500 focus:ring-red-500" 
            : "border-gray-300",
          props.disabled && "bg-gray-100 cursor-not-allowed",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}