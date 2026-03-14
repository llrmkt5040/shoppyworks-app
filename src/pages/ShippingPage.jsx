import { useState, useEffect } from "react"

function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--rim)", borderRadius:10, padding:"12px 16px", minWidth:120, flex:1 }}>
      <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>{icon} {label}</div>
      <div style={{ fontSize:20, fontWeight:800, color:color||"#0f172a" }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>{sub}</div>}
    </div>
  )
}

function Badge({ status }) {
  const map = { "To ship":["#fef9c3","#ca8a04"], "Shipping":["#dbeafe","#2563eb"], "Delivered":["#dcfce7","#16a34a"], "Cancelled":["#fee2e2","#dc2626"], "Completed":["#dcfce7","#16a34a"] }
  const [bg,fg] = map[status]||["#f1f5f9","#64748b"]
  return <span style={{ background:bg, color:fg, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{status}</span>
}


export default function ShippingPage({ uid, viewOnly }) {
  const [orders, setOrders] = useState([])
  const [fileName, setFileName] = useState("")
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [fxRate, setFxRate] = useState(0)

  useEffect(() => { if (uid) loadOrders() }, [uid])

  async function loadOrders() {
    setLoading(true)
    try {
      const { db } = await import("../lib/firebase")
      const { collection, getDocs, doc, getDoc } = await import("firebase/firestore")
      // 為替レート取得
      try {
        const fxSnap = await getDoc(doc(db, "fx_rates", uid))
        if (fxSnap.exists()) setFxRate(Number(fxSnap.data().rate_php_jpy) || 0)
      } catch(e) {}
      // ShopeeManagerと同じデータソースを参照（重複アップロード不要）
      const docId = uid + "_orders"
      const snap = await getDoc(doc(db, "shopee_orders", docId))
      if (snap.exists()) {
        setOrders(snap.data().orders || [])
        setFileName(snap.data().filename || "")
      } else {
        // フォールバック：旧形式対応
        const colSnap = await getDocs(collection(db, "shopee_orders"))
        const myDocs = colSnap.docs.filter(d => d.data().userId === uid)
        if (myDocs.length > 0) {
          const latest = myDocs.sort((a,b) => (b.data().uploadedAt?.seconds||0) - (a.data().uploadedAt?.seconds||0))[0].data()
          setOrders(latest.orders || [])
          setFileName(latest.filename || "")
        }
      }
    } catch(e) { console.error(e) }
    setLoading(false)
  }



  const counts = orders.reduce((acc,o) => { acc[o.status]=(acc[o.status]||0)+1; return acc }, {})
  const filtered = filter==="all" ? orders : orders.filter(o=>o.status===filter)
  const totalRevenue = orders.filter(o=>o.status!=="Cancelled").reduce((s,o)=>s+o.total,0)
  const cancelRate = orders.length ? ((counts["Cancelled"]||0)/orders.length*100).toFixed(1) : "0.0"

  if (loading) return <div style={{ padding:"2rem", textAlign:"center", color:"var(--dim2)" }}>読み込み中...</div>

  return (
    <div>
      {/* データソース案内 */}
      {fileName && (
        <div style={{ marginBottom:16, padding:"8px 14px", background:"rgba(34,197,94,0.08)", borderRadius:8, border:"1px solid rgba(34,197,94,0.2)", fontSize:12, color:"#22c55e", fontWeight:600 }}>
          ✅ データソース: {fileName}（ProfitManagerでアップロード済み）
        </div>
      )}
      {!fileName && (
        <div style={{ marginBottom:16, padding:"12px 16px", background:"rgba(249,115,22,0.08)", borderRadius:8, border:"1px solid rgba(249,115,22,0.2)", fontSize:13, color:"var(--orange)" }}>
          📂 注文データがありません。<strong>💰 ProfitManager</strong> からXLSXをアップロードしてください。
        </div>
      )}

      {orders.length === 0 ? (
        <div className="card" style={{ padding:"2rem", textAlign:"center", color:"var(--dim2)" }}>
          注文データがありません。XLSXをアップロードしてください。
        </div>
      ) : (
        <>
          {/* 重複メッセージ */}
          <div style={{ marginBottom:12, padding:"8px 12px", background:"rgba(34,197,94,0.1)", borderRadius:8, border:"1px solid rgba(34,197,94,0.3)", fontSize:12, color:"#22c55e", fontWeight:600 }}>
            ✅ ORDER IDが重複する場合は最新データで上書きされます（累計: {orders.length}件）
          </div>

          {/* KPIカード */}
          <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
            <KpiCard icon="📦" label="総注文数" value={orders.length+"件"} color="#3b82f6" />
            <KpiCard icon="⚡" label="出荷待ち" value={(counts["To ship"]||0)+"件"} color="#eab308" />
            <KpiCard icon="🚚" label="配送中" value={(counts["Shipping"]||0)+"件"} color="#3b82f6" />
            <KpiCard icon="❌" label="キャンセル率" value={cancelRate+"%"} sub={(counts["Cancelled"]||0)+"/"+orders.length+"件"} color="#ef4444" />
            <KpiCard icon="💰" label="売上合計" value={"₱"+totalRevenue.toLocaleString()} sub={fxRate>0?"≈¥"+Math.round(totalRevenue*fxRate).toLocaleString():""} color="#22c55e" />
          </div>

          {/* フィルタ */}
          <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
            {[{key:"all",label:"すべて"},{key:"To ship",label:"⚡出荷待ち"},{key:"Shipping",label:"🚚配送中"},{key:"Delivered",label:"✅配達済み"},{key:"Cancelled",label:"❌キャンセル"}].map(f=>(
              <button key={f.key} onClick={()=>setFilter(f.key)}
                style={{ background:filter===f.key?"var(--orange)":"var(--surface)", color:filter===f.key?"#fff":"var(--dim2)", border:"none", borderRadius:8, padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                {f.label} <span style={{opacity:0.7}}>{f.key==="all"?orders.length:counts[f.key]||0}</span>
              </button>
            ))}
          </div>

          {/* テーブル */}
          <div className="card" style={{ padding:0, overflow:"hidden" }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"var(--surface)" }}>
                    {["Order ID","注文日","商品名","SKU","数量","金額(₱)","ステータス","追跡番号","出荷日"].map(h=>(
                      <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--dim2)", borderBottom:"1px solid var(--rim)", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0,200).map((o,i)=>(
                    <tr key={o.orderId+i} style={{ background:i%2===0?"transparent":"rgba(255,255,255,0.02)", borderLeft:o.status==="To ship"?"3px solid #eab308":"3px solid transparent" }}>
                      <td style={{ padding:"8px 10px", color:"#3b82f6", fontWeight:600, fontSize:11 }}>{o.orderId}</td>
                      <td style={{ padding:"8px 10px", color:"var(--dim2)", whiteSpace:"nowrap" }}>{o.orderDate}</td>
                      <td style={{ padding:"8px 10px", maxWidth:180 }}><div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{o.product}</div></td>
                      <td style={{ padding:"8px 10px", fontFamily:"monospace", fontSize:11, color:"#3b82f6" }}>{o.sku||"—"}</td>
                      <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:700 }}>{o.qty}</td>
                      <td style={{ padding:"8px 10px", fontWeight:700 }}>₱{o.total.toLocaleString()}</td>
                      <td style={{ padding:"8px 10px" }}><Badge status={o.status} /></td>
                      <td style={{ padding:"8px 10px", fontSize:11, color:"#64748b", fontFamily:"monospace" }}>{o.tracking||"—"}</td>
                      <td style={{ padding:"8px 10px", fontSize:11, color:"#64748b" }}>{o.shipTime||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length>200 && <div style={{ textAlign:"center", padding:"10px", fontSize:12, color:"#94a3b8" }}>表示: 200件 / 全{filtered.length}件</div>}
          </div>
        </>
      )}
    </div>
  )
}
