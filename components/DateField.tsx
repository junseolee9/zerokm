'use client'

import { useRef, useState } from 'react'

interface Props {
  name: string
  label: string
  defaultValue?: string
  onChange?: (value: string) => void
}

// A real <input type="date"> renders its calendar-icon-plus-locale-text combo
// ("연도. 월. 일." etc. — follows OS locale, can't be restyled). We keep the
// native input for its picker behavior but make it invisible and full-size,
// then show our own English label/value on top; clicks land on the real
// input underneath and open the browser's date picker as normal.
export function DateField({ name, label, defaultValue = '', onChange }: Props) {
  const [value, setValue] = useState(defaultValue)
  const ref = useRef<HTMLInputElement>(null)

  const display = value
    ? new Date(value + 'T12:00:00').toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })
    : label

  return (
    <div
      className="input-bauhaus date-field"
      onClick={() => { ref.current?.showPicker?.(); ref.current?.focus() }}
    >
      <span className={value ? 'date-field-value' : 'date-field-placeholder'}>{display}</span>
      <input
        ref={ref}
        type="date"
        name={name}
        className="date-field-native"
        value={value}
        onChange={e => { setValue(e.target.value); onChange?.(e.target.value) }}
      />
    </div>
  )
}
