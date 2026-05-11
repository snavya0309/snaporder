import express from 'express'
import { getAddresses } from '../services/swiggy.js'

export const addressesRoute = express.Router()

addressesRoute.get('/', async (_, res) => {
  try {
    res.json(await getAddresses())
  } catch (err) {
    console.error('[addresses]', err.message)
    res.status(err.status || 500).json({ error: err.message || 'addresses failed' })
  }
})
