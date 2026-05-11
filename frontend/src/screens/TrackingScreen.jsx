import { useEffect, useState } from 'react'
import { reportIssue, trackOrder } from '../utils/api'

export default function TrackingScreen({ order, onDone }) {
  const [status, setStatus] = useState(order?.status || 'confirmed')
  const [eta, setEta] = useState(order?.eta || 0)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)

  useEffect(() => {
    if (!order?.orderId) return undefined

    let cancelled = false
    let interval

    async function refresh() {
      try {
        const update = await trackOrder(order.orderId)
        if (cancelled) return
        setStatus(update.status)
        setEta(update.eta)
        setError('')
        if (update.status === 'delivered') clearInterval(interval)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Tracking update failed.')
      }
    }

    const firstPoll = setTimeout(refresh, 1200)
    interval = setInterval(refresh, 10000)
    return () => {
      cancelled = true
      clearTimeout(firstPoll)
      clearInterval(interval)
    }
  }, [order?.orderId])

  const steps = ['confirmed', 'preparing', 'out_for_delivery', 'delivered']
  const currentIdx = steps.indexOf(status)
  const itemCount = order?.itemCount || 1

  async function handleReportIssue() {
    setError('')
    try {
      const result = await reportIssue({
        orderId: order?.orderId,
        issueType: 'tracking',
        message: `User reported issue while order status is ${status}`
      })
      setReport(result)
    } catch (err) {
      setError(err.message || 'Could not report issue.')
    }
  }

  return (
    <section className="tracking-layout">
      <div className="tracking-card">
        <span className="eyebrow">Order placed</span>
        <h1>{order?.dish || 'Your dish'} is on the way</h1>
        <p className="muted">
          #{order?.orderId} · {itemCount} item{itemCount === 1 ? '' : 's'}
          {order?.restaurant?.name ? ` from ${order.restaurant.name}` : ''}
        </p>
        <div className="eta-block">
          <span>ETA</span>
          <strong>{eta === 0 ? 'Arrived' : `${eta} min`}</strong>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="timeline">
        {steps.map((step, index) => {
          const complete = index <= currentIdx
          return (
            <div className={`timeline-step ${complete ? 'complete' : ''}`} key={step}>
              <span className="step-dot">{complete ? '✓' : ''}</span>
              <div>
                <strong>{formatStatus(step)}</strong>
                <p>{stepDescriptions[step]}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="action-row end">
        <button className="secondary-button" type="button" onClick={handleReportIssue}>
          Report issue
        </button>
        <button className="secondary-button" type="button" onClick={onDone}>
          Scan another dish
        </button>
      </div>
      {report && <p className="support-note">Support report {report.reportId} received.</p>}
    </section>
  )
}

const stepDescriptions = {
  confirmed: 'Restaurant received the order.',
  preparing: 'Kitchen is preparing the item.',
  out_for_delivery: 'Pickup is complete.',
  delivered: 'Order completed.'
}

function formatStatus(value) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}
