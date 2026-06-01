export default function HistoryScreen({ entries, total, macros, onClear, onBack }) {
  return (
    <section className="history-layout">
      <button className="back-button" type="button" onClick={onBack}>
        <span aria-hidden="true">‹</span>
        Back
      </button>

      <div className="history-header">
        <div>
          <span className="eyebrow">Today</span>
          <h1>{total.toLocaleString()} kcal</h1>
        </div>
        <div className="macro-row">
          <span>Carbs {macros.carbs}g</span>
          <span>Protein {macros.protein}g</span>
          <span>Fat {macros.fat}g</span>
        </div>
        {entries.length > 0 && (
          <button className="text-button" type="button" onClick={onClear}>
            Reset today
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="history-empty">
          <p>No orders logged today.</p>
          <p className="muted">Scan a dish to get started.</p>
        </div>
      ) : (
        <div className="history-list">
          {entries.map(entry => (
            <article className="history-card" key={entry.id}>
              <div className="history-card-top">
                <div>
                  <h3>{entry.dish}</h3>
                  {entry.restaurant && <p className="muted">{entry.restaurant}</p>}
                </div>
                <div className="history-cal">
                  <strong>{entry.calories}</strong>
                  <span>kcal</span>
                </div>
              </div>
              {entry.macros && (
                <div className="macro-row compact" style={{ marginTop: 10 }}>
                  <span>Carbs {entry.macros.carbs}g</span>
                  <span>Protein {entry.macros.protein}g</span>
                  <span>Fat {entry.macros.fat}g</span>
                </div>
              )}
              <p className="history-meta">
                {entry.orderId && <span>#{entry.orderId}</span>}
                <span>{formatTime(entry.orderedAt)}</span>
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
