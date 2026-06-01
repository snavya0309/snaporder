import { useRef, useState } from 'react'
import { identifyDish, searchByName } from '../utils/api'

export default function ScanScreen({ onResult }) {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')
  const [textDish, setTextDish] = useState('')
  const inputRef = useRef()

  async function handleImage(file) {
    if (!file) return
    const { base64, dataUrl } = await toImagePayload(file)
    setPreview(dataUrl)
    await runIdentify(base64, dataUrl)
  }

  async function handleMockScan() {
    setPreview('')
    await runIdentify('mock-image')
  }

  async function runIdentify(base64, imagePreview = '') {
    setLoading(true)
    setStep('Reading image...')
    setError('')
    await wait(250)
    setStep('Identifying dish...')
    try {
      const result = await identifyDish(base64)
      onResult({ ...result, imagePreview })
    } catch (err) {
      setError(err.message || 'Could not identify dish. Try a clearer photo.')
      setLoading(false)
      setStep('')
    }
  }

  return (
    <section className="scan-layout">
      <div className="scan-copy">
        <span className="eyebrow">AI food scan</span>
        <h1>Photo to plate, tracked.</h1>
        <p className="lede">Identify the dish, view nutrition, and pick a Swiggy match from the same flow.</p>
        <div className="action-row">
          <button className="primary-button" type="button" onClick={() => inputRef.current.click()} disabled={loading}>
            Scan dish
          </button>
          <button className="secondary-button" type="button" onClick={handleMockScan} disabled={loading}>
            Try mock scan
          </button>
        </div>
        {error && (
          <div className="search-fallback">
            <p className="error-text">{error}</p>
            <p className="lede" style={{ fontSize: '0.9rem', marginTop: 8 }}>Or search by dish name:</p>
            <form className="action-row" onSubmit={async e => {
              e.preventDefault()
              if (!textDish.trim()) return
              setLoading(true)
              setError('')
              setStep('Searching...')
              try {
                const result = await searchByName(textDish.trim())
                onResult({ ...result, imagePreview: '' })
              } catch {
                setError('Search failed. Try a different dish name.')
                setLoading(false)
                setStep('')
              }
            }}>
              <input
                className="dish-search-input"
                value={textDish}
                onChange={e => setTextDish(e.target.value)}
                placeholder="e.g. Masala Dosa, Burger..."
                disabled={loading}
              />
              <button className="primary-button" type="submit" disabled={loading || !textDish.trim()}>
                Search
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="scan-panel">
        <div className="scan-frame" aria-live="polite">
          {preview ? (
            <img src={preview} alt="Selected dish preview" />
          ) : (
            <div className="scan-target">
              <span />
              <strong>{loading ? step : 'Ready'}</strong>
            </div>
          )}
          {loading && (
            <div className="scan-overlay">
              <div className="spinner" />
              <p>{step}</p>
            </div>
          )}
        </div>
        <div className="stats-strip">
          <span>Claude Vision</span>
          <span>Nutrition DB</span>
          <span>Swiggy MCP mock</span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        onChange={e => handleImage(e.target.files[0])}
      />
    </section>
  )
}

function toImagePayload(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res({ dataUrl: r.result, base64: r.result.split(',')[1] })
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
