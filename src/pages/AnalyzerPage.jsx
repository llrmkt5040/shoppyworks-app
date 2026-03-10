import { useState, useRef, useEffect } from 'react'
import { parseShopeeXLSX, calcKPIs, CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/xlsx'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { db, auth } from '../lib/firebase'
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore'

function Toast({ msg, type }) {
  if (!msg) return null
  const bg = type === 'success' ? '#16a34a' : '#dc2626'
  return (
    <div style={{ position:'fixed', bottom:'1.5rem', right:'1.5rem', background:bg, color:'#fff', padding:'0.75rem 1.25rem', borderRadius:12, fontSize:'0.82rem', fontWeight:700, boxShadow:'0 4px 20px rgba(0,0,0,0.3)', zIndex:9999 }}>
      {msg}
    </div>
  )
}

export default function AnalyzerPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('overview')
  const [toast, setToast] = useState({ msg:'', type:'success' })
  const [saving, setSaving] = useState(false)
  const [histories, setHistories] = useState([])
  const [histLoading, setHistLoading] = useState(false)

  // 商品詳細タブ用フィルタ・ソート・条件
  const [sortKey, setSortKey] = useState('priorityScore')
  const [sortDir, setSortDir] = useState('desc')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [minImpressions, setMinImpressions] = useState(0)
  const [minSales, setMinSales] = useState(0)

  const dropRef = useRef()

  useEffect(() => {
    if (tab === 'history' && histories.length === 0) loadHistories()
  }, [tab])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg:'', type:'success' }), 3000)
  }

  async function loadHistories() {
    setHistLoading(true)
    try {
      const userId = auth.currentUser?.uid || 'anonymous'
      const snap = await getDocs(collection(db, 'xlsx_analyses'))
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.userId === userId && d.uploadedAt?.seconds)
        .sort((a, b) => (a.uploadedAt.seconds) - (b.uploadedAt.seconds))
      setHistories(list)
    } catch(e) {
      console.error(e)
      showToast('履歴取得に失敗しました', 'error')
    }
    setHistLoading(false)
  }

  async function deleteHistory(id) {
    if (!confirm('この履歴を削除しますか？')) return
    try {
      const { deleteDoc, doc } = await import('firebase/firestore')
      await deleteDoc(doc(db, 'xlsx_analyses', id))
      setHistories(prev => prev.filter(h => h.id !== id))
      showToast('削除しました', 'success')
    } catch(e) {
      showToast('削除に失敗しました', 'error')
    }
  }

  function formatDate(ts) {
    if (!ts) return '-'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
  }

  function loadAndRestore(h) {
    if (!h.products?.length) { showToast('商品データがありません', 'error'); return }
    setData({ filename: h.filename, products: h.products, kpis: h.kpis })
    setTab('overview')
    showToast('履歴を復元しました', 'success')
  }

  async function saveToFirestore(result) {
    setSaving(true)
    try {
      const userId = auth.currentUser?.uid || 'anonymous'
      const productsToSave = result.products.slice(0, 100).map(p => ({
        name: p.name || '', sales: p.sales || 0, ctr: p.ctr || 0,
        cvr: p.cvr || 0, bounce: p.bounce || 0, impressions: p.impressions || 0,
        orders: p.orders || 0,
        category: p.category || '', priorityScore: p.priorityScore || 0,
      }))
      await addDoc(collection(db, 'xlsx_analyses'), {
        userId,
        filename: result.filename || 'unknown.xlsx',
        uploadedAt: serverTimestamp(),
        productCount: result.products.length,
        savedCount: productsToSave.length,
        kpis: {
          totalSales: result.kpis.totalSales || 0,
          productCount: result.kpis.productCount || 0,
          avgCtr: result.kpis.avgCtr || 0,
          avgCvr: result.kpis.avgCvr || 0,
          avgBounce: result.kpis.avgBounce || 0,
          urgentCount: result.kpis.urgentCount || 0,
        },
        products: productsToSave,
      })
      showToast('✅ 保存しました（' + productsToSave.length + '件）', 'success')
    } catch(e) {
      showToast('保存に失敗: ' + e.message, 'error')
    }
    setSaving(false)
  }

  async function handleFile(file) {
    if (!file) return
    setLoading(true); setData(null)
    try {
      const result = await parseShopeeXLSX(file)
      result.kpis = calcKPIs(result.products)
      setData(result)
      setTab('products') // ← ファイル読込後は商品詳細タブに留まる
      setLoading(false)
      await saveToFirestore(result)
      return
    } catch(e) {
      alert('解析エラー: ' + e.message)
    }
    setLoading(false)
  }

  // ソートハンドラ
  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortTh({ label, skey }) {
    const active = sortKey === skey
    return (
      <th onClick={() => handleSort(skey)} style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>
        {label} {active ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
      </th>
    )
  }

  // フィルタ・ソート済み商品リスト
  const filteredProducts = data ? data.products
    .filter(p => categoryFilter === 'all' || p.category === categoryFilter)
    .filter(p => (p.impressions || 0) >= minImpressions)
    .filter(p => (p.orders || p.sales / 500 || 0) >= minSales)
    .sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
      return sortDir === 'desc' ? bv - av : av - bv
    }) : []

  const maxSales = data ? Math.max(...data.products.map(p => p.sales), 1) : 1
  const sorted = data ? [...data.products].sort((a,b) => b.priorityScore - a.priorityScore) : []
  const catCounts = data ? Object.entries(data.products.reduce((acc,p) => ({...acc,[p.category]:(acc[p.category]||0)+1}),{})).map(([k,v]) => ({ name:CATEGORY_LABELS[k], value:v, color:CATEGORY_COLORS[k] })) : []

  if (!data && !loading) return (
    <div style={{ maxWidth:800, margin:'2rem auto', padding:'0 1.5rem' }}>
      <Toast msg={toast.msg} type={toast.type} />
      <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', letterSpacing:'0.04em', marginBottom:'1.5rem' }}>週次 XLSX アナライザー</h2>
      <div ref={dropRef} onClick={() => document.getElementById('xlsx-input').click()}
        onDragOver={e => { e.preventDefault(); dropRef.current.style.borderColor='var(--orange)' }}
        onDragLeave={() => dropRef.current.style.borderColor='rgba(255,107,43,0.3)'}
        onDrop={e => { e.preventDefault(); dropRef.current.style.borderColor='rgba(255,107,43,0.3)'; handleFile(e.dataTransfer.files[0]) }}
        style={{ border:'2px dashed rgba(255,107,43,0.3)', borderRadius:20, padding:'4rem 2rem', textAlign:'center', cursor:'pointer', background:'rgba(255,107,43,0.02)', transition:'all 0.3s' }}>
        <div style={{ fontSize:'3.5rem', marginBottom:'1rem' }}>📊</div>
        <h3 style={{ fontWeight:900, marginBottom:'0.5rem' }}>XLSXファイルをドロップ</h3>
        <p style={{ fontSize:'0.8rem', color:'var(--dim2)' }}>またはクリックしてファイルを選択</p>
        <p style={{ fontSize:'0.72rem', color:'var(--dim)', marginTop:'0.5rem' }}>📋 <a href="https://seller.shopee.ph/datacenter/product/performance" target="_blank" style={{ color:'var(--orange)', textDecoration:'none' }}>seller.shopee.ph › Product Performance</a></p>
        <p style={{ fontSize:'0.72rem', color:'var(--dim)', marginTop:'0.3rem' }}>⚠️ 期間は <strong style={{ color:'var(--dim2)' }}>「過去30日間」</strong> を選択してダウンロード</p>
        <input id="xlsx-input" type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
      </div>

      {/* 分析履歴 */}
      <div style={{ marginTop:'1.5rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem' }}>
          <span style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--dim2)' }}>📂 分析履歴</span>
          <button className="btn-ghost" style={{ fontSize:'0.72rem' }} onClick={loadHistories}>🔄 更新</button>
        </div>
        {histLoading && <div style={{ color:'var(--dim2)', fontSize:'0.8rem' }}>読み込み中...</div>}
        {!histLoading && histories.length === 0 && (
          <div style={{ textAlign:'center', padding:'2rem', color:'var(--dim)', fontSize:'0.8rem', border:'1px solid var(--rim)', borderRadius:12 }}>
            まだ履歴がありません。XLSXをアップロードすると自動保存されます
          </div>
        )}
        {!histLoading && histories.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {histories.slice().reverse().map((h, i) => (
              <div key={h.id} className="card" style={{ padding:'0.9rem 1.1rem', display:'grid', gridTemplateColumns:'auto 1fr auto', gap:'1rem', alignItems:'center' }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.4rem', color:'var(--orange)', minWidth:'1.6rem', textAlign:'center', lineHeight:1 }}>{i+1}</div>
                <div>
                  <div style={{ fontWeight:900, fontSize:'0.82rem', marginBottom:'0.25rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📊 {h.filename}</div>
                  <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'0.68rem', color:'var(--dim2)' }}>🕒 {formatDate(h.uploadedAt)}</span>
                    <span style={{ fontSize:'0.68rem', color:'var(--dim2)' }}>📦 {h.productCount}商品</span>
                    <span style={{ fontSize:'0.68rem', color:'var(--orange)', fontWeight:700 }}>₱{(h.kpis?.totalSales||0).toLocaleString('en',{maximumFractionDigits:0})}</span>
                    <span style={{ fontSize:'0.68rem', color:(h.kpis?.avgCtr||0)>3?'var(--green)':'var(--yellow)' }}>CTR {(h.kpis?.avgCtr||0).toFixed(2)}%</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'0.4rem' }}>
                  <button onClick={() => loadAndRestore(h)} style={{ padding:'0.3rem 0.65rem', borderRadius:8, border:'1px solid rgba(255,107,43,0.3)', background:'rgba(255,107,43,0.08)', color:'var(--orange)', fontSize:'0.7rem', cursor:'pointer', fontWeight:700, fontFamily:"'Zen Kaku Gothic New',sans-serif" }}>復元</button>
                  <button onClick={() => deleteHistory(h.id)} style={{ padding:'0.3rem 0.55rem', borderRadius:8, border:'1px solid var(--rim)', background:'transparent', color:'var(--dim)', fontSize:'0.7rem', cursor:'pointer' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'50vh', gap:'1rem' }}>
      <div className="spinner" /><p style={{ color:'var(--dim2)' }}>解析中...</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <Toast msg={toast.msg} type={toast.type} />

      {/* ファイル名バー */}
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--rim)', padding:'0.75rem 1.5rem', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap', flexShrink:0 }}>
        <div>
          <div style={{ fontWeight:900, fontSize:'0.88rem' }}>{data.filename}</div>
          <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontFamily:"'DM Mono',monospace" }}>
            {data.products.length}商品 · 分析完了
            {saving && <span style={{ marginLeft:'0.5rem', color:'var(--orange)' }}>💾 保存中...</span>}
          </div>
        </div>
        <button className="btn-ghost" style={{ marginLeft:'auto', fontSize:'0.75rem' }} onClick={() => { setData(null); setTab('overview') }}>← 別ファイル</button>
      </div>

      {/* タブ */}
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--rim)', display:'flex', overflowX:'auto', flexShrink:0 }}>
        {[['overview','📊 概要'],['products','🔍 商品詳細'],['roadmap','📅 ロードマップ'],['ai','🤖 AI提案']].map(([id,label]) => (
          <div key={id} onClick={() => setTab(id)} style={{ padding:'0.85rem 1.2rem', cursor:'pointer', fontSize:'0.8rem', fontWeight:700, color:tab===id?'var(--orange)':'var(--dim2)', borderBottom:tab===id?'2px solid var(--orange)':'2px solid transparent', whiteSpace:'nowrap', transition:'all 0.2s' }}>{label}</div>
        ))}
      </div>

      {/* コンテンツ */}
      <div style={{ flex:1, overflow:'auto' }}>

        {/* 概要タブ */}
        {tab==='overview' && (
          <div className="fade-up" style={{ maxWidth:1200, margin:'0 auto', padding:'1.5rem' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
              {[{l:'総売上',v:'₱'+data.kpis.totalSales?.toLocaleString('en',{maximumFractionDigits:0}),a:'var(--orange)'},{l:'商品数',v:data.kpis.productCount+'件',a:'var(--purple)'},{l:'平均CTR',v:data.kpis.avgCtr?.toFixed(2)+'%',a:data.kpis.avgCtr>3?'var(--green)':'var(--yellow)'},{l:'平均CVR',v:data.kpis.avgCvr?.toFixed(2)+'%',a:data.kpis.avgCvr>5?'var(--green)':data.kpis.avgCvr<3?'var(--red)':'var(--yellow)'},{l:'バウンス率',v:data.kpis.avgBounce?.toFixed(1)+'%',a:data.kpis.avgBounce<30?'var(--green)':'var(--yellow)'},{l:'緊急改善',v:data.kpis.urgentCount+'件',a:data.kpis.urgentCount>0?'var(--red)':'var(--green)'}].map(k => (
                <div key={k.l} className="card" style={{ padding:'1.25rem', borderTop:'2px solid '+k.a }}>
                  <div style={{ fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.12em', color:'var(--dim2)', fontWeight:700, marginBottom:'0.5rem' }}>{k.l}</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'2rem', color:k.a, lineHeight:1 }}>{k.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div className="card" style={{ padding:'1.25rem' }}>
                <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>売上 TOP10</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sorted.slice(0,10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis type="number" tick={{ fill:'#6b7280', fontSize:10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill:'#9ca3af', fontSize:9 }} width={120} tickFormatter={v => v.length>16?v.slice(0,16)+'…':v} />
                    <Tooltip contentStyle={{ background:'var(--card)', border:'1px solid var(--rim2)', borderRadius:8 }} formatter={v => ['₱'+Number(v).toLocaleString(),'売上']} />
                    <Bar dataKey="sales" fill="rgba(255,107,43,0.7)" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card" style={{ padding:'1.25rem' }}>
                <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>改善カテゴリ分布</div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart><Pie data={catCounts} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">{catCounts.map((c,i) => <Cell key={i} fill={c.color} />)}</Pie><Legend iconSize={10} wrapperStyle={{ fontSize:'0.72rem' }} /><Tooltip contentStyle={{ background:'var(--card)', border:'1px solid var(--rim2)', borderRadius:8 }} /></PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* 商品詳細タブ（枠固定＋ソート＋フィルタ） */}
        {tab==='products' && (
          <div className="fade-up" style={{ display:'flex', flexDirection:'column', height:'100%' }}>
            {/* フィルタバー */}
            <div style={{ padding:'0.75rem 1.5rem', borderBottom:'1px solid var(--rim)', background:'var(--surface)', display:'flex', gap:'0.75rem', flexWrap:'wrap', alignItems:'center', flexShrink:0 }}>
              {/* カテゴリフィルタ */}
              <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' }}>
                {['all',...Object.keys(CATEGORY_LABELS)].map(k => (
                  <button key={k} onClick={() => setCategoryFilter(k)} style={{ padding:'0.28rem 0.7rem', borderRadius:8, cursor:'pointer', fontSize:'0.7rem', border:'1px solid var(--rim)', background:categoryFilter===k?'rgba(255,107,43,0.1)':'var(--card)', color:categoryFilter===k?'var(--orange)':'var(--dim2)', fontFamily:"'Zen Kaku Gothic New',sans-serif", fontWeight:700 }}>
                    {k==='all'?'すべて':CATEGORY_LABELS[k]}
                  </button>
                ))}
              </div>
              {/* 条件フィルタ */}
              <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginLeft:'auto' }}>
                <label style={{ fontSize:'0.68rem', color:'var(--dim2)', whiteSpace:'nowrap' }}>表示件数: <strong style={{ color:'var(--orange)' }}>{filteredProducts.length}</strong>件</label>
                <div style={{ display:'flex', alignItems:'center', gap:'0.3rem', background:'var(--card)', border:'1px solid var(--rim)', borderRadius:8, padding:'0.25rem 0.6rem' }}>
                  <span style={{ fontSize:'0.65rem', color:'var(--dim2)' }}>IMP≥</span>
                  <input type="number" value={minImpressions} onChange={e => setMinImpressions(Number(e.target.value))} style={{ width:50, background:'transparent', border:'none', color:'var(--text)', fontSize:'0.72rem', fontFamily:"'DM Mono',monospace", outline:'none' }} min="0" />
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.3rem', background:'var(--card)', border:'1px solid var(--rim)', borderRadius:8, padding:'0.25rem 0.6rem' }}>
                  <span style={{ fontSize:'0.65rem', color:'var(--dim2)' }}>販売≥</span>
                  <input type="number" value={minSales} onChange={e => setMinSales(Number(e.target.value))} style={{ width:40, background:'transparent', border:'none', color:'var(--text)', fontSize:'0.72rem', fontFamily:"'DM Mono',monospace", outline:'none' }} min="0" />
                </div>
                <button onClick={() => { setCategoryFilter('all'); setMinImpressions(0); setMinSales(0); setSortKey('priorityScore'); setSortDir('desc') }} style={{ padding:'0.28rem 0.6rem', borderRadius:8, border:'1px solid var(--rim)', background:'transparent', color:'var(--dim2)', fontSize:'0.65rem', cursor:'pointer' }}>リセット</button>
              </div>
            </div>

            {/* 枠固定テーブル */}
            <div style={{ flex:1, overflow:'auto', padding:'0 1.5rem 1.5rem' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8rem' }}>
                <thead style={{ position:'sticky', top:0, zIndex:10, background:'var(--surface)' }}>
                  <tr style={{ borderBottom:'2px solid var(--rim2)' }}>
                    <th style={{ padding:'0.6rem 0.5rem', textAlign:'left', fontSize:'0.65rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap', minWidth:30 }}>#</th>
                    <th style={{ padding:'0.6rem 0.5rem', textAlign:'left', fontSize:'0.65rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', minWidth:200 }}>商品名</th>
                    {[['sales','売上(₱)'],['impressions','IMP'],['orders','受注数'],['ctr','CTR%'],['cvr','CVR%'],['bounce','バウンス%'],['priorityScore','優先度']].map(([key,label]) => (
                      <th key={key} onClick={() => handleSort(key)} style={{ padding:'0.6rem 0.5rem', textAlign:'center', fontSize:'0.65rem', color:sortKey===key?'var(--orange)':'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>
                        {label} {sortKey===key?(sortDir==='desc'?'▼':'▲'):'↕'}
                      </th>
                    ))}
                    <th style={{ padding:'0.6rem 0.5rem', textAlign:'center', fontSize:'0.65rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>判定</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid var(--rim)', transition:'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,107,43,0.04)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'0.55rem 0.5rem', color:'var(--dim)', fontSize:'0.7rem', fontFamily:"'DM Mono',monospace" }}>{i+1}</td>
                      <td style={{ padding:'0.55rem 0.5rem', maxWidth:280 }}><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.78rem', fontWeight:600 }} title={p.name}>{p.name}</div></td>
                      <td style={{ padding:'0.55rem 0.5rem', textAlign:'center', color:'var(--orange)', fontFamily:"'DM Mono',monospace", fontSize:'0.75rem' }}>₱{(p.sales||0).toLocaleString('en',{maximumFractionDigits:0})}</td>
                      <td style={{ padding:'0.55rem 0.5rem', textAlign:'center', fontFamily:"'DM Mono',monospace", fontSize:'0.75rem', color:'var(--dim2)' }}>{(p.impressions||0).toLocaleString()}</td>
                      <td style={{ padding:'0.55rem 0.5rem', textAlign:'center', fontFamily:"'DM Mono',monospace", fontSize:'0.75rem', color:'var(--dim2)' }}>{(p.orders||0).toLocaleString()}</td>
                      <td style={{ padding:'0.55rem 0.5rem', textAlign:'center', fontFamily:"'DM Mono',monospace", fontSize:'0.75rem', color:p.ctr>3?'var(--green)':'var(--yellow)' }}>{(p.ctr||0).toFixed(2)}%</td>
                      <td style={{ padding:'0.55rem 0.5rem', textAlign:'center', fontFamily:"'DM Mono',monospace", fontSize:'0.75rem', color:p.cvr>5?'var(--green)':p.cvr<3?'var(--red)':'var(--yellow)' }}>{(p.cvr||0).toFixed(2)}%</td>
                      <td style={{ padding:'0.55rem 0.5rem', textAlign:'center', fontFamily:"'DM Mono',monospace", fontSize:'0.75rem', color:p.bounce<30?'var(--green)':p.bounce>60?'var(--red)':'var(--yellow)' }}>{(p.bounce||0).toFixed(1)}%</td>
                      <td style={{ padding:'0.55rem 0.5rem', textAlign:'center', fontFamily:"'DM Mono',monospace", fontSize:'0.75rem', color:'var(--orange)', fontWeight:700 }}>{Math.round(p.priorityScore||0)}</td>
                      <td style={{ padding:'0.55rem 0.5rem', textAlign:'center' }}><span className={'pb pb-'+p.category}>{CATEGORY_LABELS[p.category]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProducts.length === 0 && (
                <div style={{ textAlign:'center', padding:'3rem', color:'var(--dim2)', fontSize:'0.85rem' }}>
                  条件に一致する商品がありません
                </div>
              )}
            </div>
          </div>
        )}

        {/* ロードマップタブ */}
        {tab==='roadmap' && (
          <div className="fade-up" style={{ maxWidth:1200, margin:'0 auto', padding:'1.5rem' }}>
            <div className="sec-hdr"><span className="sec-title">30日間 改善ロードマップ</span><span className="count-badge">{Math.min(sorted.length,30)}件</span></div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.55rem' }}>
              {sorted.slice(0,30).map((p,i) => {
                const d = new Date(2026,2,15); d.setDate(d.getDate()+i)
                const lbl = (d.getMonth()+1)+'/'+d.getDate()+'('+'日月火水木金土'[d.getDay()]+')'
                return (
                  <div key={i} className="card" style={{ padding:'1rem 1.25rem', display:'grid', gridTemplateColumns:'auto 1fr auto', gap:'1rem', alignItems:'center' }}>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.3rem', color:'var(--orange)', minWidth:'2.6rem', textAlign:'center', lineHeight:1 }}>Day {i+1}<div style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.58rem', color:'var(--dim)', fontWeight:400 }}>{lbl}</div></div>
                    <div><div style={{ fontWeight:900, fontSize:'0.84rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'0.2rem' }}>{p.name}</div><div style={{ fontSize:'0.75rem', color:'var(--dim2)' }}>CTR {p.ctr.toFixed(2)}% · CVR {p.cvr.toFixed(2)}% · バウンス {p.bounce.toFixed(1)}%</div></div>
                    <span className={'pb pb-'+p.category}>{CATEGORY_LABELS[p.category]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* AIタブ */}
        {tab==='ai' && (
          <div className="fade-up" style={{ maxWidth:1200, margin:'0 auto', padding:'1.5rem' }}>
            <div style={{ background:'var(--card)', border:'1px solid rgba(0,212,170,0.2)', borderRadius:20, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'1rem 1.5rem', background:'linear-gradient(135deg,rgba(0,212,170,0.06),rgba(0,212,170,0.02))', borderBottom:'1px solid rgba(0,212,170,0.12)', flexWrap:'wrap' }}>
                <div style={{ fontSize:'1.5rem' }}>🤖</div>
                <div><div style={{ fontSize:'0.9rem', fontWeight:900, color:'var(--ai)' }}>Claude AI 改善アドバイザー</div><div style={{ fontSize:'0.72rem', color:'var(--dim2)' }}>4月以降利用可能になります</div></div>
              </div>
              <div style={{ padding:'3rem', textAlign:'center', color:'var(--dim2)' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem', opacity:0.4 }}>🔧</div>
                <div style={{ fontSize:'0.85rem' }}>現在メンテナンス中です。4月以降に利用可能になります。</div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
