# ShoppyWorks Bootcamp App

Shopeeエクスポート向け運営管理システム

🌐 本番URL: https://shoppyworks-bootcamp.web.app

---

## 📋 システム更新履歴

### v0.3.0 — 2026-03-12
**MassUpdate管理ページ追加**
- 🔄 MassUpdate管理ページ新規作成（専用ページ）
- 📤 ShopeeのMass Update XLSXアップロード・Firestore保存
- 📋 商品一覧・編集タブ（JAN・原産国・重量・ブランド・カテゴリ・価格・在庫数）
- 🏷️ SKU分類フィルター（有在庫 / 無在庫 / Pasabuy）
- 🔗 在庫棚卸（ShopeeStockManager）からJAN・原産国を自動補完
- 🤖 AI補完機能（単体・一括）：JAN・原産国・重量・カテゴリ・Fail Reason修正案
- 🔴 エラー管理タブ（Fail Reasonがある商品を一覧表示）
- 📅 アップロード履歴タブ
- ⬇ 編集済みXLSXダウンロード機能

### v0.2.0 — 2026-03-12
**ダッシュボード大幅強化**
- 📈 日次タブに今月の目標ペースバー追加
- 💴 表示を¥メイン・₱サブに統一
- 💱 為替レートをUSD経由・Payoneer手数料2%込みに修正
- 🎯 週次・月次・前日タブに目標達成率グラフ追加
- 📊 KPIカードに当日売上・今月累計（Diary）追加
- 🔧 目標ペースをDiary月次累計ベースに修正

### v0.1.0 — 2026-03-12
**初期リリース**
- 📊 ShopeeAnalyzer（商品分析）
- 📈 ShopeeWorksDashboard（数値管理）
- 📅 ShopeeDiary（日次管理）
- 📦 ShopeeStockManager（在庫棚卸）
- 📂 ShopeeManager（一元管理）
- ⚙️ Settings

---

## 🗂️ Firestoreコレクション一覧

| コレクション | 用途 |
|-------------|------|
| action_logs | 日次手入力（売上・出品数等） |
| fx_rates | 為替レート（USD/JPY・USD/PHP） |
| inventory_items | 在庫棚卸データ |
| user_settings | ユーザー設定 |
| xlsx_analyses | ShopeeAnalyzer分析結果 |
| product_flags | 商品フラグ |
| shopee_orders | オーダーデータ |
| shopee_income | MyIncomeデータ |
| shopee_income_released | リリース済みIncomeデータ |
| cashflow_items | キャッシュフロー |
| user_goals | 月間目標 |
| mass_updates | MassUpdate履歴・商品データ |

---

## 🚀 開発フロー
```bash
# 開発サーバー起動
cd ~/shoppyworks-app && npm run dev

# ビルド確認
npm run build

# デプロイ
firebase deploy --only hosting

# Gitコミット（必ずbranchで作業）
git checkout -b feature/xxx
git add . && git commit -m 'メッセージ' && git push origin feature/xxx

# mainにマージ
git checkout main && git merge feature/xxx && git push origin main
```

## ⚠️ 開発ルール
- **必ずブランチを切ってから作業すること**
- ビルド確認（npm run build）してからデプロイ
- mainへのマージ前にブラウザで動作確認
