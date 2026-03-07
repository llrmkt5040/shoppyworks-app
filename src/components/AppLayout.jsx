import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import AnalyzerPage from '../pages/AnalyzerPage'

const NAV = [
  { id:'dashboard', icon:'🏠', label:'ダッシュボード' },
  { id:'analyzer',  icon:'📊', label:'XLSX分析' },
  { id:'dailylog',  icon:'📝', label:'日報管理' },
]

function Dashboard({ onNavigate }) {
  const { profile } = useAuth()
  return (
    <div style={{ maxWidth:900, margin:'0 auto', padding:'1.5rem' }}>
      <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', letterSpacing:'0.04em', marginBottom:'1.5rem' }}>
        おはようございます、<span style={{ color:'var(--orange)' }}>{profile?.name}さん</span> 👋
      </h1>
      <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', marginBottom:'2rem' }}>
        <button className="btn-primary" onClick={() => onNavigate('analyzer')}>📊 週次XLSXをアップロード</button>
        <button className="btn-ghost" onClick={() => onNavigate('dailylog')}>📝 今日の日報を入力</button>
      </div>
      <div className="card" style={{ padding:'2.5rem', textAlign:'center' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>📊</div>
        <h3 style={{ fontWeight:900, marginBottom:'0.5rem' }}>最初のXLSXをアップロードしましょう</h3>
        <p style={{ fontSize:'0.82rem', color:'var(--dim2)', marginBottom:'1.5rem' }}>Shopee Business InsightsからエクスポートしたXLSXをアップすると、KPIとAI改善提案が表示されます。</p>
        <button className="btn-primary" onClick={() => onNavigate('analyzer')}>📊 XLSXをアップロード</button>
      </div>
    </div>
  )
}

function DailyLog() {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), action:'', learned:'', memo:'', mood:'normal' })
  const [saved, setSaved] = useState(false)
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  const inp = { width:'100%', background:'var(--surface)', border:'1px solid var(--rim2)', borderRadius:'var(--r)', padding:'0.6rem 0.75rem', color:'var(--text)', fontFamily:"'Zen Kaku Gothic New',sans-serif", fontSize:'0.85rem', outline:'none' }
  return (
    <div style={{ maxWidth:700, margin:'0 auto', padding:'1.5rem' }}>
      <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', letterSpacing:'0.04em', marginBottom:'1.5rem' }}>日報入力</h2>
      <div className="card" style={{ padding:'1.5rem' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
          <label><div style={{ fontSize:'0.68rem', color:'var(--dim2)', fontWeight:700, marginBottom:'0.3rem' }}>日付</div>
            <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={inp} /></label>
          <label><div style={{ fontSize:'0.68rem', color:'var(--dim2)', fontWeight:700, marginBottom:'0.3rem' }}>気分</div>
            <div style={{ display:'flex', gap:'0.5rem' }}>
              {[['good','😊'],['normal','😐'],['tired','😴']].map(([k,ic]) => (
                <button key={k} onClick={()=>setForm({...form,mood:k})} style={{ flex:1, padding:'0.5rem', borderRadius:'var(--r)', border:`1px solid ${form.mood===k?'var(--orange)':'var(--rim)'}`, background:form.mood===k?'var(--orange-dim)':'var(--card)', cursor:'pointer', fontSize:'1rem' }}>{ic}</button>
              ))}
            </div></label>
        </div>
        <label style={{ display:'block', marginBottom:'1rem' }}>
          <div style={{ fontSize:'0.68rem', color:'var(--dim2)', fontWeight:700, marginBottom:'0.3rem' }}>今日実施したアクション *</div>
          <input type="text" placeholder="例：商品Aのタイトルにキーワードを追加した" value={form.action} onChange={e=>setForm({...form,action:e.target.value})} style={inp} />
        </label>
        <label style={{ display:'block', marginBottom:'1rem' }}>
          <div style={{ fontSize:'0.68rem', color:'var(--dim2)', fontWeight:700, marginBottom:'0.3rem' }}>今日の学び</div>
          <textarea rows={2} placeholder="気づいたこと、学んだこと" value={form.learned} onChange={e=>setForm({...form,learned:e.target.value})} style={{ ...inp, resize:'vertical' }} />
        </label>
        <label style={{ display:'block', marginBottom:'1.25rem' }}>
          <div style={{ fontSize:'0.68rem', color:'var(--dim2)', fontWeight:700, marginBottom:'0.3rem' }}>明日やること・メモ</div>
          <textarea rows={2} value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})} style={{ ...inp, resize:'vertical' }} />
        </label>
        <div style={{ textAlign:'right' }}>
          <button className="btn-primary" onClick={save} disabled={!form.action.trim()}>{saved?'✅ 保存しました！':'💾 日報を保存'}</button>
        </div>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const { profile, signOut, isAdmin } = useAuth()
  const [page, setPage] = useState('dashboard')

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <aside style={{ width:220, flexShrink:0, background:'var(--surface)', borderRight:'1px solid var(--rim)', display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh' }}>
        <div style={{ padding:'1.25rem', borderBottom:'1px solid var(--rim)' }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.4rem', letterSpacing:'0.04em', lineHeight:1 }}>Shoppy<span style={{ color:'var(--orange)' }}>Works</span></div>
          <div style={{ fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.15em', color:'var(--dim2)', marginTop:'0.2rem' }}>Bootcamp Analyzer</div>
        </div>
        <nav style={{ padding:'0.75rem', flex:1 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{ width:'100%', display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.7rem 0.85rem', borderRadius:'var(--r)', border:'none', background:page===n.id?'var(--orange-dim)':'transparent', color:page===n.id?'var(--orange)':'var(--dim2)', fontFamily:"'Zen Kaku Gothic New',sans-serif", fontSize:'0.82rem', fontWeight:page===n.id?700:400, cursor:'pointer', transition:'all 0.15s', marginBottom:'0.15rem', textAlign:'left' }}>
              <span style={{ fontSize:'1rem' }}>{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding:'1rem', borderTop:'1px solid var(--rim)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.75rem' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--orange-dim)', border:'1px solid rgba(255,107,43,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem', flexShrink:0 }}>{profile?.name?.[0]||'?'}</div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:'0.78rem', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile?.name||'ユーザー'}</div>
              <div style={{ fontSize:'0.62rem', color:'var(--dim2)' }}>{isAdmin?'👑 admin':'参加者'}</div>
            </div>
          </div>
          <button onClick={signOut} className="btn-ghost" style={{ width:'100%', fontSize:'0.72rem', padding:'0.4rem' }}>ログアウト</button>
        </div>
      </aside>
      <main style={{ flex:1, minWidth:0 }}>
        <div style={{ background:'rgba(7,8,11,0.9)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--rim)', padding:'0.75rem 1.5rem', display:'flex', alignItems:'center', gap:'0.75rem', position:'sticky', top:0, zIndex:100 }}>
          <span style={{ fontSize:'0.88rem', fontWeight:900 }}>{NAV.find(n=>n.id===page)?.icon} {NAV.find(n=>n.id===page)?.label}</span>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--ai)', animation:'pulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize:'0.68rem', color:'var(--ai)' }}>Claude AI 待機中</span>
          </div>
        </div>
        <div style={{ minHeight:'calc(100vh - 50px)' }}>
          {page==='dashboard' && <Dashboard onNavigate={setPage} />}
          {page==='analyzer'  && <AnalyzerPage />}
          {page==='dailylog'  && <DailyLog />}
        </div>
      </main>
    </div>
  )
}
