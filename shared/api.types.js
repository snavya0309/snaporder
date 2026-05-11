/**
 * Shared API contract — both frontend and backend reference this.
 * Do not change without syncing with your teammate.
 */

/**
 * @typedef {Object} IdentifyResponse
 * @property {string} dish
 * @property {string} cuisine
 * @property {number} confidence        - 0 to 1
 * @property {number|null} calories
 * @property {{ carbs: number, protein: number, fat: number }|null} macros
 * @property {Match[]} matches
 */

/**
 * @typedef {Object} Match
 * @property {string} restaurant
 * @property {string} platform          - "swiggy"
 * @property {number} price             - INR
 * @property {number} deliveryTime      - minutes
 * @property {number} rating            - out of 5
 * @property {number} distance          - km
 * @property {string} restaurantId
 * @property {string} itemId
 * @property {string} [itemName]
 * @property {string} [availabilityStatus]
 * @property {string} [addressId]
 */

/**
 * @typedef {Object} Address
 * @property {string} id
 * @property {string} label
 * @property {string} displayText
 * @property {string} [deliveryNote]
 */

/**
 * @typedef {Object} CartItem
 * @property {string} itemId
 * @property {string} restaurantId
 * @property {string} name
 * @property {number} quantity
 * @property {number} unitPrice
 * @property {number} lineTotal
 */

/**
 * @typedef {Object} Cart
 * @property {string} id
 * @property {Address} address
 * @property {{ id: string, name: string, rating: number, distance: number, deliveryTime: number }} restaurant
 * @property {CartItem[]} items
 * @property {{ itemTotal: number, itemDiscount: number, deliveryFee: number, packagingFee: number, platformFee: number, taxes: number, total: number, cap: number, capExceeded: boolean }} totals
 * @property {{ id: string, label: string, enabled: boolean, description: string }[]} paymentMethods
 */

/**
 * @typedef {Object} OrderRequest
 * @property {"COD"} paymentMethod
 * @property {{ restaurantId: string, itemId: string, quantity: number }[]} [items] - legacy inline placement only; normal flow places current cart
 */

/**
 * @typedef {Object} OrderResponse
 * @property {string} orderId
 * @property {number} eta               - minutes
 * @property {string} status            - "confirmed"
 * @property {number} [itemCount]
 * @property {CartItem[]} [items]
 * @property {Cart["totals"]} [totals]
 */

/**
 * @typedef {Object} TrackResponse
 * @property {string} orderId
 * @property {string} status            - "preparing" | "out_for_delivery" | "delivered"
 * @property {number} eta
 * @property {string} [partnerName]
 */
