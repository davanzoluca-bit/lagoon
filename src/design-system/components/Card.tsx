import type { ElementType, HTMLAttributes, ReactNode } from 'react'

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType
  children: ReactNode
}

export function Card({ as: Tag = 'section', className = '', children, ...props }: CardProps) {
  return <Tag className={`ds-card ${className}`.trim()} {...props}>{children}</Tag>
}
