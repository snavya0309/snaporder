import express from 'express'
import { trackSwiggyOrder } from '../services/swiggy.js'

export const trackRoute = express.Router()

trackRoute.get('/:orderId', async (req, res) => {
  try {
    const result = await trackSwiggyOrder(req.params.orderId)
    res.json(result)
  } catch (err) {
    console.error('[track]', err.message)
    res.status(500).json({ error: 'tracking failed' })
  }
})
