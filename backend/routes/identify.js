import express from 'express'
import { searchSwiggy } from '../services/swiggy.js'

export const identifyRoute = express.Router()

identifyRoute.post('/', async (req, res) => {
  try {
    const { image, dish: textDish } = req.body
    if (!image && !textDish) return res.status(400).json({ error: 'image or dish name required' })

    // call your Python agent microservice instead of claude.js + nutrition.js
    const agentRes = await fetch('http://localhost:8000/agents/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, dish: textDish })
    })
    const agentData = await agentRes.json()
    // agentData = { dish, cuisine, confidence, calories, macros }

    const matches = await searchSwiggy(agentData.dish)  // swiggy for now, doordash later

    res.json({ ...agentData, matches })
  } catch (err) {
    console.error('[identify]', err.message)
    res.status(500).json({ error: 'identification failed' })\
  }
})