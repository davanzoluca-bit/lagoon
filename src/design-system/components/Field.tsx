import type { ReactNode } from 'react'

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`ds-field ${className}`.trim()}>{label}{children}</label>
}
