import { useState, useEffect } from "react"

export default function InventoryPage({ uid }) {
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
