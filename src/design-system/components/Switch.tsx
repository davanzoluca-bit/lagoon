export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <label className="ds-switch">
    <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span className="ds-switch__track" aria-hidden="true"><i/></span>
    <span className="ds-switch__label">{label}</span>
  </label>
}
