const { onDocumentCreated } = require("firebase-functions/v2/firestore")
const { defineSecret } = require("firebase-functions/params")

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY")
const FROM_EMAIL = defineSecret("FROM_EMAIL")
const { onSchedule } = require("firebase-functions/v2/scheduler")
const { setGlobalOptions } = require("firebase-functions/v2")
const { initializeApp } = require("firebase-admin/app")
const { getFirestore } = require("firebase-admin/firestore")
const sgMail = require("@sendgrid/mail")

initializeApp()
setGlobalOptions({ region: "asia-northeast1" })

const db = getFirestore()

function getSendGrid() {
  const key = SENDGRID_API_KEY.value()
  if (!key) throw new Error("SENDGRID_API_KEY not set")
  sgMail.setApiKey(key)
  return sgMail
}

exports.notifyNewRequest = onDocumentCreated({ document: "request_logs/{docId}", secrets: [SENDGRID_API_KEY, FROM_EMAIL] }, async (event) => {
  const data = event.data.data()
  if (!data?.uid) return
  try {
    const settingSnap = await db.doc("user_settings/" + data.uid).get()
    const ownerEmail = settingSnap.data()?.notify_email
    if (!ownerEmail) return
    const sg = getSendGrid()
    await sg.send({
      to: ownerEmail,
      from: { name: "ShoppyWorks BootCamp", email: FROM_EMAIL.value() || "noreply@shoppyworks.com" },
      subject: "Pasabuy新規問合せ: " + (data.product || "商品名なし"),
      html: "<h2>新規Pasabuy問合せ</h2><p>商品: " + (data.product || "-") + "</p><p>金額: " + (data.price || "未定") + "</p><p>買い手: " + (data.buyerName || "-") + "</p><a href='https://shoppyworks-bootcamp.web.app'>アプリで確認する</a>"
    })
    console.log("Pasabuy通知送信:", ownerEmail)
  } catch(e) {
    console.error("通知エラー:", e.message)
  }
})

exports.diaryReminder = onSchedule({ schedule: "0 12 * * *", secrets: [SENDGRID_API_KEY, FROM_EMAIL] }, async () => {
  try {
    const today = new Date()
    const jst = new Date(today.getTime() + 9 * 60 * 60 * 1000)
    // 前日の日付を計算
    const yesterday = new Date(jst)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    const settingsSnap = await db.collection("user_settings").get()
    for (const settingDoc of settingsSnap.docs) {
      const setting = settingDoc.data()
      const uid = settingDoc.id
      const ownerEmail = setting?.notify_email
      if (!ownerEmail || !setting?.notify_diary) continue
      const diarySnap = await db.collection("action_logs").where("uid", "==", uid).where("date", "==", yesterdayStr).limit(1).get()
      if (diarySnap.empty) {
        const sg = getSendGrid()
        await sg.send({
          to: ownerEmail,
          from: { name: "ShoppyWorks BootCamp", email: FROM_EMAIL.value() || "noreply@shoppyworks.com" },
          subject: "前日のShopeeDiaryが未記録です",
          html: "<h2>Diary未記録アラート</h2><p>前日（" + yesterdayStr + "）のShopeeDiaryがまだ記録されていません。</p><a href='https://shoppyworks-bootcamp.web.app'>今すぐ記録する</a>"
        })
        console.log("Diary未記録通知送信:", ownerEmail)
      }
    }
  } catch(e) {
    console.error("Diaryリマインダーエラー:", e.message)
  }
})

const { onRequest } = require("firebase-functions/v2/https")
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY")

exports.analyzeCompetitor = onRequest({
  secrets: [ANTHROPIC_API_KEY],
  cors: true,
  timeoutSeconds: 120,
}, async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })
  try {
    const { urls, myShopUrl, mode } = req.body
    if (!urls || urls.length === 0) return res.status(400).json({ error: "URLが必要です" })

    const Anthropic = require("@anthropic-ai/sdk")
    const client = new Anthropic.default({ apiKey: ANTHROPIC_API_KEY.value() })

    // 各URLの情報をweb_searchで取得
    const pageContents = []
    for (const url of urls) {
      try {
        const searchRes = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{
            role: "user",
            content: `以下のShopeeショップページの情報を取得して、商品一覧・価格・レビュー数・評価・タイトルなどの情報を詳しく教えてください。URL: ${url}`
          }]
        })
        const text = searchRes.content?.filter(c => c.type === "text").map(c => c.text).join("\n") || "取得失敗"
        pageContents.push({ url, content: text })
      } catch(e) {
        pageContents.push({ url, content: `取得エラー: ${e.message}` })
      }
    }

    // AI分析
    const myShopContext = myShopUrl ? `\n\n【自社ショップURL】: ${myShopUrl}` : ""
    const competitorContext = pageContents.map((p, i) =>
      `【競合${i+1} URL】: ${p.url}\n【取得情報】:\n${p.content}`
    ).join("\n\n---\n\n")

    const { shopData, myShopContext: myShopCtx } = req.body
    const dataContext = shopData
      ? `\n\n【手動入力データ】:\n${shopData}`
      : `\n\n${competitorContext}`
    const myCtx = myShopCtx || myShopContext

    const analysisPrompt = `以下の競合Shopeeショップの情報を元に詳しく分析してください。${myCtx}${dataContext}\n\n以下の項目について日本語で分析し、JSONのみ返してください（マークダウン不要）:\n{"shopName":"ショップ名","monthlySales":"月間販売数・売上の分析と推測（入力されたsold数・価格帯から計算）","revenueEstimate":"月間売上予測（例: 約₱50,000〜80,000）","pricing":"価格帯・値付け戦略の分析（200字程度）","lineup":"商品ラインナップ・カテゴリ構成の分析（200字程度）","seo":"タイトル・SEOキーワード戦略の分析（200字程度）","reviews":"レビュー・評価傾向の分析（200字程度）","swot":"強み・弱み・差別化ポイント（200字程度）","suggestions":"自社への具体的な改善提案（200字程度）","summary":"総合評価（100字程度）"}`

    const analysisRes = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: analysisPrompt }]
    })

    const rawText = analysisRes.content?.filter(c => c.type === "text").map(c => c.text).join("") || "{}"
    const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed = JSON.parse(cleaned)

    res.json({ success: true, analysis: parsed })
  } catch(e) {
    console.error("analyzeCompetitor error:", e)
    res.status(500).json({ error: e.message })
  }
})
