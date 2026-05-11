/**
 * Swiggy MCP facade.
 * The functions below mirror the Food MCP journey with deterministic mocks until
 * production credentials are available.
 */

const CART_CAP = 1000
const mockOrders = new Map()
const itemStore = new Map()
let activeCart = null

const addresses = [
  {
    id: 'addr-home',
    label: 'Home',
    displayText: 'Indiranagar, Bengaluru',
    deliveryNote: 'Leave at security if unreachable'
  },
  {
    id: 'addr-work',
    label: 'Work',
    displayText: 'Koramangala, Bengaluru',
    deliveryNote: 'Call on arrival'
  }
]

const coupons = [
  {
    code: 'SNAP50',
    title: 'Rs. 50 off',
    description: 'Valid on food carts above Rs. 299',
    minCartValue: 299,
    discountType: 'flat',
    discountValue: 50,
    requiresOnlinePayment: false
  },
  {
    code: 'BIRYANI75',
    title: 'Rs. 75 off biryani',
    description: 'Valid on carts above Rs. 499',
    minCartValue: 499,
    discountType: 'flat',
    discountValue: 75,
    requiresOnlinePayment: false
  },
  {
    code: 'FREEDEL',
    title: 'Free delivery',
    description: 'Delivery fee waived above Rs. 199',
    minCartValue: 199,
    discountType: 'delivery',
    discountValue: 0,
    requiresOnlinePayment: false
  },
  {
    code: 'UPI100',
    title: 'Rs. 100 off with UPI',
    description: 'Requires online payment; disabled for MCP v1 COD checkout',
    minCartValue: 399,
    discountType: 'flat',
    discountValue: 100,
    requiresOnlinePayment: true
  }
]

export async function getAddresses() {
  await wait(120)
  return { addresses }
}

export async function searchSwiggy(dishName, { addressId = addresses[0].id } = {}) {
  await wait(160)
  const matches = buildMatches(dishName, addressId)
  matches.forEach(match => itemStore.set(match.itemId, match))
  return matches
}

export async function searchFood({ dish, addressId = addresses[0].id }) {
  const matches = await searchSwiggy(dish, { addressId })
  const restaurants = matches.map(match => ({
    id: match.restaurantId,
    name: match.restaurant,
    rating: match.rating,
    distance: match.distance,
    deliveryTime: match.deliveryTime,
    availabilityStatus: match.availabilityStatus,
    addressId
  }))

  return {
    address: addresses.find(address => address.id === addressId) || addresses[0],
    restaurants,
    matches
  }
}

export async function updateFoodCart({ addressId = addresses[0].id, restaurantId, items }) {
  if (!restaurantId) throw httpError(400, 'restaurantId required')
  if (!Array.isArray(items) || items.length === 0) throw httpError(400, 'items required')

  const normalizedItems = items
    .map(item => ({ ...item, quantity: Number(item.quantity || 0) }))
    .filter(item => item.itemId && Number.isFinite(item.quantity) && item.quantity > 0)

  if (normalizedItems.length === 0) throw httpError(400, 'at least one item quantity required')

  const cartReplaced = Boolean(activeCart && activeCart.restaurant.id !== restaurantId)
  const cartItems = normalizedItems.map(item => {
    const catalogItem = itemStore.get(item.itemId)
    if (!catalogItem) throw httpError(404, `menu item not found: ${item.itemId}`)
    if (catalogItem.restaurantId !== restaurantId) {
      throw httpError(400, 'cart can only contain items from one restaurant')
    }

    return {
      itemId: catalogItem.itemId,
      restaurantId: catalogItem.restaurantId,
      name: catalogItem.itemName,
      restaurant: catalogItem.restaurant,
      quantity: Math.min(9, item.quantity),
      unitPrice: catalogItem.price,
      lineTotal: catalogItem.price * Math.min(9, item.quantity),
      calories: catalogItem.calories || null
    }
  })

  const firstItem = itemStore.get(cartItems[0].itemId)
  activeCart = {
    id: `cart-${Date.now()}`,
    address: addresses.find(address => address.id === addressId) || addresses[0],
    restaurant: {
      id: firstItem.restaurantId,
      name: firstItem.restaurant,
      rating: firstItem.rating,
      distance: firstItem.distance,
      deliveryTime: firstItem.deliveryTime
    },
    items: cartItems,
    coupon: cartReplaced ? null : activeCart?.coupon || null,
    paymentMethods: getPaymentMethods(),
    cartReplaced,
    updatedAt: new Date().toISOString()
  }

  activeCart = withTotals(activeCart)
  return { cart: activeCart }
}

export async function getFoodCart() {
  await wait(100)
  return { cart: activeCart ? withTotals(activeCart) : null }
}

export async function flushFoodCart() {
  activeCart = null
  return { cart: null }
}

export async function fetchFoodCoupons() {
  await wait(100)
  const itemTotal = activeCart?.totals.itemTotal || 0
  return {
    coupons: coupons.map(coupon => ({
      ...coupon,
      eligible: !coupon.requiresOnlinePayment && itemTotal >= coupon.minCartValue,
      reason: getCouponReason(coupon, itemTotal)
    }))
  }
}

export async function applyFoodCoupon(code) {
  if (!activeCart) throw httpError(400, 'cart required before applying coupon')
  const coupon = coupons.find(item => item.code.toLowerCase() === String(code).toLowerCase())
  if (!coupon) throw httpError(404, 'coupon not found')
  if (coupon.requiresOnlinePayment) throw httpError(400, 'coupon requires online payment')
  if (activeCart.totals.itemTotal < coupon.minCartValue) {
    throw httpError(400, `minimum cart value Rs. ${coupon.minCartValue} required`)
  }

  activeCart = withTotals({ ...activeCart, coupon })
  return { cart: activeCart }
}

export async function placeSwiggyOrder({ paymentMethod = 'COD', items, addressId, restaurantId } = {}) {
  if (items) {
    await updateFoodCart({
      addressId,
      restaurantId: restaurantId || items[0]?.restaurantId,
      items
    })
  }

  if (!activeCart) throw httpError(400, 'cart required before placing order')
  if (paymentMethod !== 'COD') throw httpError(400, 'only COD is supported by Swiggy MCP v1')
  if (activeCart.totals.total > CART_CAP) throw httpError(400, `cart exceeds Rs. ${CART_CAP} MCP cap`)

  await wait(350)
  const itemCount = activeCart.items.reduce((sum, item) => sum + item.quantity, 0)
  const order = {
    orderId: `SW-${Math.floor(Math.random() * 900000 + 100000)}`,
    eta: Math.min(42, activeCart.restaurant.deliveryTime + itemCount * 2),
    status: 'confirmed',
    paymentMethod,
    itemCount,
    cart: structuredClone(activeCart),
    createdAt: Date.now()
  }
  mockOrders.set(order.orderId, order)
  activeCart = null
  return toPublicOrder(order)
}

export async function trackSwiggyOrder(orderId) {
  const order = mockOrders.get(orderId)
  if (!order) {
    return {
      orderId,
      status: 'preparing',
      eta: 22,
      partnerName: null
    }
  }

  const elapsedSeconds = Math.floor((Date.now() - order.createdAt) / 1000)
  const status =
    elapsedSeconds >= 55 ? 'delivered' :
    elapsedSeconds >= 30 ? 'out_for_delivery' :
    elapsedSeconds >= 10 ? 'preparing' :
    'confirmed'

  return {
    orderId,
    status,
    eta: status === 'delivered' ? 0 : Math.max(3, order.eta - Math.floor(elapsedSeconds / 2)),
    partnerName: status === 'out_for_delivery' ? 'Assigned after pickup' : null,
    itemCount: order.itemCount
  }
}

export async function getFoodOrderDetails(orderId) {
  const order = mockOrders.get(orderId)
  if (!order) throw httpError(404, 'order not found')
  return toPublicOrder(order)
}

export async function reportSupportIssue({ orderId, issueType, message }) {
  await wait(120)
  return {
    reportId: `RPT-${Math.floor(Math.random() * 90000 + 10000)}`,
    orderId: orderId || null,
    issueType,
    message,
    status: 'received'
  }
}

function buildMatches(dishName, addressId) {
  const normalizedDish = dishName.toLowerCase().trim()
  const isPizza = normalizedDish.includes('pizza')
  const fallbackItem = titleCase(dishName)
  const dishCalories = isPizza ? 520 : 680

  return [
    {
      restaurant: isPizza ? 'Olio Pizzeria' : 'Behrouz Biryani',
      itemName: isPizza ? 'Classic Margherita Pizza' : fallbackItem,
      platform: 'swiggy',
      price: isPizza ? 349 : 289,
      deliveryTime: 28,
      rating: 4.5,
      distance: 4.2,
      availabilityStatus: 'OPEN',
      addressId,
      restaurantId: isPizza ? 'olio-001' : 'beh-001',
      itemId: isPizza ? 'item-pizza-001' : 'item-biryani-001',
      calories: dishCalories
    },
    {
      restaurant: isPizza ? 'Olio Pizzeria' : 'Behrouz Biryani',
      itemName: isPizza ? 'Garlic Bread Combo' : `${fallbackItem} Combo`,
      platform: 'swiggy',
      price: isPizza ? 159 : 189,
      deliveryTime: 28,
      rating: 4.5,
      distance: 4.2,
      availabilityStatus: 'OPEN',
      addressId,
      restaurantId: isPizza ? 'olio-001' : 'beh-001',
      itemId: isPizza ? 'item-pizza-side-001' : 'item-biryani-combo-001',
      calories: Math.round(dishCalories * 0.48)
    },
    {
      restaurant: isPizza ? 'La Pinoz Pizza' : 'Biryani Blues',
      itemName: isPizza ? 'Cheese Burst Margherita' : `${fallbackItem} Bowl`,
      platform: 'swiggy',
      price: isPizza ? 279 : 249,
      deliveryTime: 22,
      rating: 4.2,
      distance: 2.7,
      availabilityStatus: 'OPEN',
      addressId,
      restaurantId: isPizza ? 'lap-002' : 'bb-002',
      itemId: isPizza ? 'item-pizza-002' : 'item-biryani-002',
      calories: Math.round(dishCalories * 0.9)
    },
    {
      restaurant: isPizza ? 'MOJO Pizza' : 'Thalairaj Biryani',
      itemName: isPizza ? 'Margherita Feast' : `Royal ${fallbackItem}`,
      platform: 'swiggy',
      price: isPizza ? 399 : 329,
      deliveryTime: 35,
      rating: 4.6,
      distance: 5.1,
      availabilityStatus: 'OPEN',
      addressId,
      restaurantId: isPizza ? 'mojo-003' : 'thr-003',
      itemId: isPizza ? 'item-pizza-003' : 'item-biryani-003',
      calories: Math.round(dishCalories * 1.08)
    }
  ]
}

function withTotals(cart) {
  const itemTotal = cart.items.reduce((sum, item) => sum + item.lineTotal, 0)
  const deliveryFeeBeforeDiscount = itemTotal >= 399 ? 0 : 38
  const couponDiscount = getCouponDiscount(cart.coupon, itemTotal, deliveryFeeBeforeDiscount)
  const deliveryFee = cart.coupon?.discountType === 'delivery'
    ? Math.max(0, deliveryFeeBeforeDiscount - couponDiscount)
    : deliveryFeeBeforeDiscount
  const itemDiscount = cart.coupon?.discountType === 'flat' ? couponDiscount : 0
  const packagingFee = 18
  const platformFee = 6
  const taxes = Math.round(itemTotal * 0.05)
  const total = Math.max(0, itemTotal - itemDiscount + deliveryFee + packagingFee + platformFee + taxes)

  return {
    ...cart,
    totals: {
      itemTotal,
      itemDiscount,
      deliveryFee,
      packagingFee,
      platformFee,
      taxes,
      total,
      cap: CART_CAP,
      capExceeded: total > CART_CAP
    }
  }
}

function getCouponDiscount(coupon, itemTotal, deliveryFee) {
  if (!coupon || itemTotal < coupon.minCartValue || coupon.requiresOnlinePayment) return 0
  if (coupon.discountType === 'delivery') return deliveryFee
  return Math.min(coupon.discountValue, itemTotal)
}

function getCouponReason(coupon, itemTotal) {
  if (coupon.requiresOnlinePayment) return 'Requires online payment'
  if (itemTotal < coupon.minCartValue) return `Add Rs. ${coupon.minCartValue - itemTotal} more`
  return 'Eligible'
}

function getPaymentMethods() {
  return [
    {
      id: 'COD',
      label: 'Cash on delivery',
      enabled: true,
      description: 'Supported by Swiggy MCP v1'
    },
    {
      id: 'UPI',
      label: 'UPI',
      enabled: false,
      description: 'Pending Swiggy MCP online payment support'
    },
    {
      id: 'CARD',
      label: 'Cards',
      enabled: false,
      description: 'Pending Swiggy MCP online payment support'
    },
    {
      id: 'WALLET',
      label: 'Wallets',
      enabled: false,
      description: 'Pending Swiggy MCP online payment support'
    }
  ]
}

function toPublicOrder(order) {
  return {
    orderId: order.orderId,
    eta: order.eta,
    status: order.status,
    paymentMethod: order.paymentMethod,
    itemCount: order.itemCount,
    restaurant: order.cart.restaurant,
    address: order.cart.address,
    items: order.cart.items,
    totals: order.cart.totals
  }
}

function titleCase(value) {
  return value
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}
