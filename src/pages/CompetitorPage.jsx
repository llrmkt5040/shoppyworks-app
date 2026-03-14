import { useState, useEffect } from "react"

const ANALYZE_API = "https://asia-northeast1-shoppyworks-bootcamp.cloudfunctions.net/analyzeCompetitor"

const inp = { width:"100%", padding:"0.5rem 0.7rem", borderRadius:8, border:"1px solid var(--rim)", background:"var(--surface)", color:"var(--text)", fontSize:"0.85rem", boxSizing:"border-box" }
const lbl = { fontSize:"0.62rem", fontWeight:700, color:"var(--dim2)", display:"block", marginBottom:"0.25rem" }

const emptyShop = {
  shopName:"", shopUrl:"", myShopUrl:"",
  rating:"", followers:"", productCount:"",
  priceMin:"", priceMax:"",
  monthlySold:"", reviewCount:"",
  responseRate:"", responseTime:"",
  memo:""
}

export default function CompetitorPage({ uid }) {
  const [tab, setTab] = useState("register") // register | history
  const [form, setForm] = useState({ ...emptyShop })
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [histories, setHistories] = useState([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (uid) loadHistories() }, [uid])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function loadHistories() {
    try {
      const { db } = await import("../lib/firebase")
      const { collection, query, where, getDocs } = await import("firebase/firestore")
      const snap = await getDocs(query(collection(db, "competitor_analyses"), where("uid", "==", uid)))
      setHistories(snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => (b.createdAt||"").localeCompare(a.createdAt||"")))
    } catch(e) { console.error(e) }
  }

  async function analyze() {
    if (!form.shopName) return setError("ショップ名は必須です")
    setError("")
    setAnalyzing(true)
    setResult(null)
    try {
      const shopData = `
【ショップ名】: ${form.shopName}
【URL】: ${form.shopUrl || "未入力"}
【評価スコア】: ${form.rating || "不明"}
【フォロワー数】: ${form.followers || "不明"}
【商品点数】: ${form.productCount || "不明"}
【価格帯】: ₱${form.priceMin || "?"} 〜 ₱${form.priceMax || "?"}
【主要商品の月間sold数】: ${form.monthlySold || "不明"}
【代表商品のレビュー数】: ${form.reviewCount || "不明"}
【応答率・応答時間】: ${form.responseRate || "不明"} / ${form.responseTime || "不明"}
【メモ・特記事項】: ${form.memo || "なし"}
      `.trim()
      const myShopContext = form.myShopUrl ? `\n【自社ショップURL】: ${form.myShopUrl}` : ""

      const res = await fetch(ANALYZE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: [form.shopUrl || form.shopName],
          myShopUrl: form.myShopUrl,
          mode: "single",
          shopData,
          myShopContext
        })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "分析失敗")

      const analysisResult = {
        uid, mode:"single",
        shopData: form,
        analysis: data.analysis,
        createdAt: new Date().toISOString(),
      }

      const { db } = await import("../lib/firebase")
      const { collection, addDoc } = await import("firebase/firestore")
      const docRef = await addDoc(collection(db, "competitor_analyses"), analysisResult)
      setResult({ id:docRef.id, ...analysisResult })
      loadHistories()
    } catch(e) { setError("分析エラー: " + e.message) }
    setAnalyzing(false)
  }

  const tabStyle = (t) => ({
    padding:"0.5rem 1.2rem", border:"none", background:"transparent", cursor:"pointer",
    fontSize:"0.82rem", fontWeight:tab===t?700:400,
    color:tab===t?"var(--orange)":"var(--dim2)",
    borderBottom:tab===t?"2px solid var(--orange)":"2px solid transparent",
    marginBottom:"-1px"
  })

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div>
          <div style={{ fontWeight:800, fontSize:"1.1rem" }}>🔍 CompetitorWatch</div>
          <div style={{ fontSize:"0.72rem", color:"var(--dim2)" }}>競合セラー分析</div>
        </div>
      </div>

      {/* タブ */}
      <div style={{ display:"flex", gap:4, borderBottom:"1px solid var(--rim)", marginBottom:"1rem" }}>
        <button style={tabStyle("register")} onClick={() => setTab("register")}>📝 競合登録・分析</button>
        <button style={tabStyle("history")} onClick={() => { setTab("history"); loadHistories() }}>📋 分析履歴 ({histories.length})</button>
      </div>

      {/* 競合登録・分析タブ */}
      {tab === "register" && (
        <div>
          <div className="card" style={{ padding:"1.5rem", marginBottom:"1rem" }}>
            <div style={{ fontWeight:700, fontSize:"0.9rem", marginBottom:"1.25rem" }}>🏪 競合ショップ情報を入力</div>

            {/* 基本情報 */}
            <div style={{ fontSize:"0.68rem", fontWeight:700, color:"var(--dim2)", marginBottom:"0.6rem", textTransform:"uppercase", borderBottom:"1px solid var(--rim)", paddingBottom:"0.3rem" }}>基本情報</div>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 3fr", gap:"0.75rem", marginBottom:"1rem" }}>
              <div>
                <label style={lbl}>ショップ名 *</label>
                <input value={form.shopName} onChange={e=>set("shopName",e.target.value)} placeholder="例: Daiso Japan PH" style={inp} />
              </div>
              <div>
                <label style={lbl}>ショップURL</label>
                <input value={form.shopUrl} onChange={e=>set("shopUrl",e.target.value)} placeholder="https://shopee.ph/..." style={inp} />
              </div>
            </div>
            <div style={{ marginBottom:"1rem" }}>
              <label style={lbl}>自社ショップURL（任意・比較提案に使用）</label>
              <input value={form.myShopUrl} onChange={e=>set("myShopUrl",e.target.value)} placeholder="https://shopee.ph/yourshop" style={inp} />
            </div>

            {/* ショップ指標 */}
            <div style={{ fontSize:"0.68rem", fontWeight:700, color:"var(--dim2)", marginBottom:"0.6rem", textTransform:"uppercase", borderBottom:"1px solid var(--rim)", paddingBottom:"0.3rem" }}>ショップ指標</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"0.75rem", marginBottom:"1rem" }}>
              <div>
                <label style={lbl}>評価スコア</label>
                <input value={form.rating} onChange={e=>set("rating",e.target.value)} placeholder="例: 4.8" style={inp} />
              </div>
              <div>
                <label style={lbl}>フォロワー数</label>
                <input value={form.followers} onChange={e=>set("followers",e.target.value)} placeholder="例: 12.5k" style={inp} />
              </div>
              <div>
                <label style={lbl}>商品点数</label>
                <input value={form.productCount} onChange={e=>set("productCount",e.target.value)} placeholder="例: 250" style={inp} />
              </div>
              <div>
                <label style={lbl}>応答率</label>
                <input value={form.responseRate} onChange={e=>set("responseRate",e.target.value)} placeholder="例: 98%" style={inp} />
              </div>
            </div>

            {/* 販売データ */}
            <div style={{ fontSize:"0.68rem", fontWeight:700, color:"var(--dim2)", marginBottom:"0.6rem", textTransform:"uppercase", borderBottom:"1px solid var(--rim)", paddingBottom:"0.3rem" }}>販売データ</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:"0.75rem", marginBottom:"1rem" }}>
              <div>
                <label style={lbl}>最安値 (₱)</label>
                <input type="number" value={form.priceMin} onChange={e=>set("priceMin",e.target.value)} placeholder="50" style={inp} />
              </div>
              <div>
                <label style={lbl}>最高値 (₱)</label>
                <input type="number" value={form.priceMax} onChange={e=>set("priceMax",e.target.value)} placeholder="2000" style={inp} />
              </div>
              <div>
                <label style={lbl}>月間sold数</label>
                <input value={form.monthlySold} onChange={e=>set("monthlySold",e.target.value)} placeholder="例: 500" style={inp} />
              </div>
              <div>
                <label style={lbl}>レビュー数</label>
                <input value={form.reviewCount} onChange={e=>set("reviewCount",e.target.value)} placeholder="例: 1.2k" style={inp} />
              </div>
              <div>
                <label style={lbl}>応答時間</label>
                <input value={form.responseTime} onChange={e=>set("responseTime",e.target.value)} placeholder="例: 数時間以内" style={inp} />
              </div>
            </div>

            {/* メモ */}
            <div style={{ marginBottom:"1.25rem" }}>
              <label style={lbl}>メモ・特記事項（気になった点・戦略など）</label>
              <textarea value={form.memo} onChange={e=>set("memo",e.target.value)}
                placeholder="例: DAISOブランドを前面に出した戦略、梱包が丁寧、セット売りが多い..."
                style={{ ...inp, minHeight:80, resize:"vertical", lineHeight:1.6 }} />
            </div>

            {error && <div style={{ color:"#ef4444", fontSize:"0.78rem", marginBottom:"0.75rem" }}>⚠️ {error}</div>}

            <div style={{ display:"flex", gap:"0.5rem" }}>
              <button onClick={analyze} disabled={analyzing}
                style={{ padding:"0.6rem 2rem", borderRadius:8, border:"none", background:analyzing?"var(--rim)":"var(--orange)", color:analyzing?"var(--dim2)":"#fff", fontSize:"0.85rem", fontWeight:700, cursor:analyzing?"not-allowed":"pointer" }}>
                {analyzing ? "🤖 AI分析中（30〜60秒）..." : "🔍 AI分析する"}
              </button>
              <button onClick={() => { setForm({...emptyShop}); setResult(null); setError("") }}
                style={{ padding:"0.6rem 1rem", borderRadius:8, border:"1px solid var(--rim)", background:"transparent", color:"var(--dim2)", fontSize:"0.85rem", cursor:"pointer" }}>
                リセット
              </button>
            </div>
          </div>

          {/* 分析結果 */}
          {result && <AnalysisResult result={result} />}
        </div>
      )}

      {/* 履歴タブ */}
      {tab === "history" && (
        <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
          {histories.length === 0 ? (
            <div className="card" style={{ padding:"2rem", textAlign:"center", color:"var(--dim2)" }}>まだ分析履歴がありません</div>
          ) : histories.map(h => (
            <div key={h.id} className="card" style={{ padding:"1rem 1.25rem", cursor:"pointer" }}
              onClick={() => { setTab("register"); setResult(h); setForm(h.shopData || emptyShop) }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}
              onMouseLeave={e=>e.currentTarget.style.background=""}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:"0.88rem" }}>
                    🏪 {h.shopData?.shopName || h.analysis?.shopName || "不明"}
                  </div>
                  <div style={{ fontSize:"0.68rem", color:"var(--dim2)", marginTop:3, display:"flex", gap:"0.75rem" }}>
                    {h.shopData?.rating && <span>⭐ {h.shopData.rating}</span>}
                    {h.shopData?.productCount && <span>📦 {h.shopData.productCount}点</span>}
                    {h.shopData?.monthlySold && <span>📈 {h.shopData.monthlySold} sold/月</span>}
                    {h.shopData?.priceMin && <span>💰 ₱{h.shopData.priceMin}〜{h.shopData.priceMax}</span>}
                  </div>
                </div>
                <div style={{ fontSize:"0.65rem", color:"var(--dim2)", whiteSpace:"nowrap" }}>
                  {h.createdAt?.slice(0,10)}
                </div>
              </div>
              {h.analysis?.summary && (
                <div style={{ fontSize:"0.75rem", color:"var(--dim2)", marginTop:"0.5rem", lineHeight:1.6 }}>
                  {h.analysis.summary?.slice(0, 100)}...
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AnalysisResult({ result }) {
  const a = result.analysis || {}
  const s = result.shopData || {}
  const ITEMS = [
    { key:"pricing", label:"価格帯・値付け戦略", icon:"💰" },
    { key:"lineup", label:"商品ラインナップ・カテゴリ構成", icon:"📦" },
    { key:"seo", label:"タイトル・SEOキーワード", icon:"🔍" },
    { key:"reviews", label:"レビュー・評価の傾向", icon:"⭐" },
    { key:"swot", label:"強み・弱み・差別化ポイント", icon:"📊" },
    { key:"suggestions", label:"自社への改善提案", icon:"💡" },
    { key:"monthlySales", label:"月間販売数・売上推測", icon:"📈" },
    { key:"revenueEstimate", label:"月間売上予測", icon:"💴" },
  ]
  return (
    <div>
      <div style={{ fontSize:"0.65rem", color:"var(--dim2)", marginBottom:"0.5rem" }}>
        分析日時: {result.createdAt?.slice(0,16).replace("T"," ")}
      </div>

      {/* 入力データサマリー */}
      <div className="card" style={{ padding:"1rem 1.25rem", marginBottom:"0.75rem", border:"1px solid var(--rim)" }}>
        <div style={{ fontSize:"0.65rem", fontWeight:700, color:"var(--dim2)", marginBottom:"0.6rem", textTransform:"uppercase" }}>📋 入力データ</div>
        <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap" }}>
          {[
            s.rating && { label:"評価", value:s.rating+"★" },
            s.followers && { label:"フォロワー", value:s.followers },
            s.productCount && { label:"商品数", value:s.productCount+"点" },
            s.priceMin && { label:"価格帯", value:`₱${s.priceMin}〜${s.priceMax}` },
            s.monthlySold && { label:"月間sold", value:s.monthlySold },
            s.reviewCount && { label:"レビュー数", value:s.reviewCount },
            s.responseRate && { label:"応答率", value:s.responseRate },
            s.responseTime && { label:"応答時間", value:s.responseTime },
          ].filter(Boolean).map((item,i) => (
            <div key={i} style={{ padding:"0.35rem 0.75rem", background:"rgba(255,255,255,0.04)", borderRadius:8, border:"1px solid var(--rim)" }}>
              <div style={{ fontSize:"0.58rem", color:"var(--dim2)" }}>{item.label}</div>
              <div style={{ fontSize:"0.82rem", fontWeight:700 }}>{item.value}</div>
            </div>
          ))}
        </div>
        {s.memo && <div style={{ marginTop:"0.6rem", fontSize:"0.75rem", color:"var(--dim2)", lineHeight:1.6 }}>📝 {s.memo}</div>}
      </div>

      {/* 総合評価 */}
      {a.summary && (
        <div className="card" style={{ padding:"1rem 1.25rem", marginBottom:"0.75rem", border:"1px solid rgba(249,115,22,0.3)", background:"rgba(249,115,22,0.06)" }}>
          <div style={{ fontSize:"0.65rem", fontWeight:700, color:"var(--orange)", marginBottom:"0.4rem", textTransform:"uppercase" }}>📋 総合評価</div>
          <div style={{ fontWeight:700, color:"var(--orange)", marginBottom:"0.3rem" }}>{a.shopName || s.shopName}</div>
          <div style={{ fontSize:"0.85rem", lineHeight:1.7 }}>{a.summary}</div>
        </div>
      )}

      {/* 分析6項目 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
        {ITEMS.filter(item => a[item.key]).map(item => (
          <div key={item.key} className="card" style={{ padding:"1rem 1.1rem" }}>
            <div style={{ fontSize:"0.68rem", fontWeight:700, color:"var(--dim2)", marginBottom:"0.5rem", textTransform:"uppercase" }}>
              {item.icon} {item.label}
            </div>
            <div style={{ fontSize:"0.8rem", lineHeight:1.7 }}>{a[item.key]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
