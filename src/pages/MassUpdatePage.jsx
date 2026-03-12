import { useState, useEffect } from 'react'
import { db, auth } from '../lib/firebase'
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'

function classifySku(sku) {
  if (!sku) return 'unknown'
  const s = sku.toLowerCase()
  if (s.includes('pasabuy') || s.includes('pb-')) return 'pasabuy'
  if (s.includes('stock-') || s.includes('stock_')) return 'instock'
  return 'nostock'
}

const SKU_CLASS = {
  instock:  { label: '有在庫', color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
  nostock:  { label: '無在庫', color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  pasabuy:  { label: 'Pasabuy', color: '#a855f7', bg: 'rgba(168,85,247,0.08)' },
  unknown:  { label: '不明',   color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
}

export default function MassUpdatePage({ uid: propUid }) {
  const [tab, setTab] = useState('upload')
  const [histories, setHistories] = useState([])
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState([])
  const [filter, setFilter] = useState('all')
  const [skuFilter, setSkuFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [inventory, setInventory] = useState([]) // 在庫棚卸データ
  const [editMap, setEditMap] = useState({}) // productId→編集データ

  const uid = propUid || auth.currentUser?.uid

  useEffect(() => { loadAll() }, [uid])

  async function loadAll() {
    if (!uid) return
    try {
      // Mass Update履歴
      const snap = await getDocs(collection(db, 'mass_updates'))
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.uid === uid)
        .sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0))
      setHistories(list)
      if (list.length > 0) {
        const prods = list[0].products || []
        setProducts(prods)
        initEditMap(prods)
      }
      // 在庫棚卸データ
      const invSnap = await getDocs(collection(db, 'inventory_items'))
      const invList = invSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.uid === uid)
      setInventory(invList)
    } catch(e) { console.error(e) }
  }

  function initEditMap(prods) {
    const map = {}
    prods.forEach(p => {
      map[p.productId] = {
        jan: '', origin: 'Japan', weight: '', category: '',
        brand: '', price: '', stock: '',
        skuClass: classifySku(p.sku),
      }
    })
    setEditMap(map)
  }

  // 在庫棚卸からSKUマッチングしてJAN・原産国を自動補完
  function autoFillFromInventory() {
    if (inventory.length === 0) return alert('在庫棚卸データがありません。先にShopeeStockManagerで登録してください。')
    const skuMap = {}
    inventory.forEach(item => { if (item.sku) skuMap[item.sku.toLowerCase()] = item })
    let filled = 0
    setEditMap(prev => {
      const next = { ...prev }
      products.forEach(p => {
        const inv = skuMap[p.sku?.toLowerCase()]
        if (inv) {
          next[p.productId] = {
            ...next[p.productId],
            jan: inv.jan || next[p.productId]?.jan || '',
            origin: inv.origin || next[p.productId]?.origin || 'Japan',
          }
          filled++
        }
      })
      return next
    })
    alert(`✅ ${filled}件のJAN・原産国を自動補完しました`)
  }

  async function handleFile(file) {
    if (!file) return
    setLoading(true)
    try {
      const { read, utils } = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = utils.sheet_to_json(ws, { header: 1 })
      let headerIdx = rows.findIndex(r => r.includes('Product ID'))
      if (headerIdx < 0) headerIdx = 2
      const headers = rows[headerIdx]
      const pidIdx = headers.indexOf('Product ID')
      const skuIdx = headers.indexOf('Parent SKU')
      const nameIdx = headers.indexOf('Product Name')
      const descIdx = headers.indexOf('Product Description')
      const failIdx = headers.indexOf('Fail Reason')
      const prods = rows.slice(headerIdx + 1)
        .filter(r => r[pidIdx])
        .map(r => ({
          productId: String(r[pidIdx] || ''),
          sku: String(r[skuIdx] || ''),
          name: String(r[nameIdx] || ''),
          description: String(r[descIdx] || '').slice(0, 500),
          failReason: String(r[failIdx] || ''),
          hasError: !!(r[failIdx] && String(r[failIdx]).trim()),
        }))
      const errorCount = prods.filter(p => p.hasError).length
      await addDoc(collection(db, 'mass_updates'), {
        uid, filename: file.name,
        uploadedAt: serverTimestamp(),
        totalCount: prods.length, errorCount, products: prods,
      })
      alert(`✅ 保存完了！${prods.length}件（エラー${errorCount}件）`)
      await loadAll()
      setTab('products')
    } catch(e) { alert('エラー: ' + e.message) }
    setLoading(false)
  }

  async function downloadXlsx() {
    const { utils, writeFile } = await import('xlsx')
    const rows = [
      ['Product ID', 'Parent SKU', 'SKU分類', 'Product Name', 'JANコード', '原産国', '重量(g)', 'カテゴリ', 'ブランド', '価格', '在庫数', 'Fail Reason'],
      ...products.map(p => {
        const e = editMap[p.productId] || {}
        return [
          p.productId, p.sku, SKU_CLASS[e.skuClass || classifySku(p.sku)]?.label || '',
          p.name, e.jan || '', e.origin || '', e.weight || '',
          e.category || '', e.brand || '', e.price || '', e.stock || '',
          p.failReason || '',
        ]
      })
    ]
    const ws = utils.aoa_to_sheet(rows)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'MassUpdate')
    writeFile(wb, 'mass_update_edited.xlsx')
  }

  function setEdit(productId, key, val) {
    setEditMap(prev => ({ ...prev, [productId]: { ...(prev[productId] || {}), [key]: val } }))
  }

  const filteredProducts = products.filter(p => {
    if (filter === 'error' && !p.hasError) return false
    if (filter === 'ok' && p.hasError) return false
    const sc = editMap[p.productId]?.skuClass || classifySku(p.sku)
    if (skuFilter !== 'all' && sc !== skuFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const TABS = [
    { id: 'upload', label: '📤 アップロード' },
    { id: 'products', label: '📋 商品一覧・編集' },
    { id: 'errors', label: '🔴 エラー管理' },
    { id: 'history', label: '📅 履歴' },
  ]

  const inputStyle = { background: 'transparent', border: 'none', borderBottom: '1px solid var(--rim2)', color: 'var(--text)', fontSize: '0.72rem', outline: 'none', padding: '0.1rem 0.25rem', width: '100%' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--rim)', display: 'flex', overflowX: 'auto', flexShrink: 0, padding: '0 1.5rem' }}>
        {TABS.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{ padding: '0.85rem 1.1rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: tab === t.id ? 'var(--orange)' : 'var(--dim2)', borderBottom: tab === t.id ? '2px solid var(--orange)' : '2px solid transparent', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>{t.label}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>

        {tab === 'upload' && (
          <div className="fade-up">
            <div style={{ fontSize: '0.7rem', color: 'var(--dim2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>📤 Mass Update XLSXをアップロード</div>
            <div onClick={() => document.getElementById('mu-input').click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
              style={{ border: '2px dashed rgba(255,107,43,0.3)', borderRadius: 16, padding: '3rem', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,107,43,0.02)', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📦</div>
              <div style={{ fontWeight: 900, fontSize: '0.95rem', marginBottom: '0.35rem' }}>{loading ? '処理中...' : 'Mass Update XLSXをドロップ'}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--dim2)' }}>Shopee Seller Center › My Products › Mass Update › Basic Info</div>
              <input id="mu-input" type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            </div>
            {histories.length > 0 && (
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--dim2)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>📊 最新アップロード状況</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '0.75rem' }}>
                  {[
                    { l: '総商品数', v: histories[0].totalCount + '件', c: 'var(--orange)' },
                    { l: 'エラー数', v: histories[0].errorCount + '件', c: histories[0].errorCount > 0 ? 'var(--red)' : 'var(--green)' },
                    { l: '正常数', v: (histories[0].totalCount - histories[0].errorCount) + '件', c: 'var(--green)' },
                    { l: 'アップ回数', v: histories.length + '回', c: 'var(--ai)' },
                  ].map(k => (
                    <div key={k.l} className="card" style={{ padding: '0.85rem', borderTop: '2px solid ' + k.c }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--dim2)', fontWeight: 700, marginBottom: '0.3rem', textTransform: 'uppercase' }}>{k.l}</div>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.6rem', color: k.c, lineHeight: 1 }}>{k.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'products' && (
          <div className="fade-up">
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="商品名・SKUで検索..." style={{ flex: 1, minWidth: 180, padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--rim)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.8rem' }} />
              {['all', 'ok', 'error'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '0.4rem 0.75rem', borderRadius: 8, border: '1px solid', borderColor: filter === f ? 'var(--orange)' : 'var(--rim)', background: filter === f ? 'rgba(255,107,43,0.1)' : 'transparent', color: filter === f ? 'var(--orange)' : 'var(--dim2)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                  {f === 'all' ? '全て' : f === 'ok' ? '✅ 正常' : '🔴 エラー'}
                </button>
              ))}
              {['all', 'instock', 'nostock', 'pasabuy'].map(f => (
                <button key={f} onClick={() => setSkuFilter(f)} style={{ padding: '0.4rem 0.75rem', borderRadius: 8, border: '1px solid', borderColor: skuFilter === f ? SKU_CLASS[f]?.color || 'var(--orange)' : 'var(--rim)', background: skuFilter === f ? (SKU_CLASS[f]?.bg || 'transparent') : 'transparent', color: skuFilter === f ? (SKU_CLASS[f]?.color || 'var(--orange)') : 'var(--dim2)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                  {f === 'all' ? '全分類' : SKU_CLASS[f]?.label}
                </button>
              ))}
              <button onClick={autoFillFromInventory} style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: '1px solid var(--green)', background: 'rgba(22,163,74,0.1)', color: 'var(--green)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>🔗 在庫から自動補完</button>
              <button onClick={downloadXlsx} style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: 'none', background: 'var(--orange)', color: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>⬇ XLSXダウンロード</button>
              <span style={{ fontSize: '0.72rem', color: 'var(--dim2)' }}>{filteredProducts.length}件</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filteredProducts.slice(0, 100).map((p, i) => {
                const e = editMap[p.productId] || {}
                const sc = e.skuClass || classifySku(p.sku)
                const cls = SKU_CLASS[sc]
                return (
                  <div key={i} className="card" style={{ padding: '0.85rem 1rem', borderLeft: '3px solid ' + (p.hasError ? 'var(--red)' : cls.color) }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: 4, background: cls.bg, color: cls.color, fontWeight: 700, whiteSpace: 'nowrap' }}>{cls.label}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: '0.63rem', color: 'var(--dim2)' }}>ID: {p.productId}　SKU: {p.sku}</div>
                        {p.hasError && <div style={{ fontSize: '0.65rem', color: 'var(--red)', fontWeight: 700 }}>⚠ {p.failReason}</div>}
                      </div>
                      <select value={e.skuClass || sc} onChange={ev => setEdit(p.productId, 'skuClass', ev.target.value)} style={{ fontSize: '0.68rem', background: 'var(--surface)', border: '1px solid var(--rim)', color: 'var(--text)', borderRadius: 6, padding: '0.2rem' }}>
                        <option value="instock">有在庫</option>
                        <option value="nostock">無在庫</option>
                        <option value="pasabuy">Pasabuy</option>
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: '0.5rem' }}>
                      {[
                        { key: 'jan', label: 'JANコード' },
                        { key: 'origin', label: '原産国' },
                        { key: 'weight', label: '重量(g)' },
                        { key: 'brand', label: 'ブランド' },
                        { key: 'category', label: 'カテゴリ' },
                        { key: 'price', label: '価格(₱)' },
                        { key: 'stock', label: '在庫数' },
                      ].map(field => (
                        <div key={field.key}>
                          <div style={{ fontSize: '0.58rem', color: 'var(--dim2)', fontWeight: 700, marginBottom: '0.15rem' }}>{field.label}</div>
                          <input value={e[field.key] || ''} onChange={ev => setEdit(p.productId, field.key, ev.target.value)} style={inputStyle} placeholder="-" />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {filteredProducts.length > 100 && <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.75rem', color: 'var(--dim2)' }}>残り{filteredProducts.length - 100}件（検索で絞り込んでください）</div>}
            </div>
          </div>
        )}

        {tab === 'errors' && (
          <div className="fade-up">
            <div style={{ fontSize: '0.7rem', color: 'var(--dim2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>🔴 Fail Reasonエラー一覧</div>
            {products.filter(p => p.hasError).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--green)', fontSize: '1rem' }}>🎉 エラーなし！全商品正常です</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {products.filter(p => p.hasError).map((p, i) => (
                  <div key={i} className="card" style={{ padding: '1rem', borderLeft: '3px solid var(--red)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--purple)', marginBottom: '0.3rem' }}>SKU: {p.sku}　ID: {p.productId}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--red)', fontWeight: 700, padding: '0.4rem 0.75rem', background: 'rgba(220,38,38,0.08)', borderRadius: 6 }}>⚠ {p.failReason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="fade-up">
            <div style={{ fontSize: '0.7rem', color: 'var(--dim2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>📅 アップロード履歴</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {histories.map((h, i) => {
                const d = h.uploadedAt?.toDate ? h.uploadedAt.toDate() : new Date((h.uploadedAt?.seconds || 0) * 1000)
                return (
                  <div key={h.id} className="card" style={{ padding: '1rem', cursor: 'pointer', borderLeft: '3px solid ' + (h.errorCount > 0 ? 'var(--red)' : 'var(--green)') }} onClick={() => { setProducts(h.products || []); initEditMap(h.products || []); setTab('products') }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{h.filename}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--dim2)', marginTop: '0.2rem' }}>{d.toLocaleDateString('ja-JP')} {d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--orange)', fontWeight: 700 }}>{h.totalCount}件</span>
                        {h.errorCount > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--red)', fontWeight: 700 }}>🔴 {h.errorCount}件エラー</span>}
                        {h.errorCount === 0 && <span style={{ fontSize: '0.72rem', color: 'var(--green)', fontWeight: 700 }}>✅ エラーなし</span>}
                        <span style={{ fontSize: '0.65rem', color: 'var(--dim2)' }}>→ 詳細</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {histories.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--dim2)', fontSize: '0.85rem' }}>まだアップロード履歴がありません</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
