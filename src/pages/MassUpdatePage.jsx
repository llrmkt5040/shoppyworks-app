import { useState, useEffect, useCallback } from 'react'
import { db, auth } from '../lib/firebase'
import { collection, getDocs, addDoc, serverTimestamp, doc, setDoc, getDoc, writeBatch, query, where } from 'firebase/firestore'

function classifySku(sku) {
  if (!sku) return 'unknown'
  const s = sku.toLowerCase()
  if (s.includes('pasabuy') || s.includes('pb-')) return 'pasabuy'
  if (s.includes('stock-') || s.includes('stock_')) return 'instock'
  return 'nostock'
}

const SKU_CLASS = {
  instock:  { label: '有在庫', color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
  nostock:  { label: '無在庫', color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  pasabuy:  { label: 'Pasabuy', color: '#a855f7', bg: 'rgba(168,85,247,0.08)' },
  unknown:  { label: '不明',   color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
}

// テンプレート別表示フィールド定義
const TEMPLATE_FIELDS = {
  'basic_info': [
    { key: 'jan', label: 'JANコード' },
    { key: 'origin', label: '原産国' },
    { key: 'brand', label: 'ブランド' },
    { key: 'category', label: 'カテゴリ' },
    { key: 'weight', label: '重量(g)' },
  ],
  'sales_info': [
    { key: 'price', label: '価格(₱)' },
    { key: 'stock', label: '在庫数' },
  ],
  'shipping_info': [
    { key: 'weight', label: '重量(g)' },
    { key: 'origin', label: '原産国' },
  ],
  'republish': [
    { key: 'price', label: '価格(₱)' },
    { key: 'stock', label: '在庫数' },
    { key: 'origin', label: '原産国' },
  ],
  'dts_info': [
    { key: 'dts', label: '発送日数' },
    { key: 'origin', label: '原産国' },
  ],
  'media_info': [
    { key: 'brand', label: 'ブランド' },
    { key: 'category', label: 'カテゴリ' },
  ],
}
const TEMPLATE_LABELS = {
  'basic_info':    'Basic Info',
  'sales_info':    'Sales Info',
  'shipping_info': 'Shipping Info',
  'republish':     'Republish',
  'dts_info':      'DTS Info',
  'media_info':    'Media Info',
}
const ALL_FIELDS = [
  { key: 'jan', label: 'JANコード' },
  { key: 'origin', label: '原産国' },
  { key: 'weight', label: '重量(g)' },
  { key: 'brand', label: 'ブランド' },
  { key: 'category', label: 'カテゴリ' },
  { key: 'price', label: '価格(₱)' },
  { key: 'stock', label: '在庫数' },
]

const PAGE_SIZE = 30

export default function MassUpdatePage({ uid: propUid }) {
  const [tab, setTab] = useState('upload')
  const [histories, setHistories] = useState([])
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState([])
  const [filter, setFilter] = useState('all')
  const [skuFilter, setSkuFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [inventory, setInventory] = useState([])
  const [editMap, setEditMap] = useState({})
  const [aiLoading, setAiLoading] = useState({})
  const [page, setPage] = useState(1)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkField, setBulkField] = useState('origin')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkSkuClass, setBulkSkuClass] = useState('instock')
  const [currentHistoryId, setCurrentHistoryId] = useState(null)
  const [dbProducts, setDbProducts] = useState([])
  const [dbSearch, setDbSearch] = useState('')
  const [dbSkuFilter, setDbSkuFilter] = useState('all')
  const [dbPage, setDbPage] = useState(1)
  const [dbLoading, setDbLoading] = useState(false)
  const [diff, setDiff] = useState(null)
  const [detectedTemplate, setDetectedTemplate] = useState(null)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [showAllFields, setShowAllFields] = useState(false)

  const uid = propUid || auth.currentUser?.uid

  useEffect(() => { loadAll() }, [uid])

  async function loadAll() {
    if (!uid) return
    try {
      // メタ情報のみ取得（productsは含まない）
      const snap = await getDocs(collection(db, 'mass_updates'))
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.uid === uid)
        .sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0))
      setHistories(list)
      if (list.length > 0) {
        await loadHistoryItems(list[0])
      }
      const invSnap = await getDocs(collection(db, 'inventory_items'))
      const invList = invSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.uid === uid)
      setInventory(invList)
      await loadProductDB()
    } catch(e) { console.error(e) }
  }

  // 新方式：mass_update_itemsから商品を取得
  async function loadHistoryItems(history) {
    setItemsLoading(true)
    setCurrentHistoryId(history.id)
    setPage(1)
    setSelectedIds(new Set())
    try {
      const q = query(collection(db, 'mass_update_items'), where('historyId', '==', history.id), where('uid', '==', uid))
      const snap = await getDocs(q)
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      // 旧方式フォールバック（移行前のデータ対応）
      const prods = items.length > 0 ? items : (history.products || [])
      setProducts(prods)

      // editMapをmass_update_itemsから構築
      const map = {}
      prods.forEach(p => {
        map[p.productId] = {
          jan: p.jan || '',
          origin: p.origin || 'Japan',
          weight: p.weight || '',
          category: p.category || '',
          brand: p.brand || '',
          price: p.price || '',
          stock: p.stock || '',
          skuClass: p.skuClass || classifySku(p.sku),
          aiFixSuggestion: p.aiFixSuggestion || '',
        }
      })
      setEditMap(map)

      // 旧方式のeditMapも確認してマージ
      try {
        const editSnap = await getDoc(doc(db, 'mass_update_edits', `${uid}_${history.id}`))
        if (editSnap.exists()) {
          const oldMap = editSnap.data().editMap || {}
          setEditMap(prev => {
            const merged = { ...prev }
            Object.entries(oldMap).forEach(([pid, e]) => {
              if (merged[pid]) {
                // 旧データで埋まっている値を優先してマージ
                Object.entries(e).forEach(([k, v]) => {
                  if (v && !merged[pid][k]) merged[pid][k] = v
                })
              }
            })
            return merged
          })
          setLastSaved(editSnap.data().savedAt?.toDate ? editSnap.data().savedAt.toDate() : null)
        }
      } catch(e) {}
    } catch(e) { console.error(e) }
    setItemsLoading(false)
  }

  // 新方式：編集内容をmass_update_itemsに保存（1商品1ドキュメント）
  async function saveEdits() {
    if (!uid || !currentHistoryId) return
    setSaving(true)
    try {
      const BATCH_SIZE = 499
      const entries = Object.entries(editMap)
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = writeBatch(db)
        const chunk = entries.slice(i, i + BATCH_SIZE)
        chunk.forEach(([productId, e]) => {
          const ref = doc(db, 'mass_update_items', `${uid}_${currentHistoryId}_${productId}`)
          batch.set(ref, {
            uid,
            historyId: currentHistoryId,
            productId,
            ...e,
            savedAt: serverTimestamp(),
          }, { merge: true })
        })
        await batch.commit()
      }
      const now = new Date()
      setLastSaved(now)
      await syncEditsToProductDB()
    } catch(e) { alert('保存エラー: ' + e.message) }
    setSaving(false)
  }

  async function loadProductDB() {
    if (!uid) return
    setDbLoading(true)
    try {
      const snap = await getDocs(collection(db, 'product_master'))
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.uid === uid)
        .sort((a, b) => (b.lastUpdated?.seconds || 0) - (a.lastUpdated?.seconds || 0))
      setDbProducts(list)
    } catch(e) { console.error(e) }
    setDbLoading(false)
  }

  async function saveToProductDB(prods) {
    if (!uid || !prods.length) return
    try {
      const BATCH_SIZE = 499
      const snap = await getDocs(collection(db, 'product_master'))
      const existingMap = {}
      snap.docs.filter(d => d.data().uid === uid).forEach(d => { existingMap[d.data().productId] = d.data() })
      const now = serverTimestamp()
      for (let i = 0; i < prods.length; i += BATCH_SIZE) {
        const batch = writeBatch(db)
        const chunk = prods.slice(i, i + BATCH_SIZE)
        chunk.forEach(p => {
          const ref = doc(db, 'product_master', `${uid}_${p.productId}`)
          const existing = existingMap[p.productId]
          batch.set(ref, {
            uid,
            productId: p.productId,
            sku: p.sku,
            name: p.name,
            skuClass: classifySku(p.sku),
            hasError: p.hasError,
            failReason: p.failReason || '',
            firstSeen: existing?.firstSeen || now,
            lastUpdated: now,
            uploadCount: (existing?.uploadCount || 0) + 1,
            jan: existing?.jan || '',
            origin: existing?.origin || 'Japan',
            brand: existing?.brand || '',
            category: existing?.category || '',
            weight: existing?.weight || '',
          }, { merge: true })
        })
        await batch.commit()
      }
    } catch(e) { console.error('DB保存エラー:', e) }
  }

  function calcDiff(newProds, prevProds) {
    if (!prevProds || prevProds.length === 0) return null
    const prevMap = {}
    prevProds.forEach(p => { prevMap[p.productId] = p })
    const newMap = {}
    newProds.forEach(p => { newMap[p.productId] = p })
    const added = newProds.filter(p => !prevMap[p.productId])
    const removed = prevProds.filter(p => !newMap[p.productId])
    const prevErrors = new Set(prevProds.filter(p => p.hasError).map(p => p.productId))
    const newErrors = new Set(newProds.filter(p => p.hasError).map(p => p.productId))
    const newlyErrored = newProds.filter(p => p.hasError && !prevErrors.has(p.productId))
    const errorFixed = prevProds.filter(p => p.hasError && !newErrors.has(p.productId))
    return {
      added, removed, newlyErrored, errorFixed,
      totalDiff: newProds.length - prevProds.length,
      errorDiff: newProds.filter(p=>p.hasError).length - prevProds.filter(p=>p.hasError).length,
    }
  }

  async function syncEditsToProductDB() {
    if (!uid || !products.length) return
    try {
      const BATCH_SIZE = 499
      const now = serverTimestamp()
      const entries = Object.entries(editMap)
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = writeBatch(db)
        const chunk = entries.slice(i, i + BATCH_SIZE)
        chunk.forEach(([productId, e]) => {
          const ref = doc(db, 'product_master', `${uid}_${productId}`)
          const updates = {}
          if (e.jan) updates.jan = e.jan
          if (e.origin) updates.origin = e.origin
          if (e.brand) updates.brand = e.brand
          if (e.category) updates.category = e.category
          if (e.weight) updates.weight = e.weight
          if (e.price) updates.latestPrice = e.price
          if (e.stock) updates.latestStock = e.stock
          if (e.skuClass) updates.skuClass = e.skuClass
          if (Object.keys(updates).length > 0) {
            batch.set(ref, { ...updates, lastUpdated: now }, { merge: true })
          }
        })
        await batch.commit()
      }
      await loadProductDB()
    } catch(e) { console.error('DB同期エラー:', e) }
  }

  function autoFillFromInventory() {
    if (inventory.length === 0) return alert('在庫棚卸データがありません。先にShopeeStockManagerで登録してください。')
    const skuMap = {}
    inventory.forEach(item => { if (item.sku) skuMap[item.sku.toLowerCase()] = item })
    let filled = 0
    setEditMap(prev => {
      const next = { ...prev }
      products.forEach(p => {
        const inv = skuMap[p.sku?.toLowerCase()]
        if (inv) {
          next[p.productId] = {
            ...next[p.productId],
            jan: inv.jan || next[p.productId]?.jan || '',
            origin: inv.origin || next[p.productId]?.origin || 'Japan',
          }
          filled++
        }
      })
      return next
    })
    alert(`✅ ${filled}件のJAN・原産国を自動補完しました`)
  }

  async function handleFile(file) {
    if (!file) return
    setLoading(true)
    try {
      const { read, utils } = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = utils.sheet_to_json(ws, { header: 1 })

      const templateType = String(rows[1]?.[0] || '').toLowerCase()
      const TEMPLATE_LABELS = {
        'basic_info': 'Basic Info',
        'sales_info': 'Sales Info（価格・在庫）',
        'shipping_info': 'Shipping Info（送料・サイズ）',
        'republish': 'Republish（再出品）',
        'dts_info': 'DTS Info（発送日数）',
        'media_info': 'Media Info（画像）',
      }
      const detectedTemplateLabel = TEMPLATE_LABELS[templateType] || templateType || '不明'

      let headerIdx = rows.findIndex(r => Array.isArray(r) && r.some(c => String(c||'').trim() === 'Product ID'))
      if (headerIdx < 0) headerIdx = 2
      const headers = rows[headerIdx].map(h => String(h || '').trim())

      function colIdx(names) {
        for (const name of names) {
          const i = headers.findIndex(h => h.toLowerCase() === name.toLowerCase())
          if (i >= 0) return i
        }
        return -1
      }
      const pidIdx  = colIdx(['Product ID', 'ProductID', 'product_id'])
      const skuIdx  = colIdx(['Parent SKU', 'ParentSKU', 'SKU', 'parent_sku'])
      const nameIdx = colIdx(['Product Name', 'ProductName', 'Name'])
      const descIdx = colIdx(['Product Description', 'Description'])
      const failIdx = colIdx(['Fail Reason', 'FailReason', 'Error', 'Reason'])
      const priceIdx  = colIdx(['Price', 'variation_price'])
      const stockIdx  = colIdx(['Stock', 'variation_stock'])
      const weightIdx = colIdx(['Product Weight/kg', 'Weight', 'product_weight'])
      const dtsIdx    = colIdx(['Days to ship', 'Non Pre-order DTS'])
      const actionIdx = colIdx(['Action'])

      if (pidIdx < 0) throw new Error(`Product ID列が見つかりません。\nテンプレート: ${detectedTemplateLabel}\nヘッダー行: ${headers.slice(0,8).join(', ')}`)

      const prods = rows.slice(headerIdx + 1)
        .filter(r => r[pidIdx] && String(r[pidIdx]).trim())
        .map(r => ({
          productId:   String(r[pidIdx] || ''),
          sku:         skuIdx >= 0  ? String(r[skuIdx]  || '') : '',
          name:        nameIdx >= 0 ? String(r[nameIdx] || '') : '',
          description: descIdx >= 0 ? String(r[descIdx] || '').slice(0, 200) : '',
          failReason:  failIdx >= 0 ? String(r[failIdx] || '') : '',
          hasError:    failIdx >= 0 ? !!(r[failIdx] && String(r[failIdx]).trim()) : false,
          ...(priceIdx >= 0  && r[priceIdx]  ? { price:  String(r[priceIdx]) }  : {}),
          ...(stockIdx >= 0  && r[stockIdx]  ? { stock:  String(r[stockIdx]) }  : {}),
          ...(weightIdx >= 0 && r[weightIdx] ? { weight: String(r[weightIdx]) } : {}),
          ...(dtsIdx >= 0    && r[dtsIdx]    ? { dts:    String(r[dtsIdx]) }    : {}),
          ...(actionIdx >= 0 && r[actionIdx] ? { action: String(r[actionIdx]) } : {}),
          templateType,
        }))
      const errorCount = prods.filter(p => p.hasError).length
      setDetectedTemplate(detectedTemplateLabel)

      // 差分計算：前回のmass_update_itemsから取得
      const prevSnap = await getDocs(query(
        collection(db, 'mass_updates'),
      ))
      const prevList = prevSnap.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.uid===uid).sort((a,b)=>(b.uploadedAt?.seconds||0)-(a.uploadedAt?.seconds||0))
      let prevProds = []
      if (prevList.length > 0) {
        const prevItemsSnap = await getDocs(query(collection(db, 'mass_update_items'), where('historyId','==',prevList[0].id), where('uid','==',uid)))
        prevProds = prevItemsSnap.docs.length > 0
          ? prevItemsSnap.docs.map(d=>d.data())
          : (prevList[0].products || [])
      }
      const diffResult = calcDiff(prods, prevProds)
      setDiff(diffResult)

      // メタ情報のみmass_updatesに保存（productsは含めない）
      const histRef = await addDoc(collection(db, 'mass_updates'), {
        uid, filename: file.name,
        uploadedAt: serverTimestamp(),
        totalCount: prods.length,
        errorCount,
        templateType,
        // 旧方式との互換性のため少量なら保持（500件以下のみ）
        products: prods.length <= 500 ? prods : [],
      })

      // 新方式：1商品1ドキュメントで保存
      const BATCH_SIZE = 499
      for (let i = 0; i < prods.length; i += BATCH_SIZE) {
        const batch = writeBatch(db)
        const chunk = prods.slice(i, i + BATCH_SIZE)
        chunk.forEach(p => {
          const ref = doc(db, 'mass_update_items', `${uid}_${histRef.id}_${p.productId}`)
          batch.set(ref, {
            uid,
            historyId: histRef.id,
            ...p,
            skuClass: classifySku(p.sku),
            jan: '',
            origin: 'Japan',
            weight: p.weight || '',
            brand: '',
            category: '',
            price: p.price || '',
            stock: p.stock || '',
            savedAt: serverTimestamp(),
          })
        })
        await batch.commit()
      }

      await saveToProductDB(prods)
      await loadAll()
      setTab('upload')
    } catch(e) { alert('エラー: ' + e.message) }
    setLoading(false)
  }

  async function aiCompleteSingle(productId, name, sku, failReason) {
    setAiLoading(prev => ({ ...prev, [productId]: true }))
    try {
      const prompt = `以下のShopee商品情報から、不足している情報を推定してJSON形式で返してください。

商品名: ${name}
SKU: ${sku}
${failReason ? 'Fail Reason: ' + failReason : ''}

以下の形式でJSONのみ返してください（説明文不要）:
{
  "jan": "JANコード（わからなければ空文字）",
  "origin": "原産国（例: Japan, China, Korea）",
  "weight": "重量グラム数（数字のみ、わからなければ空文字）",
  "brand": "ブランド名（わからなければ空文字）",
  "category": "Shopeeカテゴリ（例: Health & Beauty, Home & Living）",
  "fix": "${failReason ? 'Fail Reasonの修正案（日本語で簡潔に）' : ''}"
}`
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': await (async()=>{const{getAiKey}=await import('../lib/ai');return await getAiKey()})(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || '{}'
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setEditMap(prev => ({
        ...prev,
        [productId]: {
          ...prev[productId],
          ...(parsed.jan && { jan: parsed.jan }),
          ...(parsed.origin && { origin: parsed.origin }),
          ...(parsed.weight && { weight: parsed.weight }),
          ...(parsed.brand && { brand: parsed.brand }),
          ...(parsed.category && { category: parsed.category }),
          ...(parsed.fix && { aiFixSuggestion: parsed.fix }),
        }
      }))
    } catch(e) { alert('AI補完エラー: ' + e.message) }
    setAiLoading(prev => ({ ...prev, [productId]: false }))
  }

  async function aiCompleteAll(targetProducts) {
    const targets = (targetProducts || filteredProducts).slice(0, 20)
    if (!window.confirm(`表示中の${targets.length}件にAI補完を実行します（時間がかかります）`)) return
    for (const p of targets) {
      await aiCompleteSingle(p.productId, p.name, p.sku, p.failReason)
      await new Promise(r => setTimeout(r, 500))
    }
    alert('✅ 一括AI補完完了！')
  }

  async function downloadXlsx() {
    const { utils, writeFile } = await import('xlsx')
    const rows = [
      ['Product ID', 'Parent SKU', 'SKU分類', 'Product Name', 'JANコード', '原産国', '重量(g)', 'カテゴリ', 'ブランド', '価格', '在庫数', 'Fail Reason'],
      ...products.map(p => {
        const e = editMap[p.productId] || {}
        return [
          p.productId, p.sku, SKU_CLASS[e.skuClass || classifySku(p.sku)]?.label || '',
          p.name, e.jan || '', e.origin || '', e.weight || '',
          e.category || '', e.brand || '', e.price || '', e.stock || '',
          p.failReason || '',
        ]
      })
    ]
    const ws = utils.aoa_to_sheet(rows)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'MassUpdate')
    writeFile(wb, 'mass_update_edited.xlsx')
  }

  function setEdit(productId, key, val) {
    setEditMap(prev => ({ ...prev, [productId]: { ...(prev[productId] || {}), [key]: val } }))
  }

  function applyBulkSkuClass() {
    if (selectedIds.size === 0) return alert('商品を選択してください')
    setEditMap(prev => {
      const next = { ...prev }
      selectedIds.forEach(id => { next[id] = { ...(next[id] || {}), skuClass: bulkSkuClass } })
      return next
    })
    alert(`✅ ${selectedIds.size}件のSKU分類を「${SKU_CLASS[bulkSkuClass]?.label}」に変更しました`)
    setSelectedIds(new Set())
  }

  function applyBulkField() {
    if (selectedIds.size === 0) return alert('商品を選択してください')
    if (!bulkValue.trim()) return alert('値を入力してください')
    setEditMap(prev => {
      const next = { ...prev }
      selectedIds.forEach(id => { next[id] = { ...(next[id] || {}), [bulkField]: bulkValue } })
      return next
    })
    alert(`✅ ${selectedIds.size}件の「${bulkField}」を「${bulkValue}」に変更しました`)
    setSelectedIds(new Set())
    setBulkValue('')
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selectedIds.size === pagedProducts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pagedProducts.map(p => p.productId)))
    }
  }

  const filteredProducts = products.filter(p => {
    if (filter === 'error' && !p.hasError) return false
    if (filter === 'ok' && p.hasError) return false
    const sc = editMap[p.productId]?.skuClass || classifySku(p.sku)
    if (skuFilter !== 'all' && sc !== skuFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE)
  const pagedProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [filter, skuFilter, search])

  const TABS = [
    { id: 'upload', label: '📤 アップロード' },
    { id: 'products', label: '📋 商品一覧・編集' },
    { id: 'errors', label: `🔴 エラー${products.filter(p=>p.hasError).length > 0 ? '('+products.filter(p=>p.hasError).length+')' : ''}` },
    { id: 'db', label: '🗄️ 商品DB' },
    { id: 'history', label: '📅 履歴' },
  ]

  const inputStyle = { background: 'transparent', border: 'none', borderBottom: '1px solid var(--rim2)', color: 'var(--text)', fontSize: '0.72rem', outline: 'none', padding: '0.1rem 0.25rem', width: '100%' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--rim)', display: 'flex', overflowX: 'auto', flexShrink: 0, padding: '0 1.5rem' }}>
        {TABS.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{ padding: '0.85rem 1.1rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: tab === t.id ? 'var(--orange)' : 'var(--dim2)', borderBottom: tab === t.id ? '2px solid var(--orange)' : '2px solid transparent', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>{t.label}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>

        {tab === 'upload' && (
          <div className="fade-up">
            <div style={{ fontSize: '0.7rem', color: 'var(--dim2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>📤 Mass Update XLSXをアップロード</div>
            <div onClick={() => document.getElementById('mu-input').click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
              style={{ border: '2px dashed rgba(255,107,43,0.3)', borderRadius: 16, padding: '3rem', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,107,43,0.02)', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📦</div>
              <div style={{ fontWeight: 900, fontSize: '0.95rem', marginBottom: '0.35rem' }}>{loading ? '処理中...' : 'Mass Update XLSXをドロップ'}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--dim2)' }}>Shopee Seller Center › My Products › Mass Update › Basic Info</div>
              <input id="mu-input" type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            </div>
            {detectedTemplate && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem', padding:'0.6rem 1rem', background:'rgba(139,92,246,0.08)', borderRadius:8, border:'1px solid rgba(139,92,246,0.2)' }}>
                <span style={{ fontSize:'0.72rem', color:'var(--ai)', fontWeight:700 }}>📋 検出テンプレート:</span>
                <span style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text)' }}>{detectedTemplate}</span>
              </div>
            )}
            {histories.length > 0 && (
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--dim2)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>📊 最新アップロード状況</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '0.75rem' }}>
                  {[
                    { l: '総商品数', v: histories[0].totalCount + '件', c: 'var(--orange)' },
                    { l: 'エラー数', v: histories[0].errorCount + '件', c: histories[0].errorCount > 0 ? 'var(--red)' : 'var(--green)' },
                    { l: '正常数', v: (histories[0].totalCount - histories[0].errorCount) + '件', c: 'var(--green)' },
                    { l: 'アップ回数', v: histories.length + '回', c: 'var(--ai)' },
                  ].map(k => (
                    <div key={k.l} className="card" style={{ padding: '0.85rem', borderTop: '2px solid ' + k.c }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--dim2)', fontWeight: 700, marginBottom: '0.3rem', textTransform: 'uppercase' }}>{k.l}</div>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.6rem', color: k.c, lineHeight: 1 }}>{k.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {diff && (
              <div className="card" style={{ padding: '1.25rem', marginTop: '1.25rem', border: '1px solid rgba(255,107,43,0.2)' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.1em' }}>📊 前回との差分レポート</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  {[
                    { l: '商品数増減', v: (diff.totalDiff >= 0 ? '+' : '') + diff.totalDiff + '件', c: diff.totalDiff > 0 ? 'var(--green)' : diff.totalDiff < 0 ? 'var(--red)' : 'var(--dim2)' },
                    { l: '新規追加', v: '+' + diff.added.length + '件', c: diff.added.length > 0 ? 'var(--green)' : 'var(--dim2)' },
                    { l: '削除', v: '-' + diff.removed.length + '件', c: diff.removed.length > 0 ? 'var(--red)' : 'var(--dim2)' },
                    { l: '新規エラー', v: diff.newlyErrored.length + '件', c: diff.newlyErrored.length > 0 ? 'var(--red)' : 'var(--green)' },
                    { l: 'エラー解消', v: diff.errorFixed.length + '件', c: diff.errorFixed.length > 0 ? 'var(--green)' : 'var(--dim2)' },
                  ].map(k => (
                    <div key={k.l} className="card" style={{ padding: '0.75rem', borderTop: '2px solid ' + k.c }}>
                      <div style={{ fontSize: '0.58rem', color: 'var(--dim2)', fontWeight: 700, marginBottom: '0.25rem', textTransform: 'uppercase' }}>{k.l}</div>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.4rem', color: k.c, lineHeight: 1 }}>{k.v}</div>
                    </div>
                  ))}
                </div>
                {diff.added.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--green)', marginBottom: '0.4rem' }}>✅ 新規追加された商品（{diff.added.length}件）</div>
                    {diff.added.slice(0,5).map((p,i) => (
                      <div key={i} style={{ display:'flex', gap:'0.5rem', alignItems:'center', padding:'0.3rem 0.6rem', background:'rgba(22,163,74,0.07)', borderRadius:6, marginBottom:'0.25rem' }}>
                        <span style={{ fontSize:'0.68rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                        <span style={{ fontSize:'0.62rem', color:'var(--dim2)', whiteSpace:'nowrap' }}>{p.sku}</span>
                      </div>
                    ))}
                    {diff.added.length > 5 && <div style={{ fontSize:'0.65rem', color:'var(--dim2)', marginTop:'0.25rem' }}>他 {diff.added.length-5}件...</div>}
                  </div>
                )}
                {diff.removed.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--red)', marginBottom: '0.4rem' }}>🗑 削除された商品（{diff.removed.length}件）</div>
                    {diff.removed.slice(0,5).map((p,i) => (
                      <div key={i} style={{ display:'flex', gap:'0.5rem', alignItems:'center', padding:'0.3rem 0.6rem', background:'rgba(220,38,38,0.07)', borderRadius:6, marginBottom:'0.25rem' }}>
                        <span style={{ fontSize:'0.68rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                        <span style={{ fontSize:'0.62rem', color:'var(--dim2)', whiteSpace:'nowrap' }}>{p.sku}</span>
                      </div>
                    ))}
                    {diff.removed.length > 5 && <div style={{ fontSize:'0.65rem', color:'var(--dim2)', marginTop:'0.25rem' }}>他 {diff.removed.length-5}件...</div>}
                  </div>
                )}
                {diff.newlyErrored.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--red)', marginBottom: '0.4rem' }}>🔴 新たにエラーになった商品（{diff.newlyErrored.length}件）</div>
                    {diff.newlyErrored.slice(0,5).map((p,i) => (
                      <div key={i} style={{ padding:'0.35rem 0.6rem', background:'rgba(220,38,38,0.07)', borderRadius:6, marginBottom:'0.25rem' }}>
                        <div style={{ fontSize:'0.68rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize:'0.62rem', color:'var(--red)', marginTop:'0.15rem' }}>⚠ {p.failReason}</div>
                      </div>
                    ))}
                  </div>
                )}
                {diff.errorFixed.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--green)', marginBottom: '0.4rem' }}>🎉 エラーが解消された商品（{diff.errorFixed.length}件）</div>
                    {diff.errorFixed.slice(0,5).map((p,i) => (
                      <div key={i} style={{ display:'flex', gap:'0.5rem', alignItems:'center', padding:'0.3rem 0.6rem', background:'rgba(22,163,74,0.07)', borderRadius:6, marginBottom:'0.25rem' }}>
                        <span style={{ fontSize:'0.68rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {diff.added.length===0 && diff.removed.length===0 && diff.newlyErrored.length===0 && diff.errorFixed.length===0 && (
                  <div style={{ textAlign:'center', padding:'1rem', color:'var(--dim2)', fontSize:'0.8rem' }}>前回から変更なし</div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'products' && (
          <div className="fade-up">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', padding: '0.75rem 1rem', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--rim)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--dim2)' }}>
                {itemsLoading ? '⏳ 読み込み中...' : lastSaved ? `💾 最終保存: ${lastSaved.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : '⚠️ 未保存（ページを閉じると消えます）'}
              </div>
              <button onClick={saveEdits} disabled={saving || itemsLoading} style={{ padding: '0.4rem 1rem', borderRadius: 8, border: 'none', background: saving ? 'var(--dim)' : 'var(--orange)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}>
                {saving ? '保存中...' : '💾 Firestoreに保存'}
              </button>
            </div>
            {/* テンプレートバッジ */}
            {(() => {
              const tmpl = products[0]?.templateType || ''
              const label = TEMPLATE_LABELS[tmpl] || tmpl
              if (!tmpl) return null
              const fields = TEMPLATE_FIELDS[tmpl] || ALL_FIELDS
              return (
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem', padding:'0.6rem 1rem', background:'rgba(139,92,246,0.06)', borderRadius:8, border:'1px solid rgba(139,92,246,0.2)', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'0.65rem', color:'var(--ai)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em' }}>📋 テンプレート</span>
                  <span style={{ fontSize:'0.78rem', fontWeight:900, padding:'0.15rem 0.6rem', borderRadius:6, background:'rgba(139,92,246,0.12)', color:'var(--ai)' }}>{label}</span>
                  <span style={{ fontSize:'0.65rem', color:'var(--dim2)' }}>表示: {(showAllFields ? ALL_FIELDS : fields).map(f=>f.label).join(' · ')}</span>
                  <button onClick={()=>setShowAllFields(v=>!v)} style={{ marginLeft:'auto', padding:'0.25rem 0.75rem', borderRadius:6, border:'1px solid', borderColor:showAllFields?'var(--orange)':'rgba(139,92,246,0.4)', background:showAllFields?'rgba(255,107,43,0.1)':'transparent', color:showAllFields?'var(--orange)':'var(--ai)', fontSize:'0.68rem', fontWeight:700, cursor:'pointer' }}>
                    {showAllFields ? '✅ 全フィールド表示中' : '🔲 全フィールド表示'}
                  </button>
                </div>
              )
            })()}
            {bulkMode && (
              <div style={{ padding: '1rem', background: 'rgba(255,107,43,0.05)', border: '1px solid rgba(255,107,43,0.2)', borderRadius: 10, marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--orange)', marginBottom: '0.75rem' }}>✏️ 一括編集モード　{selectedIds.size > 0 && <span style={{ color: 'var(--text)' }}>（{selectedIds.size}件選択中）</span>}</div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--dim2)', marginBottom: '0.25rem' }}>SKU分類を変更</div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {['instock', 'nostock', 'pasabuy'].map(c => (
                        <button key={c} onClick={() => setBulkSkuClass(c)} style={{ padding: '0.3rem 0.6rem', borderRadius: 6, border: '1px solid', borderColor: bulkSkuClass === c ? SKU_CLASS[c].color : 'var(--rim)', background: bulkSkuClass === c ? SKU_CLASS[c].bg : 'transparent', color: bulkSkuClass === c ? SKU_CLASS[c].color : 'var(--dim2)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>{SKU_CLASS[c].label}</button>
                      ))}
                      <button onClick={applyBulkSkuClass} style={{ padding: '0.3rem 0.75rem', borderRadius: 6, border: 'none', background: 'var(--orange)', color: '#fff', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>適用</button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--dim2)', marginBottom: '0.25rem' }}>フィールドを一括変更</div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <select value={bulkField} onChange={e => setBulkField(e.target.value)} style={{ fontSize: '0.7rem', background: 'var(--surface)', border: '1px solid var(--rim)', color: 'var(--text)', borderRadius: 6, padding: '0.3rem 0.5rem' }}>
                        <option value="origin">原産国</option>
                        <option value="brand">ブランド</option>
                        <option value="category">カテゴリ</option>
                        <option value="weight">重量(g)</option>
                        <option value="price">価格(₱)</option>
                        <option value="stock">在庫数</option>
                      </select>
                      <input value={bulkValue} onChange={e => setBulkValue(e.target.value)} placeholder="値を入力" style={{ padding: '0.3rem 0.6rem', borderRadius: 6, border: '1px solid var(--rim)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.7rem', width: 120 }} />
                      <button onClick={applyBulkField} style={{ padding: '0.3rem 0.75rem', borderRadius: 6, border: 'none', background: 'var(--orange)', color: '#fff', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>適用</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="商品名・SKUで検索..." style={{ flex: 1, minWidth: 180, padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--rim)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.8rem' }} />
              {['all', 'ok', 'error'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '0.4rem 0.75rem', borderRadius: 8, border: '1px solid', borderColor: filter === f ? 'var(--orange)' : 'var(--rim)', background: filter === f ? 'rgba(255,107,43,0.1)' : 'transparent', color: filter === f ? 'var(--orange)' : 'var(--dim2)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                  {f === 'all' ? '全て' : f === 'ok' ? '✅ 正常' : '🔴 エラー'}
                </button>
              ))}
              {['all', 'instock', 'nostock', 'pasabuy'].map(f => (
                <button key={f} onClick={() => setSkuFilter(f)} style={{ padding: '0.4rem 0.75rem', borderRadius: 8, border: '1px solid', borderColor: skuFilter === f ? SKU_CLASS[f]?.color || 'var(--orange)' : 'var(--rim)', background: skuFilter === f ? (SKU_CLASS[f]?.bg || 'transparent') : 'transparent', color: skuFilter === f ? (SKU_CLASS[f]?.color || 'var(--orange)') : 'var(--dim2)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                  {f === 'all' ? '全分類' : SKU_CLASS[f]?.label}
                </button>
              ))}
              <button onClick={autoFillFromInventory} style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: '1px solid var(--green)', background: 'rgba(22,163,74,0.1)', color: 'var(--green)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>🔗 在庫から自動補完</button>
              <button onClick={() => aiCompleteAll()} style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: '1px solid var(--ai)', background: 'rgba(139,92,246,0.1)', color: 'var(--ai)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>🤖 一括AI補完</button>
              <button onClick={() => { setBulkMode(m => !m); setSelectedIds(new Set()) }} style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: '1px solid', borderColor: bulkMode ? 'var(--orange)' : 'var(--rim)', background: bulkMode ? 'rgba(255,107,43,0.1)' : 'transparent', color: bulkMode ? 'var(--orange)' : 'var(--dim2)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>✏️ 一括編集{bulkMode ? ' ON' : ''}</button>
              <button onClick={downloadXlsx} style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: 'none', background: 'var(--orange)', color: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>⬇ XLSX</button>
              <span style={{ fontSize: '0.72rem', color: 'var(--dim2)' }}>{filteredProducts.length}件</span>
            </div>
            {bulkMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', padding: '0.4rem 0.75rem', background: 'var(--surface)', borderRadius: 8 }}>
                <input type="checkbox" checked={selectedIds.size === pagedProducts.length && pagedProducts.length > 0} onChange={selectAll} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                <span style={{ fontSize: '0.72rem', color: 'var(--dim2)' }}>このページを全選択（{pagedProducts.length}件）</span>
                {selectedIds.size > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--orange)', fontWeight: 700 }}>{selectedIds.size}件選択中</span>}
              </div>
            )}
            {itemsLoading ? (
              <div style={{ textAlign:'center', padding:'3rem', color:'var(--dim2)' }}>⏳ 商品データ読み込み中...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {pagedProducts.map((p, i) => {
                  const e = editMap[p.productId] || {}
                  const sc = e.skuClass || classifySku(p.sku)
                  const cls = SKU_CLASS[sc]
                  const isSelected = selectedIds.has(p.productId)
                  return (
                    <div key={i} className="card" style={{ padding: '0.85rem 1rem', borderLeft: '3px solid ' + (p.hasError ? 'var(--red)' : cls.color), background: isSelected ? 'rgba(255,107,43,0.04)' : undefined }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        {bulkMode && (
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.productId)} style={{ cursor: 'pointer', width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: 4, background: cls.bg, color: cls.color, fontWeight: 700, whiteSpace: 'nowrap' }}>{cls.label}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          <div style={{ fontSize: '0.63rem', color: 'var(--dim2)' }}>ID: {p.productId}　SKU: {p.sku}</div>
                          {p.hasError && <div style={{ fontSize: '0.65rem', color: 'var(--red)', fontWeight: 700 }}>⚠ {p.failReason}</div>}
                          {e.aiFixSuggestion && <div style={{ fontSize: '0.63rem', color: 'var(--ai)', marginTop: '0.2rem' }}>💡 {e.aiFixSuggestion}</div>}
                        </div>
                        <select value={e.skuClass || sc} onChange={ev => setEdit(p.productId, 'skuClass', ev.target.value)} style={{ fontSize: '0.68rem', background: 'var(--surface)', border: '1px solid var(--rim)', color: 'var(--text)', borderRadius: 6, padding: '0.2rem' }}>
                          <option value="instock">有在庫</option>
                          <option value="nostock">無在庫</option>
                          <option value="pasabuy">Pasabuy</option>
                        </select>
                        <button onClick={() => aiCompleteSingle(p.productId, p.name, p.sku, p.failReason)} disabled={aiLoading[p.productId]} style={{ padding: '0.25rem 0.6rem', borderRadius: 6, border: '1px solid var(--ai)', background: aiLoading[p.productId] ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.1)', color: 'var(--ai)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {aiLoading[p.productId] ? '⏳' : '🤖'}
                        </button>
                      </div>
                      {(() => {
                        const tmpl = products.find(x=>x.productId===p.productId)?.templateType || ''
                        const fields = showAllFields ? ALL_FIELDS : (TEMPLATE_FIELDS[tmpl] || ALL_FIELDS)
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: '0.5rem' }}>
                            {fields.map(field => (
                              <div key={field.key}>
                                <div style={{ fontSize: '0.58rem', color: 'var(--dim2)', fontWeight: 700, marginBottom: '0.15rem' }}>{field.label}</div>
                                <input value={e[field.key] || ''} onChange={ev => setEdit(p.productId, field.key, ev.target.value)} style={inputStyle} placeholder="-" />
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            )}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: '0.35rem 0.7rem', borderRadius: 6, border: '1px solid var(--rim)', background: 'transparent', color: page === 1 ? 'var(--dim)' : 'var(--text)', cursor: page === 1 ? 'default' : 'pointer', fontSize: '0.72rem' }}>«</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '0.35rem 0.7rem', borderRadius: 6, border: '1px solid var(--rim)', background: 'transparent', color: page === 1 ? 'var(--dim)' : 'var(--text)', cursor: page === 1 ? 'default' : 'pointer', fontSize: '0.72rem' }}>‹</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p
                  if (totalPages <= 7) p = i + 1
                  else if (page <= 4) p = i + 1
                  else if (page >= totalPages - 3) p = totalPages - 6 + i
                  else p = page - 3 + i
                  return (
                    <button key={p} onClick={() => setPage(p)} style={{ padding: '0.35rem 0.7rem', borderRadius: 6, border: '1px solid', borderColor: page === p ? 'var(--orange)' : 'var(--rim)', background: page === p ? 'rgba(255,107,43,0.1)' : 'transparent', color: page === p ? 'var(--orange)' : 'var(--text)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: page === p ? 700 : 400 }}>{p}</button>
                  )
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '0.35rem 0.7rem', borderRadius: 6, border: '1px solid var(--rim)', background: 'transparent', color: page === totalPages ? 'var(--dim)' : 'var(--text)', cursor: page === totalPages ? 'default' : 'pointer', fontSize: '0.72rem' }}>›</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: '0.35rem 0.7rem', borderRadius: 6, border: '1px solid var(--rim)', background: 'transparent', color: page === totalPages ? 'var(--dim)' : 'var(--text)', cursor: page === totalPages ? 'default' : 'pointer', fontSize: '0.72rem' }}>»</button>
                <span style={{ fontSize: '0.68rem', color: 'var(--dim2)' }}>{page} / {totalPages}ページ（{filteredProducts.length}件）</span>
              </div>
            )}
          </div>
        )}

        {tab === 'errors' && (
          <div className="fade-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--dim2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>🔴 Fail Reasonエラー一覧</div>
              {products.filter(p => p.hasError).length > 0 && (
                <button onClick={() => aiCompleteAll(products.filter(p => p.hasError))} style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: '1px solid var(--ai)', background: 'rgba(139,92,246,0.1)', color: 'var(--ai)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>🤖 エラー商品を一括AI補完</button>
              )}
            </div>
            {products.filter(p => p.hasError).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--green)', fontSize: '1rem' }}>🎉 エラーなし！全商品正常です</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {products.filter(p => p.hasError).map((p, i) => {
                  const e = editMap[p.productId] || {}
                  return (
                    <div key={i} className="card" style={{ padding: '1rem', borderLeft: '3px solid var(--red)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem' }}>{p.name}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--purple)', marginBottom: '0.3rem' }}>SKU: {p.sku}　ID: {p.productId}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--red)', fontWeight: 700, padding: '0.4rem 0.75rem', background: 'rgba(220,38,38,0.08)', borderRadius: 6 }}>⚠ {p.failReason}</div>
                          {e.aiFixSuggestion && <div style={{ fontSize: '0.68rem', color: 'var(--ai)', marginTop: '0.5rem', padding: '0.4rem 0.75rem', background: 'rgba(139,92,246,0.08)', borderRadius: 6 }}>💡 AI修正案: {e.aiFixSuggestion}</div>}
                        </div>
                        <button onClick={() => aiCompleteSingle(p.productId, p.name, p.sku, p.failReason)} disabled={aiLoading[p.productId]} style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--ai)', background: aiLoading[p.productId] ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.1)', color: 'var(--ai)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {aiLoading[p.productId] ? '⏳ 分析中...' : '🤖 AI補完'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'db' && (
          <div className="fade-up">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'0.5rem' }}>
              <div>
                <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em' }}>🗄️ 商品マスタDB</div>
                <div style={{ fontSize:'0.65rem', color:'var(--dim2)', marginTop:'0.25rem' }}>MassUpdateアップ時に自動蓄積・編集保存時に同期</div>
              </div>
              <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                <span style={{ fontSize:'0.72rem', color:'var(--dim2)' }}>登録数: <strong style={{ color:'var(--orange)' }}>{dbProducts.length}件</strong></span>
                <button onClick={loadProductDB} style={{ padding:'0.35rem 0.75rem', borderRadius:8, border:'1px solid var(--rim)', background:'transparent', color:'var(--dim2)', cursor:'pointer', fontSize:'0.72rem' }}>🔄 更新</button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:'0.75rem', marginBottom:'1.25rem' }}>
              {[
                { l:'総商品数', v:dbProducts.length+'件', c:'var(--orange)' },
                { l:'有在庫', v:dbProducts.filter(p=>p.skuClass==='instock').length+'件', c:'#16a34a' },
                { l:'無在庫', v:dbProducts.filter(p=>p.skuClass==='nostock').length+'件', c:'#2563eb' },
                { l:'Pasabuy', v:dbProducts.filter(p=>p.skuClass==='pasabuy').length+'件', c:'#a855f7' },
                { l:'エラーあり', v:dbProducts.filter(p=>p.hasError).length+'件', c:'var(--red)' },
              ].map(k => (
                <div key={k.l} className="card" style={{ padding:'0.85rem', borderTop:'2px solid '+k.c }}>
                  <div style={{ fontSize:'0.6rem', color:'var(--dim2)', fontWeight:700, marginBottom:'0.3rem', textTransform:'uppercase' }}>{k.l}</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.5rem', color:k.c, lineHeight:1 }}>{k.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap', alignItems:'center' }}>
              <input value={dbSearch} onChange={e=>{setDbSearch(e.target.value);setDbPage(1)}} placeholder="商品名・SKU・ブランドで検索..." style={{ flex:1, minWidth:180, padding:'0.5rem 0.75rem', borderRadius:8, border:'1px solid var(--rim)', background:'var(--surface)', color:'var(--text)', fontSize:'0.8rem' }} />
              {['all','instock','nostock','pasabuy'].map(f=>(
                <button key={f} onClick={()=>{setDbSkuFilter(f);setDbPage(1)}} style={{ padding:'0.4rem 0.75rem', borderRadius:8, border:'1px solid', borderColor:dbSkuFilter===f?SKU_CLASS[f]?.color||'var(--orange)':'var(--rim)', background:dbSkuFilter===f?SKU_CLASS[f]?.bg||'transparent':'transparent', color:dbSkuFilter===f?SKU_CLASS[f]?.color||'var(--orange)':'var(--dim2)', cursor:'pointer', fontSize:'0.72rem', fontWeight:700 }}>
                  {f==='all'?'全分類':SKU_CLASS[f]?.label}
                </button>
              ))}
            </div>
            {dbLoading ? (
              <div style={{ textAlign:'center', padding:'3rem', color:'var(--dim2)' }}>読み込み中...</div>
            ) : (() => {
              const filtered = dbProducts.filter(p => {
                if (dbSkuFilter !== 'all' && p.skuClass !== dbSkuFilter) return false
                if (dbSearch) {
                  const q = dbSearch.toLowerCase()
                  return p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q)
                }
                return true
              })
              const dbTotalPages = Math.ceil(filtered.length / PAGE_SIZE)
              const paged = filtered.slice((dbPage-1)*PAGE_SIZE, dbPage*PAGE_SIZE)
              return (
                <>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                    {paged.map((p,i) => {
                      const cls = SKU_CLASS[p.skuClass] || SKU_CLASS.unknown
                      const firstDate = p.firstSeen?.toDate ? p.firstSeen.toDate().toLocaleDateString('ja-JP') : '-'
                      const lastDate = p.lastUpdated?.toDate ? p.lastUpdated.toDate().toLocaleDateString('ja-JP') : '-'
                      return (
                        <div key={i} className="card" style={{ padding:'0.85rem 1rem', borderLeft:'3px solid '+(p.hasError?'var(--red)':cls.color) }}>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem' }}>
                            <span style={{ fontSize:'0.65rem', padding:'0.15rem 0.5rem', borderRadius:4, background:cls.bg, color:cls.color, fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}>{cls.label}</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:'0.78rem', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                              <div style={{ fontSize:'0.63rem', color:'var(--dim2)', marginTop:'0.15rem' }}>ID: {p.productId}　SKU: {p.sku}</div>
                              <div style={{ display:'flex', gap:'1rem', marginTop:'0.35rem', flexWrap:'wrap' }}>
                                {p.brand && <span style={{ fontSize:'0.65rem', color:'var(--text)' }}>🏷 {p.brand}</span>}
                                {p.origin && <span style={{ fontSize:'0.65rem', color:'var(--text)' }}>🌏 {p.origin}</span>}
                                {p.jan && <span style={{ fontSize:'0.65rem', color:'var(--dim2)' }}>JAN: {p.jan}</span>}
                                {p.category && <span style={{ fontSize:'0.65rem', color:'var(--dim2)' }}>{p.category}</span>}
                                {p.latestPrice && <span style={{ fontSize:'0.65rem', color:'var(--orange)' }}>₱{p.latestPrice}</span>}
                              </div>
                            </div>
                            <div style={{ textAlign:'right', flexShrink:0 }}>
                              <div style={{ fontSize:'0.6rem', color:'var(--dim2)' }}>初回: {firstDate}</div>
                              <div style={{ fontSize:'0.6rem', color:'var(--dim2)' }}>更新: {lastDate}</div>
                              <div style={{ fontSize:'0.6rem', color:'var(--ai)', marginTop:'0.2rem' }}>📤 {p.uploadCount||1}回</div>
                            </div>
                          </div>
                          {p.hasError && <div style={{ fontSize:'0.65rem', color:'var(--red)', marginTop:'0.35rem', padding:'0.3rem 0.6rem', background:'rgba(220,38,38,0.08)', borderRadius:6 }}>⚠ {p.failReason}</div>}
                        </div>
                      )
                    })}
                    {paged.length === 0 && <div style={{ textAlign:'center', padding:'3rem', color:'var(--dim2)', fontSize:'0.85rem' }}>該当する商品がありません</div>}
                  </div>
                  {dbTotalPages > 1 && (
                    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'0.5rem', marginTop:'1.25rem', flexWrap:'wrap' }}>
                      <button onClick={()=>setDbPage(1)} disabled={dbPage===1} style={{ padding:'0.35rem 0.7rem', borderRadius:6, border:'1px solid var(--rim)', background:'transparent', color:dbPage===1?'var(--dim)':'var(--text)', cursor:dbPage===1?'default':'pointer', fontSize:'0.72rem' }}>«</button>
                      <button onClick={()=>setDbPage(p=>Math.max(1,p-1))} disabled={dbPage===1} style={{ padding:'0.35rem 0.7rem', borderRadius:6, border:'1px solid var(--rim)', background:'transparent', color:dbPage===1?'var(--dim)':'var(--text)', cursor:dbPage===1?'default':'pointer', fontSize:'0.72rem' }}>‹</button>
                      {Array.from({length:Math.min(dbTotalPages,7)},(_,i)=>{
                        let p
                        if(dbTotalPages<=7) p=i+1
                        else if(dbPage<=4) p=i+1
                        else if(dbPage>=dbTotalPages-3) p=dbTotalPages-6+i
                        else p=dbPage-3+i
                        return <button key={p} onClick={()=>setDbPage(p)} style={{ padding:'0.35rem 0.7rem', borderRadius:6, border:'1px solid', borderColor:dbPage===p?'var(--orange)':'var(--rim)', background:dbPage===p?'rgba(255,107,43,0.1)':'transparent', color:dbPage===p?'var(--orange)':'var(--text)', cursor:'pointer', fontSize:'0.72rem', fontWeight:dbPage===p?700:400 }}>{p}</button>
                      })}
                      <button onClick={()=>setDbPage(p=>Math.min(dbTotalPages,p+1))} disabled={dbPage===dbTotalPages} style={{ padding:'0.35rem 0.7rem', borderRadius:6, border:'1px solid var(--rim)', background:'transparent', color:dbPage===dbTotalPages?'var(--dim)':'var(--text)', cursor:dbPage===dbTotalPages?'default':'pointer', fontSize:'0.72rem' }}>›</button>
                      <button onClick={()=>setDbPage(dbTotalPages)} disabled={dbPage===dbTotalPages} style={{ padding:'0.35rem 0.7rem', borderRadius:6, border:'1px solid var(--rim)', background:'transparent', color:dbPage===dbTotalPages?'var(--dim)':'var(--text)', cursor:dbPage===dbTotalPages?'default':'pointer', fontSize:'0.72rem' }}>»</button>
                      <span style={{ fontSize:'0.68rem', color:'var(--dim2)' }}>{dbPage}/{dbTotalPages}ページ（{filtered.length}件）</span>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {tab === 'history' && (
          <div className="fade-up">
            <div style={{ fontSize: '0.7rem', color: 'var(--dim2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>📅 アップロード履歴</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {histories.map((h, i) => {
                const d = h.uploadedAt?.toDate ? h.uploadedAt.toDate() : new Date((h.uploadedAt?.seconds || 0) * 1000)
                return (
                  <div key={h.id} className="card" style={{ padding: '1rem', cursor: 'pointer', borderLeft: '3px solid ' + (h.errorCount > 0 ? 'var(--red)' : 'var(--green)'), opacity: currentHistoryId === h.id ? 1 : 0.8 }}
                    onClick={async () => { await loadHistoryItems(h); setTab('products') }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{h.filename} {currentHistoryId === h.id && <span style={{ fontSize: '0.65rem', color: 'var(--orange)', marginLeft: '0.5rem' }}>▶ 表示中</span>}</div>
                        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginTop:'0.2rem' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--dim2)' }}>{d.toLocaleDateString('ja-JP')} {d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                          {h.templateType && <span style={{ fontSize:'0.62rem', padding:'0.1rem 0.4rem', borderRadius:4, background:'rgba(139,92,246,0.1)', color:'var(--ai)', fontWeight:700 }}>{h.templateType}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--orange)', fontWeight: 700 }}>{h.totalCount}件</span>
                        {h.errorCount > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--red)', fontWeight: 700 }}>🔴 {h.errorCount}件エラー</span>}
                        {h.errorCount === 0 && <span style={{ fontSize: '0.72rem', color: 'var(--green)', fontWeight: 700 }}>✅ エラーなし</span>}
                        <span style={{ fontSize: '0.65rem', color: 'var(--dim2)' }}>→ 開く</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {histories.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--dim2)', fontSize: '0.85rem' }}>まだアップロード履歴がありません</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
