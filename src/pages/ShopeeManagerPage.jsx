import { useState, useEffect } from "react"
import { db } from "../lib/firebase"
import { collection, getDocs, addDoc, query, where, serverTimestamp } from "firebase/firestore"
import { useAuth } from "../hooks/useAuth"
import * as XLSX from "xlsx"

const STATUS_STYLE = {
  "Shipping":            { bg:"#dbeafe", text:"#1d4ed8", dot:"#3b82f6", label:"配送中" },
  "To ship":             { bg:"#fef9c3", text:"#854d0e", dot:"#eab308", label:"出荷待ち" },
  "Delivered":           { bg:"#dcfce7", text:"#15803d", dot:"#22c55e", label:"配達済み" },
  "Cancelled":           { bg:"#fee2e2", text:"#b91c1c", dot:"#ef4444", label:"キャンセル" },
  "Completed":           { bg:"#f0fdf4", text:"#166534", dot:"#16a34a", label:"完了" },
  "Unpaid":              { bg:"#f3f4f6", text:"#374151", dot:"#9ca3af", label:"未払い" },
  "Waiting for release": { bg:"#fef3c7", text:"#92400e", dot:"#f59e0b", label:"入金待ち" },
  "Under processing":    { bg:"#e0f2fe", text:"#075985", dot:"#0ea5e9", label:"処理中" },
  "Released":            { bg:"#dcfce7", text:"#15803d", dot:"#22c55e", label:"入金済み" },
}

function Badge({ status }) {
  const s = STATUS_STYLE[status] || { bg:"#f3f4f6", text:"#374151", dot:"#9ca3af", label: status }
  return (
    <span style={{ background:s.bg, color:s.text, padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700, display:"inline-flex", alignItems:"center", gap:4, whiteSpace:"nowrap" }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.dot, flexShrink:0 }} />
      {s.label}
    </span>
  )
}

function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ background:"var(--surface)", borderRadius:12, padding:"16px 18px", border:`1px solid var(--rim)`, borderTop:`3px solid ${color}`, flex:1, minWidth:0 }}>
      <div style={{ fontSize:20, marginBottom:6 }}>{icon}</div>
      <div style={{ fontSize:20, fontWeight:800, color:"var(--text)", lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"var(--dim2)", marginTop:2 }}>{sub}</div>}
      <div style={{ fontSize:12, color:"var(--dim2)", fontWeight:600, marginTop:6 }}>{label}</div>
    </div>
  )
}

function UploadArea({ label, onUpload, uploaded, fileName }) {
  const [dragOver, setDragOver] = useState(false)
  const handleFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type:"array" })
        onUpload(wb, file.name)
      } catch (err) { alert("読み込み失敗: " + err.message) }
    }
    reader.readAsArrayBuffer(file)
  }
  return (
    <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
      onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0])}}
      style={{ border:`2px dashed ${dragOver?"#ee4d2d":uploaded?"#22c55e":"#cbd5e1"}`, borderRadius:10, padding:"20px", textAlign:"center", background:"var(--surface)", cursor:"pointer" }}>
      {uploaded ? (
        <>
          <div style={{ fontSize:24, marginBottom:4 }}>✅</div>
          <div style={{ fontSize:12, fontWeight:700, color:"#22c55e" }}>{fileName}</div>
          <label style={{ fontSize:11, color:"var(--dim2)", cursor:"pointer", textDecoration:"underline" }}>
            再アップロード<input type="file" accept=".xlsx,.xls" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])} />
          </label>
        </>
      ) : (
        <>
          <div style={{ fontSize:24, marginBottom:6 }}>📤</div>
          <div style={{ fontSize:12, fontWeight:700, color:"var(--text)", marginBottom:4 }}>{label}</div>
          <label style={{ background:"#ee4d2d", color:"#fff", borderRadius:7, padding:"5px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            ファイルを選択<input type="file" accept=".xlsx,.xls" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])} />
          </label>
        </>
      )}
    </div>
  )
}

function parseOrderXlsx(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval:"" })
  return rows.map(r => ({
    orderId: r["Order ID"]||"", status: r["Order Status"]||"",
    product: r["Product Name"]||"", sku: r["Parent SKU Reference No."]||r["SKU Reference No."]||"",
    qty: Number(r["Quantity"])||0, total: Number(r["Grand Total"])||0,
    tracking: r["Tracking Number*"]||"", orderDate: r["Order Creation Date"]?String(r["Order Creation Date"]).slice(0,10):"",
    shipTime: r["Ship Time"]?String(r["Ship Time"]).slice(0,10):"",
  }))
}

function parseIncomeXlsx(wb) {
  const ws = wb.Sheets["Income"]||wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { range:5, defval:"" })
  let summary = {}
  const wsSummary = wb.Sheets["Summary"]
  if (wsSummary) {
    const sumRows = XLSX.utils.sheet_to_json(wsSummary, { header:1, defval:"" })
    sumRows.forEach(row => {
      if (row[0]==="Total Revenue") summary.totalRevenue=row[3]
      if (row[1]==="Original Product Price") summary.originalPrice=row[2]
      if (row[0]==="Total Expenses") summary.totalExpenses=row[3]
      if (row[1]==="Commission fee") summary.commissionFee=row[2]
      if (row[1]==="Service Fee") summary.serviceFee=row[2]
      if (row[1]==="Transaction Fee") summary.transactionFee=row[2]
      if (row[0]==="Shipping Subtotal") summary.shippingFee=row[3]
      if (row[1]==="Refund Amount") summary.refundAmount=row[2]
      if (row[1]==="Voucher Sponsored by Seller") summary.voucherSeller=row[2]
      if (row[0]==="Total To Release Amount") summary.totalToRelease=row[3]
    })
  }
  const items = rows.filter(r=>r["Order ID"]).map(r => ({
    orderId: r["Order ID"]||"", buyer: r["Username (Buyer)"]||"",
    orderDate: r["Order Creation Date"]?String(r["Order Creation Date"]).slice(0,10):"",
    releaseDate: r["Estimated Released Date"]?String(r["Estimated Released Date"]).slice(0,10):"",
    originalPrice: Number(r["Original Product Price"])||0,
    toRelease: Number(r["Total To Release Amount"])||0,
    status: r["Billing Item Status"]||"",
    sku: r["Parent SKU Reference No."]||r["SKU Reference No."]||"",
    qty: Number(r["Quantity"])||1,
    productName: r["Product Name"]||"",
  }))
  return { items, summary }
}

function ShippingTab({ orders, onUpload, fileName }) {
  const [filter, setFilter] = useState("all")
  const counts = orders.reduce((acc,o) => { acc[o.status]=(acc[o.status]||0)+1; return acc }, {})
  const filtered = filter==="all" ? orders : orders.filter(o=>o.status===filter)
  const totalRevenue = orders.filter(o=>o.status!=="Cancelled").reduce((s,o)=>s+o.total,0)
  const cancelRate = orders.length ? ((counts["Cancelled"]||0)/orders.length*100).toFixed(1) : "0.0"
  if (orders.length===0) return <UploadArea label="注文レポート XLSX（Order_all_xxxx.xlsx）" onUpload={onUpload} uploaded={false} fileName={fileName} />
  return (
    <div>
      <div style={{ marginBottom:12 }}>
        <UploadArea label={`再アップロード（現在: ${fileName||"未アップロード"}）`} onUpload={onUpload} uploaded={true} fileName={fileName} />
      </div>
      <div style={{ marginBottom:8, padding:"8px 12px", background:"rgba(34,197,94,0.1)", borderRadius:8, border:"1px solid rgba(34,197,94,0.3)", fontSize:12, color:"#22c55e", fontWeight:600 }}>
        ✅ ORDER IDが重複する場合は最新データで上書きされます（累計: {orders.length}件）
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <KpiCard icon="📦" label="総注文数" value={`${orders.length}件`} color="#3b82f6" />
        <KpiCard icon="⚡" label="出荷待ち" value={`${counts["To ship"]||0}件`} color="#eab308" />
        <KpiCard icon="🚚" label="配送中" value={`${counts["Shipping"]||0}件`} color="#3b82f6" />
        <KpiCard icon="❌" label="キャンセル率" value={`${cancelRate}%`} sub={`${counts["Cancelled"]||0}/${orders.length}件`} color="#ef4444" />
        <KpiCard icon="💰" label="売上合計" value={`₱${totalRevenue.toLocaleString()}`} color="#22c55e" />
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        {[{key:"all",label:"すべて"},{key:"To ship",label:"⚡出荷待ち"},{key:"Shipping",label:"🚚配送中"},{key:"Delivered",label:"✅配達済み"},{key:"Cancelled",label:"❌キャンセル"}].map(f=>(
          <button key={f.key} onClick={()=>setFilter(f.key)} style={{ background:filter===f.key?"var(--orange)":"var(--surface)", color:filter===f.key?"#fff":"var(--dim2)", border:"none", borderRadius:8, padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            {f.label} <span style={{opacity:0.7}}>{f.key==="all"?orders.length:counts[f.key]||0}</span>
          </button>
        ))}
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead><tr style={{ background:"var(--surface)" }}>
            {["Order ID","注文日","商品名","数量","金額(₱)","ステータス","追跡番号","出荷日"].map(h=>(
              <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--dim2)", borderBottom:"1px solid var(--rim)", whiteSpace:"nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{filtered.slice(0,100).map((o,i)=>(
            <tr key={o.orderId+i} style={{ background:i%2===0?"#fff":"#fafafa", borderLeft:o.status==="To ship"?"3px solid #eab308":"3px solid transparent" }}>
              <td style={{ padding:"8px 10px", color:"#3b82f6", fontWeight:600, fontSize:11 }}>{o.orderId}</td>
              <td style={{ padding:"8px 10px", color:"var(--dim2)", whiteSpace:"nowrap" }}>{o.orderDate}</td>
              <td style={{ padding:"8px 10px", maxWidth:180 }}><div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"var(--text)" }}>{o.product}</div></td>
              <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:700 }}>{o.qty}</td>
              <td style={{ padding:"8px 10px", fontWeight:700, color:"var(--text)" }}>₱{o.total.toLocaleString()}</td>
              <td style={{ padding:"8px 10px" }}><Badge status={o.status} /></td>
              <td style={{ padding:"8px 10px", fontSize:11, color:"var(--dim2)", fontFamily:"monospace" }}>{o.tracking||"—"}</td>
              <td style={{ padding:"8px 10px", fontSize:11, color:"var(--dim2)" }}>{o.shipTime||"—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {filtered.length>100&&<div style={{ textAlign:"center", padding:"10px", fontSize:12, color:"var(--dim2)" }}>表示: 100件 / 全{filtered.length}件</div>}
    </div>
  )
}

function ProfitTab({ incomeData, onUpload, fileName, releasedData, onReleasedUpload, releasedFileName, inventoryItems, fxRate, orders }) {
  const [incomeTab, setIncomeTab] = useState("toRelease")
  const activeData = incomeTab === "toRelease" ? incomeData : releasedData
  const activeFileName = incomeTab === "toRelease" ? fileName : releasedFileName
  const activeUpload = incomeTab === "toRelease" ? onUpload : onReleasedUpload
  const { items=[], summary:s={} } = activeData || {}
  const totalPrice   = Number(s.originalPrice)||items.reduce((a,i)=>a+i.originalPrice,0)
  const totalRelease = Number(s.totalToRelease)||items.reduce((a,i)=>a+i.toRelease,0)
  const commFee      = Math.abs(Number(s.commissionFee)||0)
  const serviceFee   = Math.abs(Number(s.serviceFee)||0)
  const transFee     = Math.abs(Number(s.transactionFee)||0)
  const shippingFee  = Math.abs(Number(s.shippingFee)||0)
  const refund       = Math.abs(Number(s.refundAmount)||0)
  const marginRate   = totalPrice?(totalRelease/totalPrice*100).toFixed(1):"—"
  const feeRate      = totalPrice?((commFee+serviceFee+transFee)/totalPrice*100).toFixed(1):"—"
  const payoneerRate = 0.98
  const totalReleaseUsd = totalRelease * 0.0175 * payoneerRate
  const totalReleaseJpy = fxRate > 0 ? totalRelease * fxRate * payoneerRate : 0
  const totalPriceJpy = fxRate > 0 ? totalPrice * fxRate * payoneerRate : 0
  const waterfall = [
    {label:"売上（正価）",value:totalPrice,positive:true},
    {label:"返金・返品",value:-refund,positive:false},
    {label:"セラークーポン",value:-(Number(s.voucherSeller)||0),positive:false},
    {label:"配送費（Shopee）",value:-shippingFee,positive:false},
    {label:"コミッション",value:-commFee,positive:false},
    {label:"サービス料",value:-serviceFee,positive:false},
    {label:"決済手数料",value:-transFee,positive:false},
  ].filter(w=>w.value!==0)
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        {[{id:"toRelease",label:"📥 To Release（入金予定）"},{id:"released",label:"✅ Released（入金済み）"}].map(t=>(
          <button key={t.id} onClick={()=>setIncomeTab(t.id)} style={{ padding:"0.4rem 1rem", borderRadius:8, background:incomeTab===t.id?"var(--orange)":"var(--surface)", color:incomeTab===t.id?"#fff":"var(--dim2)", fontWeight:incomeTab===t.id?700:400, fontSize:"0.8rem", cursor:"pointer", border:"1px solid var(--rim)" }}>{t.label}</button>
        ))}
      </div>
      {items.length===0 ? (
        <UploadArea label={`MyIncome XLSX（${incomeTab==="toRelease"?"To Release":"Released"}）`} onUpload={activeUpload} uploaded={false} fileName={activeFileName} />
      ) : (<>
      <div style={{ marginBottom:12 }}>
        <UploadArea label={`再アップロード（現在: ${activeFileName||"未アップロード"}）`} onUpload={activeUpload} uploaded={true} fileName={activeFileName} />
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <KpiCard icon="💰" label="売上合計" value={`₱${totalPrice.toLocaleString()}`} sub={fxRate>0?`¥${Math.round(totalPriceJpy).toLocaleString()}`:""} color="#3b82f6" />
        <KpiCard icon="📊" label="入金合計（純利益）" value={`₱${totalRelease.toLocaleString()}`} sub={fxRate>0?`$${totalReleaseUsd.toFixed(2)} ／ ¥${Math.round(totalReleaseJpy).toLocaleString()}`:"為替未取得"} color="#22c55e" />
        <KpiCard icon="💸" label="手数料率" value={`${feeRate}%`} sub="コミッション+SF+TF" color="#f59e0b" />
        <KpiCard icon="📈" label="粗利率" value={`${marginRate}%`} sub="入金÷売上" color="#8b5cf6" />
      </div>
      <div style={{ background:"var(--surface)", borderRadius:12, padding:18, border:"1px solid var(--rim)" }}>
        <div style={{ fontWeight:800, fontSize:14, color:"var(--text)", marginBottom:14 }}>💧 利益ウォーターフォール</div>
        {waterfall.map(item=>{
          const barW = totalPrice?Math.abs(item.value)/totalPrice*100:0
          return (
            <div key={item.label} style={{ marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3, fontSize:12 }}>
                <span style={{ color:"var(--dim2)" }}>{item.label}</span>
                <span style={{ fontWeight:700, color:item.positive?"#16a34a":"#ef4444" }}>{item.positive?"+":""}₱{item.value.toLocaleString()}</span>
              </div>
              <div style={{ background:"var(--rim)", borderRadius:4, height:7 }}>
                <div style={{ width:`${Math.min(barW,100)}%`, height:"100%", background:item.positive?"#3b82f6":"#f87171", borderRadius:4 }} />
              </div>
            </div>
          )
        })}
        <div style={{ marginTop:14, paddingTop:12, borderTop:"2px solid #0f172a", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontWeight:800, fontSize:13 }}>入金合計（純利益）</span>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontWeight:800, fontSize:18, color:"#16a34a" }}>₱{totalRelease.toLocaleString()}</div>
            {fxRate > 0 && <div style={{ fontSize:12, color:"var(--dim2)", marginTop:2 }}>💵 ${totalReleaseUsd.toFixed(2)} ／ 💴 ¥{Math.round(totalReleaseJpy).toLocaleString()}<span style={{fontSize:10,color:"var(--dim2)",marginLeft:4}}>(Payoneer 2%込)</span></div>}
          </div>
        </div>
      </div>
      </>)}
      {inventoryItems && inventoryItems.length > 0 && items.length > 0 && (() => {
        const costMap = {}
        inventoryItems.forEach(i => { const sku = i.internalSku || i.sku || ""; const costPhp = i.costPhp > 0 ? Number(i.costPhp) : (fxRate > 0 && i.unitPrice > 0 ? Math.round(Number(i.unitPrice) / fxRate * 10) / 10 : 0); if(sku && costPhp > 0) costMap[sku] = { costPhp, name: i.name } })
        const orderIdToSku = {}
        const orderIdToProduct = {}
        const orderIdToQty = {}
        ;(orders||[]).forEach(o => {
          if (o.orderId && o.sku) {
            orderIdToSku[o.orderId] = o.sku
            orderIdToProduct[o.orderId] = o.product
            orderIdToQty[o.orderId] = Number(o.qty) || 1
          }
        })
        const skuSales = {}
        items.forEach(item => {
          const orderId = item.orderId || ""
          const sku = orderIdToSku[orderId] || item.sku || ""
          const productName = orderIdToProduct[orderId] || item.productName || sku
          if (!sku) return
          if (!skuSales[sku]) skuSales[sku] = { revenue: 0, toRelease: 0, qty: 0, productName }
          skuSales[sku].revenue += Number(item.originalPrice || 0)
          skuSales[sku].toRelease += Number(item.toRelease || 0)
          skuSales[sku].qty += orderIdToQty[orderId] || Number(item.qty) || 1
        })
        const rows = Object.entries(skuSales).map(([sku, s]) => {
          const inv = costMap[sku]
          const costTotal = inv ? inv.costPhp * s.qty : null
          const grossProfit = costTotal != null ? s.toRelease - costTotal : null
          const grossMargin = costTotal != null && s.toRelease > 0 ? (grossProfit / s.toRelease * 100).toFixed(1) : null
          return { sku, name: inv?.name || sku, ...s, costTotal, grossProfit, grossMargin }
        }).sort((a,b) => (b.toRelease||0) - (a.toRelease||0))
        if (rows.length === 0) return null
        return (
          <div style={{ marginTop:16, background:"var(--surface)", borderRadius:12, padding:16, border:"1px solid var(--rim)" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"var(--text)", marginBottom:12 }}>📊 SKU別 粗利分析</div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"rgba(255,255,255,0.03)" }}>
                    {["商品名/SKU","数量","売上(₱)","入金(₱)","仕入合計(₱)","粗利(₱)","粗利率"].map(h=>(
                      <th key={h} style={{ padding:"8px 10px", textAlign:"right", fontWeight:700, color:"var(--dim2)", fontSize:"0.65rem", whiteSpace:"nowrap", borderBottom:"1px solid var(--rim)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r=>(
                    <tr key={r.sku} style={{ borderBottom:"1px solid var(--rim)" }}>
                      <td style={{ padding:"8px 10px", maxWidth:200 }}>
                        <div style={{ fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                        <div style={{ fontSize:"0.65rem", color:"#3b82f6", fontFamily:"monospace" }}>{r.sku}</div>
                      </td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"var(--dim2)" }}>{r.qty}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right" }}>₱{r.revenue.toLocaleString()}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"#22c55e", fontWeight:700 }}>₱{r.toRelease.toLocaleString()}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:r.costTotal!=null?"#f59e0b":"var(--dim2)" }}>
                        {r.costTotal!=null ? `₱${r.costTotal.toLocaleString()}` : <span style={{fontSize:"0.7rem"}}>仕入未登録</span>}
                      </td>
                      <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:700, color:r.grossProfit!=null?(r.grossProfit>=0?"#22c55e":"#ef4444"):"var(--dim2)" }}>
                        {r.grossProfit!=null ? `₱${r.grossProfit.toLocaleString()}` : "—"}
                      </td>
                      <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:700, color:r.grossMargin!=null?(Number(r.grossMargin)>=20?"#22c55e":Number(r.grossMargin)>=10?"#f59e0b":"#ef4444"):"var(--dim2)" }}>
                        {r.grossMargin!=null ? `${r.grossMargin}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Object.keys(costMap).length === 0 && (
              <div style={{ marginTop:10, background:"#fef9c3", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#92400e" }}>
                ⚠️ 在庫管理で仕入単価を登録すると粗利が自動計算されます
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function CashflowTab({ incomeData, cashflowItems, onAddExpense, uid }) {
  const { items } = incomeData
  const [activeSection, setActiveSection] = useState("timeline") // timeline | accounts | cards | points
  const [settings, setSettings] = useState({ payoneerUsd:0, payoneerJpy:0, bankJpy:0 })
  const [cards, setCards] = useState([])
  const [payables, setPayables] = useState([])
  const [points, setPoints] = useState([])
  const [incomeStatuses, setIncomeStatuses] = useState({})
  const [showAddCard, setShowAddCard] = useState(false)
  const [showAddPayable, setShowAddPayable] = useState(false)
  const [showAddPoint, setShowAddPoint] = useState(false)
  const [newCard, setNewCard] = useState({ name:"", limit:"", closingDay:"", paymentDay:"", color:"#3b82f6" })
  const [newPayable, setNewPayable] = useState({ cardId:"", date:"", label:"", amountJpy:"", note:"" })
  const [newPoint, setNewPoint] = useState({ name:"", points:"", expiry:"", note:"" })
  const [editBalance, setEditBalance] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ date:"", label:"", amount:"", note:"" })
  const effectiveUid = uid

  useEffect(() => { if (effectiveUid) loadSettings() }, [effectiveUid])

  async function loadSettings() {
    try {
      const { db } = await import("../lib/firebase")
      const { doc, getDoc, collection, query, where, getDocs } = await import("firebase/firestore")
      const snap = await getDoc(doc(db, "cashflow_settings", effectiveUid))
      if (snap.exists()) {
        const d = snap.data()
        setSettings({ payoneerUsd: d.payoneerUsd||0, payoneerJpy: d.payoneerJpy||0, bankJpy: d.bankJpy||0 })
        setCards(d.cards||[])
        setPoints(d.points||[])
      }
      const pSnap = await getDocs(query(collection(db,"cashflow_payables"),where("uid","==",effectiveUid)))
      setPayables(pSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.date.localeCompare(b.date)))
      const iSnap = await getDocs(query(collection(db,"cashflow_income_status"),where("uid","==",effectiveUid)))
      const statusMap = {}
      iSnap.docs.forEach(d=>{ statusMap[d.data().key] = d.data() })
      setIncomeStatuses(statusMap)
    } catch(e) { console.error(e) }
  }

  async function saveSettings(newSettings) {
    try {
      const { db } = await import("../lib/firebase")
      const { doc, setDoc } = await import("firebase/firestore")
      await setDoc(doc(db,"cashflow_settings",effectiveUid), { ...newSettings, cards, points, updatedAt:new Date().toISOString() }, { merge:true })
    } catch(e) { console.error(e) }
  }

  async function saveCards(newCards) {
    try {
      const { db } = await import("../lib/firebase")
      const { doc, setDoc } = await import("firebase/firestore")
      await setDoc(doc(db,"cashflow_settings",effectiveUid), { cards:newCards }, { merge:true })
    } catch(e) { console.error(e) }
  }

  async function savePoints(newPoints) {
    try {
      const { db } = await import("../lib/firebase")
      const { doc, setDoc } = await import("firebase/firestore")
      await setDoc(doc(db,"cashflow_settings",effectiveUid), { points:newPoints }, { merge:true })
    } catch(e) { console.error(e) }
  }

  async function addPayable() {
    if (!newPayable.date||!newPayable.label||!newPayable.amountJpy) return
    try {
      const { db } = await import("../lib/firebase")
      const { collection, addDoc } = await import("firebase/firestore")
      await addDoc(collection(db,"cashflow_payables"), { ...newPayable, uid:effectiveUid, amountJpy:Number(newPayable.amountJpy), createdAt:new Date().toISOString() })
      setNewPayable({ cardId:"", date:"", label:"", amountJpy:"", note:"" })
      setShowAddPayable(false)
      loadSettings()
    } catch(e) { alert("エラー: "+e.message) }
  }

  async function deletePayable(id) {
    if (!confirm("削除しますか？")) return
    try {
      const { db } = await import("../lib/firebase")
      const { doc, deleteDoc } = await import("firebase/firestore")
      await deleteDoc(doc(db,"cashflow_payables",id))
      loadSettings()
    } catch(e) { alert("エラー: "+e.message) }
  }

  async function updateIncomeStatus(key, status, extraData={}) {
    try {
      const { db } = await import("../lib/firebase")
      const { doc, setDoc } = await import("firebase/firestore")
      const docId = effectiveUid + "_" + key.replace(/[^a-zA-Z0-9]/g,"_")
      await setDoc(doc(db,"cashflow_income_status",docId), { uid:effectiveUid, key, status, ...extraData, updatedAt:new Date().toISOString() })
      setIncomeStatuses(prev => ({ ...prev, [key]: { status, ...extraData } }))
    } catch(e) { console.error(e) }
  }

  // 入金データ集計
  const incomeByDate = {}
  items.forEach(item => {
    const d = item.releaseDate||item.orderDate
    if (!d) return
    if (!incomeByDate[d]) incomeByDate[d]={ amount:0, count:0, status:item.status }
    incomeByDate[d].amount += item.toRelease
    incomeByDate[d].count++
  })

  const incomeItems = Object.entries(incomeByDate).map(([date,v]) => {
    const key = date
    const currentStatus = incomeStatuses[key]?.status || (v.status==="Released"?"released":"scheduled")
    return { date, key, type:"income", label:"Shopee入金", amount:v.amount, count:v.count, shopeeStatus:v.status, currentStatus, extraData: incomeStatuses[key]||{} }
  })

  // クレカ引落集計
  const paymentsByDate = {}
  payables.forEach(p => {
    const card = cards.find(c=>c.id===p.cardId)
    if (!card) return
    const payDate = getPaymentDate(p.date, card.closingDay, card.paymentDay)
    if (!paymentsByDate[payDate]) paymentsByDate[payDate] = { amount:0, cardName:card.name, items:[] }
    paymentsByDate[payDate].amount += p.amountJpy
    paymentsByDate[payDate].items.push(p)
  })

  const allItems = [
    ...incomeItems,
    ...cashflowItems.map(c=>({...c, type:"expense_php"})),
  ].sort((a,b)=>a.date.localeCompare(b.date))

  const totalIncome = incomeItems.reduce((s,i)=>s+i.amount,0)
  const totalExpense = cashflowItems.reduce((s,i)=>s+Math.abs(i.amount),0)
  const totalPayables = payables.reduce((s,p)=>s+p.amountJpy,0)

  // クレカ別買掛金集計
  const payablesByCard = {}
  payables.forEach(p => {
    if (!payablesByCard[p.cardId]) payablesByCard[p.cardId] = 0
    payablesByCard[p.cardId] += p.amountJpy
  })

  const inp = { padding:"0.45rem 0.7rem", borderRadius:8, border:"1px solid var(--rim)", background:"var(--surface)", color:"var(--text)", fontSize:"0.82rem", boxSizing:"border-box" }
  const lbl = { fontSize:"0.62rem", fontWeight:700, color:"var(--dim2)", display:"block", marginBottom:"0.2rem" }

  const sectionBtns = [
    { key:"timeline", label:"📅 タイムライン" },
    { key:"accounts", label:"🏦 口座" },
    { key:"cards", label:"💳 クレカ" },
    { key:"points", label:"✈️ マイル" },
  ]

  return (
    <div>
      {/* KPIカード */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <KpiCard icon="⬆️" label="入金(₱)" value={`₱${totalIncome.toLocaleString()}`} color="#22c55e" />
        <KpiCard icon="⬇️" label="支払(₱)" value={`₱${totalExpense.toLocaleString()}`} color="#ef4444" />
        <KpiCard icon="🏦" label="Payoneer $" value={`$${Number(settings.payoneerUsd).toLocaleString()}`} color="#3b82f6" />
        <KpiCard icon="💴" label="円口座" value={`¥${Number(settings.bankJpy).toLocaleString()}`} color="#a78bfa" />
        <KpiCard icon="💳" label="買掛金(¥)" value={`¥${totalPayables.toLocaleString()}`} color="#f59e0b" />
      </div>

      {/* セクション切替 */}
      <div style={{ display:"flex", gap:4, marginBottom:16, flexWrap:"wrap" }}>
        {sectionBtns.map(s => (
          <button key={s.key} onClick={()=>setActiveSection(s.key)}
            style={{ padding:"0.4rem 0.9rem", borderRadius:8, border:"none", background:activeSection===s.key?"var(--orange)":"var(--surface)", color:activeSection===s.key?"#fff":"var(--dim2)", fontSize:"0.78rem", fontWeight:activeSection===s.key?700:400, cursor:"pointer" }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ===== タイムライン ===== */}
      {activeSection === "timeline" && (
        <div style={{ background:"var(--surface)", borderRadius:12, padding:18, border:"1px solid var(--rim)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ fontWeight:800, fontSize:14 }}>📅 入出金タイムライン</div>
            <button onClick={()=>setShowAdd(!showAdd)} style={{ background:"#ee4d2d", color:"#fff", border:"none", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>＋ 支払予定を追加</button>
          </div>
          {showAdd && (
            <div style={{ background:"var(--surface)", borderRadius:10, padding:14, marginBottom:16, border:"1px solid var(--rim)", display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-end" }}>
              {[{key:"date",label:"日付",type:"date"},{key:"label",label:"内容",type:"text",placeholder:"仕入れ支払"},{key:"amount",label:"金額(₱)",type:"number",placeholder:"8500"},{key:"note",label:"メモ",type:"text",placeholder:"備考"}].map(f=>(
                <div key={f.key} style={{ display:"flex", flexDirection:"column", gap:3 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:"var(--dim2)" }}>{f.label}</label>
                  <input type={f.type} value={newItem[f.key]} placeholder={f.placeholder||""} onChange={e=>setNewItem(n=>({...n,[f.key]:e.target.value}))}
                    style={{ ...inp, width:f.key==="label"?160:f.key==="note"?140:90 }} />
                </div>
              ))}
              <button onClick={()=>{ if(!newItem.date||!newItem.label||!newItem.amount) return; onAddExpense({...newItem,amount:Number(newItem.amount)}); setNewItem({date:"",label:"",amount:"",note:""}); setShowAdd(false) }}
                style={{ background:"var(--orange)", color:"#fff", border:"none", borderRadius:8, padding:"7px 16px", fontSize:12, fontWeight:700, cursor:"pointer" }}>追加</button>
            </div>
          )}
          {allItems.length===0 ? (
            <div style={{ textAlign:"center", padding:"30px 0", color:"var(--dim2)", fontSize:13 }}>MyIncomeをアップロードすると入金予定が自動表示されます</div>
          ) : allItems.map((item,i)=>(
            <div key={i} style={{ borderBottom:i<allItems.length-1?"1px solid var(--rim)":"none", opacity:item.currentStatus==="completed"?0.4:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0" }}>
                <div style={{ width:60, flexShrink:0 }}>
                  <div style={{ fontSize:12, fontWeight:700 }}>{item.date.slice(5).replace("-","/")}</div>
                </div>
                <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0, background:item.type==="income"?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
                  {item.type==="income"?"⬆️":"⬇️"}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{item.label}</div>
                  <div style={{ fontSize:11, color:"var(--dim2)", display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                    {item.count && <span>{item.count}件分</span>}
                    {item.note && <span>{item.note}</span>}
                    {/* 入金ステータスバッジ */}
                    {item.type==="income" && (
                      <select value={item.currentStatus} onChange={e=>updateIncomeStatus(item.key, e.target.value)}
                        style={{ fontSize:10, padding:"1px 4px", borderRadius:6, border:"1px solid var(--rim)", background:"var(--surface)", color:"var(--text)", cursor:"pointer" }}>
                        <option value="scheduled">📅 入金予定</option>
                        <option value="payoneer">💵 Payoneer着金</option>
                        <option value="completed">✅ 円着金済</option>
                      </select>
                    )}
                    {/* Payoneer着金時のUSD金額入力 */}
                    {item.currentStatus==="payoneer" && (
                      <span style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap" }}>
                        <span style={{ fontSize:10, color:"var(--dim2)" }}>USD着金額:</span>
                        <input type="number" step="0.01"
                          defaultValue={item.extraData?.receivedUsd||""}
                          onBlur={e=>updateIncomeStatus(item.key,"payoneer",{receivedUsd:Number(e.target.value),receivedUsdRate:item.extraData?.receivedUsdRate})}
                          placeholder="12.50" style={{ ...inp, width:65, fontSize:10, padding:"1px 4px" }} />
                        <span style={{ fontSize:10, color:"var(--dim2)" }}>USD / レート:</span>
                        <input type="number" step="0.01"
                          defaultValue={item.extraData?.receivedUsdRate||""}
                          onBlur={e=>updateIncomeStatus(item.key,"payoneer",{receivedUsd:item.extraData?.receivedUsd,receivedUsdRate:Number(e.target.value)})}
                          placeholder="150" style={{ ...inp, width:55, fontSize:10, padding:"1px 4px" }} />
                        <span style={{ fontSize:10, color:"var(--dim2)" }}>¥/USD</span>
                        {item.extraData?.receivedUsd && item.extraData?.receivedUsdRate && (
                          <span style={{ fontSize:10, color:"#3b82f6", fontWeight:700 }}>
                            ≈¥{Math.round(item.extraData.receivedUsd * item.extraData.receivedUsdRate).toLocaleString()}
                          </span>
                        )}
                      </span>
                    )}
                    {/* 円着金時の金額入力 */}
                    {item.currentStatus==="completed" && (
                      <span style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap" }}>
                        <span style={{ fontSize:10, color:"var(--dim2)" }}>USD着金:</span>
                        <span style={{ fontSize:10, fontWeight:700, color:"#3b82f6" }}>${item.extraData?.receivedUsd||"?"}</span>
                        <span style={{ fontSize:10, color:"var(--dim2)" }}>→ 円着金額:</span>
                        <input type="number"
                          defaultValue={item.extraData?.receivedJpy||""}
                          onBlur={e=>updateIncomeStatus(item.key,"completed",{
                            receivedJpy:Number(e.target.value),
                            receivedUsd:item.extraData?.receivedUsd,
                            receivedUsdRate:item.extraData?.receivedUsdRate
                          })}
                          placeholder="18000" style={{ ...inp, width:70, fontSize:10, padding:"1px 4px" }} />
                        <span style={{ fontSize:10, color:"var(--dim2)" }}>¥</span>
                        {item.extraData?.receivedJpy && item.extraData?.receivedUsd && item.extraData?.receivedUsdRate && (
                          <span style={{ fontSize:10, color:((item.extraData.receivedJpy - item.extraData.receivedUsd * item.extraData.receivedUsdRate) >= 0)?"#22c55e":"#ef4444", fontWeight:700 }}>
                            差損益: {Math.round(item.extraData.receivedJpy - item.extraData.receivedUsd * item.extraData.receivedUsdRate).toLocaleString()}¥
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:item.type==="income"?"#22c55e":"#ef4444" }}>
                    {item.type==="income"?"+":"-"}₱{Math.abs(item.amount).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {/* クレカ引落予定 */}
          {Object.entries(paymentsByDate).length > 0 && (
            <div style={{ marginTop:16, borderTop:"2px solid var(--rim)", paddingTop:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#f59e0b", marginBottom:8 }}>💳 クレカ引落予定</div>
              {Object.entries(paymentsByDate).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,v],i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid var(--rim)" }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700 }}>{date.slice(5).replace("-","/")} 引落</div>
                    <div style={{ fontSize:11, color:"var(--dim2)" }}>{v.cardName} ({v.items.length}件)</div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:800, color:"#f59e0b" }}>¥{v.amount.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== 口座管理 ===== */}
      {activeSection === "accounts" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:"var(--surface)", borderRadius:12, padding:18, border:"1px solid var(--rim)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontWeight:800, fontSize:14 }}>🏦 口座残高</div>
              <button onClick={()=>setEditBalance(!editBalance)}
                style={{ background:"var(--orange)", color:"#fff", border:"none", borderRadius:8, padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                {editBalance?"完了":"残高を更新"}
              </button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
              {[
                { key:"payoneerUsd", label:"Payoneer (USD)", prefix:"$", color:"#3b82f6", icon:"💵" },
                { key:"payoneerJpy", label:"Payoneer (JPY)", prefix:"¥", color:"#22c55e", icon:"💴" },
                { key:"bankJpy", label:"日本円口座", prefix:"¥", color:"#a78bfa", icon:"🏦" },
              ].map(a => (
                <div key={a.key} style={{ padding:"12px 16px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--rim)" }}>
                  <div style={{ fontSize:11, color:"var(--dim2)", marginBottom:4 }}>{a.icon} {a.label}</div>
                  {editBalance ? (
                    <input type="number" value={settings[a.key]} onChange={e=>setSettings(s=>({...s,[a.key]:Number(e.target.value)}))}
                      onBlur={()=>saveSettings(settings)}
                      style={{ ...inp, width:"100%", fontSize:16, fontWeight:700 }} />
                  ) : (
                    <div style={{ fontSize:18, fontWeight:800, color:a.color }}>{a.prefix}{Number(settings[a.key]).toLocaleString()}</div>
                  )}
                </div>
              ))}
            </div>
            {/* 為替差損サマリー */}
            <div style={{ marginTop:16, padding:12, background:"rgba(249,115,22,0.06)", borderRadius:10, border:"1px solid rgba(249,115,22,0.2)" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--orange)", marginBottom:8 }}>📊 為替差損サマリー</div>
              <div style={{ fontSize:12, color:"var(--dim2)" }}>
                {Object.values(incomeStatuses).filter(s=>s.status==="completed"&&s.receivedJpy&&s.payoneerRate).map((s,i)=>{
                  const key = Object.keys(incomeStatuses)[i]
                  const incItem = incomeItems.find(it=>it.key===key)
                  if (!incItem) return null
                  const expected = Math.round(incItem.amount * s.payoneerRate)
                  const diff = s.receivedJpy - expected
                  return (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span>{incItem.date}</span>
                      <span style={{ color:diff>=0?"#22c55e":"#ef4444", fontWeight:700 }}>
                        {diff>=0?"+":""}{diff.toLocaleString()}¥
                      </span>
                    </div>
                  )
                })}
                <div style={{ borderTop:"1px solid var(--rim)", paddingTop:8, marginTop:4, display:"flex", justifyContent:"space-between", fontWeight:700 }}>
                  <span>累計差損益</span>
                  <span style={{ color:"var(--orange)" }}>
                    {(()=>{
                      const total = Object.values(incomeStatuses).filter(s=>s.status==="completed"&&s.receivedJpy&&s.payoneerRate).reduce((sum,s,i)=>{
                        const key = Object.keys(incomeStatuses)[i]
                        const incItem = incomeItems.find(it=>it.key===key)
                        if (!incItem) return sum
                        return sum + (s.receivedJpy - Math.round(incItem.amount * s.payoneerRate))
                      },0)
                      return (total>=0?"+":"")+total.toLocaleString()+"¥"
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== クレカ管理 ===== */}
      {activeSection === "cards" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* クレカ登録 */}
          <div style={{ background:"var(--surface)", borderRadius:12, padding:18, border:"1px solid var(--rim)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontWeight:800, fontSize:14 }}>💳 クレジットカード</div>
              <button onClick={()=>setShowAddCard(!showAddCard)}
                style={{ background:"var(--orange)", color:"#fff", border:"none", borderRadius:8, padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                ＋ カード追加
              </button>
            </div>
            {showAddCard && (
              <div style={{ padding:14, background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--rim)", marginBottom:12 }}>
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:8, marginBottom:8 }}>
                  {[
                    { key:"name", label:"カード名", placeholder:"楽天カード" },
                    { key:"limit", label:"利用限度額(¥)", placeholder:"500000", type:"number" },
                    { key:"closingDay", label:"締日", placeholder:"15", type:"number" },
                    { key:"paymentDay", label:"引落日", placeholder:"10", type:"number" },
                  ].map(f=>(
                    <div key={f.key}>
                      <label style={lbl}>{f.label}</label>
                      <input type={f.type||"text"} value={newCard[f.key]} onChange={e=>setNewCard(c=>({...c,[f.key]:e.target.value}))} placeholder={f.placeholder}
                        style={{ ...inp, width:"100%" }} />
                    </div>
                  ))}
                </div>
                <button onClick={()=>{
                  if (!newCard.name||!newCard.closingDay||!newCard.paymentDay) return
                  const updated = [...cards, { ...newCard, id:Date.now().toString(), limit:Number(newCard.limit)||0, closingDay:Number(newCard.closingDay), paymentDay:Number(newCard.paymentDay) }]
                  setCards(updated); saveCards(updated); setShowAddCard(false); setNewCard({name:"",limit:"",closingDay:"",paymentDay:"",color:"#3b82f6"})
                }} style={{ background:"var(--orange)", color:"#fff", border:"none", borderRadius:8, padding:"6px 16px", fontSize:12, fontWeight:700, cursor:"pointer" }}>登録</button>
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {cards.length===0 ? <div style={{ color:"var(--dim2)", fontSize:13, textAlign:"center", padding:16 }}>カードが登録されていません</div>
              : cards.map((card,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--rim)" }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13 }}>💳 {card.name}</div>
                    <div style={{ fontSize:11, color:"var(--dim2)" }}>締日: {card.closingDay}日 / 引落日: {card.paymentDay}日 {card.limit>0&&`/ 限度額: ¥${Number(card.limit).toLocaleString()}`}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#f59e0b" }}>買掛金: ¥{(payablesByCard[card.id]||0).toLocaleString()}</div>
                    <button onClick={()=>{ const updated=cards.filter((_,j)=>j!==i); setCards(updated); saveCards(updated) }}
                      style={{ fontSize:10, color:"#ef4444", background:"transparent", border:"none", cursor:"pointer", marginTop:2 }}>削除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 買掛金入力 */}
          <div style={{ background:"var(--surface)", borderRadius:12, padding:18, border:"1px solid var(--rim)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontWeight:800, fontSize:14 }}>📝 買掛金入力</div>
              <button onClick={()=>setShowAddPayable(!showAddPayable)}
                style={{ background:"var(--orange)", color:"#fff", border:"none", borderRadius:8, padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                ＋ 追加
              </button>
            </div>
            {showAddPayable && (
              <div style={{ padding:14, background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--rim)", marginBottom:12 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:8, marginBottom:8 }}>
                  <div>
                    <label style={lbl}>カード</label>
                    <select value={newPayable.cardId} onChange={e=>setNewPayable(p=>({...p,cardId:e.target.value}))}
                      style={{ ...inp, width:"100%" }}>
                      <option value="">選択</option>
                      {cards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>利用日</label>
                    <input type="date" value={newPayable.date} onChange={e=>setNewPayable(p=>({...p,date:e.target.value}))} style={{ ...inp, width:"100%" }} />
                  </div>
                  <div>
                    <label style={lbl}>内容</label>
                    <input value={newPayable.label} onChange={e=>setNewPayable(p=>({...p,label:e.target.value}))} placeholder="仕入れ" style={{ ...inp, width:"100%" }} />
                  </div>
                  <div>
                    <label style={lbl}>金額(¥)</label>
                    <input type="number" value={newPayable.amountJpy} onChange={e=>setNewPayable(p=>({...p,amountJpy:e.target.value}))} placeholder="10000" style={{ ...inp, width:"100%" }} />
                  </div>
                  <div>
                    <label style={lbl}>メモ</label>
                    <input value={newPayable.note} onChange={e=>setNewPayable(p=>({...p,note:e.target.value}))} placeholder="備考" style={{ ...inp, width:"100%" }} />
                  </div>
                </div>
                <button onClick={addPayable} style={{ background:"var(--orange)", color:"#fff", border:"none", borderRadius:8, padding:"6px 16px", fontSize:12, fontWeight:700, cursor:"pointer" }}>追加</button>
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {payables.length===0 ? <div style={{ color:"var(--dim2)", fontSize:13, textAlign:"center", padding:16 }}>買掛金データがありません</div>
              : payables.map((p,i)=>{
                const card = cards.find(c=>c.id===p.cardId)
                const payDate = card ? getPaymentDate(p.date, card.closingDay, card.paymentDay) : "?"
                return (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"rgba(255,255,255,0.02)", borderRadius:8, border:"1px solid var(--rim)" }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600 }}>{p.label}</div>
                      <div style={{ fontSize:11, color:"var(--dim2)" }}>{p.date} 利用 / {card?.name||"カード不明"} / 引落予定: {payDate}</div>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#f59e0b" }}>¥{Number(p.amountJpy).toLocaleString()}</div>
                      <button onClick={()=>deletePayable(p.id)} style={{ fontSize:10, color:"#ef4444", background:"transparent", border:"none", cursor:"pointer" }}>削除</button>
                    </div>
                  </div>
                )
              })}
            </div>
            {payables.length>0 && (
              <div style={{ marginTop:12, display:"flex", justifyContent:"space-between", padding:"8px 12px", background:"rgba(245,158,11,0.08)", borderRadius:8, border:"1px solid rgba(245,158,11,0.2)" }}>
                <span style={{ fontWeight:700, fontSize:13 }}>買掛金合計</span>
                <span style={{ fontWeight:800, fontSize:14, color:"#f59e0b" }}>¥{totalPayables.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== マイル・ポイント ===== */}
      {activeSection === "points" && (
        <div style={{ background:"var(--surface)", borderRadius:12, padding:18, border:"1px solid var(--rim)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontWeight:800, fontSize:14 }}>✈️ マイル・ポイント管理</div>
            <button onClick={()=>setShowAddPoint(!showAddPoint)}
              style={{ background:"var(--orange)", color:"#fff", border:"none", borderRadius:8, padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              ＋ 追加
            </button>
          </div>
          {showAddPoint && (
            <div style={{ padding:14, background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--rim)", marginBottom:12 }}>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 2fr", gap:8, marginBottom:8 }}>
                {[
                  { key:"name", label:"名称", placeholder:"ANAマイル" },
                  { key:"points", label:"残高", placeholder:"10000", type:"number" },
                  { key:"expiry", label:"有効期限", placeholder:"2026-12", type:"month" },
                  { key:"note", label:"メモ", placeholder:"クレカ経由で積算" },
                ].map(f=>(
                  <div key={f.key}>
                    <label style={lbl}>{f.label}</label>
                    <input type={f.type||"text"} value={newPoint[f.key]} onChange={e=>setNewPoint(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder}
                      style={{ ...inp, width:"100%" }} />
                  </div>
                ))}
              </div>
              <button onClick={()=>{
                if (!newPoint.name||!newPoint.points) return
                const updated = [...points, { ...newPoint, id:Date.now().toString(), points:Number(newPoint.points) }]
                setPoints(updated); savePoints(updated); setShowAddPoint(false); setNewPoint({name:"",points:"",expiry:"",note:""})
              }} style={{ background:"var(--orange)", color:"#fff", border:"none", borderRadius:8, padding:"6px 16px", fontSize:12, fontWeight:700, cursor:"pointer" }}>追加</button>
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {points.length===0 ? <div style={{ color:"var(--dim2)", fontSize:13, textAlign:"center", padding:16 }}>マイル・ポイントが登録されていません</div>
            : points.map((p,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"rgba(255,255,255,0.03)", borderRadius:10, border:"1px solid var(--rim)" }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>✈️ {p.name}</div>
                  <div style={{ fontSize:11, color:"var(--dim2)" }}>
                    {p.expiry&&`有効期限: ${p.expiry}`} {p.note&&`/ ${p.note}`}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <div style={{ fontSize:15, fontWeight:800, color:"#a78bfa" }}>{Number(p.points).toLocaleString()} pt</div>
                  <button onClick={()=>{ const updated=points.filter((_,j)=>j!==i); setPoints(updated); savePoints(updated) }}
                    style={{ fontSize:10, color:"#ef4444", background:"transparent", border:"none", cursor:"pointer" }}>削除</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// 引落日計算ユーティリティ
function getPaymentDate(useDate, closingDay, paymentDay) {
  try {
    const d = new Date(useDate)
    const day = d.getDate()
    let year = d.getFullYear()
    let month = d.getMonth() // 0-indexed
    // 締日を超えていたら翌月引落
    if (day > Number(closingDay)) month += 1
    if (month > 11) { month = 0; year += 1 }
    // 翌月の引落日
    month += 1
    if (month > 11) { month = 0; year += 1 }
    return `${year}-${String(month+1).padStart(2,"0")}-${String(paymentDay).padStart(2,"0")}`
  } catch(e) { return "?" }
}


export default function ShopeeManagerPage({ uid: propUid }) {
  const { user } = useAuth()
  const effectiveUid = propUid || user?.uid
  const [tab, setTab] = useState("profit")
  const [orders, setOrders] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [fxRate, setFxRate] = useState(0)
  const [orderFileName, setOrderFileName] = useState("")
  const [incomeData, setIncomeData] = useState({ items:[], summary:{} })
  const [incomeFileName, setIncomeFileName] = useState("")
  const [cashflowItems, setCashflowItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [releasedData, setReleasedData] = useState({ items:[], summary:{} })
  const [releasedFileName, setReleasedFileName] = useState("")

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const { getDoc, doc: docRef } = await import("firebase/firestore")
        // ORDER IDベースの固定ドキュメントから読み込み
        const orderDoc = await getDoc(docRef(db, "shopee_orders", effectiveUid + "_orders"))
        if (orderDoc.exists()) {
          setOrders(orderDoc.data().orders || [])
          setOrderFileName(orderDoc.data().fileName || "")
        } else {
          // 旧形式（addDoc）のデータも読み込み対応
          const orderSnap = await getDocs(query(collection(db,"shopee_orders"),where("userId","==",effectiveUid)))
          if (!orderSnap.empty) {
            const latest = orderSnap.docs.sort((a,b)=>(b.data().uploadedAt?.seconds||0)-(a.data().uploadedAt?.seconds||0))[0].data()
            setOrders(latest.orders||[]); setOrderFileName(latest.fileName||"")
          }
        }
        const incSnap = await getDocs(query(collection(db,"shopee_income"),where("userId","==",effectiveUid)))
        if (!incSnap.empty) {
          const latest = incSnap.docs.sort((a,b)=>(b.data().uploadedAt?.seconds||0)-(a.data().uploadedAt?.seconds||0))[0].data()
          setIncomeData({ items:latest.items||[], summary:latest.summary||{} }); setIncomeFileName(latest.fileName||"")
        }
        const relSnap = await getDocs(query(collection(db,"shopee_income_released"),where("userId","==",effectiveUid)))
        if (!relSnap.empty) {
          const latestRel = relSnap.docs.sort((a,b)=>(b.data().uploadedAt?.seconds||0)-(a.data().uploadedAt?.seconds||0))[0].data()
          setReleasedData({ items:latestRel.items||[], summary:latestRel.summary||{} }); setReleasedFileName(latestRel.fileName||"")
        }
        const cfSnap = await getDocs(query(collection(db,"cashflow_items"),where("userId","==",effectiveUid)))
        const invSnap = await getDocs(query(collection(db,"physical_products"),where("uid","==",effectiveUid)))
        setInventoryItems(invSnap.docs.map(d=>({id:d.id,...d.data()})))
        const fxSnap = await getDoc(docRef(db,"fx_rates",effectiveUid))
        if(fxSnap.exists()) setFxRate(Number(fxSnap.data().rate_php_jpy)||0)
        setCashflowItems(cfSnap.docs.map(d=>({id:d.id,...d.data()})))
      } catch(err) { console.error(err) }
    }
    load()
  }, [user])

  const handleOrderUpload = async (wb, fileName) => {
    const parsed = parseOrderXlsx(wb)
    // ORDER IDで重複排除：既存データとマージし、新しい方で上書き
    setOrders(prev => {
      const map = {}
      prev.forEach(o => { if (o.orderId) map[o.orderId] = o })
      parsed.forEach(o => { if (o.orderId) map[o.orderId] = o })
      return Object.values(map)
    })
    setOrderFileName(fileName)
    if (!user) return
    setSaving(true)
    try {
      const { setDoc, doc: docRef, getDoc } = await import("firebase/firestore")
      const docId = effectiveUid + "_orders"
      // Firestoreの既存データとマージ
      const existing = await getDoc(docRef(db, "shopee_orders", docId))
      const existingOrders = existing.exists() ? (existing.data().orders || []) : []
      const map = {}
      existingOrders.forEach(o => { if (o.orderId) map[o.orderId] = o })
      parsed.forEach(o => { if (o.orderId) map[o.orderId] = o })
      const merged = Object.values(map).slice(0, 1000)
      await setDoc(docRef(db, "shopee_orders", docId), {
        userId: effectiveUid, fileName, orders: merged, uploadedAt: serverTimestamp()
      })
    } catch(err) { console.error(err) } finally { setSaving(false) }
  }

  const handleReleasedUpload = async (wb, fileName) => {
    const parsed = parseIncomeXlsx(wb)
    setReleasedData(parsed)
    setReleasedFileName(fileName)
    if (!user) return
    setSaving(true)
    try {
      await addDoc(collection(db,"shopee_income_released"),{ userId:effectiveUid, fileName, items:parsed.items.slice(0,300), summary:parsed.summary, uploadedAt:serverTimestamp() })
    } catch(err) { console.error(err) } finally { setSaving(false) }
  }

  const handleIncomeUpload = async (wb, fileName) => {
    const parsed = parseIncomeXlsx(wb); setIncomeData(parsed); setIncomeFileName(fileName)
    if (!user) return; setSaving(true)
    try { await addDoc(collection(db,"shopee_income"),{ userId:effectiveUid, fileName, items:parsed.items.slice(0,300), summary:parsed.summary, uploadedAt:serverTimestamp() }) }
    catch(err) { console.error(err) } finally { setSaving(false) }
  }

  const handleAddExpense = async (item) => {
    const newItem = {...item, userId:effectiveUid, createdAt:serverTimestamp()}
    setCashflowItems(prev=>[...prev,newItem])
    if (!user) return
    try { await addDoc(collection(db,"cashflow_items"),newItem) } catch(err) { console.error(err) }
  }

  return (
    <div style={{ padding:20, maxWidth:1000, margin:"0 auto" }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4, flexWrap:"wrap" }}>
          <span style={{ fontSize:22 }}>📂</span>
          <h1 style={{ margin:0, fontSize:20, fontWeight:800, color:"var(--text)" }}>Shopee 一元管理</h1>
          <span style={{ background:"#ee4d2d", color:"#fff", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>Shopee Philippines</span>
          {saving&&<span style={{ background:"rgba(34,197,94,0.1)", color:"#22c55e", fontSize:11, fontWeight:600, padding:"2px 10px", borderRadius:20 }}>💾 保存中...</span>}
        </div>
        <p style={{ margin:0, color:"var(--dim2)", fontSize:13 }}>出荷・利益・資金繰りを一画面で管理。在庫棚卸の仕入れ原価と連動して粗利を自動計算します。</p>
      </div>
      <div style={{ background:"var(--surface)", borderRadius:14, border:"1px solid var(--rim)", overflow:"hidden" }}>
        <div style={{ display:"flex", borderBottom:"1px solid var(--rim)", padding:"0 20px" }}>
          {[{id:"profit",icon:"💰",label:"利益管理"},{id:"cashflow",icon:"💳",label:"資金繰り管理"}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"14px 20px", border:"none", background:"none", cursor:"pointer", fontSize:14, fontWeight:700, color:tab===t.id?"#ee4d2d":"#64748b", borderBottom:tab===t.id?"2px solid #ee4d2d":"2px solid transparent", display:"flex", alignItems:"center", gap:6 }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div style={{ padding:20 }}>
          
          {tab==="profit"&&<ProfitTab incomeData={incomeData} onUpload={handleIncomeUpload} fileName={incomeFileName} releasedData={releasedData} onReleasedUpload={handleReleasedUpload} releasedFileName={releasedFileName} inventoryItems={inventoryItems} fxRate={fxRate} orders={orders} />}
          {tab==="cashflow"&&<CashflowTab incomeData={incomeData} cashflowItems={cashflowItems} onAddExpense={handleAddExpense} uid={effectiveUid} />}
        </div>
      </div>
      <div style={{ marginTop:14, padding:"10px 16px", background:"#eff6ff", borderRadius:8, border:"1px solid #bfdbfe", fontSize:12, color:"#1d4ed8", display:"flex", gap:20, flexWrap:"wrap" }}>
        <span>🔗 <b>在庫棚卸</b>と連動: 仕入れ単価→粗利自動計算</span>
        <span>🔮 将来: <b>Shopee API</b> / <b>LS-System</b> / <b>freee</b> 連携</span>
      </div>
    </div>
  )
}
