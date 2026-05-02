import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  delta?: number
  icon?: React.ReactNode
  colorScheme?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
  className?: string
}

const colorSchemes = {
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  green: 'bg-green-50 text-green-600 border-green-200',
  purple: 'bg-purple-50 text-purple-600 border-purple-200',
  orange: 'bg-orange-50 text-orange-600 border-orange-200',
  red: 'bg-red-50 text-red-600 border-red-200',
}

const iconColors = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600',
  red: 'bg-red-100 text-red-600',
}

export function KPICard({
  title,
  value,
  subtitle,
  delta,
  icon,
  colorScheme = 'blue',
  className,
}: KPICardProps) {
  const isPositive = delta !== undefined && delta >= 0

  return (
    <Card className={cn('border', colorSchemes[colorScheme], className)}>
      <CardContent className="p-3 md:p-4 lg:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 md:space-y-2 min-w-0 flex-1">
            <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <p className="text-lg md:text-xl lg:text-2xl font-bold break-all leading-tight">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs md:text-sm text-muted-foreground">
                {subtitle}
              </p>
            )}
            {delta !== undefined && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs md:text-sm font-medium',
                  isPositive ? 'text-green-600' : 'text-red-600'
                )}
              >
                {isPositive ? (
                  <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
                ) : (
                  <TrendingDown className="h-3 w-3 md:h-4 md:w-4" />
                )}
                <span>
                  {isPositive ? '+' : ''}
                  {delta.toFixed(1)}%
                </span>
                <span className="text-muted-foreground font-normal hidden sm:inline">
                  vs last month
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div className={cn('p-2 md:p-3 rounded-lg flex-shrink-0', iconColors[colorScheme])}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
