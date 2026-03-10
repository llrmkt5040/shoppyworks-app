import { useState, useEffect } from 'react'
import { db, auth } from '../lib/firebase'
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore'

export default function AnalysisHistoryPage() {
  const [histories, setHistories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistories()
  }, [])

  async function loadHistories() {
    setLoading(true)
    try {
      const userId = auth.currentUser?.uid || 'anonymous'
      const q = query(
        collection(db, 'xlsx_analyses'),
        where('userId', '==', userId)
      )
      const snap = await getDocs(q)
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.uploadedAt?.seconds||0) - (a.uploadedAt?.seconds||0))
      setHistories(list)
    } catch (e) {
      console.error('履歴取得エラー:', e)
    }
    setLoading(false)
  }

  async function deleteHistory(id) {
    if (!confirm('この履歴を削除しますか？')) return
    try {
      await deleteDoc(doc(db, 'xlsx_analyses', id))
      setHistories(prev => prev.filter(h => h.id !== id))
    } catch (e) {
      alert('削除に失敗しました: ' + e.message)
    }
  }

  function formatDate(ts) {
    if (!ts) return '-'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'50vh', gap:'1rem' }}>
      <div className="spinner" /><p style={{ color:'var(--dim2)' }}>読み込み中...</p>
    </div>
  )

  return (
    <div style={{ maxWidth:900, margin:'0 auto', padding:'1.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.5rem' }}>
        <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', letterSpacing:'0.04em', margin:0 }}>分析履歴</h2>
        <span style={{ background:'rgba(255,107,43,0.12)', color:'var(--orange)', borderRadius:8, padding:'0.2rem 0.6rem', fontSize:'0.75rem', fontWeight:700 }}>{histories.length}件</span>
        <button className="btn-ghost" style={{ marginLeft:'auto', fontSize:'0.75rem' }} onClick={loadHistories}>🔄 更新</button>
      </div>

      {histories.length === 0 ? (
        <div style={{ textAlign:'center', padding:'4rem 2rem', color:'var(--dim2)' }}>
          <div style={{ fontSize:'3rem', marginBottom:'1rem', opacity:0.4 }}>📂</div>
          <div style={{ fontSize:'0.9rem' }}>まだ分析履歴がありません</div>
          <div style={{ fontSize:'0.78rem', marginTop:'0.5rem', color:'var(--dim)' }}>XLSXファイルをアップロードすると自動保存されます</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          {histories.map((h, i) => (
            <div key={h.id} className="card" style={{ padding:'1.25rem', display:'grid', gridTemplateColumns:'auto 1fr auto', gap:'1rem', alignItems:'center' }}>
              {/* 番号 */}
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', color:'var(--orange)', minWidth:'2rem', textAlign:'center', lineHeight:1 }}>
                {i + 1}
              </div>

              {/* メイン情報 */}
              <div>
                <div style={{ fontWeight:900, fontSize:'0.88rem', marginBottom:'0.35rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  📊 {h.filename}
                </div>
                <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'0.72rem', color:'var(--dim2)' }}>🕒 {formatDate(h.uploadedAt)}</span>
                  <span style={{ fontSize:'0.72rem', color:'var(--dim2)' }}>📦 {h.productCount}商品</span>
                  <span style={{ fontSize:'0.72rem', color:'var(--orange)', fontWeight:700 }}>₱{h.kpis?.totalSales?.toLocaleString('en', { maximumFractionDigits:0 })}</span>
                  <span style={{ fontSize:'0.72rem', color:h.kpis?.avgCtr > 3 ? 'var(--green)' : 'var(--yellow)' }}>CTR {h.kpis?.avgCtr?.toFixed(2)}%</span>
                  <span style={{ fontSize:'0.72rem', color:h.kpis?.avgCvr > 5 ? 'var(--green)' : h.kpis?.avgCvr < 3 ? 'var(--red)' : 'var(--yellow)' }}>CVR {h.kpis?.avgCvr?.toFixed(2)}%</span>
                  <span style={{ fontSize:'0.72rem', color:h.kpis?.urgentCount > 0 ? 'var(--red)' : 'var(--dim2)' }}>🔴 緊急 {h.kpis?.urgentCount}件</span>
                </div>
              </div>

              {/* ボタン */}
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button
                  onClick={() => deleteHistory(h.id)}
                  style={{ padding:'0.4rem 0.75rem', borderRadius:8, border:'1px solid var(--rim)', background:'transparent', color:'var(--dim)', fontSize:'0.72rem', cursor:'pointer', fontFamily:"'Zen Kaku Gothic New',sans-serif" }}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
