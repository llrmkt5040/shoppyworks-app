import { useState, useRef, useEffect } from 'react'
import { parseShopeeXLSX, calcKPIs, CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/xlsx'

const FLAGS = {
  standard: { label:'定番', emoji:'🟢', color:'#16a34a' },
  seasonal:  { label:'季節', emoji:'🌸', color:'#ec4899' },
  trend:     { label:'トレンド', emoji:'🔥', color:'#f97316' },
  eol:       { label:'終売',  emoji:'⚫', color:'#6b7280' },
}
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { db, auth } from '../lib/firebase'
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore'

const CHANGELOG = [
  { date: "2026-03-11", text: "🎯 ShopeeAnalyzerをコクピットに強化・トップページ設定" },
  { date: "2026-03-11", text: "📊 ダッシュボードを4タブ化（日次・週次・月次・ロードマップ）" },
  { date: "2026-03-11", text: "🔍 商品詳細テーブルに枠固定・ソート・フィルタ・条件指定を追加" },
  { date: "2026-03-11", text: "🔥 ダッシュボードに日次アップ管理・ストリーク・アラート追加" },
  { date: "2026-03-10", text: "📂 分析履歴をFirestoreに保存・履歴ページ追加" },
  { date: "2026-03-10", text: "🏠 週次ダッシュボード新規作成" }
]

function Toast({ msg, type }) {
  if (!msg) return null
  const bg = type === 'success' ? '#16a34a' : '#dc2626'
  return (
    <div style={{ position:'fixed', bottom:'1.5rem', right:'1.5rem', background:bg, color:'#fff', padding:'0.75rem 1.25rem', borderRadius:12, fontSize:'0.82rem', fontWeight:700, boxShadow:'0 4px 20px rgba(0,0,0,0.3)', zIndex:9999 }}>
      {msg}
    </div>
  )
}

export default function AnalyzerPage({ onNavigate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('overview')
  const [toast, setToast] = useState({ msg:'', type:'success' })
  const [saving, setSaving] = useState(false)
  const [latestHistory, setLatestHistory] = useState(null)
  const [histories, setHistories] = useState([])
  const [productFlags, setProductFlags] = useState({})
  const [flagFilter, setFlagFilter] = useState('all')
  const [urgentCount, setUrgentCount] = useState(null)
  const [histLoading, setHistLoading] = useState(true)

  // ソート・フィルタ
  const [sortKey, setSortKey] = useState('priorityScore')
  const [sortDir, setSortDir] = useState('desc')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [minImpressions, setMinImpressions] = useState(0)
  const [minSales, setMinSales] = useState(0)

  const dropRef = useRef()

  useEffect(() => {
    loadLatestHistory()
    loadFlags()
  }, [])

  async function loadFlags() {
    try {
      const userId = auth.currentUser?.uid || 'anonymous'
      const snap = await getDocs(collection(db, 'product_flags'))
      const flags = {}
      snap.docs.forEach(d => {
        const dat = d.data()
        if (dat.userId === userId) flags[dat.productName] = dat.flag
      })
      setProductFlags(flags)
    } catch(e) { console.error('flags load error:', e) }
  }

  async function setFlag(productName, flag) {
    try {
      const userId = auth.currentUser?.uid || 'anonymous'
      const { query, where, getDocs: gd, setDoc, doc: docRef, deleteDoc } = await import('firebase/firestore')
      const q = query(collection(db, 'product_flags'), where('userId','==',userId), where('productName','==',productName))
      const snap = await gd(q)
      const current = productFlags[productName]
      if (current === flag) {
        // 同じフラグをクリック → 解除
        snap.docs.forEach(d => deleteDoc(docRef(db, 'product_flags', d.id)))
        setProductFlags(prev => { const n = {...prev}; delete n[productName]; return n })
      } else {
        // 新しいフラグをセット
        const id = userId + '_' + productName.replace(/[^a-zA-Z0-9]/g,'_').slice(0,50)
        await setDoc(docRef(db, 'product_flags', id), { userId, productName, flag, updatedAt: new Date() })
        setProductFlags(prev => ({ ...prev, [productName]: flag }))
      }
    } catch(e) { console.error('flag set error:', e); showToast('フラグの保存に失敗しました', 'error') }
  }

  async function loadLatestHistory() {
    setHistLoading(true)
    try {
      const userId = auth.currentUser?.uid || 'anonymous'
      const snap = await getDocs(collection(db, 'xlsx_analyses'))
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.userId === userId && d.uploadedAt?.seconds)
        .sort((a, b) => b.uploadedAt.seconds - a.uploadedAt.seconds)
      setHistories(list)
      if (list.length > 0) {
        setLatestHistory(list[0])
        setUrgentCount(list[0].kpis?.urgentCount || 0)

      }
    } catch(e) { console.error(e) }
    setHistLoading(false)
  }

  function loadAndRestore(h) {
    if (!h.products?.length) { showToast('商品データがありません', 'error'); return }
    setData({ filename: h.filename, products: h.products, kpis: h.kpis })
    setTab('products')
    showToast('履歴を復元しました', 'success')
  }

  async function deleteHistory(id) {
    if (!confirm('この履歴を削除しますか？')) return
    try {
      const { deleteDoc, doc: docRef } = await import('firebase/firestore')
      await deleteDoc(docRef(db, 'xlsx_analyses', id))
      setHistories(prev => prev.filter(h => h.id !== id))
      if (latestHistory?.id === id) setLatestHistory(null)
      showToast('削除しました', 'success')
    } catch(e) { showToast('削除に失敗しました', 'error') }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg:'', type:'success' }), 3000)
  }

  async function saveToFirestore(result) {
    setSaving(true)
    try {
      const userId = auth.currentUser?.uid || 'anonymous'
      const productsToSave = result.products.slice(0, 100).map(p => ({
        name: p.name || '', sales: p.sales || 0, ctr: p.ctr || 0,
        cvr: p.cvr || 0, bounce: p.bounce || 0,
        impressions: p.impressions || 0, orders: p.orders || 0,
        category: p.category || '', priorityScore: p.priorityScore || 0,
      }))
      await addDoc(collection(db, 'xlsx_analyses'), {
        userId, filename: result.filename || 'unknown.xlsx',
        uploadedAt: serverTimestamp(),
        productCount: result.products.length, savedCount: productsToSave.length,
        kpis: {
          totalSales: result.kpis.totalSales || 0, productCount: result.kpis.productCount || 0,
          avgCtr: result.kpis.avgCtr || 0, avgCvr: result.kpis.avgCvr || 0,
          avgBounce: result.kpis.avgBounce || 0, urgentCount: result.kpis.urgentCount || 0,
        },
        products: productsToSave,
      })
      showToast('✅ 保存しました（' + productsToSave.length + '件）', 'success')
    } catch(e) { showToast('保存に失敗: ' + e.message, 'error') }
    setSaving(false)
  }

  async function handleFile(file) {
    if (!file) return
    setLoading(true); setData(null)
    try {
      const result = await parseShopeeXLSX(file)
      result.kpis = calcKPIs(result.products)
      setData(result)
      setTab('products')
      setLoading(false)
      await saveToFirestore(result)
      return
    } catch(e) { alert('解析エラー: ' + e.message) }
    setLoading(false)
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filteredProducts = data ? data.products
    .filter(p => flagFilter === 'all' || productFlags[p.name] === flagFilter)
    .filter(p => categoryFilter === 'all' || p.category === categoryFilter)
    .filter(p => (p.impressions || 0) >= minImpressions)
    .filter(p => (p.orders || 0) >= minSales)
    .sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
      return sortDir === 'desc' ? bv - av : av - bv
    }) : []

  const maxSales = data ? Math.max(...data.products.map(p => p.sales), 1) : 1
  const sorted = data ? [...data.products].sort((a,b) => b.priorityScore - a.priorityScore) : []
  const catCounts = data ? Object.entries(data.products.reduce((acc,p) => ({...acc,[p.category]:(acc[p.category]||0)+1}),{})).map(([k,v]) => ({ name:CATEGORY_LABELS[k], value:v, color:CATEGORY_COLORS[k] })) : []

  function formatDate(ts) {
    if (!ts) return '-'
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return d.toLocaleDateString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const latestDateStr = latestHistory ? new Date(latestHistory.uploadedAt.seconds * 1000).toISOString().slice(0, 10) : null
  const todayUploaded = latestDateStr === todayStr

  // アップロード前のトップ画面
  if (!data && !loading) return (
    <div style={{ maxWidth:900, margin:'0 auto', padding:'1.5rem' }}>
      <Toast msg={toast.msg} type={toast.type} />

      {/* コクピットヘッダー */}
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
        <div>
          <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', letterSpacing:'0.04em', margin:0 }}>ShopeeAnalyzer</h2>
          <div style={{ fontSize:'0.7rem', color:'var(--dim2)' }}>コクピット · 分析 · タスク管理</div>
        </div>
      </div>

      {/* ステータスカード */}
      {!histLoading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
          {/* アップ状況 */}
          <div className="card" style={{ padding:'1.1rem', borderTop:'2px solid '+(todayUploaded?'var(--green)':'var(--yellow)') }}>
            <div style={{ fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'0.4rem' }}>今日のアップ</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.6rem', color:todayUploaded?'var(--green)':'var(--yellow)', lineHeight:1 }}>{todayUploaded ? '✅ 完了' : '⚠️ 未'}</div>
            {latestHistory && <div style={{ fontSize:'0.65rem', color:'var(--dim2)', marginTop:'0.3rem' }}>{latestDateStr}</div>}
          </div>
          {/* 緊急改善件数 */}
          <div className="card" style={{ padding:'1.1rem', borderTop:'2px solid '+(urgentCount>0?'var(--red)':'var(--green)') }}>
            <div style={{ fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'0.4rem' }}>緊急改善タスク</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.6rem', color:urgentCount>0?'var(--red)':'var(--green)', lineHeight:1 }}>{urgentCount !== null ? urgentCount+'件' : '-'}</div>
            {latestHistory && <div style={{ fontSize:'0.65rem', color:'var(--dim2)', marginTop:'0.3rem' }}>最終分析より</div>}
          </div>
          {/* 最終ファイル */}
          <div className="card" style={{ padding:'1.1rem', borderTop:'2px solid var(--purple)' }}>
            <div style={{ fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'0.4rem' }}>最終ファイル</div>
            <div style={{ fontSize:'0.75rem', fontWeight:900, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{latestHistory?.filename || '未アップロード'}</div>
            {latestHistory && <div style={{ fontSize:'0.65rem', color:'var(--dim2)', marginTop:'0.3rem' }}>{formatDate(latestHistory.uploadedAt)}</div>}
          </div>
          {/* ダッシュボードリンク */}
          <div className="card" style={{ padding:'1.1rem', borderTop:'2px solid var(--orange)', cursor:'pointer' }} onClick={() => onNavigate && onNavigate('dashboard')}>
            <div style={{ fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'0.4rem' }}>数値ダッシュボード</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.4rem', color:'var(--orange)', lineHeight:1 }}>📈 開く →</div>
            <div style={{ fontSize:'0.65rem', color:'var(--dim2)', marginTop:'0.3rem' }}>ShopeeWorksDashboard</div>
          </div>
        </div>
      )}

      {/* アップロード履歴 */}
      {histories.length > 0 && (
        <div className="card" style={{ padding:'1.1rem', marginTop:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.75rem' }}>
            <span style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700 }}>📂 アップロード履歴</span>
            <span style={{ fontSize:'0.65rem', color:'var(--orange)', fontWeight:700 }}>{histories.length}件</span>
            <button className="btn-ghost" style={{ marginLeft:'auto', fontSize:'0.65rem' }} onClick={loadLatestHistory}>🔄</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
            {histories.map((h, i) => (
              <div key={h.id} style={{ display:'grid', gridTemplateColumns:'auto 1fr auto auto', gap:'0.75rem', alignItems:'center', padding:'0.5rem 0.6rem', background:'rgba(255,255,255,0.02)', borderRadius:8, border:'1px solid var(--rim)' }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.2rem', color:'var(--orange)', minWidth:'1.5rem', textAlign:'center', lineHeight:1 }}>{i+1}</div>
                <div>
                  <div style={{ fontSize:'0.75rem', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'0.15rem' }}>{h.filename}</div>
                  <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'0.65rem', color:'var(--dim2)' }}>🕒 {formatDate(h.uploadedAt)}</span>
                    <span style={{ fontSize:'0.65rem', color:'var(--orange)', fontWeight:700 }}>₱{(h.kpis?.totalSales||0).toLocaleString('en',{maximumFractionDigits:0})}</span>
                    <span style={{ fontSize:'0.65rem', color:'var(--dim2)' }}>📦 {h.productCount}商品</span>
                    <span style={{ fontSize:'0.65rem', color:(h.kpis?.urgentCount||0)>0?'var(--red)':'var(--dim2)' }}>🔴 緊急{h.kpis?.urgentCount||0}件</span>
                  </div>
                </div>
                <button onClick={() => loadAndRestore(h)} style={{ padding:'0.28rem 0.6rem', borderRadius:8, border:'1px solid rgba(255,107,43,0.3)', background:'rgba(255,107,43,0.08)', color:'var(--orange)', fontSize:'0.68rem', cursor:'pointer', fontWeight:700, fontFamily:"'Zen Kaku Gothic New',sans-serif", whiteSpace:'nowrap' }}>復元</button>
                <button onClick={() => deleteHistory(h.id)} style={{ padding:'0.28rem 0.5rem', borderRadius:8, border:'1px solid var(--rim)', background:'transparent', color:'var(--dim)', fontSize:'0.68rem', cursor:'pointer' }}>🗑️</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ドロップエリア */}
      <div ref={dropRef} onClick={() => document.getElementById('xlsx-input').click()}
        onDragOver={e => { e.preventDefault(); dropRef.current.style.borderColor='var(--orange)' }}
        onDragLeave={() => dropRef.current.style.borderColor='rgba(255,107,43,0.3)'}
        onDrop={e => { e.preventDefault(); dropRef.current.style.borderColor='rgba(255,107,43,0.3)'; handleFile(e.dataTransfer.files[0]) }}
        style={{ border:'2px dashed rgba(255,107,43,0.3)', borderRadius:20, padding:'2.5rem 2rem', textAlign:'center', cursor:'pointer', background:'rgba(255,107,43,0.02)', transition:'all 0.3s', marginBottom:'1.5rem' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>📊</div>
        <h3 style={{ fontWeight:900, marginBottom:'0.4rem', fontSize:'1rem' }}>XLSXファイルをドロップ</h3>
        <p style={{ fontSize:'0.75rem', color:'var(--dim2)', margin:'0 0 0.4rem' }}>またはクリックしてファイルを選択</p>
        <p style={{ fontSize:'0.68rem', color:'var(--dim)', margin:0 }}>📋 <a href="https://seller.shopee.ph/datacenter/product/performance" target="_blank" style={{ color:'var(--orange)', textDecoration:'none' }}>seller.shopee.ph › Product Performance</a> · 過去30日を選択</p>
        <input id="xlsx-input" type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
      </div>

      {/* システム更新履歴 */}
      <div className="card" style={{ padding:'1.1rem' }}>
        <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'0.75rem' }}>🔄 システム更新履歴</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
          {CHANGELOG.map((c, i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem', padding:'0.4rem 0', borderBottom: i < CHANGELOG.length-1 ? '1px solid var(--rim)' : 'none' }}>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.65rem', color:'var(--dim2)', whiteSpace:'nowrap', marginTop:'0.1rem' }}>{c.date}</span>
              <span style={{ fontSize:'0.75rem', color:'var(--text)' }}>{c.text}</span>
            </div>
          ))}
        </div>
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
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--rim)', padding:'0.75rem 1.5rem', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap', flexShrink:0 }}>
        <div>
          <div style={{ fontWeight:900, fontSize:'0.88rem' }}>{data.filename}</div>
          <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontFamily:"'DM Mono',monospace" }}>
            {data.products.length}商品 · 分析完了
            {saving && <span style={{ marginLeft:'0.5rem', color:'var(--orange)' }}>💾 保存中...</span>}
          </div>
        </div>
        <button className="btn-ghost" style={{ marginLeft:'auto', fontSize:'0.75rem' }} onClick={() => { setData(null); setTab('overview') }}>← 戻る</button>
      </div>
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--rim)', display:'flex', overflowX:'auto', flexShrink:0 }}>
        {[['overview','📊 概要'],['products','🔍 商品詳細'],['roadmap','📅 ロードマップ'],['ai','🤖 AI提案']].map(([id,label]) => (
          <div key={id} onClick={() => setTab(id)} style={{ padding:'0.85rem 1.2rem', cursor:'pointer', fontSize:'0.8rem', fontWeight:700, color:tab===id?'var(--orange)':'var(--dim2)', borderBottom:tab===id?'2px solid var(--orange)':'2px solid transparent', whiteSpace:'nowrap', transition:'all 0.2s' }}>{label}</div>
        ))}
      </div>
      <div style={{ flex:1, overflow:'auto' }}>
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
        {tab==='products' && (
          <div className="fade-up" style={{ display:'flex', flexDirection:'column', height:'100%' }}>
            <div style={{ padding:'0.75rem 1.5rem', borderBottom:'1px solid var(--rim)', background:'var(--surface)', display:'flex', gap:'0.75rem', flexWrap:'wrap', alignItems:'center', flexShrink:0 }}>
              <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' }}>
                {['all',...Object.keys(CATEGORY_LABELS)].map(k => (
                  <button key={k} onClick={() => setCategoryFilter(k)} style={{ padding:'0.28rem 0.7rem', borderRadius:8, cursor:'pointer', fontSize:'0.7rem', border:'1px solid var(--rim)', background:categoryFilter===k?'rgba(255,107,43,0.1)':'var(--card)', color:categoryFilter===k?'var(--orange)':'var(--dim2)', fontFamily:"'Zen Kaku Gothic New',sans-serif", fontWeight:700 }}>
                    {k==='all'?'すべて':CATEGORY_LABELS[k]}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' }}>
                <button onClick={() => setFlagFilter('all')} style={{ padding:'0.28rem 0.7rem', borderRadius:8, cursor:'pointer', fontSize:'0.7rem', border:'1px solid var(--rim)', background:flagFilter==='all'?'rgba(255,107,43,0.1)':'var(--card)', color:flagFilter==='all'?'var(--orange)':'var(--dim2)', fontFamily:"'Zen Kaku Gothic New',sans-serif", fontWeight:700 }}>🏷️ 全フラグ</button>
                {Object.entries(FLAGS).map(([k,f]) => (
                  <button key={k} onClick={() => setFlagFilter(k)} style={{ padding:'0.28rem 0.7rem', borderRadius:8, cursor:'pointer', fontSize:'0.7rem', border:'1px solid var(--rim)', background:flagFilter===k?'rgba(255,107,43,0.1)':'var(--card)', color:flagFilter===k?'var(--orange)':'var(--dim2)', fontFamily:"'Zen Kaku Gothic New',sans-serif", fontWeight:700 }}>{f.emoji} {f.label}</button>
                ))}
              </div>
              <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginLeft:'auto' }}>
                <label style={{ fontSize:'0.68rem', color:'var(--dim2)', whiteSpace:'nowrap' }}>表示: <strong style={{ color:'var(--orange)' }}>{filteredProducts.length}</strong>件</label>
                <div style={{ display:'flex', alignItems:'center', gap:'0.3rem', background:'var(--card)', border:'1px solid var(--rim)', borderRadius:8, padding:'0.25rem 0.6rem' }}>
                  <span style={{ fontSize:'0.65rem', color:'var(--dim2)' }}>IMP≥</span>
                  <input type="number" value={minImpressions} onChange={e => setMinImpressions(Number(e.target.value))} style={{ width:50, background:'transparent', border:'none', color:'var(--text)', fontSize:'0.72rem', fontFamily:"'DM Mono',monospace", outline:'none' }} min="0" />
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.3rem', background:'var(--card)', border:'1px solid var(--rim)', borderRadius:8, padding:'0.25rem 0.6rem' }}>
                  <span style={{ fontSize:'0.65rem', color:'var(--dim2)' }}>受注≥</span>
                  <input type="number" value={minSales} onChange={e => setMinSales(Number(e.target.value))} style={{ width:40, background:'transparent', border:'none', color:'var(--text)', fontSize:'0.72rem', fontFamily:"'DM Mono',monospace", outline:'none' }} min="0" />
                </div>
                <button onClick={() => { setCategoryFilter('all'); setMinImpressions(0); setMinSales(0); setSortKey('priorityScore'); setSortDir('desc') }} style={{ padding:'0.28rem 0.6rem', borderRadius:8, border:'1px solid var(--rim)', background:'transparent', color:'var(--dim2)', fontSize:'0.65rem', cursor:'pointer' }}>リセット</button>
              </div>
            </div>
            <div style={{ flex:1, overflow:'auto', padding:'0 1.5rem 1.5rem' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8rem' }}>
                <thead style={{ position:'sticky', top:0, zIndex:10, background:'var(--surface)' }}>
                  <tr style={{ borderBottom:'2px solid var(--rim2)' }}>
                    <th style={{ padding:'0.6rem 0.5rem', textAlign:'left', fontSize:'0.65rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', minWidth:30 }}>#</th>
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
                      <td style={{ padding:'0.55rem 0.5rem', maxWidth:300 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.35rem' }}>
                          <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.78rem', fontWeight:600, flex:1 }} title={p.name}>{p.name}</div>
                          {productFlags[p.name] && (
                            <span style={{ fontSize:'0.8rem', flexShrink:0 }}>{FLAGS[productFlags[p.name]]?.emoji}</span>
                          )}
                          <div style={{ display:'flex', gap:'0.15rem', flexShrink:0 }}>
                            {Object.entries(FLAGS).map(([k,f]) => (
                              <button key={k} onClick={() => setFlag(p.name, k)} title={f.label} style={{ width:20, height:20, borderRadius:4, border:'1px solid', borderColor:productFlags[p.name]===k?f.color:'transparent', background:productFlags[p.name]===k?f.color+'33':'rgba(255,255,255,0.05)', cursor:'pointer', fontSize:'0.65rem', display:'flex', alignItems:'center', justifyContent:'center', padding:0, transition:'all 0.15s' }}>
                                {f.emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
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
              {filteredProducts.length === 0 && <div style={{ textAlign:'center', padding:'3rem', color:'var(--dim2)', fontSize:'0.85rem' }}>条件に一致する商品がありません</div>}
            </div>
          </div>
        )}
        {tab==='roadmap' && (
          <div className="fade-up" style={{ maxWidth:1200, margin:'0 auto', padding:'1.5rem' }}>
            <div className="sec-hdr"><span className="sec-title">30日間 改善ロードマップ</span><span className="count-badge">{Math.min(sorted.length,30)}件</span></div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.55rem' }}>
              {sorted.slice(0,30).map((p,i) => {
                const d = new Date(2026,2,11); d.setDate(d.getDate()+i)
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
        {tab==='ai' && (
          <div className="fade-up" style={{ maxWidth:1200, margin:'0 auto', padding:'1.5rem' }}>
            <div style={{ background:'var(--card)', border:'1px solid rgba(0,212,170,0.2)', borderRadius:20, overflow:'hidden' }}>
              <div style={{ padding:'1rem 1.5rem', background:'linear-gradient(135deg,rgba(0,212,170,0.06),rgba(0,212,170,0.02))', borderBottom:'1px solid rgba(0,212,170,0.12)' }}>
                <div style={{ fontSize:'0.9rem', fontWeight:900, color:'var(--ai)' }}>🤖 Claude AI 改善アドバイザー</div>
                <div style={{ fontSize:'0.72rem', color:'var(--dim2)' }}>4月以降利用可能になります</div>
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
