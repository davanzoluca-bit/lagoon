import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary'
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }

export function Button({ variant = 'secondary', className = '', ...props }: ButtonProps) {
  return <button className={`button ds-button ds-button--${variant} ${className}`.trim()} {...props}/>
}
