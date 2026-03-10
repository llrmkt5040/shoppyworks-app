import { useState, useRef, useEffect } from 'react'
import { parseShopeeXLSX, calcKPIs, CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/xlsx'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { db, auth } from '../lib/firebase'
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore'

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
  const [filter, setFilter] = useState('all')
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [toast, setToast] = useState({ msg:'', type:'success' })
  const [saving, setSaving] = useState(false)
  const [histories, setHistories] = useState([])
  const [histLoading, setHistLoading] = useState(false)
  const dropRef = useRef()

  useEffect(() => {
    if (tab === 'history' && histories.length === 0) {
      loadHistories()
    }
  }, [tab])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg:'', type:'success' }), 3000)
  }

  async function loadHistories() {
    setHistLoading(true)
    try {
      const userId = auth.currentUser?.uid || 'anonymous'
      const q = query(collection(db, 'xlsx_analyses'), where('userId', '==', userId))
      const snap = await getDocs(q)
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0))
      setHistories(list)
    } catch(e) {
      console.error('履歴取得エラー:', e)
      showToast('履歴取得に失敗しました', 'error')
    }
    setHistLoading(false)
  }

  async function deleteHistory(id) {
    if (!confirm('この履歴を削除しますか？')) return
    try {
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
        cvr: p.cvr || 0, bounce: p.bounce || 0,
        category: p.category || '', priorityScore: p.priorityScore || 0,
      }))
      const docRef = await addDoc(collection(db, 'xlsx_analyses'), {
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
      console.log('Firestore保存成功:', docRef.id)
      showToast('✅ 保存しました（' + productsToSave.length + '件）', 'success')
    } catch(e) {
      console.error('Firestore保存エラー:', e)
      showToast('保存に失敗しました: ' + e.message, 'error')
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
      setLoading(false)
      await saveToFirestore(result)
      return
    } catch(e) {
      console.error('解析エラー:', e)
      alert('解析エラー: ' + e.message)
    }
    setLoading(false)
  }

  async function runAI() {
    if (!data?.products?.length || aiLoading) return
    setAiLoading(true); setAiText('')
    const { products, kpis } = data
    const top10 = [...products].sort((a,b) => b.priorityScore - a.priorityScore).slice(0,10)
    const prompt = 'あなたはShopeeフィリピン(PH)販売のエキスパートです。以下のデータをもとに日本語で具体的な改善提案を生成してください。\n\n【全体KPI】総売上:₱' + kpis.totalSales?.toLocaleString() + ' | 商品数:' + kpis.productCount + '件 | 平均CTR:' + kpis.avgCtr?.toFixed(2) + '% | 平均CVR:' + kpis.avgCvr?.toFixed(2) + '% | バウンス率:' + kpis.avgBounce?.toFixed(1) + '%\n\n【優先度上位10商品】\n' + top10.map((p,i) => (i+1) + '. ' + p.name + ' | 売上₱' + p.sales.toLocaleString() + ' | CTR:' + p.ctr.toFixed(2) + '% CVR:' + p.cvr.toFixed(2) + '% | 判定:' + CATEGORY_LABELS[p.category]).join('\n') + '\n\n以下の構成で回答してください：\n## 📊 ショップ全体の診断\n## 🔴 最優先3商品の改善アクション\n## 💡 全商品共通の横断的施策（3つ）\n## 🎯 今週のアクションプラン'
    try {
      const res = await fetch('http://localhost:3001', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:1500, messages:[{ role:'user', content:prompt }] })
      })
      if (!res.ok) { const err = await res.text(); throw new Error('API Error: ' + res.status + ' / ' + err) }
      const json = await res.json()
      setAiText(json.content?.[0]?.text || '応答がありませんでした')
    } catch(e) {
      console.error('AI Error:', e)
      setAiText('⚠️ エラー: ' + e.message)
    }
    setAiLoading(false)
  }

  const sorted = data ? [...data.products].sort((a,b) => b.priorityScore - a.priorityScore) : []
  const filtered = filter === 'all' ? sorted : sorted.filter(p => p.category === filter)
  const maxSales = data ? Math.max(...data.products.map(p => p.sales), 1) : 1
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
        <p style={{ fontSize:'0.72rem', color:'var(--dim)', marginTop:'0.5rem' }}>📋 ダウンロード先: <a href="https://seller.shopee.ph/datacenter/product/performance" target="_blank" style={{ color:'var(--orange)', textDecoration:'none' }}>seller.shopee.ph › Business Insights › Product › Product Performance</a></p>
        <p style={{ fontSize:'0.72rem', color:'var(--dim)', marginTop:'0.3rem' }}>⚠️ 期間は <strong style={{ color:'var(--dim2)' }}>「過去30日間」</strong> を選択してダウンロードしてください</p>
        <input id="xlsx-input" type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
      </div>
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
            {histories.map((h, i) => (
              <div key={h.id} className="card" style={{ padding:'0.9rem 1.1rem', display:'grid', gridTemplateColumns:'auto 1fr auto', gap:'1rem', alignItems:'center' }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.4rem', color:'var(--orange)', minWidth:'1.6rem', textAlign:'center', lineHeight:1 }}>{i+1}</div>
                <div>
                  <div style={{ fontWeight:900, fontSize:'0.82rem', marginBottom:'0.25rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📊 {h.filename}</div>
                  <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'0.68rem', color:'var(--dim2)' }}>🕒 {formatDate(h.uploadedAt)}</span>
                    <span style={{ fontSize:'0.68rem', color:'var(--dim2)' }}>📦 {h.productCount}商品</span>
                    <span style={{ fontSize:'0.68rem', color:'var(--orange)', fontWeight:700 }}>₱{h.kpis?.totalSales?.toLocaleString('en',{maximumFractionDigits:0})}</span>
                    <span style={{ fontSize:'0.68rem', color:h.kpis?.avgCtr>3?'var(--green)':'var(--yellow)' }}>CTR {h.kpis?.avgCtr?.toFixed(2)}%</span>
                    <span style={{ fontSize:'0.68rem', color:h.kpis?.urgentCount>0?'var(--red)':'var(--dim2)' }}>🔴 緊急{h.kpis?.urgentCount}件</span>
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
    <div>
      <Toast msg={toast.msg} type={toast.type} />
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--rim)', padding:'0.75rem 1.5rem', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
        <div>
          <div style={{ fontWeight:900, fontSize:'0.88rem' }}>{data.filename}</div>
          <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontFamily:"'DM Mono',monospace" }}>
            {data.products.length}商品 分析完了
            {saving && <span style={{ marginLeft:'0.5rem', color:'var(--orange)' }}>💾 保存中...</span>}
          </div>
        </div>
        <button className="btn-ghost" style={{ marginLeft:'auto', fontSize:'0.75rem' }} onClick={() => { setData(null); setAiText(''); loadHistories() }}>← 別ファイル</button>
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
                  <td><div className="bar-wrap"><div className="mini-bar"><div className="mini-bar-fill" style={{ width:(p.sales/maxSales*100)+'%', background:'var(--orange)' }} /></div><span className="bar-val">₱{p.sales.toLocaleString('en',{maximumFractionDigits:0})}</span></div></td>
                  <td style={{ textAlign:'center', color:p.ctr>3?'var(--green)':'var(--yellow)' }} className="mono">{p.ctr.toFixed(2)}%</td>
                  <td style={{ textAlign:'center', color:p.cvr>5?'var(--green)':p.cvr<3?'var(--red)':'var(--yellow)' }} className="mono">{p.cvr.toFixed(2)}%</td>
                  <td style={{ textAlign:'center', color:p.bounce<30?'var(--green)':p.bounce>60?'var(--red)':'var(--yellow)' }} className="mono">{p.bounce.toFixed(1)}%</td>
                  <td><span className={'pb pb-'+p.category}>{CATEGORY_LABELS[p.category]}</span></td>
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
                {aiText && <div style={{ fontSize:'0.84rem', lineHeight:1.9, color:'var(--dim2)' }} dangerouslySetInnerHTML={{ __html: aiText.replace(/## (.*)/g,'<h4 style="color:var(--ai);margin-top:1rem">$1</h4>').replace(/\*\*(.*?)\*\*/g,'<strong style="color:var(--text)">$1</strong>').replace(/\n/g,'<br>') }} />}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
