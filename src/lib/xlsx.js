import * as XLSX from 'xlsx'

const n = v => {
  if (v === null || v === undefined || v === '') return 0
  // 文字列・数値どちらでも対応
  const str = String(v).replace(/,/g, '').replace(/%/g, '').replace(/₱/g, '').trim()
  const result = parseFloat(str)
  return isNaN(result) ? 0 : result
}

export function parseShopeeXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        // raw:true で生の値を取得（文字列変換しない）
        const wb = XLSX.read(e.target.result, { type: 'array', raw: true })
        const keys = wb.SheetNames
        const topKey = keys.find(k => /top.perform|overall|performance|product(?!.*new)/i.test(k)) || keys[0]
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[topKey], { defval: '', raw: true })
        
        // デバッグ：最初の商品の売上を確認
        if (rows.length > 0) {
          const r = rows[0]
          console.log('=== デバッグ ===')
          console.log('商品名:', r['Product'])
          console.log('Sales(Confirmed)の生の値:', repr(r['Sales (Confirmed Order) (PHP)']))
          console.log('CTRの生の値:', repr(r['CTR']))
          console.log('=== デバッグ終 ===')
        }

        const products = rows.map(r => {
          const salesRaw = r['Sales (Confirmed Order) (PHP)'] || r['Sales (Placed Order) (PHP)'] || 0
          const ctrRaw   = r['CTR'] || 0
          const cvrRaw   = r['Order Conversion Rate (Confirmed Order)'] || r['Conversion Rate (Confirmed Order)'] || 0
          const p = {
            name:        r['Product'] || '(不明)',
            sales:       n(salesRaw),
            orders:      n(r['Confirmed Order'] || r['Placed Order']),
            impressions: n(r['Product Impression'] || r['Unique Product Impressions']),
            ctr:         n(ctrRaw),
            cvr:         n(cvrRaw),
            bounce:      n(r['Product Bounce Rate'] || r['Bounce Rate']),
            clicks:      n(r['Product Clicks'] || r['Unique Product Clicks']),
          }
          p.priorityScore = (p.impressions * (1 / (p.cvr || 0.1))) *
            (p.bounce > 40 ? 1.5 : 1) * (p.ctr < 2 ? 1.3 : 1)
          if      (p.cvr < 3 && p.impressions > 100) p.category = 'urgent'
          else if (p.bounce > 50)                     p.category = 'page'
          else if (p.ctr < 3 && p.impressions > 50)  p.category = 'title'
          else if (p.cvr < 8)                         p.category = 'desc'
          else                                        p.category = 'ok'
          return p
        })
        resolve({ products, filename: file.name })
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('読み込み失敗'))
    reader.readAsArrayBuffer(file)
  })
}

function repr(v) {
  return `${typeof v}: ${JSON.stringify(v)}`
}

export function calcKPIs(products) {
  if (!products.length) return {}
  return {
    totalSales:   products.reduce((s, p) => s + p.sales, 0),
    avgCtr:       products.reduce((s, p) => s + p.ctr, 0) / products.length,
    avgCvr:       products.reduce((s, p) => s + p.cvr, 0) / products.length,
    avgBounce:    products.reduce((s, p) => s + p.bounce, 0) / products.length,
    urgentCount:  products.filter(p => p.category === 'urgent').length,
    productCount: products.length,
  }
}

export const CATEGORY_LABELS = {
  urgent: '🔴 緊急改善', page: '🟠 ページ改善',
  title:  '🟡 タイトル改善', desc: '🟢 説明文改善', ok: '✅ 維持・強化',
}
export const CATEGORY_COLORS = {
  urgent: '#ef4444', page: '#f59e0b', title: '#fbbf24', desc: '#10b981', ok: '#8b5cf6',
}
