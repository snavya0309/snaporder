import express from 'express'
import { searchFood } from '../services/swiggy.js'

export const searchRoute = express.Router()

searchRoute.post('/', async (req, res) => {
  try {
    const { dish, addressId } = req.body
    if (!dish) return res.status(400).json({ error: 'dish required' })
    res.json(await searchFood({ dish, addressId }))
  } catch (err) {
    console.error('[search]', err.message)
    res.status(err.status || 500).json({ error: err.message || 'search failed' })
  }
})
