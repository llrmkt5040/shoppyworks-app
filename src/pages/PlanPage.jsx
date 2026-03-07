import { useState, useEffect } from "react"
import { db, auth } from "../lib/firebase"
import { collection, addDoc, query, where, getDocs, doc, updateDoc } from "firebase/firestore"

const TIME_BLOCKS = [
  { label: "早朝", times: ["5:00","5:15","5:30","5:45","6:00","6:15","6:30","6:45","7:00","7:15","7:30","7:45","8:00","8:15","8:30","8:45"] },
  { label: "コアタイム", times: ["9:00","9:15","9:30","9:45","10:00","10:15","10:30","10:45","11:00","11:15","11:30","11:45","12:00","12:15","12:30","12:45","13:00","13:15","13:30","13:45"] },
  { label: "フリータイム", times: ["14:00","14:15","14:30","14:45","15:00","15:15","15:30","15:45","16:00","16:15","16:30","16:45","17:00","17:15","17:30","17:45"] },
  { label: "プライベート", times: ["18:00","18:15","18:30","18:45","19:00","19:15","19:30","19:45","20:00","20:15","20:30","20:45","21:00","21:15","21:30","21:45"] },
  { label: "就寝前", times: ["22:00","22:15","22:30","22:45","23:00","23:15","23:30","23:45","0:00"] },
]

const CATEGORIES = ["","本業時間","生活時間","学習時間","副業時間"]
const SHOPPYWORKS = ["","出品作業","改修作業","リサーチ","分析業務","仕入作業","出荷作業","顧客対応","関連なし"]
const SALES_DIRECT = ["","直結","間接","作業不可"]
const MATRIX = ["","第一象限","第二象限","第三象限","第四象限"]
const OUTSOURCE = ["","外注可能","自分しか出来ない"]

const ALL_TIMES = TIME_BLOCKS.flatMap(b => b.times)
const emptyRow = (time) => ({ time, plan:"", result:"", category:"", shoppyworks:"", sales_direct:"", matrix:"", outsource:"", memo:"" })

export default function PlanPage() {
  const [date, setDate] = useState(() => new Date(Date.now()+86400000).toISOString().split("T")[0])
  const [rows, setRows] = useState(() => ALL_TIMES.map(emptyRow))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [existingId, setExistingId] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadPlan(date) }, [date])

  async function loadPlan(d) {
    setLoading(true)
    try {
      const q = query(collection(db,"daily_plans"), where("uid","==",auth.currentUser?.uid), where("date","==",d))
      const snap = await getDocs(q)
      if (!snap.empty) {
        const data = snap.docs[0].data()
        setExistingId(snap.docs[0].id)
        setRows(ALL_TIMES.map(t => (data.rows||[]).find(r=>r.time===t) || emptyRow(t)))
      } else {
        setExistingId(null)
        setRows(ALL_TIMES.map(emptyRow))
      }
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  function updateRow(time, field, value) {
    setRows(rows => rows.map(r => r.time===time ? {...r,[field]:value} : r))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = { date, rows, uid:auth.currentUser?.uid, email:auth.currentUser?.email, updatedAt:new Date().toISOString() }
      if (existingId) { await updateDoc(doc(db,"daily_plans",existingId), payload) }
      else { const ref = await addDoc(collection(db,"daily_plans"), payload); setExistingId(ref.id) }
      setSaved(true); setTimeout(()=>setSaved(false),3000)
    } catch(e) { alert("保存エラー: "+e.message) }
    setSaving(false)
  }

  const iStyle = {width:"100%",background:"transparent",border:"none",color:"var(--text)",fontSize:"0.73rem",padding:"2px 4px",outline:"none"}
  const sStyle = {width:"100%",background:"transparent",border:"none",color:"var(--text)",fontSize:"0.7rem",padding:"2px",outline:"none",cursor:"pointer"}
  const tdStyle = {padding:"0 4px",borderRight:"1px solid rgba(255,255,255,0.06)",fontSize:"0.73rem"}

  return (
    <div style={{maxWidth:1200,margin:"0 auto",padding:"1.5rem"}}>
      <div style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"1.5rem",flexWrap:"wrap"}}>
        <h2 style={{fontFamily:"Bebas Neue,sans-serif",fontSize:"1.8rem",letterSpacing:"0.04em",margin:0}}>📋 行動計画</h2>
        <div>
          <label style={{fontSize:"0.72rem",color:"var(--dim2)",marginRight:"0.5rem"}}>計画日</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            style={{padding:"0.4rem 0.6rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--surface)",color:"var(--text)",fontSize:"0.85rem"}} />
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{marginLeft:"auto",padding:"0.5rem 1.5rem",borderRadius:8,border:"none",background:saved?"var(--green)":"var(--orange)",color:"#fff",fontSize:"0.85rem",fontWeight:900,cursor:"pointer",transition:"all 0.3s"}}>
          {saving?"保存中..":saved?"✅ 保存済み":"💾 保存する"}
        </button>
      </div>
      {loading ? <div style={{textAlign:"center",padding:"3rem",color:"var(--dim2)"}}>読み込み中...</div> : (
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.73rem"}}>
            <thead>
              <tr style={{background:"var(--surface)",borderBottom:"2px solid var(--orange)"}}>
                {["時間帯","時間","行動計画","行動結果","大カテゴリ","ShoppyWorks","売上直結","マトリクス","外注化","改善点・気づき"].map((h,i) => (
                  <th key={i} style={{padding:"0.5rem",textAlign:"left",fontSize:"0.65rem",color:"var(--orange)",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_BLOCKS.map(block => block.times.map((time, ti) => {
                const row = rows.find(r=>r.time===time) || emptyRow(time)
                return (
                  <tr key={time} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:ti===0?"rgba(255,107,43,0.05)":"transparent"}}>
                    {ti===0 && <td rowSpan={block.times.length} style={{padding:"0.4rem 0.5rem",borderRight:"2px solid var(--orange)",verticalAlign:"middle",fontFamily:"Bebas Neue,sans-serif",fontSize:"0.8rem",color:"var(--orange)",whiteSpace:"nowrap",textAlign:"center"}}>{block.label}</td>}
                    <td style={{...tdStyle,color:"var(--dim2)",fontWeight:700,whiteSpace:"nowrap"}}>{time}</td>
                    <td style={tdStyle}><input style={iStyle} value={row.plan} onChange={e=>updateRow(time,"plan",e.target.value)} placeholder="計画..." /></td>
                    <td style={tdStyle}><input style={{...iStyle,color:row.result?"var(--green)":"var(--text)"}} value={row.result} onChange={e=>updateRow(time,"result",e.target.value)} placeholder="結果..." /></td>
                    <td style={tdStyle}><select style={sStyle} value={row.category} onChange={e=>updateRow(time,"category",e.target.value)}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></td>
                    <td style={tdStyle}><select style={sStyle} value={row.shoppyworks} onChange={e=>updateRow(time,"shoppyworks",e.target.value)}>{SHOPPYWORKS.map(c=><option key={c} value={c}>{c}</option>)}</select></td>
                    <td style={tdStyle}><select style={sStyle} value={row.sales_direct} onChange={e=>updateRow(time,"sales_direct",e.target.value)}>{SALES_DIRECT.map(c=><option key={c} value={c}>{c}</option>)}</select></td>
                    <td style={tdStyle}><select style={sStyle} value={row.matrix} onChange={e=>updateRow(time,"matrix",e.target.value)}>{MATRIX.map(c=><option key={c} value={c}>{c}</option>)}</select></td>
                    <td style={tdStyle}><select style={sStyle} value={row.outsource} onChange={e=>updateRow(time,"outsource",e.target.value)}>{OUTSOURCE.map(c=><option key={c} value={c}>{c}</option>)}</select></td>
                    <td style={{...tdStyle,borderRight:"none"}}><input style={iStyle} value={row.memo} onChange={e=>updateRow(time,"memo",e.target.value)} placeholder="メモ..." /></td>
                  </tr>
                )
              }))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
