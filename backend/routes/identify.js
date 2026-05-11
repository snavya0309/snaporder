import express from 'express'
import { identifyDish } from '../services/claude.js'
import { enrichWithNutrition } from '../services/nutrition.js'
import { searchSwiggy } from '../services/swiggy.js'

export const identifyRoute = express.Router()

identifyRoute.post('/', async (req, res) => {
  try {
    const { image } = req.body
    if (!image) return res.status(400).json({ error: 'image (base64) required' })

    const identified = await identifyDish(image)
    const [nutrition, matches] = await Promise.all([
      enrichWithNutrition(identified.dish),
      searchSwiggy(identified.dish)
    ])

    res.json({ ...identified, ...nutrition, matches })
  } catch (err) {
    console.error('[identify]', err.message)
    res.status(500).json({ error: 'identification failed' })
  }
})
