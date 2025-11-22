import { cn } from '../../utils/cn'

export function Table({ children, className }) {
  return (
    <div className="w-full overflow-auto">
      <table className={cn("w-full caption-bottom text-sm", className)}>
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ children, className }) {
  return (
    <thead className={cn("border-b bg-gray-50", className)}>
      {children}
    </thead>
  )
}

export function TableBody({ children, className }) {
  return (
    <tbody className={cn("divide-y divide-gray-200", className)}>
      {children}
    </tbody>
  )
}

export function TableRow({ children, className }) {
  return (
    <tr className={cn("hover:bg-gray-50 transition-colors", className)}>
      {children}
    </tr>
  )
}

export function TableHead({ children, className }) {
  return (
    <th className={cn("px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", className)}>
      {children}
    </th>
  )
}

export function TableCell({ children, className }) {
  return (
    <td className={cn("px-4 py-3 whitespace-nowrap text-sm text-gray-900", className)}>
      {children}
    </td>
  )
}