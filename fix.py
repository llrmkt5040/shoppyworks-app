code = """import { useState, useEffect } from 'react'
import { db, auth } from '../lib/firebase'
import { collection, addDoc, query, where, orderBy, getDocs } from 'firebase/firestore'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function Field({ label, icon, value, onChange, readOnly, note }) {
  return (
    <div>
      <label style={{fontSize:'0.68rem',fontWeight:700,color:'var(--dim2)',textTransform:'uppercase',display:'block',marginBottom:'0.25rem'}}>{icon} {label}</label>
      <input type="number" value={value} onChange={onChange} readOnly={readOnly} placeholder="0"
        style={{display:'block',width:'100%',padding:'0.5rem 0.7rem',borderRadius:8,border:'1px solid var(--rim)',background:readOnly?'rgba(255,255,255,0.03)':'var(--surface)',color:readOnly?'var(--orange)':'var(--text)',fontSize:'0.9rem',boxSizing:'border-box',fontWeight:readOnly?700:400}} />
      {note && <div style={{fontSize:'0.65rem',color:'var(--dim)',marginTop:'0.2rem'}}>{note}</div>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card" style={{padding:'1.25rem',marginBottom:'1rem'}}>
      <div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--orange)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'1rem'}}>{title}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'0.75rem'}}>{children}</div>
    </div>
  )
}

export default function ActionLogPage() {
  const [tab, setTab] = useState('input')
  const [logs, setLogs] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [rateLoading, setRateLoading] = useState(false)
  const [prevListings, setPrevListings] = useState(null)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    rate_php_jpy: '', listings: '', improved_pages: '',
    sales_php: '', orders: '', cancelled: '',
    cancelled_sales: '', returned: '', sales_deposit_usd: '',
    visitors: '', clicks: '', spo: '', ocr: '', cv: '',
    followers: '', follow_prize: '', usage: '', rating_stars: '', rating: '',
    pasabuy: '', pasabuy_cv: '', inquiry: '',
    buy_daiso: '', buy_amazon: '', buy_mercari: '', buy_other: '',
    domestic_shipping: '', inventory: '', memo: ''
  })

  useEffect(() => { fetchLogs() }, [])

  async function fetchLogs() {
    try {
      const q = query(collection(db, 'action_logs'), where('uid', '==', auth.currentUser?.uid), orderBy('date', 'desc'))
      const snap = await getDocs(q)
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setLogs(data)
      if (data.length > 0) setPrevListings(Number(data[0].listings) || null)
    } catch(e) { console.error(e) }
  }

  async function fetchRate() {
    setRateLoading(true)
    try {
      const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/PHPJPY=X?interval=1d&range=2d')
      const json = await res.json()
      const rate = json?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (rate) setForm(f => ({ ...f, rate_php_jpy: rate.toFixed(4) }))
      else alert('レート取得失敗。手動で入力してください。')
    } catch(e) { alert('レート取得失敗。手動で入力してください。') }
    setRateLoading(false)
  }

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  const salesJpy = form.sales_php && form.rate_php_jpy
    ? Math.round(Number(form.sales_php) * Number(form.rate_php_jpy))
    : ''

  const listingsDiff = form.listings && prevListings !== null
    ? Number(form.listings) - prevListings
    : null

  async function handleSave() {
    setSaving(true)
    try {
      await addDoc(collection(db, 'action_logs'), {
        ...form, sales_jpy: salesJpy.toString(),
        uid: auth.currentUser?.uid, email: auth.currentUser?.email,
        createdAt: new Date().toISOString()
      })
      setSaved(true); setTimeout(() => setSaved(false), 3000); fetchLogs()
    } catch(e) { alert('保存エラー: ' + e.message) }
    setSaving(false)
  }

  const chartData = [...logs].reverse().slice(-30).map(l => ({
    date: l.date?.slice(5), 売上: Number(l.sales_php)||0, 出品数: Number(l.listings)||0
  }))

  return (
    <div style={{maxWidth:960,margin:'0 auto',padding:'1.5rem'}}>
      <h2 style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'1.8rem',letterSpacing:'0.04em',marginBottom:'1.5rem'}}>行動ログ</h2>
      <div style={{display:'flex',marginBottom:'1.5rem',background:'var(--surface)',borderRadius:12,padding:4,border:'1px solid var(--rim)',width:'fit-content'}}>
        {[['input','入力'],['history','履歴'],['graph','グラフ']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{padding:'0.5rem 1.2rem',borderRadius:10,border:'none',cursor:'pointer',fontSize:'0.8rem',fontWeight:700,background:tab===id?'var(--orange)':'transparent',color:tab===id?'#fff':'var(--dim2)',transition:'all 0.2s'}}>{label}</button>
        ))}
      </div>
      {tab === 'input' && (
        <div>
          <div style={{marginBottom:'1rem'}}>
            <label style={{fontSize:'0.72rem',fontWeight:700,color:'var(--dim2)',textTransform:'uppercase'}}>日付</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              style={{display:'block',marginTop:'0.3rem',padding:'0.6rem 0.8rem',borderRadius:8,border:'1px solid var(--rim)',background:'var(--surface)',color:'var(--text)',fontSize:'0.9rem'}} />
          </div>
          <div className="card" style={{padding:'1.25rem',marginBottom:'1rem'}}>
            <div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--orange)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'1rem'}}>為替レート</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:'0.75rem',alignItems:'end'}}>
              <Field label="PHP to JPY レート" icon="💱" value={form.rate_php_jpy} onChange={e => set('rate_php_jpy', e.target.value)} />
              <button onClick={fetchRate} disabled={rateLoading}
                style={{padding:'0.5rem 1rem',borderRadius:8,border:'1px solid rgba(0,212,170,0.3)',background:'rgba(0,212,170,0.1)',color:'var(--ai)',fontSize:'0.75rem',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',height:38}}>
                {rateLoading ? '取得中..' : '自動取得'}
              </button>
            </div>
          </div>
          <Section title="出品・改修">
            <div>
              <label style={{fontSize:'0.68rem',fontWeight:700,color:'var(--dim2)',textTransform:'uppercase',display:'block',marginBottom:'0.25rem'}}>📦 出品点数</label>
              <input type="number" value={form.listings} onChange={e => set('listings', e.target.value)} placeholder="0"
                style={{display:'block',width:'100%',padding:'0.5rem 0.7rem',borderRadius:8,border:'1px solid var(--rim)',background:'var(--surface)',color:'var(--text)',fontSize:'0.9rem',boxSizing:'border-box'}} />
              {listingsDiff !== null && (
                <div style={{fontSize:'0.72rem',marginTop:'0.3rem',color:listingsDiff>=0?'var(--green)':'var(--red)',fontWeight:700}}>
                  前日比: {listingsDiff >= 0 ? '+' : ''}{listingsDiff}点
                </div>
              )}
            </div>
            <Field label="改修商品ページ件数" icon="🔧" value={form.improved_pages} onChange={e => set('improved_pages', e.target.value)} />
          </Section>
          <Section title="売上・注文">
            <Field label="売上 (PHP)" icon="💰" value={form.sales_php} onChange={e => set('sales_php', e.target.value)} />
            <Field label="売上 (円) 自動" icon="💴" value={salesJpy} onChange={() => {}} readOnly={true} />
            <Field label="注文数" icon="📦" value={form.orders} onChange={e => set('orders', e.target.value)} />
            <Field label="キャンセル数" icon="❌" value={form.cancelled} onChange={e => set('cancelled', e.target.value)} />
            <Field label="キャンセル売上" icon="🚫" value={form.cancelled_sales} onChange={e => set('cancelled_sales', e.target.value)} />
            <Field label="返品数" icon="↩️" value={form.returned} onChange={e => set('returned', e.target.value)} />
            <Field label="売上入金 (USD)" icon="🏦" value={form.sales_deposit_usd} onChange={e => set('sales_deposit_usd', e.target.value)} note="Payoniaへの入金額" />
          </Section>
          <Section title="アクセス・転換率">
            <Field label="訪問者数" icon="👥" value={form.visitors} onChange={e => set('visitors', e.target.value)} />
            <Field label="商品クリック数" icon="🖱️" value={form.clicks} onChange={e => set('clicks', e.target.value)} />
            <Field label="SpO" icon="📍" value={form.spo} onChange={e => set('spo', e.target.value)} />
            <Field label="OCR (%)" icon="📊" value={form.ocr} onChange={e => set('ocr', e.target.value)} />
            <Field label="CV" icon="📈" value={form.cv} onChange={e => set('cv', e.target.value)} />
          </Section>
          <Section title="フォロー・評価">
            <Field label="フォロワー数" icon="❤️" value={form.followers} onChange={e => set('followers', e.target.value)} />
            <Field label="FollowPrize" icon="🎁" value={form.follow_prize} onChange={e => set('follow_prize', e.target.value)} />
            <Field label="Usage" icon="📱" value={form.usage} onChange={e => set('usage', e.target.value)} />
            <Field label="評価数" icon="⭐" value={form.rating_stars} onChange={e => set('rating_stars', e.target.value)} />
            <Field label="評価スコア" icon="🌟" value={form.rating} onChange={e => set('rating', e.target.value)} />
          </Section>
          <Section title="商品依頼">
            <Field label="PASABUY" icon="🛍️" value={form.pasabuy} onChange={e => set('pasabuy', e.target.value)} />
            <Field label="PASABUY CV" icon="✅" value={form.pasabuy_cv} onChange={e => set('pasabuy_cv', e.target.value)} />
            <Field label="問合せ数" icon="💬" value={form.inquiry} onChange={e => set('inquiry', e.target.value)} />
          </Section>
          <Section title="仕入れ・在庫">
            <Field label="DAISO仕入れ (円)" icon="🏪" value={form.buy_daiso} onChange={e => set('buy_daiso', e.target.value)} />
            <Field label="Amazon仕入れ (円)" icon="📦" value={form.buy_amazon} onChange={e => set('buy_amazon', e.target.value)} />
            <Field label="メルカリ仕入れ (円)" icon="♻️" value={form.buy_mercari} onChange={e => set('buy_mercari', e.target.value)} />
            <Field label="その他仕入れ (円)" icon="🛒" value={form.buy_other} onChange={e => set('buy_other', e.target.value)} />
            <Field label="国内送料 (円)" icon="🚚" value={form.domestic_shipping} onChange={e => set('domestic_shipping', e.target.value)} />
            <Field label="棚卸在庫 (円)" icon="📋" value={form.inventory} onChange={e => set('inventory', e.target.value)} />
          </Section>
          <div className="card" style={{padding:'1.25rem',marginBottom:'1rem'}}>
            <label style={{fontSize:'0.7rem',fontWeight:700,color:'var(--orange)',textTransform:'uppercase'}}>📝 メモ・気づき</label>
            <textarea value={form.memo} onChange={e => set('memo', e.target.value)} placeholder="今日の気づきや課題など..."
              style={{display:'block',width:'100%',marginTop:'0.5rem',padding:'0.6rem 0.8rem',borderRadius:8,border:'1px solid var(--rim)',background:'var(--surface)',color:'var(--text)',fontSize:'0.85rem',minHeight:80,resize:'vertical',boxSizing:'border-box'}} />
          </div>
          <button onClick={handleSave} disabled={saving}
            style={{width:'100%',padding:'0.9rem',borderRadius:10,border:'none',background:saved?'var(--green)':'var(--orange)',color:'#fff',fontSize:'1rem',fontWeight:900,cursor:saving?'not-allowed':'pointer',transition:'all 0.3s'}}>
            {saving ? '保存中..' : saved ? '保存しました！' : '保存する'}
          </button>
        </div>
      )}
      {tab === 'history' && (
        <div>
          {logs.length === 0
            ? <div className="card" style={{padding:'2rem',textAlign:'center',color:'var(--dim2)'}}>まだデータがありません</div>
            : logs.map(log => (
              <div key={log.id} className="card" style={{padding:'1rem 1.25rem',marginBottom:'0.75rem'}}>
                <div style={{display:'flex',alignItems:'center',gap:'1rem',flexWrap:'wrap'}}>
                  <div style={{fontFamily:'Bebas Neue,sans-serif',fontSize:'1.4rem',color:'var(--orange)',minWidth:90}}>{log.date}</div>
                  <div style={{display:'flex',gap:'1rem',flexWrap:'wrap',fontSize:'0.82rem'}}>
                    <span>売上 {Number(log.sales_php||0).toLocaleString()}PHP</span>
                    <span>円 {Number(log.sales_jpy||0).toLocaleString()}</span>
                    <span>出品 {log.listings||0}点</span>
                    <span>改修 {log.improved_pages||0}件</span>
                    <span>訪問 {log.visitors||0}人</span>
                    <span>OCR {log.ocr||0}%</span>
                  </div>
                </div>
                {log.memo && <div style={{marginTop:'0.5rem',fontSize:'0.78rem',color:'var(--dim2)',borderTop:'1px solid var(--rim)',paddingTop:'0.5rem'}}>{log.memo}</div>}
              </div>
            ))
          }
        </div>
      )}
      {tab === 'graph' && (
        <div>
          {chartData.length < 2
            ? <div className="card" style={{padding:'2rem',textAlign:'center',color:'var(--dim2)'}}>グラフには2日以上のデータが必要です</div>
            : <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
                <div className="card" style={{padding:'1.25rem'}}>
                  <div style={{fontSize:'0.65rem',color:'var(--dim2)',fontWeight:700,marginBottom:'1rem'}}>売上推移 (PHP)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{fill:'#6b7280',fontSize:10}} />
                      <YAxis tick={{fill:'#6b7280',fontSize:10}} />
                      <Tooltip contentStyle={{background:'var(--card)',border:'1px solid var(--rim2)',borderRadius:8}} />
                      <Line type="monotone" dataKey="売上" stroke="var(--orange)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="card" style={{padding:'1.25rem'}}>
                  <div style={{fontSize:'0.65rem',color:'var(--dim2)',fontWeight:700,marginBottom:'1rem'}}>出品数推移</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{fill:'#6b7280',fontSize:10}} />
                      <YAxis tick={{fill:'#6b7280',fontSize:10}} />
                      <Tooltip contentStyle={{background:'var(--card)',border:'1px solid var(--rim2)',borderRadius:8}} />
                      <Line type="monotone" dataKey="出品数" stroke="var(--green)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
          }
        </div>
      )}
    </div>
  )
}"""
open('/Users/yusukeok5040/shoppyworks-app/src/pages/ActionLogPage.jsx','w').write(code)
print('完了 ' + str(len(code)) + '文字')
