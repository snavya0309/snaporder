const BASE = import.meta.env.VITE_API_URL || ''

export async function identifyDish(base64Image) {
  const res = await fetch(`${BASE}/api/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image })
  })
  if (!res.ok) throw new Error('identify failed')
  return res.json()
}

export async function getAddresses() {
  const res = await fetch(`${BASE}/api/addresses`)
  if (!res.ok) throw new Error('addresses failed')
  return res.json()
}

export async function searchFood(payload) {
  const res = await fetch(`${BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error('search failed')
  return res.json()
}

export async function getCart() {
  const res = await fetch(`${BASE}/api/cart`)
  if (!res.ok) throw new Error('cart failed')
  return res.json()
}

export async function updateCart(payload) {
  const res = await fetch(`${BASE}/api/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(await readError(res, 'cart update failed'))
  return res.json()
}

export async function fetchCoupons() {
  const res = await fetch(`${BASE}/api/coupons`)
  if (!res.ok) throw new Error('coupons failed')
  return res.json()
}

export async function applyCoupon(code) {
  const res = await fetch(`${BASE}/api/coupons/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  })
  if (!res.ok) throw new Error(await readError(res, 'coupon apply failed'))
  return res.json()
}

export async function placeOrder(payload) {
  const res = await fetch(`${BASE}/api/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error('order failed')
  return res.json()
}

export async function trackOrder(orderId) {
  const res = await fetch(`${BASE}/api/track/${orderId}`)
  if (!res.ok) throw new Error('track failed')
  return res.json()
}

export async function reportIssue(payload) {
  const res = await fetch(`${BASE}/api/support/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(await readError(res, 'support report failed'))
  return res.json()
}

async function readError(res, fallback) {
  try {
    const data = await res.json()
    return data.error || fallback
  } catch {
    return fallback
  }
}
