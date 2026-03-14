import { useState, useEffect, useMemo } from "react"

const getShippingData = (weightInGrams, zone) => {
  const roundedWeight = Math.ceil(weightInGrams / 50) * 50
  const rates = {
    50:{A:56,B:76,C:106,D:106,ESF:50},100:{A:81,B:101,C:131,D:131,ESF:50},
    150:{A:106,B:126,C:156,D:156,ESF:50},200:{A:131,B:151,C:181,D:181,ESF:50},
    250:{A:156,B:176,C:206,D:206,ESF:50},300:{A:181,B:201,C:231,D:231,ESF:50},
    350:{A:206,B:226,C:256,D:256,ESF:50},400:{A:231,B:251,C:281,D:281,ESF:50},
    450:{A:256,B:276,C:306,D:306,ESF:50},500:{A:281,B:301,C:331,D:331,ESF:50},
    550:{A:306,B:326,C:356,D:356,ESF:50},600:{A:331,B:351,C:381,D:381,ESF:50},
    650:{A:356,B:376,C:406,D:406,ESF:50},700:{A:381,B:401,C:431,D:431,ESF:50},
    750:{A:406,B:426,C:456,D:456,ESF:50},800:{A:431,B:451,C:481,D:481,ESF:50},
    850:{A:456,B:476,C:506,D:506,ESF:50},900:{A:481,B:501,C:531,D:531,ESF:50},
    950:{A:506,B:526,C:556,D:556,ESF:50},1000:{A:531,B:551,C:581,D:581,ESF:50},
    1500:{A:781,B:801,C:831,D:831,ESF:50},2000:{A:1031,B:1051,C:1081,D:1081,ESF:50},
    2500:{A:1281,B:1301,C:1331,D:1331,ESF:50},3000:{A:1531,B:1551,C:1581,D:1581,ESF:50},
  }
  if (roundedWeight > 3000) {
    const extra = (roundedWeight - 3000) / 50
    return { actualFee: rates[3000][zone] + extra * 25, esfAmount: 50 }
  }
  const keys = Object.keys(rates).map(Number).sort((a,b)=>a-b)
  const key = keys.find(k => k >= roundedWeight) || 3000
  return { actualFee: rates[key][zone], esfAmount: rates[key].ESF }
}

const inp = { width:"100%", padding:"0.6rem 0.8rem", borderRadius:10, border:"1px solid var(--rim)", background:"var(--surface)", color:"var(--text)", fontSize:"1.1rem", fontWeight:700, boxSizing:"border-box" }
const lbl = { fontSize:"0.65rem", fontWeight:700, color:"var(--dim2)", display:"block", marginBottom:"0.3rem", textTransform:"uppercase", letterSpacing:"0.05em" }
const sel = { ...inp, cursor:"pointer" }

const ZONE_INFO = {
  A:"Metro Manila / Laguna / Cavite / Bulacan / Rizal",
  B:"South Luzon (その他) / North Luzon (その他)",
  C:"Visayas", D:"Mindanao"
}

export default function BreakEvenPage({ uid }) {
  const [sellingPrice, setSellingPrice] = useState("")
  const [costPrice, setCostPrice] = useState("")
  const [productWeight, setProductWeight] = useState("")
  const [domesticShipping, setDomesticShipping] = useState(0)
  const [shippingZone, setShippingZone] = useState("A")
  const [quantity, setQuantity] = useState(1)
  const [enableMultiItem, setEnableMultiItem] = useState(false)
  const [exchangeRate, setExchangeRate] = useState(2.65)
  const [isRateLoading, setIsRateLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isNewSeller, setIsNewSeller] = useState(false)
  const [commissionFeeRate, setCommissionFeeRate] = useState(8.46)
  const [cbPlatformShippingRate, setCbPlatformShippingRate] = useState(5.6)
  const [enableCbPlatformShipping, setEnableCbPlatformShipping] = useState(true)
  const [enableCCB, setEnableCCB] = useState(false)
  const [ccbRate, setCcbRate] = useState(3.36)
  const [enableMDV, setEnableMDV] = useState(false)
  const [mdvRate, setMdvRate] = useState(4.0)
  const [payoneerFeeRate, setPayoneerFeeRate] = useState(2.0)
  const [consumptionTaxRate, setConsumptionTaxRate] = useState(10)
  const [enableTaxRefund, setEnableTaxRefund] = useState(true)
  const [packagingWeight, setPackagingWeight] = useState(50)
  const transactionFeeRate = 2.24
  const cbInfrastructureFee = 5

  useEffect(() => {
    setIsRateLoading(true)
    fetch("https://open.er-api.com/v6/latest/PHP")
      .then(r => r.json())
      .then(d => { if (d?.rates?.JPY) setExchangeRate(parseFloat(d.rates.JPY).toFixed(2)) })
      .catch(() => {})
      .finally(() => setIsRateLoading(false))
  }, [])

  useEffect(() => { if (uid) loadSettings() }, [uid])

  async function loadSettings() {
    try {
      const { db } = await import("../lib/firebase")
      const { doc, getDoc } = await import("firebase/firestore")
      const snap = await getDoc(doc(db, "breakeven_settings", uid))
      if (snap.exists()) {
        const s = snap.data()
        if (s.isNewSeller !== undefined) setIsNewSeller(s.isNewSeller)
        if (s.commissionFeeRate) setCommissionFeeRate(s.commissionFeeRate)
        if (s.cbPlatformShippingRate) setCbPlatformShippingRate(s.cbPlatformShippingRate)
        if (s.enableCbPlatformShipping !== undefined) setEnableCbPlatformShipping(s.enableCbPlatformShipping)
        if (s.enableCCB !== undefined) setEnableCCB(s.enableCCB)
        if (s.ccbRate) setCcbRate(s.ccbRate)
        if (s.enableMDV !== undefined) setEnableMDV(s.enableMDV)
        if (s.mdvRate) setMdvRate(s.mdvRate)
        if (s.payoneerFeeRate) setPayoneerFeeRate(s.payoneerFeeRate)
        if (s.consumptionTaxRate) setConsumptionTaxRate(s.consumptionTaxRate)
        if (s.enableTaxRefund !== undefined) setEnableTaxRefund(s.enableTaxRefund)
        if (s.shippingZone) setShippingZone(s.shippingZone)
        if (s.packagingWeight) setPackagingWeight(s.packagingWeight)
      }
    } catch(e) { console.error(e) }
  }

  async function saveSettings() {
    try {
      const { db } = await import("../lib/firebase")
      const { doc, setDoc } = await import("firebase/firestore")
      await setDoc(doc(db, "breakeven_settings", uid), {
        isNewSeller, commissionFeeRate, cbPlatformShippingRate, enableCbPlatformShipping,
        enableCCB, ccbRate, enableMDV, mdvRate, payoneerFeeRate,
        consumptionTaxRate, enableTaxRefund, shippingZone, packagingWeight,
        updatedAt: new Date().toISOString()
      })
      alert("設定を保存しました")
      setShowSettings(false)
    } catch(e) { alert("保存エラー: " + e.message) }
  }

  const calc = useMemo(() => {
    const qty = enableMultiItem ? parseInt(quantity) || 1 : 1
    const price = parseFloat(sellingPrice) || 0
    const cost = parseFloat(costPrice) || 0
    const domShip = parseFloat(domesticShipping) || 0
    const prodWeight = parseFloat(productWeight) || 0
    const pkgWeight = parseFloat(packagingWeight) || 0
    const totalWeight = (prodWeight * qty) + pkgWeight
    const appliedCommissionRate = isNewSeller ? 0 : commissionFeeRate
    let serviceFeeTotalRate = 0
    if (enableCbPlatformShipping) serviceFeeTotalRate += cbPlatformShippingRate
    if (enableCCB) serviceFeeTotalRate += ccbRate
    if (enableMDV) serviceFeeTotalRate += mdvRate
    const totalFeeRate = (transactionFeeRate + appliedCommissionRate + serviceFeeTotalRate) / 100
    const effectiveExch = exchangeRate * (1 - payoneerFeeRate / 100)
    const shipData = getShippingData(totalWeight, shippingZone)
    const sellerShippingPHP = Math.max(0, shipData.actualFee - shipData.esfAmount)
    const totalCostWithTax = (cost + domShip) * qty
    const taxRate = consumptionTaxRate / 100
    const taxRefund = enableTaxRefund ? (totalCostWithTax - (totalCostWithTax / (1 + taxRate))) : 0
    const netCostJPY = totalCostWithTax - taxRefund
    const totalSellingPrice = price * qty
    const netIncomePHP = totalSellingPrice * (1 - totalFeeRate) - sellerShippingPHP - cbInfrastructureFee
    const netIncomeJPY = netIncomePHP * effectiveExch
    const profit = netIncomeJPY - netCostJPY
    const profitPerItem = profit / qty
    const breakEven = ((netCostJPY / effectiveExch) + sellerShippingPHP + cbInfrastructureFee) / (qty * (1 - totalFeeRate))
    const roi = netCostJPY > 0 ? (profit / netCostJPY) * 100 : 0
    const profitMargin = totalSellingPrice > 0 ? (profit / (totalSellingPrice * exchangeRate)) * 100 : 0
    return { profit, profitPerItem, taxRefund, qty, netCostJPY, totalWeight, sellerShippingPHP, totalFeeRate, shipData, roi, profitMargin, netIncomeJPY, totalSellingPrice, cbInfrastructureFee, serviceFeeTotalRate, appliedCommissionRate, totalCostWithTax, breakEven, effectiveExch }
  }, [sellingPrice, costPrice, domesticShipping, productWeight, shippingZone, quantity, enableMultiItem, exchangeRate, isNewSeller, commissionFeeRate, cbPlatformShippingRate, enableCbPlatformShipping, enableCCB, ccbRate, enableMDV, mdvRate, payoneerFeeRate, consumptionTaxRate, enableTaxRefund, packagingWeight])

  const fmt = n => new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(n)
  const fmtPHP = n => "₱" + new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(n)
  const profitColor = calc.profit > 0 ? "#22c55e" : calc.profit < 0 ? "#ef4444" : "var(--dim2)"
  const profitBg = calc.profit > 0 ? "rgba(34,197,94,0.1)" : calc.profit < 0 ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.03)"

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div>
          <div style={{ fontWeight:800, fontSize:"1.1rem" }}>🧮 BreakEvenCalc</div>
          <div style={{ fontSize:"0.72rem", color:"var(--dim2)", marginTop:2, display:"flex", gap:6 }}>
            {isNewSeller && <span style={{ color:"#22c55e", background:"rgba(34,197,94,0.1)", padding:"0.1rem 0.5rem", borderRadius:10, fontSize:"0.65rem", fontWeight:700 }}>新規特典</span>}
            {enableTaxRefund && <span style={{ color:"#3b82f6", background:"rgba(59,130,246,0.1)", padding:"0.1rem 0.5rem", borderRadius:10, fontSize:"0.65rem", fontWeight:700 }}>還付ON</span>}
            {enableMultiItem && calc.qty > 1 && <span style={{ color:"#a78bfa", background:"rgba(167,139,250,0.1)", padding:"0.1rem 0.5rem", borderRadius:10, fontSize:"0.65rem", fontWeight:700 }}>x{calc.qty}個</span>}
          </div>
        </div>
        <button onClick={() => setShowSettings(!showSettings)}
          style={{ padding:"0.5rem", borderRadius:8, border:"1px solid var(--rim)", background:showSettings?"var(--orange)":"transparent", color:showSettings?"#fff":"var(--dim2)", cursor:"pointer", fontSize:"1rem" }}>
          ⚙️
        </button>
      </div>

      <div className="card" style={{ padding:"0.75rem 1rem", marginBottom:"0.75rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:"0.78rem", color:"var(--dim2)" }}>{isRateLoading ? "⟳ 取得中..." : "💱 為替レート"}</span>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <input type="number" step="0.01" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)}
            style={{ ...inp, width:70, textAlign:"right", color:"var(--orange)", padding:"0.3rem 0.5rem" }} />
          <span style={{ fontSize:"0.75rem", color:"var(--dim2)" }}>₱/JPY</span>
        </div>
      </div>

      <div className="card" style={{ padding:"1.25rem", marginBottom:"0.75rem" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ padding:"0.75rem", background:"rgba(249,115,22,0.08)", borderRadius:10, border:"1px solid rgba(249,115,22,0.3)" }}>
            <label style={{ ...lbl, color:"var(--orange)" }}>① 販売価格 (PHP)</label>
            <div style={{ position:"relative" }}>
              <input type="number" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} placeholder="500"
                style={{ ...inp, fontSize:"1.5rem", paddingRight:"2.5rem", border:"1px solid rgba(249,115,22,0.4)" }} />
              <span style={{ position:"absolute", right:"0.75rem", top:"50%", transform:"translateY(-50%)", color:"var(--orange)", fontWeight:700 }}>₱</span>
            </div>
            {enableMultiItem && calc.qty > 1 && <div style={{ fontSize:"0.72rem", color:"#a78bfa", marginTop:4 }}>合計: {fmtPHP(calc.totalSellingPrice)}</div>}
          </div>

          <div style={{ padding:"0.75rem", background:"rgba(59,130,246,0.08)", borderRadius:10, border:"1px solid rgba(59,130,246,0.3)" }}>
            <label style={{ ...lbl, color:"#3b82f6" }}>② 仕入原価 (JPY・税込)</label>
            <div style={{ position:"relative" }}>
              <input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="800"
                style={{ ...inp, fontSize:"1.5rem", paddingRight:"2.5rem", border:"1px solid rgba(59,130,246,0.4)" }} />
              <span style={{ position:"absolute", right:"0.75rem", top:"50%", transform:"translateY(-50%)", color:"#3b82f6", fontWeight:700 }}>円</span>
            </div>
            {enableMultiItem && calc.qty > 1 && <div style={{ fontSize:"0.72rem", color:"#a78bfa", marginTop:4 }}>合計: ¥{fmt(calc.totalCostWithTax)}</div>}
          </div>

          <div style={{ padding:"0.75rem", background:"rgba(34,197,94,0.08)", borderRadius:10, border:"1px solid rgba(34,197,94,0.3)" }}>
            <label style={{ ...lbl, color:"#22c55e" }}>③ 商品重量 (g)</label>
            <div style={{ position:"relative" }}>
              <input type="number" value={productWeight} onChange={e => setProductWeight(e.target.value)} placeholder="200"
                style={{ ...inp, fontSize:"1.5rem", paddingRight:"2.5rem", border:"1px solid rgba(34,197,94,0.4)" }} />
              <span style={{ position:"absolute", right:"0.75rem", top:"50%", transform:"translateY(-50%)", color:"#22c55e", fontWeight:700 }}>g</span>
            </div>
            <div style={{ fontSize:"0.68rem", color:"#22c55e", marginTop:4 }}>梱包資材: {packagingWeight}g / 総重量: {calc.totalWeight}g → {Math.ceil(calc.totalWeight/50)*50}g</div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
            <div>
              <label style={lbl}>国内送料 (円・税込)</label>
              <input type="number" value={domesticShipping} onChange={e => setDomesticShipping(e.target.value)} placeholder="0" style={inp} />
            </div>
            <div>
              <label style={lbl}>配送ゾーン</label>
              <select value={shippingZone} onChange={e => setShippingZone(e.target.value)} style={sel}>
                <option value="A">Zone A</option>
                <option value="B">Zone B</option>
                <option value="C">Zone C</option>
                <option value="D">Zone D</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize:"0.68rem", color:"var(--dim2)", background:"rgba(255,255,255,0.03)", padding:"0.4rem 0.75rem", borderRadius:8 }}>{ZONE_INFO[shippingZone]}</div>
        </div>
      </div>

      <div className="card" style={{ padding:"0.85rem 1rem", marginBottom:"0.75rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontWeight:700, fontSize:"0.85rem" }}>📦 複数購入シミュレーション</div>
            <div style={{ fontSize:"0.68rem", color:"var(--dim2)" }}>まとめ買いの利益率を確認</div>
          </div>
          <Toggle value={enableMultiItem} onChange={setEnableMultiItem} />
        </div>
        {enableMultiItem && (
          <div style={{ marginTop:"0.75rem", display:"flex", alignItems:"center", gap:"1rem", justifyContent:"center" }}>
            <button onClick={() => setQuantity(Math.max(1, quantity-1))}
              style={{ width:36, height:36, borderRadius:"50%", border:"none", background:"rgba(167,139,250,0.15)", color:"#a78bfa", fontSize:"1.2rem", fontWeight:700, cursor:"pointer" }}>-</button>
            <div style={{ textAlign:"center" }}>
              <input type="number" min="1" value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value)||1))}
                style={{ ...inp, width:80, fontSize:"1.8rem", textAlign:"center", color:"#a78bfa", border:"none", background:"transparent" }} />
              <div style={{ fontSize:"0.65rem", color:"var(--dim2)" }}>個</div>
            </div>
            <button onClick={() => setQuantity(quantity+1)}
              style={{ width:36, height:36, borderRadius:"50%", border:"none", background:"rgba(167,139,250,0.15)", color:"#a78bfa", fontSize:"1.2rem", fontWeight:700, cursor:"pointer" }}>+</button>
          </div>
        )}
      </div>

      <div className="card" style={{ padding:"1.5rem", marginBottom:"0.75rem", background:profitBg, border:`1px solid ${profitColor}40` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"0.5rem" }}>
          <div style={{ fontSize:"0.72rem", color:"var(--dim2)" }}>推定粗利益{enableTaxRefund?" (還付込)":""}</div>
          {calc.profit < 0 && sellingPrice && <span style={{ fontSize:"0.65rem", fontWeight:700, color:"#ef4444", background:"rgba(239,68,68,0.15)", padding:"0.15rem 0.6rem", borderRadius:10 }}>⚠️ 赤字</span>}
        </div>
        <div style={{ fontSize:"2.5rem", fontWeight:800, color:profitColor, marginBottom:"0.75rem" }}>
          {fmt(calc.profit)}<span style={{ fontSize:"1.2rem", marginLeft:4 }}>円</span>
        </div>
        {enableMultiItem && calc.qty > 1 && (
          <div style={{ padding:"0.6rem 0.75rem", background:"rgba(255,255,255,0.05)", borderRadius:8, marginBottom:"0.75rem" }}>
            <div style={{ fontSize:"0.65rem", color:"var(--dim2)" }}>1個あたり</div>
            <div style={{ fontSize:"1.3rem", fontWeight:700, color:profitColor }}>¥{fmt(calc.profitPerItem)}</div>
          </div>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"0.5rem", borderTop:"1px solid var(--rim)", paddingTop:"0.75rem" }}>
          {[
            { label:"損益分岐", value:fmtPHP(calc.breakEven) },
            { label:"利益率", value:calc.profitMargin.toFixed(1)+"%" },
            { label:"ROI", value:calc.roi.toFixed(1)+"%" },
          ].map(s => (
            <div key={s.label} style={{ textAlign:"center" }}>
              <div style={{ fontSize:"0.62rem", color:"var(--dim2)", marginBottom:2 }}>{s.label}</div>
              <div style={{ fontSize:"0.85rem", fontWeight:700 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {sellingPrice && (
        <div className="card" style={{ padding:"1rem", marginBottom:"0.75rem" }}>
          <div style={{ fontSize:"0.72rem", fontWeight:700, color:"var(--dim2)", marginBottom:"0.6rem", textTransform:"uppercase" }}>💰 コスト内訳</div>
          {[
            { label:"仕入原価 (税込)", value:"¥"+fmt(calc.totalCostWithTax) },
            enableTaxRefund ? { label:"消費税還付", value:"+¥"+fmt(calc.taxRefund), color:"#22c55e" } : null,
            { label:"実質仕入コスト", value:"¥"+fmt(calc.netCostJPY), color:"var(--orange)" },
            { label:"Shopee手数料合計", value:(calc.totalFeeRate*100).toFixed(2)+"% = "+fmtPHP(parseFloat(sellingPrice)*calc.qty*calc.totalFeeRate), color:"#ef4444" },
            { label:"SLS送料 (セラー負担)", value:fmtPHP(calc.sellerShippingPHP), color:"#f59e0b" },
            { label:"CB Infra Fee", value:fmtPHP(calc.cbInfrastructureFee), color:"#f59e0b" },
            { label:"純収入 (PHP)", value:fmtPHP(calc.netIncomeJPY/calc.effectiveExch), color:"#3b82f6" },
            { label:"純収入 (JPY・Payoneer後)", value:"¥"+fmt(calc.netIncomeJPY), color:"#3b82f6" },
          ].filter(Boolean).map((r,i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:"0.78rem", padding:"0.3rem 0", borderBottom:"1px solid var(--rim)" }}>
              <span style={{ color:"var(--dim2)" }}>{r.label}</span>
              <span style={{ fontWeight:700, color:r.color||"var(--text)" }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}

      {showSettings && (
        <div className="card" style={{ padding:"1.25rem", marginBottom:"0.75rem", border:"1px solid rgba(249,115,22,0.3)" }}>
          <div style={{ fontWeight:700, fontSize:"0.9rem", marginBottom:"1rem" }}>⚙️ 手数料・設定</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.6rem 0.75rem", background:"rgba(34,197,94,0.08)", borderRadius:8, border:"1px solid rgba(34,197,94,0.2)" }}>
              <div>
                <div style={{ fontSize:"0.8rem", fontWeight:700 }}>新規セラー特典 (手数料0%)</div>
              </div>
              <Toggle value={isNewSeller} onChange={setIsNewSeller} />
            </div>
            <SettingRow label="販売コミッション (%)" value={commissionFeeRate} onChange={setCommissionFeeRate} disabled={isNewSeller} />
            <SettingRow label="Payoneer手数料 (%)" value={payoneerFeeRate} onChange={setPayoneerFeeRate} />
            <div style={{ padding:"0.6rem 0.75rem", background:"rgba(255,255,255,0.03)", borderRadius:8, border:"1px solid var(--rim)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:enableCbPlatformShipping?"0.5rem":0 }}>
                <div style={{ fontSize:"0.78rem", fontWeight:700 }}>CB Platform Shipping</div>
                <Toggle value={enableCbPlatformShipping} onChange={setEnableCbPlatformShipping} />
              </div>
              {enableCbPlatformShipping && <SettingRow label="率 (%)" value={cbPlatformShippingRate} onChange={setCbPlatformShippingRate} />}
            </div>
            <div style={{ padding:"0.6rem 0.75rem", background:"rgba(255,255,255,0.03)", borderRadius:8, border:"1px solid var(--rim)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:enableCCB?"0.5rem":0 }}>
                <div style={{ fontSize:"0.78rem", fontWeight:700 }}>CCB (Coins Cashback)</div>
                <Toggle value={enableCCB} onChange={setEnableCCB} />
              </div>
              {enableCCB && <SettingRow label="率 (%)" value={ccbRate} onChange={setCcbRate} />}
            </div>
            <div style={{ padding:"0.6rem 0.75rem", background:"rgba(255,255,255,0.03)", borderRadius:8, border:"1px solid var(--rim)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:enableMDV?"0.5rem":0 }}>
                <div style={{ fontSize:"0.78rem", fontWeight:700 }}>MDV (Mega Discount)</div>
                <Toggle value={enableMDV} onChange={setEnableMDV} />
              </div>
              {enableMDV && <SettingRow label="率 (%)" value={mdvRate} onChange={setMdvRate} />}
            </div>
            <div style={{ padding:"0.6rem 0.75rem", background:"rgba(59,130,246,0.08)", borderRadius:8, border:"1px solid rgba(59,130,246,0.2)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.5rem" }}>
                <div style={{ fontSize:"0.78rem", fontWeight:700 }}>消費税還付 (輸出免税)</div>
                <Toggle value={enableTaxRefund} onChange={setEnableTaxRefund} />
              </div>
              <div style={{ display:"flex", gap:"0.5rem" }}>
                {[10, 8].map(r => (
                  <button key={r} onClick={() => setConsumptionTaxRate(r)}
                    style={{ flex:1, padding:"0.4rem", borderRadius:8, border:"none", background:consumptionTaxRate===r?"var(--orange)":"var(--surface)", color:consumptionTaxRate===r?"#fff":"var(--dim2)", fontWeight:700, fontSize:"0.78rem", cursor:"pointer" }}>
                    {r}% {r===10?"標準":"軽減"}
                  </button>
                ))}
              </div>
            </div>
            <SettingRow label="梱包資材重量 (g)" value={packagingWeight} onChange={setPackagingWeight} />
            <button onClick={saveSettings}
              style={{ padding:"0.7rem", borderRadius:10, border:"none", background:"var(--orange)", color:"#fff", fontSize:"0.85rem", fontWeight:700, cursor:"pointer" }}>
              💾 設定を保存
            </button>
          </div>
        </div>
      )}

      <div style={{ fontSize:"0.65rem", color:"var(--dim2)", textAlign:"center", lineHeight:1.8 }}>
        ※送料は50g刻みで自動切り上げ (SLS送料テーブル準拠)<br/>
        ※手数料: 決済 2.24% / 販売 {commissionFeeRate}% / CB Platform {cbPlatformShippingRate}% / CB Infra ₱5 / Payoneer {payoneerFeeRate}%<br/>
        ※消費税還付は輸出免税制度に基づく試算
      </div>
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{ width:44, height:24, borderRadius:12, border:"none", background:value?"var(--orange)":"var(--rim)", position:"relative", cursor:"pointer", flexShrink:0 }}>
      <span style={{ width:18, height:18, background:"#fff", borderRadius:"50%", position:"absolute", top:3, left:value?23:3, transition:"left 0.2s", display:"block" }} />
    </button>
  )
}

function SettingRow({ label, value, onChange, disabled }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", opacity:disabled?0.4:1 }}>
      <label style={{ fontSize:"0.78rem", color:"var(--dim2)" }}>{label}</label>
      <input type="number" step="0.01" value={value} onChange={e => onChange(parseFloat(e.target.value)||0)} disabled={disabled}
        style={{ width:80, padding:"0.3rem 0.5rem", borderRadius:8, border:"1px solid var(--rim)", background:"var(--surface)", color:"var(--text)", fontSize:"0.85rem", fontWeight:700, textAlign:"right" }} />
    </div>
  )
}
