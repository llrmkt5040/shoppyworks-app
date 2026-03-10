const https = require('https')
const http = require('http')
const fs = require('fs')

const env = fs.readFileSync('/Users/yusukeok5040/shoppyworks-app/.env.local', 'utf8')
env.split('\n').forEach(line => {
  const idx = line.indexOf('=')
  if (idx > 0) process.env[line.slice(0,idx).trim()] = line.slice(idx+1).trim()
})

console.log('APIキー:', process.env.VITE_ANTHROPIC_API_KEY ? '✅' : '❌')

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return
  }

  const chunks = []
  req.on('data', c => chunks.push(c))
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString()
    console.log('リクエスト受信:', body.length, 'bytes')

    const postData = body
    const reqOptions = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Connection': 'close'
      }
    }

    const apiReq = https.request(reqOptions, apiRes => {
      console.log('APIレスポンス:', apiRes.statusCode)
      const resChunks = []
      apiRes.on('data', c => resChunks.push(c))
      apiRes.on('end', () => {
        const data = Buffer.concat(resChunks).toString()
        res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' })
        res.end(data)
      })
    })

    apiReq.on('error', e => {
      console.error('APIエラー:', e.message, e.code)
      res.writeHead(500)
      res.end(JSON.stringify({ error: e.message, code: e.code }))
    })

    apiReq.setTimeout(30000, () => {
      console.error('タイムアウト')
      apiReq.destroy()
    })

    apiReq.write(postData)
    apiReq.end()
  })
})

server.listen(3001, '127.0.0.1', () => {
  console.log('✅ プロキシサーバー起動: http://localhost:3001')
})
