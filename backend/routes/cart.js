import express from 'express'
import { flushFoodCart, getFoodCart, updateFoodCart } from '../services/swiggy.js'

export const cartRoute = express.Router()

cartRoute.get('/', async (_, res) => {
  try {
    res.json(await getFoodCart())
  } catch (err) {
    console.error('[cart:get]', err.message)
    res.status(err.status || 500).json({ error: err.message || 'cart failed' })
  }
})

cartRoute.post('/', async (req, res) => {
  try {
    const { addressId, restaurantId, items } = req.body
    res.json(await updateFoodCart({ addressId, restaurantId, items }))
  } catch (err) {
    console.error('[cart:update]', err.message)
    res.status(err.status || 500).json({ error: err.message || 'cart update failed' })
  }
})

cartRoute.delete('/', async (_, res) => {
  try {
    res.json(await flushFoodCart())
  } catch (err) {
    console.error('[cart:flush]', err.message)
    res.status(err.status || 500).json({ error: err.message || 'cart flush failed' })
  }
})
