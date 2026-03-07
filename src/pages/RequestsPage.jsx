import { useState, useEffect } from "react"

export default function RequestsPage({ uid }) {
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
