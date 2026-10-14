import type { InputHTMLAttributes } from "react"

interface FloatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function FloatingInput({ label, id, className, ...props }: FloatingInputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-")

  return (
    <div className="relative">
      <input
        id={inputId}
        placeholder=" "
        {...props}
        value={props.value ?? ""}
        className={`peer w-full rounded-lg border border-gray-200 bg-white px-3 pb-2 pt-4 text-sm font-medium text-ink-strong outline-none transition-colors focus:border-primary ${className ?? ""}`}
      />
      <label
        htmlFor={inputId}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 bg-white px-1 text-sm text-gray-400 transition-all duration-150 peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs peer-focus:font-medium peer-focus:text-primary peer-not-placeholder-shown:top-0 peer-not-placeholder-shown:-translate-y-1/2 peer-not-placeholder-shown:text-xs peer-not-placeholder-shown:text-gray-500"
      >
        {label}
      </label>
    </div>
  )
}