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
    description: 'Valid on any order above Rs. 299',
    minCartValue: 299,
    discountType: 'flat',
    discountValue: 50,
    requiresOnlinePayment: false,
    category: null
  },
  {
    code: 'BIRYANI75',
    title: 'Rs. 75 off biryani',
    description: 'Valid on biryani orders above Rs. 499',
    minCartValue: 499,
    discountType: 'flat',
    discountValue: 75,
    requiresOnlinePayment: false,
    category: 'biryani'
  },
  {
    code: 'PIZZA50',
    title: 'Rs. 50 off pizza',
    description: 'Valid on pizza orders above Rs. 299',
    minCartValue: 299,
    discountType: 'flat',
    discountValue: 50,
    requiresOnlinePayment: false,
    category: 'pizza'
  },
  {
    code: 'FREEDEL',
    title: 'Free delivery',
    description: 'Delivery fee waived above Rs. 199',
    minCartValue: 199,
    discountType: 'delivery',
    discountValue: 0,
    requiresOnlinePayment: false,
    category: null
  },
  {
    code: 'UPI100',
    title: 'Rs. 100 off with UPI',
    description: 'Requires online payment; disabled for MCP v1 COD checkout',
    minCartValue: 399,
    discountType: 'flat',
    discountValue: 100,
    requiresOnlinePayment: true,
    category: null
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
    let catalogItem = itemStore.get(item.itemId)
    if (!catalogItem) {
      // itemStore lost on server restart — rebuild from item ID pattern
      const keyMatch = item.itemId.match(/^item-([a-z]+)-\d+$/)
      buildMatches(keyMatch?.[1] || 'biryani', addressId).forEach(m => itemStore.set(m.itemId, m))
      catalogItem = itemStore.get(item.itemId)
    }
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
  const cartCategory = getCartCategory()
  return {
    coupons: coupons.map(coupon => ({
      ...coupon,
      eligible: !coupon.requiresOnlinePayment &&
                itemTotal >= coupon.minCartValue &&
                (!coupon.category || coupon.category === cartCategory),
      reason: getCouponReason(coupon, itemTotal, cartCategory)
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
  const cartCategory = getCartCategory()
  if (coupon.category && coupon.category !== cartCategory) {
    throw httpError(400, `coupon only valid for ${coupon.category} orders`)
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

const DISH_PROFILES = {
  biryani: {
    isVeg: false, calories: 680,
    restaurants: [
      { name: 'Behrouz Biryani',   id: 'beh-001', rating: 4.5, distance: 4.2, deliveryTime: 28 },
      { name: 'Biryani Blues',     id: 'bb-002',  rating: 4.2, distance: 2.7, deliveryTime: 22 },
      { name: 'Thalairaj Biryani', id: 'thr-003', rating: 4.6, distance: 5.1, deliveryTime: 35 },
      { name: 'Paradise Biryani',  id: 'par-004', rating: 4.4, distance: 3.8, deliveryTime: 30 },
    ],
    suffixes: ['', ' Combo', ' Bowl', ' Royal'],
    prices:   [289, 189, 249, 329],
    calMults: [1.0, 0.48, 0.9, 1.08],
  },
  pizza: {
    isVeg: true, calories: 520,
    restaurants: [
      { name: 'Olio Pizzeria', id: 'olio-001', rating: 4.5, distance: 4.2, deliveryTime: 28 },
      { name: 'La Pinoz Pizza', id: 'lap-002', rating: 4.2, distance: 2.7, deliveryTime: 22 },
      { name: 'MOJO Pizza',    id: 'mojo-003', rating: 4.6, distance: 5.1, deliveryTime: 35 },
      { name: "Domino's",      id: 'dom-004', rating: 4.3, distance: 1.8, deliveryTime: 18 },
    ],
    suffixes: ['', ' + Garlic Bread', ' Cheese Burst', ' Feast'],
    prices:   [349, 159, 279, 399],
    calMults: [1.0, 0.38, 1.1, 1.3],
  },
  burger: {
    isVeg: false, calories: 520,
    restaurants: [
      { name: "McDonald's",     id: 'mcd-001', rating: 4.2, distance: 1.5, deliveryTime: 20 },
      { name: 'Burger King',    id: 'bk-002',  rating: 4.1, distance: 2.2, deliveryTime: 22 },
      { name: 'The Burger Lab', id: 'tbl-003', rating: 4.6, distance: 3.4, deliveryTime: 28 },
      { name: 'Shake Shack',    id: 'ss-004',  rating: 4.5, distance: 4.8, deliveryTime: 32 },
    ],
    suffixes: ['', ' Meal', ' Double', ' Deluxe'],
    prices:   [149, 249, 349, 429],
    calMults: [1.0, 1.6, 1.4, 1.2],
  },
  dosa: {
    isVeg: true, calories: 415,
    restaurants: [
      { name: 'MTR',               id: 'mtr-001', rating: 4.6, distance: 3.2, deliveryTime: 25 },
      { name: "Vasudev Adiga's",   id: 'va-002',  rating: 4.4, distance: 2.1, deliveryTime: 20 },
      { name: 'Shri Sagar',        id: 'ss-003',  rating: 4.5, distance: 4.5, deliveryTime: 30 },
      { name: 'Vidyarthi Bhavan',  id: 'vb-004',  rating: 4.7, distance: 5.8, deliveryTime: 38 },
    ],
    suffixes: ['', ' with Sambar', ' Combo', ' Thali'],
    prices:   [89, 129, 169, 219],
    calMults: [1.0, 1.2, 1.5, 2.1],
  },
  noodles: {
    isVeg: false, calories: 450,
    restaurants: [
      { name: 'Chinese Wok',    id: 'cw-001',  rating: 4.3, distance: 2.4, deliveryTime: 25 },
      { name: 'Mainland China', id: 'mc-002',  rating: 4.5, distance: 4.1, deliveryTime: 30 },
      { name: 'Yo! China',      id: 'yc-003',  rating: 4.2, distance: 3.3, deliveryTime: 28 },
      { name: 'The Fatty Bao',  id: 'tfb-004', rating: 4.6, distance: 5.2, deliveryTime: 35 },
    ],
    suffixes: ['', ' + Fried Rice', ' Combo', ' Platter'],
    prices:   [179, 319, 249, 389],
    calMults: [1.0, 1.8, 1.4, 1.6],
  },
  pasta: {
    isVeg: true, calories: 480,
    restaurants: [
      { name: 'Truffles',   id: 'trf-001', rating: 4.5, distance: 3.1, deliveryTime: 28 },
      { name: 'Social',     id: 'soc-002', rating: 4.4, distance: 2.6, deliveryTime: 25 },
      { name: 'Farzi Cafe', id: 'fc-003',  rating: 4.6, distance: 4.8, deliveryTime: 32 },
      { name: 'Hoppipola',  id: 'hp-004',  rating: 4.3, distance: 3.9, deliveryTime: 30 },
    ],
    suffixes: ['', ' + Garlic Bread', ' Bake', ' Platter'],
    prices:   [249, 329, 389, 459],
    calMults: [1.0, 1.3, 1.2, 1.4],
  },
  curry: {
    isVeg: false, calories: 490,
    restaurants: [
      { name: 'Pind Balluchi',      id: 'pb-001',  rating: 4.5, distance: 3.8, deliveryTime: 28 },
      { name: 'Punjabi Dhaba',      id: 'pd-002',  rating: 4.3, distance: 2.5, deliveryTime: 22 },
      { name: 'Dhaba by Claridges', id: 'dc-003',  rating: 4.7, distance: 5.5, deliveryTime: 35 },
      { name: 'Haveli',             id: 'hav-004', rating: 4.4, distance: 4.2, deliveryTime: 30 },
    ],
    suffixes: ['', ' with Naan', ' Thali', ' Feast'],
    prices:   [249, 349, 429, 549],
    calMults: [1.0, 1.5, 1.8, 2.2],
  },
  salad: {
    isVeg: true, calories: 210,
    restaurants: [
      { name: 'Salad Days',       id: 'sd-001',  rating: 4.5, distance: 2.2, deliveryTime: 20 },
      { name: 'The Bowl Company', id: 'tbc-002', rating: 4.4, distance: 3.1, deliveryTime: 25 },
      { name: 'SaladStop!',       id: 'slp-003', rating: 4.3, distance: 4.4, deliveryTime: 30 },
      { name: 'Freshbowl',        id: 'fb-004',  rating: 4.6, distance: 1.8, deliveryTime: 18 },
    ],
    suffixes: ['', ' Bowl', ' Wrap', ' Platter'],
    prices:   [189, 219, 249, 299],
    calMults: [1.0, 1.1, 0.9, 1.3],
  },
}

function getDishKey(dishName) {
  const n = dishName.toLowerCase()
  if (/biryani|biriyani|dum.rice/.test(n))                               return 'biryani'
  if (/pizza|margherita|pepperoni/.test(n))                              return 'pizza'
  if (/burger|whopper|zinger|mcaloo/.test(n))                            return 'burger'
  if (/dosa|idli|vada|uttapam|appam|pongal/.test(n))                     return 'dosa'
  if (/noodle|chow|hakka|ramen|lo.mein|udon|chowmein/.test(n))           return 'noodles'
  if (/pasta|penne|fettuccine|lasagna|risotto|spaghetti/.test(n))        return 'pasta'
  if (/butter.chicken|paneer|tikka|dal|makhani|korma|palak|curry/.test(n)) return 'curry'
  if (/salad|bowl|wrap|quinoa/.test(n))                                  return 'salad'
  return 'biryani'
}

function buildMatches(dishName, addressId) {
  const key = getDishKey(dishName)
  const profile = DISH_PROFILES[key]
  const dishTitle = titleCase(dishName)

  return profile.restaurants.map((rest, i) => ({
    restaurant: rest.name,
    itemName: `${dishTitle}${profile.suffixes[i]}`,
    platform: 'swiggy',
    price: profile.prices[i],
    deliveryTime: rest.deliveryTime,
    rating: rest.rating,
    distance: rest.distance,
    availabilityStatus: 'OPEN',
    isVeg: profile.isVeg,
    addressId,
    restaurantId: rest.id,
    itemId: `item-${key}-00${i + 1}`,
    calories: Math.round(profile.calories * profile.calMults[i])
  }))
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

function getCartCategory() {
  if (!activeCart?.items?.length) return null
  const match = activeCart.items[0].itemId?.match(/^item-([a-z]+)-\d+$/)
  return match?.[1] || null
}

function getCouponReason(coupon, itemTotal, cartCategory) {
  if (coupon.requiresOnlinePayment) return 'Requires online payment'
  if (coupon.category && coupon.category !== cartCategory) return `Only for ${coupon.category} orders`
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
