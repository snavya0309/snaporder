export default function CalorieTracker({ total, itemCount, macros, entries, onClear }) {
  return (
    <aside className="tracker" aria-label="Daily calorie tracker">
      <div>
        <span className="eyebrow">Today</span>
        <strong>{total.toLocaleString()} kcal</strong>
      </div>
      <div className="macro-row compact" aria-label="Daily macros">
        <span>C {macros.carbs}g</span>
        <span>P {macros.protein}g</span>
        <span>F {macros.fat}g</span>
      </div>
      <div className="tracker-foot">
        <span>{entries.length > 0 ? `${itemCount} item${itemCount === 1 ? '' : 's'} logged` : 'No items logged'}</span>
        {entries.length > 0 && (
          <button className="text-button" type="button" onClick={onClear}>
            Reset
          </button>
        )}
      </div>
    </aside>
  )
}
