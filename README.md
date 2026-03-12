# ShoppyWorks Bootcamp App

## 概要
Shopeeフィリピン輸出向けEコマース管理アプリ。受講生のShopee運営を一元管理。

**本番URL**: https://shoppyworks-bootcamp.web.app  
**GitHub**: https://github.com/llrmkt5040/shoppyworks-app  
**技術**: React / Vite / Firebase（Firestore + Hosting）

---

## バージョン履歴

| バージョン | 日付 | 内容 |
|-----------|------|------|
| v0.6.0 | 2026-03-12 | タスクチェックリスト・ベル通知追加、ダッシュボード整理、スタッフアクセス対応 |
| v0.5.0 | 2026-03-12 | アカウントヘルス管理ページ追加（AI画像読み取り・週次記録・トレンド） |
| v0.4.0 | 2026-03-12 | ShopeeManagerデータ連動（今月受注・発送待ち・未リリース収益） |
| v0.3.0 | 2026-03-12 | MassUpdate管理ページ追加（AI補完・SKU分類・XLSXダウンロード） |
| v0.2.0 | 2026-03-12 | ダッシュボード強化（目標ペース・¥メイン・達成率グラフ） |
| v0.1.0 | 2026-03-10 | 初期リリース（Analyzer・Dashboard・Diary・StockManager・ShopeeManager・Settings） |

---

## ページ一覧

| ページ | アイコン | 役割 |
|--------|---------|------|
| ShopeeWorksDashboard | 📈 | KPI一元表示・目標ペース・日次/週次/月次タブ |
| ShopeeAnalyzer | 📊 | 商品別CTR/CVR分析・AI改善提案・CHANGELOG |
| ShopeeDiary | 📅 | 日次手入力ログ（売上・出品数・フォロワー） |
| ShopeeStockManager | 📦 | 在庫棚卸・仕入れ管理 |
| ShopeeManager | 📂 | 注文管理・MyIncome損益・キャッシュフロー |
| MassUpdate管理 | 🔄 | 出品情報一括更新・AI補完・XLSX出力 |
| アカウントヘルス | 🏥 | ヘルス指標週次記録・Preferred Seller管理 |
| Settings | ⚙️ | ユーザー設定・スタッフ管理 |

---

## Firestoreコレクション

| コレクション | 内容 | 更新タイミング |
|-------------|------|--------------|
| action_logs | 日次売上・出品数・フォロワー手入力 | ShopeeDiaryで毎日 |
| fx_rates | ₱→¥換算レート（USD経由・Payoneer2%） | Diary保存時自動取得 |
| inventory_items | 在庫棚卸（SKU/JAN/原産国/仕入価格） | ShopeeStockManagerで随時 |
| user_settings | ユーザー設定・スタッフメール | Settingsで変更 |
| xlsx_analyses | 分析結果（CTR/CVR/売上等） | XLSXアップロード時 |
| product_flags | 商品フラグ（定番/季節/トレンド/終売） | Analyzerで手動 |
| shopee_orders | 注文レポートデータ | ShopeeManagerでXLSX |
| shopee_income | MyIncome To Releaseデータ | ShopeeManagerでXLSX |
| shopee_income_released | MyIncome Releasedデータ | ShopeeManagerでXLSX |
| cashflow_items | キャッシュフロー手入力 | ShopeeManagerで手動 |
| user_goals | 月間目標 | ダッシュボードで月初設定 |
| mass_updates | MassUpdate履歴・商品データ | MassUpdate管理でXLSX |
| account_health | アカウントヘルス週次記録 | アカウントヘルスで毎週火曜 |
| task_checklists | タスクチェックリスト状態 | 各タスク完了時・自動リセット |

---

## 推奨運用フロー

| 頻度 | タスク |
|------|--------|
| 毎日（朝） | ShopeeDiary手入力 → Product Performance XLSX → 注文レポートXLSX |
| 毎週火曜 | アカウントヘルス確認・記録 → MyIncome XLSX → MassUpdate・AI補完 |
| 月初 | 月間目標設定 → 在庫棚卸更新 |

---

## 開発フロー
```bash
# 開発サーバー起動
cd ~/shoppyworks-app && npm run dev

# ビルド＆デプロイ（必ずブランチで作業）
git checkout -b feature/xxx
# 作業...
npm run build && firebase deploy --only hosting
git add . && git commit -m "feat: 内容" && git push origin feature/xxx

# mainにマージ
git checkout main && git merge feature/xxx && git push origin main
```

## 今後のロードマップ

- 🔴 MassUpdate大規模対応（1万件・1商品1ドキュメント）
- 🟠 メール通知（Firebase Functions）
- 🟠 Shopee API連動（自動データ取得）
- 🟡 アカウントヘルスAI画像読み取り（4月以降）
- 🔵 講師コクピット
