import { useState, useEffect, useRef } from "react"

function calcShippingPHP(weightG) {
  if (!weightG || weightG <= 0) return 0
  return 6 + (Math.ceil(weightG / 50) - 1) * 25
}

const STATUS_CONFIG = {
  new:         { label: "新規",   color: "#818cf8", bg: "rgba(129,140,248,0.15)" },
  negotiating: { label: "交渉中", color: "#f59e0b", bg: "rgba(245,158,11,0.15)"  },
  converted:   { label: "成約",   color: "#10b981", bg: "rgba(16,185,129,0.15)"  },
  ng:          { label: "NG",     color: "#ef4444", bg: "rgba(239,68,68,0.15)"   },
  pending:     { label: "保留",   color: "#6b7280", bg: "rgba(107,114,128,0.15)" },
}
const STATUS_TABS = ["all","new","negotiating","converted","ng","pending"]
const STATUS_LABELS = { all:"すべて", new:"新規", negotiating:"交渉中", converted:"成約", ng:"NG", pending:"保留" }
const inp = { display:"block", width:"100%", padding:"0.5rem 0.7rem", borderRadius:8, border:"1px solid var(--rim)", background:"var(--surface)", color:"var(--text)", fontSize:"0.85rem", boxSizing:"border-box" }
const lbl = { fontSize:"0.68rem", fontWeight:700, color:"var(--dim2)", display:"block", marginBottom:"0.25rem" }

function fmtDate(d) {
  return d.getFullYear() + "/" + String(d.getMonth()+1).padStart(2,"0") + "/" + String(d.getDate()).padStart(2,"0")
}

function DashStats({ items, dateFilter }) {
  const filtered = items.filter(dateFilter)
  const inquiries = filtered.length
  const converted = filtered.filter(i => i.status === "converted").length
  const cvRate = inquiries > 0 ? ((converted/inquiries)*100).toFixed(1) : "0"
  const totalSales = filtered.filter(i=>i.status==="converted").reduce((s,i)=>s+(parseFloat(i.price)||0),0)
  const totalProfit = filtered.filter(i=>i.status==="converted").reduce((s,i)=>s+(parseFloat(i.profit)||0),0)
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:"0.75rem" }}>
      {[
        ["💬 新規問合せ", inquiries+"件", "var(--orange)"],
        ["✅ 成約数", converted+"件", "#10b981"],
        ["📈 成約率", cvRate+"%", "#818cf8"],
        ["💰 売上合計", "₱"+totalSales.toLocaleString(), "var(--orange)"],
        ["📦 利益合計", "₱"+totalProfit.toLocaleString(), "#10b981"],
      ].map(([label,value,color])=>(
        <div key={label} className="card" style={{ padding:"1rem", display:"flex", flexDirection:"column", gap:"0.4rem" }}>
          <div style={{ fontSize:"0.7rem", color:"var(--dim2)", fontWeight:700 }}>{label}</div>
          <div style={{ fontSize:"1.4rem", fontWeight:900, color, lineHeight:1 }}>{value}</div>
        </div>
      ))}
    </div>
  )
}

function Dashboard({ items }) {
  const [period, setPeriod] = useState("today")
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today); yesterday.setDate(today.getDate()-1)
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate()-7)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth()+1, 0)

  const filters = {
    today:     item => { const d=new Date(item.createdAt||item.date); const day=new Date(d.getFullYear(),d.getMonth(),d.getDate()); return day.getTime()===today.getTime() },
    yesterday: item => { const d=new Date(item.createdAt||item.date); const day=new Date(d.getFullYear(),d.getMonth(),d.getDate()); return day.getTime()===yesterday.getTime() },
    week:      item => { const d=new Date(item.createdAt||item.date); const day=new Date(d.getFullYear(),d.getMonth(),d.getDate()); return day>=weekAgo&&day<=today },
    month:     item => { const d=new Date(item.createdAt||item.date); const day=new Date(d.getFullYear(),d.getMonth(),d.getDate()); return day>=monthStart&&day<=monthEnd },
  }

  const dateLabels = {
    today:     "📅 "+fmtDate(today),
    yesterday: "📅 "+fmtDate(yesterday),
    week:      "📅 "+fmtDate(weekAgo)+" 〜 "+fmtDate(today),
    month:     "📅 "+fmtDate(monthStart)+" 〜 "+fmtDate(monthEnd),
  }

  const tabs = [
    { id:"today",     label:"当日"  },
    { id:"yesterday", label:"前日"  },
    { id:"week",      label:"週次"  },
    { id:"month",     label:"月次"  },
  ]

  return (
    <div style={{ marginBottom:"1.5rem" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.5rem" }}>
        <div style={{ fontSize:"0.88rem", fontWeight:700, color:"var(--text)" }}>📊 PASABUYダッシュボード</div>
        <div style={{ display:"flex", gap:"0.4rem" }}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setPeriod(t.id)} style={{ padding:"0.3rem 0.75rem", borderRadius:6, border:"1px solid var(--rim)", background:period===t.id?"var(--orange)":"transparent", color:period===t.id?"#fff":"var(--dim2)", fontSize:"0.76rem", fontWeight:period===t.id?700:400, cursor:"pointer" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ fontSize:"0.7rem", color:"var(--dim2)", marginBottom:"0.9rem", padding:"0.3rem 0.75rem", background:"rgba(255,255,255,0.03)", borderRadius:6, display:"inline-block" }}>
        {dateLabels[period]}
      </div>
      <DashStats items={items} dateFilter={filters[period]} />
    </div>
  )
}

function AIModal({ item, onClose }) {
  const [analysis, setAnalysis] = useState("")
  const [loading, setLoading] = useState(true)
  useEffect(()=>{
    async function run(){
      try {
        const prompt = `ShoppyWorks PASABUYセラー向けAIとして以下の案件をアドバイスしてください。\n商品:${item.product} 金額:PHP${item.price||"未定"} ステータス:${STATUS_CONFIG[item.status||"new"]?.label}\n1.成約可能性と注意点 2.価格設定ヒント 3.次のアクション\n日本語200文字以内で。`
        const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":import.meta.env.VITE_ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:400,messages:[{role:"user",content:prompt}]})})
        const data = await res.json()
        setAnalysis(data.content[0].text)
      } catch(e){ setAnalysis("エラー: "+e.message) }
      setLoading(false)
    }
    run()
  },[])
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }} onClick={onClose}>
      <div style={{ background:"var(--bg)",border:"1px solid var(--rim)",borderRadius:12,padding:"1.5rem",maxWidth:480,width:"90%" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontWeight:700,marginBottom:"0.75rem" }}>AI分析: {item.product}</div>
        {loading?<div style={{ color:"var(--dim2)" }}>分析中...</div>:<div style={{ fontSize:"0.85rem",lineHeight:1.8 }}>{analysis}</div>}
        <button onClick={onClose} style={{ marginTop:"1rem",padding:"0.5rem 1.5rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",cursor:"pointer" }}>閉じる</button>
      </div>
    </div>
  )
}

function CaseForm({ uid, buyers, initialData, onSaved, onCancel }) {
  const isEdit = !!initialData
  const [step, setStep] = useState(isEdit?2:1)
  const [buyerMode, setBuyerMode] = useState("select")
  const [selectedBuyer, setSelectedBuyer] = useState(initialData?.buyerName||"")
  const [newBuyer, setNewBuyer] = useState({name:"",platform:"Shopee",contact:"",note:""})
  const [product, setProduct] = useState({name:initialData?.product||"",weightG:initialData?.weightG||"",qty:initialData?.qty||"1",url:initialData?.url||"",note:initialData?.note||""})
  const [estimate, setEstimate] = useState({itemPrice:initialData?.itemPrice||"",customs:initialData?.customs||"",feeRate:initialData?.feeRate||"25",profitMode:"amount",profitTarget:""})
  const [calcResult, setCalcResult] = useState(initialData?.price?{itemPHP:"0",shipping:initialData.shipping||0,customs:0,fee:initialData.fee||"0",feeRate:25,totalCost:"0",offerPHP:initialData.price,profit:initialData.profit||"0",profitRate:"0"}:null)
  const [offerMsg, setOfferMsg] = useState({en:initialData?.offerEn||"",tl:initialData?.offerTl||""})
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const shipping = calcShippingPHP(parseFloat(product.weightG)||0)
  const RATE = 3.0

  function calcEstimate(){
    const itemPHP=(parseFloat(estimate.itemPrice)||0)/RATE
    const sc=shipping, cu=parseFloat(estimate.customs)||0, fr=parseFloat(estimate.feeRate)||25
    let offerPHP,profit
    if(estimate.profitMode==="amount"){
      const pa=parseFloat(estimate.profitTarget)||0
      offerPHP=(itemPHP+sc+cu+pa)/(1-fr/100)
      profit=offerPHP*(1-fr/100)-itemPHP-sc-cu
    } else {
      const pr=parseFloat(estimate.profitTarget)||0
      offerPHP=(itemPHP+sc+cu)/(1-fr/100-pr/100)
      profit=offerPHP*pr/100
    }
    const fee=offerPHP*fr/100
    setCalcResult({itemPHP:itemPHP.toFixed(0),shipping:sc,customs:cu,fee:fee.toFixed(0),feeRate:fr,totalCost:(itemPHP+sc+cu).toFixed(0),offerPHP:offerPHP.toFixed(0),profit:profit.toFixed(0),profitRate:offerPHP>0?((profit/offerPHP)*100).toFixed(1):"0"})
  }

  async function generateOffer(){
    if(!calcResult) return
    setGenerating(true)
    const bn=buyerMode==="select"?selectedBuyer:newBuyer.name
    try {
      const prompt = `You are a Shopee Philippines PASABUY seller. Generate friendly offer messages.\nProduct: ${product.name}\nOffer price: PHP ${calcResult.offerPHP}\n${bn?"Buyer name: "+bn:""}\nGenerate TWO short, casual, friendly messages (2-3 sentences each):\nEN: [English message]\nTL: [Tagalog message]`
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":import.meta.env.VITE_ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:400,messages:[{role:"user",content:prompt}]})})
      const data=await res.json(), text=data.content[0].text
      const em=text.match(/EN:\s*(.+?)(?=TL:|$)/s), tm=text.match(/TL:\s*(.+?)$/s)
      setOfferMsg({en:em?.[1]?.trim()||"",tl:tm?.[1]?.trim()||""})
    } catch(e){ alert("エラー: "+e.message) }
    setGenerating(false)
  }

  async function saveCase(){
    if(!product.name||!uid) return
    setSaving(true)
    const bn=isEdit?selectedBuyer:(buyerMode==="select"?selectedBuyer:newBuyer.name)
    if(!isEdit&&buyerMode==="new"&&newBuyer.name){
      const saved=JSON.parse(localStorage.getItem("sw_buyers")||"[]")
      if(!saved.find(b=>b.name===newBuyer.name)){
        saved.push({...newBuyer,id:Date.now(),createdAt:new Date().toISOString()})
        localStorage.setItem("sw_buyers",JSON.stringify(saved))
      }
    }
    const docData={uid,date:new Date().toISOString().split("T")[0],type:"pasabuy",status:initialData?.status||"new",buyerName:bn||"",product:product.name,weightG:product.weightG||"",qty:product.qty||"1",url:product.url||"",note:product.note||"",price:calcResult?.offerPHP||initialData?.price||"",shipping:String(calcResult?.shipping||shipping||""),fee:calcResult?.fee||initialData?.fee||"",feeRate:String(estimate.feeRate||"25"),itemPrice:estimate.itemPrice||"",customs:estimate.customs||"",profit:calcResult?.profit||initialData?.profit||"",offerEn:offerMsg.en||"",offerTl:offerMsg.tl||"",createdAt:initialData?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}
    try {
      const {db}=await import("../lib/firebase")
      if(isEdit){const{doc,updateDoc}=await import("firebase/firestore");await updateDoc(doc(db,"request_logs",initialData.id),docData)}
      else{const{collection,addDoc}=await import("firebase/firestore");await addDoc(collection(db,"request_logs"),docData)}
      onSaved()
    } catch(e){ alert("保存エラー: "+e.message) }
    setSaving(false)
  }

  const stepMax=isEdit?3:4
  const stepDot=(n)=>(<div style={{ display:"flex",alignItems:"center",gap:"0.3rem" }}><div style={{ width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.75rem",fontWeight:700,background:step>=n?"var(--orange)":"var(--surface)",color:step>=n?"#fff":"var(--dim2)",border:step>=n?"none":"1px solid var(--rim)" }}>{n}</div>{n<stepMax&&<div style={{ width:20,height:1,background:step>n?"var(--orange)":"var(--rim)" }} />}</div>)
  const stepLabels=isEdit?["","📦 商品情報","💰 見積もり","📨 オファー"]:["","👤 バイヤー","📦 商品情報","💰 見積もり","📨 オファー"]

  return (
    <div className="card" style={{ padding:"1.5rem",marginBottom:"1.25rem",border:"1px solid rgba(251,146,60,0.3)" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.5rem" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"0.1rem" }}>
          {(isEdit?[1,2,3]:[1,2,3,4]).map(n=>stepDot(n))}
          <div style={{ marginLeft:"0.75rem",fontSize:"0.82rem",color:"var(--orange)",fontWeight:700 }}>{stepLabels[step]}</div>
        </div>
        <div style={{ fontSize:"0.78rem",color:"var(--dim2)" }}>{isEdit?"✏️ 編集":"＋ 新規案件"}</div>
      </div>

      {!isEdit&&step===1&&(
        <div>
          <div style={{ display:"flex",gap:"0.5rem",marginBottom:"1rem" }}>
            {[["select","既存バイヤー"],["new","新規登録"]].map(([v,l])=>(<button key={v} onClick={()=>setBuyerMode(v)} style={{ padding:"0.4rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:buyerMode===v?"var(--orange)":"transparent",color:buyerMode===v?"#fff":"var(--dim2)",cursor:"pointer",fontSize:"0.8rem",fontWeight:buyerMode===v?700:400 }}>{l}</button>))}
          </div>
          {buyerMode==="select"
            ?<div><label style={lbl}>バイヤーを選択</label><select value={selectedBuyer} onChange={e=>setSelectedBuyer(e.target.value)} style={inp}><option value="">-- 選択してください --</option>{buyers.map(b=><option key={b.id} value={b.name}>{b.name} ({b.platform})</option>)}</select>{buyers.length===0&&<div style={{ fontSize:"0.72rem",color:"#f59e0b",marginTop:"0.5rem" }}>バイヤー未登録。「新規登録」を選んでください。</div>}</div>
            :<div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem" }}><div><label style={lbl}>名前</label><input style={inp} value={newBuyer.name} onChange={e=>setNewBuyer(f=>({...f,name:e.target.value}))} placeholder="バイヤー名" /></div><div><label style={lbl}>プラットフォーム</label><select value={newBuyer.platform} onChange={e=>setNewBuyer(f=>({...f,platform:e.target.value}))} style={inp}><option>Shopee</option><option>Lazada</option><option>Facebook</option><option>Instagram</option><option>その他</option></select></div><div><label style={lbl}>連絡先</label><input style={inp} value={newBuyer.contact} onChange={e=>setNewBuyer(f=>({...f,contact:e.target.value}))} placeholder="ID / 電話番号" /></div><div><label style={lbl}>メモ</label><input style={inp} value={newBuyer.note} onChange={e=>setNewBuyer(f=>({...f,note:e.target.value}))} placeholder="特記事項" /></div></div>
          }
          <div style={{ display:"flex",gap:"0.5rem",marginTop:"1.25rem" }}>
            <button onClick={()=>setStep(2)} style={{ padding:"0.5rem 1.5rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontWeight:700,cursor:"pointer" }}>次へ →</button>
            <button onClick={onCancel} style={{ padding:"0.5rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",cursor:"pointer" }}>キャンセル</button>
          </div>
        </div>
      )}

      {step===2&&(
        <div>
          {isEdit&&(<div style={{ marginBottom:"1rem" }}><label style={lbl}>👤 バイヤー名</label><select value={selectedBuyer} onChange={e=>setSelectedBuyer(e.target.value)} style={inp}><option value="">-- 未選択 --</option>{buyers.map(b=><option key={b.id} value={b.name}>{b.name}</option>)}{selectedBuyer&&!buyers.find(b=>b.name===selectedBuyer)&&<option value={selectedBuyer}>{selectedBuyer}</option>}</select></div>)}
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:"0.75rem",marginBottom:"1rem" }}>
            <div><label style={lbl}>📦 商品名</label><input style={inp} value={product.name} onChange={e=>setProduct(p=>({...p,name:e.target.value}))} placeholder="Nintendo Switch など" /></div>
            <div><label style={lbl}>⚖️ 重量 (g)</label><input type="number" style={inp} value={product.weightG} onChange={e=>setProduct(p=>({...p,weightG:e.target.value}))} placeholder="例: 500" />{product.weightG>0&&<div style={{ fontSize:"0.72rem",color:"#10b981",marginTop:"0.25rem" }}>→ 国際送料: ₱{calcShippingPHP(parseFloat(product.weightG)).toLocaleString()}</div>}</div>
            <div><label style={lbl}>🔢 数量</label><input type="number" style={inp} value={product.qty} onChange={e=>setProduct(p=>({...p,qty:e.target.value}))} placeholder="1" /></div>
            <div><label style={lbl}>🔗 仕入れURL</label><input style={inp} value={product.url} onChange={e=>setProduct(p=>({...p,url:e.target.value}))} placeholder="Amazon URL など" /></div>
            <div style={{ gridColumn:"1/-1" }}><label style={lbl}>📝 メモ（色・サイズ等）</label><textarea style={{...inp, minHeight:80, resize:"vertical", lineHeight:1.6}} value={product.note} onChange={e=>setProduct(p=>({...p,note:e.target.value}))} placeholder="カラー・サイズ、特記事項など自由に記入" /></div>
          </div>
          <div style={{ display:"flex",gap:"0.5rem" }}>
            {!isEdit&&<button onClick={()=>setStep(1)} style={{ padding:"0.5rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",cursor:"pointer" }}>← 戻る</button>}
            {isEdit&&<button onClick={onCancel} style={{ padding:"0.5rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",cursor:"pointer" }}>キャンセル</button>}
            <button onClick={()=>setStep(3)} disabled={!product.name} style={{ padding:"0.5rem 1.5rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontWeight:700,cursor:"pointer",opacity:!product.name?0.5:1 }}>次へ →</button>
          </div>
        </div>
      )}

      {step===3&&(
        <div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.25rem" }}>
            <div style={{ display:"grid",gap:"0.75rem" }}>
              <div><label style={lbl}>仕入れ価格 ¥</label><input type="number" style={inp} value={estimate.itemPrice} onChange={e=>setEstimate(f=>({...f,itemPrice:e.target.value}))} placeholder="0" /></div>
              <div style={{ padding:"0.5rem 0.75rem",background:"rgba(16,185,129,0.08)",borderRadius:6,fontSize:"0.78rem" }}>国際送料（SLS自動計算）: <strong style={{ color:"#10b981" }}>₱{shipping.toLocaleString()}</strong>{product.weightG&&<span style={{ color:"var(--dim2)" }}> ({product.weightG}g)</span>}</div>
              <div><label style={lbl}>関税・手数料 PHP（任意）</label><input type="number" style={inp} value={estimate.customs} onChange={e=>setEstimate(f=>({...f,customs:e.target.value}))} placeholder="0" /></div>
              <div><label style={lbl}>Shopee手数料率 % （売上ベース）</label><input type="number" style={inp} value={estimate.feeRate} onChange={e=>setEstimate(f=>({...f,feeRate:e.target.value}))} placeholder="25" /></div>
              <div>
                <label style={lbl}>利益目標</label>
                <div style={{ display:"flex",gap:"0.5rem",marginBottom:"0.4rem" }}>{[["amount","金額(PHP)"],["rate","利益率(%)"]].map(([v,l])=>(<button key={v} onClick={()=>setEstimate(f=>({...f,profitMode:v}))} style={{ padding:"0.3rem 0.75rem",borderRadius:6,border:"1px solid var(--rim)",background:estimate.profitMode===v?"var(--orange)":"transparent",color:estimate.profitMode===v?"#fff":"var(--dim2)",fontSize:"0.75rem",cursor:"pointer" }}>{l}</button>))}</div>
                <input type="number" style={inp} value={estimate.profitTarget} onChange={e=>setEstimate(f=>({...f,profitTarget:e.target.value}))} placeholder={estimate.profitMode==="amount"?"希望利益額 PHP":"利益率 %"} />
              </div>
              <button onClick={calcEstimate} style={{ padding:"0.65rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontWeight:700,cursor:"pointer" }}>計算する</button>
            </div>
            {calcResult&&(
              <div style={{ display:"grid",gap:"0.5rem",alignContent:"start" }}>
                <div style={{ fontSize:"0.75rem",fontWeight:700,color:"var(--dim2)",marginBottom:"0.25rem" }}>📊 見積もり結果</div>
                {[["仕入れ(PHP換算)","₱"+Number(calcResult.itemPHP).toLocaleString(),null],["国際送料","₱"+Number(calcResult.shipping).toLocaleString(),null],["Shopee手数料("+calcResult.feeRate+"%)","₱"+Number(calcResult.fee).toLocaleString(),"#f59e0b"],["推奨オファー価格","₱"+Number(calcResult.offerPHP).toLocaleString(),"var(--orange)"],["利益額","₱"+Number(calcResult.profit).toLocaleString(),"#10b981"],["利益率",calcResult.profitRate+"%","#10b981"]].map(([k,v,c])=>(<div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"0.45rem 0.7rem",background:"rgba(255,255,255,0.03)",borderRadius:6 }}><span style={{ fontSize:"0.74rem",color:"var(--dim2)" }}>{k}</span><span style={{ fontWeight:700,color:c||"var(--text)" }}>{v}</span></div>))}
              </div>
            )}
          </div>
          <div style={{ display:"flex",gap:"0.5rem",marginTop:"1rem" }}>
            <button onClick={()=>setStep(2)} style={{ padding:"0.5rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",cursor:"pointer" }}>← 戻る</button>
            <button onClick={()=>setStep(4)} style={{ padding:"0.5rem 1.5rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontWeight:700,cursor:"pointer" }}>次へ →</button>
            <button onClick={()=>setStep(4)} style={{ padding:"0.5rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",cursor:"pointer",fontSize:"0.8rem" }}>スキップ</button>
          </div>
        </div>
      )}

      {step===4&&(
        <div>
          {calcResult&&(<div style={{ padding:"0.75rem 1rem",background:"rgba(255,107,43,0.08)",borderRadius:8,marginBottom:"1rem",display:"flex",gap:"1.5rem",flexWrap:"wrap" }}><span style={{ fontSize:"0.82rem" }}>オファー: <strong style={{ color:"var(--orange)" }}>₱{Number(calcResult.offerPHP).toLocaleString()}</strong></span><span style={{ fontSize:"0.82rem" }}>利益: <strong style={{ color:"#10b981" }}>₱{Number(calcResult.profit).toLocaleString()} ({calcResult.profitRate}%)</strong></span><span style={{ fontSize:"0.82rem" }}>手数料: <strong style={{ color:"#f59e0b" }}>₱{Number(calcResult.fee).toLocaleString()} ({calcResult.feeRate}%)</strong></span></div>)}
          <button onClick={generateOffer} disabled={generating} style={{ width:"100%",padding:"0.65rem",borderRadius:8,border:"1px solid rgba(129,140,248,0.4)",background:"rgba(129,140,248,0.1)",color:"#818cf8",fontWeight:700,cursor:generating?"not-allowed":"pointer",marginBottom:"1rem" }}>{generating?"生成中...":"AIオファー文章を生成（英語/タガログ語）"}</button>
          {(offerMsg.en||offerMsg.tl)&&(<div style={{ display:"grid",gap:"0.75rem",marginBottom:"1rem" }}>{[["🇺🇸 English",offerMsg.en],["🇵🇭 Tagalog",offerMsg.tl]].map(([title,msg])=>msg&&(<div key={title}><div style={{ fontSize:"0.68rem",fontWeight:700,color:"var(--dim2)",marginBottom:"0.25rem" }}>{title}</div><div style={{ fontSize:"0.82rem",lineHeight:1.7,padding:"0.6rem 0.75rem",background:"rgba(255,255,255,0.03)",borderRadius:6,marginBottom:"0.3rem" }}>{msg}</div><button onClick={()=>navigator.clipboard.writeText(msg)} style={{ fontSize:"0.68rem",padding:"0.2rem 0.6rem",borderRadius:4,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",cursor:"pointer" }}>コピー</button></div>))}</div>)}
          <div style={{ display:"flex",gap:"0.5rem" }}>
            <button onClick={()=>setStep(3)} style={{ padding:"0.5rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",cursor:"pointer" }}>← 戻る</button>
            <button onClick={saveCase} disabled={saving} style={{ padding:"0.5rem 2rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontWeight:700,cursor:saving?"not-allowed":"pointer",fontSize:"0.9rem" }}>{saving?"保存中...":(isEdit?"✅ 更新する":"✅ 案件を保存")}</button>
            {isEdit&&<button onClick={onCancel} style={{ padding:"0.5rem 1rem",borderRadius:8,border:"1px solid var(--rim)",background:"transparent",color:"var(--dim2)",cursor:"pointer" }}>キャンセル</button>}
          </div>
        </div>
      )}
    </div>
  )
}

function ChatLog({ item, uid }) {
  const [logs, setLogs] = useState([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { if (open) loadLogs() }, [open])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }) }, [logs])

  async function loadLogs() {
    try {
      const { db } = await import("../lib/firebase")
      const { collection, query, where, orderBy, getDocs } = await import("firebase/firestore")
      const q = query(collection(db, "pasabuy_logs"), where("requestId","==",item.id), orderBy("createdAt","asc"))
      const snap = await getDocs(q)
      setLogs(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    } catch(e) { console.error(e) }
  }

  async function sendLog() {
    if (!text.trim()) return
    setSending(true)
    try {
      const { db } = await import("../lib/firebase")
      const { collection, addDoc } = await import("firebase/firestore")
      const now = new Date().toISOString()
      await addDoc(collection(db, "pasabuy_logs"), { requestId:item.id, uid, text:text.trim(), createdAt:now })
      setLogs(prev => [...prev, { text:text.trim(), createdAt:now }])
      setText("")
    } catch(e) { alert("送信エラー: "+e.message) }
    setSending(false)
  }

  function fmtTime(iso) {
    if (!iso) return ""
    const d = new Date(iso)
    return (d.getMonth()+1)+"/"+d.getDate()+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")
  }

  return (
    <div style={{ marginTop:"0.75rem" }}>
      <button onClick={() => setOpen(o => !o)} style={{ fontSize:"0.72rem", color:"var(--orange)", background:"transparent", border:"1px solid rgba(255,107,43,0.3)", borderRadius:6, padding:"0.25rem 0.7rem", cursor:"pointer", fontWeight:700 }}>
        💬 やりとり {logs.length > 0 ? `(${logs.length})` : ""} {open ? "▲" : "▼"}
      </button>
      {open && (
        <div style={{ marginTop:"0.5rem", border:"1px solid var(--rim)", borderRadius:10, overflow:"hidden" }}>
          <div style={{ maxHeight:220, overflowY:"auto", padding:"0.75rem", display:"flex", flexDirection:"column", gap:"0.5rem", background:"rgba(255,255,255,0.02)" }}>
            {logs.length === 0 && <div style={{ textAlign:"center", color:"var(--dim2)", fontSize:"0.75rem", padding:"1rem" }}>まだやりとりはありません</div>}
            {logs.map((l, i) => (
              <div key={i} style={{ background:"rgba(255,107,43,0.06)", borderRadius:8, padding:"0.5rem 0.75rem", border:"1px solid rgba(255,107,43,0.15)" }}>
                <div style={{ fontSize:"0.78rem", lineHeight:1.6, color:"var(--text)", whiteSpace:"pre-wrap" }}>{l.text}</div>
                <div style={{ fontSize:"0.62rem", color:"var(--dim2)", marginTop:"0.2rem", textAlign:"right" }}>{fmtTime(l.createdAt)}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding:"0.5rem", borderTop:"1px solid var(--rim)", display:"flex", gap:"0.5rem", background:"var(--surface)" }}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter" && e.metaKey) sendLog() }}
              placeholder="メモ・やりとりを追記... (Cmd+Enterで送信)"
              style={{ flex:1, padding:"0.4rem 0.6rem", borderRadius:8, border:"1px solid var(--rim)", background:"var(--card)", color:"var(--text)", fontSize:"0.78rem", resize:"none", minHeight:52, outline:"none", lineHeight:1.5, fontFamily:"inherit" }}
            />
            <button onClick={sendLog} disabled={sending || !text.trim()} style={{ padding:"0.4rem 0.9rem", borderRadius:8, border:"none", background:"var(--orange)", color:"#fff", fontWeight:700, cursor:sending||!text.trim()?"not-allowed":"pointer", fontSize:"0.75rem", opacity:!text.trim()?0.5:1, alignSelf:"flex-end" }}>
              {sending ? "..." : "送信"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RequestsPage({ uid }) {
  const [statusTab, setStatusTab] = useState("all")
  const [items, setItems] = useState([])
  const [creating, setCreating] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [aiTarget, setAiTarget] = useState(null)
  const [buyers, setBuyers] = useState(()=>{ try{ return JSON.parse(localStorage.getItem("sw_buyers")||"[]") }catch{ return [] } })

  useEffect(()=>{ if(uid) loadItems() },[uid])

  function refreshBuyers(){ try{ setBuyers(JSON.parse(localStorage.getItem("sw_buyers")||"[]")) }catch{} }

  async function loadItems(){
    try {
      const {db}=await import("../lib/firebase")
      const {collection,query,where,getDocs}=await import("firebase/firestore")
      const q=query(collection(db,"request_logs"),where("uid","==",uid))
      const snap=await getDocs(q)
      const docs=snap.docs.map(d=>({id:d.id,...d.data()}))
      docs.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""))
      setItems(docs)
    } catch(e){ console.error(e) }
  }

  async function updateStatus(id,status){
    try {
      const {db}=await import("../lib/firebase")
      const {doc,updateDoc}=await import("firebase/firestore")
      await updateDoc(doc(db,"request_logs",id),{status})
      setItems(prev=>prev.map(i=>i.id===id?{...i,status}:i))
    } catch(e){ alert("更新エラー: "+e.message) }
  }

  async function deleteItem(id){
    if(!confirm("削除しますか？")) return
    try {
      const {db}=await import("../lib/firebase")
      const {doc,deleteDoc}=await import("firebase/firestore")
      await deleteDoc(doc(db,"request_logs",id))
      setItems(prev=>prev.filter(i=>i.id!==id))
    } catch(e){ alert("削除エラー: "+e.message) }
  }

  const filteredItems=statusTab==="all"?items:items.filter(i=>(i.status||"new")===statusTab)
  const counts={}
  STATUS_TABS.forEach(s=>{ counts[s]=s==="all"?items.length:items.filter(i=>(i.status||"new")===s).length })
  const showForm=creating||editingItem

  return (
    <div style={{ padding:"1.5rem" }}>
      {aiTarget&&<AIModal item={aiTarget} onClose={()=>setAiTarget(null)} />}
      {!showForm&&<Dashboard items={items} />}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem" }}>
        <div style={{ fontSize:"0.88rem",fontWeight:700,color:"var(--text)" }}>📋 案件一覧</div>
        {!showForm&&(<button onClick={()=>{ setCreating(true); setEditingItem(null) }} style={{ padding:"0.5rem 1.25rem",borderRadius:8,border:"none",background:"var(--orange)",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:"0.82rem" }}>＋ 新規案件</button>)}
      </div>
      {showForm&&(<CaseForm uid={uid} buyers={buyers} initialData={editingItem} onSaved={()=>{ setCreating(false); setEditingItem(null); refreshBuyers(); loadItems() }} onCancel={()=>{ setCreating(false); setEditingItem(null) }} />)}
      {!showForm&&(
        <>
          <div style={{ display:"flex",gap:"0.4rem",marginBottom:"1rem",flexWrap:"wrap",borderBottom:"1px solid var(--rim)",paddingBottom:"0.75rem" }}>
            {STATUS_TABS.map(s=>(<button key={s} onClick={()=>setStatusTab(s)} style={{ padding:"0.4rem 0.9rem",borderRadius:8,border:"none",fontSize:"0.8rem",background:statusTab===s?(s==="all"?"var(--orange)":STATUS_CONFIG[s]?.bg||"var(--orange)"):"transparent",color:statusTab===s?(s==="all"?"#fff":STATUS_CONFIG[s]?.color||"#fff"):"var(--dim2)",fontWeight:statusTab===s?700:400,cursor:"pointer",outline:statusTab===s&&s!=="all"?"1px solid "+(STATUS_CONFIG[s]?.color||"transparent"):"none" }}>{STATUS_LABELS[s]} <span style={{ fontSize:"0.7rem",opacity:0.8 }}>({counts[s]})</span></button>))}
          </div>
          {filteredItems.length===0
            ?<div className="card" style={{ padding:"2rem",textAlign:"center",color:"var(--dim2)" }}>{statusTab==="all"?"案件がありません。「＋ 新規案件」から追加してください。":`「${STATUS_LABELS[statusTab]}」の案件はありません。`}</div>
            :<div style={{ display:"grid",gap:"0.5rem" }}>
              {filteredItems.map(item=>{
                const st=STATUS_CONFIG[item.status||"new"]
                return (
                  <div key={item.id} className="card" style={{ padding:"1rem 1.25rem" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:"0.6rem",flexWrap:"wrap" }}>
                      <div style={{ fontSize:"0.75rem",color:"var(--dim2)",minWidth:60 }}>{item.date}</div>
                      {item.buyerName&&<div style={{ padding:"0.15rem 0.5rem",borderRadius:6,background:"rgba(129,140,248,0.12)",color:"#818cf8",fontSize:"0.72rem" }}>👤 {item.buyerName}</div>}
                      <div style={{ flex:1,fontWeight:700 }}>{item.product}</div>
                      {item.qty&&item.qty!=="1"&&<div style={{ fontSize:"0.78rem",color:"var(--dim2)" }}>×{item.qty}</div>}
                      {item.price&&<div style={{ fontSize:"0.85rem",color:"var(--orange)",fontWeight:700 }}>₱{Number(item.price).toLocaleString()}</div>}
                      {item.profit&&<div style={{ fontSize:"0.72rem",color:"#10b981" }}>+₱{Number(item.profit).toLocaleString()}</div>}
                      <select value={item.status||"new"} onChange={e=>updateStatus(item.id,e.target.value)} style={{ padding:"0.2rem 0.5rem",borderRadius:6,border:"1px solid "+st.color,background:st.bg,color:st.color,fontSize:"0.72rem",fontWeight:700,cursor:"pointer" }}>
                        {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <button onClick={()=>{ setEditingItem(item); setCreating(false) }} style={{ padding:"0.3rem 0.6rem",borderRadius:6,border:"1px solid rgba(251,146,60,0.3)",background:"rgba(251,146,60,0.1)",color:"var(--orange)",fontSize:"0.72rem",cursor:"pointer" }}>✏️</button>
                      <button onClick={()=>setAiTarget(item)} style={{ padding:"0.3rem 0.6rem",borderRadius:6,border:"1px solid rgba(129,140,248,0.3)",background:"rgba(129,140,248,0.1)",color:"#818cf8",fontSize:"0.72rem",cursor:"pointer" }}>AI</button>
                      <button onClick={()=>deleteItem(item.id)} style={{ padding:"0.3rem 0.6rem",borderRadius:6,border:"1px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.1)",color:"#ef4444",fontSize:"0.72rem",cursor:"pointer" }}>削除</button>
                    </div>
                    {item.url&&(<div style={{ marginTop:"0.4rem",fontSize:"0.72rem" }}><a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color:"#818cf8",textDecoration:"none" }}>🔗 仕入れURL</a></div>)}
                    {item.note&&<div style={{ fontSize:"0.72rem",color:"var(--dim2)",marginTop:"0.25rem" }}>{item.note}</div>}
                    <ChatLog item={item} uid={uid} />
                    {item.offerEn&&(<div style={{ marginTop:"0.5rem",padding:"0.5rem 0.75rem",background:"rgba(255,255,255,0.02)",borderRadius:6,fontSize:"0.75rem",color:"var(--dim2)",borderLeft:"2px solid rgba(129,140,248,0.4)" }}>{item.offerEn}</div>)}
                  </div>
                )
              })}
            </div>
          }
        </>
      )}
    </div>
  )
}
