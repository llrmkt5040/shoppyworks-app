import { useState, useEffect } from "react"

export default function InventoryPage({ uid }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newItem, setNewItem] = useState({ name:"", qty:"", cost:"", costPhp:"", sku:"", supplier:"", memo:"" })
  const [orderSkus, setOrderSkus] = useState([]) // オーダーレポートから取得したSKU一覧
  const [editItem, setEditItem] = useState(null) // 編集中のアイテム
  const [fxRate, setFxRate] = useState(0) // 為替レート(¥/₱)
  const [orderMap, setOrderMap] = useState({}) // SKU→出荷数マップ

  useEffect(() => { loadItems(); loadOrderSkus(); loadFxRate(); loadOrderMap() }, [])

  async function loadFxRate() {
    try {
      const { db, auth } = await import("../lib/firebase")
      const { doc, getDoc } = await import("firebase/firestore")
      const uid = auth.currentUser?.uid
      if (!uid) return
      const snap = await getDoc(doc(db, "fx_rates", uid))
      if (snap.exists()) {
        const data = snap.data()
        console.log("fx_rates data:", JSON.stringify(data))
        const rate = Number(data.rate_php_jpy) || 0
        console.log("fxRate set to:", rate)
        setFxRate(rate)
      } else {
        console.log("fx_rates: ドキュメントなし uid=", uid)
      }
    } catch(e) { console.warn("為替レート取得失敗", e) }
  }

  async function loadOrderMap() {
    try {
      if (!uid) { console.log("loadOrderMap: uid なし"); return }
      console.log("loadOrderMap: uid=", uid)
      const { db } = await import("../lib/firebase")
      const { collection, getDocs } = await import("firebase/firestore")
      // whereなしで全件取得してフィルタ
      const snap = await getDocs(collection(db, "shopee_orders"))
      const myDocs = snap.docs.filter(d => d.data().userId === uid)
      const map = {}
      myDocs.forEach(d => {
        const orders = d.data().orders || []
        orders.forEach(o => {
          const sku = o["sku"] || o["Parent SKU Reference No."] || ""
          const status = o["status"] || o["Order Status"] || ""
          const qty = Number(o["qty"] || o["Quantity"] || 1)
          if (sku && status !== "Cancelled" && status !== "Unpaid") {
            map[sku] = (map[sku] || 0) + qty
          }
        })
      })
      setOrderMap(map)
    } catch(e) { console.warn("オーダーマップ取得失敗", e) }
  }

  async function loadItems() {
    setLoading(true)
    try {
      const { db } = await import("../lib/firebase")
      const { collection, query, where, getDocs } = await import("firebase/firestore")
      const q = query(collection(db, "inventory_items"), where("uid","==",uid))
      const snap = await getDocs(q)
      const list = snap.docs.map(d => ({ id:d.id, ...d.data() }))
      list.sort((a,b) => (b.createdAt||"").localeCompare(a.createdAt||""))
      setItems(list)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  async function loadOrderSkus() {
    try {
      const { db } = await import("../lib/firebase")
      const { collection, query, where, getDocs } = await import("firebase/firestore")
      const snap = await getDocs(query(collection(db,"shopee_orders"), where("userId","==",uid)))
      if (snap.empty) return
      const latest = snap.docs.sort((a,b)=>(b.data().uploadedAt?.seconds||0)-(a.data().uploadedAt?.seconds||0))[0].data()
      const orders = latest.orders || []
      // SKU・商品名の一覧を重複排除して取得
      const skuMap = {}
      orders.forEach(o => {
        if (o.sku && !skuMap[o.sku]) skuMap[o.sku] = o.product
      })
      setOrderSkus(Object.entries(skuMap).map(([sku, name]) => ({ sku, name })))
    } catch(e) { console.error(e) }
  }

  async function addItem() {
    if (!newItem.name) return
    try {
      const { db } = await import("../lib/firebase")
      const { collection, addDoc } = await import("firebase/firestore")
      await addDoc(collection(db,"inventory_items"), {
        ...newItem, uid,
        qty: Number(newItem.qty)||0,
        cost: Number(newItem.cost)||0,
        costPhp: Number(newItem.costPhp)||0,
        sku: newItem.sku||"",
        supplier: newItem.supplier||"",
        createdAt: new Date().toISOString()
      })
      setNewItem({ name:"", qty:"", cost:"", costPhp:"", sku:"", supplier:"", memo:"" })
      setShowForm(false)
      loadItems()
    loadFxRate()
    loadOrderMap()
    } catch(e) { alert("追加エラー: " + e.message) }
  }

  async function updateItem() {
    if (!editItem || !editItem.name) return
    try {
      const { db } = await import("../lib/firebase")
      const { doc, updateDoc } = await import("firebase/firestore")
      await updateDoc(doc(db,"inventory_items",editItem.id), {
        name: editItem.name,
        qty: Number(editItem.qty)||0,
        cost: Number(editItem.cost)||0,
        costPhp: Number(editItem.costPhp)||0,
        sku: editItem.sku||"",
        supplier: editItem.supplier||"",
        memo: editItem.memo||"",
      })
      setEditItem(null)
      loadItems()
    } catch(e) { alert("更新エラー: " + e.message) }
  }

  async function deleteItem(id) {
    if (!confirm("削除しますか？")) return
    try {
      const { db } = await import("../lib/firebase")
      const { doc, deleteDoc } = await import("firebase/firestore")
      await deleteDoc(doc(db,"inventory_items",id))
      loadItems()
    } catch(e) { alert("削除エラー: " + e.message) }
  }

  // オーダーレポートのSKUを選択したとき商品名を自動入力
  function handleSkuSelect(e) {
    const selected = orderSkus.find(s => s.sku === e.target.value)
    if (selected) {
      setNewItem(n => ({ ...n, sku: selected.sku, name: n.name || selected.name }))
    } else {
      setNewItem(n => ({ ...n, sku: e.target.value }))
    }
  }

  const totalValue = items.reduce((sum,i) => sum + (Number(i.qty)||0)*(Number(i.cost)||0), 0)
  const totalValuePhp = items.reduce((sum,i) => sum + (Number(i.qty)||0)*(Number(i.costPhp)||0), 0)

  const inputStyle = { width:"100%", padding:"0.5rem 0.7rem", borderRadius:8, border:"1px solid var(--rim)", background:"var(--surface)", color:"var(--text)", fontSize:"0.85rem", boxSizing:"border-box" }
  const labelStyle = { fontSize:"0.65rem", fontWeight:700, color:"var(--dim2)", display:"block", marginBottom:"0.25rem" }

  return (
    <div>
      {/* ヘッダー */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
        <div className="card" style={{padding:"0.75rem 1.25rem",display:"inline-flex",gap:"1.5rem",flexWrap:"wrap"}}>
          <span style={{fontSize:"0.72rem",color:"var(--dim2)"}}>商品種類 <strong style={{color:"var(--text)"}}>{items.length}</strong>点</span>
          <span style={{fontSize:"0.72rem",color:"var(--dim2)"}}>在庫総額 <strong style={{color:"var(--orange)"}}>¥{totalValue.toLocaleString()}</strong></span>
          <span style={{fontSize:"0.72rem",color:"var(--dim2)"}}>在庫総額(₱) <strong style={{color:"#22c55e"}}>₱{totalValuePhp.toLocaleString()}</strong></span>
          {orderSkus.length > 0 && (
            <span style={{fontSize:"0.72rem",color:"#3b82f6"}}>📦 オーダーSKU <strong>{orderSkus.length}</strong>件取得済み</span>
          )}
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{padding:"0.5rem 1.2rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontSize:"0.8rem",fontWeight:700,cursor:"pointer"}}>
          + 追加
        </button>
      </div>

      {/* 追加フォーム */}
      {showForm && (
        <div className="card" style={{padding:"1.25rem",marginBottom:"1rem",border:"1px solid rgba(249,115,22,0.3)"}}>

          {/* オーダーレポートからSKU選択 */}
          {orderSkus.length > 0 && (
            <div style={{marginBottom:"0.75rem",padding:"0.75rem",background:"rgba(59,130,246,0.08)",borderRadius:8,border:"1px solid rgba(59,130,246,0.2)"}}>
              <label style={{...labelStyle,color:"#3b82f6"}}>📦 オーダーレポートからSKUを選択（商品名が自動入力されます）</label>
              <select onChange={handleSkuSelect} value={newItem.sku}
                style={{...inputStyle,color:"var(--text)"}}>
                <option value="">-- SKUを選択 --</option>
                {orderSkus.map(s => (
                  <option key={s.sku} value={s.sku}>{s.sku} | {s.name?.slice(0,40)}</option>
                ))}
              </select>
            </div>
          )}

          {/* 行1: 商品名・数量・仕入単価(¥)・仕入単価(₱) */}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:"0.75rem",marginBottom:"0.75rem"}}>
            <div>
              <label style={labelStyle}>商品名 *</label>
              <input value={newItem.name} onChange={e=>setNewItem(n=>({...n,name:e.target.value}))} placeholder="例: DAISOスマホケース" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>数量</label>
              <input type="number" value={newItem.qty} onChange={e=>setNewItem(n=>({...n,qty:e.target.value}))} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>仕入単価 (¥)</label>
              <input type="number" value={newItem.cost} onChange={e=>{const v=e.target.value; setNewItem(n=>({...n,cost:v,costPhp:fxRate>0?(Math.round(Number(v)/fxRate*10)/10).toString():n.costPhp}))}} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={{...labelStyle,color:"#22c55e"}}>仕入単価 (₱) ← 粗利計算用</label>
              <input type="number" value={newItem.costPhp} onChange={e=>setNewItem(n=>({...n,costPhp:e.target.value}))} placeholder={fxRate>0?"¥入力で自動計算":"手動入力"} style={inputStyle} />
            </div>
          </div>

          {/* 行2: SKU・仕入れ先・メモ */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:"0.75rem",marginBottom:"0.75rem"}}>
            <div>
              <label style={labelStyle}>SKU（Order CSV照合用）</label>
              <input value={newItem.sku} onChange={e=>setNewItem(n=>({...n,sku:e.target.value}))} placeholder="例: DAISO-SUPPLE-01" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>仕入れ先</label>
              <input value={newItem.supplier} onChange={e=>setNewItem(n=>({...n,supplier:e.target.value}))} placeholder="例: DAISO卸・LS-System" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>メモ</label>
              <input value={newItem.memo} onChange={e=>setNewItem(n=>({...n,memo:e.target.value}))} placeholder="商品URL、備考など" style={inputStyle} />
            </div>
          </div>

          <div style={{display:"flex",gap:"0.5rem"}}>
            <button onClick={addItem} style={{padding:"0.5rem 1.5rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontSize:"0.8rem",fontWeight:700,cursor:"pointer"}}>保存</button>
            <button onClick={()=>setShowForm(false)} style={{padding:"0.5rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",fontSize:"0.8rem",cursor:"pointer"}}>キャンセル</button>
          </div>
        </div>
      )}

      {/* テーブル */}
      {/* 編集モーダル */}
      {editItem && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"var(--surface)",borderRadius:14,padding:"1.5rem",width:"90%",maxWidth:560,border:"1px solid var(--rim)"}}>
            <div style={{fontWeight:800,fontSize:"1rem",marginBottom:"1rem",color:"var(--text)"}}>✏️ 商品を編集</div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:"0.75rem",marginBottom:"0.75rem"}}>
              {[{key:"name",label:"商品名",type:"text"},{key:"qty",label:"数量",type:"number"},{key:"cost",label:"単価(¥)",type:"number"},{key:"costPhp",label:"仕入(₱)",type:"number"}].map(f=>(
                <div key={f.key}>
                  <label style={{fontSize:"0.65rem",fontWeight:700,color:"var(--dim2)",display:"block",marginBottom:"0.25rem"}}>{f.label}</label>
                  <input type={f.type} value={editItem[f.key]||""} onChange={e=>setEditItem(n=>({...n,[f.key]:e.target.value}))}
                    style={{width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--bg)",color:"var(--text)",fontSize:"0.85rem",boxSizing:"border-box"}} />
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:"0.75rem",marginBottom:"1rem"}}>
              {[{key:"sku",label:"SKU",type:"text"},{key:"supplier",label:"仕入れ先",type:"text"},{key:"memo",label:"メモ",type:"text"}].map(f=>(
                <div key={f.key}>
                  <label style={{fontSize:"0.65rem",fontWeight:700,color:"var(--dim2)",display:"block",marginBottom:"0.25rem"}}>{f.label}</label>
                  <input type={f.type} value={editItem[f.key]||""} onChange={e=>setEditItem(n=>({...n,[f.key]:e.target.value}))}
                    style={{width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,border:"1px solid var(--rim)",background:"var(--bg)",color:"var(--text)",fontSize:"0.85rem",boxSizing:"border-box"}} />
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:"0.5rem"}}>
              <button onClick={updateItem} style={{padding:"0.5rem 1.5rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontSize:"0.8rem",fontWeight:700,cursor:"pointer"}}>💾 保存</button>
              <button onClick={()=>setEditItem(null)} style={{padding:"0.5rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",fontSize:"0.8rem",cursor:"pointer"}}>キャンセル</button>
            </div>
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
                <th style={{padding:"0.75rem 1rem",textAlign:"left",fontWeight:700,color:"var(--dim2)",fontSize:"0.65rem",textTransform:"uppercase"}}>SKU / 仕入先</th>
                <th style={{padding:"0.75rem 1rem",textAlign:"right",fontWeight:700,color:"var(--dim2)",fontSize:"0.65rem",textTransform:"uppercase"}}>数量</th>
                <th style={{padding:"0.75rem 1rem",textAlign:"right",fontWeight:700,color:"var(--dim2)",fontSize:"0.65rem",textTransform:"uppercase"}}>単価(¥)</th>
                <th style={{padding:"0.75rem 1rem",textAlign:"right",fontWeight:700,color:"#22c55e",fontSize:"0.65rem",textTransform:"uppercase"}}>仕入(₱)</th>
                <th style={{padding:"0.75rem 1rem",textAlign:"right",fontWeight:700,color:"#a78bfa",fontSize:"0.65rem",textTransform:"uppercase"}}>現在庫</th>
                <th style={{padding:"0.75rem 1rem",textAlign:"center",fontWeight:700,color:"var(--dim2)",fontSize:"0.65rem",textTransform:"uppercase"}}>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item,i) => (
                <tr key={item.id} style={{borderBottom:"1px solid var(--rim)",background:i%2===0?"transparent":"rgba(255,255,255,0.01)"}}>
                  <td style={{padding:"0.75rem 1rem"}}>
                    <div style={{fontWeight:600}}>{item.name}</div>
                    {item.memo && <div style={{fontSize:"0.68rem",color:"var(--dim2)",marginTop:"0.15rem"}}>{item.memo}</div>}
                  </td>
                  <td style={{padding:"0.75rem 1rem"}}>
                    {item.sku && <div style={{fontSize:"0.72rem",fontFamily:"monospace",color:"#3b82f6",fontWeight:600}}>{item.sku}</div>}
                    {item.supplier && <div style={{fontSize:"0.68rem",color:"var(--dim2)",marginTop:"0.1rem"}}>🏭 {item.supplier}</div>}
                  </td>
                  <td style={{padding:"0.75rem 1rem",textAlign:"right"}}>{Number(item.qty).toLocaleString()}</td>
                  <td style={{padding:"0.75rem 1rem",textAlign:"right"}}>¥{Number(item.cost).toLocaleString()}</td>
                  <td style={{padding:"0.75rem 1rem",textAlign:"right",fontWeight:700,color:"#22c55e"}}>
                    {Number(item.costPhp||0) > 0 ? `₱${Number(item.costPhp).toLocaleString()}` : <span style={{color:"var(--dim2)",fontSize:"0.72rem"}}>未登録</span>}
                  </td>
                  <td style={{padding:"0.75rem 1rem",textAlign:"right"}}>{(()=>{
                    const sold = item.sku ? (orderMap[item.sku]||0) : 0
                    const current = Number(item.qty) - sold
                    const color = current <= 0 ? "#ef4444" : current <= 10 ? "#f59e0b" : "#a78bfa"
                    return <span style={{fontWeight:700,color}}>{current.toLocaleString()}{sold>0 && <span style={{fontSize:"0.65rem",color:"var(--dim2)",marginLeft:4}}>(-{sold})</span>}</span>
                  })()}</td>
                  <td style={{padding:"0.75rem 1rem",textAlign:"center"}}>
                    <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                      <button onClick={()=>setEditItem({...item})} style={{padding:"0.2rem 0.6rem",borderRadius:6,border:"1px solid rgba(59,130,246,0.3)",background:"rgba(59,130,246,0.1)",color:"#3b82f6",fontSize:"0.7rem",cursor:"pointer"}}>編集</button>
                      <button onClick={()=>deleteItem(item.id)} style={{padding:"0.2rem 0.6rem",borderRadius:6,border:"1px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.1)",color:"#ef4444",fontSize:"0.7rem",cursor:"pointer"}}>削除</button>
                    </div>
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
