import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { identifyRoute } from './routes/identify.js'
import { orderRoute } from './routes/order.js'
import { trackRoute } from './routes/track.js'
import { addressesRoute } from './routes/addresses.js'
import { cartRoute } from './routes/cart.js'
import { couponsRoute } from './routes/coupons.js'
import { searchRoute } from './routes/search.js'
import { supportRoute } from './routes/support.js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.use('/api/identify', identifyRoute)
app.use('/api/addresses', addressesRoute)
app.use('/api/search', searchRoute)
app.use('/api/cart', cartRoute)
app.use('/api/coupons', couponsRoute)
app.use('/api/order', orderRoute)
app.use('/api/track', trackRoute)
app.use('/api/support', supportRoute)

app.get('/health', (_, res) => res.json({ ok: true, service: 'snaporder-api' }))

if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3001
  app.listen(PORT, () => console.log(`SnapOrder API → http://localhost:${PORT}`))
}

export default app
