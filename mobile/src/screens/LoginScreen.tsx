import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { ShieldCheck, Mail, KeyRound, Globe, ArrowRight, CheckCircle2 } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl, setApiBaseUrl, DEFAULT_API_BASE, LOCAL_DEV_API_BASE } from '../config';

WebBrowser.maybeCompleteAuthSession();

export const LoginScreen: React.FC = () => {
  const { requestOtp, verifyOtp, loginWithSsoCode } = useAuth();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(DEFAULT_API_BASE);

  // 1. Microsoft SSO Flow
  const handleMicrosoftSso = async () => {
    try {
      setLoading(true);
      const apiBase = await getApiBaseUrl();
      const ssoUrl = `${apiBase}/auth/microsoft`;
      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'hsemobile' });

      const result = await WebBrowser.openAuthSessionAsync(
        `${ssoUrl}?redirect_uri=${encodeURIComponent(redirectUri)}`,
        redirectUri
      );

      if (result.type === 'success' && result.url) {
        // Parse code from redirect url
        const match = result.url.match(/code=([^&]+)/);
        if (match && match[1]) {
          await loginWithSsoCode(decodeURIComponent(match[1]));
          return;
        }
      }
    } catch (e: any) {
      Alert.alert('خطأ في تسجيل الدخول عبر SSO', e.message || 'تعذر الاتصال بخادم مايكروسوفت');
    } finally {
      setLoading(false);
    }
  };

  // 2. Request Email OTP
  const handleRequestOtp = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('تنبيه', 'يرجى إدخال بريد إلكتروني صحيح');
      return;
    }
    try {
      setLoading(true);
      await requestOtp(email.trim().toLowerCase());
      setOtpSent(true);
      Alert.alert('تم إرسال الرمز', 'تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح.');
    } catch (e: any) {
      const msg = e.response?.data?.message || 'تعذر إرسال رمز التحقق. يرجى التأكد من البريد';
      Alert.alert('خطأ', msg);
    } finally {
      setLoading(false);
    }
  };

  // 3. Verify OTP
  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال رمز التحقق');
      return;
    }
    try {
      setLoading(true);
      await verifyOtp(email.trim().toLowerCase(), otp.trim());
    } catch (e: any) {
      const msg = e.response?.data?.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية';
      Alert.alert('خطأ في التحقق', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveServerUrl = async (url: string) => {
    await setApiBaseUrl(url);
    setCustomServerUrl(url);
    setShowServerConfig(false);
    Alert.alert('تم الحفظ', `تم تغيير رابط السيرفر إلى:\n${url}`);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#090d16" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header Branding */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <ShieldCheck size={38} color="#38bdf8" />
          </View>
          <Text style={styles.title}>HSE Incident System</Text>
          <Text style={styles.subtitle}>تطبيق رصد ومتابعة بلاغات السلامة والأمن</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>خاص بالموظفين والمُبلّغين (Reporter App)</Text>
          </View>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          {/* Microsoft SSO Primary Button */}
          <TouchableOpacity
            style={[styles.ssoButton, loading && styles.buttonDisabled]}
            onPress={handleMicrosoftSso}
            disabled={loading}
            activeOpacity={0.8}
          >
            <View style={styles.msLogo}>
              <View style={[styles.msTile, { backgroundColor: '#f25022' }]} />
              <View style={[styles.msTile, { backgroundColor: '#7fba00' }]} />
              <View style={[styles.msTile, { backgroundColor: '#00a4ef' }]} />
              <View style={[styles.msTile, { backgroundColor: '#ffb900' }]} />
            </View>
            <Text style={styles.ssoButtonText}>الدخول بحساب الشركة (Microsoft SSO)</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>أو الدخول برمز التحقق (OTP)</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>البريد الإلكتروني:</Text>
            <View style={styles.inputWrapper}>
              <Mail size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="name@saudimotorsport.com"
                placeholderTextColor="#64748b"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!otpSent}
              />
            </View>
          </View>

          {/* If OTP Sent, Show OTP Input */}
          {otpSent ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>رمز التحقق (OTP):</Text>
                <View style={styles.inputWrapper}>
                  <KeyRound size={18} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="أدخل رمز الـ 6 أرقام"
                    placeholderTextColor="#64748b"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>تأكيد الدخول</Text>
                    <CheckCircle2 size={18} color="#ffffff" />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setOtpSent(false);
                  setOtp('');
                }}
                style={styles.secondaryLink}
              >
                <Text style={styles.secondaryLinkText}>تغيير البريد الإلكتروني</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleRequestOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>إرسال رمز التحقق</Text>
                  <ArrowRight size={18} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Server Connection Switcher (For local LAN vs UAT Cloud) */}
        <TouchableOpacity
          style={styles.serverToggle}
          onPress={() => setShowServerConfig(!showServerConfig)}
        >
          <Globe size={14} color="#64748b" />
          <Text style={styles.serverToggleText}>إعدادات خادم الاتصال (API Server)</Text>
        </TouchableOpacity>

        {showServerConfig && (
          <View style={styles.serverConfigCard}>
            <Text style={styles.serverConfigTitle}>اختر السيرفر المستهدف:</Text>
            <TouchableOpacity
              style={styles.serverOption}
              onPress={() => handleSaveServerUrl(DEFAULT_API_BASE)}
            >
              <Text style={styles.serverOptionText}>🌐 سحابة UAT (الرسمي):</Text>
              <Text style={styles.serverOptionUrl}>{DEFAULT_API_BASE}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.serverOption}
              onPress={() => handleSaveServerUrl(LOCAL_DEV_API_BASE)}
            >
              <Text style={styles.serverOptionText}>💻 السيرفر المحلي (Local LAN):</Text>
              <Text style={styles.serverOptionUrl}>{LOCAL_DEV_API_BASE}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  badge: {
    marginTop: 10,
    backgroundColor: '#0369a1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e0f2fe',
  },
  card: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  ssoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
  },
  msLogo: {
    width: 18,
    height: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  msTile: {
    width: 8,
    height: 8,
  },
  ssoButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1e293b',
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'right',
  },
  inputWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginLeft: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'right',
  },
  primaryButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  secondaryLink: {
    marginTop: 14,
    alignItems: 'center',
  },
  secondaryLinkText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  serverToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    padding: 8,
  },
  serverToggleText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  serverConfigCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
  },
  serverConfigTitle: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'right',
  },
  serverOption: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  serverOptionText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  serverOptionUrl: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    textAlign: 'left',
  },
});
