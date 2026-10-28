import type { ReactNode } from 'react'

export function CardHeader({ eyebrow, title, description, action }: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return <header className="panel-heading ds-card-header">
    <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2>{description && <p>{description}</p>}</div>
    {action}
  </header>
}
