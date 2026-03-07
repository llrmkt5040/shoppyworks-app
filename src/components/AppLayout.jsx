import { auth } from "../lib/firebase"
import { signOut } from "firebase/auth"
import { useState } from "react"
import AnalyzerPage from "../pages/AnalyzerPage"
import ActionLogPage from "../pages/ActionLogPage"
import InventoryPage from "../pages/InventoryPage"
import RequestsPage from "../pages/RequestsPage"
import SettingsPage from "../pages/SettingsPage"

export default function AppLayout({ user }) {
  const [page, setPage] = useState("analyzer")
  const displayName = user?.displayName || user?.email || "ユーザー"

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
      <header style={{ background:"var(--surface)", borderBottom:"1px solid var(--rim)", padding:"0 1.5rem", display:"flex", alignItems:"center", gap:"1rem", height:56, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ fontFamily:"Bebas Neue,sans-serif", fontSize:"1.4rem", letterSpacing:"0.08em", color:"var(--orange)" }}>SHOPPYWORKS</div>
        <nav style={{ display:"flex", gap:"0.25rem", marginLeft:"1rem" }}>
          {[["actionlog","日次管理"],["analyzer","商品分析"],["inventory","在庫棚卸"],["requests","御用聞き"],["settings","⚙️ 設定"]].map(([id,label]) => (
            <button key={id} onClick={() => setPage(id)} style={{ padding:"0.35rem 0.9rem", borderRadius:8, border:"none", cursor:"pointer", fontSize:"0.78rem", fontWeight:700, background:page===id?"rgba(255,107,43,0.15)":"transparent", color:page===id?"var(--orange)":"var(--dim2)", transition:"all 0.2s" }}>
              {label}
            </button>
          ))}
        </nav>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:"0.75rem" }}>
          <span style={{ fontSize:"0.78rem", color:"var(--dim2)" }}>{displayName}</span>
          <button onClick={() => signOut(auth)} style={{ padding:"0.3rem 0.8rem", borderRadius:8, border:"1px solid var(--rim)", background:"transparent", color:"var(--dim2)", fontSize:"0.72rem", cursor:"pointer" }}>ログアウト</button>
        </div>
      </header>
      <main>
        {page === "analyzer" && <AnalyzerPage />}
        {page === "actionlog" && <ActionLogPage />}
        {page === "inventory" && <div style={{maxWidth:960,margin:"0 auto",padding:"1.5rem"}}><h2 style={{fontFamily:"Bebas Neue,sans-serif",fontSize:"1.8rem",letterSpacing:"0.04em",marginBottom:"1.5rem"}}>在庫棚卸</h2><InventoryPage uid={user?.uid} /></div>}
        {page === "requests" && <div style={{maxWidth:960,margin:"0 auto",padding:"1.5rem"}}><h2 style={{fontFamily:"Bebas Neue,sans-serif",fontSize:"1.8rem",letterSpacing:"0.04em",marginBottom:"1.5rem"}}>御用聞き</h2><RequestsPage uid={user?.uid} /></div>}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  )
}