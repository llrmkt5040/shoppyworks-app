import { useState, useEffect } from "react"
import { db, auth } from "../lib/firebase"
import { collection, addDoc, query, where, orderBy, getDocs, setDoc, getDoc, doc, deleteDoc, updateDoc } from "firebase/firestore"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

function Field({ label, icon, value, onChange, readOnly, note }) {
  return (
    <div>
      <label style={{fontSize:"0.68rem",fontWeight:700,color:"var(--dim2)",textTransform:"uppercase",display:"block",marginBottom:"0.25rem"}}>{icon} {label}</label>
      <input type="number" value={value} onChange={onChange} readOnly={readOnly} placeholder="0"
        style={{display:"block",width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:readOnly?"rgba(255,255,255,0.03)":"var(--surface)",color:readOnly?"var(--orange)":"var(--text)",fontSize:"0.9rem",boxSizing:"border-box",fontWeight:readOnly?700:400}} />
      {note && <div style={{fontSize:"0.65rem",color:"var(--dim)",marginTop:"0.2rem"}}>{note}</div>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card" style={{padding:"1.25rem",marginBottom:"1rem"}}>
      <div style={{fontSize:"0.7rem",fontWeight:700,color:"var(--orange)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"1rem"}}>{title}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:"0.75rem"}}>{children}</div>
    </div>
  )
}

// ── グラフ設定 ──
const GRAPH_ITEMS = [
  { key: "売上PHP",    label: "売上 (PHP)",    color: "var(--orange)", unit: "₱" },
  { key: "出品数",     label: "出品数",         color: "var(--green)",  unit: "点" },
  { key: "注文数",     label: "注文数",         color: "#60a5fa",       unit: "件" },
  { key: "OCR",       label: "OCR (%)",        color: "#f59e0b",       unit: "%" },
  { key: "CVR",       label: "CVR (%)",        color: "#a78bfa",       unit: "%" },
  { key: "フォロワー", label: "フォロワー",      color: "#f472b6",       unit: "人" },
  { key: "粗利円",     label: "粗利 (円)",      color: "#34d399",       unit: "¥" },
]

function GraphTab({ chartData }) {
  const [visibleGraphs, setVisibleGraphs] = useState(
    Object.fromEntries(GRAPH_ITEMS.map(g => [g.key, ["売上PHP","出品数","注文数"].includes(g.key)]))
  )

  function toggleGraph(key) {
    setVisibleGraphs(v => ({ ...v, [key]: !v[key] }))
  }

  const activeItems = GRAPH_ITEMS.filter(g => visibleGraphs[g.key])

  if (chartData.length < 2) {
    return <div className="card" style={{padding:"2rem",textAlign:"center",color:"var(--dim2)"}}>グラフには2日以上のデータが必要です</div>
  }

  return (
    <div>
      {/* 表示切替 */}
      <div className="card" style={{padding:"1rem 1.25rem",marginBottom:"1rem"}}>
        <div style={{fontSize:"0.68rem",fontWeight:700,color:"var(--dim2)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.75rem"}}>表示項目</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:"0.5rem"}}>
          {GRAPH_ITEMS.map(g => (
            <button key={g.key} onClick={() => toggleGraph(g.key)}
              style={{
                padding:"0.3rem 0.75rem",borderRadius:20,
                border:`1px solid ${visibleGraphs[g.key] ? g.color : "var(--rim)"}`,
                background: visibleGraphs[g.key] ? `${g.color}22` : "transparent",
                color: visibleGraphs[g.key] ? g.color : "var(--dim2)",
                fontSize:"0.72rem",fontWeight:700,cursor:"pointer",transition:"all 0.15s"
              }}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* 個別グラフ */}
      <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
        {activeItems.length === 0 && (
          <div className="card" style={{padding:"2rem",textAlign:"center",color:"var(--dim2)"}}>表示項目を選択してください</div>
        )}
        {activeItems.map(g => (
          <div key={g.key} className="card" style={{padding:"1.25rem"}}>
            <div style={{fontSize:"0.65rem",color:"var(--dim2)",fontWeight:700,marginBottom:"1rem"}}>{g.label}推移</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{fill:"#6b7280",fontSize:10}} />
                <YAxis tick={{fill:"#6b7280",fontSize:10}} />
                <Tooltip
                  contentStyle={{background:"var(--card)",border:"1px solid var(--rim2)",borderRadius:8}}
                  formatter={(v) => [`${Number(v).toLocaleString()}${g.unit}`, g.label]}
                />
                <Line type="monotone" dataKey={g.key} stroke={g.color} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ActionLogPage({ uid: propUid }) {
  const [tab, setTab] = useState("import")
  const [logs, setLogs] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [rateLoading, setRateLoading] = useState(false)
  const [editId, setEditId] = useState(null)
  const [prevListings, setPrevListings] = useState(null)
  const [form, setForm] = useState({
    date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
    rate_php_jpy: "", listings: "", improved_pages: "",
    sales_php: "", sales_rebate_php: "", orders: "",
    cancelled: "", cancelled_sales: "", returned: "", sales_deposit_usd: "",
    visitors: "", clicks: "", spo: "", ocr: "", cv: "",
    followers: "", follow_prize: "", usage: "", rating_stars: "", rating: "",
    pasabuy: "", pasabuy_cv: "", inquiry: "",
    live: "",
    buy_daiso: "", buy_amazon: "", buy_mercari: "", buy_other: "",
    domestic_shipping: "", packaging_materials: "",
    voucher_new_buyer: "", voucher_repeat_buyer: "", voucher_follow_prize: "",
    usage_new_buyer: "", usage_repeat_buyer: "", memo: ""
  })

  const [shopUrlSaved, setShopUrlSaved] = useState(false)
  const [prevRate, setPrevRate] = useState(null)
  const [settings, setSettings] = useState({})

  useEffect(() => {
    fetchLogs()
    loadPrevRate()
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const snap = await getDoc(doc(db, "user_settings", propUid || auth.currentUser?.uid))
      if (snap.exists()) {
        if (snap.data().field_visibility) setSettings(snap.data().field_visibility)
        if (snap.data().shop_url) setForm(f => ({ ...f, shop_url: snap.data().shop_url }))
      }
    } catch(e) { console.error(e) }
  }

  async function saveShopUrl(url) {
    try {
      const uid = propUid || auth.currentUser?.uid
      console.log("shop_url保存中:", uid, url)
      await setDoc(doc(db, "user_settings", uid), { shop_url: url }, { merge: true })
      console.log("shop_url保存完了")
      setShopUrlSaved(true)
      setTimeout(() => setShopUrlSaved(false), 2000)
    } catch(e) { console.error("shop_url保存エラー:", e) }
  }

  function show(key) {
    return settings[key] !== false
  }

  async function loadPrevRate() {
    try {
      const snap = await getDoc(doc(db, "fx_rates", propUid || auth.currentUser?.uid))
      if (snap.exists()) {
        const data = snap.data()
        setPrevRate({ rate: data.rate_php_jpy, updatedAt: data.updatedAt })
      }
    } catch(e) { console.error(e) }
  }

  async function fetchLogs() {
    try {
      const q = query(collection(db, "action_logs"), where("uid", "==", propUid || auth.currentUser?.uid))
      const snap = await getDocs(q)
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // 日付重複除去: 同じ日付は1件のみ表示（全形式対応）
      const dateMap = {}
      data.forEach(d => {
        const date = d.date || ""
        if (!date) return
        if (!dateMap[date]) {
          dateMap[date] = d
        }
        // 既にある場合は何もしない（最初に見つかった1件を使用）
      })
      const deduped = Object.values(dateMap).sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      setLogs(deduped)
      if (deduped.length > 0) setPrevListings(Number(deduped[0].listings) || null)
    } catch(e) { console.error(e) }
  }

  async function fetchRate() {
    setRateLoading(true)
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD")
      const json = await res.json()
      const usdJpy = json?.rates?.JPY
      const usdPhp = json?.rates?.PHP
      if (usdJpy && usdPhp) {
        const rate = (1 / usdPhp) * usdJpy * 0.98
        const rateStr = rate.toFixed(4)
        setForm(f => ({ ...f, rate_php_jpy: rateStr }))
        await setDoc(doc(db, "fx_rates", propUid || auth.currentUser?.uid), {
          rate_php_jpy: rateStr, usd_jpy: usdJpy.toFixed(4), usd_php: usdPhp.toFixed(4),
          updatedAt: new Date().toISOString()
        })
      } else {
        const res2 = await fetch("https://api.frankfurter.app/latest?from=USD&to=JPY,PHP")
        const json2 = await res2.json()
        const usdJpy2 = json2?.rates?.JPY
        const usdPhp2 = json2?.rates?.PHP
        if (usdJpy2 && usdPhp2) {
          const rate2 = (1 / usdPhp2) * usdJpy2 * 0.98
          const rateStr = rate2.toFixed(4)
          setForm(f => ({ ...f, rate_php_jpy: rateStr }))
          await setDoc(doc(db, "fx_rates", propUid || auth.currentUser?.uid), {
            rate_php_jpy: rateStr, usd_jpy: usdJpy2.toFixed(4), usd_php: usdPhp2.toFixed(4),
            updatedAt: new Date().toISOString()
          })
        } else alert("レート取得失敗。手動で入力してください。")
      }
    } catch(e) { alert("レート取得失敗: " + e.message) }
    setRateLoading(false)
  }

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  const salesJpy = form.sales_php && form.rate_php_jpy
    ? Math.round(Number(form.sales_php) * Number(form.rate_php_jpy)) : ""
  const salesRebateJpy = form.sales_rebate_php && form.rate_php_jpy
    ? Math.round(Number(form.sales_rebate_php) * Number(form.rate_php_jpy)) : ""

  const listingsDiff = form.listings && prevListings !== null
    ? Number(form.listings) - prevListings : null

  async function handleSave() {
    setSaving(true)
    try {
      if (editId) {
        await updateDoc(doc(db, "action_logs", editId), {
          ...form, sales_jpy: salesJpy.toString(), sales_rebate_jpy: salesRebateJpy.toString()
        })
        setEditId(null)
      } else {
        await addDoc(collection(db, "action_logs"), {
          ...form, sales_jpy: salesJpy.toString(), sales_rebate_jpy: salesRebateJpy.toString(),
          uid: propUid || auth.currentUser?.uid, email: auth.currentUser?.email,
          createdAt: new Date().toISOString()
        })
      }
      setSaved(true); setTimeout(() => setSaved(false), 3000); fetchLogs()
    } catch(e) { alert("保存エラー: " + e.message) }
    setSaving(false)
  }

  // ── グラフデータ（全項目対応）──
  const chartData = [...logs].reverse().slice(-30).map(l => {
    const salesJpyVal = (Number(l.sales_php)||0) * (Number(l.rate_php_jpy)||0)
    const cost = (Number(l.buy_daiso)||0)+(Number(l.buy_amazon)||0)+(Number(l.buy_mercari)||0)+(Number(l.buy_other)||0)+(Number(l.domestic_shipping)||0)+(Number(l.packaging_materials)||0)
    const cvr = (Number(l.visitors)||0) > 0 ? ((Number(l.orders)||0) / (Number(l.visitors)||0) * 100) : 0
    return {
      date: l.date?.slice(5),
      売上PHP:    Number(l.sales_php)||0,
      出品数:     Number(l.listings)||0,
      注文数:     Number(l.orders)||0,
      OCR:        Number(l.ocr)||0,
      CVR:        Math.round(cvr * 10) / 10,
      フォロワー:  Number(l.followers)||0,
      粗利円:     Math.round(salesJpyVal - cost),
    }
  })

  const emptyForm = {
    date: new Date(Date.now()-86400000).toISOString().split("T")[0],
    rate_php_jpy:"", listings:"", improved_pages:"", live:"",
    sales_php:"", sales_rebate_php:"", orders:"", cancelled:"", cancelled_sales:"",
    returned:"", sales_deposit_usd:"", visitors:"", clicks:"", spo:"", ocr:"", cv:"",
    followers:"", follow_prize:"", usage:"", rating_stars:"", rating:"",
    voucher_new_buyer:"", voucher_repeat_buyer:"", voucher_follow_prize:"",
    usage_new_buyer:"", usage_repeat_buyer:"",
    pasabuy:"", pasabuy_cv:"", inquiry:"",
    buy_daiso:"", buy_amazon:"", buy_mercari:"", buy_other:"",
    domestic_shipping:"", packaging_materials:"", memo:""
  }

  return (
    <div style={{maxWidth:960,margin:"0 auto",padding:"1.5rem"}}>
      <h2 style={{fontFamily:"Bebas Neue,sans-serif",fontSize:"1.8rem",letterSpacing:"0.04em",marginBottom:"1.5rem"}}>行動ログ</h2>
      <div style={{display:"flex",marginBottom:"1.5rem",background:"var(--surface)",borderRadius:12,padding:4,border:"1px solid var(--rim)",width:"fit-content"}}>
        {[["import","📊 データ取込"],["history","履歴"],["graph","グラフ"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{padding:"0.5rem 1.2rem",borderRadius:10,border:"none",cursor:"pointer",fontSize:"0.8rem",fontWeight:700,background:tab===id?"var(--orange)":"transparent",color:tab===id?"#fff":"var(--dim2)",transition:"all 0.2s"}}>{label}</button>
        ))}
      </div>

      {tab === "import" && (
        <ImportTab uid={propUid || auth.currentUser?.uid} onImported={() => { fetchLogs() }} />
      )}
      {tab === "input" && (
        <div>
          {/* 日付 */}
          <div style={{marginBottom:"1rem"}}>
            <label style={{fontSize:"0.72rem",fontWeight:700,color:"var(--dim2)",textTransform:"uppercase"}}>日付（前日分）</label>
            <input type="date" value={form.date} onChange={e => set("date", e.target.value)}
              style={{display:"block",marginTop:"0.3rem",padding:"0.6rem 0.8rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--surface)",color:"var(--text)",fontSize:"0.9rem"}} />
          </div>

          {/* 為替レート（常時表示） */}
          <div className="card" style={{padding:"1.25rem",marginBottom:"1rem"}}>
            <div style={{fontSize:"0.7rem",fontWeight:700,color:"var(--orange)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"1rem"}}>為替レート</div>
            {prevRate && (
              <div style={{marginBottom:"0.75rem",padding:"0.5rem 0.75rem",borderRadius:8,background:"rgba(255,255,255,0.03)",border:"1px solid var(--rim)",fontSize:"0.78rem",color:"var(--dim2)"}}>
                前回保存レート: <span style={{color:"var(--orange)",fontWeight:700}}>¥{prevRate.rate}</span>
                <span style={{marginLeft:"0.75rem",fontSize:"0.68rem"}}>({prevRate.updatedAt ? new Date(prevRate.updatedAt).toLocaleString("ja-JP") : ""})</span>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"0.75rem",alignItems:"end"}}>
              <Field label="PHP → JPY レート" icon="💱" value={form.rate_php_jpy} onChange={e => set("rate_php_jpy", e.target.value)} />
              <button onClick={fetchRate} disabled={rateLoading}
                style={{padding:"0.5rem 1rem",borderRadius:8,border:"1px solid rgba(0,212,170,0.3)",background:"rgba(0,212,170,0.1)",color:"var(--ai)",fontSize:"0.75rem",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",height:38}}>
                {rateLoading ? "取得中.." : "自動取得"}
              </button>
            </div>
          </div>

          {/* 出品・改修 */}
          {(show("live") || show("listings") || show("improved_pages")) && (
            <Section title="出品・改修">
              {show("live") && <Field label="Live（出品数）" icon="🟢" value={form.live} onChange={e => set("live", e.target.value)} note="現在のShopee出品数" />}
              {show("listings") && (
                <div>
                  <label style={{fontSize:"0.68rem",fontWeight:700,color:"var(--dim2)",textTransform:"uppercase",display:"block",marginBottom:"0.25rem"}}>📦 出品点数（前日）</label>
                  <input type="number" value={form.listings} onChange={e => set("listings", e.target.value)} placeholder="0"
                    style={{display:"block",width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--surface)",color:"var(--text)",fontSize:"0.9rem",boxSizing:"border-box"}} />
                  {listingsDiff !== null && (
                    <div style={{fontSize:"0.72rem",marginTop:"0.3rem",color:listingsDiff>=0?"var(--green)":"#ef4444",fontWeight:700}}>
                      前日比: {listingsDiff >= 0 ? "+" : ""}{listingsDiff}点
                    </div>
                  )}
                </div>
              )}
              {show("improved_pages") && <Field label="改修商品ページ件数（前日）" icon="🔧" value={form.improved_pages} onChange={e => set("improved_pages", e.target.value)} />}
            </Section>
          )}

          {/* 売上・注文 */}
          {(show("sales_php")||show("sales_jpy")||show("sales_rebate_php")||show("sales_rebate_jpy")||show("orders")||show("sales_deposit_usd")) && (
            <div className="card" style={{padding:"1.25rem",marginBottom:"1rem"}}>
              <div style={{fontSize:"0.7rem",fontWeight:700,color:"var(--orange)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"1rem"}}>売上・注文</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:"0.75rem"}}>
                {show("sales_php") && <Field label="Sales (PHP) ₱" icon="💰" value={form.sales_php} onChange={e => set("sales_php", e.target.value)} />}
                {show("sales_jpy") && <Field label="Sales (円) 自動" icon="💴" value={salesJpy} onChange={() => {}} readOnly={true} />}
                {show("sales_rebate_php") && <Field label="Sales Rebate applied (PHP) ₱" icon="🏷️" value={form.sales_rebate_php} onChange={e => set("sales_rebate_php", e.target.value)} note="Shopee Rebate適用後" />}
                {show("sales_rebate_jpy") && <Field label="Sales Rebate (円) 自動" icon="💴" value={salesRebateJpy} onChange={() => {}} readOnly={true} />}
                {show("orders") && <Field label="Orders（注文数）" icon="📦" value={form.orders} onChange={e => set("orders", e.target.value)} />}
                {show("sales_deposit_usd") && <Field label="売上入金 USD" icon="🏦" value={form.sales_deposit_usd} onChange={e => set("sales_deposit_usd", e.target.value)} note="Payoniaへの入金額" />}
              </div>
            </div>
          )}

          {/* アクセス・転換率 */}
          {(show("ocr")||show("visitors")||show("clicks")||show("spo")||show("cv")) && (
            <div className="card" style={{padding:"1.25rem",marginBottom:"1rem"}}>
              <div style={{fontSize:"0.7rem",fontWeight:700,color:"var(--orange)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"1rem"}}>📊 アクセス・転換率 <span style={{fontSize:"0.6rem",color:"var(--dim2)",fontWeight:400,textTransform:"none"}}>Key Metrics</span></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:"0.75rem"}}>
                {show("ocr") && (
                  <div>
                    <label style={{fontSize:"0.68rem",fontWeight:700,color:"var(--dim2)",textTransform:"uppercase",display:"block",marginBottom:"0.25rem"}}>📊 Order Conversion Rate（OCR %）</label>
                    <input type="number" value={form.ocr} onChange={e => set("ocr", e.target.value)} placeholder="0"
                      style={{display:"block",width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--surface)",color:"var(--text)",fontSize:"0.9rem",boxSizing:"border-box"}} />
                    <div style={{fontSize:"0.65rem",color:"var(--dim)",marginTop:"0.2rem"}}>Order Conversion Rate</div>
                  </div>
                )}
                {show("visitors") && <Field label="Visitors（訪問者数）" icon="👥" value={form.visitors} onChange={e => set("visitors", e.target.value)} />}
                {show("clicks") && <Field label="Product Clicks（クリック数）" icon="🖱️" value={form.clicks} onChange={e => set("clicks", e.target.value)} />}
                {show("spo") && <Field label="Sales per Order ₱（SPO）" icon="📍" value={form.spo} onChange={e => set("spo", e.target.value)} />}
                {show("cv") && <Field label="CV（注文転換数）" icon="📈" value={form.cv} onChange={e => set("cv", e.target.value)} />}
              </div>
            </div>
          )}

          {/* キャンセル・返金 */}
          {(show("cancelled")||show("cancelled_sales")||show("returned")) && (
            <div className="card" style={{padding:"1.25rem",marginBottom:"1rem",border:"1px solid rgba(239,68,68,0.2)"}}>
              <div style={{fontSize:"0.7rem",fontWeight:700,color:"#ef4444",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"1rem"}}>キャンセル・返金</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:"0.75rem"}}>
                {show("cancelled") && <Field label="キャンセル数" icon="❌" value={form.cancelled} onChange={e => set("cancelled", e.target.value)} />}
                {show("cancelled_sales") && <Field label="キャンセル売上 (PHP)" icon="🚫" value={form.cancelled_sales} onChange={e => set("cancelled_sales", e.target.value)} />}
                {show("returned") && <Field label="返品数" icon="↩️" value={form.returned} onChange={e => set("returned", e.target.value)} />}
              </div>
            </div>
          )}

          {/* フォロー・評価 */}
          {(show("followers")||show("rating_stars")||show("rating")) && (
            <Section title="フォロー・評価">
              <div>
                <label style={{fontSize:"0.68rem",fontWeight:700,color:"var(--dim2)",textTransform:"uppercase",display:"block",marginBottom:"0.25rem"}}>🔗 ショップURL <span style={{fontSize:"0.6rem",color:"var(--green)",fontWeight:400}}>{shopUrlSaved ? "✓ 保存しました！" : form.shop_url ? "✓ 保存済み" : ""}</span></label>
                <input type="url" value={form.shop_url||""} onChange={e => set("shop_url", e.target.value)} onBlur={e => { if(e.target.value) saveShopUrl(e.target.value) }} placeholder="https://shopee.ph/your-shop"
                  style={{display:"block",width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--surface)",color:"var(--text)",fontSize:"0.9rem",boxSizing:"border-box"}} />
                {form.shop_url && <a href={form.shop_url} target="_blank" rel="noreferrer" style={{fontSize:"0.68rem",color:"var(--orange)",marginTop:"0.3rem",display:"block"}}>→ ショップを開く</a>}
              </div>
              {show("followers") && <Field label="Followers（フォロワー数）" icon="❤️" value={form.followers} onChange={e => set("followers", e.target.value)} note="Shopeeショップページの数値" />}
              {show("rating_stars") && <Field label="評価数" icon="⭐" value={form.rating_stars} onChange={e => set("rating_stars", e.target.value)} />}
              {show("rating") && <Field label="評価スコア" icon="🌟" value={form.rating} onChange={e => set("rating", e.target.value)} />}
            </Section>
          )}

          {/* Voucher（常時表示） */}
          <div className="card" style={{padding:"1.25rem",marginBottom:"1rem"}}>
            <div style={{fontSize:"0.7rem",fontWeight:700,color:"var(--orange)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"1rem"}}>🎁 Voucher</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:"0.75rem"}}>
              <div style={{gridColumn:"1/-1",fontSize:"0.65rem",fontWeight:700,color:"var(--dim2)",textTransform:"uppercase",letterSpacing:"0.08em"}}>🆕 New Buyer</div>
              <Field label="New Buyer 配布枚数" icon="🆕" value={form.voucher_new_buyer} onChange={e => set("voucher_new_buyer", e.target.value)} />
              <Field label="New Buyer 利用回数" icon="📱" value={form.usage_new_buyer} onChange={e => set("usage_new_buyer", e.target.value)} />
              <div>
                <label style={{fontSize:"0.68rem",fontWeight:700,color:"var(--dim2)",textTransform:"uppercase",display:"block",marginBottom:"0.25rem"}}>📊 New Buyer 利用率（自動）</label>
                <input type="text" readOnly value={
                  form.voucher_new_buyer && Number(form.voucher_new_buyer) > 0
                    ? (Number(form.usage_new_buyer||0) / Number(form.voucher_new_buyer) * 100).toFixed(1) + "%"
                    : "-"
                } style={{display:"block",width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"rgba(255,255,255,0.03)",color:"var(--orange)",fontSize:"0.9rem",boxSizing:"border-box",fontWeight:700}} />
              </div>
              <div style={{gridColumn:"1/-1",borderTop:"1px solid var(--rim)",paddingTop:"0.5rem",fontSize:"0.65rem",fontWeight:700,color:"var(--dim2)",textTransform:"uppercase",letterSpacing:"0.08em"}}>🔄 Repeat Buyer</div>
              <Field label="Repeat Buyer 配布枚数" icon="🔄" value={form.voucher_repeat_buyer} onChange={e => set("voucher_repeat_buyer", e.target.value)} />
              <Field label="Repeat Buyer 利用回数" icon="📱" value={form.usage_repeat_buyer} onChange={e => set("usage_repeat_buyer", e.target.value)} />
              <div>
                <label style={{fontSize:"0.68rem",fontWeight:700,color:"var(--dim2)",textTransform:"uppercase",display:"block",marginBottom:"0.25rem"}}>📊 Repeat Buyer 利用率（自動）</label>
                <input type="text" readOnly value={
                  form.voucher_repeat_buyer && Number(form.voucher_repeat_buyer) > 0
                    ? (Number(form.usage_repeat_buyer||0) / Number(form.voucher_repeat_buyer) * 100).toFixed(1) + "%"
                    : "-"
                } style={{display:"block",width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"rgba(255,255,255,0.03)",color:"var(--orange)",fontSize:"0.9rem",boxSizing:"border-box",fontWeight:700}} />
              </div>
              <div style={{gridColumn:"1/-1",borderTop:"1px solid var(--rim)",paddingTop:"0.5rem",fontSize:"0.65rem",fontWeight:700,color:"var(--dim2)",textTransform:"uppercase",letterSpacing:"0.08em"}}>🎁 Follow Prize</div>
              <Field label="FollowPrize 配布枚数" icon="🎁" value={form.follow_prize} onChange={e => set("follow_prize", e.target.value)} />
              <Field label="FollowPrize 利用回数" icon="📱" value={form.usage} onChange={e => set("usage", e.target.value)} />
              <div>
                <label style={{fontSize:"0.68rem",fontWeight:700,color:"var(--dim2)",textTransform:"uppercase",display:"block",marginBottom:"0.25rem"}}>📊 FollowPrize 利用率（自動）</label>
                <input type="text" readOnly value={
                  form.follow_prize && Number(form.follow_prize) > 0
                    ? (Number(form.usage||0) / Number(form.follow_prize) * 100).toFixed(1) + "%"
                    : "-"
                } style={{display:"block",width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"rgba(255,255,255,0.03)",color:"var(--orange)",fontSize:"0.9rem",boxSizing:"border-box",fontWeight:700}} />
              </div>
            </div>
          </div>

          {/* 仕入れ */}
          {(show("buy_daiso")||show("buy_amazon")||show("buy_mercari")||show("buy_other")) && (
            <div className="card" style={{padding:"1.25rem",marginBottom:"1rem"}}>
              <div style={{fontSize:"0.7rem",fontWeight:700,color:"var(--orange)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"1rem"}}>🛒 仕入れ</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:"0.75rem"}}>
                {show("buy_daiso") && <Field label="DAISO仕入れ (円)" icon="🏪" value={form.buy_daiso} onChange={e => set("buy_daiso", e.target.value)} />}
                {show("buy_amazon") && <Field label="Amazon仕入れ (円)" icon="📦" value={form.buy_amazon} onChange={e => set("buy_amazon", e.target.value)} />}
                {show("buy_mercari") && <Field label="メルカリ仕入れ (円)" icon="♻️" value={form.buy_mercari} onChange={e => set("buy_mercari", e.target.value)} />}
                {show("buy_other") && <Field label="その他仕入れ (円)" icon="🛒" value={form.buy_other} onChange={e => set("buy_other", e.target.value)} />}
                <div>
                  <label style={{fontSize:"0.68rem",fontWeight:700,color:"var(--dim2)",textTransform:"uppercase",display:"block",marginBottom:"0.25rem"}}>💴 仕入れ合計（自動）</label>
                  <input type="text" readOnly value={
                    (Number(form.buy_daiso||0)+Number(form.buy_amazon||0)+Number(form.buy_mercari||0)+Number(form.buy_other||0)) > 0
                      ? "¥" + (Number(form.buy_daiso||0)+Number(form.buy_amazon||0)+Number(form.buy_mercari||0)+Number(form.buy_other||0)).toLocaleString()
                      : "-"
                  } style={{display:"block",width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"rgba(255,255,255,0.03)",color:"var(--orange)",fontSize:"0.9rem",boxSizing:"border-box",fontWeight:700}} />
                  <div style={{fontSize:"0.65rem",color:"var(--dim)",marginTop:"0.2rem"}}>DAISO + Amazon + メルカリ + その他</div>
                </div>
              </div>
            </div>
          )}

          {/* 転送費用 */}
          {(show("domestic_shipping")||show("packaging_materials")) && (
            <div className="card" style={{padding:"1.25rem",marginBottom:"1rem",border:"1px solid rgba(99,102,241,0.2)"}}>
              <div style={{fontSize:"0.7rem",fontWeight:700,color:"#818cf8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"1rem"}}>🚚 転送費用</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:"0.75rem"}}>
                {show("domestic_shipping") && <Field label="国内送料 (円)" icon="🚚" value={form.domestic_shipping} onChange={e => set("domestic_shipping", e.target.value)} />}
                {show("packaging_materials") && <Field label="梱包資材 (円)" icon="📦" value={form.packaging_materials} onChange={e => set("packaging_materials", e.target.value)} />}
                <div>
                  <label style={{fontSize:"0.68rem",fontWeight:700,color:"var(--dim2)",textTransform:"uppercase",display:"block",marginBottom:"0.25rem"}}>💴 転送費用合計 (自動)</label>
                  <input type="text" readOnly value={
                    (Number(form.domestic_shipping||0) + Number(form.packaging_materials||0)) > 0
                      ? "¥" + (Number(form.domestic_shipping||0) + Number(form.packaging_materials||0)).toLocaleString()
                      : "-"
                  } style={{display:"block",width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"rgba(255,255,255,0.03)",color:"#818cf8",fontSize:"0.9rem",boxSizing:"border-box",fontWeight:700}} />
                  <div style={{fontSize:"0.65rem",color:"var(--dim)",marginTop:"0.2rem"}}>国内送料 + 梱包資材</div>
                </div>
              </div>
            </div>
          )}

          {/* メモ */}
          {show("memo") && (
            <div className="card" style={{padding:"1.25rem",marginBottom:"1rem"}}>
              <label style={{fontSize:"0.7rem",fontWeight:700,color:"var(--orange)",textTransform:"uppercase"}}>📝 メモ・気づき</label>
              <textarea value={form.memo} onChange={e => set("memo", e.target.value)} placeholder="今日の気づきや課題など..."
                style={{display:"block",width:"100%",marginTop:"0.5rem",padding:"0.6rem 0.8rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--surface)",color:"var(--text)",fontSize:"0.85rem",minHeight:80,resize:"vertical",boxSizing:"border-box"}} />
            </div>
          )}

          {editId && (
            <div style={{textAlign:"center",marginBottom:"0.5rem",fontSize:"0.78rem",color:"var(--orange)",fontWeight:700}}>
              ✏️ 編集モード中
              <button onClick={() => { setEditId(null); setForm(f => ({...emptyForm, shop_url: f.shop_url})) }}
                style={{marginLeft:"1rem",padding:"0.2rem 0.6rem",borderRadius:6,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",fontSize:"0.72rem",cursor:"pointer"}}>キャンセル</button>
            </div>
          )}
          <button onClick={handleSave} disabled={saving}
            style={{width:"100%",padding:"0.9rem",borderRadius:10,border:"none",background:saved?"var(--green)":editId?"#818cf8":"var(--orange)",color:"#fff",fontSize:"1rem",fontWeight:900,cursor:saving?"not-allowed":"pointer",transition:"all 0.3s"}}>
            {saving ? "保存中.." : saved ? "✅ 保存しました！" : editId ? "✏️ 更新する" : "保存する"}
          </button>
        </div>
      )}

      {tab === "history" && (
        <HistoryTab logs={logs} onSave={() => fetchLogs()} onDelete={async (id) => {
          if (!confirm("削除しますか？")) return
          try {
            await deleteDoc(doc(db, "action_logs", id))
            fetchLogs()
          } catch(e) { alert("削除エラー: " + e.message) }
        }} onEdit={(log) => {
          setForm({...log})
          setEditId(log.id)
          setTab("input")
          window.scrollTo(0, 0)
        }} />
      )}

      {tab === "graph" && <GraphTab chartData={chartData} />}

      {tab === "inventory" && (
        <InventoryTab uid={propUid || auth.currentUser?.uid} />
      )}
      {tab === "requests" && (
        <RequestsTab uid={propUid || auth.currentUser?.uid} />
      )}
    </div>
  )
}

function RequestsTab({ uid }) {
  const [items, setItems] = useState([])
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ date: new Date().toISOString().split("T")[0], type: "pasabuy", product: "", qty: "", price: "", cv: "", note: "" })

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    try {
      const { db } = await import("../lib/firebase")
      const { collection, query, where, orderBy, getDocs } = await import("firebase/firestore")
      const q = query(collection(db, "request_logs"), where("uid", "==", uid), orderBy("date", "desc"))
      const snap = await getDocs(q)
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch(e) { console.error(e) }
  }

  async function addItem() {
    if (!newItem.product) return
    try {
      const { db } = await import("../lib/firebase")
      const { collection, addDoc } = await import("firebase/firestore")
      await addDoc(collection(db, "request_logs"), { ...newItem, uid, createdAt: new Date().toISOString() })
      setNewItem({ date: new Date().toISOString().split("T")[0], type: "pasabuy", product: "", qty: "", price: "", cv: "", note: "" })
      setAdding(false)
      loadItems()
    } catch(e) { alert("保存エラー: " + e.message) }
  }

  async function deleteItem(id) {
    if (!confirm("削除しますか？")) return
    try {
      const { db } = await import("../lib/firebase")
      const { doc, deleteDoc } = await import("firebase/firestore")
      await deleteDoc(doc(db, "request_logs", id))
      loadItems()
    } catch(e) { alert("削除エラー: " + e.message) }
  }

  const pasabuyTotal = items.filter(i => i.type === "pasabuy").length
  const inquiryTotal = items.filter(i => i.type === "inquiry").length
  const cvTotal = items.filter(i => i.cv === "1" || i.cv === "true").length

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem",flexWrap:"wrap",gap:"0.5rem"}}>
        <div style={{display:"flex",gap:"1.5rem",fontSize:"0.82rem",color:"var(--dim2)"}}>
          <span>PASABUY: <span style={{color:"var(--orange)",fontWeight:700}}>{pasabuyTotal}件</span></span>
          <span>問合せ: <span style={{color:"var(--orange)",fontWeight:700}}>{inquiryTotal}件</span></span>
          <span>CV: <span style={{color:"var(--green)",fontWeight:700}}>{cvTotal}件</span></span>
        </div>
        <button onClick={() => setAdding(!adding)}
          style={{padding:"0.5rem 1rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontSize:"0.8rem",fontWeight:700,cursor:"pointer"}}>
          ＋ 依頼追加
        </button>
      </div>
      {adding && (
        <div className="card" style={{padding:"1.25rem",marginBottom:"1rem",border:"1px solid rgba(251,146,60,0.3)"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:"0.75rem",marginBottom:"0.75rem"}}>
            <div>
              <label style={{fontSize:"0.68rem",fontWeight:700,color:"var(--dim2)",display:"block",marginBottom:"0.25rem"}}>📅 日付</label>
              <input type="date" value={newItem.date} onChange={e => setNewItem(n => ({...n, date: e.target.value}))}
                style={{display:"block",width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--surface)",color:"var(--text)",fontSize:"0.85rem",boxSizing:"border-box"}} />
            </div>
            <div>
              <label style={{fontSize:"0.68rem",fontWeight:700,color:"var(--dim2)",display:"block",marginBottom:"0.25rem"}}>🏷️ 種別</label>
              <select value={newItem.type} onChange={e => setNewItem(n => ({...n, type: e.target.value}))}
                style={{display:"block",width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--surface)",color:"var(--text)",fontSize:"0.85rem",boxSizing:"border-box"}}>
                <option value="pasabuy">🛍️ PASABUY</option>
                <option value="inquiry">💬 問合せ</option>
              </select>
            </div>
            {[["product","商品名","📦","text"],["qty","数量","🔢","number"],["price","金額(PHP)","₱","number"],["note","メモ","📝","text"]].map(([key,label,icon,type]) => (
              <div key={key}>
                <label style={{fontSize:"0.68rem",fontWeight:700,color:"var(--dim2)",display:"block",marginBottom:"0.25rem"}}>{icon} {label}</label>
                <input type={type} value={newItem[key]} onChange={e => setNewItem(n => ({...n, [key]: e.target.value}))} placeholder={label}
                  style={{display:"block",width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--surface)",color:"var(--text)",fontSize:"0.85rem",boxSizing:"border-box"}} />
              </div>
            ))}
            <div>
              <label style={{fontSize:"0.68rem",fontWeight:700,color:"var(--dim2)",display:"block",marginBottom:"0.25rem"}}>✅ CV（成約）</label>
              <select value={newItem.cv} onChange={e => setNewItem(n => ({...n, cv: e.target.value}))}
                style={{display:"block",width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--surface)",color:"var(--text)",fontSize:"0.85rem",boxSizing:"border-box"}}>
                <option value="">未</option>
                <option value="1">✅ 成約</option>
              </select>
            </div>
          </div>
          <div style={{display:"flex",gap:"0.5rem"}}>
            <button onClick={addItem} style={{padding:"0.5rem 1.5rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:"0.85rem"}}>保存</button>
            <button onClick={() => setAdding(false)} style={{padding:"0.5rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",cursor:"pointer",fontSize:"0.85rem"}}>キャンセル</button>
          </div>
        </div>
      )}
      {items.length === 0
        ? <div className="card" style={{padding:"2rem",textAlign:"center",color:"var(--dim2)"}}>依頼記録がありません</div>
        : <div style={{display:"grid",gap:"0.5rem"}}>
            {items.map(item => (
              <div key={item.id} className="card" style={{padding:"0.9rem 1.25rem",display:"flex",alignItems:"center",gap:"1rem",flexWrap:"wrap"}}>
                <div style={{fontSize:"0.75rem",color:"var(--dim2)",minWidth:60}}>{item.date}</div>
                <div style={{padding:"0.2rem 0.6rem",borderRadius:6,background:item.type==="pasabuy"?"rgba(251,146,60,0.15)":"rgba(99,102,241,0.15)",color:item.type==="pasabuy"?"var(--orange)":"#818cf8",fontSize:"0.72rem",fontWeight:700}}>
                  {item.type === "pasabuy" ? "🛍️ PASABUY" : "💬 問合せ"}
                </div>
                <div style={{flex:1,fontWeight:700,fontSize:"0.9rem"}}>{item.product}</div>
                <div style={{display:"flex",gap:"1rem",fontSize:"0.8rem",color:"var(--dim2)"}}>
                  {item.qty && <span>数量 <span style={{color:"var(--text)"}}>{item.qty}</span></span>}
                  {item.price && <span>₱<span style={{color:"var(--text)"}}>{Number(item.price).toLocaleString()}</span></span>}
                  {item.cv === "1" && <span style={{color:"var(--green)",fontWeight:700}}>✅ 成約</span>}
                </div>
                {item.note && <div style={{fontSize:"0.72rem",color:"var(--dim2)"}}>{item.note}</div>}
                <button onClick={() => deleteItem(item.id)} style={{padding:"0.3rem 0.6rem",borderRadius:6,border:"1px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.1)",color:"#ef4444",fontSize:"0.72rem",cursor:"pointer"}}>削除</button>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

function InventoryTab({ uid }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newItem, setNewItem] = useState({ name: "", qty: "", cost: "", memo: "" })

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    setLoading(true)
    try {
      const { db } = await import("../lib/firebase")
      const { collection, query, where, orderBy, getDocs } = await import("firebase/firestore")
      const q = query(collection(db, "inventory_items"), where("uid", "==", uid), orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  async function addItem() {
    if (!newItem.name) return
    try {
      const { db } = await import("../lib/firebase")
      const { collection, addDoc } = await import("firebase/firestore")
      await addDoc(collection(db, "inventory_items"), {
        ...newItem, uid,
        qty: Number(newItem.qty)||0,
        cost: Number(newItem.cost)||0,
        createdAt: new Date().toISOString()
      })
      setNewItem({ name: "", qty: "", cost: "", memo: "" })
      setShowForm(false)
      loadItems()
    } catch(e) { alert("追加エラー: " + e.message) }
  }

  async function deleteItem(id) {
    if (!confirm("削除しますか？")) return
    try {
      const { db } = await import("../lib/firebase")
      const { doc, deleteDoc } = await import("firebase/firestore")
      await deleteDoc(doc(db, "inventory_items", id))
      loadItems()
    } catch(e) { alert("削除エラー: " + e.message) }
  }

  const totalValue = items.reduce((sum, i) => sum + (Number(i.qty)||0) * (Number(i.cost)||0), 0)

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
        <div className="card" style={{padding:"0.75rem 1.25rem",display:"inline-flex",gap:"1.5rem"}}>
          <span style={{fontSize:"0.72rem",color:"var(--dim2)"}}>商品種類 <strong style={{color:"var(--text)"}}>{items.length}</strong>点</span>
          <span style={{fontSize:"0.72rem",color:"var(--dim2)"}}>在庫総額 <strong style={{color:"var(--orange)"}}>¥{totalValue.toLocaleString()}</strong></span>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{padding:"0.5rem 1.2rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontSize:"0.8rem",fontWeight:700,cursor:"pointer"}}>
          + 追加
        </button>
      </div>
      {showForm && (
        <div className="card" style={{padding:"1.25rem",marginBottom:"1rem",border:"1px solid rgba(249,115,22,0.3)"}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"0.75rem",marginBottom:"0.75rem"}}>
            <div>
              <label style={{fontSize:"0.65rem",fontWeight:700,color:"var(--dim2)",display:"block",marginBottom:"0.25rem"}}>商品名 *</label>
              <input value={newItem.name} onChange={e => setNewItem(n=>({...n,name:e.target.value}))} placeholder="例: DAISOスマホケース"
                style={{width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--surface)",color:"var(--text)",fontSize:"0.85rem",boxSizing:"border-box"}} />
            </div>
            <div>
              <label style={{fontSize:"0.65rem",fontWeight:700,color:"var(--dim2)",display:"block",marginBottom:"0.25rem"}}>数量</label>
              <input type="number" value={newItem.qty} onChange={e => setNewItem(n=>({...n,qty:e.target.value}))} placeholder="0"
                style={{width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--surface)",color:"var(--text)",fontSize:"0.85rem",boxSizing:"border-box"}} />
            </div>
            <div>
              <label style={{fontSize:"0.65rem",fontWeight:700,color:"var(--dim2)",display:"block",marginBottom:"0.25rem"}}>仕入単価 (円)</label>
              <input type="number" value={newItem.cost} onChange={e => setNewItem(n=>({...n,cost:e.target.value}))} placeholder="0"
                style={{width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--surface)",color:"var(--text)",fontSize:"0.85rem",boxSizing:"border-box"}} />
            </div>
          </div>
          <div style={{marginBottom:"0.75rem"}}>
            <label style={{fontSize:"0.65rem",fontWeight:700,color:"var(--dim2)",display:"block",marginBottom:"0.25rem"}}>メモ</label>
            <input value={newItem.memo} onChange={e => setNewItem(n=>({...n,memo:e.target.value}))} placeholder="商品URL、備考など"
              style={{width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--surface)",color:"var(--text)",fontSize:"0.85rem",boxSizing:"border-box"}} />
          </div>
          <div style={{display:"flex",gap:"0.5rem"}}>
            <button onClick={addItem} style={{padding:"0.5rem 1.5rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontSize:"0.8rem",fontWeight:700,cursor:"pointer"}}>保存</button>
            <button onClick={() => setShowForm(false)} style={{padding:"0.5rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",fontSize:"0.8rem",cursor:"pointer"}}>キャンセル</button>
          </div>
        </div>
      )}
      {loading ? (
        <div className="card" style={{padding:"2rem",textAlign:"center",color:"var(--dim2)"}}>読み込み中...</div>
      ) : items.length === 0 ? (
        <div className="card" style={{padding:"2rem",textAlign:"center",color:"var(--dim2)"}}>在庫データがありません。「+ 追加」から登録してください。</div>
      ) : (
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.82rem"}}>
            <thead>
              <tr style={{background:"rgba(255,255,255,0.03)",borderBottom:"1px solid var(--rim)"}}>
                <th style={{padding:"0.75rem 1rem",textAlign:"left",fontWeight:700,color:"var(--dim2)",fontSize:"0.65rem",textTransform:"uppercase"}}>商品名</th>
                <th style={{padding:"0.75rem 1rem",textAlign:"right",fontWeight:700,color:"var(--dim2)",fontSize:"0.65rem",textTransform:"uppercase"}}>数量</th>
                <th style={{padding:"0.75rem 1rem",textAlign:"right",fontWeight:700,color:"var(--dim2)",fontSize:"0.65rem",textTransform:"uppercase"}}>単価</th>
                <th style={{padding:"0.75rem 1rem",textAlign:"right",fontWeight:700,color:"var(--orange)",fontSize:"0.65rem",textTransform:"uppercase"}}>在庫額</th>
                <th style={{padding:"0.75rem 1rem",textAlign:"center",fontWeight:700,color:"var(--dim2)",fontSize:"0.65rem",textTransform:"uppercase"}}>削除</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} style={{borderBottom:"1px solid var(--rim)",background:i%2===0?"transparent":"rgba(255,255,255,0.01)"}}>
                  <td style={{padding:"0.75rem 1rem"}}>
                    <div style={{fontWeight:600}}>{item.name}</div>
                    {item.memo && <div style={{fontSize:"0.68rem",color:"var(--dim2)",marginTop:"0.15rem"}}>{item.memo}</div>}
                  </td>
                  <td style={{padding:"0.75rem 1rem",textAlign:"right"}}>{Number(item.qty).toLocaleString()}</td>
                  <td style={{padding:"0.75rem 1rem",textAlign:"right"}}>¥{Number(item.cost).toLocaleString()}</td>
                  <td style={{padding:"0.75rem 1rem",textAlign:"right",fontWeight:700,color:"var(--orange)"}}>¥{(Number(item.qty)*Number(item.cost)).toLocaleString()}</td>
                  <td style={{padding:"0.75rem 1rem",textAlign:"center"}}>
                    <button onClick={() => deleteItem(item.id)} style={{padding:"0.2rem 0.6rem",borderRadius:6,border:"1px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.1)",color:"#ef4444",fontSize:"0.7rem",cursor:"pointer"}}>削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ========== データ取込タブ ==========
function ImportTab({ uid, onImported }) {
  const [files, setFiles] = useState({ business: null, voucher: null })
  const [preview, setPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(false)
  const [importCount, setImportCount] = useState(0)
  const [error, setError] = useState("")
  const [aiAdvice, setAiAdvice] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [voucherSummary, setVoucherSummary] = useState(null)

  async function parseBusinessInsights(file) {
    const XLSX = await import("xlsx")
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets["Placed Order"]
    if (!ws) throw new Error("Placed Orderシートが見つかりません")
    const rows = XLSX.utils.sheet_to_json(ws, { header:1 })
    // "Time"または"Date"のヘッダー行を探す（時間別データ優先）
    let timeHeaderIdx = rows.findIndex(r => String(r[0]||"").trim() === "Time")
    if (timeHeaderIdx < 0) timeHeaderIdx = rows.findIndex(r => String(r[0]||"").trim() === "Date")
    if (timeHeaderIdx < 0) throw new Error("時系列データが見つかりません")
    const headers = rows[timeHeaderIdx]
    // 時間別データ行（"DD/MM/YYYY HH:MM"形式）またはDate行（"DD/MM/YYYY-DD/MM/YYYY"形式）
    const dataRows = rows.slice(timeHeaderIdx + 1).filter(r => {
      if (!r[0]) return false
      const s = String(r[0]).trim()
      return s.includes("/") && s.length > 5
    })
    const getIdx = (...names) => { for (const n of names) { const i = headers.findIndex(h => String(h||"").includes(n)); if (i>=0) return i } return -1 }
    const idxMap = {
      sales: getIdx("Sales (PHP)"), rebate: getIdx("Rebate"),
      orders: getIdx("Orders"), clicks: getIdx("Product Clicks"),
      visitors: getIdx("Visitors"), cvr: getIdx("Order Conversion"),
      cancel: getIdx("Cancelled Orders"), cancelSales: getIdx("Cancelled Sales"),
      returned: getIdx("Returned"), newBuyers: getIdx("new buyers")
    }
    const dayMap = {}
    dataRows.forEach(r => {
      const timeStr = String(r[0]||"")
      const dateStr = timeStr.includes(" ") ? timeStr.split(" ")[0] : timeStr
      const parts = dateStr.split("/")
      if (parts.length !== 3) return
      const isoDate = parts[2] + "-" + parts[1].padStart(2,"0") + "-" + parts[0].padStart(2,"0")
      if (!dayMap[isoDate]) dayMap[isoDate] = { sales_php:0, sales_rebate_php:0, orders:0, clicks:0, visitors:0, cancelled:0, cancelled_sales:0, returned:0, new_buyers:0, cvr_sum:0, cvr_count:0 }
      const d = dayMap[isoDate]
      const n = (key) => Number(String(r[idxMap[key]]||"0").replace(/,/g,"")) || 0
      d.sales_php += n("sales"); d.sales_rebate_php += n("rebate")
      d.orders += n("orders"); d.clicks += n("clicks")
      d.visitors += n("visitors"); d.cancelled += n("cancel")
      d.cancelled_sales += n("cancelSales"); d.returned += n("returned")
      d.new_buyers += n("newBuyers")
      const cvrVal = parseFloat(String(r[idxMap.cvr]||"0").replace("%","")) || 0
      if (cvrVal > 0) { d.cvr_sum += cvrVal; d.cvr_count++ }
    })
    Object.values(dayMap).forEach(d => { d.cvr = d.cvr_count > 0 ? (d.cvr_sum / d.cvr_count).toFixed(2) : "0" })
    return dayMap
  }

  async function parseVoucher(file) {
    const XLSX = await import("xlsx")
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets["Metric Trends"]
    if (!ws) throw new Error("Metric Trendsシートが見つかりません")
    const rows = XLSX.utils.sheet_to_json(ws, { header:1 })
    const headerIdx = rows.findIndex(r => r[0] === "Time Period")
    if (headerIdx < 0) throw new Error("Time Period列が見つかりません")
    const headers = rows[headerIdx]
    const dataRows = rows.slice(headerIdx + 1).filter(r => r[0])
    const costIdx = headers.findIndex(h => String(h||"").includes("Cost (Confirmed"))
    const claimsIdx = headers.findIndex(h => String(h||"") === "Claims")
    const dayMap = {}
    dataRows.forEach(r => {
      const parts = String(r[0]||"").split("/")
      if (parts.length !== 3) return
      const isoDate = parts[2] + "-" + parts[1].padStart(2,"0") + "-" + parts[0].padStart(2,"0")
      dayMap[isoDate] = {
        voucher_cost: Number(String(r[costIdx]||"0").replace(/,/g,"")) || 0,
        voucher_claims: Number(String(r[claimsIdx]||"0").replace(/,/g,"")) || 0,
      }
    })
    const ws2 = wb.Sheets["Performance List"]
    const rows2 = ws2 ? XLSX.utils.sheet_to_json(ws2, { header:1 }) : []
    const hIdx2 = rows2.findIndex(r => r[0] === "Voucher Name")
    const summary = hIdx2 >= 0 ? rows2.slice(hIdx2+1).filter(r=>r[0]).map(r => ({
      name:r[0], code:r[1], type:r[5], claims:r[7], orders:r[9],
      sales:r[13], cost:r[15], usageRate:r[11], newFollowers:r[24]
    })) : []
    return { dayMap, summary }
  }

  async function handleFiles() {
    setError("")
    setPreview([])
    setVoucherSummary(null)
    setAiAdvice("")
    try {
      let businessData = {}
      let voucherData = { dayMap: {}, summary: [] }
      if (files.business) businessData = await parseBusinessInsights(files.business)
      if (files.voucher) { voucherData = await parseVoucher(files.voucher); setVoucherSummary(voucherData.summary) }
      const allDates = new Set([...Object.keys(businessData), ...Object.keys(voucherData.dayMap)])
      const merged = Array.from(allDates).sort().map(date => ({
        date, ...businessData[date],
        ...(voucherData.dayMap[date] || {})
      })).filter(r => r.sales_php > 0 || r.orders > 0 || r.visitors > 0 || r.voucher_cost > 0)
      setPreview(merged)
    } catch(e) { setError("解析エラー: " + e.message) }
  }

  async function importToDiary() {
    if (preview.length === 0) return
    setImporting(true)
    try {
      const { db, auth } = await import("../lib/firebase")
      const { doc, getDoc, setDoc } = await import("firebase/firestore")
      const effectiveUid = uid || auth.currentUser?.uid
      let count = 0
      for (const row of preview) {
        if (!row.date) continue
        const docId = effectiveUid + "_" + row.date
        const existing = await getDoc(doc(db, "action_logs", docId))
        const existingData = existing.exists() ? existing.data() : {}
        // 既存値がない場合のみ自動入力（手入力済みは上書きしない）
        const setIfEmpty = (key, val) => {
          if (val && !existingData[key]) merged[key] = String(val)
        }
        const merged = { ...existingData, uid: effectiveUid, date: row.date }
        setIfEmpty("sales_php", row.sales_php > 0 ? row.sales_php : null)
        setIfEmpty("sales_rebate_php", row.sales_rebate_php > 0 ? row.sales_rebate_php : null)
        setIfEmpty("orders", row.orders > 0 ? row.orders : null)
        setIfEmpty("clicks", row.clicks > 0 ? row.clicks : null)
        setIfEmpty("visitors", row.visitors > 0 ? row.visitors : null)
        setIfEmpty("cancelled", row.cancelled > 0 ? row.cancelled : null)
        setIfEmpty("cancelled_sales", row.cancelled_sales > 0 ? row.cancelled_sales : null)
        setIfEmpty("returned", row.returned > 0 ? row.returned : null)
        setIfEmpty("cv", row.cvr)
        setIfEmpty("voucher_follow_prize", row.voucher_cost > 0 ? row.voucher_cost : null)
        await setDoc(doc(db, "action_logs", docId), merged, { merge: true })
        count++
      }
      setImported(true)
      setImportCount(count)
      onImported()
    } catch(e) { alert("インポートエラー: " + e.message) }
    setImporting(false)
  }

  async function getAiAdvice() {
    if (!voucherSummary || voucherSummary.length === 0) return
    setAiLoading(true)
    try {
      const summaryText = voucherSummary.map(v =>
        `【${v.name}】種別:${v.type} クレーム:${v.claims} 注文:${v.orders} 売上:₱${v.sales} コスト:₱${v.cost} 利用率:${v.usageRate} 新規フォロワー:${v.newFollowers||"-"}`
      ).join("\n")
      const res = await fetch("https://asia-northeast1-shoppyworks-bootcamp.cloudfunctions.net/analyzeCompetitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: ["marketing_analysis"],
          myShopUrl: "",
          mode: "single",
          shopData: summaryText,
          myShopContext: "バウチャー販促戦略の分析と改善提案をお願いします。以下の観点で日本語でアドバイスしてください：\n1. 各バウチャーの費用対効果（ROI）\n2. 最も効果的だったバウチャーとその理由\n3. 改善が必要なバウチャー\n4. 次回の具体的な販促戦略提案\n5. 新規顧客獲得 vs リピーター育成のバランス\n\n分析結果をJSONではなく、読みやすい日本語のテキストで返してください。"
        })
      })
      const data = await res.json()
      const text = data.analysis?.summary || data.analysis?.suggestions || JSON.stringify(data.analysis) || "分析完了"
      setAiAdvice(text)
    } catch(e) { setAiAdvice("AIアドバイス取得エラー: " + e.message) }
    setAiLoading(false)
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
      <div className="card" style={{ padding:"1.25rem" }}>
        <div style={{ fontWeight:700, fontSize:"0.9rem", marginBottom:"0.5rem" }}>📂 Shopeeレポートをまとめてアップロード</div>
        <div style={{ fontSize:"0.72rem", color:"var(--dim2)", marginBottom:"1rem", padding:"0.75rem", background:"rgba(59,130,246,0.06)", borderRadius:8, border:"1px solid rgba(59,130,246,0.2)", lineHeight:1.8 }}>
          <strong style={{ color:"#3b82f6" }}>📥 Shopeeからダウンロードするファイル：</strong><br/>
          1. Marketing Centre → Vouchers → Export（Past 30 Days）<br/>
          2. Data Centre → Business Insights → Export（Past 30 Days）
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
          {[
            { key:"business", label:"📊 Business Insights XLSX", desc:"Visitors・Clicks・CVR・売上・注文数が自動入力されます" },
            { key:"voucher", label:"🎫 マーケティングレポート XLSX", desc:"バウチャーコスト・クレーム数 + AI販促アドバイス" },
          ].map(f => {
            const inputId = "file-upload-" + f.key
            return (
              <div key={f.key} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", border:`1.5px dashed ${files[f.key]?"rgba(34,197,94,0.5)":"var(--rim)"}`, borderRadius:10, background:files[f.key]?"rgba(34,197,94,0.05)":"transparent" }}>
                <span style={{ fontSize:20 }}>{files[f.key]?"✅":"📂"}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:"0.82rem", fontWeight:700, color:files[f.key]?"#22c55e":"var(--text)" }}>{f.label}</div>
                  <div style={{ fontSize:"0.68rem", color:"var(--dim2)", marginTop:2 }}>{files[f.key] ? files[f.key].name : f.desc}</div>
                </div>
                <input type="file" id={inputId} accept=".xlsx,.xls" style={{ display:"none" }}
                  onChange={e => { if(e.target.files[0]) setFiles(prev=>({...prev,[f.key]:e.target.files[0]})) }} />
                <button onClick={() => document.getElementById(inputId).click()}
                  style={{ padding:"0.4rem 0.8rem", borderRadius:8, border:"1px solid var(--rim)", background:"var(--surface)", color:"var(--text)", fontSize:"0.75rem", cursor:"pointer", whiteSpace:"nowrap" }}>
                  {files[f.key] ? "変更" : "選択"}
                </button>
              </div>
            )
          })}
        </div>
        {error && <div style={{ color:"#ef4444", fontSize:"0.78rem", marginTop:"0.75rem" }}>⚠️ {error}</div>}
        <button onClick={handleFiles}
          style={{ marginTop:"1rem", padding:"0.55rem 1.5rem", borderRadius:8, border:"none", background:"var(--orange)", color:"#fff", fontSize:"0.82rem", fontWeight:700, cursor:"pointer" }}>
          🔍 データを解析する
        </button>
      </div>

      {preview.length > 0 && (
        <div className="card" style={{ padding:"1.25rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem" }}>
            <div style={{ fontWeight:700, fontSize:"0.9rem" }}>📋 取込プレビュー（{preview.length}日分）</div>
            <button onClick={importToDiary} disabled={importing}
              style={{ padding:"0.5rem 1.5rem", borderRadius:8, border:"none", background:"var(--orange)", color:"#fff", fontSize:"0.82rem", fontWeight:700, cursor:importing?"not-allowed":"pointer", opacity:importing?0.7:1 }}>
              {importing ? "反映中..." : "✅ ShopeeDiaryに反映する"}
            </button>
          </div>
          {imported && (
            <div style={{ padding:"0.5rem 1rem", background:"rgba(34,197,94,0.1)", borderRadius:8, border:"1px solid rgba(34,197,94,0.3)", fontSize:"0.78rem", color:"#22c55e", fontWeight:700 }}>
              ✅ {importCount}日分のデータをShopeeDiaryに反映済み
            </div>
          )}
          <div style={{ overflowX:"auto", maxHeight:300, overflowY:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.75rem" }}>
              <thead style={{ position:"sticky", top:0, background:"var(--surface)" }}>
                <tr style={{ borderBottom:"1px solid var(--rim)" }}>
                  {["日付","売上(₱)","注文数","Visitors","Clicks","CVR","キャンセル","バウチャー費"].map(h=>(
                    <th key={h} style={{ padding:"0.4rem 0.6rem", textAlign:h==="日付"?"left":"right", color:"var(--dim2)", fontSize:"0.62rem", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r,i)=>(
                  <tr key={i} style={{ borderBottom:"1px solid var(--rim)" }}>
                    <td style={{ padding:"0.4rem 0.6rem", fontWeight:600 }}>{r.date}</td>
                    <td style={{ padding:"0.4rem 0.6rem", textAlign:"right", color:"var(--orange)" }}>{r.sales_php>0?`₱${r.sales_php.toLocaleString()}`:"-"}</td>
                    <td style={{ padding:"0.4rem 0.6rem", textAlign:"right" }}>{r.orders>0?r.orders:"-"}</td>
                    <td style={{ padding:"0.4rem 0.6rem", textAlign:"right" }}>{r.visitors>0?r.visitors.toLocaleString():"-"}</td>
                    <td style={{ padding:"0.4rem 0.6rem", textAlign:"right" }}>{r.clicks>0?r.clicks.toLocaleString():"-"}</td>
                    <td style={{ padding:"0.4rem 0.6rem", textAlign:"right" }}>{r.cvr?r.cvr+"%":"-"}</td>
                    <td style={{ padding:"0.4rem 0.6rem", textAlign:"right", color:r.cancelled>0?"#ef4444":"var(--dim2)" }}>{r.cancelled>0?r.cancelled:"-"}</td>
                    <td style={{ padding:"0.4rem 0.6rem", textAlign:"right", color:r.voucher_cost>0?"#f59e0b":"var(--dim2)" }}>{r.voucher_cost>0?`₱${r.voucher_cost}`:"-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {voucherSummary && voucherSummary.length > 0 && (
        <div className="card" style={{ padding:"1.25rem" }}>
          <div style={{ fontWeight:700, fontSize:"0.9rem", marginBottom:"0.75rem" }}>🎫 バウチャーパフォーマンス</div>
          <div style={{ overflowX:"auto", marginBottom:"1rem" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.75rem" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid var(--rim)" }}>
                  {["バウチャー名","種別","クレーム","注文","売上(₱)","コスト(₱)","利用率","ROI"].map(h=>(
                    <th key={h} style={{ padding:"0.4rem 0.6rem", textAlign:h==="バウチャー名"||h==="種別"?"left":"right", color:"var(--dim2)", fontSize:"0.62rem", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {voucherSummary.map((v,i)=>{
                  const sales = Number(String(v.sales||0).replace(/,/g,""))
                  const cost = Number(String(v.cost||0).replace(/,/g,""))
                  const roi = cost>0 ? ((sales-cost)/cost*100).toFixed(0) : "-"
                  return (
                    <tr key={i} style={{ borderBottom:"1px solid var(--rim)" }}>
                      <td style={{ padding:"0.4rem 0.6rem", fontWeight:600 }}>{v.name}</td>
                      <td style={{ padding:"0.4rem 0.6rem", fontSize:"0.68rem", color:"var(--dim2)" }}>{String(v.type||"").replace(" Voucher","")}</td>
                      <td style={{ padding:"0.4rem 0.6rem", textAlign:"right" }}>{v.claims}</td>
                      <td style={{ padding:"0.4rem 0.6rem", textAlign:"right" }}>{v.orders}</td>
                      <td style={{ padding:"0.4rem 0.6rem", textAlign:"right", color:"var(--orange)" }}>₱{sales.toLocaleString()}</td>
                      <td style={{ padding:"0.4rem 0.6rem", textAlign:"right", color:"#ef4444" }}>₱{cost.toLocaleString()}</td>
                      <td style={{ padding:"0.4rem 0.6rem", textAlign:"right" }}>{v.usageRate}</td>
                      <td style={{ padding:"0.4rem 0.6rem", textAlign:"right", fontWeight:700, color:Number(roi)>500?"#22c55e":Number(roi)>100?"var(--orange)":"#ef4444" }}>
                        {roi !== "-" ? roi+"%" : "-"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button onClick={getAiAdvice} disabled={aiLoading}
            style={{ padding:"0.55rem 1.5rem", borderRadius:8, border:"none", background:"var(--orange)", color:"#fff", fontSize:"0.82rem", fontWeight:700, cursor:aiLoading?"not-allowed":"pointer", opacity:aiLoading?0.7:1 }}>
            {aiLoading ? "🤖 AI分析中（30秒ほど）..." : "🤖 AIに販促戦略を相談する"}
          </button>
          {aiAdvice && (
            <div style={{ marginTop:"1rem", padding:"1rem", background:"rgba(249,115,22,0.06)", borderRadius:10, border:"1px solid rgba(249,115,22,0.2)", fontSize:"0.82rem", lineHeight:1.8, whiteSpace:"pre-wrap" }}>
              <div style={{ fontSize:"0.65rem", fontWeight:700, color:"var(--orange)", marginBottom:"0.5rem", textTransform:"uppercase" }}>🤖 AI販促アドバイス</div>
              {aiAdvice}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 未入力チェック対象フィールド
const REQUIRED_FIELDS = [
  { key:"listings",       label:"出品数",         group:"基本" },
  { key:"sales_php",      label:"売上(₱)",         group:"売上" },
  { key:"orders",         label:"注文数",           group:"売上" },
  { key:"visitors",       label:"Visitors",        group:"トラフィック" },
  { key:"clicks",         label:"Clicks",          group:"トラフィック" },
  { key:"cv",             label:"CVR(%)",           group:"トラフィック" },
  { key:"followers",      label:"フォロワー数",      group:"基本" },
  { key:"rate_php_jpy",   label:"為替レート",        group:"基本" },
]

function getMissingFields(log) {
  return REQUIRED_FIELDS.filter(f => !log[f.key] || log[f.key] === "0" || log[f.key] === "")
}

function HistoryTab({ logs, onDelete, onEdit, onSave }) {
  const [editLog, setEditLog] = useState(null)
  const [editForm, setEditForm] = useState({})

  function openPopup(log) {
    setEditLog(log)
    setEditForm({ ...log })
  }

  async function savePopup() {
    if (!editLog) return
    try {
      const { db } = await import("../lib/firebase")
      const { doc, setDoc } = await import("firebase/firestore")
      await setDoc(doc(db, "action_logs", editLog.id), editForm, { merge: true })
      onSave && onSave()
      setEditLog(null)
    } catch(e) { alert("保存エラー: " + e.message) }
  }

  if (logs.length === 0) return (
    <div className="card" style={{padding:"2rem",textAlign:"center",color:"var(--dim2)"}}>まだデータがありません。📊 データ取込タブからXLSXをアップロードしてください。</div>
  )

  const inp = { padding:"0.45rem 0.7rem", borderRadius:8, border:"1px solid var(--rim)", background:"var(--surface)", color:"var(--text)", fontSize:"0.82rem", width:"100%", boxSizing:"border-box" }

  return (
    <div>
      {logs.map(log => {
        const missing = getMissingFields(log)
        const hasWarning = missing.length > 0
        return (
          <div key={log.id} className="card" style={{padding:"1rem 1.25rem",marginBottom:"0.75rem",border:hasWarning?"1px solid rgba(249,115,22,0.3)":"1px solid var(--rim)"}}>
            <div style={{display:"flex",alignItems:"center",gap:"1rem",flexWrap:"wrap"}}>
              <div style={{fontFamily:"Bebas Neue,sans-serif",fontSize:"1.4rem",color:"var(--orange)",minWidth:90}}>{log.date}</div>
              <div style={{display:"flex",gap:"0.75rem",flexWrap:"wrap",fontSize:"0.82rem",flex:1}}>
                <span style={{color:log.sales_php?"var(--text)":"#ef4444"}}>₱{Number(log.sales_php||0).toLocaleString()}</span>
                <span style={{color:log.orders?"var(--text)":"var(--dim2)"}}>📦{log.orders||"-"}</span>
                <span style={{color:log.visitors?"var(--text)":"var(--dim2)"}}>👁{Number(log.visitors||0).toLocaleString()}</span>
                <span style={{color:log.cv?"var(--text)":"var(--dim2)"}}>CVR {log.cv||"-"}%</span>
                <span style={{color:log.listings?"var(--text)":"var(--dim2)"}}>🏪{log.listings||"-"}点</span>
              </div>
              <div style={{display:"flex",gap:"0.5rem",alignItems:"center"}}>
                {hasWarning && (
                  <button onClick={()=>openPopup(log)}
                    style={{padding:"0.3rem 0.8rem",borderRadius:6,border:"1px solid rgba(249,115,22,0.4)",background:"rgba(249,115,22,0.12)",color:"var(--orange)",fontSize:"0.72rem",cursor:"pointer",fontWeight:700,display:"flex",alignItems:"center",gap:4}}>
                    ⚠️ 未入力 {missing.length}項目
                  </button>
                )}
                {!hasWarning && (
                  <span style={{fontSize:"0.7rem",color:"#22c55e",fontWeight:700}}>✅ 完了</span>
                )}
                <button onClick={()=>openPopup(log)} style={{padding:"0.3rem 0.7rem",borderRadius:6,border:"1px solid rgba(99,102,241,0.3)",background:"rgba(99,102,241,0.1)",color:"#818cf8",fontSize:"0.72rem",cursor:"pointer",fontWeight:700}}>✏️</button>
                <button onClick={()=>onDelete(log.id)} style={{padding:"0.3rem 0.7rem",borderRadius:6,border:"1px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.1)",color:"#ef4444",fontSize:"0.72rem",cursor:"pointer",fontWeight:700}}>🗑️</button>
              </div>
            </div>
            {log.memo && <div style={{marginTop:"0.5rem",fontSize:"0.78rem",color:"var(--dim2)",borderTop:"1px solid var(--rim)",paddingTop:"0.5rem"}}>{log.memo}</div>}
          </div>
        )
      })}

      {/* 未入力ポップアップ */}
      {editLog && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}
          onClick={e=>{if(e.target===e.currentTarget)setEditLog(null)}}>
          <div style={{background:"var(--bg)",borderRadius:16,padding:"1.5rem",width:"100%",maxWidth:560,maxHeight:"85vh",overflowY:"auto",border:"1px solid var(--rim)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
              <div>
                <div style={{fontWeight:800,fontSize:"1rem",color:"var(--orange)"}}>{editLog.date}</div>
                <div style={{fontSize:"0.72rem",color:"var(--dim2)",marginTop:2}}>
                  {getMissingFields(editLog).length > 0 ? `⚠️ ${getMissingFields(editLog).length}項目が未入力です` : "✅ すべて入力済み"}
                </div>
              </div>
              <button onClick={()=>setEditLog(null)} style={{background:"transparent",border:"none",color:"var(--dim2)",fontSize:"1.2rem",cursor:"pointer"}}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem",marginBottom:"1.25rem"}}>
              {REQUIRED_FIELDS.map(f => (
                <div key={f.key}>
                  <label style={{fontSize:"0.62rem",fontWeight:700,color:(!editForm[f.key]||editForm[f.key]==="0")?"#ef4444":"var(--dim2)",display:"block",marginBottom:"0.2rem"}}>
                    {(!editForm[f.key]||editForm[f.key]==="0") ? "⚠️ " : "✅ "}{f.label}
                  </label>
                  <input value={editForm[f.key]||""} onChange={e=>setEditForm(p=>({...p,[f.key]:e.target.value}))}
                    style={{...inp, borderColor:(!editForm[f.key]||editForm[f.key]==="0")?"rgba(239,68,68,0.4)":"var(--rim)"}} />
                </div>
              ))}
            </div>
            <div style={{marginBottom:"0.75rem"}}>
              <label style={{fontSize:"0.62rem",fontWeight:700,color:"var(--dim2)",display:"block",marginBottom:"0.2rem"}}>メモ</label>
              <textarea value={editForm.memo||""} onChange={e=>setEditForm(p=>({...p,memo:e.target.value}))}
                style={{...inp,minHeight:60,resize:"vertical"}} />
            </div>
            <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
              <button onClick={()=>setEditLog(null)} style={{padding:"0.5rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",fontSize:"0.82rem",cursor:"pointer"}}>キャンセル</button>
              <button onClick={savePopup} style={{padding:"0.5rem 1.5rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontSize:"0.82rem",fontWeight:700,cursor:"pointer"}}>💾 保存する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
