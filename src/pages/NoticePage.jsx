const CHANGELOG = [
  { date: "2026-03-12", text: "🔔 v0.6.0: タスクチェックリスト追加（日次/週次/月次・自動リセット・ベル通知バッジ）" },
  { date: "2026-03-12", text: "🏥 v0.5.0: アカウントヘルス管理ページ追加（AI画像読み取り・週次記録・トレンド表示）" },
  { date: "2026-03-12", text: "📂 v0.4.0: ShopeeManagerデータ連動（今月受注・発送待ち・未リリース収益→ダッシュボード）" },
  { date: "2026-03-12", text: "🔄 v0.3.0: MassUpdate管理ページ追加（JAN・原産国・SKU分類・AI補完・XLSXダウンロード）" },
  { date: "2026-03-12", text: "🎯 v0.2.0: ダッシュボード強化（目標ペースバー・¥メイン表示・為替USD経由2%・目標達成率グラフ）" },
  { date: "2026-03-12", text: "👥 スタッフアクセス機能追加（設定画面からスタッフメール登録・全ページ対応）" },
  { date: "2026-03-12", text: "🔒 Firestoreセキュリティルール設定（ユーザーデータ保護）" },
  { date: "2026-03-12", text: "📅 ShopeeDiaryにショップURL・項目順序改善・Voucher区切り追加" },
  { date: "2026-03-11", text: "🎯 ShopeeAnalyzerをコクピットに強化・トップページ設定" },
  { date: "2026-03-11", text: "📊 ダッシュボードを4タブ化（日次・週次・月次・ロードマップ）" },
  { date: "2026-03-11", text: "🔍 商品詳細テーブルに枠固定・ソート・フィルタ・条件指定を追加" },
  { date: "2026-03-10", text: "📂 分析履歴をFirestoreに保存・履歴ページ追加" },
  { date: "2026-03-10", text: "🏠 v0.1.0: 初期リリース（Analyzer・Dashboard・Diary・StockManager・ShopeeManager・Settings）" },
]

const ROADMAP = [
  { status: "🔴", text: "MassUpdate大規模対応（1万件・1商品1ドキュメント方式への設計変更）" },
  { status: "🟠", text: "メール通知（Firebase Functions・日次/週次タスク未完了アラート）" },
  { status: "🟠", text: "Shopee API連動（注文・商品・アカウントヘルスの自動取得）" },
  { status: "🟡", text: "アカウントヘルスAI画像読み取り（4月以降・スクショ→自動入力）" },
  { status: "🟡", text: "アドバイスマネジメント" },
  { status: "🟡", text: "卸メニュー（ドロップシッピング）" },
  { status: "🔵", text: "講師コクピット（API・AI全部揃ってから）" },
]

const NOTICES = [
  { date: "2026-03-12", type: "info", text: "🎉 ShoppyWorks v0.7.0 リリース！ダッシュボード日次タブを全面刷新しました。" },
  { date: "2026-03-12", type: "info", text: "📊 ダッシュボードに週次・月次KPIカード・商品ランキングを追加しました。" },
  { date: "2026-03-12", type: "warn", text: "⚠️ CTR/CVRの計算方式を加重平均に変更しました。次回XLSXアップ時から反映されます。" },
]

export default function NoticePage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem' }}>

      {/* お知らせ */}
      <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.75rem' }}>📢 お知らせ</div>
      <div className="card" style={{ padding:'1.25rem', marginBottom:'1.5rem' }}>
        {NOTICES.map((n, i) => (
          <div key={i} style={{ display:'flex', gap:'0.75rem', alignItems:'flex-start', padding:'0.5rem 0', borderBottom: i < NOTICES.length-1 ? '1px solid var(--rim)' : 'none' }}>
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.65rem', color:'var(--dim2)', whiteSpace:'nowrap', marginTop:'0.1rem' }}>{n.date}</span>
            <span style={{ fontSize:'0.75rem', color: n.type === 'warn' ? 'var(--yellow, #f59e0b)' : 'var(--text)', lineHeight:1.5 }}>{n.text}</span>
          </div>
        ))}
      </div>

      {/* システム更新履歴 */}
      <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.75rem' }}>🔄 システム更新履歴</div>
      <div className="card" style={{ padding:'1.25rem', marginBottom:'1.5rem' }}>
        {CHANGELOG.map((c, i) => (
          <div key={i} style={{ display:'flex', gap:'0.75rem', alignItems:'flex-start', padding:'0.5rem 0', borderBottom: i < CHANGELOG.length-1 ? '1px solid var(--rim)' : 'none' }}>
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.65rem', color:'var(--dim2)', whiteSpace:'nowrap', marginTop:'0.1rem' }}>{c.date}</span>
            <span style={{ fontSize:'0.75rem', color:'var(--text)', lineHeight:1.5 }}>{c.text}</span>
          </div>
        ))}
      </div>

      {/* 改修予定 */}
      <div style={{ fontSize:'0.7rem', color:'var(--dim2)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.75rem' }}>🚀 今後の改修予定</div>
      <div className="card" style={{ padding:'1.25rem' }}>
        {ROADMAP.map((r, i) => (
          <div key={i} style={{ display:'flex', gap:'0.75rem', alignItems:'flex-start', padding:'0.4rem 0', borderBottom: i < ROADMAP.length-1 ? '1px solid var(--rim)' : 'none' }}>
            <span style={{ fontSize:'0.85rem', flexShrink:0 }}>{r.status}</span>
            <span style={{ fontSize:'0.75rem', color:'var(--text)', lineHeight:1.5 }}>{r.text}</span>
          </div>
        ))}
        <div style={{ marginTop:'0.75rem', fontSize:'0.65rem', color:'var(--dim2)' }}>
          🔴 最優先　🟠 高　🟡 中　🔵 低
        </div>
      </div>

    </div>
  )
}
