import { useState, useEffect } from "react"
import { auth, db } from "../lib/firebase"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { collection, getDocs, doc, getDoc } from "firebase/firestore"
import DashboardPage from "../pages/DashboardPage"
import AnalyzerPage from "../pages/AnalyzerPage"
import ActionLogPage from "../pages/ActionLogPage"
import InventoryPage from "../pages/InventoryPage"
import RequestsPage from "../pages/RequestsPage"
import ShopeeManagerPage from "../pages/ShopeeManagerPage"
import MassUpdatePage from "../pages/MassUpdatePage"
import SettingsPage from "../pages/SettingsPage"

const NAV = [
  { id: "dashboard",  icon: "📈", label: "ShopeeWorksDashboard", sub: "数値管理"   },
  { id: "analyzer",   icon: "📊", label: "ShopeeAnalyzer",      sub: "商品分析"   },
  { id: "actionlog",  icon: "📅", label: "ShopeeDiary",         sub: "日次管理"   },
  { id: "inventory",  icon: "📦", label: "ShopeeStockManager",  sub: "在庫棚卸"   },
  { id: "requests",   icon: "🛍️", label: "PasabuyManager",      sub: "御用聞き"   },
  { id: "shopee",    icon: "📂", label: "ShopeeManager",   sub: "一元管理"   },
  { id: "massupdate", icon: "🔄", label: "MassUpdate管理",  sub: "出品管理"   },
  { id: "settings",   icon: "⚙️", label: "設定",                sub: ""           },
]

export default function AppLayout() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [page, setPage] = useState("analyzer")
  const [sideOpen, setSideOpen] = useState(true)
  const [userMenu, setUserMenu] = useState(false)
  const [staffTarget, setStaffTarget] = useState(null) // スタッフがアクセス中のユーザー情報

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid))
          if (snap.exists()) setProfile(snap.data())
          else setProfile({ uid: u.uid, name: u.displayName, email: u.email })
        } catch {
          setProfile({ uid: u.uid, name: u.displayName, email: u.email })
        }
      } else {
        setStaffTarget(null)
      }
    })
  }, [])

  // スタッフチェック: userがセットされたら実行
  useEffect(() => {
    if (!user) return
    async function checkStaff() {
      try {
        const allSettings = await getDocs(collection(db, "user_settings"))
        for (const docSnap of allSettings.docs) {
          const data = docSnap.data()
          const emails = (data.staff_emails || []).map(e => e.toLowerCase())
          if (emails.includes(user.email?.toLowerCase())) {
            const targetUid = docSnap.id
            if (targetUid !== user.uid) {
              const targetSnap = await getDoc(doc(db, "users", targetUid))
              const targetData = targetSnap.exists() ? targetSnap.data() : {}
              const allowSnap = await getDoc(doc(db, "allowed_emails", targetData.email || ""))
              const allowData = allowSnap.exists() ? allowSnap.data() : {}
              const target = {
                uid: targetUid,
                name: targetData.name || allowData.name || targetData.email || targetUid,
                email: targetData.email || ""
              }
              setStaffTarget(target)
              return
            }
          }
        }
        setStaffTarget(null)
      } catch(e) { console.error("staff check error:", e) }
    }
    checkStaff()
  }, [user])

  function renderPage() {
    const uid = staffTarget ? staffTarget.uid : (profile?.uid || user?.uid)
    // スタッフは設定ページにアクセス不可
    if (!!staffTarget && page === "settings") return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",flexDirection:"column",gap:"1rem"}}>
        <div style={{fontSize:"2rem"}}>🔒</div>
        <div style={{fontSize:"1rem",fontWeight:700,color:"var(--text)"}}>設定ページはアクセスできません</div>
        <div style={{fontSize:"0.8rem",color:"var(--dim2)"}}>スタッフはオーナーの設定を変更できません</div>
      </div>
    )
    switch (page) {
      case "dashboard": return <DashboardPage uid={uid} />
      case "analyzer":  return <AnalyzerPage uid={uid} onNavigate={setPage} />
      case "actionlog": return <ActionLogPage uid={uid} />
      case "inventory": return <InventoryPage uid={uid} />
      case "requests":  return <RequestsPage uid={uid} />
      case "shopee":    return <ShopeeManagerPage uid={uid} />
      case "massupdate": return <MassUpdatePage uid={uid} />
      case "settings":  return <SettingsPage uid={uid} profile={profile} />
      default:          return <DashboardPage uid={uid} />
    }
  }

  const current = NAV.find(n => n.id === page)

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>
      <div style={{ width: sideOpen ? 220 : 64, minWidth: sideOpen ? 220 : 64, background: "var(--surface)", borderRight: "1px solid var(--rim)", display: "flex", flexDirection: "column", transition: "width 0.22s ease, min-width 0.22s ease", overflow: "hidden", zIndex: 10 }}>
        <div style={{ padding: sideOpen ? "1.25rem 1rem 1rem" : "1.25rem 0 1rem", borderBottom: "1px solid var(--rim)", display: "flex", alignItems: "center", gap: "0.6rem", justifyContent: sideOpen ? "flex-start" : "center" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,var(--orange),#fb923c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>🛍</div>
          {sideOpen && (<div><div style={{ fontSize: "0.82rem", fontWeight: 900, color: "var(--text)", letterSpacing: "0.02em" }}>ShoppyWorks</div><div style={{ fontSize: "0.6rem", color: "var(--dim2)" }}>Bootcamp App</div></div>)}
        </div>
        <nav style={{ flex: 1, padding: "0.75rem 0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem", overflowY: "auto" }}>
          {NAV.map(n => {
            const active = page === n.id
            return (
              <button key={n.id} onClick={() => setPage(n.id)} style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: sideOpen ? "0.6rem 0.75rem" : "0.6rem", borderRadius: 8, border: "none", background: active ? "rgba(251,146,60,0.15)" : "transparent", outline: active ? "1px solid rgba(251,146,60,0.3)" : "none", color: active ? "var(--orange)" : "var(--dim2)", cursor: "pointer", textAlign: "left", width: "100%", justifyContent: sideOpen ? "flex-start" : "center", transition: "background 0.15s" }}>
                <span style={{ fontSize: "1.05rem", flexShrink: 0 }}>{n.icon}</span>
                {sideOpen && (<div style={{ overflow: "hidden" }}><div style={{ fontSize: "0.72rem", fontWeight: active ? 800 : 600, color: active ? "var(--orange)" : "var(--text)", lineHeight: 1.2, whiteSpace: "nowrap" }}>{n.label}</div>{n.sub && <div style={{ fontSize: "0.6rem", color: "var(--dim2)", lineHeight: 1 }}>{n.sub}</div>}</div>)}
              </button>
            )
          })}
        </nav>
        {user && (
          <div style={{ position: "relative", padding: sideOpen ? "0.75rem 1rem" : "0.75rem 0", borderTop: "1px solid var(--rim)" }}>
            <div onClick={() => setUserMenu(o => !o)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: sideOpen ? "flex-start" : "center", cursor: "pointer", borderRadius: 8, padding: "0.25rem 0.35rem", transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              {user.photoURL
                ? <img src={user.photoURL} style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, border: "2px solid var(--orange)" }} />
                : <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,var(--orange),#fb923c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", color: "#fff", flexShrink: 0, fontWeight: 900 }}>{(profile?.name || user.displayName || user.email || "U")[0].toUpperCase()}</div>}
              {sideOpen && (
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profile?.name || user.displayName || "ユーザー"}</div>
                  <div style={{ fontSize: "0.6rem", color: "var(--dim2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
                </div>
              )}
              {sideOpen && <span style={{ fontSize: "0.6rem", color: "var(--dim2)" }}>{userMenu ? "▲" : "▼"}</span>}
            </div>
            {userMenu && (
              <div style={{ position: "absolute", bottom: "100%", left: sideOpen ? "0.5rem" : "-80px", width: 180, background: "var(--surface)", border: "1px solid var(--rim2)", borderRadius: 10, overflow: "hidden", boxShadow: "0 -4px 24px rgba(0,0,0,0.4)", zIndex: 100 }}>
                <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--rim)" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text)" }}>{profile?.name || user.displayName || "ユーザー"}</div>
                  <div style={{ fontSize: "0.6rem", color: "var(--dim2)", marginTop: "0.1rem", wordBreak: "break-all" }}>{user.email}</div>
                </div>
                <button onClick={() => { setUserMenu(false); setPage("settings") }} style={{ width: "100%", padding: "0.6rem 1rem", background: "transparent", border: "none", color: "var(--text)", fontSize: "0.75rem", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "0.5rem" }} onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  ⚙️ 設定
                </button>
                <button onClick={() => { setUserMenu(false); signOut(auth) }} style={{ width: "100%", padding: "0.6rem 1rem", background: "transparent", border: "none", color: "#ef4444", fontSize: "0.75rem", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "0.5rem" }} onMouseEnter={e => e.currentTarget.style.background="rgba(239,68,68,0.08)"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  🚪 ログアウト
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {staffTarget && (
          <div style={{ background: "linear-gradient(90deg,#7c3aed,#a855f7)", color: "#fff", padding: "0.35rem 1.25rem", fontSize: "0.72rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
            <span>👥 スタッフアクセス中：</span>
            <span style={{ fontWeight: 900 }}>{staffTarget.name}</span>
            <span style={{ opacity: 0.8 }}>({staffTarget.email}) のデータを表示しています</span>
          </div>
        )}
        <div style={{ height: 52, borderBottom: "1px solid var(--rim)", display: "flex", alignItems: "center", gap: "0.75rem", padding: "0 1.25rem", background: "var(--surface)", flexShrink: 0 }}>
          <button onClick={() => setSideOpen(o => !o)} style={{ width: 32, height: 32, borderRadius: 6, border: "1px solid var(--rim)", background: "transparent", color: "var(--dim2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>{sideOpen ? "◀" : "▶"}</button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--text)" }}>{current?.icon} {current?.label}</span>
            {current?.sub && (<span style={{ fontSize: "0.65rem", color: "var(--orange)", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: 4, background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.25)" }}>{current.sub}</span>)}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>{renderPage()}</div>
      </div>
    </div>
  )
}
