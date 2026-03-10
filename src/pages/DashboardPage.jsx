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

  function formatDate(ts) {
    if (!ts) return '-'
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return (d.getMonth()+1) + '/' + d.getDate()
  }

  // 今日アップ済みチェック
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayUploaded = histories.some(h => toDateStr(h.uploadedAt) === todayStr)

  // 最後のアップ日
  const latest = histories[histories.length - 1]
  const prev = histories[histories.length - 2]
  const latestDateStr = latest ? toDateStr(latest.uploadedAt) : null

  // 未アップ日数
  const daysSinceUpload = latestDateStr
    ? Math.floor((new Date(todayStr) - new Date(latestDateStr)) / 86400000)
    : null

  // 連続アップ日数（ストリーク）
  const streak = (() => {
    if (!histories.length) return 0
    const dates = histories.map(h => toDateStr(h.uploadedAt)).filter(Boolean)
    const unique = [...new Set(dates)].sort().reverse()
    let count = 0
    let check = todayUploaded ? todayStr : (() => {
      const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10)
    })()
    for (const d of unique) {
      if (d === check) {
        count++
        const prev = new Date(check); prev.setDate(prev.getDate()-1)
        check = prev.toISOString().slice(0,10)
      } else break
    }
    return count
  })()

  // 時系列データ
  const trendData = histories.map((h, i) => ({
    label: formatDate(h.uploadedAt),
    totalSales: Math.round(h.kpis?.totalSales || 0),
    avgCtr: parseFloat((h.kpis?.avgCtr || 0).toFixed(2)),
    avgCvr: parseFloat((h.kpis?.avgCvr || 0).toFixed(2)),
    urgentCount: h.kpis?.urgentCount || 0,
  }))

  // 前日差分
  function diff(key) {
    if (!latest || !prev) return null
    return (latest.kpis?.[key] || 0) - (prev.kpis?.[key] || 0)
  }

  // 先週比ランキング
  const rankingData = (() => {
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

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:'1rem' }}>
      <div className="spinner" />
      <p style={{ color:'var(--dim2)', fontSize:'0.85rem' }}>データ読み込み中...</p>
    </div>
  )

  return (
    <div style={{ maxWidth:1200, margin:'0 auto', padding:'1.5rem' }}>

      {/* ヘッダー */}
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
        <div>
          <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', letterSpacing:'0.04em', margin:0 }}>週次ダッシュボード</h2>
          <div style={{ fontSize:'0.72rem', color:'var(--dim2)' }}>{histories.length}件のデータ蓄積中</div>
        </div>
        <button className="btn-ghost" style={{ marginLeft:'auto', fontSize:'0.75rem' }} onClick={loadData}>🔄 更新</button>
      </div>

      {/* アップロードステータスバー */}
      <div style={{ marginBottom:'1.5rem', borderRadius:16, overflow:'hidden', border:'1px solid var(--rim)' }}>
        {/* 今日のステータス */}
        <div style={{ padding:'1rem 1.5rem', background: todayUploaded ? 'rgba(22,163,74,0.08)' : daysSinceUpload >= 2 ? 'rgba(220,38,38,0.08)' : 'rgba(234,179,8,0.08)', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
          <div style={{ fontSize:'1.8rem' }}>{todayUploaded ? '✅' : daysSinceUpload >= 2 ? '🚨' : '⚠️'}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:900, fontSize:'0.9rem', color: todayUploaded ? '#16a34a' : daysSinceUpload >= 2 ? '#dc2626' : '#ca8a04' }}>
              {todayUploaded
                ? '今日のアップロード完了！'
                : daysSinceUpload === 1
                  ? '今日まだアップロードしていません'
                  : daysSinceUpload >= 2
                    ? daysSinceUpload + '日間アップロードされていません'
                    : '最初のXLSXをアップロードしてください'}
            </div>
            <div style={{ fontSize:'0.72rem', color:'var(--dim2)', marginTop:'0.2rem' }}>
              {latestDateStr ? '最終アップ: ' + latestDateStr : 'まだデータがありません'}
              {streak > 0 && <span style={{ marginLeft:'0.75rem', color:'var(--orange)', fontWeight:700 }}>🔥 {streak}日連続アップ中！</span>}
            </div>
          </div>
          {!todayUploaded && (
            <a href="https://seller.shopee.ph/datacenter/product/performance" target="_blank" style={{ padding:'0.45rem 1rem', borderRadius:8, background:'var(--orange)', color:'#fff', fontSize:'0.75rem', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
              Shopeeでダウンロード →
            </a>
          )}
        </div>

        {/* ストリーク・統計バー */}
        {histories.length > 0 && (
          <div style={{ padding:'0.75rem 1.5rem', background:'var(--surface)', borderTop:'1px solid var(--rim)', display:'flex', gap:'2rem', flexWrap:'wrap' }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.6rem', color:'var(--orange)', lineHeight:1 }}>{streak}</div>
              <div style={{ fontSize:'0.62rem', color:'var(--dim2)', textTransform:'uppercase', letterSpacing:'0.08em' }}>連続日数</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.6rem', color:'var(--purple)', lineHeight:1 }}>{histories.length}</div>
              <div style={{ fontSize:'0.62rem', color:'var(--dim2)', textTransform:'uppercase', letterSpacing:'0.08em' }}>総アップ数</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.6rem', color: daysSinceUpload >= 2 ? 'var(--red)' : 'var(--green)', lineHeight:1 }}>{daysSinceUpload ?? '-'}</div>
              <div style={{ fontSize:'0.62rem', color:'var(--dim2)', textTransform:'uppercase', letterSpacing:'0.08em' }}>未アップ日数</div>
            </div>
          </div>
        )}
      </div>

      {histories.length === 0 && (
        <div style={{ textAlign:'center', padding:'4rem', color:'var(--dim2)' }}>
          <div style={{ fontSize:'3rem', opacity:0.3, marginBottom:'1rem' }}>📊</div>
          <div style={{ fontSize:'0.88rem' }}>ShopeeAnalyzerからXLSXをアップロードするとグラフが表示されます</div>
        </div>
      )}

      {histories.length > 0 && (<>

        {/* 最新KPIカード */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
          {[
            { l:'最新売上', v:'₱'+(latest?.kpis?.totalSales||0).toLocaleString('en',{maximumFractionDigits:0}), a:'var(--orange)', d:diff('totalSales'), unit:'₱', fmt: v => '₱'+Math.abs(v).toLocaleString('en',{maximumFractionDigits:0}) },
            { l:'商品数', v:(latest?.kpis?.productCount||0)+'件', a:'var(--purple)', d:diff('productCount'), unit:'件', fmt: v => Math.abs(v)+'件' },
            { l:'平均CTR', v:(latest?.kpis?.avgCtr||0).toFixed(2)+'%', a:(latest?.kpis?.avgCtr||0)>3?'var(--green)':'var(--yellow)', d:diff('avgCtr'), unit:'%', fmt: v => Math.abs(v).toFixed(2)+'%' },
            { l:'平均CVR', v:(latest?.kpis?.avgCvr||0).toFixed(2)+'%', a:(latest?.kpis?.avgCvr||0)>5?'var(--green)':(latest?.kpis?.avgCvr||0)<3?'var(--red)':'var(--yellow)', d:diff('avgCvr'), unit:'%', fmt: v => Math.abs(v).toFixed(2)+'%' },
            { l:'緊急改善', v:(latest?.kpis?.urgentCount||0)+'件', a:(latest?.kpis?.urgentCount||0)>0?'var(--red)':'var(--green)', d:diff('urgentCount'), reverse:true, unit:'件', fmt: v => Math.abs(v)+'件' },
          ].map(k => (
            <div key={k.l} className="card" style={{ padding:'1.25rem', borderTop:'2px solid '+k.a }}>
              <div style={{ fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.12em', color:'var(--dim2)', fontWeight:700, marginBottom:'0.4rem' }}>{k.l}</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.9rem', color:k.a, lineHeight:1 }}>{k.v}</div>
              {k.d !== null && histories.length >= 2 && (
                <div style={{ marginTop:'0.3rem', fontSize:'0.68rem', color:'var(--dim2)' }}>
                  前回比 <span style={{ color: k.d > 0 ? (k.reverse?'#dc2626':'#16a34a') : k.d < 0 ? (k.reverse?'#16a34a':'#dc2626') : '#6b7280', fontWeight:700 }}>
                    {k.d > 0 ? '▲ +' : k.d < 0 ? '▼ -' : '±'}{k.d !== 0 ? k.fmt(k.d) : '0'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* グラフ2列 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
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

          <div className="card" style={{ padding:'1.25rem' }}>
            <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>🔴 緊急改善件数の推移</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData}>
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
              <div style={{ textAlign:'center', padding:'2rem', color:'var(--dim)', fontSize:'0.8rem' }}>2件以上のデータが必要です</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
                <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--green)', marginBottom:'0.2rem' }}>▲ 改善トップ</div>
                {rankingData.improved.length === 0 && <div style={{ fontSize:'0.75rem', color:'var(--dim)', marginBottom:'0.5rem' }}>改善商品なし</div>}
                {rankingData.improved.map((p,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.35rem 0.6rem', background:'rgba(22,163,74,0.08)', borderRadius:6 }}>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--green)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                    <span style={{ fontSize:'0.72rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                    <span style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--green)', whiteSpace:'nowrap' }}>+₱{p.salesDiff.toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--red)', margin:'0.4rem 0 0.2rem' }}>▼ 要注意</div>
                {rankingData.worsened.length === 0 && <div style={{ fontSize:'0.75rem', color:'var(--dim)' }}>悪化商品なし</div>}
                {rankingData.worsened.map((p,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.35rem 0.6rem', background:'rgba(220,38,38,0.08)', borderRadius:6 }}>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--red)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                    <span style={{ fontSize:'0.72rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                    <span style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--red)', whiteSpace:'nowrap' }}>₱{p.salesDiff.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 商品週次比較テーブル */}
        {histories.length >= 2 && (
          <div className="card" style={{ padding:'1.25rem' }}>
            <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>📦 商品ごとの前回比較（上位20件）</div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>商品名</th><th>今回売上</th><th>前回比</th><th>今回CTR</th><th>今回CVR</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const prevMap = {}
                    ;(prev.products || []).forEach(p => { prevMap[p.name] = p })
                    return (latest.products || [])
                      .sort((a,b) => b.sales - a.sales)
                      .slice(0, 20)
                      .map((p, i) => {
                        const old = prevMap[p.name]
                        const salesDiff = old ? p.sales - old.sales : null
                        return (
                          <tr key={i}>
                            <td style={{ color:'var(--dim)', fontSize:'0.72rem' }} className="mono">{i+1}</td>
                            <td><div className="pname" title={p.name}>{p.name}</div></td>
                            <td className="mono" style={{ color:'var(--orange)' }}>₱{(p.sales||0).toLocaleString('en',{maximumFractionDigits:0})}</td>
                            <td className="mono" style={{ color: salesDiff===null?'var(--dim)':salesDiff>=0?'#16a34a':'#dc2626' }}>
                              {salesDiff===null?'-':(salesDiff>=0?'+':'-')+'₱'+Math.abs(salesDiff).toLocaleString('en',{maximumFractionDigits:0})}
                            </td>
                            <td className="mono" style={{ textAlign:'center', color:p.ctr>3?'var(--green)':'var(--yellow)' }}>{(p.ctr||0).toFixed(2)}%</td>
                            <td className="mono" style={{ textAlign:'center', color:p.cvr>5?'var(--green)':p.cvr<3?'var(--red)':'var(--yellow)' }}>{(p.cvr||0).toFixed(2)}%</td>
                          </tr>
                        )
                      })
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>)}
    </div>
  )
}
