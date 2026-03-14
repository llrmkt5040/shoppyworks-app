const CHANGELOG = [
  { date: "2026-03-15", text: "💴 v0.22.0: 資金繰り管理を全面刷新（入金4段階ステータス・Payoneer USD着金・為替差損計算・クレカ管理・買掛金・マイル/ポイント管理）" },
  { date: "2026-03-15", text: "🔍 v0.21.0: CompetitorWatch追加（競合セラー手動入力→AI分析・自社DBデータ自動連携・履歴管理）" },
  { date: "2026-03-15", text: "🧮 v0.20.0: BreakEvenCalc追加（SLS送料テーブル・消費税還付・Payoneer手数料・複数購入シミュレーション・設定保存）" },
  { date: "2026-03-15", text: "📋 v0.19.0: ShippingManager独立（ProfitManagerと同一データソース共有）" },
  { date: "2026-03-15", text: "📦 v0.18.0: StockManager全面刷新（physical_products対応・親子商品・フラグ/ステータス・CSV取込・仕入先別ビュー・Shopee出品情報連携）" },
  { date: "2026-03-15", text: "👥 v0.17.0: Cockpit強化（複数講師対応・新規ユーザー登録・前日売上/注文数・全員合計表示）" },
  { date: "2026-03-15", text: "🗂️ v0.16.0: メニュー全面整理（英語/日本語2段表記・Sales/Listing/Stock/Tools カテゴライズ）" },
  { date: "2026-03-14", text: "💱 v0.15.0: ShopeeManager利益管理にUSD換算(Payoneer 2%込)・JPY換算表示を追加" },
  { date: "2026-03-14", text: "🤖 v0.14.1: 全ページのAI機能をFirestore APIキー共有に統一（スタッフもAI利用可能に）" },
  { date: "2026-03-14", text: "🧠 v0.14.0: ShopeeAnalyzer AI改善アドバイザー実装（商品データ分析→具体的改善提案）" },
  { date: "2026-03-14", text: "⚡ v0.13.2: AI機能ON/OFFトグル追加（設定→システムタブでオーナーが制御）" },
  { date: "2026-03-14", text: "🔗 v0.13.1: ShopeeDiaryのショップURLを永続保存（一度入力すれば次回から自動表示）" },
  { date: "2026-03-13", text: "🔔 v0.13.0: Firebase Functionsメール通知（Pasabuy新規問合せ・Diary未記録アラート）" },
  { date: "2026-03-13", text: "🔑 v0.12.2: Anthropic APIキー設定UI追加（設定→システムタブ・接続テスト機能付き）" },
  { date: "2026-03-13", text: "🔲 v0.12.1: MassUpdate 全フィールド表示トグルボタン追加" },
  { date: "2026-03-13", text: "💰 v0.12.0: Pasabuy AI価格提案・オファー文3パターン自動生成（通常・緊急・フォローアップ）" },
  { date: "2026-03-13", text: "🤖 v0.11.0: AIダッシュボードウィジェット追加（トレンド分析・アクションプラン・売上予測）" },
  { date: "2026-03-13", text: "📅 v0.10.5: Dashboard前日比・先週比・先月比バッジ追加（JST対応）" },
  { date: "2026-03-13", text: "📈 v0.10.4: ShopeeAnalyzer差分分析タブ追加（CTR/CVR改善・悪化ランキング・全商品差分一覧）" },
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
  { date: "2026-03-12", text: "🏥 v0.5.0: アカウントヘルス管理ページ追加（週次記録・トレンド表示・AI画像読み取り）" },
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
  { status: "🔴", text: "inventory_items旧コレクション整理・データ移行" },
  { status: "🔴", text: "ユーザー目標設定（売上・利益目標・ゴールペース連動）" },
  { status: "🟠", text: "在庫管理Phase 2（販売SKU管理・セット商品・チャネル別出品）" },
  { status: "🟠", text: "ShopeeAnalyzer AI分析復活（Firebase Functions経由）" },
  { status: "🟠", text: "XLSXデータのFirestore永続保存" },
  { status: "🟡", text: "オンボーディング / 初回ウィザード" },
  { status: "🟡", text: "在庫管理Phase 3（棚卸・発注アラート）" },
  { status: "🟡", text: "卸メニュー（SekaLogi連携・ドロップシッピング）" },
  { status: "🔵", text: "Shopee API連動（注文・商品・アカウントヘルスの自動取得）" },
  { status: "🔵", text: "マルチ国対応（SG・MY・TH）" },
]

const NOTICES = [
  { date: "2026-03-15", type: "info", text: "💴 v0.22.0 リリース！資金繰り管理が大幅強化。Payoneer USD着金・為替差損計算・クレカ管理・買掛金・マイル/ポイント管理が追加されました。" },
  { date: "2026-03-15", type: "info", text: "🔍 CompetitorWatch追加！競合ショップ情報を手動入力してAI分析。自社データ（売上・CVR等）と自動比較して改善提案が届きます。" },
  { date: "2026-03-15", type: "info", text: "🧮 BreakEvenCalcを追加！SLS送料テーブル対応・消費税還付・複数購入シミュレーション機能付きの損益分岐計算機です。" },
  { date: "2026-03-15", type: "info", text: "📦 StockManager（在庫管理）が大幅強化！CSVインポート・仕入先別ビュー・Shopee出品情報との連携が可能になりました。" },
  { date: "2026-03-15", type: "info", text: "🗂️ メニューを全面整理しました。Sales / Listing / Stock Management / Analysis & Tools の4カテゴリに整理し、英語/日本語の2段表記に統一しました。" },
  { date: "2026-03-14", type: "info", text: "🤖 v0.14 リリース！ShopeeAnalyzerにAI改善アドバイザーを追加。AI提案タブから商品データ分析→改善提案が受けられます。" },
  { date: "2026-03-14", type: "info", text: "👥 AI機能がスタッフアカウントでも利用可能に。オーナーが設定→システムタブでAPIキーを登録すれば自動共有されます。" },
  { date: "2026-03-14", type: "info", text: "💱 ShopeeManagerの利益管理にUSD・JPY換算を追加。Payoneer手数料2%込みの実質入金額が確認できます。" },
  { date: "2026-03-14", type: "info", text: "🔗 行動ログのショップURLが永続保存に。一度入力すれば次回から自動表示されます。" },
  { date: "2026-03-13", type: "info", text: "🔔 v0.13.0 リリース！メール通知機能を追加しました。設定→システムタブからメールアドレスを登録してください。" },
  { date: "2026-03-13", type: "info", text: "🤖 AI機能が全ページで使えるようになりました。設定→システムタブでAnthropicのAPIキーを登録してください。" },
  { date: "2026-03-13", type: "info", text: "💰 PasabuyにAI価格提案・オファー文3パターン自動生成を追加しました。案件の「🤖 AI」ボタンから使えます。" },
  { date: "2026-03-13", type: "info", text: "📈 ShopeeAnalyzerに差分分析タブを追加しました。過去データとのCTR/CVR比較ができます。" },
  { date: "2026-03-13", type: "info", text: "🛍️ PasabuyManager にバウチャー割引率・価格シミュレーションタブを追加しました。" },
  { date: "2026-03-13", type: "info", text: "👥 スタッフ権限管理を強化しました。ページごとに編集・閲覧・非表示を設定できます。" },
  { date: "2026-03-12", type: "info", text: "🎉 v0.8.0 リリース！サイドナビを日次・週次・都度業務に整理しました。" },
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
