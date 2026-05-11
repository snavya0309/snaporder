import express from 'express'
import { placeSwiggyOrder } from '../services/swiggy.js'

export const orderRoute = express.Router()

orderRoute.post('/', async (req, res) => {
  try {
    const hasInlineItems = Array.isArray(req.body.items) || (req.body.restaurantId && req.body.itemId)
    const result = await placeSwiggyOrder({
      paymentMethod: req.body.paymentMethod || 'COD',
      restaurantId: req.body.restaurantId,
      addressId: req.body.addressId,
      items: hasInlineItems ? normalizeOrderItems(req.body) : undefined
    })
    res.json(result)
  } catch (err) {
    console.error('[order]', err.message)
    res.status(err.status || 500).json({ error: err.message || 'order failed' })
  }
})

function normalizeOrderItems(body) {
  const rawItems = Array.isArray(body.items)
    ? body.items
    : [{ restaurantId: body.restaurantId, itemId: body.itemId, quantity: body.quantity || 1 }]

  return rawItems
    .map(item => ({
      restaurantId: item.restaurantId,
      itemId: item.itemId,
      quantity: Number(item.quantity || 1)
    }))
    .filter(item => item.restaurantId && item.itemId && Number.isFinite(item.quantity) && item.quantity > 0)
}
