export function Avatar({ initials, tone = 'me', className = '' }: { initials: string; tone?: string; className?: string }) {
  return <div className={`avatar avatar-${tone} ${className}`.trim()} role="img" aria-label={initials}>{initials}</div>
}
