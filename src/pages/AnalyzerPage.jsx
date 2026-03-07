import { useState, useRef } from 'react'
import { parseShopeeXLSX, calcKPIs, CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/xlsx'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

export default function AnalyzerPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('overview')
  const [filter, setFilter] = useState('all')
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const dropRef = useRef()

  async function handleFile(file) {
    if (!file) return
    setLoading(true); setData(null)
    try {
      const result = await parseShopeeXLSX(file)
      result.kpis = calcKPIs(result.products)
      setData(result)
    } catch (e) { 
      console.error('AI Error:', e)
      alert('解析エラー: ' + e.message + '\n\nAPIキー: ' + (API_KEY ? API_KEY.substring(0,20) + '...' : 'なし'))
    }
    setLoading(false)
  }

  async function runAI() {
    if (!data?.products?.length || aiLoading) return
    setAiLoading(true); setAiText('')
    const { products, kpis } = data
    const top10 = [...products].sort((a,b) => b.priorityScore - a.priorityScore).slice(0,10)
    const prompt = `あなたはShopeeフィリピン(PH)販売のエキスパートです。以下のデータをもとに日本語で具体的な改善提案を生成してください。

【全体KPI】総売上:₱${kpis.totalSales?.toLocaleString()} | 商品数:${kpis.productCount}件 | 平均CTR:${kpis.avgCtr?.toFixed(2)}% | 平均CVR:${kpis.avgCvr?.toFixed(2)}% | バウンス率:${kpis.avgBounce?.toFixed(1)}%

【優先度上位10商品】
${top10.map((p,i) => `${i+1}. ${p.name} | 売上₱${p.sales.toLocaleString()} | CTR:${p.ctr.toFixed(2)}% CVR:${p.cvr.toFixed(2)}% | 判定:${CATEGORY_LABELS[p.category]}`).join('\n')}

以下の構成で回答してください：
## 📊 ショップ全体の診断
## 🔴 最優先3商品の改善アクション
## 💡 全商品共通の横断的施策（3つ）
## 🎯 今週のアクションプラン`

    try {
      const res = await fetch('/api/anthropic/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:1500, messages:[{ role:'user', content:prompt }] })
      })
      if (!res.ok) {
        const errBody = await res.text()
        throw new Error('API Error: ' + res.status + ' / ' + errBody)
      }
      const json = await res.json()
      setAiText(json.content?.[0]?.text || '応答がありませんでした')
    } catch (e) { 
      console.error('AI Error:', e)
      setAiText('⚠️ エラー: ' + e.message + ' / ' + (e.cause || ''))
    }
    setAiLoading(false)
  }

  const sorted = data ? [...data.products].sort((a,b) => b.priorityScore - a.priorityScore) : []
  const filtered = filter === 'all' ? sorted : sorted.filter(p => p.category === filter)
  const maxSales = data ? Math.max(...data.products.map(p => p.sales), 1) : 1
  const catCounts = data ? Object.entries(data.products.reduce((acc,p) => ({...acc,[p.category]:(acc[p.category]||0)+1}),{})).map(([k,v]) => ({ name:CATEGORY_LABELS[k], value:v, color:CATEGORY_COLORS[k] })) : []

  if (!data && !loading) return (
    <div style={{ maxWidth:800, margin:'2rem auto', padding:'0 1.5rem' }}>
      <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', letterSpacing:'0.04em', marginBottom:'1.5rem' }}>週次 XLSX アナライザー</h2>
      <div ref={dropRef} onClick={() => document.getElementById('xlsx-input').click()}
        onDragOver={e => { e.preventDefault(); dropRef.current.style.borderColor='var(--orange)' }}
        onDragLeave={() => dropRef.current.style.borderColor='rgba(255,107,43,0.3)'}
        onDrop={e => { e.preventDefault(); dropRef.current.style.borderColor='rgba(255,107,43,0.3)'; handleFile(e.dataTransfer.files[0]) }}
        style={{ border:'2px dashed rgba(255,107,43,0.3)', borderRadius:20, padding:'4rem 2rem', textAlign:'center', cursor:'pointer', background:'rgba(255,107,43,0.02)', transition:'all 0.3s' }}>
        <div style={{ fontSize:'3.5rem', marginBottom:'1rem' }}>📊</div>
        <h3 style={{ fontWeight:900, marginBottom:'0.5rem' }}>XLSXファイルをドロップ</h3>
        <p style={{ fontSize:'0.8rem', color:'var(--dim2)' }}>またはクリックしてファイルを選択</p>
        <p style={{ fontSize:'0.72rem', color:'var(--dim)', marginTop:'0.5rem' }}>📋 ダウンロード先: <a href="https://seller.shopee.ph/datacenter/product/performance" target="_blank" style={{ color:'var(--orange)', textDecoration:'none' }}>seller.shopee.ph › Business Insights › Product › Product Performance</a></p>
        <p style={{ fontSize:'0.72rem', color:'var(--dim)', marginTop:'0.3rem' }}>⚠️ 期間は <strong style={{ color:'var(--dim2)' }}>「過去30日間」</strong> を選択してダウンロードしてください</p>
        <input id="xlsx-input" type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
      </div>
    </div>
  )

  if (loading) return <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'50vh', gap:'1rem' }}><div className="spinner" /><p style={{ color:'var(--dim2)' }}>解析中...</p></div>

  return (
    <div>
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--rim)', padding:'0.75rem 1.5rem', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
        <div><div style={{ fontWeight:900, fontSize:'0.88rem' }}>{data.filename}</div><div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontFamily:"'DM Mono',monospace" }}>{data.products.length}商品 分析完了</div></div>
        <button className="btn-ghost" style={{ marginLeft:'auto', fontSize:'0.75rem' }} onClick={() => { setData(null); setAiText('') }}>← 別ファイル</button>
      </div>
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--rim)', display:'flex', overflowX:'auto', padding:'0 1.5rem' }}>
        {[['overview','📊 概要'],['products','🔍 商品詳細'],['roadmap','📅 ロードマップ'],['ai','🤖 AI提案']].map(([id,label]) => (
          <div key={id} onClick={() => setTab(id)} style={{ padding:'0.85rem 1.2rem', cursor:'pointer', fontSize:'0.8rem', fontWeight:700, color:tab===id?'var(--orange)':'var(--dim2)', borderBottom:tab===id?'2px solid var(--orange)':'2px solid transparent', whiteSpace:'nowrap', transition:'all 0.2s' }}>{label}</div>
        ))}
      </div>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'1.5rem' }}>
        {tab==='overview' && (
          <div className="fade-up">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
              {[{l:'総売上',v:`₱${data.kpis.totalSales?.toLocaleString('en',{maximumFractionDigits:0})}`,a:'var(--orange)'},{l:'商品数',v:`${data.kpis.productCount}件`,a:'var(--purple)'},{l:'平均CTR',v:`${data.kpis.avgCtr?.toFixed(2)}%`,a:data.kpis.avgCtr>3?'var(--green)':'var(--yellow)'},{l:'平均CVR',v:`${data.kpis.avgCvr?.toFixed(2)}%`,a:data.kpis.avgCvr>5?'var(--green)':data.kpis.avgCvr<3?'var(--red)':'var(--yellow)'},{l:'バウンス率',v:`${data.kpis.avgBounce?.toFixed(1)}%`,a:data.kpis.avgBounce<30?'var(--green)':'var(--yellow)'},{l:'緊急改善',v:`${data.kpis.urgentCount}件`,a:data.kpis.urgentCount>0?'var(--red)':'var(--green)'}].map(k => (
                <div key={k.l} className="card" style={{ padding:'1.25rem', borderTop:`2px solid ${k.a}` }}>
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
                    <Tooltip contentStyle={{ background:'var(--card)', border:'1px solid var(--rim2)', borderRadius:8 }} formatter={v => [`₱${Number(v).toLocaleString()}`,'売上']} />
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
          <div className="fade-up">
            <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginBottom:'1rem' }}>
              {['all',...Object.keys(CATEGORY_LABELS)].map(k => (
                <button key={k} onClick={() => setFilter(k)} style={{ padding:'0.32rem 0.75rem', borderRadius:8, cursor:'pointer', fontSize:'0.73rem', border:'1px solid var(--rim)', background:filter===k?'rgba(255,107,43,0.1)':'var(--card)', color:filter===k?'var(--orange)':'var(--dim2)', fontFamily:"'Zen Kaku Gothic New',sans-serif", fontWeight:700 }}>
                  {k==='all'?'すべて':CATEGORY_LABELS[k]}
                </button>
              ))}
            </div>
            <div className="tbl-wrap">
              <table><thead><tr><th>#</th><th>商品</th><th>売上 (PHP)</th><th>CTR</th><th>CVR</th><th>バウンス</th><th>判定</th></tr></thead>
              <tbody>{filtered.map((p,i) => (
                <tr key={i}>
                  <td style={{ color:'var(--dim)', fontSize:'0.72rem' }} className="mono">{i+1}</td>
                  <td><div className="pname" title={p.name}>{p.name}</div></td>
                  <td><div className="bar-wrap"><div className="mini-bar"><div className="mini-bar-fill" style={{ width:`${p.sales/maxSales*100}%`, background:'var(--orange)' }} /></div><span className="bar-val">₱{p.sales.toLocaleString('en',{maximumFractionDigits:0})}</span></div></td>
                  <td style={{ textAlign:'center', color:p.ctr>3?'var(--green)':'var(--yellow)' }} className="mono">{p.ctr.toFixed(2)}%</td>
                  <td style={{ textAlign:'center', color:p.cvr>5?'var(--green)':p.cvr<3?'var(--red)':'var(--yellow)' }} className="mono">{p.cvr.toFixed(2)}%</td>
                  <td style={{ textAlign:'center', color:p.bounce<30?'var(--green)':p.bounce>60?'var(--red)':'var(--yellow)' }} className="mono">{p.bounce.toFixed(1)}%</td>
                  <td><span className={`pb pb-${p.category}`}>{CATEGORY_LABELS[p.category]}</span></td>
                </tr>
              ))}</tbody></table>
            </div>
          </div>
        )}
        {tab==='roadmap' && (
          <div className="fade-up">
            <div className="sec-hdr"><span className="sec-title">30日間 改善ロードマップ</span><span className="count-badge">{Math.min(sorted.length,30)}件</span></div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.55rem' }}>
              {sorted.slice(0,30).map((p,i) => {
                const d = new Date(2026,2,15); d.setDate(d.getDate()+i)
                const lbl = `${d.getMonth()+1}/${d.getDate()}(${'日月火水木金土'[d.getDay()]})`
                return (
                  <div key={i} className="card" style={{ padding:'1rem 1.25rem', display:'grid', gridTemplateColumns:'auto 1fr auto', gap:'1rem', alignItems:'center' }}>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.3rem', color:'var(--orange)', minWidth:'2.6rem', textAlign:'center', lineHeight:1 }}>Day {i+1}<div style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.58rem', color:'var(--dim)', fontWeight:400 }}>{lbl}</div></div>
                    <div><div style={{ fontWeight:900, fontSize:'0.84rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'0.2rem' }}>{p.name}</div><div style={{ fontSize:'0.75rem', color:'var(--dim2)' }}>CTR {p.ctr.toFixed(2)}% · CVR {p.cvr.toFixed(2)}% · バウンス {p.bounce.toFixed(1)}%</div></div>
                    <span className={`pb pb-${p.category}`}>{CATEGORY_LABELS[p.category]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {tab==='ai' && (
          <div className="fade-up">
            <div style={{ background:'var(--card)', border:'1px solid rgba(0,212,170,0.2)', borderRadius:20, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'1rem 1.5rem', background:'linear-gradient(135deg,rgba(0,212,170,0.06),rgba(0,212,170,0.02))', borderBottom:'1px solid rgba(0,212,170,0.12)', flexWrap:'wrap' }}>
                <div style={{ fontSize:'1.5rem' }}>🤖</div>
                <div><div style={{ fontSize:'0.9rem', fontWeight:900, color:'var(--ai)' }}>Claude AI 改善アドバイザー</div><div style={{ fontSize:'0.72rem', color:'var(--dim2)' }}>あなたのデータを元に具体的な改善提案を生成します</div></div>
                <button onClick={runAI} disabled={aiLoading} style={{ marginLeft:'auto', background:'linear-gradient(135deg,rgba(0,212,170,0.2),rgba(0,212,170,0.1))', border:'1px solid rgba(0,212,170,0.35)', color:'var(--ai)', padding:'0.5rem 1.25rem', borderRadius:'var(--r)', fontSize:'0.78rem', fontWeight:700, cursor:aiLoading?'not-allowed':'pointer', opacity:aiLoading?0.5:1, fontFamily:"'Zen Kaku Gothic New',sans-serif" }}>
                  {aiLoading ? '⏳ 分析中...' : '✨ AI分析を開始する'}
                </button>
              </div>
              <div style={{ padding:'1.5rem', minHeight:200 }}>
                {!aiText && !aiLoading && <div style={{ textAlign:'center', padding:'2rem', color:'var(--dim2)' }}><div style={{ fontSize:'2.5rem', marginBottom:'0.75rem', opacity:0.4 }}>🤖</div><div style={{ fontSize:'0.85rem' }}>「AI分析を開始する」ボタンを押してください</div></div>}
                {aiLoading && <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', color:'var(--dim2)', fontSize:'0.85rem' }}><div className="spinner" style={{ width:24, height:24, borderWidth:2 }} />分析中...</div>}
                {aiText && <div style={{ fontSize:'0.84rem', lineHeight:1.9, color:'var(--dim2)' }} dangerouslySetInnerHTML={{ __html: aiText.replace(/## (.*)/g,'<div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--ai);margin-top:1.25rem;margin-bottom:0.4rem">$1</div>').replace(/\*\*(.*?)\*\*/g,'<strong style="color:var(--text)">$1</strong>').replace(/\n/g,'<br>') }} />}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
