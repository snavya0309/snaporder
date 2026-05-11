import { useMemo, useState } from 'react'
import { updateCart } from '../utils/api'

export default function ResultsScreen({ result, onCheckout, onBack }) {
  const [quantities, setQuantities] = useState(() => createInitialQuantities(result.matches || []))
  const [buildingCart, setBuildingCart] = useState(false)
  const [error, setError] = useState('')

  const confidence = Math.round((result.confidence || 0) * 100)
  const matches = result.matches || []
  const selectedItems = useMemo(
    () => matches
      .map(match => ({ ...match, quantity: quantities[getMatchKey(match)] || 0 }))
      .filter(match => match.quantity > 0),
    [matches, quantities]
  )
  const itemCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  async function handleCheckout() {
    if (selectedItems.length === 0) {
      setError('Select at least one item.')
      return
    }

    setBuildingCart(true)
    setError('')
    try {
      const { cart } = await updateCart({
        addressId: selectedItems[0].addressId,
        restaurantId: selectedItems[0].restaurantId,
        items: selectedItems.map(item => ({
          itemId: item.itemId,
          quantity: item.quantity
        }))
      })
      onCheckout(cart)
    } catch (err) {
      setError(err.message || 'Could not build cart. Please try again.')
      setBuildingCart(false)
    }
  }

  function updateQuantity(match, change) {
    const key = getMatchKey(match)
    if (change > 0) {
      const selectedRestaurantId = getSelectedRestaurantId(quantities, matches)
      if (selectedRestaurantId && selectedRestaurantId !== match.restaurantId) {
        const shouldReplace = window.confirm('Swiggy carts can contain items from one restaurant. Replace the current cart selection?')
        if (!shouldReplace) return
        setQuantities({ [key]: 1 })
        return
      }
    }
    setQuantities(current => ({
      ...current,
      [key]: Math.max(0, Math.min(9, (current[key] || 0) + change))
    }))
  }

  return (
    <section className="results-layout">
      <button className="back-button" type="button" onClick={onBack} aria-label="Back to scan">
        <span aria-hidden="true">‹</span>
        Back
      </button>

      <div className="result-hero">
        <div className="dish-media">
          {result.imagePreview ? (
            <img src={result.imagePreview} alt={result.dish} />
          ) : (
            <div className="dish-placeholder">
              <span>{result.dish.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>

        <div className="dish-summary">
          <span className="eyebrow">{result.cuisine} cuisine</span>
          <h1>{result.dish}</h1>
          <p className="confidence">{confidence}% visual match</p>
          {result.calories && result.macros ? (
            <div className="nutrition-band">
              <div>
                <span>Calories</span>
                <strong>{result.calories} kcal</strong>
              </div>
              <div className="macro-row">
                <span>Carbs {result.macros.carbs}g</span>
                <span>Protein {result.macros.protein}g</span>
                <span>Fat {result.macros.fat}g</span>
              </div>
            </div>
          ) : (
            <p className="muted">Nutrition data is not mapped for this dish yet.</p>
          )}
        </div>
      </div>

      <div className="section-heading">
        <h2>Order Matches</h2>
        <span>{itemCount} item{itemCount === 1 ? '' : 's'} selected</span>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="match-list">
        {matches.map(match => {
          const key = `${match.restaurantId}:${match.itemId}`
          const quantity = quantities[key] || 0
          return (
            <article className="match-card" key={key}>
              <div>
                <span className="platform">{match.platform}</span>
                <h3>{match.restaurant}</h3>
                <p>{match.itemName || result.dish}</p>
                <div className="match-meta">
                  <span>{match.deliveryTime} min</span>
                  <span>{match.distance} km</span>
                  <span>{match.rating.toFixed(1)} rating</span>
                </div>
              </div>
              <div className="match-order">
                <strong>{formatPrice(match.price)}</strong>
                <div className="quantity-stepper" aria-label={`${match.restaurant} quantity`}>
                  <button type="button" onClick={() => updateQuantity(match, -1)} disabled={quantity === 0 || buildingCart}>
                    −
                  </button>
                  <span>{quantity}</span>
                  <button type="button" onClick={() => updateQuantity(match, 1)} disabled={quantity >= 9 || buildingCart}>
                    +
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <div className="cart-bar" aria-live="polite">
        <div>
          <span>{itemCount} item{itemCount === 1 ? '' : 's'}</span>
          <strong>{formatPrice(subtotal)}</strong>
        </div>
        <button className="primary-button" type="button" onClick={handleCheckout} disabled={itemCount === 0 || buildingCart}>
          {buildingCart ? 'Building cart' : 'Review cart'}
        </button>
      </div>
    </section>
  )
}

function createInitialQuantities(matches) {
  if (matches.length === 0) return {}
  return { [getMatchKey(matches[0])]: 1 }
}

function getMatchKey(match) {
  return `${match.restaurantId}:${match.itemId}`
}

function getSelectedRestaurantId(quantities, matches) {
  const selected = matches.find(match => quantities[getMatchKey(match)] > 0)
  return selected?.restaurantId || ''
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value)
}
