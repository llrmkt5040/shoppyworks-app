
function ComingSoonPage({ title, sub, icon }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:400, gap:"1rem" }}>
      <div style={{ fontSize:"3rem" }}>{icon}</div>
      <div style={{ fontWeight:800, fontSize:"1.3rem", color:"var(--text)" }}>{title}</div>
      <div style={{ fontSize:"0.85rem", color:"var(--dim2)" }}>{sub}</div>
      <div style={{ fontSize:"0.78rem", color:"var(--dim2)", background:"rgba(255,255,255,0.05)", padding:"0.5rem 1.2rem", borderRadius:8, border:"1px solid var(--rim)" }}>🚧 準備中</div>
    </div>
  )
}

import { useState, useEffect } from "react"
import NoticePage from "../pages/NoticePage"
import ManualPage from "../pages/ManualPage"
import { auth, db } from "../lib/firebase"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { collection, getDocs, doc, getDoc } from "firebase/firestore"
import DashboardPage from "../pages/DashboardPage"
import AnalyzerPage from "../pages/AnalyzerPage"
import ActionLogPage from "../pages/ActionLogPage"
import InventoryPage from "../pages/InventoryPage"
import ShippingPage from "../pages/ShippingPage"
import BreakEvenPage from "../pages/BreakEvenPage"
import RequestsPage from "../pages/RequestsPage"
import ShopeeManagerPage from "../pages/ShopeeManagerPage"
import MassUpdatePage from "../pages/MassUpdatePage"
import AccountHealthPage from "../pages/AccountHealthPage"
import TaskChecklist, { useUncompletedCount } from "./TaskChecklist"
import SettingsPage, { STAFF_PAGES, DEFAULT_STAFF_PERMS } from "../pages/SettingsPage"
import CockpitPage from "../pages/CockpitPage"

const INSTRUCTOR_EMAILS = ["tamaniha.hitoiki@gmail.com", "yusukeok5040@gmail.com"]

const NAV = [
  { id: "_mgmt",         icon: "",    label: "Project Management", sub: "",           section: "header", instructorOnly: true },
  { id: "cockpit",       icon: "🎓", label: "Cockpit",             sub: "受講生管理", instructorOnly: true },
  { id: "dashboard",     icon: "📈", label: "Dashboard",           sub: "数値管理" },
  { id: "notice",        icon: "📢", label: "Notice",              sub: "更新・予定" },
  { id: "manual",        icon: "📖", label: "Manual",              sub: "操作ガイド" },
  { id: "_sales",        icon: "",    label: "Sales Management",   sub: "",           section: "header" },
  { id: "actionlog",     icon: "📅", label: "ShopeeDiary",        sub: "日次記録" },
  { id: "shipping",      icon: "📋", label: "ShippingManager",    sub: "出荷管理" },
  { id: "shopee",        icon: "💰", label: "ProfitManager",      sub: "利益・入金" },
  { id: "requests",      icon: "🛍️", label: "PasabuyManager",     sub: "御用聞き" },
  { id: "_listing",      icon: "",    label: "Listing Management", sub: "",           section: "header" },
  { id: "massupdate",    icon: "🏪", label: "ShopeeListing",      sub: "出品・更新" },
  { id: "accounthealth", icon: "🏥", label: "AccountHealth",      sub: "健全性管理" },
  { id: "_stock",        icon: "",    label: "Stock Management",   sub: "",           section: "header" },
  { id: "inventory",     icon: "📦", label: "StockManager",       sub: "商品マスタ" },
  { id: "analyzer",      icon: "📊", label: "ShopeeAnalyzer",     sub: "商品分析" },
  { id: "_tools",        icon: "",    label: "Analysis & Tools",   sub: "",           section: "header" },
  { id: "competitor",    icon: "🔍", label: "CompetitorWatch",    sub: "競合セラー管理" },
  { id: "breakeven",     icon: "🧮", label: "BreakEvenCalc",      sub: "損益分岐計算機" },
  { id: "_config",       icon: "",    label: "Configuration",      sub: "",           section: "header" },
  { id: "settings",      icon: "⚙️", label: "Settings",           sub: "設定" },
]

function ViewOnlyBanner() {
  return (
    <div style={{ background:"rgba(96,165,250,0.12)", border:"1px solid rgba(96,165,250,0.3)", borderRadius:8, padding:"0.5rem 1rem", marginBottom:"1rem", fontSize:"0.72rem", color:"#60a5fa", fontWeight:700, display:"flex", alignItems:"center", gap:"0.5rem" }}>
      👁️ 閲覧モード — このページは閲覧のみ可能です
    </div>
  )
}

// サポート講師：担当受講生選択画面
function SupportStudentSelector({ assignedStudents, onSelect }) {
  const [students, setStudents] = useState([])
  useEffect(() => {
    async function load() {
      const snap = await getDocs(collection(db, "allowed_emails"))
      const all = snap.docs.map(d => ({ email: d.id, ...d.data() }))
        .filter(u => assignedStudents.includes(u.uid) || assignedStudents.includes(u.email))
      setStudents(all)
    }
    load()
  }, [])

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)" }}>
      <div className="card" style={{ padding:"2rem", maxWidth:400, width:"100%" }}>
        <div style={{ fontSize:"0.7rem", fontWeight:700, color:"var(--orange)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"0.5rem" }}>🎓 サポート講師</div>
        <div style={{ fontSize:"1rem", fontWeight:900, color:"var(--text)", marginBottom:"0.25rem" }}>担当受講生を選択</div>
        <div style={{ fontSize:"0.72rem", color:"var(--dim2)", marginBottom:"1.5rem" }}>閲覧する受講生を選んでください</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
          {students.length === 0
            ? <div style={{ fontSize:"0.78rem", color:"var(--dim2)" }}>担当受講生が設定されていません</div>
            : students.map((s, i) => (
              <button key={i} onClick={() => onSelect(s)} style={{ padding:"0.75rem 1rem", borderRadius:8, border:"1px solid var(--rim2)", background:"var(--surface)", color:"var(--text)", cursor:"pointer", textAlign:"left", fontSize:"0.82rem", fontWeight:700, transition:"all 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="var(--orange)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="var(--rim2)"}>
                <div>{s.name || s.email}</div>
                <div style={{ fontSize:"0.62rem", color:"var(--dim2)", marginTop:"0.15rem" }}>{s.email}</div>
              </button>
            ))
          }
        </div>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [allowData, setAllowData] = useState(null)
  const [page, setPage] = useState("dashboard")
  const [sideOpen, setSideOpen] = useState(true)
  const [userMenu, setUserMenu] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const uncompletedCount = useUncompletedCount(user?.uid)

  // スタッフ（既存機能）
  const [staffTarget, setStaffTarget] = useState(null)
  const [staffPermissions, setStaffPermissions] = useState({})

  // サポート講師
  const [supportTarget, setSupportTarget] = useState(null)

  const isInstructor = INSTRUCTOR_EMAILS.map(e=>e.toLowerCase()).includes(user?.email?.toLowerCase()||"")
  const isSupport = allowData?.role === "support"
  const isParticipant = !isInstructor && !isSupport && allowData?.role !== "staff"

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid))
          if (snap.exists()) setProfile(snap.data())
          else setProfile({ uid: u.uid, name: u.displayName, email: u.email })

          const allowSnap = await getDoc(doc(db, "allowed_emails", u.email))
          if (allowSnap.exists()) setAllowData(allowSnap.data())
        } catch {
          setProfile({ uid: u.uid, name: u.displayName, email: u.email })
        }
      } else {
        setStaffTarget(null)
        setStaffPermissions({})
        setSupportTarget(null)
        setAllowData(null)
      }
    })
  }, [])

  // スタッフチェック（既存）
  useEffect(() => {
    if (!user || isInstructor || isSupport) return
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
              const allowData2 = allowSnap.exists() ? allowSnap.data() : {}
              setStaffTarget({ uid: targetUid, name: targetData.name || allowData2.name || targetData.email || targetUid, email: targetData.email || "" })
              const perms = data.staff_permissions?.[user.email?.toLowerCase()] || DEFAULT_STAFF_PERMS
              setStaffPermissions(perms)
              return
            }
          }
        }
        setStaffTarget(null)
        setStaffPermissions({})
      } catch(e) { console.error("staff check error:", e) }
    }
    checkStaff()
  }, [user, allowData])

  // 実効UID（誰のデータを見るか）
  const effectiveUid = supportTarget?.uid || staffTarget?.uid || user?.uid
  // スタッフの場合、オーナーUIDを記録（AI共有用）
  useEffect(() => {
    if (staffTarget?.uid && user?.uid && staffTarget.uid !== user.uid) {
      localStorage.setItem("sw_owner_uid", staffTarget.uid)
    } else {
      localStorage.removeItem("sw_owner_uid")
    }
  }, [staffTarget?.uid, user?.uid])

  // ページ権限取得
  function getPagePerm(pageId) {
    // 講師は全部edit
    if (isInstructor) return "edit"
    // サポート講師は閲覧のみ・設定非表示
    if (isSupport) {
      if (pageId === "settings" || pageId === "cockpit") return "none"
      return supportTarget ? "view" : "none"
    }
    // スタッフ
    if (staffTarget) {
      if (pageId === "settings") return "none"
      return staffPermissions[pageId] || "view"
    }
    // 受講生：allowed_emailsのpage_permissionsを参照
    const perms = allowData?.page_permissions || {}
    return perms[pageId] || "edit"
  }

  function isNavVisible(pageId) {
    const navItem = NAV.find(n => n.id === pageId)
    // 講師専用ページ
    if (navItem?.instructorOnly) return isInstructor
    // サポート講師：設定・コクピット非表示、担当受講生未選択時は全非表示
    if (isSupport) {
      if (pageId === "settings" || pageId === "cockpit") return false
      return !!supportTarget
    }
    // スタッフ
    if (staffTarget) {
      if (pageId === "settings") return false
      return getPagePerm(pageId) !== "none"
    }
    // 受講生
    return getPagePerm(pageId) !== "none"
  }

  function renderPage() {
    const perm = getPagePerm(page)
    const viewOnly = perm === "view"
    const uid = effectiveUid

    if (perm === "none") return <DashboardPage uid={uid} viewOnly={false} />

    // サポート講師が担当受講生未選択
    if (isSupport && !supportTarget) return null

    if (staffTarget && page === "settings") return (
      <div style={{ padding:"2rem", textAlign:"center", color:"var(--dim2)", fontSize:"0.85rem" }}>
        設定ページはオーナーのみアクセス可能です
      </div>
    )

    switch (page) {
      case "dashboard":     return <DashboardPage uid={uid} viewOnly={viewOnly} />
      case "notice":        return <NoticePage />
      case "manual":        return <ManualPage />
      case "analyzer":      return <AnalyzerPage uid={uid} onNavigate={setPage} viewOnly={viewOnly} />
      case "actionlog":     return <ActionLogPage uid={uid} viewOnly={viewOnly} />
      case "inventory":     return <InventoryPage uid={uid} viewOnly={viewOnly} />
      case "requests":      return <RequestsPage uid={uid} viewOnly={viewOnly} />
      case "shopee":        return <ShopeeManagerPage uid={uid} viewOnly={viewOnly} />
      case "shipping":      return <ShippingPage uid={uid} viewOnly={viewOnly} />
      case "competitor":    return <ComingSoonPage title="CompetitorWatch" sub="競合セラー管理" icon="🔍" />
      case "breakeven":     return <BreakEvenPage uid={uid} />
      case "massupdate":    return <MassUpdatePage uid={uid} viewOnly={viewOnly} />
      case "accounthealth": return <AccountHealthPage uid={uid} viewOnly={viewOnly} />
      case "settings":      return <SettingsPage uid={uid} profile={profile} />
      case "cockpit":       return <CockpitPage />
      default:              return <DashboardPage uid={uid} viewOnly={viewOnly} />
    }
  }

  // サポート講師：担当受講生未選択時は選択画面を表示
  if (isSupport && !supportTarget && allowData) {
    return <SupportStudentSelector
      assignedStudents={allowData.assigned_students || []}
      onSelect={setSupportTarget}
    />
  }

  const current = NAV.find(n => n.id === page)

  return (
    <div style={{ display:"flex", height:"100vh", background:"var(--bg)", overflow:"hidden" }}>
      {/* サイドバー */}
      <div style={{ width:sideOpen?220:64, minWidth:sideOpen?220:64, background:"var(--surface)", borderRight:"1px solid var(--rim)", display:"flex", flexDirection:"column", transition:"width 0.22s ease, min-width 0.22s ease", overflow:"hidden", zIndex:10 }}>
        <div style={{ padding:sideOpen?"1.25rem 1rem 1rem":"1.25rem 0 1rem", borderBottom:"1px solid var(--rim)", display:"flex", alignItems:"center", gap:"0.6rem", justifyContent:sideOpen?"flex-start":"center" }}>
          <div style={{ width:32, height:32, borderRadius:8, background:"linear-gradient(135deg,var(--orange),#fb923c)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem", flexShrink:0 }}>🛍</div>
          {sideOpen && (<div><div style={{ fontSize:"0.82rem", fontWeight:900, color:"var(--text)", letterSpacing:"0.02em" }}>ShoppyWorks</div><div style={{ fontSize:"0.6rem", color:"var(--dim2)" }}>Bootcamp App</div></div>)}
        </div>

        <nav style={{ flex:1, padding:"0.75rem 0.5rem", display:"flex", flexDirection:"column", gap:"0.25rem", overflowY:"auto" }}>
          {NAV.map(n => {
            // セクションヘッダー
            if (n.id.startsWith('_')) {
              if (n.instructorOnly && !isInstructor) return null
              if (isSupport && !supportTarget) return null
              return sideOpen ? (
                <div key={n.id} style={{ fontSize:"0.58rem", fontWeight:700, color:"var(--dim2)", textTransform:"uppercase", letterSpacing:"0.1em", padding:"0.75rem 0.75rem 0.25rem", opacity:0.6 }}>{n.label}</div>
              ) : (
                <div key={n.id} style={{ borderTop:"1px solid var(--rim)", margin:"0.4rem 0.5rem" }} />
              )
            }

            if (!isNavVisible(n.id)) return null

            const active = page === n.id
            const perm = getPagePerm(n.id)
            return (
              <button key={n.id} onClick={()=>setPage(n.id)} style={{ display:"flex", alignItems:"center", gap:"0.65rem", padding:sideOpen?"0.6rem 0.75rem":"0.6rem", borderRadius:8, border:"none", background:active?"rgba(251,146,60,0.15)":"transparent", outline:active?"1px solid rgba(251,146,60,0.3)":"none", color:active?"var(--orange)":"var(--dim2)", cursor:"pointer", textAlign:"left", width:"100%", justifyContent:sideOpen?"flex-start":"center", transition:"background 0.15s" }}>
                <span style={{ fontSize:"1.05rem", flexShrink:0 }}>{n.icon}</span>
                {sideOpen && (
                  <div style={{ overflow:"hidden", flex:1 }}>
                    <div style={{ fontSize:"0.72rem", fontWeight:active?800:600, color:active?"var(--orange)":"var(--text)", lineHeight:1.2, whiteSpace:"nowrap" }}>{n.label}</div>
                    {n.sub && <div style={{ fontSize:"0.6rem", color:"var(--dim2)", lineHeight:1 }}>{n.sub}</div>}
                  </div>
                )}
                {sideOpen && (staffTarget||isSupport) && perm==="view" && (
                  <span style={{ fontSize:"0.55rem", color:"#60a5fa", fontWeight:700, padding:"0.1rem 0.3rem", borderRadius:3, background:"rgba(96,165,250,0.12)", flexShrink:0 }}>閲覧</span>
                )}
              </button>
            )
          })}
        </nav>

        {user && (
          <div style={{ position:"relative", padding:sideOpen?"0.75rem 1rem":"0.75rem 0", borderTop:"1px solid var(--rim)" }}>
            <div onClick={()=>setUserMenu(o=>!o)} style={{ display:"flex", alignItems:"center", gap:"0.5rem", justifyContent:sideOpen?"flex-start":"center", cursor:"pointer", borderRadius:8, padding:"0.25rem 0.35rem", transition:"background 0.15s" }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              {user.photoURL
                ? <img src={user.photoURL} style={{ width:30, height:30, borderRadius:"50%", flexShrink:0, border:"2px solid var(--orange)" }} />
                : <div style={{ width:30, height:30, borderRadius:"50%", background:"linear-gradient(135deg,var(--orange),#fb923c)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.8rem", color:"#fff", flexShrink:0, fontWeight:900 }}>{(profile?.name||user.displayName||user.email||"U")[0].toUpperCase()}</div>}
              {sideOpen && (
                <div style={{ flex:1, overflow:"hidden" }}>
                  <div style={{ fontSize:"0.72rem", fontWeight:700, color:"var(--text)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {profile?.name||user.displayName||"ユーザー"}
                    {isInstructor && <span style={{ marginLeft:"0.35rem", fontSize:"0.55rem", color:"var(--orange)", fontWeight:700, padding:"0.1rem 0.3rem", borderRadius:3, background:"rgba(251,146,60,0.15)" }}>講師</span>}
                    {isSupport && <span style={{ marginLeft:"0.35rem", fontSize:"0.55rem", color:"#a78bfa", fontWeight:700, padding:"0.1rem 0.3rem", borderRadius:3, background:"rgba(167,139,250,0.15)" }}>サポート</span>}
                  </div>
                  <div style={{ fontSize:"0.6rem", color:"var(--dim2)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{user.email}</div>
                </div>
              )}
              {sideOpen && <span style={{ fontSize:"0.6rem", color:"var(--dim2)" }}>{userMenu?"▲":"▼"}</span>}
            </div>
            {userMenu && (
              <div style={{ position:"absolute", bottom:"100%", left:sideOpen?"0.5rem":"-80px", width:180, background:"var(--surface)", border:"1px solid var(--rim2)", borderRadius:10, overflow:"hidden", boxShadow:"0 -4px 24px rgba(0,0,0,0.4)", zIndex:100 }}>
                <div style={{ padding:"0.75rem 1rem", borderBottom:"1px solid var(--rim)" }}>
                  <div style={{ fontSize:"0.72rem", fontWeight:700, color:"var(--text)" }}>{profile?.name||user.displayName||"ユーザー"}</div>
                  <div style={{ fontSize:"0.6rem", color:"var(--dim2)", marginTop:"0.1rem", wordBreak:"break-all" }}>{user.email}</div>
                </div>
                {!staffTarget && !isSupport && (
                  <button onClick={()=>{ setUserMenu(false); setPage("settings") }} style={{ width:"100%", padding:"0.6rem 1rem", background:"transparent", border:"none", color:"var(--text)", fontSize:"0.75rem", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:"0.5rem" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    ⚙️ 設定
                  </button>
                )}
                {isSupport && supportTarget && (
                  <button onClick={()=>{ setUserMenu(false); setSupportTarget(null) }} style={{ width:"100%", padding:"0.6rem 1rem", background:"transparent", border:"none", color:"#a78bfa", fontSize:"0.75rem", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:"0.5rem" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(167,139,250,0.08)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    👤 受講生を切替
                  </button>
                )}
                <button onClick={()=>{ setUserMenu(false); signOut(auth) }} style={{ width:"100%", padding:"0.6rem 1rem", background:"transparent", border:"none", color:"#ef4444", fontSize:"0.75rem", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:"0.5rem" }}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(239,68,68,0.08)"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  🚪 ログアウト
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* メインコンテンツ */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* バナー */}
        {staffTarget && (
          <div style={{ background:"linear-gradient(90deg,#7c3aed,#a855f7)", color:"#fff", padding:"0.35rem 1.25rem", fontSize:"0.72rem", fontWeight:700, display:"flex", alignItems:"center", gap:"0.5rem", flexShrink:0 }}>
            <span>👥 スタッフアクセス中：</span>
            <span style={{ fontWeight:900 }}>{staffTarget.name}</span>
            <span style={{ opacity:0.8 }}>({staffTarget.email}) のデータを表示しています</span>
          </div>
        )}
        {isSupport && supportTarget && (
          <div style={{ background:"linear-gradient(90deg,#6d28d9,#7c3aed)", color:"#fff", padding:"0.35rem 1.25rem", fontSize:"0.72rem", fontWeight:700, display:"flex", alignItems:"center", gap:"0.5rem", flexShrink:0 }}>
            <span>🎓 サポート講師アクセス中：</span>
            <span style={{ fontWeight:900 }}>{supportTarget.name || supportTarget.email}</span>
            <span style={{ opacity:0.8 }}>のデータを閲覧中</span>
          </div>
        )}

        {/* ヘッダー */}
        <div style={{ height:52, borderBottom:"1px solid var(--rim)", display:"flex", alignItems:"center", gap:"0.75rem", padding:"0 1.25rem", background:"var(--surface)", flexShrink:0 }}>
          <button onClick={()=>setSideOpen(o=>!o)} style={{ width:32, height:32, borderRadius:6, border:"1px solid var(--rim)", background:"transparent", color:"var(--dim2)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.9rem" }}>{sideOpen?"◀":"▶"}</button>
          <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
            <span style={{ fontSize:"0.88rem", fontWeight:800, color:"var(--text)" }}>{current?.icon} {current?.label}</span>
            {current?.sub && (<span style={{ fontSize:"0.65rem", color:"var(--orange)", fontWeight:700, padding:"0.1rem 0.45rem", borderRadius:4, background:"rgba(251,146,60,0.12)", border:"1px solid rgba(251,146,60,0.25)" }}>{current.sub}</span>)}
          </div>
          <div style={{ marginLeft:"auto", position:"relative" }}>
            <button onClick={()=>setBellOpen(o=>!o)} style={{ position:"relative", width:36, height:36, borderRadius:8, border:"1px solid var(--rim)", background:bellOpen?"rgba(251,146,60,0.12)":"transparent", color:uncompletedCount>0?"var(--orange)":"var(--dim2)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.1rem" }}>
              🔔
              {uncompletedCount>0 && (
                <span style={{ position:"absolute", top:-4, right:-4, background:"var(--red)", color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:"0.55rem", fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center" }}>{uncompletedCount>9?"9+":uncompletedCount}</span>
              )}
            </button>
            {bellOpen && (
              <div style={{ position:"absolute", top:44, right:0, width:340, maxHeight:480, overflowY:"auto", background:"var(--surface)", border:"1px solid var(--rim)", borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.3)", zIndex:1000, padding:"1rem" }}>
                <div style={{ fontSize:"0.7rem", fontWeight:900, color:"var(--text)", marginBottom:"0.75rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span>📋 タスクチェックリスト</span>
                  {uncompletedCount===0
                    ? <span style={{ fontSize:"0.65rem", color:"var(--green)", fontWeight:700 }}>✅ 全完了！</span>
                    : <span style={{ fontSize:"0.65rem", color:"var(--red)", fontWeight:700 }}>残り {uncompletedCount} タスク</span>
                  }
                </div>
                <TaskChecklist uid={user?.uid} onNavigate={(p)=>{ setPage(p); setBellOpen(false) }} compact={true} />
              </div>
            )}
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto" }}>{renderPage()}</div>
      </div>
    </div>
  )
}
