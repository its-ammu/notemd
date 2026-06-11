import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../theme';

export default function AuthScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    const e = email.trim();
    if (!e || !password) { setError('Email and password are required.'); return; }
    setError('');
    setLoading(true);
    try {
      const { error: authErr } = await (mode === 'signin' ? signIn : signUp)(e, password);
      if (authErr) setError(authErr.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            {/* Logo mark */}
            <View style={styles.logoRow}>
              <View style={styles.logoMark}>
                <Text style={styles.logoMarkText}>m</Text>
                <View style={styles.logoMarkBar} />
              </View>
              <View>
                <Text style={styles.logoText}>NoteMD</Text>
                <View style={styles.logoUnderline} />
              </View>
            </View>
            <Text style={styles.sub}>Weekly Tracker</Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={theme.textTer}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={theme.textTer}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              onSubmitEditing={handle}
              returnKeyType="done"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.btn} onPress={handle} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color={theme.surface} />
                : <Text style={styles.btnLabel}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); }}>
              <Text style={styles.toggle}>
                {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: theme.surface, borderRadius: theme.radius.xl, padding: 28, borderWidth: 1, borderColor: theme.border },

  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 },
  logoMark: { alignItems: 'center' },
  logoMarkText: { fontSize: 20, fontWeight: '700', color: theme.ink, lineHeight: 22 },
  logoMarkBar: { width: 14, height: 2, borderRadius: 1, backgroundColor: '#5167F4', marginTop: 1 },
  logoText: { fontSize: 17, fontWeight: '600', color: theme.ink, letterSpacing: -0.2 },
  logoUnderline: { position: 'absolute', bottom: -2, left: 0, width: 38, height: 2, borderRadius: 1, backgroundColor: '#5167F4' },

  sub: { fontSize: theme.font.sm, color: theme.textSec, textAlign: 'center', marginBottom: 24 },
  input: {
    height: 46, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radius.md,
    paddingHorizontal: 14, fontSize: theme.font.md, color: theme.text,
    backgroundColor: theme.bg, marginBottom: 12, textAlignVertical: 'center',
  },
  error: { color: theme.danger, fontSize: theme.font.sm, marginBottom: 10, textAlign: 'center' },
  btn: { backgroundColor: theme.ink, borderRadius: theme.radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 4, marginBottom: 16 },
  btnLabel: { color: theme.surface, fontSize: theme.font.md, fontWeight: '700', letterSpacing: 0.3 },
  toggle: { color: theme.textSec, fontSize: theme.font.sm, textAlign: 'center', textDecorationLine: 'underline' },
});
