import { useState, useEffect } from 'react'
import { db, auth } from '../lib/firebase'
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'

const ACCOUNT_METRICS = [
  { key: 'penaltyPoints',        label: 'Penalty Points',            target: '≤ 3',     unit: 'pt',   higherIsBad: true,  threshold: 3 },
  { key: 'nonFulfilmentRate',    label: 'Non-Fulfilment Rate',       target: '< 10%',   unit: '%',    higherIsBad: true,  threshold: 10 },
  { key: 'lateShipmentRate',     label: 'Late Shipment Rate',        target: '< 10%',   unit: '%',    higherIsBad: true,  threshold: 10 },
  { key: 'preparationTime',      label: 'Preparation Time',          target: '< 2 days',unit: 'days', higherIsBad: true,  threshold: 2 },
  { key: 'fastHandoverRate',     label: 'Fast Handover Rate',        target: '≥ 70%',   unit: '%',    higherIsBad: false, threshold: 70 },
  { key: 'severeListing',        label: 'Severe Listing Violations', target: '0',       unit: '',     higherIsBad: true,  threshold: 0 },
  { key: 'preOrderListing',      label: 'Pre-order Listing',         target: '≤ 10%',   unit: '%',    higherIsBad: true,  threshold: 10 },
  { key: 'otherListingViolations',label: 'Other Listing Violations', target: '0',       unit: '',     higherIsBad: true,  threshold: 0 },
  { key: 'responseRate',         label: 'Response Rate',             target: '≥ 70%',   unit: '%',    higherIsBad: false, threshold: 70 },
  { key: 'firstResponseTime',    label: 'First Response Time',       target: '< 12h',   unit: 'h',    higherIsBad: true,  threshold: 12 },
  { key: 'avgResponseTime',      label: 'Avg Response Time',         target: '< 1h',    unit: 'h',    higherIsBad: true,  threshold: 1 },
  { key: 'shopRating',           label: 'Shop Rating',               target: '≥ 4.5',   unit: '/5',   higherIsBad: false, threshold: 4.5 },
]

const PREFERRED_METRICS = [
  { key: 'uniqueBuyers',         label: 'Unique Buyers',             target: '≥ 29',    unit: '',     higherIsBad: false, threshold: 29 },
  { key: 'netOrders',            label: 'Net Orders',                target: '≥ 49',    unit: '',     higherIsBad: false, threshold: 49 },
  { key: 'chatResponseRate',     label: 'Chat Response Rate',        target: '≥ 65%',   unit: '%',    higherIsBad: false, threshold: 65 },
  { key: 'shopRatingPref',       label: 'Shop Rating',               target: '≥ 4.0',   unit: '/5',   higherIsBad: false, threshold: 4.0 },
  { key: 'nonFulfilmentRatePref',label: 'Non-Fulfilment Rate',       target: '≤ 9.99%', unit: '%',    higherIsBad: true,  threshold: 9.99 },
  { key: 'lateShipmentRatePref', label: 'Late Shipment Rate',        target: '≤ 4.99%', unit: '%',    higherIsBad: true,  threshold: 4.99 },
  { key: 'penaltyPointsPref',    label: 'Penalty Points',            target: '≤ 3',     unit: 'pt',   higherIsBad: true,  threshold: 3 },
  { key: 'preOrderDays',         label: 'Days of Pre-Order Listing Violation', target: '≤ 6', unit: 'days', higherIsBad: true, threshold: 6 },
  { key: 'deletedCounterfeit',   label: 'Deleted Counterfeit Listings', target: '≤ 5', unit: '',     higherIsBad: true,  threshold: 5 },
]

function isGood(metric, value) {
  if (value === null || value === '' || value === '-') return null
  const v = parseFloat(value)
  if (isNaN(v)) return null
  return metric.higherIsBad ? v <= metric.threshold : v >= metric.threshold
}

function StatusBadge({ good }) {
  if (good === null) return <span style={{ fontSize: '0.65rem', color: 'var(--dim2)' }}>-</span>
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 4,
      background: good ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
      color: good ? 'var(--green)' : 'var(--red)' }}>
      {good ? '✅ Good' : '🔴 NG'}
    </span>
  )
}

export default function AccountHealthPage({ uid: propUid }) {
  const [tab, setTab] = useState('input')
  const [histories, setHistories] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imgPreview, setImgPreview] = useState(null)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    overallStatus: '',
    metricsFailed: '',
    penaltyPoints: '', nonFulfilmentRate: '', lateShipmentRate: '',
    preparationTime: '', fastHandoverRate: '', severeListing: '',
    preOrderListing: '', otherListingViolations: '', responseRate: '',
    firstResponseTime: '', avgResponseTime: '', shopRating: '',
    uniqueBuyers: '', netOrders: '', chatResponseRate: '',
    shopRatingPref: '', nonFulfilmentRatePref: '', lateShipmentRatePref: '',
    penaltyPointsPref: '', preOrderDays: '', deletedCounterfeit: '',
    isPreferredSeller: true, memo: ''
  })

  const uid = propUid || auth.currentUser?.uid

  useEffect(() => { loadHistories() }, [uid])

  async function loadHistories() {
    if (!uid) return
    try {
      const snap = await getDocs(collection(db, 'account_health'))
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.uid === uid)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      setHistories(list)
    } catch(e) { console.error(e) }
  }

  async function analyzeImage(file) {
    setAiLoading(true)
    try {
      const toBase64 = f => new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(f)
      })
      const b64 = await toBase64(file)
      const mediaType = file.type || 'image/png'
      setImgPreview(URL.createObjectURL(file))

      const prompt = `このShopee Seller CenterのAccount HealthまたはPreferred Sellerページのスクリーンショットから、以下のキーと数値をJSON形式で抽出してください。
数値が見つからない場合は空文字にしてください。単位は除いて数値のみ返してください。
{
  "overallStatus": "Good/Improvement Needed/At Risk のいずれか",
  "metricsFailed": "失敗したメトリクス数（数字のみ）",
  "penaltyPoints": "",
  "nonFulfilmentRate": "",
  "lateShipmentRate": "",
  "preparationTime": "",
  "fastHandoverRate": "",
  "severeListing": "",
  "preOrderListing": "",
  "otherListingViolations": "",
  "responseRate": "",
  "firstResponseTime": "",
  "avgResponseTime": "",
  "shopRating": "",
  "uniqueBuyers": "",
  "netOrders": "",
  "chatResponseRate": "",
  "shopRatingPref": "",
  "nonFulfilmentRatePref": "",
  "lateShipmentRatePref": "",
  "penaltyPointsPref": "",
  "preOrderDays": "",
  "deletedCounterfeit": "",
  "isPreferredSeller": true or false
}
JSONのみ返してください。`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': localStorage.getItem('sw_anthropic_key') || import.meta.env.VITE_ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
            { type: 'text', text: prompt }
          ]}]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || '{}'
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setForm(prev => ({ ...prev, ...parsed }))
      alert('✅ AI読み取り完了！数値を確認して保存してください。')
    } catch(e) { alert('AI読み取りエラー: ' + e.message) }
    setAiLoading(false)
  }

  async function save() {
    setSaving(true)
    try {
      await addDoc(collection(db, 'account_health'), { uid, ...form, savedAt: serverTimestamp() })
      alert('✅ 保存しました！')
      await loadHistories()
      setTab('history')
    } catch(e) { alert('保存エラー: ' + e.message) }
    setSaving(false)
  }

  function setF(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  const inputStyle = {
    background: 'var(--surface)', border: '1px solid var(--rim)',
    color: 'var(--text)', borderRadius: 6, padding: '0.35rem 0.5rem',
    fontSize: '0.8rem', width: '100%', outline: 'none'
  }

  const TABS = [
    { id: 'input', label: '📝 入力・AI読取' },
    { id: 'history', label: '📅 履歴' },
    { id: 'trend', label: '📈 トレンド' },
  ]

  // トレンド用：最新5件
  const trend5 = histories.slice(0, 5).reverse()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--rim)', display: 'flex', overflowX: 'auto', flexShrink: 0, padding: '0 1.5rem' }}>
        {TABS.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{ padding: '0.85rem 1.1rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: tab === t.id ? 'var(--orange)' : 'var(--dim2)', borderBottom: tab === t.id ? '2px solid var(--orange)' : '2px solid transparent', whiteSpace: 'nowrap' }}>{t.label}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>

        {/* 入力タブ */}
        {tab === 'input' && (
          <div className="fade-up">
            {/* AI画像読み取り */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--dim2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>🤖 スクリーンショットからAI自動読み取り</div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div
                  onClick={() => document.getElementById('ah-img').click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); analyzeImage(e.dataTransfer.files[0]) }}
                  style={{ flex: 1, minWidth: 200, border: '2px dashed rgba(255,107,43,0.3)', borderRadius: 12, padding: '1.5rem', textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>📸</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{aiLoading ? '⏳ AI読み取り中...' : 'スクリーンショットをドロップ'}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--dim2)', marginTop: '0.25rem' }}>Account Health / Preferred Seller 画面</div>
                  <input id="ah-img" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => analyzeImage(e.target.files[0])} />
                </div>
                {imgPreview && <img src={imgPreview} alt="preview" style={{ width: 160, borderRadius: 8, border: '1px solid var(--rim)' }} />}
              </div>
            </div>

            {/* 基本情報 */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--dim2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>📋 基本情報</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--dim2)', marginBottom: '0.25rem' }}>記録日</div>
                  <input type="date" value={form.date} onChange={e => setF('date', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--dim2)', marginBottom: '0.25rem' }}>Overall Status</div>
                  <select value={form.overallStatus} onChange={e => setF('overallStatus', e.target.value)} style={inputStyle}>
                    <option value="">選択...</option>
                    <option value="Good">✅ Good</option>
                    <option value="Improvement Needed">⚠️ Improvement Needed</option>
                    <option value="At Risk">🔴 At Risk</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--dim2)', marginBottom: '0.25rem' }}>Metrics Failed数</div>
                  <input type="number" value={form.metricsFailed} onChange={e => setF('metricsFailed', e.target.value)} style={inputStyle} placeholder="0" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1rem' }}>
                  <input type="checkbox" id="pref" checked={form.isPreferredSeller} onChange={e => setF('isPreferredSeller', e.target.checked)} />
                  <label htmlFor="pref" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--orange)' }}>⭐ Preferred Seller</label>
                </div>
              </div>
            </div>

            {/* Account Health指標 */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--dim2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>🏥 Account Health 指標</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {ACCOUNT_METRICS.map(m => {
                  const val = form[m.key]
                  const good = isGood(m, val)
                  return (
                    <div key={m.key} style={{ background: 'var(--card)', borderRadius: 8, padding: '0.65rem', borderLeft: '3px solid ' + (good === null ? 'var(--rim)' : good ? 'var(--green)' : 'var(--red)') }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--dim2)', fontWeight: 700 }}>{m.label}</div>
                        <StatusBadge good={good} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <input type="text" value={val} onChange={e => setF(m.key, e.target.value)} placeholder="-" style={{ ...inputStyle, width: '70%' }} />
                        <span style={{ fontSize: '0.65rem', color: 'var(--dim2)' }}>{m.unit}</span>
                      </div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--dim2)', marginTop: '0.2rem' }}>Target: {m.target}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Preferred Seller指標 */}
            {form.isPreferredSeller && (
              <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>⭐ Preferred Seller 指標</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {PREFERRED_METRICS.map(m => {
                    const val = form[m.key]
                    const good = isGood(m, val)
                    return (
                      <div key={m.key} style={{ background: 'var(--card)', borderRadius: 8, padding: '0.65rem', borderLeft: '3px solid ' + (good === null ? 'var(--rim)' : good ? 'var(--green)' : 'var(--red)') }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--dim2)', fontWeight: 700 }}>{m.label}</div>
                          <StatusBadge good={good} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <input type="text" value={val} onChange={e => setF(m.key, e.target.value)} placeholder="-" style={{ ...inputStyle, width: '70%' }} />
                          <span style={{ fontSize: '0.65rem', color: 'var(--dim2)' }}>{m.unit}</span>
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--dim2)', marginTop: '0.2rem' }}>Target: {m.target}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* メモ・保存 */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--dim2)', marginBottom: '0.25rem' }}>メモ</div>
              <textarea value={form.memo} onChange={e => setF('memo', e.target.value)} placeholder="気づきや対応内容など..." style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
              <button onClick={save} disabled={saving} style={{ marginTop: '0.75rem', padding: '0.6rem 1.5rem', background: 'var(--orange)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', width: '100%' }}>
                {saving ? '保存中...' : '💾 保存する'}
              </button>
            </div>
          </div>
        )}

        {/* 履歴タブ */}
        {tab === 'history' && (
          <div className="fade-up">
            {histories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--dim2)' }}>まだ記録がありません</div>
            ) : histories.map((h, i) => {
              const statusColor = h.overallStatus === 'Good' ? 'var(--green)' : h.overallStatus === 'At Risk' ? 'var(--red)' : 'var(--yellow)'
              const failed = parseInt(h.metricsFailed) || 0
              return (
                <div key={h.id} className="card" style={{ padding: '1rem', marginBottom: '0.5rem', borderLeft: '3px solid ' + statusColor }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.78rem', color: 'var(--dim2)' }}>{h.date}</span>
                      <span style={{ marginLeft: '0.75rem', fontSize: '0.78rem', fontWeight: 700, color: statusColor }}>{h.overallStatus || '-'}</span>
                      {h.isPreferredSeller && <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', color: 'var(--orange)', fontWeight: 700 }}>⭐ Preferred</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', color: failed > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>Metrics Failed: {h.metricsFailed || '0'}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--dim2)' }}>Penalty: {h.penaltyPoints || '0'}pt</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--dim2)' }}>Rating: {h.shopRating || '-'}/5</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--dim2)' }}>LSR: {h.lateShipmentRate || '-'}%</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--dim2)' }}>NFR: {h.nonFulfilmentRate || '-'}%</span>
                    </div>
                  </div>
                  {h.memo && <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--dim2)', fontStyle: 'italic' }}>💬 {h.memo}</div>}
                </div>
              )
            })}
          </div>
        )}

        {/* トレンドタブ */}
        {tab === 'trend' && (
          <div className="fade-up">
            {trend5.length < 2 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--dim2)' }}>2件以上の記録が必要です</div>
            ) : (
              <>
                <div style={{ fontSize: '0.7rem', color: 'var(--dim2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>📈 主要指標トレンド（直近{trend5.length}週）</div>
                {[
                  { key: 'shopRating', label: 'Shop Rating', unit: '/5', good: v => v >= 4.5 },
                  { key: 'lateShipmentRate', label: 'Late Shipment Rate', unit: '%', good: v => v < 10 },
                  { key: 'nonFulfilmentRate', label: 'Non-Fulfilment Rate', unit: '%', good: v => v < 10 },
                  { key: 'responseRate', label: 'Response Rate', unit: '%', good: v => v >= 70 },
                  { key: 'penaltyPoints', label: 'Penalty Points', unit: 'pt', good: v => v <= 3 },
                  { key: 'fastHandoverRate', label: 'Fast Handover Rate', unit: '%', good: v => v >= 70 },
                ].map(m => (
                  <div key={m.key} className="card" style={{ padding: '1rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>{m.label}</div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                      {trend5.map((h, i) => {
                        const v = parseFloat(h[m.key])
                        const good = !isNaN(v) ? m.good(v) : null
                        return (
                          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: good === null ? 'var(--dim2)' : good ? 'var(--green)' : 'var(--red)' }}>
                              {isNaN(v) ? '-' : v}{isNaN(v) ? '' : m.unit}
                            </div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--dim2)', marginTop: '0.2rem' }}>{h.date?.slice(5)}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
