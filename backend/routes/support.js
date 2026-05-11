import express from 'express'
import { reportSupportIssue } from '../services/swiggy.js'

export const supportRoute = express.Router()

supportRoute.post('/report', async (req, res) => {
  try {
    const { orderId, issueType = 'general', message = '' } = req.body
    res.json(await reportSupportIssue({ orderId, issueType, message }))
  } catch (err) {
    console.error('[support:report]', err.message)
    res.status(err.status || 500).json({ error: err.message || 'support report failed' })
  }
})
