import { useState, useEffect } from 'react'
import { db, auth } from '../lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts'

export default function DashboardPage() {
  const [histories, setHistories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const userId = auth.currentUser?.uid || 'anonymous'
      const snap = await getDocs(collection(db, 'xlsx_analyses'))
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.userId === userId && d.uploadedAt && d.uploadedAt.seconds)
        .sort((a, b) => (a.uploadedAt.seconds) - (b.uploadedAt.seconds))
      setHistories(list)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  function formatDate(ts) {
    if (!ts) return '-'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return (d.getMonth()+1) + '/' + d.getDate()
  }

  // 時系列データ生成
  const trendData = histories.map((h, i) => ({
    label: formatDate(h.uploadedAt),
    week: 'Week ' + (i + 1),
    totalSales: Math.round(h.kpis?.totalSales || 0),
    avgCtr: parseFloat((h.kpis?.avgCtr || 0).toFixed(2)),
    avgCvr: parseFloat((h.kpis?.avgCvr || 0).toFixed(2)),
    urgentCount: h.kpis?.urgentCount || 0,
    productCount: h.kpis?.productCount || 0,
  }))

  // 先週比ランキング（最新2件を比較）
  const rankingData = (() => {
    if (histories.length < 2) return { improved: [], worsened: [] }
    const prev = histories[histories.length - 2]
    const curr = histories[histories.length - 1]
    const prevMap = {}
    ;(prev.products || []).forEach(p => { prevMap[p.name] = p })
    const diffs = (curr.products || [])
      .filter(p => prevMap[p.name])
      .map(p => {
        const old = prevMap[p.name]
        return {
          name: p.name,
          salesDiff: p.sales - old.sales,
          ctrDiff: parseFloat((p.ctr - old.ctr).toFixed(2)),
          cvrDiff: parseFloat((p.cvr - old.cvr).toFixed(2)),
        }
      })
    const improved = diffs.filter(d => d.salesDiff > 0).sort((a,b) => b.salesDiff - a.salesDiff).slice(0,5)
    const worsened = diffs.filter(d => d.salesDiff < 0).sort((a,b) => a.salesDiff - b.salesDiff).slice(0,5)
    return { improved, worsened }
  })()

  // 最新KPI
  const latest = histories[histories.length - 1]
  const prev = histories[histories.length - 2]

  function diff(curr, prev, key) {
    if (!curr || !prev) return null
    const d = (curr.kpis?.[key] || 0) - (prev.kpis?.[key] || 0)
    return d
  }

  function DiffBadge({ value, reverse = false, unit = '' }) {
    if (value === null) return null
    const positive = reverse ? value < 0 : value > 0
    const color = positive ? '#16a34a' : value === 0 ? '#6b7280' : '#dc2626'
    const sign = value > 0 ? '+' : ''
    return (
      <span style={{ fontSize:'0.68rem', fontWeight:700, color, marginLeft:'0.4rem' }}>
        {sign}{typeof value === 'number' ? value.toFixed(2) : value}{unit}
      </span>
    )
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:'1rem' }}>
      <div className="spinner" />
      <p style={{ color:'var(--dim2)', fontSize:'0.85rem' }}>データ読み込み中...</p>
    </div>
  )

  if (histories.length === 0) return (
    <div style={{ maxWidth:700, margin:'4rem auto', padding:'0 1.5rem', textAlign:'center' }}>
      <div style={{ fontSize:'4rem', marginBottom:'1rem', opacity:0.4 }}>📊</div>
      <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'2rem', letterSpacing:'0.04em', marginBottom:'0.75rem' }}>週次ダッシュボード</h2>
      <p style={{ color:'var(--dim2)', fontSize:'0.88rem', lineHeight:1.8 }}>
        まだデータがありません。<br />
        ShopeeAnalyzerからXLSXをアップロードすると<br />
        ここに推移グラフが表示されます。
      </p>
    </div>
  )

  return (
    <div style={{ maxWidth:1200, margin:'0 auto', padding:'1.5rem' }}>

      {/* ヘッダー */}
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.5rem' }}>
        <div>
          <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', letterSpacing:'0.04em', margin:0 }}>週次ダッシュボード</h2>
          <div style={{ fontSize:'0.72rem', color:'var(--dim2)' }}>{histories.length}週分のデータ · 最終更新: {formatDate(latest?.uploadedAt)}</div>
        </div>
        <button className="btn-ghost" style={{ marginLeft:'auto', fontSize:'0.75rem' }} onClick={loadData}>🔄 更新</button>
      </div>

      {/* 最新KPIカード */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
        {[
          { l:'最新売上', v:'₱'+(latest?.kpis?.totalSales||0).toLocaleString('en',{maximumFractionDigits:0}), a:'var(--orange)', d: diff(latest,prev,'totalSales'), unit:'₱' },
          { l:'商品数', v:(latest?.kpis?.productCount||0)+'件', a:'var(--purple)', d: diff(latest,prev,'productCount'), unit:'件' },
          { l:'平均CTR', v:(latest?.kpis?.avgCtr||0).toFixed(2)+'%', a:(latest?.kpis?.avgCtr||0)>3?'var(--green)':'var(--yellow)', d: diff(latest,prev,'avgCtr'), unit:'%' },
          { l:'平均CVR', v:(latest?.kpis?.avgCvr||0).toFixed(2)+'%', a:(latest?.kpis?.avgCvr||0)>5?'var(--green)':(latest?.kpis?.avgCvr||0)<3?'var(--red)':'var(--yellow)', d: diff(latest,prev,'avgCvr'), unit:'%' },
          { l:'緊急改善', v:(latest?.kpis?.urgentCount||0)+'件', a:(latest?.kpis?.urgentCount||0)>0?'var(--red)':'var(--green)', d: diff(latest,prev,'urgentCount'), unit:'件', reverse:true },
        ].map(k => (
          <div key={k.l} className="card" style={{ padding:'1.25rem', borderTop:'2px solid '+k.a }}>
            <div style={{ fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.12em', color:'var(--dim2)', fontWeight:700, marginBottom:'0.4rem' }}>{k.l}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.9rem', color:k.a, lineHeight:1 }}>{k.v}</div>
            {histories.length >= 2 && <div style={{ marginTop:'0.3rem', fontSize:'0.68rem', color:'var(--dim2)' }}>
              前週比 <span style={{ color: k.d > 0 ? (k.reverse ? '#dc2626' : '#16a34a') : k.d < 0 ? (k.reverse ? '#16a34a' : '#dc2626') : '#6b7280', fontWeight:700 }}>
                {k.d > 0 ? '+' : ''}{typeof k.d === 'number' ? k.d.toFixed(1) : k.d}{k.unit}
              </span>
            </div>}
          </div>
        ))}
      </div>

      {/* グラフ2列 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>

        {/* 売上推移 */}
        <div className="card" style={{ padding:'1.25rem' }}>
          <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>📈 売上推移</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill:'#6b7280', fontSize:10 }} />
              <YAxis tick={{ fill:'#6b7280', fontSize:10 }} tickFormatter={v => '₱'+v.toLocaleString()} />
              <Tooltip contentStyle={{ background:'var(--card)', border:'1px solid var(--rim2)', borderRadius:8, fontSize:'0.78rem' }} formatter={v => ['₱'+Number(v).toLocaleString(), '売上']} />
              <Line type="monotone" dataKey="totalSales" stroke="#f97316" strokeWidth={2.5} dot={{ r:4, fill:'#f97316' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* CTR/CVR推移 */}
        <div className="card" style={{ padding:'1.25rem' }}>
          <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>📊 CTR / CVR 推移</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill:'#6b7280', fontSize:10 }} />
              <YAxis tick={{ fill:'#6b7280', fontSize:10 }} tickFormatter={v => v+'%'} />
              <Tooltip contentStyle={{ background:'var(--card)', border:'1px solid var(--rim2)', borderRadius:8, fontSize:'0.78rem' }} formatter={v => [v+'%']} />
              <Legend wrapperStyle={{ fontSize:'0.72rem' }} />
              <Line type="monotone" dataKey="avgCtr" name="CTR" stroke="#2563eb" strokeWidth={2.5} dot={{ r:4, fill:'#2563eb' }} />
              <Line type="monotone" dataKey="avgCvr" name="CVR" stroke="#16a34a" strokeWidth={2.5} dot={{ r:4, fill:'#16a34a' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 緊急改善件数推移 */}
        <div className="card" style={{ padding:'1.25rem' }}>
          <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>🔴 緊急改善件数の推移</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill:'#6b7280', fontSize:10 }} />
              <YAxis tick={{ fill:'#6b7280', fontSize:10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background:'var(--card)', border:'1px solid var(--rim2)', borderRadius:8, fontSize:'0.78rem' }} formatter={v => [v+'件', '緊急改善']} />
              <Bar dataKey="urgentCount" name="緊急改善" fill="rgba(220,38,38,0.7)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 先週比ランキング */}
        <div className="card" style={{ padding:'1.25rem' }}>
          <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>🏆 先週比ランキング</div>
          {histories.length < 2 ? (
            <div style={{ textAlign:'center', padding:'2rem', color:'var(--dim)', fontSize:'0.8rem' }}>2週分以上のデータが必要です</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--green)', marginBottom:'0.2rem' }}>▲ 改善トップ</div>
              {rankingData.improved.length === 0 && <div style={{ fontSize:'0.75rem', color:'var(--dim)', marginBottom:'0.5rem' }}>改善商品なし</div>}
              {rankingData.improved.map((p,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.4rem 0.6rem', background:'rgba(22,163,74,0.08)', borderRadius:6 }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--green)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                  <span style={{ fontSize:'0.72rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--green)' }}>+₱{p.salesDiff.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--red)', margin:'0.4rem 0 0.2rem' }}>▼ 要注意</div>
              {rankingData.worsened.length === 0 && <div style={{ fontSize:'0.75rem', color:'var(--dim)' }}>悪化商品なし</div>}
              {rankingData.worsened.map((p,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.4rem 0.6rem', background:'rgba(220,38,38,0.08)', borderRadius:6 }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--red)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                  <span style={{ fontSize:'0.72rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--red)' }}>₱{p.salesDiff.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 商品ごとの週次比較テーブル */}
      {histories.length >= 2 && (
        <div className="card" style={{ padding:'1.25rem' }}>
          <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>📦 商品ごとの週次比較（上位20件）</div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>商品名</th>
                  <th>今週売上</th>
                  <th>先週比</th>
                  <th>今週CTR</th>
                  <th>今週CVR</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const curr = histories[histories.length - 1]
                  const prev = histories[histories.length - 2]
                  const prevMap = {}
                  ;(prev.products || []).forEach(p => { prevMap[p.name] = p })
                  return (curr.products || [])
                    .sort((a,b) => b.sales - a.sales)
                    .slice(0, 20)
                    .map((p, i) => {
                      const old = prevMap[p.name]
                      const salesDiff = old ? p.sales - old.sales : null
                      return (
                        <tr key={i}>
                          <td style={{ color:'var(--dim)', fontSize:'0.72rem' }} className="mono">{i+1}</td>
                          <td><div className="pname" title={p.name}>{p.name}</div></td>
                          <td className="mono" style={{ color:'var(--orange)' }}>₱{p.sales.toLocaleString('en',{maximumFractionDigits:0})}</td>
                          <td className="mono" style={{ color: salesDiff === null ? 'var(--dim)' : salesDiff >= 0 ? '#16a34a' : '#dc2626' }}>
                            {salesDiff === null ? '-' : (salesDiff >= 0 ? '+' : '') + '₱' + salesDiff.toLocaleString('en',{maximumFractionDigits:0})}
                          </td>
                          <td className="mono" style={{ textAlign:'center', color:p.ctr>3?'var(--green)':'var(--yellow)' }}>{p.ctr.toFixed(2)}%</td>
                          <td className="mono" style={{ textAlign:'center', color:p.cvr>5?'var(--green)':p.cvr<3?'var(--red)':'var(--yellow)' }}>{p.cvr.toFixed(2)}%</td>
                        </tr>
                      )
                    })
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
