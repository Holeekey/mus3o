// Exploración libre: todas las puertas abiertas. Sin marcar, las puertas piden la llave (modo mazmorra).
export function FreeExploreToggle({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <strong>Exploración libre</strong>
        <small>{checked ? 'Todas las puertas están abiertas.' : 'Las puertas se abren con la llave de cada sala.'}</small>
      </span>
    </label>
  )
}
