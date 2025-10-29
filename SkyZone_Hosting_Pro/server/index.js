import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 8080
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL || ''

let ORDERS = []

app.get('/health', (req,res)=> res.json({ok:true, ts:Date.now()}))

app.post('/api/order', async (req,res)=>{
  try{
    const { fullName, email, plan } = req.body || {}
    if(!fullName || !email || !plan) return res.status(400).json({ok:false, error:'missing fields'})
    const id = 'ord_' + Math.random().toString(36).slice(2,10)
    const order = { id, fullName, email, plan, status:'NEW', createdAt: new Date().toISOString() }
    ORDERS.push(order)
    // webhook notify (optional)
    if (WEBHOOK){
      try{
        await fetch(WEBHOOK, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: `🧾 New order **${order.id}** — ${order.fullName} (${order.email}) — plan: ${order.plan}` }) })
      }catch{}
    }
    return res.json({ok:true, order})
  }catch(e){
    return res.status(500).json({ok:false, error:e.message})
  }
})

app.listen(PORT, ()=> console.log('MVP server on :' + PORT))
