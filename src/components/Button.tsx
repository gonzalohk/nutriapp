import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const styles: Record<Variant, string> = {
  primary: 'bg-brand text-white active:bg-brand-dark',
  secondary: 'bg-white text-slate-900 border border-slate-300 active:bg-slate-100',
  danger: 'bg-red-700 text-white active:bg-red-800',
  ghost: 'bg-transparent text-brand active:bg-slate-100',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  block?: boolean
}

/** Touch-friendly button: at least 48 px tall, always with a text label. */
export function Button({ variant = 'primary', block, className = '', type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`min-h-12 rounded-xl px-4 text-base font-semibold disabled:opacity-50 ${styles[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  )
}
