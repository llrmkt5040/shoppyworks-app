import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, provider } from '../lib/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async fbUser => {
      if (!fbUser) { setUser(null); setProfile(null); setLoading(false); return }
      try {
        const allowRef  = doc(db, 'allowed_emails', fbUser.email)
        const allowSnap = await getDoc(allowRef)
        if (!allowSnap.exists()) {
          await fbSignOut(auth)
          setError('このアカウントはBootcampに登録されていません。')
          setLoading(false); return
        }
        const userRef  = doc(db, 'users', fbUser.uid)
        const userSnap = await getDoc(userRef)
        let profileData
        if (!userSnap.exists()) {
          profileData = { uid: fbUser.uid, email: fbUser.email, name: allowSnap.data().name || fbUser.displayName || '', role: 'participant', cohort: allowSnap.data().cohort || '', createdAt: new Date().toISOString() }
          await setDoc(userRef, profileData)
        } else {
          profileData = userSnap.data()
        }
        setUser(fbUser); setProfile(profileData); setError(null)
      } catch (err) { setError('認証エラー: ' + err.message) }
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn  = async () => { try { setError(null); await signInWithPopup(auth, provider) } catch (err) { if (err.code !== 'auth/popup-closed-by-user') setError('ログイン失敗: ' + err.message) } }
  const signOut = () => fbSignOut(auth)
  const isAdmin = profile?.role === 'admin'

  return <AuthContext.Provider value={{ user, profile, loading, error, signIn, signOut, isAdmin }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
