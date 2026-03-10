const https = require('https')
const http = require('http')
const fs = require('fs')

// .env.localを手動で読み込む
const env = fs.readFileSync('.env.local', 'utf8')
env.split('\n').forEach(line => {
  const [key, val] = line.split('=')
  if (key && val) process.env[key.trim()] = val.trim()
})

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
    console.log('リクエスト受信:', body.substring(0, 100))
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    }

    const pr = https.request(options, r => {
      let data = ''
      r.on('data', c => data += c)
      r.on('end', () => {
        console.log('レスポンス:', r.statusCode)
        res.writeHead(r.statusCode, { 'Content-Type': 'application/json' })
        res.end(data)
      })
    })

    pr.on('error', e => {
      console.error('エラー:', e.message)
      res.writeHead(500)
      res.end(JSON.stringify({ error: e.message }))
    })
    pr.write(body)
    pr.end()
  })
})

server.listen(3001, () => console.log('✅ プロキシサーバー起動: http://localhost:3001'))
