import { useState, useEffect, useRef } from 'react'
import { db, auth } from '../lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts'
import PlanPage from './PlanPage'

export default function DashboardPage({ uid: propUid }) {
  const [histories, setHistories] = useState([])
  const [loading, setLoading] = useState(true)
  const [diaryLogs, setDiaryLogs] = useState([])
  const dropRef = useRef()
  const [tab, setTab] = useState('today')

  useEffect(() => { loadData() }, [])

  async function handleFile(file) {
    if (!file) return
    try {
      const { parseShopeeXLSX, calcKPIs } = await import('../lib/xlsx')
      const result = await parseShopeeXLSX(file)
      result.kpis = calcKPIs(result.products)
      const { addDoc, collection: col, serverTimestamp } = await import('firebase/firestore')
      const userId = propUid || propUid || auth.currentUser?.uid || 'anonymous'
      const productsToSave = result.products.slice(0, 100).map(p => ({
        name: p.name || '', sales: p.sales || 0, ctr: p.ctr || 0,
        cvr: p.cvr || 0, bounce: p.bounce || 0,
        impressions: p.impressions || 0, orders: p.orders || 0,
        category: p.category || '', priorityScore: p.priorityScore || 0,
      }))
      await addDoc(col(db, 'xlsx_analyses'), {
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
      alert('保存しました ' + productsToSave.length + '件 ShopeeAnalyzerで詳細確認できます')
      await loadData()
    } catch(e) { alert('エラー: ' + e.message) }
  }

  async function loadData() {
    setLoading(true)
    try {
      const userId = propUid || propUid || auth.currentUser?.uid || 'anonymous'
      const snap = await getDocs(collection(db, 'xlsx_analyses'))
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.userId === userId && d.uploadedAt?.seconds)
        .sort((a, b) => a.uploadedAt.seconds - b.uploadedAt.seconds)
      setHistories(list)
    } catch(e) { console.error(e) }
    // ShopeeDiaryログも取得
    try {
      const snap2 = await getDocs(collection(db, 'action_logs'))
      const logs = snap2.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.uid === (propUid || propUid || auth.currentUser?.uid || 'anonymous'))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 30)
      setDiaryLogs(logs)
    } catch(e) { console.error('diary fetch error:', e) }
    setLoading(false)
  }

  function toDateStr(ts) {
    if (!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return d.toISOString().slice(0, 10)
  }

  function formatLabel(ts) {
    if (!ts) return '-'
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return (d.getMonth()+1) + '/' + d.getDate()
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10) })()

  const todayUploaded = histories.some(h => toDateStr(h.uploadedAt) === todayStr)
  const latest = histories[histories.length - 1]
  const prev = histories[histories.length - 2]
  const latestDateStr = latest ? toDateStr(latest.uploadedAt) : null
  const daysSinceUpload = latestDateStr ? Math.floor((new Date(todayStr) - new Date(latestDateStr)) / 86400000) : null

  // ストリーク計算
  const streak = (() => {
    if (!histories.length) return 0
    const unique = [...new Set(histories.map(h => toDateStr(h.uploadedAt)).filter(Boolean))].sort().reverse()
    let count = 0
    let check = todayUploaded ? todayStr : yesterdayStr
    for (const d of unique) {
      if (d === check) {
        count++
        const prev = new Date(check); prev.setDate(prev.getDate()-1)
        check = prev.toISOString().slice(0,10)
      } else break
    }
    return count
  })()

  // 差分計算
  function kpiDiff(key) {
    if (!latest || !prev) return null
    return (latest.kpis?.[key] || 0) - (prev.kpis?.[key] || 0)
  }

  // 週次データ（直近7件）
  const weekData = histories.slice(-7).map(h => ({
    label: formatLabel(h.uploadedAt),
    totalSales: Math.round(h.kpis?.totalSales || 0),
    avgCtr: parseFloat((h.kpis?.avgCtr || 0).toFixed(2)),
    avgCvr: parseFloat((h.kpis?.avgCvr || 0).toFixed(2)),
    urgentCount: h.kpis?.urgentCount || 0,
  }))

  // 月次データ（直近30件）
  const monthData = histories.slice(-30).map(h => ({
    label: formatLabel(h.uploadedAt),
    totalSales: Math.round(h.kpis?.totalSales || 0),
    avgCtr: parseFloat((h.kpis?.avgCtr || 0).toFixed(2)),
    avgCvr: parseFloat((h.kpis?.avgCvr || 0).toFixed(2)),
    urgentCount: h.kpis?.urgentCount || 0,
  }))

  // 先週比ランキング
  const ranking = (() => {
    if (histories.length < 2) return { improved: [], worsened: [] }
    const prevMap = {}
    ;(prev.products || []).forEach(p => { prevMap[p.name] = p })
    const diffs = (latest.products || [])
      .filter(p => prevMap[p.name])
      .map(p => ({ name: p.name, salesDiff: p.sales - prevMap[p.name].sales }))
    return {
      improved: diffs.filter(d => d.salesDiff > 0).sort((a,b) => b.salesDiff - a.salesDiff).slice(0,5),
      worsened: diffs.filter(d => d.salesDiff < 0).sort((a,b) => a.salesDiff - b.salesDiff).slice(0,5),
    }
  })()

  const TABS = [
    { id:'today',     label:'📅 日次（当日）' },
    { id:'yesterday', label:'📅 日次（前日）' },
    { id:'weekly',    label:'📆 週次' },
    { id:'monthly',   label:'📊 月次' },
    { id:'roadmap',   label:'🎯 ロードマップ' },
    { id:'goals',     label:'🏆 目標管理' },
  ]

  function DiffBadge({ value, reverse = false, fmt }) {
    if (value === null || value === undefined) return null
    const positive = reverse ? value < 0 : value > 0
    const color = value === 0 ? '#6b7280' : positive ? '#16a34a' : '#dc2626'
    const arrow = value > 0 ? '▲ +' : value < 0 ? '▼ ' : '± '
    return <span style={{ color, fontWeight:700, fontSize:'0.68rem', marginLeft:'0.4rem' }}>{arrow}{fmt ? fmt(value) : value}</span>
  }

  function KpiCards({ items }) {
    return (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
        {items.map(k => (
          <div key={k.l} className="card" style={{ padding:'1.25rem', borderTop:'2px solid '+k.a }}>
            <div style={{ fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.12em', color:'var(--dim2)', fontWeight:700, marginBottom:'0.4rem' }}>{k.l}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.9rem', color:k.a, lineHeight:1 }}>{k.v}</div>
            {k.d !== undefined && <div style={{ marginTop:'0.3rem', fontSize:'0.68rem', color:'var(--dim2)' }}>前回比 <DiffBadge value={k.d} reverse={k.reverse} fmt={k.fmt} /></div>}
          </div>
        ))}
      </div>
    )
  }

  function TrendCharts({ data, title }) {
    if (data.length < 2) return (
      <div style={{ textAlign:'center', padding:'3rem', color:'var(--dim2)', fontSize:'0.85rem', border:'1px solid var(--rim)', borderRadius:12 }}>
        2件以上のデータが必要です
      </div>
    )
    return (
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
        <div className="card" style={{ padding:'1.25rem' }}>
          <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>📈 売上推移</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill:'#6b7280', fontSize:10 }} />
              <YAxis tick={{ fill:'#6b7280', fontSize:10 }} tickFormatter={v => '₱'+v.toLocaleString()} />
              <Tooltip contentStyle={{ background:'var(--card)', border:'1px solid var(--rim2)', borderRadius:8, fontSize:'0.78rem' }} formatter={v => ['₱'+Number(v).toLocaleString(), '売上']} />
              <Line type="monotone" dataKey="totalSales" stroke="#f97316" strokeWidth={2.5} dot={{ r:3, fill:'#f97316' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding:'1.25rem' }}>
          <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>📊 CTR / CVR 推移</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill:'#6b7280', fontSize:10 }} />
              <YAxis tick={{ fill:'#6b7280', fontSize:10 }} tickFormatter={v => v+'%'} />
              <Tooltip contentStyle={{ background:'var(--card)', border:'1px solid var(--rim2)', borderRadius:8, fontSize:'0.78rem' }} formatter={v => [v+'%']} />
              <Legend wrapperStyle={{ fontSize:'0.72rem' }} />
              <Line type="monotone" dataKey="avgCtr" name="CTR" stroke="#2563eb" strokeWidth={2.5} dot={{ r:3, fill:'#2563eb' }} />
              <Line type="monotone" dataKey="avgCvr" name="CVR" stroke="#16a34a" strokeWidth={2.5} dot={{ r:3, fill:'#16a34a' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding:'1.25rem' }}>
          <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>🔴 緊急改善件数</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill:'#6b7280', fontSize:10 }} />
              <YAxis tick={{ fill:'#6b7280', fontSize:10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background:'var(--card)', border:'1px solid var(--rim2)', borderRadius:8, fontSize:'0.78rem' }} formatter={v => [v+'件', '緊急改善']} />
              <Bar dataKey="urgentCount" fill="rgba(220,38,38,0.7)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding:'1.25rem' }}>
          <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>🏆 前回比ランキング</div>
          {histories.length < 2 ? (
            <div style={{ textAlign:'center', padding:'2rem', color:'var(--dim)', fontSize:'0.8rem' }}>2件以上必要</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
              <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--green)', marginBottom:'0.2rem' }}>▲ 改善トップ</div>
              {ranking.improved.length === 0 && <div style={{ fontSize:'0.72rem', color:'var(--dim)' }}>改善商品なし</div>}
              {ranking.improved.map((p,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.3rem 0.6rem', background:'rgba(22,163,74,0.08)', borderRadius:6 }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--green)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                  <span style={{ fontSize:'0.7rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--green)', whiteSpace:'nowrap' }}>+₱{p.salesDiff.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--red)', margin:'0.35rem 0 0.2rem' }}>▼ 要注意</div>
              {ranking.worsened.length === 0 && <div style={{ fontSize:'0.72rem', color:'var(--dim)' }}>悪化商品なし</div>}
              {ranking.worsened.map((p,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.3rem 0.6rem', background:'rgba(220,38,38,0.08)', borderRadius:6 }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--red)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                  <span style={{ fontSize:'0.7rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--red)', whiteSpace:'nowrap' }}>₱{p.salesDiff.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:'1rem' }}>
      <div className="spinner" /><p style={{ color:'var(--dim2)', fontSize:'0.85rem' }}>読み込み中...</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* タブバー */}
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--rim)', display:'flex', overflowX:'auto', flexShrink:0, padding:'0 1.5rem' }}>
        {TABS.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{ padding:'0.85rem 1.1rem', cursor:'pointer', fontSize:'0.78rem', fontWeight:700, color:tab===t.id?'var(--orange)':'var(--dim2)', borderBottom:tab===t.id?'2px solid var(--orange)':'2px solid transparent', whiteSpace:'nowrap', transition:'all 0.2s' }}>{t.label}</div>
        ))}
        <button className="btn-ghost" style={{ marginLeft:'auto', fontSize:'0.72rem', alignSelf:'center' }} onClick={loadData}>🔄</button>
      </div>

      <div style={{ flex:1, overflow:'auto' }}>

        {/* ロードマップタブ */}
        {tab === 'roadmap' && <PlanPage embedded={true} />}

        {tab !== 'roadmap' && (
          <div style={{ maxWidth:1200, margin:'0 auto', padding:'1.5rem' }}>

            {/* アップロードステータスバー（全タブ共通） */}
            <div style={{ marginBottom:'1.5rem', borderRadius:16, overflow:'hidden', border:'1px solid var(--rim)' }}>
              <div style={{ padding:'0.9rem 1.5rem', background: todayUploaded ? 'rgba(22,163,74,0.08)' : daysSinceUpload >= 2 ? 'rgba(220,38,38,0.08)' : 'rgba(234,179,8,0.08)', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
                <div style={{ fontSize:'1.5rem' }}>{todayUploaded ? '✅' : daysSinceUpload >= 2 ? '🚨' : '⚠️'}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:900, fontSize:'0.85rem', color: todayUploaded ? '#16a34a' : daysSinceUpload >= 2 ? '#dc2626' : '#ca8a04' }}>
                    {todayUploaded ? '今日のアップロード完了！' : daysSinceUpload === 1 ? '今日まだアップロードしていません' : daysSinceUpload >= 2 ? daysSinceUpload + '日間アップロードされていません' : '最初のXLSXをアップロードしてください'}
                  </div>
                  <div style={{ fontSize:'0.7rem', color:'var(--dim2)', marginTop:'0.15rem', display:'flex', gap:'1rem', flexWrap:'wrap' }}>
                    {latestDateStr && <span>最終アップ: {latestDateStr}</span>}
                    {streak > 0 && <span style={{ color:'var(--orange)', fontWeight:700 }}>🔥 {streak}日連続！</span>}
                    <span>総アップ: {histories.length}回</span>
                  </div>
                </div>
                {!todayUploaded && (
                  <a href="https://seller.shopee.ph/datacenter/product/performance" target="_blank" style={{ padding:'0.4rem 0.9rem', borderRadius:8, background:'var(--orange)', color:'#fff', fontSize:'0.73rem', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>Shopeeで取得 →</a>
                )}
              </div>
            </div>

            {/* 日次（当日）タブ */}
            {tab === 'today' && (
              <div className="fade-up">
                <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'1rem' }}>📅 {todayStr} のサマリー</div>

                {/* XLSXアップロードエリア */}
                <div
                  ref={dropRef}
                  onClick={() => document.getElementById('dash-xlsx-input').click()}
                  onDragOver={e => { e.preventDefault(); dropRef.current.style.borderColor='var(--orange)' }}
                  onDragLeave={() => dropRef.current.style.borderColor='rgba(255,107,43,0.3)'}
                  onDrop={e => { e.preventDefault(); dropRef.current.style.borderColor='rgba(255,107,43,0.3)'; handleFile(e.dataTransfer.files[0]) }}
                  style={{ border:'2px dashed rgba(255,107,43,0.3)', borderRadius:16, padding:'1.5rem', textAlign:'center', cursor:'pointer', background: todayUploaded ? 'rgba(22,163,74,0.04)' : 'rgba(255,107,43,0.02)', marginBottom:'1.25rem', transition:'all 0.3s' }}>
                  <div style={{ fontSize:'1.8rem', marginBottom:'0.4rem' }}>{todayUploaded ? '✅' : '📊'}</div>
                  <div style={{ fontWeight:900, fontSize:'0.85rem', marginBottom:'0.25rem' }}>{todayUploaded ? '今日アップ済み · 別ファイルをドロップで更新' : 'XLSXをドロップしてアップロード'}</div>
                  <div style={{ fontSize:'0.68rem', color:'var(--dim2)' }}>
                    <a href="https://seller.shopee.ph/datacenter/product/performance" target="_blank" style={{ color:'var(--orange)', textDecoration:'none' }}>seller.shopee.ph › Product Performance</a> · 過去30日を選択
                  </div>
                  <input id="dash-xlsx-input" type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
                </div>

                {/* KPIカード */}
                {latest && (
                  <KpiCards items={[
                    { l:'最新売上', v:'₱'+(latest.kpis?.totalSales||0).toLocaleString('en',{maximumFractionDigits:0}), a:'var(--orange)' },
                    { l:'商品数', v:(latest.kpis?.productCount||0)+'件', a:'var(--purple)' },
                    { l:'平均CTR', v:(latest.kpis?.avgCtr||0).toFixed(2)+'%', a:(latest.kpis?.avgCtr||0)>3?'var(--green)':'var(--yellow)' },
                    { l:'平均CVR', v:(latest.kpis?.avgCvr||0).toFixed(2)+'%', a:(latest.kpis?.avgCvr||0)>5?'var(--green)':(latest.kpis?.avgCvr||0)<3?'var(--red)':'var(--yellow)' },
                    { l:'緊急改善', v:(latest.kpis?.urgentCount||0)+'件', a:(latest.kpis?.urgentCount||0)>0?'var(--red)':'var(--green)' },
                    { l:'最終アップ', v:formatLabel(latest.uploadedAt), a:'var(--ai)' },
                  ]} />
                )}

                {/* ShopeeDiary最新ログ */}
                {diaryLogs.length > 0 && (
                  <div className="card" style={{ padding:'1.1rem', marginTop:'0.5rem' }}>
                    <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'0.75rem' }}>📅 ShopeeDiary 最新ログ</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                      {diaryLogs.slice(0,5).map((l, i) => (
                        <div key={i} style={{ display:'grid', gridTemplateColumns:'auto 1fr auto auto auto', gap:'0.75rem', alignItems:'center', padding:'0.4rem 0', borderBottom: i<4?'1px solid var(--rim)':'none' }}>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.65rem', color:'var(--dim2)', whiteSpace:'nowrap' }}>{l.date}</span>
                          <span style={{ fontSize:'0.72rem', color:'var(--dim2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.memo || '-'}</span>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.72rem', color:'var(--orange)', whiteSpace:'nowrap' }}>₱{Number(l.sales_php||0).toLocaleString()}</span>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.68rem', color:'var(--dim2)', whiteSpace:'nowrap' }}>出品:{l.listings||'-'}</span>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.68rem', color:'var(--dim2)', whiteSpace:'nowrap' }}>❤️{l.followers||'-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 日次（前日）タブ */}
            {tab === 'yesterday' && (
              <div className="fade-up">
                <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'1rem' }}>📅 前回との差分</div>
                {histories.length < 2 ? (
                  <div style={{ textAlign:'center', padding:'3rem', color:'var(--dim2)', fontSize:'0.85rem', border:'1px solid var(--rim)', borderRadius:12 }}>2件以上のデータが必要です</div>
                ) : (
                  <>
                    <KpiCards items={[
                      { l:'売上', v:'₱'+(latest.kpis?.totalSales||0).toLocaleString('en',{maximumFractionDigits:0}), a:'var(--orange)', d:kpiDiff('totalSales'), fmt: v => '₱'+Math.abs(v).toLocaleString('en',{maximumFractionDigits:0}) },
                      { l:'商品数', v:(latest.kpis?.productCount||0)+'件', a:'var(--purple)', d:kpiDiff('productCount'), fmt: v => Math.abs(v)+'件' },
                      { l:'平均CTR', v:(latest.kpis?.avgCtr||0).toFixed(2)+'%', a:(latest.kpis?.avgCtr||0)>3?'var(--green)':'var(--yellow)', d:kpiDiff('avgCtr'), fmt: v => Math.abs(v).toFixed(2)+'%' },
                      { l:'平均CVR', v:(latest.kpis?.avgCvr||0).toFixed(2)+'%', a:(latest.kpis?.avgCvr||0)>5?'var(--green)':(latest.kpis?.avgCvr||0)<3?'var(--red)':'var(--yellow)', d:kpiDiff('avgCvr'), fmt: v => Math.abs(v).toFixed(2)+'%' },
                      { l:'緊急改善', v:(latest.kpis?.urgentCount||0)+'件', a:(latest.kpis?.urgentCount||0)>0?'var(--red)':'var(--green)', d:kpiDiff('urgentCount'), reverse:true, fmt: v => Math.abs(v)+'件' },
                    ]} />
                    <div className="card" style={{ padding:'1.25rem' }}>
                      <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>🏆 前回比 商品ランキング</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                        <div>
                          <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--green)', marginBottom:'0.4rem' }}>▲ 改善トップ5</div>
                          {ranking.improved.length === 0 && <div style={{ fontSize:'0.72rem', color:'var(--dim)' }}>改善商品なし</div>}
                          {ranking.improved.map((p,i) => (
                            <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.35rem 0.6rem', background:'rgba(22,163,74,0.08)', borderRadius:6, marginBottom:'0.3rem' }}>
                              <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--green)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                              <span style={{ fontSize:'0.7rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                              <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--green)', whiteSpace:'nowrap' }}>+₱{p.salesDiff.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--red)', marginBottom:'0.4rem' }}>▼ 要注意5</div>
                          {ranking.worsened.length === 0 && <div style={{ fontSize:'0.72rem', color:'var(--dim)' }}>悪化商品なし</div>}
                          {ranking.worsened.map((p,i) => (
                            <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.35rem 0.6rem', background:'rgba(220,38,38,0.08)', borderRadius:6, marginBottom:'0.3rem' }}>
                              <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--red)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                              <span style={{ fontSize:'0.7rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                              <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--red)', whiteSpace:'nowrap' }}>₱{p.salesDiff.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 週次タブ */}
            {tab === 'weekly' && (
              <div className="fade-up">
                <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'1rem' }}>📆 直近7件の推移</div>
                <TrendCharts data={weekData} />
              </div>
            )}

            {/* 月次タブ */}
            {tab === 'monthly' && (
              <div className="fade-up">
                <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'1rem' }}>📊 直近30件の推移</div>
                <TrendCharts data={monthData} />
              </div>
            )}

            {/* 目標管理タブ */}
            {tab === 'goals' && (
              <GoalsTab uid={propUid || auth.currentUser?.uid} latest={latest} />
            )}

          </div>
        )}
      </div>
    </div>
  )
}

function GoalsTab({ uid, latest }) {
  const GOAL_PERIODS = [
    { id:'3years',  label:'🚀 3年後（2029年）',        desc:'長期ビジョン' },
    { id:'dec2026', label:'🎄 2026年12月',             desc:'年末目標' },
    { id:'aug2026', label:'☀️ 2026年8月（繁忙期直前）', desc:'繁忙期準備' },
    { id:'thismonth', label:'📅 今月の目標',            desc:new Date().getFullYear()+'年'+(new Date().getMonth()+1)+'月' },
  ]
  const GOAL_KEYS = [
    { key:'sales',   label:'月間売上',   unit:'₱', color:'var(--orange)', placeholder:'例: 50000' },
    { key:'orders',  label:'月間受注数', unit:'件', color:'var(--purple)', placeholder:'例: 100' },
    { key:'ctr',     label:'CTR目標',   unit:'%',  color:'#2563eb',       placeholder:'例: 5.0' },
    { key:'cvr',     label:'CVR目標',   unit:'%',  color:'#16a34a',       placeholder:'例: 8.0' },
    { key:'gross',   label:'粗利',      unit:'₱', color:'#10b981',       placeholder:'例: 20000' },
    { key:'profit',  label:'営業利益',  unit:'₱', color:'#06b6d4',       placeholder:'例: 15000' },
  ]
  const [goals, setGoals] = useState({})
  const [editing, setEditing] = useState('thismonth')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (uid) loadGoals() }, [uid])

  async function loadGoals() {
    try {
      const { db } = await import('../lib/firebase')
      const { doc, getDoc } = await import('firebase/firestore')
      const snap = await getDoc(doc(db, 'user_goals', uid))
      if (snap.exists()) setGoals(snap.data())
    } catch(e) { console.error(e) }
  }

  async function saveGoals() {
    setSaving(true)
    try {
      const { db } = await import('../lib/firebase')
      const { doc, setDoc } = await import('firebase/firestore')
      await setDoc(doc(db, 'user_goals', uid), { ...goals, updatedAt: new Date().toISOString() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch(e) { alert('保存エラー: '+e.message) }
    setSaving(false)
  }

  function setGoalVal(period, key, val) {
    setGoals(prev => ({ ...prev, [period]: { ...(prev[period]||{}), [key]: val } }))
  }

  function getActual(key) {
    if (!latest) return null
    const map = { sales: latest.kpis?.totalSales, orders: latest.kpis?.totalOrders, ctr: latest.kpis?.avgCtr, cvr: latest.kpis?.avgCvr }
    return map[key] ?? null
  }

  function getRate(actual, target) {
    if (!actual || !target || parseFloat(target) === 0) return null
    return Math.min(Math.round((actual / parseFloat(target)) * 100), 999)
  }

  const activePeriod = GOAL_PERIODS.find(p => p.id === editing)

  return (
    <div className="fade-up">
      {/* 期間タブ */}
      <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
        {GOAL_PERIODS.map(p => (
          <button key={p.id} onClick={() => setEditing(p.id)} style={{ padding:'0.5rem 1rem', borderRadius:10, border:'1px solid', borderColor:editing===p.id?'var(--orange)':'var(--rim)', background:editing===p.id?'rgba(255,107,43,0.1)':'transparent', color:editing===p.id?'var(--orange)':'var(--dim2)', cursor:'pointer', fontSize:'0.78rem', fontWeight:editing===p.id?800:600, transition:'all 0.15s' }}>
            {p.label}
            <div style={{ fontSize:'0.6rem', color:'var(--dim2)', fontWeight:400 }}>{p.desc}</div>
          </button>
        ))}
      </div>

      {/* 目標入力 */}
      <div className="card" style={{ padding:'1.5rem', marginBottom:'1rem' }}>
        <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--orange)', marginBottom:'1.25rem', textTransform:'uppercase', letterSpacing:'0.1em' }}>
          {activePeriod?.label} の目標設定
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'1rem' }}>
          {GOAL_KEYS.map(g => {
            const val = goals[editing]?.[g.key] || ''
            const actual = editing === 'thismonth' ? getActual(g.key) : null
            const rate = editing === 'thismonth' ? getRate(actual, val) : null
            return (
              <div key={g.key} style={{ padding:'0.75rem', background:'rgba(255,255,255,0.02)', borderRadius:10, border:'1px solid var(--rim)' }}>
                <div style={{ fontSize:'0.65rem', fontWeight:700, color:'var(--dim2)', marginBottom:'0.4rem', textTransform:'uppercase' }}>{g.label}</div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', marginBottom:'0.5rem' }}>
                  <span style={{ fontSize:'0.75rem', color:g.color }}>{g.unit}</span>
                  <input
                    type="number"
                    value={val}
                    onChange={e => setGoalVal(editing, g.key, e.target.value)}
                    placeholder={g.placeholder}
                    style={{ flex:1, background:'transparent', border:'none', borderBottom:'1px solid var(--rim2)', color:'var(--text)', fontSize:'0.95rem', fontWeight:700, fontFamily:"'DM Mono',monospace", outline:'none', padding:'0.1rem 0' }}
                  />
                </div>
                {editing === 'thismonth' && actual !== null && (
                  <div style={{ marginTop:'0.35rem' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.62rem', color:'var(--dim2)', marginBottom:'0.2rem' }}>
                      <span>現在: {g.unit==='₱'?'₱'+Math.round(actual).toLocaleString():actual?.toFixed(2)+g.unit}</span>
                      {rate !== null && <span style={{ color:rate>=100?'var(--green)':rate>=70?'var(--yellow)':'var(--red)', fontWeight:700 }}>{rate}%</span>}
                    </div>
                    {val && <div style={{ height:4, borderRadius:2, background:'var(--rim)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:Math.min(rate||0,100)+'%', background:rate>=100?'var(--green)':rate>=70?'var(--yellow)':'var(--red)', borderRadius:2, transition:'width 0.5s' }} />
                    </div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ marginTop:'1.25rem', display:'flex', gap:'0.75rem', alignItems:'center' }}>
          <button onClick={saveGoals} disabled={saving} style={{ padding:'0.55rem 1.75rem', borderRadius:10, border:'none', background:'var(--orange)', color:'#fff', fontWeight:700, cursor:saving?'not-allowed':'pointer', fontSize:'0.82rem' }}>
            {saving ? '保存中...' : '💾 保存する'}
          </button>
          {saved && <span style={{ fontSize:'0.78rem', color:'var(--green)', fontWeight:700 }}>✅ 保存しました！</span>}
        </div>
      </div>

      {/* 今月の達成状況サマリー */}
      {editing === 'thismonth' && latest && (
        <div className="card" style={{ padding:'1.25rem' }}>
          <div style={{ fontSize:'0.65rem', fontWeight:700, color:'var(--dim2)', marginBottom:'1rem', textTransform:'uppercase', letterSpacing:'0.1em' }}>📊 今月の達成状況</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'0.75rem' }}>
            {GOAL_KEYS.filter(g => goals['thismonth']?.[g.key]).map(g => {
              const actual = getActual(g.key)
              const target = parseFloat(goals['thismonth']?.[g.key] || 0)
              const rate = getRate(actual, target)
              if (actual === null) return null
              return (
                <div key={g.key} style={{ padding:'0.75rem', background:'rgba(255,255,255,0.02)', borderRadius:10, border:'1px solid var(--rim)', borderTop:'2px solid '+g.color }}>
                  <div style={{ fontSize:'0.62rem', color:'var(--dim2)', fontWeight:700, marginBottom:'0.3rem' }}>{g.label}</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.5rem', color:g.color, lineHeight:1 }}>
                    {rate !== null ? rate+'%' : '-'}
                  </div>
                  <div style={{ fontSize:'0.65rem', color:'var(--dim2)', marginTop:'0.2rem' }}>
                    {g.unit==='₱'?'₱'+Math.round(actual).toLocaleString():actual?.toFixed(2)+g.unit} / {g.unit==='₱'?'₱'+target.toLocaleString():target+g.unit}
                  </div>
                  <div style={{ height:3, borderRadius:2, background:'var(--rim)', marginTop:'0.4rem', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:Math.min(rate||0,100)+'%', background:rate>=100?'var(--green)':rate>=70?'var(--yellow)':'var(--red)', borderRadius:2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
