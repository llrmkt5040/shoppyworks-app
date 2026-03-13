const CHANGELOG = [
  { date: "2026-03-13", text: "🛍️ v0.10.3: PasabuyManager バウチャー割引率対応（割引後の実質受取額・利益を正確計算）" },
  { date: "2026-03-13", text: "🛍️ v0.10.2: PasabuyManager 価格シミュレーションタブ追加（オファー価格入力→利益額・利益率を逆算）" },
  { date: "2026-03-13", text: "🛍️ v0.10.1: PasabuyManager 円ペソ両建て表示（Firestoreの為替レート自動取得・全費用に円換算追加）" },
  { date: "2026-03-13", text: "👥 v0.10.0: スタッフ権限管理強化（ページ単位・編集/閲覧/非表示の3段階制御）" },
  { date: "2026-03-13", text: "⚙️ v0.9.2: 設定ページ3タブ化（表示項目・スタッフ・システム）" },
  { date: "2026-03-13", text: "🗂️ v0.9.1: ShopeeDiary・ShopeeAnalyzer の日付キー固定ID方式（同日の重複登録を自動上書き）" },
  { date: "2026-03-13", text: "📖 v0.9.0: 操作マニュアル追加（受講生向け・全ページ対応）" },
  { date: "2026-03-13", text: "📦 v0.8.2: 出荷管理のORDER ID重複上書き対応（同一IDは最新データで上書き保存）" },
  { date: "2026-03-13", text: "🧹 v0.8.1: ShopeeAnalyzerのステータスカード・CHANGELOG表示をお知らせページに集約" },
  { date: "2026-03-12", text: "🔔 v0.8.0: サイドナビを業務区分け（日次・週次・都度）に整理。お知らせ・マニュアルページ追加" },
  { date: "2026-03-12", text: "📅 v0.7.0: ダッシュボード日次タブ全面刷新（前日実績・注文レポート・TOP5商品・パフォーマンス・差分）" },
  { date: "2026-03-12", text: "🔔 v0.6.0: タスクチェックリスト追加（日次/週次/月次・自動リセット・ベル通知バッジ）" },
  { date: "2026-03-12", text: "🏥 v0.5.0: アカウントヘルス管理ページ追加（週次記録・トレンド表示）" },
  { date: "2026-03-12", text: "📂 v0.4.0: ShopeeManagerデータ連動（今月受注・発送待ち・未リリース収益→ダッシュボード）" },
  { date: "2026-03-12", text: "🔄 v0.3.0: MassUpdate管理ページ追加（JAN・原産国・SKU分類・AI補完・XLSXダウンロード）" },
  { date: "2026-03-12", text: "🎯 v0.2.0: ダッシュボード強化（目標ペースバー・¥メイン表示・為替USD経由2%・目標達成率グラフ）" },
  { date: "2026-03-12", text: "👥 スタッフアクセス機能追加（設定画面からスタッフメール登録・全ページ対応）" },
  { date: "2026-03-12", text: "🔒 Firestoreセキュリティルール設定（ユーザーデータ保護）" },
  { date: "2026-03-11", text: "🎯 ShopeeAnalyzerをコクピットに強化・トップページ設定" },
  { date: "2026-03-11", text: "📊 ダッシュボードを4タブ化（日次・週次・月次・ロードマップ）" },
  { date: "2026-03-10", text: "🏠 v0.1.0: 初期リリース（Analyzer・Dashboard・Diary・StockManager・ShopeeManager・Settings）" },
]

const ROADMAP = [
  { status: "🔴", text: "MassUpdate機能磨き上げ（UI改善・操作性向上・大規模対応）" },
  { status: "🟠", text: "AI機能（ダッシュボード分析アドバイス・Pasabuy価格提案・オファー文章強化・フォローアップ自動生成）" },
  { status: "🟠", text: "メール通知（Firebase Functions・日次/週次タスク未完了アラート）" },
  { status: "🟠", text: "Shopee API連動（注文・商品・アカウントヘルスの自動取得）" },
  { status: "🟡", text: "アカウントヘルスAI画像読み取り（4月以降・スクショ→自動入力）" },
  { status: "🟡", text: "卸メニュー（ドロップシッピング）" },
  { status: "🔵", text: "講師コクピット（API・AI全部揃ってから）" },
]

const NOTICES = [
  { date: "2026-03-13", type: "info", text: "🛍️ PasabuyManager にバウチャー割引率・価格シミュレーションタブを追加しました。" },
  { date: "2026-03-13", type: "info", text: "👥 スタッフ権限管理を強化しました。ページごとに編集・閲覧・非表示を設定できます。" },
  { date: "2026-03-13", type: "info", text: "🗂️ ShopeeDiary・ShopeeAnalyzer の同日データ重複登録を修正しました。同日入力は自動上書きになります。" },
  { date: "2026-03-13", type: "info", text: "📖 操作マニュアルを追加しました。サイドメニューの「マニュアル」からご確認ください。" },
  { date: "2026-03-13", type: "info", text: "📦 出荷管理の重複データ問題を修正しました。同じORDER IDは最新データで上書きされます。" },
  { date: "2026-03-12", type: "info", text: "🎉 v0.8.0 リリース！サイドナビを日次・週次・都度業務に整理しました。" },
  { date: "2026-03-12", type: "info", text: "📅 ダッシュボード日次タブを全面刷新。前日実績・注文TOP5・パフォーマンス差分が確認できます。" },
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
