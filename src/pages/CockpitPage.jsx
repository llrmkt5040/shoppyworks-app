import { useState, useEffect } from "react"
import { db } from "../lib/firebase"
import { collection, getDocs, query, orderBy, limit, doc, setDoc } from "firebase/firestore"

const INSTRUCTOR_EMAILS = ["tamaniha.hitoiki@gmail.com", "yusukeok5040@gmail.com"]

export function useIsInstructor(user) {
  return INSTRUCTOR_EMAILS.map(e=>e.toLowerCase()).includes(user?.email?.toLowerCase()||"")
}

function RankBadge({ rank }) {
  if (rank === 1) return <span style={{ fontSize:"1.2rem" }}>🥇</span>
  if (rank === 2) return <span style={{ fontSize:"1.2rem" }}>🥈</span>
  if (rank === 3) return <span style={{ fontSize:"1.2rem" }}>🥉</span>
  return <span style={{ fontSize:"0.8rem", fontWeight:700, color:"var(--dim2)", width:24, textAlign:"center", display:"inline-block" }}>{rank}</span>
}

function RankingCard({ title, icon, data, valueKey, valueFormat, color }) {
  const sorted = [...data].sort((a,b) => (b[valueKey]||0) - (a[valueKey]||0)).filter(s => (s[valueKey]||0) > 0)
  return (
    <div className="card" style={{ padding:"1.25rem" }}>
      <div style={{ fontSize:"0.72rem", fontWeight:700, color, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"0.75rem" }}>{icon} {title}</div>
      {sorted.length === 0 ? (
        <div style={{ fontSize:"0.72rem", color:"var(--dim2)", padding:"0.5rem 0" }}>データなし</div>
      ) : sorted.map((s, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.5rem 0", borderBottom: i < sorted.length-1 ? "1px solid var(--rim)" : "none" }}>
          <RankBadge rank={i+1} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:"0.78rem", fontWeight:700, color:"var(--text)" }}>{s.name || s.email}</div>
            <div style={{ fontSize:"0.6rem", color:"var(--dim2)" }}>{s.email}</div>
          </div>
          <div style={{ fontSize:"1rem", fontWeight:900, color: i===0?color:i===1?"var(--text)":"var(--dim2)" }}>
            {valueFormat(s[valueKey]||0)}
          </div>
          {i === 0 && <span style={{ fontSize:"0.7rem" }}>👑</span>}
        </div>
      ))}
    </div>
  )
}

const ROLES = [
  { value:"participant", label:"受講生", color:"var(--blue2)", bg:"rgba(59,130,246,0.12)" },
  { value:"support",     label:"サポート講師", color:"#a78bfa", bg:"rgba(167,139,250,0.12)" },
]

const PAGE_LABELS = {
  dashboard:"Dashboard", actionlog:"ShopeeDiary", analyzer:"ShopeeAnalyzer",
  shopee:"ShopeeManager", inventory:"StockManager", requests:"PasabuyManager",
  massupdate:"MassUpdate", accounthealth:"アカウントヘルス"
}

function UserCard({ student: s, allStudents, onRefresh }) {
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState(s.role || "participant")
  const [active, setActive] = useState(s.active !== false)
  const [assigned, setAssigned] = useState(s.assigned_students || [])
  const [pagePerms, setPagePerms] = useState(s.page_permissions || {})
  const [expanded, setExpanded] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const { db } = await import("../lib/firebase")
      const { doc, setDoc } = await import("firebase/firestore")
      await setDoc(doc(db, "allowed_emails", s.email), {
        active,
        role,
        assigned_students: role === "support" ? assigned : [],
        page_permissions: role === "participant" ? pagePerms : {},
      }, { merge: true })
      onRefresh()
    } catch(e) { alert("保存エラー: " + e.message) }
    setSaving(false)
  }

  function toggleAssigned(uid) {
    setAssigned(prev => prev.includes(uid) ? prev.filter(u=>u!==uid) : [...prev, uid])
  }

  function togglePagePerm(pageId) {
    const cur = pagePerms[pageId] || "edit"
    const next = cur === "edit" ? "view" : cur === "view" ? "none" : "edit"
    setPagePerms(prev => ({ ...prev, [pageId]: next }))
  }

  const roleInfo = ROLES.find(r=>r.value===role) || ROLES[0]

  return (
    <div className="card" style={{ padding:"1.25rem" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom: expanded?"1rem":"0" }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
            <span style={{ fontWeight:700, color:"var(--text)", fontSize:"0.82rem" }}>{s.name||"—"}</span>
            <span style={{ padding:"0.15rem 0.5rem", borderRadius:10, fontSize:"0.6rem", fontWeight:700, background:roleInfo.bg, color:roleInfo.color }}>{roleInfo.label}</span>
            <span style={{ padding:"0.15rem 0.5rem", borderRadius:10, fontSize:"0.6rem", fontWeight:700,
              background:active?"rgba(34,197,94,0.12)":"rgba(239,68,68,0.12)",
              color:active?"var(--green)":"var(--red)" }}>{active?"✅ 有効":"🚫 停止"}</span>
          </div>
          <div style={{ fontSize:"0.62rem", color:"var(--dim2)", marginTop:"0.15rem" }}>{s.email}</div>
          <div style={{ fontSize:"0.6rem", color:"var(--dim2)", fontFamily:"monospace" }}>{s.uid?s.uid.slice(0,16)+"…":"未ログイン"}</div>
        </div>
        <button onClick={()=>setExpanded(o=>!o)} style={{ padding:"0.35rem 0.75rem", borderRadius:6, border:"1px solid var(--rim)", background:"transparent", color:"var(--dim2)", fontSize:"0.72rem", cursor:"pointer" }}>
          {expanded?"▲ 閉じる":"⚙️ 編集"}
        </button>
      </div>

      {expanded && (
        <div style={{ borderTop:"1px solid var(--rim)", paddingTop:"1rem", display:"flex", flexDirection:"column", gap:"1rem" }}>
          {/* ログイン許可 */}
          <div>
            <div style={{ fontSize:"0.65rem", fontWeight:700, color:"var(--dim2)", marginBottom:"0.5rem" }}>🔐 ログイン許可</div>
            <label style={{ display:"flex", alignItems:"center", gap:"0.5rem", cursor:"pointer" }}>
              <input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} style={{ accentColor:"var(--green)", width:15, height:15 }} />
              <span style={{ fontSize:"0.78rem", color:"var(--text)" }}>ログインを許可する</span>
            </label>
          </div>

          {/* ロール */}
          <div>
            <div style={{ fontSize:"0.65rem", fontWeight:700, color:"var(--dim2)", marginBottom:"0.5rem" }}>👤 ロール</div>
            <div style={{ display:"flex", gap:"0.5rem" }}>
              {ROLES.map(r => (
                <button key={r.value} onClick={()=>setRole(r.value)} style={{
                  padding:"0.4rem 1rem", borderRadius:8, border:`1px solid ${role===r.value?r.color:"var(--rim)"}`,
                  background:role===r.value?r.bg:"transparent", color:role===r.value?r.color:"var(--dim2)",
                  fontSize:"0.72rem", fontWeight:700, cursor:"pointer"
                }}>{r.label}</button>
              ))}
            </div>
          </div>

          {/* サポート講師：担当受講生割り当て */}
          {role === "support" && (
            <div>
              <div style={{ fontSize:"0.65rem", fontWeight:700, color:"var(--dim2)", marginBottom:"0.5rem" }}>🎓 担当受講生</div>
              <div style={{ display:"flex", flexDirection:"column", gap:"0.35rem" }}>
                {allStudents.filter(st=>st.email!==s.email).map((st,j) => (
                  <label key={j} style={{ display:"flex", alignItems:"center", gap:"0.5rem", cursor:"pointer", padding:"0.4rem 0.5rem", borderRadius:6, background:assigned.includes(st.uid||st.email)?"rgba(167,139,250,0.06)":"transparent" }}>
                    <input type="checkbox"
                      checked={assigned.includes(st.uid||st.email)}
                      onChange={()=>toggleAssigned(st.uid||st.email)}
                      style={{ accentColor:"#a78bfa", width:14, height:14 }} />
                    <span style={{ fontSize:"0.75rem", color:"var(--text)" }}>{st.name||st.email}</span>
                    <span style={{ fontSize:"0.6rem", color:"var(--dim2)" }}>{st.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 受講生：ページ権限 */}
          {role === "participant" && (
            <div>
              <div style={{ fontSize:"0.65rem", fontWeight:700, color:"var(--dim2)", marginBottom:"0.5rem" }}>📄 ページ権限</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"0.35rem" }}>
                {Object.entries(PAGE_LABELS).map(([pageId, label]) => {
                  const perm = pagePerms[pageId] || "edit"
                  const color = perm==="edit"?"var(--green)":perm==="view"?"var(--blue2)":"var(--red)"
                  const bg = perm==="edit"?"rgba(34,197,94,0.08)":perm==="view"?"rgba(59,130,246,0.08)":"rgba(239,68,68,0.08)"
                  return (
                    <button key={pageId} onClick={()=>togglePagePerm(pageId)} style={{
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"0.4rem 0.6rem", borderRadius:6, border:`1px solid ${color}33`,
                      background:bg, cursor:"pointer", fontSize:"0.72rem"
                    }}>
                      <span style={{ color:"var(--text)", fontWeight:600 }}>{label}</span>
                      <span style={{ color, fontWeight:700, fontSize:"0.65rem" }}>
                        {perm==="edit"?"✏️ 編集":perm==="view"?"👁️ 閲覧":"🚫 非表示"}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div style={{ fontSize:"0.6rem", color:"var(--dim2)", marginTop:"0.5rem" }}>クリックで 編集→閲覧→非表示 と切り替わります</div>
            </div>
          )}

          <button onClick={save} disabled={saving} style={{ padding:"0.5rem 1.25rem", borderRadius:8, border:"none", background:"var(--orange)", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:"0.78rem", alignSelf:"flex-start" }}>
            {saving?"保存中...":"💾 保存"}
          </button>
        </div>
      )}
    </div>
  )
}

export default function CockpitPage() {
  const [tab, setTab] = useState("progress")
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [userSettings, setUserSettings] = useState({})

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const allowedSnap = await getDocs(collection(db, "allowed_emails"))
      const allUsers = allowedSnap.docs
        .map(d => ({ email: d.id, ...d.data() }))
        .filter(u => !INSTRUCTOR_EMAILS.map(e=>e.toLowerCase()).includes(u.email.toLowerCase()))

      const settingsSnap = await getDocs(collection(db, "user_settings"))
      const settingsMap = {}
      settingsSnap.docs.forEach(d => { settingsMap[d.id] = d.data() })
      setUserSettings(settingsMap)

      const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
      const jstToday = jstNow.toISOString().slice(0, 10)
      const jstYesterday = new Date(jstNow.getTime() - 24*60*60*1000).toISOString().slice(0, 10)
      const thisMonth = jstToday.slice(0, 7)
      const dayOfMonth = parseInt(jstToday.slice(8, 10))

      // action_logsを一括取得
      const diarySnap = await getDocs(query(collection(db, "action_logs"), orderBy("date", "desc"), limit(300)))
      const allDiary = diarySnap.docs.map(d => d.data())

      const results = await Promise.all(allUsers.map(async (u) => {
        const uid = u.uid || null
        let monthlySales=0, monthlyOrders=0, streak=0, lastDate=null, recordedToday=false, diaryRate=0

        if (uid) {
          const diaryDocs = allDiary
            .filter(d => d.uid === uid)
            .sort((a,b) => b.date.localeCompare(a.date))

          const monthDiary = diaryDocs.filter(d => d.date?.startsWith(thisMonth))
          monthlySales = monthDiary.reduce((s,d) => s+(parseFloat(d.sales_jpy)||0), 0)
          monthlyOrders = monthDiary.reduce((s,d) => s+(parseInt(d.orders)||0), 0)

          // 連続記録
          for (let i=0; i<30; i++) {
            const d = new Date(jstNow); d.setDate(d.getDate()-i)
            const key = d.toISOString().slice(0,10)
            if (diaryDocs.some(r=>r.date===key)) streak++
            else break
          }

          // 記録率（今月の記録日数/経過日数）
          const recordedDays = monthDiary.length
          diaryRate = dayOfMonth > 0 ? Math.round((recordedDays / dayOfMonth) * 100) : 0

          recordedToday = diaryDocs.some(d=>d.date===jstYesterday)
          lastDate = diaryDocs[0]?.date || null
        }

        const settings = uid ? (settingsMap[uid]||{}) : {}
        return {
          ...u, uid, monthlySales, monthlyOrders, streak, lastDate,
          recordedToday, diaryRate,
          staffEmails: settings.staff_emails||[],
          staffPerms: settings.staff_permissions||{}
        }
      }))

      setStudents(results.filter(Boolean))
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  async function toggleAccess(email, currentActive) {
    if (!window.confirm(`${email} のログイン${currentActive?"を停止":"を許可"}しますか？`)) return
    await setDoc(doc(db, "allowed_emails", email), { active: !currentActive }, { merge: true })
    loadAll()
  }

  const [showAddUser, setShowAddUser] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [newName, setNewName] = useState("")
  const [newRole, setNewRole] = useState("participant")
  const [addingUser, setAddingUser] = useState(false)

  async function addNewUser() {
    if (!newEmail) return alert("メールアドレスを入力してください")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return alert("メールアドレスの形式が正しくありません")
    setAddingUser(true)
    try {
      const { db } = await import("../lib/firebase")
      const { doc, setDoc, getDoc } = await import("firebase/firestore")
      const ref = doc(db, "allowed_emails", newEmail.toLowerCase())
      const snap = await getDoc(ref)
      if (snap.exists()) { alert("このメールアドレスはすでに登録されています"); setAddingUser(false); return }
      await setDoc(ref, {
        name: newName || "",
        role: newRole,
        active: true,
        page_permissions: {},
        assigned_students: [],
        createdAt: new Date().toISOString(),
      })
      alert("✅ " + newEmail + " を登録しました！")
      setNewEmail(""); setNewName(""); setNewRole("participant")
      setShowAddUser(false)
      loadAll()
    } catch(e) { alert("登録エラー: " + e.message) }
    setAddingUser(false)
  }

  const TABS = [
    { id:"progress", label:"📊 進捗" },
    { id:"ranking",  label:"🏆 ランキング" },
    { id:"users",    label:"👥 ユーザー管理" },
    { id:"staff",    label:"🔑 スタッフ管理" },
  ]

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", flexDirection:"column", gap:"1rem" }}>
      <div style={{ width:36, height:36, border:"3px solid rgba(255,255,255,0.1)", borderTopColor:"var(--orange)", borderRadius:"50%", animation:"spin 0.75s linear infinite" }} />
      <div style={{ fontSize:"0.78rem", color:"var(--dim2)" }}>データを読み込み中...</div>
    </div>
  )

  return (
    <div style={{ maxWidth:1000, margin:"0 auto", padding:"1.5rem" }}>
      <div style={{ marginBottom:"1.25rem" }}>
        <div style={{ fontSize:"0.7rem", fontWeight:700, color:"var(--orange)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"0.25rem" }}>🎓 講師コクピット</div>
        <div style={{ fontSize:"0.78rem", color:"var(--dim2)" }}>受講生 {students.length}名 の管理ダッシュボード</div>
      </div>

      <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.5rem", borderBottom:"1px solid var(--rim)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"0.5rem 1rem", border:"none", background:"transparent", cursor:"pointer",
            fontSize:"0.78rem", fontWeight:tab===t.id?800:600,
            color:tab===t.id?"var(--orange)":"var(--dim2)",
            borderBottom:tab===t.id?"2px solid var(--orange)":"2px solid transparent",
            marginBottom:"-1px", transition:"all 0.15s"
          }}>{t.label}</button>
        ))}
        <button onClick={loadAll} style={{ marginLeft:"auto", padding:"0.4rem 0.75rem", border:"1px solid var(--rim)", borderRadius:6, background:"transparent", color:"var(--dim2)", fontSize:"0.72rem", cursor:"pointer" }}>🔄 更新</button>
      </div>

      {/* 📊 進捗タブ */}
      {tab === "progress" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"0.75rem", marginBottom:"1.5rem" }}>
            {[
              { label:"受講生数", value:`${students.length}名`, icon:"👥", color:"var(--blue2)" },
              { label:"今日記録済み", value:`${students.filter(s=>s.recordedToday).length}名`, icon:"✅", color:"var(--green)" },
              { label:"今日未記録", value:`${students.filter(s=>!s.recordedToday).length}名`, icon:"⚠️", color:"var(--red)" },
            ].map((c,i) => (
              <div key={i} className="card" style={{ padding:"1rem", textAlign:"center" }}>
                <div style={{ fontSize:"1.5rem", marginBottom:"0.25rem" }}>{c.icon}</div>
                <div style={{ fontSize:"1.4rem", fontWeight:900, color:c.color }}>{c.value}</div>
                <div style={{ fontSize:"0.65rem", color:"var(--dim2)", marginTop:"0.15rem" }}>{c.label}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding:"1.25rem" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.78rem" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid var(--rim)" }}>
                  {["受講生","前日の記録","連続記録","記録率","今月売上(¥)","今月注文数","最終記録日"].map((h,i) => (
                    <th key={i} style={{ padding:"0.5rem 0.75rem", textAlign:i===0?"left":"center", fontSize:"0.65rem", color:"var(--dim2)", fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s,i) => (
                  <tr key={i} style={{ borderBottom:"1px solid var(--rim)" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"0.75rem" }}>
                      <div style={{ fontWeight:700, color:"var(--text)" }}>{s.name||s.email}</div>
                      <div style={{ fontSize:"0.62rem", color:"var(--dim2)" }}>{s.email}</div>
                    </td>
                    <td style={{ textAlign:"center", padding:"0.75rem" }}>
                      <span style={{ padding:"0.2rem 0.6rem", borderRadius:20, fontSize:"0.65rem", fontWeight:700,
                        background:s.recordedToday?"rgba(34,197,94,0.12)":"rgba(239,68,68,0.12)",
                        color:s.recordedToday?"var(--green)":"var(--red)" }}>
                        {s.recordedToday?"✅ 済":"⚠️ 未"}
                      </span>
                    </td>
                    <td style={{ textAlign:"center", padding:"0.75rem", fontWeight:900, color:s.streak>=7?"var(--orange)":s.streak>=3?"var(--text)":"var(--dim2)" }}>
                      {s.streak}日{s.streak>=7?" 🔥":""}
                    </td>
                    <td style={{ textAlign:"center", padding:"0.75rem" }}>
                      <span style={{ fontWeight:700, color:s.diaryRate>=80?"var(--green)":s.diaryRate>=50?"var(--yellow)":"var(--red)" }}>
                        {s.diaryRate}%
                      </span>
                    </td>
                    <td style={{ textAlign:"center", padding:"0.75rem", fontWeight:700, color:s.monthlySales>0?"var(--text)":"var(--dim2)" }}>
                      {s.monthlySales>0?`¥${s.monthlySales.toLocaleString()}`:"—"}
                    </td>
                    <td style={{ textAlign:"center", padding:"0.75rem", fontWeight:700, color:s.monthlyOrders>0?"var(--text)":"var(--dim2)" }}>
                      {s.monthlyOrders>0?`${s.monthlyOrders}件`:"—"}
                    </td>
                    <td style={{ textAlign:"center", padding:"0.75rem", fontSize:"0.72rem", color:"var(--dim2)", fontFamily:"monospace" }}>
                      {s.lastDate||"—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🏆 ランキングタブ */}
      {tab === "ranking" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"1rem" }}>
          <RankingCard title="今月売上ランキング" icon="💰" data={students} valueKey="monthlySales" valueFormat={v=>`¥${v.toLocaleString()}`} color="var(--orange)" />
          <RankingCard title="今月注文数ランキング" icon="📦" data={students} valueKey="monthlyOrders" valueFormat={v=>`${v}件`} color="var(--blue2)" />
          <RankingCard title="連続記録日数ランキング" icon="🔥" data={students} valueKey="streak" valueFormat={v=>`${v}日`} color="#f97316" />
          <RankingCard title="Diary記録率ランキング" icon="📅" data={students} valueKey="diaryRate" valueFormat={v=>`${v}%`} color="var(--green)" />
        </div>
      )}

      {/* 👥 ユーザー管理タブ */}
      {tab === "users" && (
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          {/* 新規ユーザー登録 */}
          <div className="card" style={{ padding:"1rem 1.25rem" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:700, fontSize:"0.85rem" }}>👤 新規ユーザー登録</div>
              <button onClick={() => setShowAddUser(!showAddUser)}
                style={{ padding:"0.4rem 1rem", borderRadius:8, border:"none", background:showAddUser?"var(--rim)":"var(--orange)", color:"#fff", fontSize:"0.78rem", fontWeight:700, cursor:"pointer" }}>
                {showAddUser ? "キャンセル" : "＋ 新規登録"}
              </button>
            </div>
            {showAddUser && (
              <div style={{ marginTop:"1rem", display:"flex", flexDirection:"column", gap:"0.75rem" }}>
                <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1fr", gap:"0.75rem" }}>
                  <div>
                    <label style={{ fontSize:"0.62rem", fontWeight:700, color:"var(--dim2)", display:"block", marginBottom:"0.25rem" }}>メールアドレス *</label>
                    <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="example@gmail.com"
                      style={{ width:"100%", padding:"0.5rem 0.7rem", borderRadius:8, border:"1px solid var(--rim)", background:"var(--surface)", color:"var(--text)", fontSize:"0.85rem", boxSizing:"border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize:"0.62rem", fontWeight:700, color:"var(--dim2)", display:"block", marginBottom:"0.25rem" }}>名前</label>
                    <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="山田太郎"
                      style={{ width:"100%", padding:"0.5rem 0.7rem", borderRadius:8, border:"1px solid var(--rim)", background:"var(--surface)", color:"var(--text)", fontSize:"0.85rem", boxSizing:"border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize:"0.62rem", fontWeight:700, color:"var(--dim2)", display:"block", marginBottom:"0.25rem" }}>ロール</label>
                    <select value={newRole} onChange={e=>setNewRole(e.target.value)}
                      style={{ width:"100%", padding:"0.5rem 0.7rem", borderRadius:8, border:"1px solid var(--rim)", background:"var(--surface)", color:"var(--text)", fontSize:"0.85rem" }}>
                      <option value="participant">受講生</option>
                      <option value="support">スタッフ</option>
                    </select>
                  </div>
                </div>
                <div style={{ fontSize:"0.68rem", color:"var(--dim2)", background:"rgba(255,255,255,0.03)", padding:"0.5rem 0.75rem", borderRadius:8 }}>
                  ⚠️ 登録後、ユーザーはこのメールアドレスでGoogleログインするとアクセスできます
                </div>
                <button onClick={addNewUser} disabled={addingUser}
                  style={{ padding:"0.55rem 1.5rem", borderRadius:8, border:"none", background:"var(--orange)", color:"#fff", fontSize:"0.82rem", fontWeight:700, cursor:addingUser?"not-allowed":"pointer", opacity:addingUser?0.7:1, alignSelf:"flex-start" }}>
                  {addingUser ? "登録中..." : "✅ 登録する"}
                </button>
              </div>
            )}
          </div>

          {students.map((s,i) => (
            <UserCard key={i} student={s} allStudents={students} onRefresh={loadAll} />
          ))}
        </div>
      )}

      {/* 🔑 スタッフ管理タブ */}
      {tab === "staff" && (
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          {students.map((s,i) => (
            <div key={i} className="card" style={{ padding:"1.25rem" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.75rem" }}>
                <div>
                  <div style={{ fontWeight:700, color:"var(--text)", fontSize:"0.82rem" }}>{s.name||s.email}</div>
                  <div style={{ fontSize:"0.62rem", color:"var(--dim2)" }}>{s.email}</div>
                </div>
                <span style={{ fontSize:"0.7rem", color:"var(--dim2)" }}>スタッフ {s.staffEmails.length}名</span>
              </div>
              {s.staffEmails.length === 0 ? (
                <div style={{ fontSize:"0.72rem", color:"var(--dim2)", padding:"0.5rem 0" }}>スタッフ未登録</div>
              ) : (
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.72rem" }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid var(--rim)" }}>
                      {["スタッフメール","権限サマリー"].map((h,j) => (
                        <th key={j} style={{ padding:"0.4rem 0.75rem", textAlign:j===0?"left":"center", fontSize:"0.6rem", color:"var(--dim2)", fontWeight:700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.staffEmails.map((email,j) => {
                      const perms = s.staffPerms[email.toLowerCase()]||{}
                      const editCount = Object.values(perms).filter(v=>v==="edit").length
                      const viewCount = Object.values(perms).filter(v=>v==="view").length
                      const noneCount = Object.values(perms).filter(v=>v==="none").length
                      return (
                        <tr key={j} style={{ borderBottom:"1px solid var(--rim)" }}>
                          <td style={{ padding:"0.5rem 0.75rem", color:"var(--text)" }}>{email}</td>
                          <td style={{ padding:"0.5rem 0.75rem", textAlign:"center" }}>
                            <div style={{ display:"flex", gap:"0.4rem", justifyContent:"center" }}>
                              <span style={{ padding:"0.15rem 0.5rem", borderRadius:10, fontSize:"0.6rem", fontWeight:700, background:"rgba(34,197,94,0.12)", color:"var(--green)" }}>編集 {editCount}</span>
                              <span style={{ padding:"0.15rem 0.5rem", borderRadius:10, fontSize:"0.6rem", fontWeight:700, background:"rgba(96,165,250,0.12)", color:"var(--blue2)" }}>閲覧 {viewCount}</span>
                              <span style={{ padding:"0.15rem 0.5rem", borderRadius:10, fontSize:"0.6rem", fontWeight:700, background:"rgba(239,68,68,0.12)", color:"var(--red)" }}>非表示 {noneCount}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
