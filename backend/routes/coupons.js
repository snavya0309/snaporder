import express from 'express'
import { applyFoodCoupon, fetchFoodCoupons } from '../services/swiggy.js'

export const couponsRoute = express.Router()

couponsRoute.get('/', async (_, res) => {
  try {
    res.json(await fetchFoodCoupons())
  } catch (err) {
    console.error('[coupons:list]', err.message)
    res.status(err.status || 500).json({ error: err.message || 'coupons failed' })
  }
})

couponsRoute.post('/apply', async (req, res) => {
  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ error: 'code required' })
    res.json(await applyFoodCoupon(code))
  } catch (err) {
    console.error('[coupons:apply]', err.message)
    res.status(err.status || 500).json({ error: err.message || 'coupon apply failed' })
  }
})
