import { useState, useEffect } from 'react'
import { db, auth } from '../lib/firebase'
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'

export default function MassUpdatePage({ uid: propUid }) {
  const [tab, setTab] = useState('upload')
  const [histories, setHistories] = useState([])
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const uid = propUid || auth.currentUser?.uid

  useEffect(() => { loadHistories() }, [uid])

  async function loadHistories() {
    if (!uid) return
    try {
      const snap = await getDocs(collection(db, 'mass_updates'))
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.uid === uid)
        .sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0))
      setHistories(list)
      if (list.length > 0) setProducts(list[0].products || [])
    } catch(e) { console.error(e) }
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

      // ヘッダー行を探す（"Product ID"がある行）
      let headerIdx = rows.findIndex(r => r.includes('Product ID'))
      if (headerIdx < 0) headerIdx = 2
      const headers = rows[headerIdx]
      const pidIdx = headers.indexOf('Product ID')
      const skuIdx = headers.indexOf('Parent SKU')
      const nameIdx = headers.indexOf('Product Name')
      const descIdx = headers.indexOf('Product Description')
      const failIdx = headers.indexOf('Fail Reason')

      const products = rows.slice(headerIdx + 1)
        .filter(r => r[pidIdx])
        .map(r => ({
          productId: String(r[pidIdx] || ''),
          sku: String(r[skuIdx] || ''),
          name: String(r[nameIdx] || ''),
          description: String(r[descIdx] || '').slice(0, 500),
          failReason: String(r[failIdx] || ''),
          hasError: !!(r[failIdx] && String(r[failIdx]).trim()),
        }))

      const errorCount = products.filter(p => p.hasError).length
      const doc = await addDoc(collection(db, 'mass_updates'), {
        uid,
        filename: file.name,
        uploadedAt: serverTimestamp(),
        totalCount: products.length,
        errorCount,
        products,
      })

      alert(`✅ 保存完了！${products.length}件（エラー${errorCount}件）`)
      await loadHistories()
      setTab('products')
    } catch(e) { alert('エラー: ' + e.message) }
    setLoading(false)
  }

  const filteredProducts = products.filter(p => {
    if (filter === 'error' && !p.hasError) return false
    if (filter === 'ok' && p.hasError) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const TABS = [
    { id: 'upload', label: '📤 アップロード' },
    { id: 'products', label: '📋 商品一覧' },
    { id: 'errors', label: '🔴 エラー管理' },
    { id: 'history', label: '📅 履歴' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* タブ */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--rim)', display: 'flex', overflowX: 'auto', flexShrink: 0, padding: '0 1.5rem' }}>
        {TABS.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{ padding: '0.85rem 1.1rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: tab === t.id ? 'var(--orange)' : 'var(--dim2)', borderBottom: tab === t.id ? '2px solid var(--orange)' : '2px solid transparent', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>{t.label}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>

        {/* アップロードタブ */}
        {tab === 'upload' && (
          <div className="fade-up">
            <div style={{ fontSize: '0.7rem', color: 'var(--dim2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>📤 Mass Update XLSXをアップロード</div>
            <div
              onClick={() => document.getElementById('mu-input').click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
              style={{ border: '2px dashed rgba(255,107,43,0.3)', borderRadius: 16, padding: '3rem', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,107,43,0.02)', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📦</div>
              <div style={{ fontWeight: 900, fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                {loading ? '処理中...' : 'Mass Update XLSXをドロップ'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--dim2)' }}>
                Shopee Seller Center › My Products › Mass Update › Basic Info
              </div>
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

        {/* 商品一覧タブ */}
        {tab === 'products' && (
          <div className="fade-up">
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="商品名・SKUで検索..." style={{ flex: 1, minWidth: 200, padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--rim)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.8rem' }} />
              {['all', 'ok', 'error'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '0.4rem 0.85rem', borderRadius: 8, border: '1px solid', borderColor: filter === f ? 'var(--orange)' : 'var(--rim)', background: filter === f ? 'rgba(255,107,43,0.1)' : 'transparent', color: filter === f ? 'var(--orange)' : 'var(--dim2)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                  {f === 'all' ? '全て' : f === 'ok' ? '✅ 正常' : '🔴 エラー'}
                </button>
              ))}
              <span style={{ fontSize: '0.72rem', color: 'var(--dim2)' }}>{filteredProducts.length}件</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {filteredProducts.slice(0, 100).map((p, i) => (
                <div key={i} className="card" style={{ padding: '0.75rem 1rem', borderLeft: '3px solid ' + (p.hasError ? 'var(--red)' : 'var(--green)') }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.7rem' }}>{p.hasError ? '🔴' : '✅'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || '-'}</div>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--dim2)' }}>ID: {p.productId}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--purple)' }}>SKU: {p.sku}</span>
                        {p.hasError && <span style={{ fontSize: '0.65rem', color: 'var(--red)', fontWeight: 700 }}>⚠ {p.failReason}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredProducts.length > 100 && <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.75rem', color: 'var(--dim2)' }}>残り{filteredProducts.length - 100}件（検索で絞り込んでください）</div>}
            </div>
          </div>
        )}

        {/* エラー管理タブ */}
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

        {/* 履歴タブ */}
        {tab === 'history' && (
          <div className="fade-up">
            <div style={{ fontSize: '0.7rem', color: 'var(--dim2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>📅 アップロード履歴</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {histories.map((h, i) => {
                const d = h.uploadedAt?.toDate ? h.uploadedAt.toDate() : new Date(h.uploadedAt?.seconds * 1000)
                return (
                  <div key={h.id} className="card" style={{ padding: '1rem', cursor: 'pointer', borderLeft: '3px solid ' + (h.errorCount > 0 ? 'var(--red)' : 'var(--green)') }} onClick={() => { setProducts(h.products || []); setTab('products') }}>
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
