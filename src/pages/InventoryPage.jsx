import { useState, useEffect, useRef } from "react"

// ========== 定数 ==========
const FLAGS = ["定番A", "定番B", "定番C", "テスト", "廃盤品", "在庫処分"]
const STATUSES = ["販売中", "ページ作成中", "販売終了", "仕入判断"]
const CATEGORIES = ["サプリメント", "美容・コスメ", "日用品", "食品", "電子機器", "ファッション", "おもちゃ", "スポーツ", "その他"]
const TAX_RATES = [8, 10]

const inputStyle = {
  width: "100%", padding: "0.5rem 0.7rem", borderRadius: 8,
  border: "1px solid var(--rim)", background: "var(--surface)",
  color: "var(--text)", fontSize: "0.85rem", boxSizing: "border-box"
}
const labelStyle = {
  fontSize: "0.65rem", fontWeight: 700, color: "var(--dim2)",
  display: "block", marginBottom: "0.25rem"
}
const selectStyle = { ...inputStyle }

const emptyProduct = {
  parentNo: "", childNo: "", internalSku: "", jan: "",
  parentName: "", name: "", variation: "", category: "", flag: "定番A", status: "販売中",
  supplier: "", supplierUrl: "", unitPrice: "", taxRate: 10, orderUnit: "", orderAmount: "", orderMemo: "",
  currentStock: "", optimalStock: "", minStock: "", location: "佐久間ビル", shelfNo: "",
  imageUrl: "",
}

// ========== CSV パーサー ==========
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""))
  return lines.slice(1).map(line => {
    const cols = []
    let cur = "", inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { inQ = !inQ }
      else if (c === "," && !inQ) { cols.push(cur); cur = "" }
      else { cur += c }
    }
    cols.push(cur)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (cols[i] || "").trim() })
    return obj
  })
}

const CSV_MAP = {
  "親No.": "parentNo", "子No.": "childNo", "フラグ": "flag", "ステータス": "status",
  "商品名": "name", "バリエーション": "variation", "メーカー": "supplier",
  "仕入れURL": "supplierUrl", "単価(税込)": "unitPrice", "発注単位": "orderUnit",
  "仕入額": "orderAmount", "最新在庫": "currentStock", "適正在庫": "optimalStock",
  "最低在庫": "minStock", "JANコード": "jan", "カテゴリ": "category",
  "parentNo": "parentNo", "childNo": "childNo",
}

// ========== メインコンポーネント ==========
export default function InventoryPage({ uid }) {
  const [tab, setTab] = useState("list")
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterFlag, setFilterFlag] = useState("")
  const [filterSupplier, setFilterSupplier] = useState("")
  const [filterCategory, setFilterCategory] = useState("")
  const [detailItem, setDetailItem] = useState(null)
  const [shopeeInfo, setShopeeInfo] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [newProduct, setNewProduct] = useState({ ...emptyProduct })
  const [addSaving, setAddSaving] = useState(false)
  const [csvRows, setCsvRows] = useState([])
  const [csvPreview, setCsvPreview] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvError, setCsvError] = useState("")
  const fileRef = useRef()

  useEffect(() => { if (uid) loadProducts() }, [uid])

  async function loadProducts() {
    setLoading(true)
    try {
      const { db } = await import("../lib/firebase")
      const { collection, query, where, getDocs } = await import("firebase/firestore")
      const q = query(collection(db, "physical_products"), where("uid", "==", uid))
      const snap = await getDocs(q)
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => {
        const an = String(a.childNo || a.parentNo || "").padStart(10, "0")
        const bn = String(b.childNo || b.parentNo || "").padStart(10, "0")
        return an.localeCompare(bn)
      })
      setProducts(list)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function loadShopeeInfo(product) {
    const sku = product.internalSku || product.sku || ""
    if (!sku) return
    try {
      const { db } = await import("../lib/firebase")
      const { collection, getDocs } = await import("firebase/firestore")
      const snap = await getDocs(collection(db, "product_master"))
      const match = snap.docs.map(d => d.data()).find(d => d.uid === uid && (d.sku || "").toLowerCase() === sku.toLowerCase())
      if (match) setShopeeInfo(match)
    } catch(e) { console.error(e) }
  }

  async function saveEdit() {
    if (!editData?.name) return alert("商品名は必須です")
    setSaving(true)
    try {
      const { db } = await import("../lib/firebase")
      const { doc, updateDoc } = await import("firebase/firestore")
      const payload = {
        ...editData,
        unitPrice: Number(editData.unitPrice) || 0,
        taxRate: Number(editData.taxRate) || 10,
        orderUnit: Number(editData.orderUnit) || 0,
        orderAmount: Number(editData.orderAmount) || 0,
        currentStock: Number(editData.currentStock) || 0,
        optimalStock: Number(editData.optimalStock) || 0,
        minStock: Number(editData.minStock) || 0,
        updatedAt: new Date().toISOString(),
      }
      delete payload.id
      await updateDoc(doc(db, "physical_products", editData.id), payload)
      setDetailItem({ ...editData, ...payload })
      setEditMode(false)
      loadProducts()
    } catch (e) { alert("保存エラー: " + e.message) }
    setSaving(false)
  }

  async function deleteProduct(id) {
    if (!confirm("この商品を削除しますか？")) return
    try {
      const { db } = await import("../lib/firebase")
      const { doc, deleteDoc } = await import("firebase/firestore")
      await deleteDoc(doc(db, "physical_products", id))
      setDetailItem(null)
      loadProducts()
    } catch (e) { alert("削除エラー: " + e.message) }
  }

  async function addProduct() {
    if (!newProduct.name) return alert("商品名は必須です")
    setAddSaving(true)
    try {
      const { db } = await import("../lib/firebase")
      const { collection, addDoc } = await import("firebase/firestore")
      await addDoc(collection(db, "physical_products"), {
        ...newProduct, uid,
        unitPrice: Number(newProduct.unitPrice) || 0,
        taxRate: Number(newProduct.taxRate) || 10,
        orderUnit: Number(newProduct.orderUnit) || 0,
        orderAmount: Number(newProduct.orderAmount) || 0,
        currentStock: Number(newProduct.currentStock) || 0,
        optimalStock: Number(newProduct.optimalStock) || 0,
        minStock: Number(newProduct.minStock) || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      setNewProduct({ ...emptyProduct })
      alert("商品を登録しました！")
      loadProducts()
      setTab("list")
    } catch (e) { alert("登録エラー: " + e.message) }
    setAddSaving(false)
  }

  function handleCSVFile(e) {
    setCsvError("")
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const rows = parseCSV(ev.target.result)
        if (rows.length === 0) { setCsvError("データが見つかりません"); return }
        const mapped = rows.map(row => {
          const p = { ...emptyProduct }
          Object.entries(CSV_MAP).forEach(([csvCol, field]) => {
            if (row[csvCol] !== undefined && row[csvCol] !== "") p[field] = row[csvCol]
          })
          return p
        }).filter(p => p.name)
        setCsvRows(mapped)
        setCsvPreview(true)
      } catch (ex) { setCsvError("CSVの読み込みに失敗しました: " + ex.message) }
    }
    reader.readAsText(file, "UTF-8")
  }

  async function importCSV() {
    if (csvRows.length === 0) return
    setCsvImporting(true)
    try {
      const { db } = await import("../lib/firebase")
      const { collection, addDoc } = await import("firebase/firestore")
      let count = 0
      for (const row of csvRows) {
        await addDoc(collection(db, "physical_products"), {
          ...row, uid,
          unitPrice: Number(row.unitPrice) || 0,
          taxRate: Number(row.taxRate) || 10,
          orderUnit: Number(row.orderUnit) || 0,
          orderAmount: Number(row.orderAmount) || 0,
          currentStock: Number(row.currentStock) || 0,
          optimalStock: Number(row.optimalStock) || 0,
          minStock: Number(row.minStock) || 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        count++
      }
      alert(count + "件の商品をインポートしました！")
      setCsvRows([])
      setCsvPreview(false)
      if (fileRef.current) fileRef.current.value = ""
      loadProducts()
      setTab("list")
    } catch (e) { alert("インポートエラー: " + e.message) }
    setCsvImporting(false)
  }

  const filtered = products.filter(p => {
    if (search) {
      const q = search.toLowerCase()
      if (![p.name, p.parentName, p.variation, p.internalSku, p.jan, p.supplier]
        .some(v => v && String(v).toLowerCase().includes(q))) return false
    }
    if (filterStatus && p.status !== filterStatus) return false
    if (filterFlag && p.flag !== filterFlag) return false
    if (filterSupplier && p.supplier !== filterSupplier) return false
    if (filterCategory && p.category !== filterCategory) return false
    return true
  })

  const suppliers = [...new Set(products.map(p => p.supplier).filter(Boolean))].sort()
  const totalStock = products.reduce((s, p) => s + (Number(p.currentStock) || 0), 0)
  const totalValue = products.reduce((s, p) => s + (Number(p.currentStock) || 0) * (Number(p.unitPrice) || 0), 0)
  const alertCount = products.filter(p => (Number(p.currentStock) || 0) <= (Number(p.minStock) || 0) && p.minStock).length

  const tabStyle = (t) => ({
    padding: "0.5rem 1.2rem", borderRadius: "8px 8px 0 0", border: "1px solid var(--rim)",
    borderBottom: tab === t ? "1px solid var(--surface)" : "1px solid var(--rim)",
    background: tab === t ? "var(--surface)" : "transparent",
    color: tab === t ? "var(--text)" : "var(--dim2)",
    fontSize: "0.82rem", fontWeight: tab === t ? 700 : 400, cursor: "pointer",
    marginBottom: "-1px", position: "relative",
  })

  return (
    <div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {[
          { label: "商品種類", value: products.length + "種", color: "var(--text)" },
          { label: "総在庫数", value: totalStock.toLocaleString() + "個", color: "#a78bfa" },
          { label: "在庫総額", value: "¥" + totalValue.toLocaleString(), color: "var(--orange)" },
          { label: "発注アラート", value: alertCount + "件", color: alertCount > 0 ? "#ef4444" : "var(--dim2)" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "0.6rem 1rem", display: "inline-flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "0.62rem", color: "var(--dim2)" }}>{s.label}</span>
            <strong style={{ fontSize: "0.95rem", color: s.color }}>{s.value}</strong>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--rim)", marginBottom: "1rem" }}>
        {[
          { key: "list", label: "📦 商品一覧" },
          { key: "supplier", label: "🏭 仕入先別" },
          { key: "csv", label: "📥 CSV取込" },
          { key: "add", label: "➕ 商品登録" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={tabStyle(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === "list" && (
        <div>
          <div className="card" style={{ padding: "0.75rem 1rem", marginBottom: "0.75rem", display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 商品名・SKU・JANで検索..."
              style={{ ...inputStyle, width: 220 }} />
            {[
              { label: "ステータス", val: filterStatus, set: setFilterStatus, opts: STATUSES },
              { label: "フラグ", val: filterFlag, set: setFilterFlag, opts: FLAGS },
              { label: "カテゴリ", val: filterCategory, set: setFilterCategory, opts: CATEGORIES },
            ].map(f => (
              <select key={f.label} value={f.val} onChange={e => f.set(e.target.value)}
                style={{ ...selectStyle, width: 130 }}>
                <option value="">全{f.label}</option>
                {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}
            <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}
              style={{ ...selectStyle, width: 130 }}>
              <option value="">全仕入先</option>
              {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(search || filterStatus || filterFlag || filterSupplier || filterCategory) && (
              <button onClick={() => { setSearch(""); setFilterStatus(""); setFilterFlag(""); setFilterSupplier(""); setFilterCategory("") }}
                style={{ padding: "0.4rem 0.8rem", borderRadius: 8, border: "1px solid var(--rim)", background: "transparent", color: "var(--dim2)", fontSize: "0.75rem", cursor: "pointer" }}>
                クリア
              </button>
            )}
            <span style={{ fontSize: "0.72rem", color: "var(--dim2)", marginLeft: "auto" }}>{filtered.length}件表示</span>
          </div>

          {loading ? (
            <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--dim2)" }}>読み込み中...</div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--dim2)" }}>
              {products.length === 0 ? "商品がありません。「➕ 商品登録」または「📥 CSV取込」から追加してください。" : "条件に一致する商品がありません"}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--rim)" }}>
                      {["親No", "子No", "商品名", "バリエーション", "仕入先", "単価(¥)", "在庫", "適正", "過不足", "フラグ", "ステータス"].map(h => (
                        <th key={h} style={{ padding: "0.65rem 0.85rem", textAlign: h === "商品名" ? "left" : "center", fontWeight: 700, color: "var(--dim2)", fontSize: "0.62rem", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => {
                      const current = Number(p.currentStock) || 0
                      const optimal = Number(p.optimalStock) || 0
                      const minStock = Number(p.minStock) || 0
                      const diff = current - optimal
                      const isAlert = minStock > 0 && current <= minStock
                      return (
                        <tr key={p.id}
                          onClick={() => { setDetailItem(p); setEditMode(false); setShopeeInfo(null); loadShopeeInfo(p) }}
                          style={{ borderBottom: "1px solid var(--rim)", background: isAlert ? "rgba(239,68,68,0.05)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)", cursor: "pointer" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                          onMouseLeave={e => e.currentTarget.style.background = isAlert ? "rgba(239,68,68,0.05)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)"}
                        >
                          <td style={{ padding: "0.6rem 0.85rem", textAlign: "center", color: "var(--dim2)", fontSize: "0.72rem" }}>{p.parentNo || "-"}</td>
                          <td style={{ padding: "0.6rem 0.85rem", textAlign: "center", fontFamily: "monospace", fontSize: "0.72rem", color: "#3b82f6" }}>{p.childNo || "-"}</td>
                          <td style={{ padding: "0.6rem 0.85rem" }}>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            {p.jan && <div style={{ fontSize: "0.62rem", color: "var(--dim2)", fontFamily: "monospace" }}>{p.jan}</div>}
                          </td>
                          <td style={{ padding: "0.6rem 0.85rem", textAlign: "center", fontSize: "0.72rem", color: "var(--dim2)" }}>{p.variation || "-"}</td>
                          <td style={{ padding: "0.6rem 0.85rem", textAlign: "center", fontSize: "0.72rem" }}>{p.supplier || "-"}</td>
                          <td style={{ padding: "0.6rem 0.85rem", textAlign: "right", fontWeight: 600 }}>{Number(p.unitPrice) > 0 ? "¥" + Number(p.unitPrice).toLocaleString() : "-"}</td>
                          <td style={{ padding: "0.6rem 0.85rem", textAlign: "right", fontWeight: 700, color: isAlert ? "#ef4444" : "#a78bfa" }}>
                            {current.toLocaleString()}{isAlert && " ⚠️"}
                          </td>
                          <td style={{ padding: "0.6rem 0.85rem", textAlign: "right", color: "var(--dim2)" }}>{optimal > 0 ? optimal.toLocaleString() : "-"}</td>
                          <td style={{ padding: "0.6rem 0.85rem", textAlign: "right", fontWeight: 600, color: diff >= 0 ? "#22c55e" : "#ef4444" }}>
                            {optimal > 0 ? (diff >= 0 ? "+" : "") + diff.toLocaleString() : "-"}
                          </td>
                          <td style={{ padding: "0.6rem 0.85rem", textAlign: "center" }}><FlagBadge flag={p.flag} /></td>
                          <td style={{ padding: "0.6rem 0.85rem", textAlign: "center" }}><StatusBadge status={p.status} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "supplier" && (
        <div>
          {suppliers.length === 0 ? (
            <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--dim2)" }}>仕入先データがありません</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
              {suppliers.map(sup => {
                const items = products.filter(p => p.supplier === sup)
                const stockVal = items.reduce((s, p) => s + (Number(p.currentStock) || 0) * (Number(p.unitPrice) || 0), 0)
                const totalStockCount = items.reduce((s, p) => s + (Number(p.currentStock) || 0), 0)
                const alerts = items.filter(p => p.minStock && (Number(p.currentStock) || 0) <= (Number(p.minStock) || 0)).length
                return (
                  <div key={sup} className="card" style={{ padding: "1rem 1.25rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.6rem" }}>🏭 {sup}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      <Row label="商品種類" value={items.length + "種"} />
                      <Row label="総在庫数" value={totalStockCount.toLocaleString() + "個"} color="#a78bfa" />
                      <Row label="在庫総額" value={"¥" + stockVal.toLocaleString()} color="var(--orange)" />
                      {alerts > 0 && <Row label="発注アラート" value={alerts + "件"} color="#ef4444" />}
                    </div>
                    <div style={{ marginTop: "0.75rem", borderTop: "1px solid var(--rim)", paddingTop: "0.6rem" }}>
                      {items.slice(0, 4).map(p => (
                        <div key={p.id} onClick={() => { setDetailItem(p); setEditMode(false); setTab("list") }}
                          style={{ fontSize: "0.72rem", color: "var(--dim2)", padding: "0.2rem 0", cursor: "pointer", display: "flex", justifyContent: "space-between" }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{p.name}{p.variation ? " (" + p.variation + ")" : ""}</span>
                          <span style={{ color: (Number(p.currentStock) || 0) <= (Number(p.minStock) || 0) && p.minStock ? "#ef4444" : "var(--dim2)" }}>
                            {(Number(p.currentStock) || 0).toLocaleString()}個
                          </span>
                        </div>
                      ))}
                      {items.length > 4 && <div style={{ fontSize: "0.68rem", color: "var(--dim2)", marginTop: "0.25rem" }}>他 {items.length - 4}種...</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === "csv" && (
        <div>
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.5rem" }}>📥 CSVインポート</div>
            <div style={{ fontSize: "0.78rem", color: "var(--dim2)", marginBottom: "1.25rem", lineHeight: 1.7 }}>
              既存スプレッドシートからのCSVファイルを取り込みます。<br />
              対応列：親No.・子No.・フラグ・ステータス・商品名・バリエーション・メーカー・仕入れURL・単価(税込)・発注単位・仕入額・最新在庫・適正在庫・最低在庫・JANコード・カテゴリ
            </div>
            <div style={{ marginBottom: "1.25rem" }}>
              <button onClick={() => {
                const header = "親No.,子No.,商品名,バリエーション,メーカー,仕入れURL,単価(税込),発注単位,仕入額,最新在庫,適正在庫,最低在庫,フラグ,ステータス,JANコード,カテゴリ"
                const sample = "1,1-1,DAISOサプリ美白,美・ホワイト,DAISO,https://example.com,108,110,11880,714,759,150,定番A,販売中,4940921828214,サプリメント"
                const blob = new Blob([header + "\n" + sample], { type: "text/csv;charset=utf-8;" })
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob)
                a.download = "inventory_sample.csv"; a.click()
              }} style={{ padding: "0.4rem 1rem", borderRadius: 8, border: "1px solid rgba(59,130,246,0.4)", background: "rgba(59,130,246,0.1)", color: "#3b82f6", fontSize: "0.78rem", cursor: "pointer" }}>
                📄 サンプルCSVをダウンロード
              </button>
            </div>
            {!csvPreview && (
              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: "2px dashed var(--rim)", borderRadius: 12, padding: "2.5rem", textAlign: "center", cursor: "pointer" }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📂</div>
                <div style={{ color: "var(--dim2)", fontSize: "0.85rem" }}>CSVファイルをクリックして選択</div>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVFile} style={{ display: "none" }} />
              </div>
            )}
            {csvError && <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.75rem" }}>⚠️ {csvError}</div>}
            {csvPreview && csvRows.length > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>プレビュー（{csvRows.length}件）</div>
                  <button onClick={() => { setCsvPreview(false); setCsvRows([]); if (fileRef.current) fileRef.current.value = "" }}
                    style={{ padding: "0.3rem 0.8rem", borderRadius: 8, border: "1px solid var(--rim)", background: "transparent", color: "var(--dim2)", fontSize: "0.75rem", cursor: "pointer" }}>
                    キャンセル
                  </button>
                </div>
                <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--rim)", borderRadius: 10, marginBottom: "1rem" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                    <thead style={{ position: "sticky", top: 0, background: "var(--surface)" }}>
                      <tr style={{ borderBottom: "1px solid var(--rim)" }}>
                        {["子No", "商品名", "バリエーション", "仕入先", "単価(¥)", "在庫", "フラグ", "ステータス"].map(h => (
                          <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "var(--dim2)", fontSize: "0.62rem" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--rim)" }}>
                          <td style={{ padding: "0.4rem 0.75rem", fontFamily: "monospace", color: "#3b82f6" }}>{r.childNo || "-"}</td>
                          <td style={{ padding: "0.4rem 0.75rem", fontWeight: 600 }}>{r.name}</td>
                          <td style={{ padding: "0.4rem 0.75rem", color: "var(--dim2)" }}>{r.variation || "-"}</td>
                          <td style={{ padding: "0.4rem 0.75rem" }}>{r.supplier || "-"}</td>
                          <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{r.unitPrice ? "¥" + Number(r.unitPrice).toLocaleString() : "-"}</td>
                          <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{r.currentStock || "0"}</td>
                          <td style={{ padding: "0.4rem 0.75rem" }}><FlagBadge flag={r.flag} /></td>
                          <td style={{ padding: "0.4rem 0.75rem" }}><StatusBadge status={r.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={importCSV} disabled={csvImporting}
                  style={{ padding: "0.6rem 2rem", borderRadius: 8, border: "none", background: "var(--orange)", color: "#fff", fontSize: "0.85rem", fontWeight: 700, cursor: csvImporting ? "not-allowed" : "pointer", opacity: csvImporting ? 0.7 : 1 }}>
                  {csvImporting ? "インポート中..." : csvRows.length + "件をインポートする"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "add" && (
        <AddTab
          uid={uid}
          newProduct={newProduct} setNewProduct={setNewProduct}
          addProduct={addProduct} addSaving={addSaving}
          products={products} loadProducts={loadProducts}
          setTab={setTab}
        />
      )}

      {detailItem && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) { setDetailItem(null); setEditMode(false); setShopeeInfo(null) } }}>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: "1.5rem", width: "95%", maxWidth: 640, border: "1px solid var(--rim)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>
                  {detailItem.name}{detailItem.variation ? " — " + detailItem.variation : ""}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--dim2)", marginTop: 3 }}>
                  {detailItem.childNo ? "子No: " + detailItem.childNo + " · " : ""}{detailItem.supplier}
                </div>
              </div>
              <button onClick={() => { setDetailItem(null); setEditMode(false); setShopeeInfo(null) }}
                style={{ background: "transparent", border: "none", color: "var(--dim2)", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            </div>
            {editMode ? (
              <>
                <ProductForm data={editData} setData={setEditData} />
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                  <button onClick={saveEdit} disabled={saving}
                    style={{ padding: "0.5rem 1.5rem", borderRadius: 8, border: "none", background: "var(--orange)", color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                    {saving ? "保存中..." : "💾 保存"}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid var(--rim)", background: "transparent", color: "var(--dim2)", fontSize: "0.82rem", cursor: "pointer" }}>
                    キャンセル
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <InfoBlock label="ステータス" value={<StatusBadge status={detailItem.status} />} />
                  <InfoBlock label="フラグ" value={<FlagBadge flag={detailItem.flag} />} />
                  <InfoBlock label="カテゴリ" value={detailItem.category || "-"} />
                  <InfoBlock label="JANコード" value={detailItem.jan || "-"} mono />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <InfoBlock label="現在庫" value={(Number(detailItem.currentStock) || 0).toLocaleString() + "個"} color="#a78bfa" large />
                  <InfoBlock label="適正在庫" value={detailItem.optimalStock ? Number(detailItem.optimalStock).toLocaleString() + "個" : "-"} />
                  <InfoBlock label="最低在庫" value={detailItem.minStock ? Number(detailItem.minStock).toLocaleString() + "個" : "-"} color="#f59e0b" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <InfoBlock label="仕入単価" value={detailItem.unitPrice ? "¥" + Number(detailItem.unitPrice).toLocaleString() : "-"} color="var(--orange)" />
                  <InfoBlock label="発注単位" value={detailItem.orderUnit ? Number(detailItem.orderUnit).toLocaleString() + "個" : "-"} />
                  <InfoBlock label="1回仕入額" value={detailItem.orderAmount ? "¥" + Number(detailItem.orderAmount).toLocaleString() : "-"} />
                </div>
                {detailItem.supplierUrl && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <div style={{ fontSize: "0.62rem", color: "var(--dim2)", marginBottom: "0.2rem" }}>仕入れURL</div>
                    <a href={detailItem.supplierUrl} target="_blank" rel="noreferrer"
                      style={{ fontSize: "0.75rem", color: "#3b82f6", wordBreak: "break-all" }}>{detailItem.supplierUrl}</a>
                  </div>
                )}
                <InfoBlock label="保管場所" value={[detailItem.location, detailItem.shelfNo].filter(Boolean).join(" / ") || "-"} />

                {/* Shopee出品情報 */}
                {shopeeInfo && (
                  <div style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", background: "rgba(238,77,45,0.06)", borderRadius: 10, border: "1px solid rgba(238,77,45,0.2)" }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#ee4d2d", marginBottom: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>🛍️ Shopee出品情報</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                      <InfoBlock label="販売価格" value={shopeeInfo.latestPrice ? "₱" + Number(shopeeInfo.latestPrice).toLocaleString() : "-"} color="#ee4d2d" />
                      <InfoBlock label="Shopee在庫" value={shopeeInfo.latestStock ? shopeeInfo.latestStock + "個" : "-"} color="#a78bfa" />
                      <InfoBlock label="SKU分類" value={shopeeInfo.skuClass || "-"} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <InfoBlock label="ブランド" value={shopeeInfo.brand || "-"} />
                      <InfoBlock label="重量" value={shopeeInfo.weight ? shopeeInfo.weight + "kg" : "-"} />
                    </div>
                  </div>
                )}
                {shopeeInfo === null && detailItem.internalSku && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "var(--dim2)" }}>🛍️ Shopee出品情報を照合中...</div>
                )}

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
                  <button onClick={() => { setEditData({ ...detailItem }); setEditMode(true) }}
                    style={{ padding: "0.5rem 1.2rem", borderRadius: 8, border: "1px solid rgba(59,130,246,0.4)", background: "rgba(59,130,246,0.1)", color: "#3b82f6", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                    ✏️ 編集
                  </button>
                  <button onClick={() => deleteProduct(detailItem.id)}
                    style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: "0.82rem", cursor: "pointer" }}>
                    🗑️ 削除
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProductForm({ data, setData }) {
  const set = (key, val) => setData(d => ({ ...d, [key]: val }))
  const field = (key, label, opts = {}) => (
    <div>
      <label style={labelStyle}>{label}</label>
      {opts.select ? (
        <select value={data[key] || ""} onChange={e => set(key, e.target.value)} style={selectStyle}>
          {opts.empty && <option value="">{opts.empty}</option>}
          {opts.select.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={opts.type || "text"} value={data[key] || ""}
          onChange={e => set(key, e.target.value)}
          placeholder={opts.placeholder || ""}
          style={inputStyle} />
      )}
    </div>
  )
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Section title="識別情報">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 2fr", gap: "0.75rem" }}>
          {field("parentNo", "親No.", { placeholder: "1" })}
          {field("childNo", "子No.", { placeholder: "1-1" })}
          {field("internalSku", "社内管理SKU", { placeholder: "DAISO-SUPPL-WHITE" })}
          {field("jan", "JANコード", { placeholder: "4940921828214" })}
        </div>
      </Section>
      <Section title="商品情報">
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 2fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          {field("parentName", "親商品名", { placeholder: "ダイソーサプリメント" })}
          {field("name", "商品名 *", { placeholder: "サプリメント" })}
          {field("variation", "バリエーション", { placeholder: "美・ホワイト" })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "0.75rem" }}>
          {field("category", "カテゴリ", { select: CATEGORIES, empty: "選択してください" })}
          {field("flag", "フラグ", { select: FLAGS })}
          {field("status", "ステータス", { select: STATUSES })}
        </div>
      </Section>
      <Section title="仕入情報">
        <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          {field("supplier", "仕入先", { placeholder: "DAISO" })}
          {field("supplierUrl", "仕入れURL", { placeholder: "https://..." })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 2fr", gap: "0.75rem" }}>
          {field("unitPrice", "仕入単価(¥)", { type: "number", placeholder: "108" })}
          {field("taxRate", "消費税率", { select: TAX_RATES.map(String) })}
          {field("orderUnit", "発注単位(個)", { type: "number", placeholder: "110" })}
          {field("orderAmount", "1回仕入額(¥)", { type: "number", placeholder: "11880" })}
          {field("orderMemo", "発注メモ", { placeholder: "送料無料" })}
        </div>
      </Section>
      <Section title="在庫情報">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr 1fr", gap: "0.75rem" }}>
          {field("currentStock", "現在庫数", { type: "number", placeholder: "714" })}
          {field("optimalStock", "適正在庫", { type: "number", placeholder: "759" })}
          {field("minStock", "最低在庫(アラート)", { type: "number", placeholder: "150" })}
          {field("location", "保管場所", { placeholder: "佐久間ビル" })}
          {field("shelfNo", "棚番号", { placeholder: "A-3" })}
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--dim2)", marginBottom: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--rim)", paddingBottom: "0.3rem" }}>{title}</div>
      {children}
    </div>
  )
}

function InfoBlock({ label, value, color, mono, large }) {
  return (
    <div style={{ padding: "0.5rem 0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid var(--rim)" }}>
      <div style={{ fontSize: "0.6rem", color: "var(--dim2)", marginBottom: "0.2rem" }}>{label}</div>
      <div style={{ fontFamily: mono ? "monospace" : "inherit", fontWeight: large ? 700 : 500, fontSize: large ? "1.1rem" : "0.82rem", color: color || "var(--text)" }}>{value}</div>
    </div>
  )
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
      <span style={{ color: "var(--dim2)" }}>{label}</span>
      <strong style={{ color: color || "var(--text)" }}>{value}</strong>
    </div>
  )
}

// ========== 商品登録タブ（マルチソース対応）==========
function AddTab({ uid, newProduct, setNewProduct, addProduct, addSaving, products, loadProducts, setTab }) {
  const [addMode, setAddMode] = useState("order") // order | massupdate | manual
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState([]) // インポートプレビュー
  const [selected, setSelected] = useState({}) // 選択チェックボックス

  // 既存SKUセット
  const existingSkus = new Set(products.map(p => p.internalSku).filter(Boolean))

  // ===== オーダーCSVから取込 =====
  async function loadFromOrders() {
    setImporting(true)
    try {
      const { db } = await import("../lib/firebase")
      const { collection, getDocs } = await import("firebase/firestore")
      const snap = await getDocs(collection(db, "shopee_orders"))
      const myDocs = snap.docs.filter(d => d.data().userId === uid)
      if (myDocs.length === 0) { alert("オーダーデータがありません"); setImporting(false); return }
      // 最新のオーダーを使用
      const latest = myDocs.sort((a,b) => (b.data().uploadedAt?.seconds||0) - (a.data().uploadedAt?.seconds||0))[0].data()
      const orders = latest.orders || []
      const skuMap = {}
      orders.forEach(o => {
        const sku = o["sku"] || o["Parent SKU Reference No."] || ""
        const name = o["product"] || o["Product Name"] || ""
        if (sku && !skuMap[sku]) skuMap[sku] = { sku, name }
      })
      const rows = Object.values(skuMap).map(s => ({
        internalSku: s.sku, name: s.name, source: "オーダーCSV",
        flag: "テスト", status: "販売中",
      }))
      setPreview(rows)
      const sel = {}
      rows.forEach((r, i) => { if (!existingSkus.has(r.internalSku)) sel[i] = true })
      setSelected(sel)
    } catch(e) { alert("取込エラー: " + e.message) }
    setImporting(false)
  }

  // ===== mass_update_itemsから取込 =====
  async function loadFromMassUpdate() {
    setImporting(true)
    try {
      const { db } = await import("../lib/firebase")
      const { collection, query, where, getDocs } = await import("firebase/firestore")
      const snap = await getDocs(query(collection(db, "product_master"), where("uid", "==", uid)))
      if (snap.empty) { alert("MassUpdateデータがありません。先にMassUpdateでCSVをアップロードしてください"); setImporting(false); return }
      const rows = snap.docs.map(d => {
        const p = d.data()
        return {
          internalSku: p.sku || "",
          name: p.name || "",
          shopeeItemId: p.productId || "",
          status: "販売中", flag: "テスト",
          source: "MassUpdate",
        }
      }).filter(r => r.internalSku)
      setPreview(rows)
      const sel = {}
      rows.forEach((r, i) => { if (!existingSkus.has(r.internalSku)) sel[i] = true })
      setSelected(sel)
    } catch(e) { alert("取込エラー: " + e.message) }
    setImporting(false)
  }

  // ===== 一括登録 =====
  async function importSelected() {
    const targets = preview.filter((_, i) => selected[i])
    if (targets.length === 0) return alert("登録する商品を選択してください")
    setImporting(true)
    try {
      const { db } = await import("../lib/firebase")
      const { collection, addDoc } = await import("firebase/firestore")
      for (const p of targets) {
        await addDoc(collection(db, "physical_products"), {
          ...emptyProduct, ...p, uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
      alert("✅ " + targets.length + "件を登録しました！仕入単価・在庫数は商品詳細から編集してください")
      setPreview([])
      setSelected({})
      loadProducts()
      setTab("list")
    } catch(e) { alert("登録エラー: " + e.message) }
    setImporting(false)
  }

  const modeBtn = (key, label, desc) => (
    <button onClick={() => { setAddMode(key); setPreview([]); setSelected({}) }}
      style={{ flex: 1, padding: "1rem", borderRadius: 10, border: addMode === key ? "2px solid var(--orange)" : "1px solid var(--rim)", background: addMode === key ? "rgba(249,115,22,0.08)" : "transparent", cursor: "pointer", textAlign: "left" }}>
      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: addMode === key ? "var(--orange)" : "var(--text)", marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ fontSize: "0.72rem", color: "var(--dim2)" }}>{desc}</div>
    </button>
  )

  return (
    <div>
      {/* モード選択 */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {modeBtn("order", "📦 オーダーから取込", "売れた商品のSKUを自動検出")}
        {modeBtn("massupdate", "📋 MassUpdateから取込", "アップロード済み商品一覧を使用")}
        {modeBtn("manual", "✏️ 手動登録", "1件ずつ詳細を入力")}
      </div>

      {/* オーダー取込 */}
      {addMode === "order" && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.82rem", color: "var(--dim2)", marginBottom: "1rem" }}>
            アップロード済みのShopeeオーダーCSVからSKU・商品名を自動取得します。<br/>
            <span style={{ color: "var(--orange)" }}>仕入単価・在庫数は登録後に編集してください。</span>
          </div>
          {preview.length === 0 ? (
            <button onClick={loadFromOrders} disabled={importing}
              style={{ padding: "0.6rem 1.5rem", borderRadius: 8, border: "none", background: "var(--orange)", color: "#fff", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: importing ? 0.7 : 1 }}>
              {importing ? "読み込み中..." : "📦 オーダーデータを読み込む"}
            </button>
          ) : (
            <ImportPreview preview={preview} selected={selected} setSelected={setSelected} existingSkus={existingSkus} importing={importing} onImport={importSelected} onReset={() => { setPreview([]); setSelected({}) }} />
          )}
        </div>
      )}

      {/* MassUpdate取込 */}
      {addMode === "massupdate" && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.82rem", color: "var(--dim2)", marginBottom: "1rem" }}>
            MassUpdateでアップロード済みの商品マスターからSKU・商品名・ShopeeIDを取得します。<br/>
            <span style={{ color: "var(--orange)" }}>仕入単価・在庫数は登録後に編集してください。</span>
          </div>
          {preview.length === 0 ? (
            <button onClick={loadFromMassUpdate} disabled={importing}
              style={{ padding: "0.6rem 1.5rem", borderRadius: 8, border: "none", background: "var(--orange)", color: "#fff", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: importing ? 0.7 : 1 }}>
              {importing ? "読み込み中..." : "📋 MassUpdateデータを読み込む"}
            </button>
          ) : (
            <ImportPreview preview={preview} selected={selected} setSelected={setSelected} existingSkus={existingSkus} importing={importing} onImport={importSelected} onReset={() => { setPreview([]); setSelected({}) }} />
          )}
        </div>
      )}

      {/* 手動登録 */}
      {addMode === "manual" && (
        <div className="card" style={{ padding: "1.5rem" }}>
          <ProductForm data={newProduct} setData={setNewProduct} />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
            <button onClick={addProduct} disabled={addSaving}
              style={{ padding: "0.6rem 2rem", borderRadius: 8, border: "none", background: "var(--orange)", color: "#fff", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: addSaving ? 0.7 : 1 }}>
              {addSaving ? "登録中..." : "💾 登録する"}
            </button>
            <button onClick={() => setNewProduct({ ...emptyProduct })}
              style={{ padding: "0.6rem 1rem", borderRadius: 8, border: "1px solid var(--rim)", background: "transparent", color: "var(--dim2)", fontSize: "0.85rem", cursor: "pointer" }}>
              リセット
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== インポートプレビュー共通コンポーネント =====
function ImportPreview({ preview, selected, setSelected, existingSkus, importing, onImport, onReset }) {
  const selectedCount = Object.values(selected).filter(Boolean).length
  const allSelect = () => { const s = {}; preview.forEach((_, i) => { s[i] = true }); setSelected(s) }
  const allDeselect = () => setSelected({})

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: "0.75rem" }}>
        <button onClick={allSelect} style={{ padding: "0.3rem 0.8rem", borderRadius: 6, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.1)", color: "#3b82f6", fontSize: "0.72rem", cursor: "pointer" }}>全選択</button>
        <button onClick={allDeselect} style={{ padding: "0.3rem 0.8rem", borderRadius: 6, border: "1px solid var(--rim)", background: "transparent", color: "var(--dim2)", fontSize: "0.72rem", cursor: "pointer" }}>全解除</button>
        <span style={{ fontSize: "0.72rem", color: "var(--dim2)" }}>{selectedCount}件選択中 / {preview.length}件</span>
        <button onClick={onReset} style={{ marginLeft: "auto", padding: "0.3rem 0.8rem", borderRadius: 6, border: "1px solid var(--rim)", background: "transparent", color: "var(--dim2)", fontSize: "0.72rem", cursor: "pointer" }}>リセット</button>
      </div>
      <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid var(--rim)", borderRadius: 10, marginBottom: "1rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead style={{ position: "sticky", top: 0, background: "var(--surface)" }}>
            <tr style={{ borderBottom: "1px solid var(--rim)" }}>
              <th style={{ padding: "0.5rem 0.75rem", width: 40, textAlign: "center" }}>✓</th>
              <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "var(--dim2)", fontSize: "0.62rem" }}>SKU</th>
              <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "var(--dim2)", fontSize: "0.62rem" }}>商品名</th>
              <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "var(--dim2)", fontSize: "0.62rem" }}>状態</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((r, i) => {
              const isExisting = existingSkus.has(r.internalSku)
              return (
                <tr key={i} style={{ borderBottom: "1px solid var(--rim)", background: selected[i] ? "rgba(249,115,22,0.05)" : "transparent" }}>
                  <td style={{ padding: "0.4rem 0.75rem", textAlign: "center" }}>
                    <input type="checkbox" checked={!!selected[i]} onChange={e => setSelected(s => ({ ...s, [i]: e.target.checked }))} style={{ cursor: "pointer" }} />
                  </td>
                  <td style={{ padding: "0.4rem 0.75rem", fontFamily: "monospace", fontSize: "0.72rem", color: "#3b82f6" }}>{r.internalSku}</td>
                  <td style={{ padding: "0.4rem 0.75rem" }}>{r.name?.slice(0, 50) || "-"}</td>
                  <td style={{ padding: "0.4rem 0.75rem", textAlign: "center" }}>
                    {isExisting
                      ? <span style={{ fontSize: "0.65rem", color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "0.15rem 0.5rem", borderRadius: 6 }}>登録済み</span>
                      : <span style={{ fontSize: "0.65rem", color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "0.15rem 0.5rem", borderRadius: 6 }}>新規</span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button onClick={onImport} disabled={importing || selectedCount === 0}
        style={{ padding: "0.6rem 2rem", borderRadius: 8, border: "none", background: "var(--orange)", color: "#fff", fontSize: "0.85rem", fontWeight: 700, cursor: importing || selectedCount === 0 ? "not-allowed" : "pointer", opacity: importing || selectedCount === 0 ? 0.6 : 1 }}>
        {importing ? "登録中..." : selectedCount + "件を在庫管理に登録する"}
      </button>
    </div>
  )
}

function FlagBadge({ flag }) {
  const colors = { "定番A": "#22c55e", "定番B": "#3b82f6", "定番C": "#a78bfa", "テスト": "#f59e0b", "廃盤品": "#6b7280", "在庫処分": "#ef4444" }
  const c = colors[flag] || "var(--dim2)"
  if (!flag) return <span style={{ color: "var(--dim2)", fontSize: "0.7rem" }}>-</span>
  return <span style={{ fontSize: "0.68rem", fontWeight: 700, color: c, background: c + "20", padding: "0.15rem 0.5rem", borderRadius: 6 }}>{flag}</span>
}

function StatusBadge({ status }) {
  const colors = { "販売中": "#22c55e", "ページ作成中": "#f59e0b", "販売終了": "#6b7280", "仕入判断": "#a78bfa" }
  const c = colors[status] || "var(--dim2)"
  if (!status) return <span style={{ color: "var(--dim2)", fontSize: "0.7rem" }}>-</span>
  return <span style={{ fontSize: "0.68rem", fontWeight: 700, color: c, background: c + "20", padding: "0.15rem 0.5rem", borderRadius: 6 }}>{status}</span>
}
