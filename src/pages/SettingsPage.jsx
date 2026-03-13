import { useState, useEffect } from "react"
import { db, auth } from "../lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"

const FIELD_GROUPS = [
  {
    group: "為替レート",
    fields: [
      { key: "rate_php_jpy", label: "PHP → JPY レート" },
    ]
  },
  {
    group: "出品・改修",
    fields: [
      { key: "live", label: "🟢 Live（出品数）" },
      { key: "listings", label: "📦 出品点数（前日）" },
      { key: "improved_pages", label: "🔧 改修商品ページ件数（前日）" },
    ]
  },
  {
    group: "売上・注文",
    fields: [
      { key: "sales_php", label: "💰 Sales (PHP)" },
      { key: "sales_jpy", label: "💴 売上 (円) 自動" },
      { key: "sales_rebate_php", label: "🏷️ Sales Rebate applied (PHP)" },
      { key: "sales_rebate_jpy", label: "💴 Sales Rebate (円) 自動" },
      { key: "orders", label: "📦 Orders（注文数）" },
      { key: "sales_deposit_usd", label: "🏦 売上入金 USD" },
    ]
  },
  {
    group: "アクセス・転換率",
    fields: [
      { key: "visitors", label: "👥 Visitors（訪問者数）" },
      { key: "clicks", label: "🖱️ Product Clicks（クリック数）" },
      { key: "spo", label: "📍 Sales per Order (SPO)" },
      { key: "ocr", label: "📊 Order Conversion Rate (OCR)" },
      { key: "cv", label: "📈 CV（注文転換数）" },
    ]
  },
  {
    group: "キャンセル・返金",
    fields: [
      { key: "cancelled", label: "❌ キャンセル数" },
      { key: "cancelled_sales", label: "🚫 キャンセル売上 (PHP)" },
      { key: "returned", label: "↩️ 返品数" },
    ]
  },
  {
    group: "フォロー・評価",
    fields: [
      { key: "followers", label: "❤️ Followers（フォロワー数）" },
      { key: "rating_stars", label: "⭐ 評価数" },
      { key: "rating", label: "🌟 評価スコア" },
    ]
  },
  {
    group: "Voucher",
    fields: [
      { key: "voucher_new_buyer", label: "🆕 New Buyer 配布枚数" },
      { key: "usage_new_buyer", label: "📱 New Buyer 利用回数" },
      { key: "voucher_repeat_buyer", label: "🔄 Repeat Buyer 配布枚数" },
      { key: "usage_repeat_buyer", label: "📱 Repeat Buyer 利用回数" },
      { key: "follow_prize", label: "🎁 FollowPrize 配布枚数" },
      { key: "usage", label: "📱 FollowPrize 利用回数" },
    ]
  },
  {
    group: "仕入れ",
    fields: [
      { key: "buy_daiso", label: "🏪 DAISO仕入れ (円)" },
      { key: "buy_amazon", label: "📦 Amazon仕入れ (円)" },
      { key: "buy_mercari", label: "♻️ メルカリ仕入れ (円)" },
      { key: "buy_other", label: "🛒 その他仕入れ (円)" },
    ]
  },
  {
    group: "転送費用",
    fields: [
      { key: "domestic_shipping", label: "🚚 国内送料 (円)" },
      { key: "packaging_materials", label: "📦 梱包資材 (円)" },
    ]
  },
  {
    group: "メモ",
    fields: [
      { key: "memo", label: "📝 メモ・気づき" },
    ]
  },
]

const DEFAULT_VISIBLE = Object.fromEntries(
  FIELD_GROUPS.flatMap(g => g.fields.map(f => [f.key, true]))
)

export const STAFF_PAGES = [
  { id: "dashboard",     label: "📈 Dashboard",           defaultPerm: "view" },
  { id: "actionlog",     label: "📅 ShopeeDiary",          defaultPerm: "edit" },
  { id: "analyzer",      label: "📊 ShopeeAnalyzer",       defaultPerm: "view" },
  { id: "shopee",        label: "📂 ShopeeManager",        defaultPerm: "view" },
  { id: "inventory",     label: "📦 StockManager",         defaultPerm: "view" },
  { id: "requests",      label: "🛍️ PasabuyManager",       defaultPerm: "edit" },
  { id: "massupdate",    label: "🔄 MassUpdate管理",       defaultPerm: "view" },
  { id: "accounthealth", label: "🏥 アカウントヘルス",     defaultPerm: "view" },
  { id: "notice",        label: "📢 お知らせ",              defaultPerm: "view" },
  { id: "manual",        label: "📖 マニュアル",            defaultPerm: "view" },
]

export const DEFAULT_STAFF_PERMS = Object.fromEntries(
  STAFF_PAGES.map(p => [p.id, p.defaultPerm])
)

const PERM_LABELS = {
  edit: { label: "編集",   color: "var(--green)", bg: "rgba(52,211,153,0.12)" },
  view: { label: "閲覧",   color: "#60a5fa",       bg: "rgba(96,165,250,0.12)" },
  none: { label: "非表示", color: "var(--dim2)",   bg: "rgba(255,255,255,0.03)" },
}

const TABS = [
  { id: "display", icon: "📋", label: "表示項目" },
  { id: "staff",   icon: "👥", label: "スタッフ" },
  { id: "system",  icon: "🔧", label: "システム" },
]

export const useFieldSettings = () => {
  const [visible, setVisible] = useState(DEFAULT_VISIBLE)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "user_settings", auth.currentUser?.uid))
        if (snap.exists() && snap.data().field_visibility) {
          setVisible(v => ({ ...DEFAULT_VISIBLE, ...snap.data().field_visibility }))
        }
      } catch(e) { console.error(e) }
      setLoaded(true)
    }
    load()
  }, [])
  return { visible, loaded }
}


function SystemTab() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("sw_anthropic_key") || "")
  const [showKey, setShowKey] = useState(false)
  const [apiSaved, setApiSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  function saveApiKey() {
    if (!apiKey.trim()) {
      localStorage.removeItem("sw_anthropic_key")
      setApiSaved(true)
      setTimeout(() => setApiSaved(false), 2000)
      return
    }
    localStorage.setItem("sw_anthropic_key", apiKey.trim())
    setApiSaved(true)
    setTimeout(() => setApiSaved(false), 2000)
  }

  async function testApiKey() {
    if (!apiKey.trim()) return alert("APIキーを入力してください")
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 10,
          messages: [{ role: "user", content: "Hi" }]
        })
      })
      const data = await res.json()
      if (data.content?.[0]?.text) {
        setTestResult({ ok: true, msg: "✅ 接続成功！AI機能が使えます" })
      } else {
        setTestResult({ ok: false, msg: "❌ エラー: " + (data.error?.message || "不明なエラー") })
      }
    } catch(e) {
      setTestResult({ ok: false, msg: "❌ 接続失敗: " + e.message })
    }
    setTesting(false)
  }

  const maskedKey = apiKey ? apiKey.slice(0, 10) + "••••••••••••••••••••" + apiKey.slice(-4) : ""

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>

      {/* Anthropic APIキー設定 */}
      <div className="card" style={{ padding:"1.25rem", borderTop:"2px solid var(--ai)" }}>
        <div style={{ fontSize:"0.72rem", fontWeight:700, color:"var(--ai)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.75rem" }}>🤖 Anthropic APIキー</div>
        <p style={{ fontSize:"0.78rem", color:"var(--dim2)", marginBottom:"1rem", lineHeight:1.6 }}>
          AI機能（ダッシュボード分析・Pasabuy価格提案・MassUpdate補完）を使うには、Anthropic APIキーが必要です。<br/>
          キーは <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color:"var(--ai)" }}>console.anthropic.com</a> から取得できます。
        </p>
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"0.75rem" }}>
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-ant-api03-..."
            style={{ flex:1, padding:"0.55rem 0.75rem", borderRadius:8, border:"1px solid var(--rim2)", background:"var(--bg)", color:"var(--text)", fontSize:"0.82rem", outline:"none", fontFamily:"monospace" }}
          />
          <button onClick={() => setShowKey(v => !v)} style={{ padding:"0.55rem 0.75rem", borderRadius:8, border:"1px solid var(--rim)", background:"transparent", color:"var(--dim2)", cursor:"pointer", fontSize:"0.78rem" }}>
            {showKey ? "🙈" : "👁"}
          </button>
        </div>
        <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap" }}>
          <button onClick={saveApiKey} style={{ padding:"0.5rem 1.25rem", borderRadius:8, border:"none", background:apiSaved?"var(--green)":"var(--ai)", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:"0.78rem", transition:"all 0.2s" }}>
            {apiSaved ? "✅ 保存しました" : "💾 保存"}
          </button>
          <button onClick={testApiKey} disabled={testing} style={{ padding:"0.5rem 1.25rem", borderRadius:8, border:"1px solid var(--ai)", background:"transparent", color:"var(--ai)", fontWeight:700, cursor:"pointer", fontSize:"0.78rem" }}>
            {testing ? "⏳ テスト中..." : "🧪 接続テスト"}
          </button>
          {apiKey && (
            <button onClick={() => { setApiKey(""); localStorage.removeItem("sw_anthropic_key") }} style={{ padding:"0.5rem 1rem", borderRadius:8, border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.08)", color:"#ef4444", fontWeight:700, cursor:"pointer", fontSize:"0.78rem" }}>
              🗑 削除
            </button>
          )}
        </div>
        {testResult && (
          <div style={{ marginTop:"0.75rem", padding:"0.6rem 0.9rem", borderRadius:8, background:testResult.ok?"rgba(16,185,129,0.08)":"rgba(239,68,68,0.08)", border:`1px solid ${testResult.ok?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`, fontSize:"0.78rem", color:testResult.ok?"#10b981":"#ef4444", fontWeight:700 }}>
            {testResult.msg}
          </div>
        )}
        {!apiKey && (
          <div style={{ marginTop:"0.75rem", padding:"0.5rem 0.75rem", borderRadius:8, background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.3)", fontSize:"0.72rem", color:"#f59e0b" }}>
            ⚠️ APIキー未設定のため、AI機能は使用できません
          </div>
        )}
      </div>

      {/* 準備中 */}
      <div className="card" style={{ padding:"1.25rem", opacity:0.5 }}>
        <div style={{ fontSize:"0.72rem", fontWeight:700, color:"var(--dim2)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.75rem" }}>🔔 メール通知設定</div>
        <div style={{ fontSize:"0.78rem", color:"var(--dim2)" }}>準備中...</div>
      </div>

    </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("display")
  const [visible, setVisible] = useState(DEFAULT_VISIBLE)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [staffEmails, setStaffEmails] = useState([])
  const [newStaffEmail, setNewStaffEmail] = useState("")
  const [staffSaving, setStaffSaving] = useState(false)
  const [staffPerms, setStaffPerms] = useState({})
  const [expandedStaff, setExpandedStaff] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const snap = await getDoc(doc(db, "user_settings", auth.currentUser?.uid))
      if (snap.exists()) {
        const data = snap.data()
        if (data.field_visibility)   setVisible(v => ({ ...DEFAULT_VISIBLE, ...data.field_visibility }))
        if (data.staff_emails)       setStaffEmails(data.staff_emails)
        if (data.staff_permissions)  setStaffPerms(data.staff_permissions)
      }
    } catch(e) { console.error(e) }
  }

  async function saveSettings() {
    setSaving(true)
    try {
      await setDoc(doc(db, "user_settings", auth.currentUser?.uid), { field_visibility: visible }, { merge: true })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch(e) { alert("保存エラー: " + e.message) }
    setSaving(false)
  }
  function toggleField(key) { setVisible(v => ({ ...v, [key]: !v[key] })) }
  function toggleGroup(group) {
    const keys = group.fields.map(f => f.key)
    const allOn = keys.every(k => visible[k])
    setVisible(v => ({ ...v, ...Object.fromEntries(keys.map(k => [k, !allOn])) }))
  }
  function allOn()  { setVisible(Object.fromEntries(Object.keys(DEFAULT_VISIBLE).map(k => [k, true]))) }
  function allOff() { setVisible(Object.fromEntries(Object.keys(DEFAULT_VISIBLE).map(k => [k, false]))) }

  async function addStaff() {
    const email = newStaffEmail.trim().toLowerCase()
    if (!email || !email.includes("@")) return alert("正しいメールアドレスを入力してください")
    if (staffEmails.includes(email)) return alert("すでに登録されています")
    if (staffEmails.length >= 1) return alert("スタッフは1アカウントまでです。\n追加の場合はオプションプランをご検討ください。")
    setStaffSaving(true)
    try {
      const updated = [...staffEmails, email]
      const updatedPerms = { ...staffPerms, [email]: { ...DEFAULT_STAFF_PERMS } }
      await setDoc(doc(db, "user_settings", auth.currentUser?.uid), {
        staff_emails: updated, staff_permissions: updatedPerms
      }, { merge: true })
      setStaffEmails(updated)
      setStaffPerms(updatedPerms)
      setNewStaffEmail("")
      setExpandedStaff(email)
    } catch(e) { alert("エラー: " + e.message) }
    setStaffSaving(false)
  }

  async function removeStaff(email) {
    if (!confirm(email + " を削除しますか？")) return
    try {
      const updated = staffEmails.filter(e => e !== email)
      const updatedPerms = { ...staffPerms }
      delete updatedPerms[email]
      await setDoc(doc(db, "user_settings", auth.currentUser?.uid), {
        staff_emails: updated, staff_permissions: updatedPerms
      }, { merge: true })
      setStaffEmails(updated)
      setStaffPerms(updatedPerms)
      if (expandedStaff === email) setExpandedStaff(null)
    } catch(e) { alert("エラー: " + e.message) }
  }

  async function saveStaffPerms(email, perms) {
    try {
      const updatedPerms = { ...staffPerms, [email]: perms }
      await setDoc(doc(db, "user_settings", auth.currentUser?.uid), {
        staff_permissions: updatedPerms
      }, { merge: true })
      setStaffPerms(updatedPerms)
    } catch(e) { alert("権限保存エラー: " + e.message) }
  }

  function cyclePerm(email, pageId) {
    const order = ["edit", "view", "none"]
    const current = (staffPerms[email] || DEFAULT_STAFF_PERMS)[pageId] || "view"
    const next = order[(order.indexOf(current) + 1) % order.length]
    saveStaffPerms(email, { ...(staffPerms[email] || DEFAULT_STAFF_PERMS), [pageId]: next })
  }

  const tabBtn = (id) => ({
    flex: 1, padding: "0.6rem 0", borderRadius: 8, border: "none",
    background: activeTab === id ? "var(--orange)" : "transparent",
    color: activeTab === id ? "#fff" : "var(--dim2)",
    fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem",
    transition: "all 0.15s",
  })

  return (
    <div style={{maxWidth:660,margin:"0 auto",padding:"1.5rem"}}>
      <h2 style={{fontFamily:"Bebas Neue,sans-serif",fontSize:"1.8rem",letterSpacing:"0.04em",marginBottom:"1.25rem"}}>⚙️ 設定</h2>

      {/* タブバー */}
      <div style={{display:"flex",gap:"0.35rem",padding:"0.35rem",background:"var(--surface)",borderRadius:10,border:"1px solid var(--rim)",marginBottom:"1.5rem"}}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={tabBtn(t.id)}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── 表示項目タブ ── */}
      {activeTab === "display" && (
        <div>
          <p style={{fontSize:"0.82rem",color:"var(--dim2)",marginBottom:"1rem"}}>ShopeeDiary の入力項目を表示・非表示で管理できます</p>
          <div style={{display:"flex",gap:"0.5rem",marginBottom:"1.25rem"}}>
            <button onClick={allOn}  style={{padding:"0.4rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",fontSize:"0.78rem",cursor:"pointer",fontWeight:700}}>すべてON</button>
            <button onClick={allOff} style={{padding:"0.4rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",fontSize:"0.78rem",cursor:"pointer",fontWeight:700}}>すべてOFF</button>
          </div>
          {FIELD_GROUPS.map(group => {
            const allGroupOn = group.fields.every(f => visible[f.key])
            return (
              <div key={group.group} className="card" style={{padding:"1rem 1.25rem",marginBottom:"0.75rem"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.75rem",paddingBottom:"0.5rem",borderBottom:"1px solid var(--rim)"}}>
                  <span style={{fontSize:"0.72rem",fontWeight:700,color:"var(--orange)",textTransform:"uppercase",letterSpacing:"0.08em"}}>{group.group}</span>
                  <button onClick={() => toggleGroup(group)}
                    style={{padding:"0.2rem 0.6rem",borderRadius:6,border:"1px solid var(--rim)",background:allGroupOn?"rgba(255,107,43,0.1)":"transparent",color:allGroupOn?"var(--orange)":"var(--dim2)",fontSize:"0.68rem",cursor:"pointer",fontWeight:700}}>
                    {allGroupOn ? "グループOFF" : "グループON"}
                  </button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
                  {group.fields.map(field => (
                    <label key={field.key} style={{display:"flex",alignItems:"center",gap:"0.75rem",cursor:"pointer",padding:"0.35rem 0.5rem",borderRadius:6,background:visible[field.key]?"rgba(255,107,43,0.05)":"transparent",transition:"all 0.15s"}}>
                      <input type="checkbox" checked={visible[field.key] || false} onChange={() => toggleField(field.key)}
                        style={{width:16,height:16,accentColor:"var(--orange)",cursor:"pointer"}} />
                      <span style={{fontSize:"0.85rem",color:visible[field.key]?"var(--text)":"var(--dim2)",transition:"all 0.15s"}}>{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
          <button onClick={saveSettings} disabled={saving}
            style={{width:"100%",padding:"0.9rem",borderRadius:10,border:"none",background:saved?"var(--green)":"var(--orange)",color:"#fff",fontSize:"1rem",fontWeight:900,cursor:saving?"not-allowed":"pointer",transition:"all 0.3s",marginTop:"0.5rem"}}>
            {saving ? "保存中.." : saved ? "✅ 保存しました！" : "設定を保存する"}
          </button>
        </div>
      )}

      {/* ── スタッフタブ ── */}
      {activeTab === "staff" && (
        <div>
          <p style={{fontSize:"0.82rem",color:"var(--dim2)",marginBottom:"1.25rem"}}>スタッフのGoogleメールを登録し、ページごとに編集・閲覧・非表示の権限を設定できます</p>

          <div className="card" style={{padding:"1.25rem",marginBottom:"1rem"}}>
            <div style={{fontSize:"0.72rem",fontWeight:700,color:"var(--orange)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.75rem"}}>スタッフ追加</div>
            <div style={{display:"flex",gap:"0.5rem"}}>
              <input type="email" placeholder="staff@gmail.com" value={newStaffEmail}
                onChange={e => setNewStaffEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addStaff()}
                style={{flex:1,padding:"0.55rem 0.75rem",borderRadius:8,border:"1px solid var(--rim2)",background:"var(--bg)",color:"var(--text)",fontSize:"0.82rem",outline:"none"}} />
              <button onClick={addStaff} disabled={staffSaving}
                style={{padding:"0.55rem 1rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontSize:"0.78rem",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                ＋追加
              </button>
            </div>
            <p style={{fontSize:"0.68rem",color:"var(--dim2)",marginTop:"0.5rem"}}>※ 無料プランはスタッフ1アカウントまで</p>
          </div>

          {staffEmails.length === 0 ? (
            <div className="card" style={{padding:"2.5rem",textAlign:"center"}}>
              <div style={{fontSize:"1.75rem",marginBottom:"0.5rem"}}>👥</div>
              <p style={{fontSize:"0.8rem",color:"var(--dim2)"}}>スタッフはまだ登録されていません</p>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              {staffEmails.map(email => {
                const perms = staffPerms[email] || DEFAULT_STAFF_PERMS
                const isExpanded = expandedStaff === email
                return (
                  <div key={email} className="card" style={{padding:0,overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.75rem 1rem",background:"rgba(255,107,43,0.04)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                        <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,var(--orange),#fb923c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.75rem",color:"#fff",fontWeight:900,flexShrink:0}}>
                          {email[0].toUpperCase()}
                        </div>
                        <span style={{fontSize:"0.82rem",color:"var(--text)",fontWeight:600}}>{email}</span>
                      </div>
                      <div style={{display:"flex",gap:"0.4rem"}}>
                        <button onClick={() => setExpandedStaff(isExpanded ? null : email)}
                          style={{padding:"0.25rem 0.65rem",borderRadius:6,border:"1px solid var(--rim)",background:isExpanded?"rgba(255,107,43,0.1)":"transparent",color:isExpanded?"var(--orange)":"var(--dim2)",fontSize:"0.7rem",cursor:"pointer",fontWeight:700}}>
                          {isExpanded ? "▲ 閉じる" : "⚙️ 権限設定"}
                        </button>
                        <button onClick={() => removeStaff(email)}
                          style={{padding:"0.25rem 0.5rem",borderRadius:6,border:"none",background:"rgba(239,68,68,0.12)",color:"#ef4444",fontSize:"0.7rem",cursor:"pointer",fontWeight:700}}>
                          削除
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{padding:"1rem",borderTop:"1px solid var(--rim)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"0.75rem",marginBottom:"0.75rem",flexWrap:"wrap"}}>
                          <span style={{fontSize:"0.65rem",color:"var(--dim2)"}}>クリックで切り替え：</span>
                          {Object.entries(PERM_LABELS).map(([k,v]) => (
                            <span key={k} style={{padding:"0.15rem 0.5rem",borderRadius:4,background:v.bg,color:v.color,fontWeight:700,fontSize:"0.62rem",border:`1px solid ${v.color}33`}}>{v.label}</span>
                          ))}
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:"0.3rem"}}>
                          {STAFF_PAGES.map(pg => {
                            const perm = perms[pg.id] || "view"
                            const p = PERM_LABELS[perm]
                            return (
                              <div key={pg.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.45rem 0.6rem",borderRadius:6,background:"rgba(255,255,255,0.02)",border:"1px solid var(--rim)"}}>
                                <span style={{fontSize:"0.8rem",color:"var(--text)"}}>{pg.label}</span>
                                <button onClick={() => cyclePerm(email, pg.id)}
                                  style={{padding:"0.2rem 0.7rem",borderRadius:6,border:`1px solid ${p.color}44`,background:p.bg,color:p.color,fontSize:"0.7rem",fontWeight:700,cursor:"pointer",minWidth:56,textAlign:"center",transition:"all 0.15s"}}>
                                  {p.label}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{marginTop:"0.6rem",fontSize:"0.62rem",color:"var(--dim2)"}}>💡 設定はリアルタイムで保存されます</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── システムタブ ── */}
      {activeTab === "system" && (
        <SystemTab />
      )}
    </div>
  )
}
