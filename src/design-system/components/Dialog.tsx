import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { IconButton } from './IconButton'
import { X } from 'lucide-react'

export function Dialog({ eyebrow, title, description, onClose, children }: {
  eyebrow: string
  title: string
  description: string
  onClose: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const focusable = () => dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')
    focusable()?.[0]?.focus()
    const manageKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items?.length) { event.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', manageKeys)
    return () => {
      window.removeEventListener('keydown', manageKeys)
      previouslyFocused?.focus()
    }
  }, [])

  return <div className="ds-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="ds-dialog" role="dialog" aria-modal="true" aria-labelledby="ds-dialog-title">
      <header className="ds-dialog__header">
        <div><div className="ds-dialog__eyebrow">{eyebrow}</div><h2 className="ds-dialog__title" id="ds-dialog-title">{title}</h2><p className="ds-dialog__description">{description}</p></div>
        <IconButton label="Close" onClick={onClose}><X size={19}/></IconButton>
      </header>
      {children}
    </section>
  </div>
}
