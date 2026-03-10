import { useState, useEffect } from 'react'
import { db, auth } from '../lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts'
import PlanPage from './PlanPage'

export default function DashboardPage() {
  const [histories, setHistories] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('today')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const userId = auth.currentUser?.uid || 'anonymous'
      const snap = await getDocs(collection(db, 'xlsx_analyses'))
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.userId === userId && d.uploadedAt?.seconds)
        .sort((a, b) => a.uploadedAt.seconds - b.uploadedAt.seconds)
      setHistories(list)
    } catch(e) { console.error(e) }
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
                {!latest ? (
                  <div style={{ textAlign:'center', padding:'3rem', color:'var(--dim2)', fontSize:'0.85rem' }}>データがありません。XLSXをアップロードしてください。</div>
                ) : (
                  <KpiCards items={[
                    { l:'最新売上', v:'₱'+(latest.kpis?.totalSales||0).toLocaleString('en',{maximumFractionDigits:0}), a:'var(--orange)' },
                    { l:'商品数', v:(latest.kpis?.productCount||0)+'件', a:'var(--purple)' },
                    { l:'平均CTR', v:(latest.kpis?.avgCtr||0).toFixed(2)+'%', a:(latest.kpis?.avgCtr||0)>3?'var(--green)':'var(--yellow)' },
                    { l:'平均CVR', v:(latest.kpis?.avgCvr||0).toFixed(2)+'%', a:(latest.kpis?.avgCvr||0)>5?'var(--green)':(latest.kpis?.avgCvr||0)<3?'var(--red)':'var(--yellow)' },
                    { l:'緊急改善', v:(latest.kpis?.urgentCount||0)+'件', a:(latest.kpis?.urgentCount||0)>0?'var(--red)':'var(--green)' },
                    { l:'最終アップ', v:formatLabel(latest.uploadedAt), a:'var(--ai)' },
                  ]} />
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

          </div>
        )}
      </div>
    </div>
  )
}
