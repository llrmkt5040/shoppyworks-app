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
