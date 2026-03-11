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
    <div style={{ background:"#fff", borderRadius:12, padding:"16px 18px", boxShadow:"0 1px 4px rgba(0,0,0,0.07)", borderTop:`3px solid ${color}`, flex:1, minWidth:0 }}>
      <div style={{ fontSize:20, marginBottom:6 }}>{icon}</div>
      <div style={{ fontSize:20, fontWeight:800, color:"#0f172a", lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>{sub}</div>}
      <div style={{ fontSize:12, color:"#64748b", fontWeight:600, marginTop:6 }}>{label}</div>
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
      style={{ border:`2px dashed ${dragOver?"#ee4d2d":uploaded?"#22c55e":"#cbd5e1"}`, borderRadius:10, padding:"20px", textAlign:"center", background:uploaded?"#f0fdf4":"#f8fafc", cursor:"pointer" }}>
      {uploaded ? (
        <>
          <div style={{ fontSize:24, marginBottom:4 }}>✅</div>
          <div style={{ fontSize:12, fontWeight:700, color:"#15803d" }}>{fileName}</div>
          <label style={{ fontSize:11, color:"#94a3b8", cursor:"pointer", textDecoration:"underline" }}>
            再アップロード<input type="file" accept=".xlsx,.xls" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])} />
          </label>
        </>
      ) : (
        <>
          <div style={{ fontSize:24, marginBottom:6 }}>📤</div>
          <div style={{ fontSize:12, fontWeight:700, color:"#334155", marginBottom:4 }}>{label}</div>
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
  // データあり時も再アップロード可能
  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <KpiCard icon="📦" label="総注文数" value={`${orders.length}件`} color="#3b82f6" />
        <KpiCard icon="⚡" label="出荷待ち" value={`${counts["To ship"]||0}件`} color="#eab308" />
        <KpiCard icon="🚚" label="配送中" value={`${counts["Shipping"]||0}件`} color="#3b82f6" />
        <KpiCard icon="❌" label="キャンセル率" value={`${cancelRate}%`} sub={`${counts["Cancelled"]||0}/${orders.length}件`} color="#ef4444" />
        <KpiCard icon="💰" label="売上合計" value={`₱${totalRevenue.toLocaleString()}`} color="#22c55e" />
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        {[{key:"all",label:"すべて"},{key:"To ship",label:"⚡出荷待ち"},{key:"Shipping",label:"🚚配送中"},{key:"Delivered",label:"✅配達済み"},{key:"Cancelled",label:"❌キャンセル"}].map(f=>(
          <button key={f.key} onClick={()=>setFilter(f.key)} style={{ background:filter===f.key?"#0f172a":"#f1f5f9", color:filter===f.key?"#fff":"#475569", border:"none", borderRadius:8, padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            {f.label} <span style={{opacity:0.7}}>{f.key==="all"?orders.length:counts[f.key]||0}</span>
          </button>
        ))}
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead><tr style={{ background:"#f8fafc" }}>
            {["Order ID","注文日","商品名","数量","金額(₱)","ステータス","追跡番号","出荷日"].map(h=>(
              <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:11, fontWeight:700, color:"#94a3b8", borderBottom:"1px solid #f1f5f9", whiteSpace:"nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{filtered.slice(0,100).map((o,i)=>(
            <tr key={o.orderId+i} style={{ background:i%2===0?"#fff":"#fafafa", borderLeft:o.status==="To ship"?"3px solid #eab308":"3px solid transparent" }}>
              <td style={{ padding:"8px 10px", color:"#3b82f6", fontWeight:600, fontSize:11 }}>{o.orderId}</td>
              <td style={{ padding:"8px 10px", color:"#64748b", whiteSpace:"nowrap" }}>{o.orderDate}</td>
              <td style={{ padding:"8px 10px", maxWidth:180 }}><div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"#334155" }}>{o.product}</div></td>
              <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:700 }}>{o.qty}</td>
              <td style={{ padding:"8px 10px", fontWeight:700, color:"#0f172a" }}>₱{o.total.toLocaleString()}</td>
              <td style={{ padding:"8px 10px" }}><Badge status={o.status} /></td>
              <td style={{ padding:"8px 10px", fontSize:11, color:"#64748b", fontFamily:"monospace" }}>{o.tracking||"—"}</td>
              <td style={{ padding:"8px 10px", fontSize:11, color:"#64748b" }}>{o.shipTime||"—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {filtered.length>100&&<div style={{ textAlign:"center", padding:"10px", fontSize:12, color:"#94a3b8" }}>表示: 100件 / 全{filtered.length}件</div>}
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
  // 再アップロードエリア（データあり時も表示）
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
      {/* To Release / Released タブ */}
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        {[{id:"toRelease",label:"📥 To Release（入金予定）"},{id:"released",label:"✅ Released（入金済み）"}].map(t=>(
          <button key={t.id} onClick={()=>setIncomeTab(t.id)} style={{ padding:"0.4rem 1rem", borderRadius:8, border:"none", background:incomeTab===t.id?"var(--orange)":"var(--surface)", color:incomeTab===t.id?"#fff":"var(--dim2)", fontWeight:incomeTab===t.id?700:400, fontSize:"0.8rem", cursor:"pointer", border:"1px solid var(--rim)" }}>{t.label}</button>
        ))}
      </div>
      {items.length===0 ? (
        <UploadArea label={`MyIncome XLSX（${incomeTab==="toRelease"?"To Release":"Released"}）`} onUpload={activeUpload} uploaded={false} fileName={activeFileName} />
      ) : (<>
      <div style={{ marginBottom:12 }}>
        <UploadArea label={`再アップロード（現在: ${activeFileName||"未アップロード"}）`} onUpload={activeUpload} uploaded={true} fileName={activeFileName} />
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <KpiCard icon="💰" label="売上合計" value={`₱${totalPrice.toLocaleString()}`} color="#3b82f6" />
        <KpiCard icon="📊" label="入金合計（純利益）" value={`₱${totalRelease.toLocaleString()}`} color="#22c55e" />
        <KpiCard icon="💸" label="手数料率" value={`${feeRate}%`} sub="コミッション+SF+TF" color="#f59e0b" />
        <KpiCard icon="📈" label="粗利率" value={`${marginRate}%`} sub="入金÷売上" color="#8b5cf6" />
      </div>
      <div style={{ background:"#fff", borderRadius:12, padding:18, boxShadow:"0 1px 4px rgba(0,0,0,0.07)" }}>
        <div style={{ fontWeight:800, fontSize:14, color:"#0f172a", marginBottom:14 }}>💧 利益ウォーターフォール</div>
        {waterfall.map(item=>{
          const barW = totalPrice?Math.abs(item.value)/totalPrice*100:0
          return (
            <div key={item.label} style={{ marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3, fontSize:12 }}>
                <span style={{ color:"#475569" }}>{item.label}</span>
                <span style={{ fontWeight:700, color:item.positive?"#16a34a":"#ef4444" }}>{item.positive?"+":""}₱{item.value.toLocaleString()}</span>
              </div>
              <div style={{ background:"#f1f5f9", borderRadius:4, height:7 }}>
                <div style={{ width:`${Math.min(barW,100)}%`, height:"100%", background:item.positive?"#3b82f6":"#f87171", borderRadius:4 }} />
              </div>
            </div>
          )
        })}
        <div style={{ marginTop:14, paddingTop:12, borderTop:"2px solid #0f172a", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontWeight:800, fontSize:13 }}>入金合計（純利益）</span>
          <span style={{ fontWeight:800, fontSize:18, color:"#16a34a" }}>₱{totalRelease.toLocaleString()}</span>
        </div>
      </div>
      </>)}
      {inventoryItems && inventoryItems.length > 0 && items.length > 0 && (() => {
        // SKU→仕入単価マップ（在庫棚卸から）
        const costMap = {}
        inventoryItems.forEach(i => { if(i.sku && i.costPhp > 0) costMap[i.sku] = { costPhp: Number(i.costPhp), name: i.name } })
        // OrderID→SKUマップ（オーダーレポートから）
        const orderIdToSku = {}
        const orderIdToProduct = {}
        ;(orders||[]).forEach(o => {
          if (o.orderId && o.sku) {
            orderIdToSku[o.orderId] = o.sku
            orderIdToProduct[o.orderId] = o.product
          }
        })
        // MyIncomeからSKU別売上集計（OrderIDで照合）
        const skuSales = {}
        items.forEach(item => {
          const orderId = item.orderId || ""
          const sku = orderIdToSku[orderId] || item.sku || ""
          const productName = orderIdToProduct[orderId] || item.productName || sku
          if (!sku) return
          if (!skuSales[sku]) skuSales[sku] = { revenue: 0, toRelease: 0, qty: 0, productName }
          skuSales[sku].revenue += Number(item.originalPrice || 0)
          skuSales[sku].toRelease += Number(item.toRelease || 0)
          skuSales[sku].qty += Number(item.qty || 1)
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
                ⚠️ 在庫棚卸メニューで仕入単価(₱)を登録すると粗利が自動計算されます
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function CashflowTab({ incomeData, cashflowItems, onAddExpense }) {
  const { items } = incomeData
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ date:"", label:"", amount:"", note:"" })
  const incomeByDate = {}
  items.forEach(item => {
    const d = item.releaseDate||item.orderDate
    if (!d) return
    if (!incomeByDate[d]) incomeByDate[d]={ amount:0, count:0, status:item.status }
    incomeByDate[d].amount += item.toRelease
    incomeByDate[d].count++
  })
  const allItems = [
    ...Object.entries(incomeByDate).map(([date,v])=>({ date, type:"income", label:`Shopee入金${v.status==="Released"?"(入金済)":"(入金予定)"}`, amount:v.amount, count:v.count, status:v.status==="Released"?"released":"scheduled" })),
    ...cashflowItems.map(c=>({...c, type:"expense"}))
  ].sort((a,b)=>a.date.localeCompare(b.date))
  let balance = 0
  const timeline = allItems.map(item=>{ balance+=item.type==="income"?item.amount:-Math.abs(item.amount); return {...item,balance} })
  const totalIncome = allItems.filter(i=>i.type==="income").reduce((s,i)=>s+i.amount,0)
  const totalExpense = allItems.filter(i=>i.type==="expense").reduce((s,i)=>s+Math.abs(i.amount),0)
  const handleAdd = () => {
    if (!newItem.date||!newItem.label||!newItem.amount) return
    onAddExpense({...newItem, amount:Number(newItem.amount)})
    setNewItem({date:"",label:"",amount:"",note:""})
    setShowAdd(false)
  }
  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <KpiCard icon="⬆️" label="入金合計" value={`₱${totalIncome.toLocaleString()}`} color="#22c55e" />
        <KpiCard icon="⬇️" label="仕入れ支払" value={`₱${totalExpense.toLocaleString()}`} color="#ef4444" />
        <KpiCard icon="💳" label="純キャッシュフロー" value={`₱${(totalIncome-totalExpense).toLocaleString()}`} color="#3b82f6" />
        <KpiCard icon="🏦" label="推定残高" value={`₱${balance.toLocaleString()}`} sub="累計" color="#8b5cf6" />
      </div>
      <div style={{ background:"#fff", borderRadius:12, padding:18, boxShadow:"0 1px 4px rgba(0,0,0,0.07)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontWeight:800, fontSize:14, color:"#0f172a" }}>📅 入出金タイムライン</div>
          <button onClick={()=>setShowAdd(!showAdd)} style={{ background:"#ee4d2d", color:"#fff", border:"none", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>＋ 支払予定を追加</button>
        </div>
        {showAdd && (
          <div style={{ background:"#f8fafc", borderRadius:10, padding:14, marginBottom:16, border:"1px solid #e2e8f0", display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-end" }}>
            {[{key:"date",label:"日付",type:"date"},{key:"label",label:"内容",type:"text",placeholder:"仕入れ支払"},{key:"amount",label:"金額(₱)",type:"number",placeholder:"8500"},{key:"note",label:"メモ",type:"text",placeholder:"備考"}].map(f=>(
              <div key={f.key} style={{ display:"flex", flexDirection:"column", gap:3 }}>
                <label style={{ fontSize:11, fontWeight:700, color:"#64748b" }}>{f.label}</label>
                <input type={f.type} value={newItem[f.key]} placeholder={f.placeholder||""} onChange={e=>setNewItem(n=>({...n,[f.key]:e.target.value}))}
                  style={{ border:"1px solid #e2e8f0", borderRadius:7, padding:"5px 10px", fontSize:12, width:f.key==="label"?160:f.key==="note"?140:90 }} />
              </div>
            ))}
            <button onClick={handleAdd} style={{ background:"#0f172a", color:"#fff", border:"none", borderRadius:8, padding:"7px 16px", fontSize:12, fontWeight:700, cursor:"pointer" }}>追加</button>
          </div>
        )}
        {timeline.length===0 ? (
          <div style={{ textAlign:"center", padding:"30px 0", color:"#94a3b8", fontSize:13 }}>MyIncomeをアップロードすると入金予定が自動表示されます</div>
        ) : timeline.map((item,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:i<timeline.length-1?"1px solid #f1f5f9":"none" }}>
            <div style={{ width:72, flexShrink:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#0f172a" }}>{item.date.slice(5).replace("-","/")}</div>
            </div>
            <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0, background:item.type==="income"?"#dcfce7":"#fee2e2", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
              {item.type==="income"?"⬆️":"⬇️"}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{item.label}</div>
              <div style={{ fontSize:11, color:"#94a3b8" }}>
                {item.count?`${item.count}件分`:item.note||""}
                {item.status==="scheduled"&&<span style={{ marginLeft:6, background:"#e0f2fe", color:"#0369a1", fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:10 }}>予定</span>}
                {item.status==="released"&&<span style={{ marginLeft:6, background:"#dcfce7", color:"#15803d", fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:10 }}>確定</span>}
              </div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontSize:14, fontWeight:800, color:item.type==="income"?"#16a34a":"#ef4444" }}>
                {item.type==="income"?"+":"-"}₱{Math.abs(item.amount).toLocaleString()}
              </div>
            </div>
            <div style={{ width:90, flexShrink:0, textAlign:"right", padding:"4px 10px", background:"#f8fafc", borderRadius:8 }}>
              <div style={{ fontSize:10, color:"#94a3b8" }}>残高</div>
              <div style={{ fontSize:12, fontWeight:700, color:"#0f172a" }}>₱{item.balance.toLocaleString()}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop:12, fontSize:11, color:"#94a3b8", textAlign:"center" }}>🔮 将来: Shopee API / LS-System連携で自動反映</div>
      </div>
    </div>
  )
}

export default function ShopeeManagerPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState("shipping")
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
        const orderSnap = await getDocs(query(collection(db,"shopee_orders"),where("userId","==",user.uid)))
        if (!orderSnap.empty) {
          const latest = orderSnap.docs.sort((a,b)=>(b.data().uploadedAt?.seconds||0)-(a.data().uploadedAt?.seconds||0))[0].data()
          setOrders(latest.orders||[]); setOrderFileName(latest.fileName||"")
        }
        const incSnap = await getDocs(query(collection(db,"shopee_income"),where("userId","==",user.uid)))
        if (!incSnap.empty) {
          const latest = incSnap.docs.sort((a,b)=>(b.data().uploadedAt?.seconds||0)-(a.data().uploadedAt?.seconds||0))[0].data()
          setIncomeData({ items:latest.items||[], summary:latest.summary||{} }); setIncomeFileName(latest.fileName||"")
        }
        const cfSnap = await getDocs(query(collection(db,"cashflow_items"),where("userId","==",user.uid)))
        // 在庫棚卸データ取得
        const invSnap = await getDocs(query(collection(db,"inventory_items"),where("uid","==",user.uid)))
        setInventoryItems(invSnap.docs.map(d=>({id:d.id,...d.data()})))
        // 為替レート取得
        const fxSnap = await getDoc(doc(db,"fx_rates",user.uid))
        if(fxSnap.exists()) setFxRate(Number(fxSnap.data().rate_php_jpy)||0)
        setCashflowItems(cfSnap.docs.map(d=>({id:d.id,...d.data()})))
      } catch(err) { console.error(err) }
    }
    load()
  }, [user])

  const handleOrderUpload = async (wb, fileName) => {
    const parsed = parseOrderXlsx(wb); setOrders(parsed); setOrderFileName(fileName)
    if (!user) return; setSaving(true)
    try { await addDoc(collection(db,"shopee_orders"),{ userId:user.uid, fileName, orders:parsed.slice(0,500), uploadedAt:serverTimestamp() }) }
    catch(err) { console.error(err) } finally { setSaving(false) }
  }

  const handleReleasedUpload = async (wb, fileName) => {
    const parsed = parseIncomeXlsx(wb)
    setReleasedData(parsed)
    setReleasedFileName(fileName)
    if (!user) return
    setSaving(true)
    try {
      await addDoc(collection(db,"shopee_income_released"),{ userId:user.uid, fileName, items:parsed.items.slice(0,300), summary:parsed.summary, uploadedAt:serverTimestamp() })
    } catch(err) { console.error(err) } finally { setSaving(false) }
  }

  const handleIncomeUpload = async (wb, fileName) => {
    const parsed = parseIncomeXlsx(wb); setIncomeData(parsed); setIncomeFileName(fileName)
    if (!user) return; setSaving(true)
    try { await addDoc(collection(db,"shopee_income"),{ userId:user.uid, fileName, items:parsed.items.slice(0,300), summary:parsed.summary, uploadedAt:serverTimestamp() }) }
    catch(err) { console.error(err) } finally { setSaving(false) }
  }

  const handleAddExpense = async (item) => {
    const newItem = {...item, userId:user?.uid, createdAt:serverTimestamp()}
    setCashflowItems(prev=>[...prev,newItem])
    if (!user) return
    try { await addDoc(collection(db,"cashflow_items"),newItem) } catch(err) { console.error(err) }
  }

  return (
    <div style={{ padding:20, maxWidth:1000, margin:"0 auto" }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4, flexWrap:"wrap" }}>
          <span style={{ fontSize:22 }}>📂</span>
          <h1 style={{ margin:0, fontSize:20, fontWeight:800, color:"#0f172a" }}>Shopee 一元管理</h1>
          <span style={{ background:"#ee4d2d", color:"#fff", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>Shopee Philippines</span>
          {saving&&<span style={{ background:"#f0fdf4", color:"#15803d", fontSize:11, fontWeight:600, padding:"2px 10px", borderRadius:20 }}>💾 保存中...</span>}
        </div>
        <p style={{ margin:0, color:"#64748b", fontSize:13 }}>出荷・利益・資金繰りを一画面で管理。在庫棚卸の仕入れ原価と連動して粗利を自動計算します。</p>
      </div>
      <div style={{ background:"#fff", borderRadius:14, boxShadow:"0 1px 4px rgba(0,0,0,0.07)", overflow:"hidden" }}>
        <div style={{ display:"flex", borderBottom:"1px solid #f1f5f9", padding:"0 20px" }}>
          {[{id:"shipping",icon:"📦",label:"出荷管理"},{id:"profit",icon:"💰",label:"利益管理"},{id:"cashflow",icon:"💳",label:"資金繰り管理"}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"14px 20px", border:"none", background:"none", cursor:"pointer", fontSize:14, fontWeight:700, color:tab===t.id?"#ee4d2d":"#64748b", borderBottom:tab===t.id?"2px solid #ee4d2d":"2px solid transparent", display:"flex", alignItems:"center", gap:6 }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div style={{ padding:20 }}>
          {tab==="shipping"&&<ShippingTab orders={orders} onUpload={handleOrderUpload} fileName={orderFileName} />}
          {tab==="profit"&&<ProfitTab incomeData={incomeData} onUpload={handleIncomeUpload} fileName={incomeFileName} releasedData={releasedData} onReleasedUpload={handleReleasedUpload} releasedFileName={releasedFileName} inventoryItems={inventoryItems} fxRate={fxRate} orders={orders} />}
          {tab==="cashflow"&&<CashflowTab incomeData={incomeData} cashflowItems={cashflowItems} onAddExpense={handleAddExpense} />}
        </div>
      </div>
      <div style={{ marginTop:14, padding:"10px 16px", background:"#eff6ff", borderRadius:8, border:"1px solid #bfdbfe", fontSize:12, color:"#1d4ed8", display:"flex", gap:20, flexWrap:"wrap" }}>
        <span>🔗 <b>在庫棚卸</b>と連動: 仕入れ単価→粗利自動計算</span>
        <span>🔮 将来: <b>Shopee API</b> / <b>LS-System</b> / <b>freee</b> 連携</span>
      </div>
    </div>
  )
}
