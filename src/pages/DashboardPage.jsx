import { useState, useEffect, useRef } from 'react'
import { db, auth } from '../lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts'
import PlanPage from './PlanPage'

export default function DashboardPage({ uid: propUid }) {
  const [histories, setHistories] = useState([])
  const [loading, setLoading] = useState(true)
  const [diaryLogs, setDiaryLogs] = useState([])
  const [fxRate, setFxRate] = useState(1)
  const [shopeeOrders, setShopeeOrders] = useState({ total: 0, month: 0, cancelled: 0, toShip: 0, monthRevenue: 0 })
  const [inventoryCost, setInventoryCost] = useState({})
  const [monthOrders, setMonthOrders] = useState([])
  const [shopeeIncome, setShopeeIncome] = useState({ unreleased: 0, released: 0 })
  const [monthlyDiarySales, setMonthlyDiarySales] = useState({ php: 0, jpy: 0, days: 0 })
  const [weeklyDiarySales, setWeeklyDiarySales] = useState({ php: 0, jpy: 0, days: 0, cvr: 0, visitors: 0, orders: 0, followers: 0 })
  const [prevWeekDiarySales, setPrevWeekDiarySales] = useState({ php: 0, jpy: 0, orders: 0, cvr: 0 })
  const [prevDayDiarySales, setPrevDayDiarySales] = useState({ php: 0, jpy: 0, orders: 0, cvr: 0, visitors: 0 })
  const [prevMonthDiarySales, setPrevMonthDiarySales] = useState({ php: 0, jpy: 0, orders: 0, cvr: 0 })
  const [todayDiarySales, setTodayDiarySales] = useState({ php: 0, jpy: 0 })
  const dropRef = useRef()
  const [tab, setTab] = useState('yesterday')

  useEffect(() => { if (propUid || auth.currentUser?.uid) loadData() }, [propUid])

  async function handleFile(file) {
    if (!file) return
    try {
      const { parseShopeeXLSX, calcKPIs } = await import('../lib/xlsx')
      const result = await parseShopeeXLSX(file)
      result.kpis = calcKPIs(result.products)
      const { addDoc, collection: col, serverTimestamp } = await import('firebase/firestore')
      const userId = propUid || propUid || auth.currentUser?.uid || 'anonymous'
      const productsToSave = result.products.slice(0, 100).map(p => ({
        name: p.name || '', sales: p.sales || 0, ctr: p.ctr || 0,
        cvr: p.cvr || 0, bounce: p.bounce || 0,
        impressions: p.impressions || 0, orders: p.orders || 0,
        category: p.category || '', priorityScore: p.priorityScore || 0,
      }))
      await addDoc(col(db, 'xlsx_analyses'), {
        userId, filename: result.filename || 'unknown.xlsx',
        uploadedAt: serverTimestamp(),
        productCount: result.products.length, savedCount: productsToSave.length,
        kpis: {
          totalSales: result.kpis.totalSales || 0, productCount: result.kpis.productCount || 0,
          avgCtr: result.kpis.avgCtr || 0, avgCvr: result.kpis.avgCvr || 0,
          avgBounce: result.kpis.avgBounce || 0, urgentCount: result.kpis.urgentCount || 0,
        },
        products: productsToSave,
      })
      alert('保存しました ' + productsToSave.length + '件 ShopeeAnalyzerで詳細確認できます')
      await loadData()
    } catch(e) { alert('エラー: ' + e.message) }
  }

  async function loadData() {
    setLoading(true)
    try {
      const userId = propUid || propUid || auth.currentUser?.uid || 'anonymous'
      const snap = await getDocs(collection(db, 'xlsx_analyses'))
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.userId === userId && d.uploadedAt?.seconds)
        .sort((a, b) => a.uploadedAt.seconds - b.uploadedAt.seconds)
      setHistories(list)
    } catch(e) { console.error(e) }
    // ShopeeDiaryログも取得
    try {
      const snap2 = await getDocs(collection(db, 'action_logs'))
      const uid2 = propUid || auth.currentUser?.uid || 'anonymous'
      const rawLogs = snap2.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.uid === uid2)
      // 日付重複除去（ShopeeDiaryと同じロジック）
      const dateMap = {}
      rawLogs.forEach(d => {
        const date = d.date || ""
        if (!date) return
        if (!dateMap[date]) dateMap[date] = d
      })
      const allLogs = Object.values(dateMap).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      setDiaryLogs(allLogs.slice(0, 30))
      // 今月の集計
      // JST日付ヘルパー（UTC+9）
      const toJSTStr = (d) => {
        const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
        return jst.toISOString().slice(0, 10)
      }
      const toJSTMonthStr = (d) => {
        const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
        return jst.toISOString().slice(0, 7)
      }
      const nowStr = toJSTMonthStr(new Date()) // 'YYYY-MM'
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
      const todayStr2 = toJSTStr(yesterday)
      const monthLogs = allLogs.filter(l => (l.date || '').startsWith(nowStr))
      const monthPhp = monthLogs.reduce((s, l) => s + (Number(l.sales_php) || 0), 0)
      const monthJpy = monthLogs.reduce((s, l) => s + (Number(l.sales_jpy) || 0), 0)
      const monthVisitors = monthLogs.reduce((s, l) => s + (Number(l.visitors) || 0), 0)
      const monthOrdersD  = monthLogs.reduce((s, l) => s + (Number(l.orders)   || 0), 0)
      const monthlyCvr = monthVisitors > 0 ? Math.round(monthOrdersD / monthVisitors * 10000) / 100 : 0
      setMonthlyDiarySales({ php: monthPhp, jpy: monthJpy, days: monthLogs.length, cvr: monthlyCvr, visitors: monthVisitors, orders: monthOrdersD })
      // 週次集計（直近7日）
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
      const weekStr = toJSTStr(weekAgo)
      const weekLogs = allLogs.filter(l => (l.date || '') >= weekStr)
      const weekPhp = weekLogs.reduce((s, l) => s + (Number(l.sales_php) || 0), 0)
      const weekJpy = weekLogs.reduce((s, l) => s + (Number(l.sales_jpy) || 0), 0)
      const weekVisitors = weekLogs.reduce((s, l) => s + (Number(l.visitors) || 0), 0)
      const weekOrdersD  = weekLogs.reduce((s, l) => s + (Number(l.orders)   || 0), 0)
      const weekFollowers = weekLogs.length > 0 ? Number(weekLogs[0].followers) || 0 : 0
      const weeklyCvr = weekVisitors > 0 ? Math.round(weekOrdersD / weekVisitors * 10000) / 100 : 0
      setWeeklyDiarySales({ php: weekPhp, jpy: weekJpy, days: weekLogs.length, cvr: weeklyCvr, visitors: weekVisitors, orders: weekOrdersD, followers: weekFollowers })
      // 先週比（8〜14日前）
      const prevWeekFrom = new Date(); prevWeekFrom.setDate(prevWeekFrom.getDate() - 14)
      const prevWeekTo = new Date(); prevWeekTo.setDate(prevWeekTo.getDate() - 8)
      const prevWeekFromStr = toJSTStr(prevWeekFrom)
      const prevWeekToStr = toJSTStr(prevWeekTo)
      const prevWeekLogs = allLogs.filter(l => (l.date || '') >= prevWeekFromStr && (l.date || '') <= prevWeekToStr)
      const prevWeekPhp = prevWeekLogs.reduce((s, l) => s + (Number(l.sales_php) || 0), 0)
      const prevWeekJpy = prevWeekLogs.reduce((s, l) => s + (Number(l.sales_jpy) || 0), 0)
      const prevWeekVisitors = prevWeekLogs.reduce((s, l) => s + (Number(l.visitors) || 0), 0)
      const prevWeekOrders = prevWeekLogs.reduce((s, l) => s + (Number(l.orders) || 0), 0)
      const prevWeekCvr = prevWeekVisitors > 0 ? Math.round(prevWeekOrders / prevWeekVisitors * 10000) / 100 : 0
      setPrevWeekDiarySales({ php: prevWeekPhp, jpy: prevWeekJpy, orders: prevWeekOrders, cvr: prevWeekCvr })
      // 先月比
      const prevMonthDate = new Date(); prevMonthDate.setMonth(prevMonthDate.getMonth() - 1)
      const prevMonthStr = toJSTMonthStr(prevMonthDate)
      const prevMonthLogs = allLogs.filter(l => (l.date || '').startsWith(prevMonthStr))
      const prevMonthPhp = prevMonthLogs.reduce((s, l) => s + (Number(l.sales_php) || 0), 0)
      const prevMonthJpy = prevMonthLogs.reduce((s, l) => s + (Number(l.sales_jpy) || 0), 0)
      const prevMonthVisitors = prevMonthLogs.reduce((s, l) => s + (Number(l.visitors) || 0), 0)
      const prevMonthOrders = prevMonthLogs.reduce((s, l) => s + (Number(l.orders) || 0), 0)
      const prevMonthCvr = prevMonthVisitors > 0 ? Math.round(prevMonthOrders / prevMonthVisitors * 10000) / 100 : 0
      setPrevMonthDiarySales({ php: prevMonthPhp, jpy: prevMonthJpy, orders: prevMonthOrders, cvr: prevMonthCvr })
      // 当日
      const todayLog = allLogs.find(l => l.date === todayStr2)
      const visitors = Number(todayLog?.visitors) || 0
      const clicks   = Number(todayLog?.clicks)   || 0
      const orders   = Number(todayLog?.orders)   || 0
      const cvr = visitors > 0 ? (orders / visitors * 100) : 0
      setTodayDiarySales({
        php: Number(todayLog?.sales_php) || 0,
        jpy: Number(todayLog?.sales_jpy) || 0,
        orders,
        cancelled: Number(todayLog?.cancelled) || 0,
        ocr: Number(todayLog?.ocr) || 0,
        followers: Number(todayLog?.followers) || 0,
        visitors,
        clicks,
        cvr: Math.round(cvr * 100) / 100,
      })
      // 一昨日（前日比用）
      const dayBeforeYesterday = new Date(); dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2)
      const dayBeforeStr = toJSTStr(dayBeforeYesterday)
      const dayBeforeLog = allLogs.find(l => l.date === dayBeforeStr)
      const dayBeforeVisitors = Number(dayBeforeLog?.visitors) || 0
      const dayBeforeOrders = Number(dayBeforeLog?.orders) || 0
      const dayBeforeCvr = dayBeforeVisitors > 0 ? Math.round(dayBeforeOrders / dayBeforeVisitors * 10000) / 100 : 0
      setPrevDayDiarySales({
        php: Number(dayBeforeLog?.sales_php) || 0,
        jpy: Number(dayBeforeLog?.sales_jpy) || 0,
        orders: dayBeforeOrders,
        visitors: dayBeforeVisitors,
        cvr: dayBeforeCvr,
      })
    } catch(e) { console.error('diary fetch error:', e) }
    // ShopeeManagerデータ取得
    try {
      const { query: q2, where: w2 } = await import('firebase/firestore')
      const uid3 = propUid || auth.currentUser?.uid || 'anonymous'
      const nowStr2 = new Date().toISOString().slice(0, 7)
      // オーダー
      const ordSnap = await getDocs(collection(db, 'shopee_orders'))
      const ordDocs = ordSnap.docs.map(d => d.data()).filter(d => d.userId === uid3)
      const allOrders = ordDocs.flatMap(d => d.orders || [])

      const monthOrders = allOrders.filter(o => (o.orderDate || '').startsWith(nowStr2))
      setMonthOrders(monthOrders)
      const monthRevenue = monthOrders.filter(o => o.status !== 'Cancelled').reduce((s, o) => s + (Number(o.total) || 0), 0)
      // 前日分
      const ydayDate = new Date(); ydayDate.setDate(ydayDate.getDate() - 1)
      const ydayStr = ydayDate.toISOString().slice(0, 10)
      const ydayOrders = allOrders.filter(o => (o.orderDate || '').startsWith(ydayStr))
      const ydayRevenue = ydayOrders.filter(o => o.status !== 'Cancelled').reduce((s, o) => s + (Number(o.total) || 0), 0)
      const ydayCancelled = ydayOrders.filter(o => o.status === 'Cancelled').length
      // 売れた商品TOP5（前日）
      const productMap = {}
      ydayOrders.filter(o => o.status !== 'Cancelled').forEach(o => {
        const name = o.product || o.productName || o.name || '不明'
        if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 }
        productMap[name].qty += Number(o.qty) || 1
        productMap[name].revenue += Number(o.total) || 0
      })
      const topProducts = Object.values(productMap).sort((a,b) => b.revenue - a.revenue).slice(0, 5)
      setShopeeOrders({
        total: allOrders.length,
        month: monthOrders.length,
        cancelled: monthOrders.filter(o => o.status === 'Cancelled').length,
        toShip: allOrders.filter(o => o.status === 'To Ship' || o.status === 'To ship').length,
        monthRevenue,
        ydayOrders: ydayOrders.length,
        ydayRevenue,
        ydayCancelled,
        topProducts,
      })
      // Income
      const incSnap = await getDocs(collection(db, 'shopee_income'))
      const incDocs = incSnap.docs.map(d => d.data()).filter(d => d.userId === uid3)
      const unreleasedTotal = incDocs.reduce((s, d) => s + (Number(d.summary?.totalAmount) || 0), 0)
      const relSnap = await getDocs(collection(db, 'shopee_income_released'))
      const relDocs = relSnap.docs.map(d => d.data()).filter(d => d.userId === uid3)
      const releasedTotal = relDocs.reduce((s, d) => s + (Number(d.summary?.totalAmount) || 0), 0)
      // 手数料合計（今月分）
      const nowStr3 = new Date().toISOString().slice(0, 7)
      const feesTotal = incDocs
        .filter(d => { const u = d.uploadedAt; const s = u?.toDate ? u.toDate().toISOString() : String(u||''); return s.startsWith(nowStr3) })
        .reduce((s, d) => {
          const sum = d.summary || {}
          return s + Math.abs(Number(sum.commissionFee)||0)
                   + Math.abs(Number(sum.serviceFee)||0)
                   + Math.abs(Number(sum.transactionFee)||0)
                   + Math.abs(Number(sum.shippingFee)||0)
        }, 0)
      setShopeeIncome({ unreleased: unreleasedTotal, released: releasedTotal, fees: feesTotal })
    } catch(e) { console.error('shopee manager fetch error:', e) }
    // Inventory 仕入原価取得（SKU別単価マップ）
    try {
      const uid4 = propUid || auth.currentUser?.uid || 'anonymous'
      const invSnap = await getDocs(collection(db, 'inventory_items'))
      const invDocs = invSnap.docs.map(d => d.data()).filter(d => d.userId === uid4)
      const allItems = invDocs.flatMap(d => d.items || [])
      // SKU→単価マップ
      const costMap = {}
      allItems.forEach(i => { if (i.sku) costMap[i.sku] = Number(i.costPhp) || 0 })
      setInventoryCost(costMap)
    } catch(e) { console.error('inventory fetch error:', e) }
    // 為替レート取得
    try {
      const { doc, getDoc } = await import('firebase/firestore')
      const uid = propUid || auth.currentUser?.uid
      if (uid) {
        const fxSnap = await getDoc(doc(db, 'fx_rates', uid))
        if (fxSnap.exists()) setFxRate(Number(fxSnap.data().rate_php_jpy) || 1)
      }
    } catch(e) { console.error('fx_rates fetch error:', e) }
    setLoading(false)
  }

  function toDateStr(ts) {
    if (!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return d.toISOString().slice(0, 10)
  }

  function formatLabel(ts) {
    if (!ts) return '-'
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return (d.getMonth()+1) + '/' + d.getDate()
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10) })()

  const todayUploaded = histories.some(h => toDateStr(h.uploadedAt) === todayStr)
  const latest = histories[histories.length - 1]
  const prev = histories[histories.length - 2]
  const latestDateStr = latest ? toDateStr(latest.uploadedAt) : null
  const daysSinceUpload = latestDateStr ? Math.floor((new Date(todayStr) - new Date(latestDateStr)) / 86400000) : null

  // ストリーク計算
  const streak = (() => {
    if (!histories.length) return 0
    const unique = [...new Set(histories.map(h => toDateStr(h.uploadedAt)).filter(Boolean))].sort().reverse()
    let count = 0
    let check = todayUploaded ? todayStr : yesterdayStr
    for (const d of unique) {
      if (d === check) {
        count++
        const prev = new Date(check); prev.setDate(prev.getDate()-1)
        check = prev.toISOString().slice(0,10)
      } else break
    }
    return count
  })()

  // 差分計算
  function kpiDiff(key) {
    if (!latest || !prev) return null
    return (latest.kpis?.[key] || 0) - (prev.kpis?.[key] || 0)
  }

  // 週次データ（直近7件）
  const weekData = histories.slice(-7).map(h => ({
    label: formatLabel(h.uploadedAt),
    totalSales: Math.round(h.kpis?.totalSales || 0),
    avgCtr: parseFloat((h.kpis?.avgCtr || 0).toFixed(2)),
    avgCvr: parseFloat((h.kpis?.avgCvr || 0).toFixed(2)),
    urgentCount: h.kpis?.urgentCount || 0,
  }))

  // 月次データ（直近30件）
  const monthData = histories.slice(-30).map(h => ({
    label: formatLabel(h.uploadedAt),
    totalSales: Math.round(h.kpis?.totalSales || 0),
    avgCtr: parseFloat((h.kpis?.avgCtr || 0).toFixed(2)),
    avgCvr: parseFloat((h.kpis?.avgCvr || 0).toFixed(2)),
    urgentCount: h.kpis?.urgentCount || 0,
  }))

  // 先週比ランキング
  const ranking = (() => {
    if (histories.length < 2) return { improved: [], worsened: [] }
    const prevMap = {}
    ;(prev.products || []).forEach(p => { prevMap[p.name] = p })
    const diffs = (latest.products || [])
      .filter(p => prevMap[p.name])
      .map(p => ({ name: p.name, salesDiff: p.sales - prevMap[p.name].sales }))
    return {
      improved: diffs.filter(d => d.salesDiff > 0).sort((a,b) => b.salesDiff - a.salesDiff).slice(0,5),
      worsened: diffs.filter(d => d.salesDiff < 0).sort((a,b) => a.salesDiff - b.salesDiff).slice(0,5),
    }
  })()

  const TABS = [
    { id:'yesterday', label:'📅 日次' },
    { id:'weekly',    label:'📆 週次' },
    { id:'monthly',   label:'📊 月次' },
    { id:'roadmap',   label:'🎯 ロードマップ' },
    { id:'goals',     label:'🏆 目標管理' },
  ]

  function DiffBadge({ value, reverse = false, fmt }) {
    if (value === null || value === undefined) return null
    const positive = reverse ? value < 0 : value > 0
    const color = value === 0 ? '#6b7280' : positive ? '#16a34a' : '#dc2626'
    const arrow = value > 0 ? '▲ +' : value < 0 ? '▼ ' : '± '
    return <span style={{ color, fontWeight:700, fontSize:'0.68rem', marginLeft:'0.4rem' }}>{arrow}{fmt ? fmt(value) : value}</span>
  }

  function KpiCards({ items }) {
    return (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
        {items.map(k => (
          <div key={k.l} className="card" style={{ padding:'1.25rem', borderTop:'2px solid '+k.a }}>
            <div style={{ fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.12em', color:'var(--dim2)', fontWeight:700, marginBottom:'0.4rem' }}>{k.l}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.9rem', color:k.a, lineHeight:1 }}>{k.v}</div>
            {k.sub && <div style={{ fontSize:'0.65rem', color:'var(--dim2)', marginTop:'0.2rem' }}>{k.sub}</div>}
            {k.d !== undefined && <div style={{ marginTop:'0.3rem', fontSize:'0.68rem', color:'var(--dim2)' }}>{k.sub2||'前回比'} <DiffBadge value={k.d} reverse={k.reverse} fmt={k.fmt} /></div>}
          </div>
        ))}
      </div>
    )
  }

  function TrendCharts({ data, title }) {
    if (data.length < 2) return (
      <div style={{ textAlign:'center', padding:'3rem', color:'var(--dim2)', fontSize:'0.85rem', border:'1px solid var(--rim)', borderRadius:12 }}>
        2件以上のデータが必要です
      </div>
    )
    return (
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
        <div className="card" style={{ padding:'1.25rem' }}>
          <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>📈 売上推移</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill:'#6b7280', fontSize:10 }} />
              <YAxis tick={{ fill:'#6b7280', fontSize:10 }} tickFormatter={v => '₱'+v.toLocaleString()} />
              <Tooltip contentStyle={{ background:'var(--card)', border:'1px solid var(--rim2)', borderRadius:8, fontSize:'0.78rem' }} formatter={v => ['₱'+Number(v).toLocaleString(), '売上']} />
              <Line type="monotone" dataKey="totalSales" stroke="#f97316" strokeWidth={2.5} dot={{ r:3, fill:'#f97316' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding:'1.25rem' }}>
          <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>📊 CTR / CVR 推移</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill:'#6b7280', fontSize:10 }} />
              <YAxis tick={{ fill:'#6b7280', fontSize:10 }} tickFormatter={v => v+'%'} />
              <Tooltip contentStyle={{ background:'var(--card)', border:'1px solid var(--rim2)', borderRadius:8, fontSize:'0.78rem' }} formatter={v => [v+'%']} />
              <Legend wrapperStyle={{ fontSize:'0.72rem' }} />
              <Line type="monotone" dataKey="avgCtr" name="CTR" stroke="#2563eb" strokeWidth={2.5} dot={{ r:3, fill:'#2563eb' }} />
              <Line type="monotone" dataKey="avgCvr" name="CVR" stroke="#16a34a" strokeWidth={2.5} dot={{ r:3, fill:'#16a34a' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding:'1.25rem' }}>
          <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>🔴 緊急改善件数</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill:'#6b7280', fontSize:10 }} />
              <YAxis tick={{ fill:'#6b7280', fontSize:10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background:'var(--card)', border:'1px solid var(--rim2)', borderRadius:8, fontSize:'0.78rem' }} formatter={v => [v+'件', '緊急改善']} />
              <Bar dataKey="urgentCount" fill="rgba(220,38,38,0.7)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding:'1.25rem' }}>
          <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>🏆 前回比ランキング</div>
          {histories.length < 2 ? (
            <div style={{ textAlign:'center', padding:'2rem', color:'var(--dim)', fontSize:'0.8rem' }}>2件以上必要</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
              <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--green)', marginBottom:'0.2rem' }}>▲ 改善トップ</div>
              {ranking.improved.length === 0 && <div style={{ fontSize:'0.72rem', color:'var(--dim)' }}>改善商品なし</div>}
              {ranking.improved.map((p,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.3rem 0.6rem', background:'rgba(22,163,74,0.08)', borderRadius:6 }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--green)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                  <span style={{ fontSize:'0.7rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--green)', whiteSpace:'nowrap' }}>+₱{p.salesDiff.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--red)', margin:'0.35rem 0 0.2rem' }}>▼ 要注意</div>
              {ranking.worsened.length === 0 && <div style={{ fontSize:'0.72rem', color:'var(--dim)' }}>悪化商品なし</div>}
              {ranking.worsened.map((p,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.3rem 0.6rem', background:'rgba(220,38,38,0.08)', borderRadius:6 }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--red)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                  <span style={{ fontSize:'0.7rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--red)', whiteSpace:'nowrap' }}>₱{p.salesDiff.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:'1rem' }}>
      <div className="spinner" /><p style={{ color:'var(--dim2)', fontSize:'0.85rem' }}>読み込み中...</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* タブバー */}
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--rim)', display:'flex', overflowX:'auto', flexShrink:0, padding:'0 1.5rem' }}>
        {TABS.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{ padding:'0.85rem 1.1rem', cursor:'pointer', fontSize:'0.78rem', fontWeight:700, color:tab===t.id?'var(--orange)':'var(--dim2)', borderBottom:tab===t.id?'2px solid var(--orange)':'2px solid transparent', whiteSpace:'nowrap', transition:'all 0.2s' }}>{t.label}</div>
        ))}
        <button className="btn-ghost" style={{ marginLeft:'auto', fontSize:'0.72rem', alignSelf:'center' }} onClick={loadData}>🔄</button>
      </div>

      <div style={{ flex:1, overflow:'auto' }}>

        {/* ロードマップタブ */}
        {tab === 'roadmap' && <PlanPage embedded={true} />}

        {tab !== 'roadmap' && (
          <div style={{ maxWidth:1200, margin:'0 auto', padding:'1.5rem' }}>


            {/* 日次タブ */}
            {tab === 'yesterday' && (
              <div className="fade-up">

                {/* AI ダッシュボードウィジェット */}
                <AIDashboardWidget diaryLogs={diaryLogs} weeklyDiarySales={weeklyDiarySales} monthlyDiarySales={monthlyDiarySales} todayDiarySales={todayDiarySales} latest={latest} fxRate={fxRate} />

                {/* 1. 今月の目標ペース */}
                <GoalPaceBlock uid={propUid || auth.currentUser?.uid} latest={latest} monthlyDiarySales={monthlyDiarySales} fxRateOverride={fxRate} shopeeIncome={shopeeIncome} inventoryCost={inventoryCost} monthOrders={monthOrders} weeklyDiarySales={weeklyDiarySales} todayDiarySales={todayDiarySales} period='today' />

                {/* 2. Diary KPI（前日） */}
                <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'1.25rem 0 0.75rem' }}>📅 前日の実績（Diary）</div>
                <KpiCards items={[
                  { l:'売上', v: todayDiarySales.jpy ? '¥'+todayDiarySales.jpy.toLocaleString() : todayDiarySales.php ? '₱'+Math.round(todayDiarySales.php).toLocaleString() : '-', a:'var(--orange)', sub: todayDiarySales.php ? '₱'+Math.round(todayDiarySales.php).toLocaleString() : '', d: prevDayDiarySales.php||prevDayDiarySales.jpy ? (todayDiarySales.jpy||Math.round(todayDiarySales.php||0)) - (prevDayDiarySales.jpy||Math.round(prevDayDiarySales.php||0)) : undefined, fmt: v => Math.abs(v).toLocaleString(), sub2:'前日比' },
                  { l:'注文数', v: todayDiarySales.orders ? todayDiarySales.orders+'件' : '-', a:'var(--blue, #3b82f6)', sub: todayDiarySales.cancelled ? 'キャンセル '+todayDiarySales.cancelled+'件' : '', d: prevDayDiarySales.orders ? todayDiarySales.orders - prevDayDiarySales.orders : undefined, fmt: v => Math.abs(v)+'件', sub2:'前日比' },
                  { l:'OCR', v: todayDiarySales.ocr ? todayDiarySales.ocr+'%' : '-', a: todayDiarySales.ocr > 5 ? 'var(--green)' : 'var(--yellow)' },
                  { l:'Visitors', v: todayDiarySales.visitors ? todayDiarySales.visitors.toLocaleString() : '-', a:'var(--blue, #3b82f6)', sub: todayDiarySales.clicks ? 'Clicks: '+todayDiarySales.clicks : '', d: prevDayDiarySales.visitors ? todayDiarySales.visitors - prevDayDiarySales.visitors : undefined, fmt: v => Math.abs(v).toLocaleString(), sub2:'前日比' },
                  { l:'CVR', v: todayDiarySales.cvr ? todayDiarySales.cvr.toFixed(2)+'%' : '-', a: todayDiarySales.cvr > 5 ? 'var(--green)' : todayDiarySales.cvr < 3 ? 'var(--red)' : 'var(--yellow)', sub: 'V:'+todayDiarySales.visitors+' O:'+todayDiarySales.orders, d: prevDayDiarySales.cvr ? todayDiarySales.cvr - prevDayDiarySales.cvr : undefined, fmt: v => Math.abs(v).toFixed(2)+'%', sub2:'前日比' },
                  { l:'フォロワー', v: todayDiarySales.followers ? Number(todayDiarySales.followers).toLocaleString() : '-', a:'var(--ai)' },
                ]} />

                {/* 3. Orderレポート KPI（前日） */}
                <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'1.25rem 0 0.75rem' }}>📦 注文レポート（前日）</div>
                <KpiCards items={[
                  { l:'前日受注', v: shopeeOrders.ydayOrders+'件', a:'var(--blue, #3b82f6)', sub: shopeeOrders.ydayRevenue > 0 ? '₱'+Math.round(shopeeOrders.ydayRevenue).toLocaleString() : '' },
                  { l:'前日キャンセル', v: shopeeOrders.ydayCancelled+'件', a: shopeeOrders.ydayCancelled > 0 ? 'var(--red)' : 'var(--green)' },
                  { l:'前日平均単価', v: shopeeOrders.ydayOrders > 0 ? '₱'+Math.round(shopeeOrders.ydayRevenue / shopeeOrders.ydayOrders).toLocaleString() : '-', a:'var(--purple)' },
                  { l:'発送待ち', v: shopeeOrders.toShip+'件', a: shopeeOrders.toShip > 0 ? 'var(--yellow, #f59e0b)' : 'var(--green)' },
                ]} />

                {/* 売れた商品TOP5（前日） */}
                {shopeeOrders.topProducts && shopeeOrders.topProducts.length > 0 && (
                  <div className="card" style={{ padding:'1.1rem', marginBottom:'0.5rem' }}>
                    <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'0.75rem' }}>📦 前日 売れた商品 TOP5</div>
                    {shopeeOrders.topProducts.slice(0,5).map((p,i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.35rem 0.6rem', background:'rgba(59,130,246,0.07)', borderRadius:6, marginBottom:'0.3rem' }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--blue, #3b82f6)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                        <span style={{ fontSize:'0.7rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                        <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--blue, #3b82f6)', whiteSpace:'nowrap' }}>{p.qty}件</span>
                        <span style={{ fontSize:'0.68rem', color:'var(--orange)', whiteSpace:'nowrap' }}>₱{Math.round(p.revenue).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 4. パフォーマンスレポート KPI */}
                {latest && (
                  <>
                    <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'1.25rem 0 0.75rem' }}>📈 パフォーマンスレポート（最新アップ）</div>
                    <KpiCards items={[
                      { l:'商品数', v:(latest.kpis?.productCount||0)+'件', a:'var(--purple)' },
                      { l:'平均CTR', v:(latest.kpis?.avgCtr||0).toFixed(2)+'%', a:(latest.kpis?.avgCtr||0)>3?'var(--green)':'var(--yellow)', sub:'基準: 3.00%以上' },
                      { l:'平均CVR', v:(latest.kpis?.avgCvr||0).toFixed(2)+'%', a:(latest.kpis?.avgCvr||0)>5?'var(--green)':(latest.kpis?.avgCvr||0)<3?'var(--red)':'var(--yellow)', sub:'基準: 5.00%以上' },
                      { l:'緊急改善', v:(latest.kpis?.urgentCount||0)+'件', a:(latest.kpis?.urgentCount||0)>0?'var(--red)':'var(--green)' },
                    ]} />
                  </>
                )}

                {/* 6. 前回比（パフォーマンスレポート） */}
                <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'1rem 0' }}>📊 Analyzer前回アップとの比較</div>
                {histories.length < 2 ? (
                  <div style={{ textAlign:'center', padding:'3rem', color:'var(--dim2)', fontSize:'0.85rem', border:'1px solid var(--rim)', borderRadius:12 }}>2件以上のデータが必要です</div>
                ) : (
                  <>
                    <GoalAchievementBlock uid={propUid || auth.currentUser?.uid} latest={latest} label="前日" />
                    <KpiCards items={[
                      { l:'売上', v:'₱'+(latest.kpis?.totalSales||0).toLocaleString('en',{maximumFractionDigits:0}), a:'var(--orange)', d:kpiDiff('totalSales'), fmt: v => '₱'+Math.abs(v).toLocaleString('en',{maximumFractionDigits:0}) },
                      { l:'商品数', v:(latest.kpis?.productCount||0)+'件', a:'var(--purple)', d:kpiDiff('productCount'), fmt: v => Math.abs(v)+'件' },
                      { l:'平均CTR', v:(latest.kpis?.avgCtr||0).toFixed(2)+'%', a:(latest.kpis?.avgCtr||0)>3?'var(--green)':'var(--yellow)', d:kpiDiff('avgCtr'), fmt: v => Math.abs(v).toFixed(2)+'%' },
                      { l:'平均CVR', v:(latest.kpis?.avgCvr||0).toFixed(2)+'%', a:(latest.kpis?.avgCvr||0)>5?'var(--green)':(latest.kpis?.avgCvr||0)<3?'var(--red)':'var(--yellow)', d:kpiDiff('avgCvr'), fmt: v => Math.abs(v).toFixed(2)+'%' },
                      { l:'緊急改善', v:(latest.kpis?.urgentCount||0)+'件', a:(latest.kpis?.urgentCount||0)>0?'var(--red)':'var(--green)', d:kpiDiff('urgentCount'), reverse:true, fmt: v => Math.abs(v)+'件' },
                    ]} />
                    <div className="card" style={{ padding:'1.25rem' }}>
                      <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>🏆 前回比 商品ランキング</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                        <div>
                          <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--green)', marginBottom:'0.4rem' }}>▲ 改善トップ5</div>
                          {ranking.improved.length === 0 && <div style={{ fontSize:'0.72rem', color:'var(--dim)' }}>改善商品なし</div>}
                          {ranking.improved.map((p,i) => (
                            <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.35rem 0.6rem', background:'rgba(22,163,74,0.08)', borderRadius:6, marginBottom:'0.3rem' }}>
                              <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--green)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                              <span style={{ fontSize:'0.7rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                              <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--green)', whiteSpace:'nowrap' }}>+₱{p.salesDiff.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--red)', marginBottom:'0.4rem' }}>▼ 要注意5</div>
                          {ranking.worsened.length === 0 && <div style={{ fontSize:'0.72rem', color:'var(--dim)' }}>悪化商品なし</div>}
                          {ranking.worsened.map((p,i) => (
                            <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.35rem 0.6rem', background:'rgba(220,38,38,0.08)', borderRadius:6, marginBottom:'0.3rem' }}>
                              <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--red)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                              <span style={{ fontSize:'0.7rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                              <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--red)', whiteSpace:'nowrap' }}>₱{p.salesDiff.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 週次タブ */}
            {tab === 'weekly' && (
              <div className="fade-up">
                {/* 目標ペース */}
                <GoalPaceBlock uid={propUid || auth.currentUser?.uid} latest={latest} monthlyDiarySales={monthlyDiarySales} fxRateOverride={fxRate} shopeeIncome={shopeeIncome} inventoryCost={inventoryCost} monthOrders={monthOrders} weeklyDiarySales={weeklyDiarySales} todayDiarySales={todayDiarySales} period='thisweek' />

                {/* Diary週次KPI */}
                <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'1.25rem 0 0.75rem' }}>📆 直近7日間（Diary集計）</div>
                <KpiCards items={[
                  { l:'週次売上', v: weeklyDiarySales.jpy ? '¥'+weeklyDiarySales.jpy.toLocaleString() : weeklyDiarySales.php ? '₱'+Math.round(weeklyDiarySales.php).toLocaleString() : '-', a:'var(--orange)', sub: weeklyDiarySales.php ? '₱'+Math.round(weeklyDiarySales.php).toLocaleString() : '', d: prevWeekDiarySales.jpy ? (weeklyDiarySales.jpy||Math.round(weeklyDiarySales.php)) - (prevWeekDiarySales.jpy||Math.round(prevWeekDiarySales.php)) : undefined, fmt: v => (v>0?'+':'')+Math.abs(v).toLocaleString(), sub2:'先週比' },
                  { l:'週次注文数', v: weeklyDiarySales.orders ? weeklyDiarySales.orders+'件' : '-', a:'var(--blue, #3b82f6)', d: prevWeekDiarySales.orders ? weeklyDiarySales.orders - prevWeekDiarySales.orders : undefined, fmt: v => Math.abs(v)+'件', sub2:'先週比' },
                  { l:'週次CVR', v: weeklyDiarySales.cvr ? weeklyDiarySales.cvr.toFixed(2)+'%' : '-', a: weeklyDiarySales.cvr > 5 ? 'var(--green)' : weeklyDiarySales.cvr < 3 ? 'var(--red)' : 'var(--yellow)', sub: 'V:'+weeklyDiarySales.visitors+' O:'+weeklyDiarySales.orders, d: prevWeekDiarySales.cvr ? weeklyDiarySales.cvr - prevWeekDiarySales.cvr : undefined, fmt: v => Math.abs(v).toFixed(2)+'%', sub2:'先週比' },
                  { l:'フォロワー', v: weeklyDiarySales.followers ? Number(weeklyDiarySales.followers).toLocaleString() : '-', a:'var(--ai)' },
                  { l:'記録日数', v: weeklyDiarySales.days+'日', a:'var(--dim2)' },
                ]} />

                {/* パフォーマンスKPI */}
                {latest && (
                  <>
                    <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'1.25rem 0 0.75rem' }}>📈 パフォーマンス（最新アップ）</div>
                    <KpiCards items={[
                      { l:'商品数', v:(latest.kpis?.productCount||0)+'件', a:'var(--purple)' },
                      { l:'平均CTR', v:(latest.kpis?.avgCtr||0).toFixed(2)+'%', a:(latest.kpis?.avgCtr||0)>3?'var(--green)':'var(--yellow)', sub:'基準: 3.00%以上' },
                      { l:'平均CVR', v:(latest.kpis?.avgCvr||0).toFixed(2)+'%', a:(latest.kpis?.avgCvr||0)>5?'var(--green)':(latest.kpis?.avgCvr||0)<3?'var(--red)':'var(--yellow)', sub:'基準: 5.00%以上' },
                      { l:'緊急改善', v:(latest.kpis?.urgentCount||0)+'件', a:(latest.kpis?.urgentCount||0)>0?'var(--red)':'var(--green)' },
                    ]} />
                  </>
                )}

                {/* 商品ランキング */}
                {histories.length >= 2 && ranking && (
                  <div className="card" style={{ padding:'1.25rem', marginTop:'1rem' }}>
                    <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>🏆 商品ランキング（前回比）</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                      <div>
                        <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--green)', marginBottom:'0.4rem' }}>▲ 改善トップ5</div>
                        {ranking.improved.length === 0 && <div style={{ fontSize:'0.72rem', color:'var(--dim)' }}>改善商品なし</div>}
                        {ranking.improved.map((p,i) => (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.35rem 0.6rem', background:'rgba(22,163,74,0.08)', borderRadius:6, marginBottom:'0.3rem' }}>
                            <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--green)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                            <span style={{ fontSize:'0.7rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                            <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--green)', whiteSpace:'nowrap' }}>+₱{p.salesDiff.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--red)', marginBottom:'0.4rem' }}>▼ 要注意5</div>
                        {ranking.worsened.length === 0 && <div style={{ fontSize:'0.72rem', color:'var(--dim)' }}>悪化商品なし</div>}
                        {ranking.worsened.map((p,i) => (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.35rem 0.6rem', background:'rgba(220,38,38,0.08)', borderRadius:6, marginBottom:'0.3rem' }}>
                            <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--red)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                            <span style={{ fontSize:'0.7rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                            <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--red)', whiteSpace:'nowrap' }}>₱{p.salesDiff.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* グラフ */}
                <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'1.25rem 0 0.75rem' }}>📆 直近7件の推移</div>
                <TrendCharts data={weekData} />
              </div>
            )}

            {/* 月次タブ */}
            {tab === 'monthly' && (
              <div className="fade-up">
                {/* 目標ペース */}
                <GoalPaceBlock uid={propUid || auth.currentUser?.uid} latest={latest} monthlyDiarySales={monthlyDiarySales} fxRateOverride={fxRate} shopeeIncome={shopeeIncome} inventoryCost={inventoryCost} monthOrders={monthOrders} weeklyDiarySales={weeklyDiarySales} todayDiarySales={todayDiarySales} period='thismonth' />

                {/* Diary月次KPI */}
                <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'1.25rem 0 0.75rem' }}>📊 今月累計（Diary集計）</div>
                <KpiCards items={[
                  { l:'月次売上', v: monthlyDiarySales.jpy ? '¥'+monthlyDiarySales.jpy.toLocaleString() : monthlyDiarySales.php ? '₱'+Math.round(monthlyDiarySales.php).toLocaleString() : '-', a:'var(--orange)', sub: monthlyDiarySales.php ? '₱'+Math.round(monthlyDiarySales.php).toLocaleString()+' / '+monthlyDiarySales.days+'日分' : '', d: prevMonthDiarySales.jpy ? (monthlyDiarySales.jpy||Math.round(monthlyDiarySales.php)) - (prevMonthDiarySales.jpy||Math.round(prevMonthDiarySales.php)) : undefined, fmt: v => Math.abs(v).toLocaleString(), sub2:'先月比' },
                  { l:'月次注文数', v: monthlyDiarySales.orders ? monthlyDiarySales.orders+'件' : '-', a:'var(--blue, #3b82f6)', d: prevMonthDiarySales.orders ? monthlyDiarySales.orders - prevMonthDiarySales.orders : undefined, fmt: v => Math.abs(v)+'件', sub2:'先月比' },
                  { l:'月次CVR', v: monthlyDiarySales.cvr ? monthlyDiarySales.cvr.toFixed(2)+'%' : '-', a: monthlyDiarySales.cvr > 5 ? 'var(--green)' : monthlyDiarySales.cvr < 3 ? 'var(--red)' : 'var(--yellow)', sub: 'V:'+monthlyDiarySales.visitors+' O:'+monthlyDiarySales.orders, d: prevMonthDiarySales.cvr ? monthlyDiarySales.cvr - prevMonthDiarySales.cvr : undefined, fmt: v => Math.abs(v).toFixed(2)+'%', sub2:'先月比' },
                  { l:'今月受注（Manager）', v: shopeeOrders.month+'件', a:'var(--purple)', sub: shopeeOrders.monthRevenue > 0 ? '₱'+Math.round(shopeeOrders.monthRevenue).toLocaleString() : '' },
                  { l:'記録日数', v: monthlyDiarySales.days+'日', a:'var(--dim2)' },
                ]} />

                {/* パフォーマンスKPI */}
                {latest && (
                  <>
                    <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'1.25rem 0 0.75rem' }}>📈 パフォーマンス（最新アップ）</div>
                    <KpiCards items={[
                      { l:'商品数', v:(latest.kpis?.productCount||0)+'件', a:'var(--purple)' },
                      { l:'平均CTR', v:(latest.kpis?.avgCtr||0).toFixed(2)+'%', a:(latest.kpis?.avgCtr||0)>3?'var(--green)':'var(--yellow)', sub:'基準: 3.00%以上' },
                      { l:'平均CVR', v:(latest.kpis?.avgCvr||0).toFixed(2)+'%', a:(latest.kpis?.avgCvr||0)>5?'var(--green)':(latest.kpis?.avgCvr||0)<3?'var(--red)':'var(--yellow)', sub:'基準: 5.00%以上' },
                      { l:'緊急改善', v:(latest.kpis?.urgentCount||0)+'件', a:(latest.kpis?.urgentCount||0)>0?'var(--red)':'var(--green)' },
                    ]} />
                  </>
                )}

                {/* 商品ランキング */}
                {histories.length >= 2 && ranking && (
                  <div className="card" style={{ padding:'1.25rem', marginTop:'1rem' }}>
                    <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--dim2)', fontWeight:700, marginBottom:'1rem' }}>🏆 商品ランキング（前回比）</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                      <div>
                        <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--green)', marginBottom:'0.4rem' }}>▲ 改善トップ5</div>
                        {ranking.improved.length === 0 && <div style={{ fontSize:'0.72rem', color:'var(--dim)' }}>改善商品なし</div>}
                        {ranking.improved.map((p,i) => (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.35rem 0.6rem', background:'rgba(22,163,74,0.08)', borderRadius:6, marginBottom:'0.3rem' }}>
                            <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--green)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                            <span style={{ fontSize:'0.7rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                            <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--green)', whiteSpace:'nowrap' }}>+₱{p.salesDiff.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--red)', marginBottom:'0.4rem' }}>▼ 要注意5</div>
                        {ranking.worsened.length === 0 && <div style={{ fontSize:'0.72rem', color:'var(--dim)' }}>悪化商品なし</div>}
                        {ranking.worsened.map((p,i) => (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.35rem 0.6rem', background:'rgba(220,38,38,0.08)', borderRadius:6, marginBottom:'0.3rem' }}>
                            <span style={{ fontFamily:"'Bebas Neue',sans-serif", color:'var(--red)', fontSize:'1rem', minWidth:'1.2rem' }}>{i+1}</span>
                            <span style={{ fontSize:'0.7rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                            <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--red)', whiteSpace:'nowrap' }}>₱{p.salesDiff.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* グラフ */}
                <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'1.25rem 0 0.75rem' }}>📊 直近30件の推移</div>
                <TrendCharts data={monthData} />
              </div>
            )}

            {/* 目標管理タブ */}
            {tab === 'goals' && (
              <GoalsTab uid={propUid || auth.currentUser?.uid} latest={latest} />
            )}

          </div>
        )}
      </div>
    </div>
  )
}

function GoalAchievementBlock({ uid, latest, label }) {
  const [goals, setGoals] = useState(null)
  const [fxRate, setFxRate] = useState(1)
  useEffect(() => { if (uid) load() }, [uid])
  async function load() {
    try {
      const { db } = await import('../lib/firebase')
      const { doc, getDoc } = await import('firebase/firestore')
      const [goalSnap, fxSnap] = await Promise.all([
        getDoc(doc(db, 'user_goals', uid)),
        getDoc(doc(db, 'fx_rates', uid))
      ])
      if (goalSnap.exists()) setGoals(goalSnap.data())
      if (fxSnap.exists()) setFxRate(Number(fxSnap.data().rate_php_jpy) || 1)
    } catch(e) {}
  }
  if (!goals || !latest) return null
  const thisMonth = goals?.thismonth || {}
  const salesJpy = (latest.kpis?.totalSales || 0) * fxRate
  const ITEMS = [
    { key:'sales',  label:'月間売上', unit:'¥', actual: salesJpy,                  target: parseFloat(thisMonth.sales||0),  color:'#f97316' },
    { key:'orders', label:'受注数',   unit:'件', actual: latest.kpis?.totalOrders||0, target: parseFloat(thisMonth.orders||0), color:'#a855f7' },
    { key:'ctr',    label:'CTR',     unit:'%',  actual: latest.kpis?.avgCtr||0,      target: parseFloat(thisMonth.ctr||0),   color:'#2563eb' },
    { key:'cvr',    label:'CVR',     unit:'%',  actual: latest.kpis?.avgCvr||0,      target: parseFloat(thisMonth.cvr||0),   color:'#16a34a' },
  ].filter(i => i.target > 0)
  if (ITEMS.length === 0) return (
    <div style={{ marginTop:'1rem', padding:'1rem', borderRadius:12, border:'1px dashed var(--rim)', textAlign:'center', fontSize:'0.75rem', color:'var(--dim2)' }}>
      🏆 目標管理タブで今月の目標を設定すると達成率が表示されます
    </div>
  )
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()
  const daysElapsed = now.getDate()
  const expectedPct = Math.round((daysElapsed / daysInMonth) * 100)
  return (
    <div className="card" style={{ padding:'1.25rem', marginTop:'1rem', borderTop:'2px solid var(--orange)' }}>
      <div style={{ fontSize:'0.65rem', fontWeight:700, color:'var(--orange)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'1.25rem' }}>
        🏆 今月の目標達成率　<span style={{ color:'var(--dim2)', fontWeight:400 }}>期待値: {expectedPct}%（{daysElapsed}/{daysInMonth}日）</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'1rem' }}>
        {ITEMS.map(item => {
          const pct = Math.min(Math.round((item.actual / item.target) * 100), 999)
          const statusColor = pct >= 100 ? 'var(--green)' : pct >= expectedPct - 5 ? 'var(--yellow)' : 'var(--red)'
          const fmt = (v) => item.unit === '¥' ? '¥'+Math.round(v).toLocaleString() : item.unit === '%' ? v.toFixed(2)+'%' : Math.round(v).toLocaleString()+item.unit
          return (
            <div key={item.key} style={{ padding:'1rem', borderRadius:12, border:'1px solid var(--rim)', borderTop:'2px solid '+item.color, background:'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize:'0.62rem', fontWeight:700, color:'var(--dim2)', marginBottom:'0.5rem', textTransform:'uppercase' }}>{item.label}</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'2.2rem', color: statusColor, lineHeight:1 }}>{pct}%</div>
              <div style={{ fontSize:'0.62rem', color:'var(--dim2)', marginTop:'0.3rem' }}>{fmt(item.actual)} / {fmt(item.target)}</div>
              <div style={{ height:4, borderRadius:2, background:'var(--rim)', marginTop:'0.6rem', overflow:'hidden', position:'relative' }}>
                <div style={{ height:'100%', width:Math.min(pct,100)+'%', background:statusColor, borderRadius:2, transition:'width 0.6s' }} />
                <div style={{ position:'absolute', top:0, bottom:0, left:Math.min(expectedPct,100)+'%', width:2, background:'rgba(255,255,255,0.35)' }} />
              </div>
              <div style={{ fontSize:'0.58rem', color:'var(--dim2)', marginTop:'0.3rem' }}>
                {pct >= 100 ? '🎉 目標達成！' : pct >= expectedPct - 5 ? '🟡 ペースOK' : '🔴 ペース遅れ'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


function GoalPaceBar({ label, unit, color, actual, target, daysElapsed, daysInMonth, fxRate=1 }) {
  if (!target || parseFloat(target) === 0 || actual === null || actual === undefined) return null
  const targetNum = parseFloat(target)
  const expectedPct = Math.round((daysElapsed / daysInMonth) * 100)
  const actualPct = Math.min(Math.round((actual / targetNum) * 100), 999)
  const paceOk = actualPct >= expectedPct - 5
  const statusColor = actualPct >= 100 ? 'var(--green)' : paceOk ? 'var(--yellow)' : 'var(--red)'
  const statusIcon = actualPct >= 100 ? '🎉' : paceOk ? '🟡' : '🔴'
  const fmt = (v, sub) => unit === '¥' ? '¥' + Math.round(v).toLocaleString() + (sub !== undefined ? '（₱'+Math.round(sub).toLocaleString()+'）' : '') : unit === '%' ? v.toFixed(2) + '%' : Math.round(v).toLocaleString() + unit
  return (
    <div style={{ marginBottom:'0.6rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.25rem' }}>
        <span style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--dim2)' }}>{statusIcon} {label}</span>
        <span style={{ fontSize:'0.68rem', fontWeight:700, color: statusColor }}>
          {fmt(actual, unit==='¥' ? actual/fxRate : undefined)} / {fmt(targetNum)}　{actualPct}%
        </span>
      </div>
      <div style={{ position:'relative', height:6, borderRadius:3, background:'var(--rim)', overflow:'hidden' }}>
        <div style={{ position:'absolute', height:'100%', width: Math.min(actualPct,100)+'%', background: statusColor, borderRadius:3, transition:'width 0.6s' }} />
        <div style={{ position:'absolute', top:0, bottom:0, left: expectedPct+'%', width:2, background:'rgba(255,255,255,0.4)', borderRadius:1 }} />
      </div>
      <div style={{ fontSize:'0.6rem', color:'var(--dim2)', marginTop:'0.2rem', textAlign:'right' }}>
        今日時点の期待値: {expectedPct}%
      </div>
    </div>
  )
}


function AIDashboardWidget({ diaryLogs, weeklyDiarySales, monthlyDiarySales, todayDiarySales, latest, fxRate }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function analyze() {
    setLoading(true)
    setOpen(true)
    try {
      // 過去30日のDiaryデータを整形
      const recentLogs = diaryLogs.slice(0, 30).map(l => ({
        date: l.date,
        sales_php: Number(l.sales_php) || 0,
        orders: Number(l.orders) || 0,
        visitors: Number(l.visitors) || 0,
        cvr: l.visitors > 0 ? Math.round(Number(l.orders) / Number(l.visitors) * 10000) / 100 : 0,
      }))

      const urgentProducts = (latest?.products || [])
        .filter(p => p.category === 'urgent' || p.priorityScore > 70)
        .slice(0, 5)
        .map(p => ({ name: p.name, ctr: p.ctr, cvr: p.cvr, sales: p.sales }))

      const prompt = `あなたはShopeeフィリピンの販売コンサルタントです。以下のデータを分析して日本語で回答してください。

## 直近30日のDiary実績（新しい順）
${JSON.stringify(recentLogs.slice(0, 10), null, 2)}

## 今週の集計
- 売上: ₱${Math.round(weeklyDiarySales.php || 0).toLocaleString()} / ¥${Math.round(weeklyDiarySales.jpy || 0).toLocaleString()}
- 注文数: ${weeklyDiarySales.orders || 0}件
- CVR: ${(weeklyDiarySales.cvr || 0).toFixed(2)}%
- 記録日数: ${weeklyDiarySales.days || 0}日

## 今月の集計
- 売上: ₱${Math.round(monthlyDiarySales.php || 0).toLocaleString()}
- 注文数: ${monthlyDiarySales.orders || 0}件
- CVR: ${(monthlyDiarySales.cvr || 0).toFixed(2)}%
- 記録日数: ${monthlyDiarySales.days || 0}日

## 緊急改善商品（優先度TOP5）
${JSON.stringify(urgentProducts, null, 2)}

## 回答形式（必ずこの形式で）
以下の4セクションをそれぞれ簡潔に回答してください：

### 📈 トレンド分析
過去30日の売上・CVRトレンドを3行以内で分析

### 🎯 今週のアクションプラン
今週やるべき具体的なアクションを3つ箇条書き

### 🔴 緊急改善アドバイス
優先度の高い商品への具体的な改善提案を2つ

### 💰 今月の売上着地予測
現在のペースから今月末の売上を予測（根拠も一行で）`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': await (async()=>{const{getAiKey}=await import('../lib/ai');return await getAiKey()})(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const data = await response.json()
      const text = data.content?.[0]?.text || 'エラーが発生しました'
      setResult(text)
    } catch(e) {
      setResult('分析に失敗しました: ' + e.message)
    }
    setLoading(false)
  }

  // マークダウン風テキストを簡易レンダリング
  function renderText(text) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('### ')) return <div key={i} style={{ fontSize:'0.82rem', fontWeight:900, color:'var(--ai)', margin:'1rem 0 0.4rem', borderBottom:'1px solid rgba(0,212,170,0.2)', paddingBottom:'0.3rem' }}>{line.replace('### ','')}</div>
      if (line.startsWith('- ')) return <div key={i} style={{ fontSize:'0.78rem', color:'var(--text)', padding:'0.2rem 0 0.2rem 1rem', borderLeft:'2px solid rgba(0,212,170,0.3)', marginBottom:'0.25rem' }}>{line.replace('- ','')}</div>
      if (line.trim() === '') return <div key={i} style={{ height:'0.4rem' }} />
      return <div key={i} style={{ fontSize:'0.78rem', color:'var(--text)', marginBottom:'0.2rem', lineHeight:1.6 }}>{line}</div>
    })
  }

  return (
    <div className="card" style={{ marginBottom:'1.5rem', border:'1px solid rgba(0,212,170,0.25)', borderTop:'2px solid var(--ai)', overflow:'hidden' }}>
      <div style={{ padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem', cursor:'pointer' }} onClick={() => !result && !loading ? analyze() : setOpen(o => !o)}>
        <div style={{ fontSize:'1.2rem' }}>🤖</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'0.82rem', fontWeight:900, color:'var(--ai)' }}>AI ダッシュボードアドバイザー</div>
          <div style={{ fontSize:'0.65rem', color:'var(--dim2)' }}>トレンド分析 · アクションプラン · 売上予測</div>
        </div>
        {!result && !loading && (
          <button onClick={e => { e.stopPropagation(); analyze() }} style={{ padding:'0.4rem 1rem', borderRadius:8, border:'none', background:'var(--ai)', color:'#fff', fontSize:'0.75rem', fontWeight:700, cursor:'pointer' }}>
            ✨ 分析する
          </button>
        )}
        {result && <span style={{ fontSize:'0.75rem', color:'var(--dim2)' }}>{open ? '▲ 閉じる' : '▼ 開く'}</span>}
        {loading && <span style={{ fontSize:'0.75rem', color:'var(--ai)', fontWeight:700 }}>⏳ 分析中...</span>}
      </div>
      {loading && (
        <div style={{ padding:'2rem', textAlign:'center' }}>
          <div className="spinner" style={{ borderColor:'rgba(0,212,170,0.2)', borderTopColor:'var(--ai)' }} />
          <div style={{ fontSize:'0.75rem', color:'var(--ai)', marginTop:'0.75rem' }}>データを分析しています...</div>
        </div>
      )}
      {result && open && (
        <div style={{ padding:'0 1.25rem 1.25rem' }}>
          <div style={{ padding:'1rem', background:'rgba(0,212,170,0.04)', borderRadius:10, border:'1px solid rgba(0,212,170,0.1)' }}>
            {renderText(result)}
          </div>
          <button onClick={analyze} style={{ marginTop:'0.75rem', padding:'0.35rem 0.9rem', borderRadius:8, border:'1px solid rgba(0,212,170,0.3)', background:'transparent', color:'var(--ai)', fontSize:'0.7rem', cursor:'pointer', fontWeight:700 }}>
            🔄 再分析
          </button>
        </div>
      )}
    </div>
  )
}

function GoalPaceBlock({ uid, latest, monthlyDiarySales, weeklyDiarySales, todayDiarySales, fxRateOverride, shopeeIncome, inventoryCost, monthOrders, period = 'thismonth' }) {
  const [goals, setGoals] = useState(null)
  const [fxRate, setFxRate] = useState(1)
  useEffect(() => { if (uid) load() }, [uid])
  async function load() {
    try {
      const { db } = await import('../lib/firebase')
      const { doc, getDoc } = await import('firebase/firestore')
      const [goalSnap, fxSnap] = await Promise.all([
        getDoc(doc(db, 'user_goals', uid)),
        getDoc(doc(db, 'fx_rates', uid))
      ])
      if (goalSnap.exists()) setGoals(goalSnap.data())
      if (fxSnap.exists()) setFxRate(Number(fxSnap.data().rate_php_jpy) || 1)
    } catch(e) {}
  }
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()
  const daysElapsed = now.getDate()
  const periodGoals = goals?.[period] || {}
  const hasAnyGoal = Object.values(periodGoals).some(v => v && parseFloat(v) > 0)
  if (!goals || !hasAnyGoal || !latest) return null

  const effectiveFxRate = fxRateOverride || fxRate

  // 期間別の実績値・表示設定
  let salesActual, ordersActual, cvrActual, elapsed, total, periodLabel, borderColor
  if (period === 'thismonth') {
    salesActual = (monthlyDiarySales?.jpy && monthlyDiarySales.jpy > 0) ? monthlyDiarySales.jpy
      : Math.round((monthlyDiarySales?.php || 0) * effectiveFxRate)
    ordersActual = monthlyDiarySales?.orders || 0
    cvrActual = monthlyDiarySales?.cvr || 0
    elapsed = daysElapsed; total = daysInMonth
    periodLabel = '今月の目標ペース'; borderColor = 'var(--orange)'
  } else if (period === 'thisweek') {
    salesActual = (weeklyDiarySales?.jpy && weeklyDiarySales.jpy > 0) ? weeklyDiarySales.jpy
      : Math.round((weeklyDiarySales?.php || 0) * effectiveFxRate)
    ordersActual = weeklyDiarySales?.orders || 0
    cvrActual = weeklyDiarySales?.cvr || 0
    elapsed = Math.min(now.getDay() || 7, 7); total = 7
    periodLabel = '今週の目標ペース'; borderColor = 'var(--blue, #3b82f6)'
  } else if (period === 'today') {
    salesActual = (todayDiarySales?.jpy && todayDiarySales.jpy > 0) ? todayDiarySales.jpy
      : Math.round((todayDiarySales?.php || 0) * effectiveFxRate)
    ordersActual = todayDiarySales?.orders || 0
    cvrActual = todayDiarySales?.cvr || 0
    elapsed = 1; total = 1
    periodLabel = '前日の目標達成'; borderColor = 'var(--green)'
  }

  // 粗利計算（月次のみ）
  const feesJpy = Math.round((shopeeIncome?.fees || 0) * effectiveFxRate)
  const costMap = inventoryCost || {}
  const monthCostPhp = (monthOrders || [])
    .filter(o => o.status !== 'Cancelled')
    .reduce((s, o) => s + (Number(costMap[o.sku]) || 0) * (Number(o.qty) || 1), 0)
  const costJpy = Math.round(monthCostPhp * effectiveFxRate)
  const grossJpy = period === 'thismonth' ? Math.max(0, salesActual - feesJpy - costJpy) : 0

  const GOAL_KEYS = [
    { key:'sales',  label:'売上',   unit:'¥', actual: salesActual },
    { key:'gross',  label:'粗利',   unit:'¥', actual: grossJpy, color:'#10b981' },
    { key:'orders', label:'受注数', unit:'件', actual: ordersActual },
    { key:'ctr',    label:'CTR',   unit:'%',  actual: latest.kpis?.avgCtr },
    { key:'cvr',    label:'CVR',   unit:'%',  actual: cvrActual },
  ]
  const targets = GOAL_KEYS.filter(g => periodGoals[g.key] && parseFloat(periodGoals[g.key]) > 0)
  if (targets.length === 0) return null

  return (
    <div className="card" style={{ padding:'1.25rem', marginBottom:'1rem', borderTop:'2px solid '+borderColor }}>
      <div style={{ fontSize:'0.65rem', fontWeight:700, color: borderColor, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'1rem' }}>
        🏆 {periodLabel}　
        {period !== 'today' && <span style={{ color:'var(--dim2)', fontWeight:400 }}>{elapsed}日経過 / {total}日　</span>}
        <span style={{ color:'var(--dim2)', fontWeight:400 }}>💱 ₱1=¥{effectiveFxRate}</span>
      </div>
      {targets.map(g => (
        <GoalPaceBar key={g.key} label={g.label} unit={g.unit} color={g.color}
          actual={g.actual} target={periodGoals[g.key]}
          daysElapsed={elapsed} daysInMonth={total} fxRate={fxRate} />
      ))}
      <div style={{ marginTop:'0.75rem', fontSize:'0.65rem', color:'var(--dim2)', textAlign:'right' }}>
        目標は <span style={{ color:'var(--orange)', cursor:'pointer', textDecoration:'underline' }}>🏆 目標管理</span> タブで変更できます
      </div>
    </div>
  )
}

function GoalsTab({ uid, latest }) {
  const GOAL_PERIODS = [
    { id:'3years',   label:'🚀 3年後（2029年）',        desc:'長期ビジョン' },
    { id:'dec2026',  label:'🎄 2026年12月',             desc:'年末目標' },
    { id:'aug2026',  label:'☀️ 2026年8月（繁忙期直前）', desc:'繁忙期準備' },
    { id:'thismonth',label:'📅 今月の目標',              desc:new Date().getFullYear()+'年'+(new Date().getMonth()+1)+'月' },
    { id:'thisweek', label:'📆 今週の目標',              desc:'直近7日間' },
    { id:'today',    label:'📅 1日の目標',               desc:'1日あたり' },
  ]
  const GOAL_KEYS = [
    { key:'sales',   label:'売上目標',   unit:'¥', color:'var(--orange)', placeholder:'例: 800000' },
    { key:'orders',  label:'受注数目標', unit:'件', color:'var(--purple)', placeholder:'例: 100' },
    { key:'ctr',     label:'CTR目標',   unit:'%',  color:'#2563eb',       placeholder:'例: 5.0' },
    { key:'cvr',     label:'CVR目標',   unit:'%',  color:'#16a34a',       placeholder:'例: 8.0' },
    { key:'gross',   label:'粗利目標',  unit:'¥', color:'#10b981',       placeholder:'例: 300000' },
    { key:'profit',  label:'営業利益目標',unit:'¥', color:'#06b6d4',      placeholder:'例: 200000' },
  ]
  const [goals, setGoals] = useState({})
  const [editing, setEditing] = useState('thismonth')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [fxRate, setFxRate] = useState(1)

  useEffect(() => { if (uid) loadGoals() }, [uid])

  async function loadGoals() {
    try {
      const { db } = await import('../lib/firebase')
      const { doc, getDoc } = await import('firebase/firestore')
      const [goalSnap, fxSnap] = await Promise.all([
        getDoc(doc(db, 'user_goals', uid)),
        getDoc(doc(db, 'fx_rates', uid))
      ])
      if (goalSnap.exists()) setGoals(goalSnap.data())
      if (fxSnap.exists()) setFxRate(Number(fxSnap.data().rate_php_jpy) || 1)
    } catch(e) { console.error(e) }
  }

  async function saveGoals() {
    setSaving(true)
    try {
      const { db } = await import('../lib/firebase')
      const { doc, setDoc } = await import('firebase/firestore')
      await setDoc(doc(db, 'user_goals', uid), { ...goals, updatedAt: new Date().toISOString() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch(e) { alert('保存エラー: '+e.message) }
    setSaving(false)
  }

  function setGoalVal(period, key, val) {
    setGoals(prev => ({ ...prev, [period]: { ...(prev[period]||{}), [key]: val } }))
  }

  function getActual(key) {
    if (!latest) return null
    const map = { sales: (latest.kpis?.totalSales||0) * fxRate, orders: latest.kpis?.totalOrders, ctr: latest.kpis?.avgCtr, cvr: latest.kpis?.avgCvr }
    return map[key] ?? null
  }

  function getRate(actual, target) {
    if (!actual || !target || parseFloat(target) === 0) return null
    return Math.min(Math.round((actual / parseFloat(target)) * 100), 999)
  }

  const activePeriod = GOAL_PERIODS.find(p => p.id === editing)

  return (
    <div className="fade-up">
      {/* 期間タブ */}
      <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
        {GOAL_PERIODS.map(p => (
          <button key={p.id} onClick={() => setEditing(p.id)} style={{ padding:'0.5rem 1rem', borderRadius:10, border:'1px solid', borderColor:editing===p.id?'var(--orange)':'var(--rim)', background:editing===p.id?'rgba(255,107,43,0.1)':'transparent', color:editing===p.id?'var(--orange)':'var(--dim2)', cursor:'pointer', fontSize:'0.78rem', fontWeight:editing===p.id?800:600, transition:'all 0.15s' }}>
            {p.label}
            <div style={{ fontSize:'0.6rem', color:'var(--dim2)', fontWeight:400 }}>{p.desc}</div>
          </button>
        ))}
      </div>

      {/* 目標入力 */}
      <div className="card" style={{ padding:'1.5rem', marginBottom:'1rem' }}>
        <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--orange)', marginBottom:'1.25rem', textTransform:'uppercase', letterSpacing:'0.1em' }}>
          {activePeriod?.label} の目標設定
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'1rem' }}>
          {GOAL_KEYS.map(g => {
            const val = goals[editing]?.[g.key] || ''
            const actual = editing === 'thismonth' ? getActual(g.key) : null
            const rate = editing === 'thismonth' ? getRate(actual, val) : null
            return (
              <div key={g.key} style={{ padding:'0.75rem', background:'rgba(255,255,255,0.02)', borderRadius:10, border:'1px solid var(--rim)' }}>
                <div style={{ fontSize:'0.65rem', fontWeight:700, color:'var(--dim2)', marginBottom:'0.4rem', textTransform:'uppercase' }}>{g.label}</div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', marginBottom:'0.5rem' }}>
                  <span style={{ fontSize:'0.75rem', color:g.color }}>{g.unit}</span>
                  <input
                    type="number"
                    value={val}
                    onChange={e => setGoalVal(editing, g.key, e.target.value)}
                    placeholder={g.placeholder}
                    style={{ flex:1, background:'transparent', border:'none', borderBottom:'1px solid var(--rim2)', color:'var(--text)', fontSize:'0.95rem', fontWeight:700, fontFamily:"'DM Mono',monospace", outline:'none', padding:'0.1rem 0' }}
                  />
                </div>
                {editing === 'thismonth' && actual !== null && (
                  <div style={{ marginTop:'0.35rem' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.62rem', color:'var(--dim2)', marginBottom:'0.2rem' }}>
                      <span>現在: {g.unit==='¥'?'¥'+Math.round(actual).toLocaleString()+'（₱'+Math.round(actual/fxRate).toLocaleString()+'）':g.unit==='%'?actual?.toFixed(2)+'%':Math.round(actual).toLocaleString()+g.unit}</span>
                      {rate !== null && <span style={{ color:rate>=100?'var(--green)':rate>=70?'var(--yellow)':'var(--red)', fontWeight:700 }}>{rate}%</span>}
                    </div>
                    {val && <div style={{ height:4, borderRadius:2, background:'var(--rim)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:Math.min(rate||0,100)+'%', background:rate>=100?'var(--green)':rate>=70?'var(--yellow)':'var(--red)', borderRadius:2, transition:'width 0.5s' }} />
                    </div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ marginTop:'1.25rem', display:'flex', gap:'0.75rem', alignItems:'center' }}>
          <button onClick={saveGoals} disabled={saving} style={{ padding:'0.55rem 1.75rem', borderRadius:10, border:'none', background:'var(--orange)', color:'#fff', fontWeight:700, cursor:saving?'not-allowed':'pointer', fontSize:'0.82rem' }}>
            {saving ? '保存中...' : '💾 保存する'}
          </button>
          {saved && <span style={{ fontSize:'0.78rem', color:'var(--green)', fontWeight:700 }}>✅ 保存しました！</span>}
        </div>
      </div>

      {/* 今月の達成状況サマリー */}
      {editing === 'thismonth' && latest && (
        <div className="card" style={{ padding:'1.25rem' }}>
          <div style={{ fontSize:'0.65rem', fontWeight:700, color:'var(--dim2)', marginBottom:'1rem', textTransform:'uppercase', letterSpacing:'0.1em' }}>📊 今月の達成状況</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'0.75rem' }}>
            {GOAL_KEYS.filter(g => goals['thismonth']?.[g.key]).map(g => {
              const actual = getActual(g.key)
              const target = parseFloat(goals['thismonth']?.[g.key] || 0)
              const rate = getRate(actual, target)
              if (actual === null) return null
              return (
                <div key={g.key} style={{ padding:'0.75rem', background:'rgba(255,255,255,0.02)', borderRadius:10, border:'1px solid var(--rim)', borderTop:'2px solid '+g.color }}>
                  <div style={{ fontSize:'0.62rem', color:'var(--dim2)', fontWeight:700, marginBottom:'0.3rem' }}>{g.label}</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.5rem', color:g.color, lineHeight:1 }}>
                    {rate !== null ? rate+'%' : '-'}
                  </div>
                  <div style={{ fontSize:'0.65rem', color:'var(--dim2)', marginTop:'0.2rem' }}>
                    {g.unit==='¥'?'¥'+Math.round(actual).toLocaleString()+'（₱'+Math.round(actual/fxRate).toLocaleString()+'）':g.unit==='%'?actual?.toFixed(2)+'%':Math.round(actual).toLocaleString()+g.unit} / {g.unit==='¥'?'¥'+target.toLocaleString():g.unit==='%'?target+'%':target+g.unit}
                  </div>
                  <div style={{ height:3, borderRadius:2, background:'var(--rim)', marginTop:'0.4rem', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:Math.min(rate||0,100)+'%', background:rate>=100?'var(--green)':rate>=70?'var(--yellow)':'var(--red)', borderRadius:2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
