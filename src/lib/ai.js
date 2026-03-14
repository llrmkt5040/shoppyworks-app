// ── AI共通ヘルパー ──
// APIキーをFirestore経由で管理（オーナー⇔スタッフ共有）
import { db, auth } from "./firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"

const FALLBACK_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || ""

// オーナーUID取得（スタッフの場合はオーナーのUID）
async function getOwnerUid(uid) {
  // AppLayoutがlocalStorageにオーナーUIDを保存している
  const ownerFromStorage = localStorage.getItem("sw_owner_uid")
  if (ownerFromStorage) return ownerFromStorage
  return uid || auth.currentUser?.uid
}

// AIキーを取得（Firestore優先 → localStorage → env）
export async function getAiKey(uid) {
  try {
    const ownerUid = await getOwnerUid(uid)
    const snap = await getDoc(doc(db, "user_settings", ownerUid))
    if (snap.exists()) {
      const data = snap.data()
      // AI機能がOFFならnull返却
      if (data.ai_enabled === false) return null
      if (data.ai_key) return data.ai_key
    }
  } catch(e) { console.error("AIキー取得エラー:", e) }
  // フォールバック
  return localStorage.getItem("sw_anthropic_key") || FALLBACK_KEY || null
}

// AIキーをFirestoreに保存（オーナーのみ）
export async function saveAiKey(key) {
  const uid = auth.currentUser?.uid
  if (!uid) return
  await setDoc(doc(db, "user_settings", uid), {
    ai_key: key || "",
    ai_enabled: !!key,
  }, { merge: true })
  // localStorageにもバックアップ
  if (key) localStorage.setItem("sw_anthropic_key", key)
  else localStorage.removeItem("sw_anthropic_key")
}

// AI ON/OFFを切り替え（オーナーのみ）
export async function setAiEnabled(enabled) {
  const uid = auth.currentUser?.uid
  if (!uid) return
  await setDoc(doc(db, "user_settings", uid), {
    ai_enabled: enabled,
  }, { merge: true })
}

// AI API呼び出し共通関数
export async function callClaude(messages, uid, { maxTokens = 1500, model = "claude-sonnet-4-20250514" } = {}) {
  const key = await getAiKey(uid)
  if (!key) throw new Error("AI機能が無効です。オーナーが設定→システムタブでAPIキーを登録してください。")
  
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || "AI APIエラー")
  return data.content?.[0]?.text || ""
}
