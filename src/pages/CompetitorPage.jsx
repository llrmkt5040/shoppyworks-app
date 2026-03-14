import { useState, useEffect } from "react"

const ANALYSIS_ITEMS = [
  { key: "pricing", label: "価格帯・値付け戦略", icon: "💰" },
  { key: "lineup", label: "商品ラインナップ・カテゴリ構成", icon: "📦" },
  { key: "seo", label: "タイトル・SEOキーワード", icon: "🔍" },
  { key: "reviews", label: "レビュー・評価の傾向", icon: "⭐" },
  { key: "swot", label: "強み・弱み・差別化ポイント", icon: "📊" },
  { key: "suggestions", label: "自社への改善提案", icon: "💡" },
]

export default function CompetitorPage({ uid }) {
  const [mode, setMode] = useState("single") // single | compare
  const [urls, setUrls] = useState([""])
  const [myShopUrl, setMyShopUrl] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [histories, setHistories] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => { if (uid) loadHistories() }, [uid])

  async function loadHistories() {
    try {
      const { db } = await import("../lib/firebase")
      const { collection, query, where, orderBy, getDocs, limit } = await import("firebase/firestore")
      const snap = await getDocs(query(
        collection(db, "competitor_analyses"),
        where("uid", "==", uid),
        limit(20)
      ))
      setHistories(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt||"").localeCompare(a.createdAt||"")))
    } catch(e) { console.error(e) }
  }

  async function analyze() {
    const validUrls = urls.filter(u => u.trim())
    if (validUrls.length === 0) return setError("URLを入力してください")
    if (mode === "compare" && validUrls.length < 2) return setError("比較モードは2件以上のURLが必要です")
    setError("")
    setAnalyzing(true)
    setResult(null)
    try {
      const res = await fetch("https://asia-northeast1-shoppyworks-bootcamp.cloudfunctions.net/analyzeCompetitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: validUrls, myShopUrl, mode })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "分析失敗")
      const analysisResult = {
        uid, mode, urls: validUrls, myShopUrl,
        analysis: data.analysis,
        createdAt: new Date().toISOString(),
      }
      const { db } = await import("../lib/firebase")
      const { collection, addDoc } = await import("firebase/firestore")
      const docRef = await addDoc(collection(db, "competitor_analyses"), analysisResult)
      setResult({ id: docRef.id, ...analysisResult })
      loadHistories()
    } catch(e) {
      setError("分析エラー: " + e.message)
    }
    setAnalyzing(false)
  }

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div>
          <div style={{ fontWeight:800, fontSize:"1.1rem" }}>🔍 CompetitorWatch</div>
          <div style={{ fontSize:"0.72rem", color:"var(--dim2)" }}>競合セラー分析</div>
        </div>
        <button onClick={() => setShowHistory(!showHistory)}
          style={{ padding:"0.4rem 1rem", borderRadius:8, border:"1px solid var(--rim)", background:showHistory?"var(--orange)":"transparent", color:showHistory?"#fff":"var(--dim2)", fontSize:"0.78rem", cursor:"pointer" }}>
          📋 履歴 ({histories.length})
        </button>
      </div>

      {/* 履歴パネル */}
      {showHistory && (
        <div className="card" style={{ padding:"1rem", marginBottom:"1rem" }}>
          <div style={{ fontWeight:700, fontSize:"0.85rem", marginBottom:"0.75rem" }}>📋 分析履歴</div>
          {histories.length === 0 ? (
            <div style={{ color:"var(--dim2)", fontSize:"0.78rem" }}>まだ分析履歴がありません</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem", maxHeight:300, overflowY:"auto" }}>
              {histories.map(h => (
                <div key={h.id} onClick={() => { setResult(h); setShowHistory(false) }}
                  style={{ padding:"0.6rem 0.85rem", borderRadius:8, border:"1px solid var(--rim)", cursor:"pointer", background:"rgba(255,255,255,0.02)" }}
                  onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.05)"}
                  onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.02)"}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:"0.78rem", fontWeight:600 }}>
                        {h.mode === "compare" ? "🔀 比較分析" : "🔍 単独分析"}
                        {h.analysis?.shopName && ` — ${h.analysis.shopName}`}
                        {h.analysis?.shopNames && ` — ${h.analysis.shopNames}`}
                      </div>
                      <div style={{ fontSize:"0.65rem", color:"var(--dim2)", marginTop:2 }}>
                        {h.urls?.join(", ")?.slice(0, 60)}...
                      </div>
                    </div>
                    <div style={{ fontSize:"0.65rem", color:"var(--dim2)", whiteSpace:"nowrap", marginLeft:8 }}>
                      {h.createdAt?.slice(0, 10)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 入力フォーム */}
      <div className="card" style={{ padding:"1.25rem", marginBottom:"1rem" }}>
        {/* モード切替 */}
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1rem" }}>
          {[{ key:"single", label:"🔍 単独分析" }, { key:"compare", label:"🔀 複数比較" }].map(m => (
            <button key={m.key} onClick={() => { setMode(m.key); setUrls(m.key==="single"?[""]:["",""]); setResult(null) }}
              style={{ padding:"0.45rem 1rem", borderRadius:8, border:"none", background:mode===m.key?"var(--orange)":"var(--surface)", color:mode===m.key?"#fff":"var(--dim2)", fontSize:"0.78rem", fontWeight:mode===m.key?700:400, cursor:"pointer" }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* 自社ショップURL */}
        <div style={{ marginBottom:"0.75rem" }}>
          <label style={{ fontSize:"0.62rem", fontWeight:700, color:"var(--dim2)", display:"block", marginBottom:"0.25rem" }}>自社ショップURL（任意・比較提案に使用）</label>
          <input value={myShopUrl} onChange={e => setMyShopUrl(e.target.value)}
            placeholder="https://shopee.ph/yourshop"
            style={{ width:"100%", padding:"0.5rem 0.7rem", borderRadius:8, border:"1px solid var(--rim)", background:"var(--surface)", color:"var(--text)", fontSize:"0.85rem", boxSizing:"border-box" }} />
        </div>

        {/* 競合URL入力 */}
        <div style={{ marginBottom:"0.75rem" }}>
          <label style={{ fontSize:"0.62rem", fontWeight:700, color:"var(--dim2)", display:"block", marginBottom:"0.25rem" }}>
            競合ショップURL {mode === "compare" && "（2件以上）"}
          </label>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
            {urls.map((url, i) => (
              <div key={i} style={{ display:"flex", gap:"0.5rem" }}>
                <input value={url} onChange={e => { const n=[...urls]; n[i]=e.target.value; setUrls(n) }}
                  placeholder={`https://shopee.ph/competitor${i+1}`}
                  style={{ flex:1, padding:"0.5rem 0.7rem", borderRadius:8, border:"1px solid var(--rim)", background:"var(--surface)", color:"var(--text)", fontSize:"0.85rem", boxSizing:"border-box" }} />
                {urls.length > 1 && (
                  <button onClick={() => setUrls(urls.filter((_,j)=>j!==i))}
                    style={{ padding:"0.5rem 0.75rem", borderRadius:8, border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.08)", color:"#ef4444", fontSize:"0.78rem", cursor:"pointer" }}>✕</button>
                )}
              </div>
            ))}
            {mode === "compare" && urls.length < 5 && (
              <button onClick={() => setUrls([...urls, ""])}
                style={{ padding:"0.4rem", borderRadius:8, border:"1px dashed var(--rim)", background:"transparent", color:"var(--dim2)", fontSize:"0.78rem", cursor:"pointer" }}>
                ＋ URLを追加
              </button>
            )}
          </div>
        </div>

        {error && <div style={{ color:"#ef4444", fontSize:"0.78rem", marginBottom:"0.75rem" }}>⚠️ {error}</div>}

        <button onClick={analyze} disabled={analyzing}
          style={{ padding:"0.6rem 2rem", borderRadius:8, border:"none", background:analyzing?"var(--rim)":"var(--orange)", color:analyzing?"var(--dim2)":"#fff", fontSize:"0.85rem", fontWeight:700, cursor:analyzing?"not-allowed":"pointer" }}>
          {analyzing ? "🤖 AI分析中..." : "🔍 分析する"}
        </button>
      </div>

      {/* 分析結果 */}
      {result && (
        <div>
          <div style={{ fontSize:"0.65rem", color:"var(--dim2)", marginBottom:"0.5rem" }}>
            {result.mode === "compare" ? "🔀 比較分析" : "🔍 単独分析"} — {result.createdAt?.slice(0,16).replace("T"," ")}
          </div>

          {/* サマリー */}
          {result.analysis?.summary && (
            <div className="card" style={{ padding:"1rem 1.25rem", marginBottom:"0.75rem", border:"1px solid rgba(249,115,22,0.3)", background:"rgba(249,115,22,0.06)" }}>
              <div style={{ fontSize:"0.65rem", fontWeight:700, color:"var(--orange)", marginBottom:"0.4rem", textTransform:"uppercase" }}>📋 総合評価</div>
              <div style={{ fontSize:"0.85rem", lineHeight:1.7 }}>
                {result.analysis.shopName && <span style={{ fontWeight:700, color:"var(--orange)", marginRight:8 }}>{result.analysis.shopName}</span>}
                {result.analysis.shopNames && <span style={{ fontWeight:700, color:"var(--orange)", marginRight:8 }}>{result.analysis.shopNames}</span>}
                {result.analysis.summary}
              </div>
            </div>
          )}

          {/* 6項目 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
            {ANALYSIS_ITEMS.map(item => (
              result.analysis?.[item.key] && (
                <div key={item.key} className="card" style={{ padding:"1rem 1.1rem" }}>
                  <div style={{ fontSize:"0.68rem", fontWeight:700, color:"var(--dim2)", marginBottom:"0.5rem", textTransform:"uppercase" }}>
                    {item.icon} {item.label}
                  </div>
                  <div style={{ fontSize:"0.8rem", lineHeight:1.7, color:"var(--text)" }}>
                    {result.analysis[item.key]}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
