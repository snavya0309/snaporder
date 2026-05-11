import { useEffect, useMemo, useState } from 'react'
import { applyCoupon, fetchCoupons, getAddresses, placeOrder, updateCart } from '../utils/api'

export default function CheckoutScreen({ cart, result, onCartChange, onOrder, onBack }) {
  const [addresses, setAddresses] = useState([])
  const [coupons, setCoupons] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState(cart?.address?.id || '')
  const [couponCode, setCouponCode] = useState('')
  const [placing, setPlacing] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadCheckoutData() {
      try {
        const [addressData, couponData] = await Promise.all([getAddresses(), fetchCoupons()])
        if (cancelled) return
        setAddresses(addressData.addresses || [])
        setCoupons(couponData.coupons || [])
      } catch (err) {
        if (!cancelled) setError(err.message || 'Checkout data failed to load.')
      }
    }

    loadCheckoutData()
    return () => {
      cancelled = true
    }
  }, [])

  const itemCount = useMemo(
    () => cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
    [cart]
  )

  async function handleAddressChange(nextAddressId) {
    setSelectedAddressId(nextAddressId)
    setError('')
    try {
      const { cart: nextCart } = await updateCart({
        addressId: nextAddressId,
        restaurantId: cart.restaurant.id,
        items: cart.items.map(item => ({ itemId: item.itemId, quantity: item.quantity }))
      })
      onCartChange(nextCart)
      const couponData = await fetchCoupons()
      setCoupons(couponData.coupons || [])
    } catch (err) {
      setError(err.message || 'Address update failed.')
    }
  }

  async function handleApplyCoupon(code = couponCode) {
    if (!code) return
    setError('')
    try {
      const { cart: nextCart } = await applyCoupon(code)
      onCartChange(nextCart)
      const couponData = await fetchCoupons()
      setCoupons(couponData.coupons || [])
      setCouponCode('')
    } catch (err) {
      setError(err.message || 'Coupon could not be applied.')
    }
  }

  async function handlePlaceOrder() {
    setPlacing(true)
    setError('')
    try {
      const order = await placeOrder({ paymentMethod: 'COD' })
      onOrder(order)
    } catch (err) {
      setError(err.message || 'Order failed. Please try again.')
      setPlacing(false)
      setReviewing(false)
    }
  }

  if (!cart) {
    return (
      <section className="checkout-layout">
        <button className="back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">‹</span>
          Back
        </button>
        <div className="checkout-card">
          <h1>No cart found</h1>
          <p className="muted">Select a Swiggy match before checkout.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="checkout-layout">
      <button className="back-button" type="button" onClick={onBack}>
        <span aria-hidden="true">‹</span>
        Back
      </button>

      <div className="checkout-grid">
        <div className="checkout-main">
          <div className="checkout-card">
            <span className="eyebrow">Checkout</span>
            <h1>{result?.dish || 'Your order'}</h1>
            <p className="muted">{itemCount} item{itemCount === 1 ? '' : 's'} from {cart.restaurant.name}</p>
          </div>

          <div className="checkout-card">
            <div className="section-heading tight">
              <h2>Delivery Address</h2>
              <span>Saved on Swiggy</span>
            </div>
            <div className="option-list">
              {addresses.map(address => (
                <label className="radio-option" key={address.id}>
                  <input
                    type="radio"
                    name="address"
                    checked={selectedAddressId === address.id}
                    onChange={() => handleAddressChange(address.id)}
                  />
                  <span>
                    <strong>{address.label}</strong>
                    <small>{address.displayText}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="checkout-card">
            <div className="section-heading tight">
              <h2>Items</h2>
              <span>{cart.restaurant.deliveryTime} min ETA</span>
            </div>
            <div className="cart-items">
              {cart.items.map(item => (
                <div className="cart-item" key={item.itemId}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.quantity} × {formatPrice(item.unitPrice)}</span>
                  </div>
                  <strong>{formatPrice(item.lineTotal)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="checkout-card">
            <div className="section-heading tight">
              <h2>Offers</h2>
              <span>{cart.coupon ? cart.coupon.code : 'No coupon'}</span>
            </div>
            <div className="coupon-input">
              <input
                value={couponCode}
                onChange={event => setCouponCode(event.target.value.toUpperCase())}
                placeholder="Coupon code"
              />
              <button className="secondary-button" type="button" onClick={() => handleApplyCoupon()}>
                Apply
              </button>
            </div>
            <div className="coupon-list">
              {coupons.map(coupon => (
                <button
                  className={`coupon-pill ${coupon.eligible ? '' : 'disabled'}`}
                  type="button"
                  key={coupon.code}
                  onClick={() => handleApplyCoupon(coupon.code)}
                  disabled={!coupon.eligible}
                >
                  <strong>{coupon.code}</strong>
                  <span>{coupon.reason}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="checkout-card">
            <div className="section-heading tight">
              <h2>Payment</h2>
              <span>MCP v1</span>
            </div>
            <div className="option-list">
              {cart.paymentMethods.map(method => (
                <label className={`radio-option ${method.enabled ? '' : 'disabled'}`} key={method.id}>
                  <input
                    type="radio"
                    name="payment"
                    checked={method.id === 'COD'}
                    disabled={!method.enabled}
                    readOnly
                  />
                  <span>
                    <strong>{method.label}</strong>
                    <small>{method.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <aside className="checkout-summary">
          <div className="summary-card">
            <h2>Bill Details</h2>
            <PriceLine label="Item total" value={cart.totals.itemTotal} />
            <PriceLine label="Discount" value={-cart.totals.itemDiscount} muted={cart.totals.itemDiscount === 0} />
            <PriceLine label="Delivery fee" value={cart.totals.deliveryFee} />
            <PriceLine label="Packaging" value={cart.totals.packagingFee} />
            <PriceLine label="Platform fee" value={cart.totals.platformFee} />
            <PriceLine label="Taxes" value={cart.totals.taxes} />
            <div className="summary-total">
              <span>To pay</span>
              <strong>{formatPrice(cart.totals.total)}</strong>
            </div>
            {cart.totals.capExceeded && (
              <p className="error-text">Cart exceeds the Swiggy MCP Rs. {cart.totals.cap} cap.</p>
            )}
            {error && <p className="error-text">{error}</p>}

            {reviewing ? (
              <div className="confirm-box">
                <strong>Place this COD order?</strong>
                <p>Swiggy may apply cancellation fees after restaurant confirmation.</p>
                <button
                  className="primary-button"
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={placing || cart.totals.capExceeded}
                >
                  {placing ? 'Placing order' : 'Place COD order'}
                </button>
                <button className="text-button" type="button" onClick={() => setReviewing(false)} disabled={placing}>
                  Edit cart
                </button>
              </div>
            ) : (
              <button
                className="primary-button"
                type="button"
                onClick={() => setReviewing(true)}
                disabled={cart.totals.capExceeded}
              >
                Review and place
              </button>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

function PriceLine({ label, value, muted = false }) {
  return (
    <div className={`price-line ${muted ? 'muted-line' : ''}`}>
      <span>{label}</span>
      <strong>{formatPrice(value)}</strong>
    </div>
  )
}

function formatPrice(value) {
  const sign = value < 0 ? '-' : ''
  return `${sign}${new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Math.abs(value))}`
}
