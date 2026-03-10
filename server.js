const http = require('http')
const https = require('https')

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  let body = ''
  req.on('data', chunk => body += chunk)
  req.on('end', () => {
    const apiKey = process.env.VITE_ANTHROPIC_API_KEY
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    }

    const proxyReq = https.request(options, proxyRes => {
      let data = ''
      proxyRes.on('data', chunk => data += chunk)
      proxyRes.on('end', () => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' })
        res.end(data)
      })
    })

    proxyReq.on('error', e => {
      res.writeHead(500)
      res.end(e.message)
    })
    proxyReq.write(body)
    proxyReq.end()
  })
})

server.listen(3001, () => console.log('✅ APIサーバー起動: http://localhost:3001'))
