import { useState, useEffect } from "react"
import { auth } from "../lib/firebase"
import { onAuthStateChanged, signOut } from "firebase/auth"
import DashboardPage from "../pages/DashboardPage"
import AnalyzerPage from "../pages/AnalyzerPage"
import ActionLogPage from "../pages/ActionLogPage"
import InventoryPage from "../pages/InventoryPage"
import RequestsPage from "../pages/RequestsPage"
import SettingsPage from "../pages/SettingsPage"

const NAV = [
  { id: "dashboard",  icon: "📈", label: "ShopeeWorksDashboard", sub: "数値管理"   },
  { id: "analyzer",   icon: "📊", label: "ShopeeAnalyzer",      sub: "商品分析"   },
  { id: "actionlog",  icon: "📅", label: "ShopeeDiary",         sub: "日次管理"   },
  { id: "inventory",  icon: "📦", label: "ShopeeStockManager",  sub: "在庫棚卸"   },
  { id: "requests",   icon: "🛍️", label: "PasabuyManager",      sub: "御用聞き"   },
  { id: "settings",   icon: "⚙️", label: "設定",                sub: ""           },
]

export default function AppLayout() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [page, setPage] = useState("analyzer")
  const [sideOpen, setSideOpen] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        try {
          const { db } = await import("../lib/firebase")
          const { doc, getDoc } = await import("firebase/firestore")
          const snap = await getDoc(doc(db, "users", u.uid))
          if (snap.exists()) setProfile(snap.data())
          else setProfile({ uid: u.uid, name: u.displayName, email: u.email })
        } catch {
          setProfile({ uid: u.uid, name: u.displayName, email: u.email })
        }
      }
    })
  }, [])

  function renderPage() {
    const uid = profile?.uid || user?.uid
    switch (page) {
      case "dashboard": return <DashboardPage uid={uid} />
      case "analyzer":  return <AnalyzerPage uid={uid} onNavigate={setPage} />
      case "actionlog": return <ActionLogPage uid={uid} />
      case "inventory": return <InventoryPage uid={uid} />
      case "requests":  return <RequestsPage uid={uid} />
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
          <div style={{ padding: sideOpen ? "0.75rem 1rem" : "0.75rem 0", borderTop: "1px solid var(--rim)", display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: sideOpen ? "flex-start" : "center" }}>
            {user.photoURL ? <img src={user.photoURL} style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} /> : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#fff", flexShrink: 0 }}>{(user.displayName||"U")[0]}</div>}
            {sideOpen && (<div style={{ flex: 1, overflow: "hidden" }}><div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profile?.name || user.displayName}</div><button onClick={() => signOut(auth)} style={{ fontSize: "0.6rem", color: "var(--dim2)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>ログアウト</button></div>)}
          </div>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
