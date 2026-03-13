import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, provider } from '../lib/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [profile, setProfile]     = useState(null)
  const [allowData, setAllowData] = useState(null)  // allowed_emailsのデータ
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async fbUser => {
      if (!fbUser) { setUser(null); setProfile(null); setAllowData(null); setLoading(false); return }
      try {
        const allowRef  = doc(db, 'allowed_emails', fbUser.email)
        const allowSnap = await getDoc(allowRef)

        // allowed_emailsにない場合、staff_emailsに登録されているか確認
        if (!allowSnap.exists()) {
          const { collection, getDocs } = await import('firebase/firestore')
          const allSettings = await getDocs(collection(db, 'user_settings'))
          let isStaff = false
          for (const docSnap of allSettings.docs) {
            const emails = (docSnap.data().staff_emails || []).map(e => e.toLowerCase())
            if (emails.includes(fbUser.email?.toLowerCase())) {
              isStaff = true; break
            }
          }
          if (!isStaff) {
            await fbSignOut(auth)
            setError('このアカウントはBootcampに登録されていません。')
            setLoading(false); return
          }
          const profileData = { uid: fbUser.uid, email: fbUser.email, name: fbUser.displayName || '', role: 'staff', createdAt: new Date().toISOString() }
          setUser(fbUser); setProfile(profileData); setAllowData(null); setError(null)
          setLoading(false); return
        }

        const aData = allowSnap.data()

        const userRef  = doc(db, 'users', fbUser.uid)
        const userSnap = await getDoc(userRef)
        let profileData
        if (!userSnap.exists()) {
          profileData = {
            uid: fbUser.uid,
            email: fbUser.email,
            name: aData.name || fbUser.displayName || '',
            role: aData.role || 'participant',
            cohort: aData.cohort || '',
            createdAt: new Date().toISOString()
          }
          await setDoc(userRef, profileData)
        } else {
          profileData = userSnap.data()
          // roleはallowed_emailsを正とする
          profileData = { ...profileData, role: aData.role || profileData.role || 'participant' }
        }

        // allowed_emailsにuidを保存（コクピット用）
        if (!aData.uid) {
          await setDoc(allowRef, { uid: fbUser.uid }, { merge: true })
        }

        setUser(fbUser)
        setProfile(profileData)
        setAllowData(aData)
        setError(null)
      } catch (err) { setError('認証エラー: ' + err.message) }
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn  = async () => { try { setError(null); await signInWithPopup(auth, provider) } catch (err) { if (err.code !== 'auth/popup-closed-by-user') setError('ログイン失敗: ' + err.message) } }
  const signOut = () => fbSignOut(auth)
  const isAdmin = profile?.role === 'admin'
  const isInstructor = profile?.role === 'instructor' || fbUser?.email?.toLowerCase() === 'tamaniha.hitoiki@gmail.com'

  return <AuthContext.Provider value={{ user, profile, allowData, loading, error, signIn, signOut, isAdmin, isInstructor }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
