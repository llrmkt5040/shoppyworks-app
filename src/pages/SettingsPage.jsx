import { useState, useEffect } from "react"
import { db, auth } from "../lib/firebase"
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, query, where } from "firebase/firestore"

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

export default function SettingsPage() {
  const [visible, setVisible] = useState(DEFAULT_VISIBLE)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [staffEmails, setStaffEmails] = useState([])
  const [newStaffEmail, setNewStaffEmail] = useState("")
  const [staffSaving, setStaffSaving] = useState(false)

  useEffect(() => { loadSettings(); loadStaffEmails() }, [])

  async function loadSettings() {
    try {
      const snap = await getDoc(doc(db, "user_settings", auth.currentUser?.uid))
      if (snap.exists() && snap.data().field_visibility) {
        setVisible(v => ({ ...DEFAULT_VISIBLE, ...snap.data().field_visibility }))
      }
    } catch(e) { console.error(e) }
  }

  async function loadStaffEmails() {
    try {
      const snap = await getDoc(doc(db, "user_settings", auth.currentUser?.uid))
      if (snap.exists() && snap.data().staff_emails) {
        setStaffEmails(snap.data().staff_emails)
      }
    } catch(e) { console.error(e) }
  }

  async function addStaff() {
    const email = newStaffEmail.trim().toLowerCase()
    if (!email || !email.includes("@")) return alert("正しいメールアドレスを入力してください")
    if (staffEmails.includes(email)) return alert("すでに登録されています")
    if (staffEmails.length >= 1) return alert("スタッフは1アカウントまでです。\n追加の場合はオプションプランをご検討ください。")
    setStaffSaving(true)
    try {
      const updated = [...staffEmails, email]
      await setDoc(doc(db, "user_settings", auth.currentUser?.uid), { staff_emails: updated }, { merge: true })
      setStaffEmails(updated)
      setNewStaffEmail("")
    } catch(e) { alert("エラー: " + e.message) }
    setStaffSaving(false)
  }

  async function removeStaff(email) {
    if (!confirm(email + " を削除しますか？")) return
    try {
      const updated = staffEmails.filter(e => e !== email)
      await setDoc(doc(db, "user_settings", auth.currentUser?.uid), { staff_emails: updated }, { merge: true })
      setStaffEmails(updated)
    } catch(e) { alert("エラー: " + e.message) }
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

  function toggleField(key) {
    setVisible(v => ({ ...v, [key]: !v[key] }))
  }

  function toggleGroup(group) {
    const keys = group.fields.map(f => f.key)
    const allOn = keys.every(k => visible[k])
    setVisible(v => ({ ...v, ...Object.fromEntries(keys.map(k => [k, !allOn])) }))
  }

  function allOn() { setVisible(Object.fromEntries(Object.keys(DEFAULT_VISIBLE).map(k => [k, true]))) }
  function allOff() { setVisible(Object.fromEntries(Object.keys(DEFAULT_VISIBLE).map(k => [k, false]))) }

  return (
    <div style={{maxWidth:640,margin:"0 auto",padding:"1.5rem"}}>
      <h2 style={{fontFamily:"Bebas Neue,sans-serif",fontSize:"1.8rem",letterSpacing:"0.04em",marginBottom:"0.5rem"}}>⚙️ 設定</h2>
      <p style={{fontSize:"0.82rem",color:"var(--dim2)",marginBottom:"1.5rem"}}>日次管理の入力項目を表示・非表示で管理できます</p>

      <div style={{display:"flex",gap:"0.5rem",marginBottom:"1.5rem"}}>
        <button onClick={allOn} style={{padding:"0.4rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",fontSize:"0.78rem",cursor:"pointer",fontWeight:700}}>すべてON</button>
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

      {/* スタッフアクセス管理 */}
      <div className="card" style={{padding:"1.25rem",marginTop:"2rem"}}>
        <div style={{marginBottom:"1rem",paddingBottom:"0.75rem",borderBottom:"1px solid var(--rim)"}}>
          <span style={{fontSize:"0.72rem",fontWeight:700,color:"var(--orange)",textTransform:"uppercase",letterSpacing:"0.08em"}}>👥 スタッフアクセス管理</span>
          <p style={{fontSize:"0.75rem",color:"var(--dim2)",marginTop:"0.3rem"}}>このアカウントにアクセスを許可するスタッフのGoogleメールを登録します</p>
        </div>
        <div style={{display:"flex",gap:"0.5rem",marginBottom:"1rem"}}>
          <input
            type="email"
            placeholder="staff@gmail.com"
            value={newStaffEmail}
            onChange={e => setNewStaffEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addStaff()}
            style={{flex:1,padding:"0.55rem 0.75rem",borderRadius:8,border:"1px solid var(--rim2)",background:"var(--bg)",color:"var(--text)",fontSize:"0.82rem",outline:"none"}}
          />
          <button onClick={addStaff} disabled={staffSaving}
            style={{padding:"0.55rem 1rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontSize:"0.78rem",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
            ＋追加
          </button>
        </div>
        {staffEmails.length === 0 ? (
          <p style={{fontSize:"0.75rem",color:"var(--dim2)",textAlign:"center",padding:"0.75rem"}}>スタッフは登録されていません</p>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
            {staffEmails.map(email => (
              <div key={email} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.5rem 0.75rem",borderRadius:8,background:"rgba(255,107,43,0.05)",border:"1px solid var(--rim)"}}>
                <span style={{fontSize:"0.82rem",color:"var(--text)"}}>{email}</span>
                <button onClick={() => removeStaff(email)}
                  style={{padding:"0.2rem 0.5rem",borderRadius:6,border:"none",background:"rgba(239,68,68,0.15)",color:"#ef4444",fontSize:"0.7rem",cursor:"pointer",fontWeight:700}}>
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
