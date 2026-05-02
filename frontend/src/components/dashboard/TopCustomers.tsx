import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/formatters'

interface TopCustomersProps {
  customers: { company: string; revenue: number }[]
  maxRevenue?: number
}

export function TopCustomers({ customers, maxRevenue }: TopCustomersProps) {
  const max = maxRevenue || Math.max(...customers.map((c) => c.revenue), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Top Customers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {customers.map((customer, index) => {
            const percentage = (customer.revenue / max) * 100
            return (
              <div key={customer.company} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground w-6">
                      #{index + 1}
                    </span>
                    <span className="text-sm font-medium truncate max-w-[150px]">
                      {customer.company}
                    </span>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatCurrency(customer.revenue)}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
          {customers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No customers yet
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
