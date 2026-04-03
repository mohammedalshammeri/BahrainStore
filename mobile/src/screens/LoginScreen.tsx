// ─── Login Screen ─────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/auth.store'
import { COLORS, FONTS } from '@/constants'

export default function LoginScreen() {
  const router = useRouter()
  const { login } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال البريد الإلكتروني وكلمة المرور')
      return
    }
    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
      router.replace('/(tabs)/dashboard')
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      Alert.alert('خطأ في تسجيل الدخول', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>B</Text>
          </View>
          <Text style={styles.brandName}>بازار</Text>
          <Text style={styles.brandSub}>لوحة التحكم</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>البريد الإلكتروني</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="merchant@store.com"
            placeholderTextColor={COLORS.gray400}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textAlign="left"
          />

          <Text style={styles.label}>كلمة المرور</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.gray400}
              secureTextEntry={!showPass}
              textAlign="left"
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showPass ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.loginBtnText}>تسجيل الدخول</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>© 2026 Bazar — BSMC.BH</Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoBox: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoText: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
  brandName: { fontSize: 28, fontWeight: 'bold', color: COLORS.secondary, marginBottom: 4 },
  brandSub: { fontSize: 14, color: COLORS.textSecondary },
  form: { backgroundColor: COLORS.card, borderRadius: 16, padding: 24, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8, textAlign: 'right' },
  input: {
    backgroundColor: COLORS.gray50,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.text, marginBottom: 16,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 8 },
  eyeBtn: { padding: 12, backgroundColor: COLORS.gray50, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  eyeText: { fontSize: 18 },
  loginBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  footer: { textAlign: 'center', color: COLORS.textLight, fontSize: 12 },
})
