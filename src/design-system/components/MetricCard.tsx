import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card } from './Card'

type MetricCardProps = {
  icon: ReactNode
  label: string
  value: string | number
  unit: string
  detail: string
  color: string
  trend: string
  positive?: boolean
}

export function MetricCard({ icon, label, value, unit, detail, color, trend, positive }: MetricCardProps) {
  return <Card as="article" className="metric-card">
    <div className="metric-top"><span className={`metric-icon ${color}`}>{icon}</span>{trend && <span className={`metric-trend ${positive ? 'trend-up' : ''}`}>{positive ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>} {trend}</span>}</div>
    <div className="metric-label">{label}</div><div className="metric-value">{value}<small>{unit}</small></div><div className="metric-detail">{detail}</div>
    {trend && <div className={`metric-sparkline ${color}`}><svg viewBox="0 0 110 25" preserveAspectRatio="none" aria-hidden="true"><path d="M0 18 C12 20 17 7 29 10 S43 23 55 15 S71 5 80 10 S97 16 110 4"/></svg></div>}
  </Card>
}
