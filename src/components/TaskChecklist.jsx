import { useState, useEffect, useCallback } from 'react'
import { db, auth } from '../lib/firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

// ========== タスク定義 ==========
const DAILY_TASKS = [
  { id: 'diary',        label: 'ShopeeDiary 売上・出品数・フォロワーを手入力', icon: '📅', page: 'diary' },
  { id: 'analyzer',     label: 'Product Performance XLSXをDL→アップロード',    icon: '📊', page: 'analyzer' },
  { id: 'orders',       label: '注文レポートXLSXをDL→アップロード',              icon: '📂', page: 'shopeemanager' },
]
const WEEKLY_TASKS = [
  { id: 'accounthealth',label: 'アカウントヘルス・Preferred Seller確認→記録',   icon: '🏥', page: 'accounthealth' },
  { id: 'myincome',     label: 'MyIncome XLSXをDL→アップロード',                icon: '💰', page: 'shopeemanager' },
  { id: 'massupload',   label: 'Mass Update XLSXをDL→アップロード',             icon: '🔄', page: 'massupdate' },
  { id: 'massai',       label: 'AI補完で商品情報（JAN・原産国・重量）を更新',    icon: '🤖', page: 'massupdate' },
  { id: 'massreupload', label: '編集済みXLSXをShopee Seller Centerに再アップ',  icon: '📤', page: null },
]
const MONTHLY_TASKS = [
  { id: 'goal',         label: '月間目標（売上・CTR・CVR）を設定',               icon: '🎯', page: 'dashboard' },
  { id: 'inventory',    label: '在庫棚卸・仕入れ情報を更新',                     icon: '📦', page: 'inventory' },
]

// ========== キー生成 ==========
function getDailyKey(date) { return date.toISOString().slice(0, 10) }
function getWeeklyKey(date) {
  const d = new Date(date)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // 月曜起算
  return 'w-' + d.toISOString().slice(0, 10)
}
function getMonthlyKey(date) { return 'm-' + date.toISOString().slice(0, 7) }

// ========== リセット基準日時（毎朝5時） ==========
function getEffectiveDate() {
  const now = new Date()
  if (now.getHours() < 5) now.setDate(now.getDate() - 1)
  return now
}

export default function TaskChecklist({ uid: propUid, onNavigate, compact = false }) {
  const uid = propUid || auth.currentUser?.uid
  const [daily,   setDaily]   = useState({})
  const [weekly,  setWeekly]  = useState({})
  const [monthly, setMonthly] = useState({})
  const [loading, setLoading] = useState(true)

  const effDate   = getEffectiveDate()
  const dailyKey  = getDailyKey(effDate)
  const weeklyKey = getWeeklyKey(effDate)
  const monthlyKey= getMonthlyKey(effDate)

  const load = useCallback(async () => {
    if (!uid) return
    setLoading(true)
    try {
      const [dSnap, wSnap, mSnap] = await Promise.all([
        getDoc(doc(db, 'task_checklists', `${uid}_${dailyKey}`)),
        getDoc(doc(db, 'task_checklists', `${uid}_${weeklyKey}`)),
        getDoc(doc(db, 'task_checklists', `${uid}_${monthlyKey}`)),
      ])
      setDaily(dSnap.exists()   ? dSnap.data().checks   || {} : {})
      setWeekly(wSnap.exists()  ? wSnap.data().checks   || {} : {})
      setMonthly(mSnap.exists() ? mSnap.data().checks   || {} : {})
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [uid, dailyKey, weeklyKey, monthlyKey])

  useEffect(() => { load() }, [load])

  async function toggle(type, taskId) {
    const [checks, setChecks, key] =
      type === 'daily'   ? [daily,   setDaily,   dailyKey]   :
      type === 'weekly'  ? [weekly,  setWeekly,  weeklyKey]  :
                           [monthly, setMonthly, monthlyKey]
    const next = { ...checks, [taskId]: !checks[taskId] }
    setChecks(next)
    await setDoc(doc(db, 'task_checklists', `${uid}_${key}`), { uid, type, key, checks: next, updatedAt: serverTimestamp() }, { merge: true })
  }

  async function resetAll(type) {
    const [, setChecks, key] =
      type === 'daily'   ? [daily,   setDaily,   dailyKey]   :
      type === 'weekly'  ? [weekly,  setWeekly,  weeklyKey]  :
                           [monthly, setMonthly, monthlyKey]
    setChecks({})
    await setDoc(doc(db, 'task_checklists', `${uid}_${key}`), { uid, type, key, checks: {}, updatedAt: serverTimestamp() })
  }

  // 未完了カウント（外部公開用）
  const uncompleted =
    DAILY_TASKS.filter(t => !daily[t.id]).length +
    WEEKLY_TASKS.filter(t => !weekly[t.id]).length +
    MONTHLY_TASKS.filter(t => !monthly[t.id]).length

  function Section({ title, emoji, tasks, checks, type, color, resetLabel }) {
    const done  = tasks.filter(t => checks[t.id]).length
    const total = tasks.length
    const pct   = Math.round((done / total) * 100)
    return (
      <div style={{ marginBottom: compact ? '0.75rem' : '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: compact ? '0.7rem' : '0.75rem', fontWeight: 700, color }}>{emoji} {title}</span>
            <span style={{ fontSize: '0.62rem', color: done === total ? 'var(--green)' : 'var(--dim2)', fontWeight: 700 }}>{done}/{total}</span>
          </div>
          <button onClick={() => resetAll(type)} style={{ fontSize: '0.6rem', color: 'var(--dim2)', background: 'none', border: '1px solid var(--rim)', borderRadius: 4, padding: '0.15rem 0.4rem', cursor: 'pointer' }}>↺ リセット</button>
        </div>
        {/* プログレスバー */}
        <div style={{ height: 4, background: 'var(--rim)', borderRadius: 2, marginBottom: '0.5rem', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: pct + '%', background: done === total ? 'var(--green)' : color, borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
        {tasks.map(t => (
          <div key={t.id}
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: compact ? '0.3rem 0.4rem' : '0.4rem 0.6rem', borderRadius: 6, marginBottom: '0.2rem', background: checks[t.id] ? 'rgba(22,163,74,0.06)' : 'var(--card)', cursor: 'pointer', transition: 'background 0.2s' }}
            onClick={() => toggle(type, t.id)}>
            <div style={{ width: 16, height: 16, borderRadius: 4, border: '2px solid ' + (checks[t.id] ? 'var(--green)' : 'var(--rim)'), background: checks[t.id] ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
              {checks[t.id] && <span style={{ fontSize: '0.55rem', color: '#fff', fontWeight: 900 }}>✓</span>}
            </div>
            <span style={{ fontSize: compact ? '0.68rem' : '0.72rem', color: checks[t.id] ? 'var(--dim2)' : 'var(--text)', textDecoration: checks[t.id] ? 'line-through' : 'none', flex: 1 }}>{t.icon} {t.label}</span>
            {t.page && onNavigate && !checks[t.id] && (
              <span onClick={e => { e.stopPropagation(); onNavigate(t.page) }}
                style={{ fontSize: '0.6rem', color: color, border: '1px solid ' + color, borderRadius: 3, padding: '0.1rem 0.3rem', cursor: 'pointer', flexShrink: 0 }}>開く</span>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (loading) return <div style={{ padding: '1rem', color: 'var(--dim2)', fontSize: '0.75rem' }}>読み込み中...</div>

  return (
    <div>
      <Section title="日次タスク" emoji="📅" tasks={DAILY_TASKS}   checks={daily}   type="daily"   color="var(--orange)" />
      <Section title="週次タスク" emoji="📆" tasks={WEEKLY_TASKS}  checks={weekly}  type="weekly"  color="var(--blue)"   />
      <Section title="月次タスク" emoji="🗓️" tasks={MONTHLY_TASKS} checks={monthly} type="monthly" color="var(--purple)" />
    </div>
  )
}

// 未完了数を外部から取得するhook
export function useUncompletedCount(uid) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!uid) return
    async function calc() {
      const effDate    = getEffectiveDate()
      const dailyKey   = getDailyKey(effDate)
      const weeklyKey  = getWeeklyKey(effDate)
      const monthlyKey = getMonthlyKey(effDate)
      try {
        const [dSnap, wSnap, mSnap] = await Promise.all([
          getDoc(doc(db, 'task_checklists', `${uid}_${dailyKey}`)),
          getDoc(doc(db, 'task_checklists', `${uid}_${weeklyKey}`)),
          getDoc(doc(db, 'task_checklists', `${uid}_${monthlyKey}`)),
        ])
        const dc = dSnap.exists()  ? dSnap.data().checks  || {} : {}
        const wc = wSnap.exists()  ? wSnap.data().checks  || {} : {}
        const mc = mSnap.exists()  ? mSnap.data().checks  || {} : {}
        const total =
          DAILY_TASKS.filter(t => !dc[t.id]).length +
          WEEKLY_TASKS.filter(t => !wc[t.id]).length +
          MONTHLY_TASKS.filter(t => !mc[t.id]).length
        setCount(total)
      } catch(e) {}
    }
    calc()
    const interval = setInterval(calc, 60000) // 1分ごとに更新
    return () => clearInterval(interval)
  }, [uid])
  return count
}
