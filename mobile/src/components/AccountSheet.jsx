import React, { useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useTheme, useThemeControl } from '../theme';

const SNAP_POINTS = ['62%'];

export default function AccountSheet({ visible, user, onClose, onSignOut }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { themeId, switchTheme, showMeetings, setShowMeetings } = useThemeControl();
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => SNAP_POINTS, []);

  React.useEffect(() => {
    if (visible) setTimeout(() => sheetRef.current?.snapToIndex(0), 50);
    else sheetRef.current?.close();
  }, [visible]);

  const renderBackdrop = useCallback(props => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.35} pressBehavior="close" />
  ), []);

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: onSignOut },
    ]);
  };

  const initial = user?.email?.[0]?.toUpperCase() || '?';

  if (!visible) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onClose={onClose}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {/* Account */}
        <View style={styles.account}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountLabel}>Signed in as</Text>
            <Text style={styles.email} numberOfLines={1}>{user?.email || ''}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Theme */}
        <Text style={styles.sectionLabel}>Theme</Text>
        <View style={styles.themeRow}>
          {[
            { id: 'paper', label: 'Paper', desc: 'Warm cream' },
            { id: 'dark',  label: 'Dark',  desc: 'Night mode' },
          ].map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.themeChip, themeId === t.id && styles.themeChipActive]}
              onPress={() => switchTheme(t.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.themeLabel, themeId === t.id && styles.themeLabelActive]}>{t.label}</Text>
              <Text style={styles.themeDesc}>{t.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.divider} />

        {/* View settings */}
        <Text style={styles.sectionLabel}>View</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Show meetings</Text>
            <Text style={styles.settingDesc}>Display meetings in each day</Text>
          </View>
          <Switch
            value={showMeetings}
            onValueChange={setShowMeetings}
            trackColor={{ false: theme.borderEm, true: theme.ink }}
            thumbColor={theme.surface}
          />
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.signOutBtn} onPress={confirmSignOut} activeOpacity={0.7}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const createStyles = (theme) => StyleSheet.create({
  sheetBg: { backgroundColor: theme.surface },
  handle: { backgroundColor: theme.border, width: 36 },
  content: { padding: 20, paddingBottom: 36, backgroundColor: theme.surface },
  account: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: theme.surface, fontSize: theme.font.lg, fontWeight: '700' },
  accountInfo: { flex: 1 },
  accountLabel: { fontSize: theme.font.xs, color: theme.textTer, marginBottom: 2 },
  email: { fontSize: theme.font.sm, color: theme.text, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginVertical: 16 },
  sectionLabel: { fontSize: theme.font.xs, fontWeight: '700', color: theme.textTer, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  themeRow: { flexDirection: 'row', gap: 10 },
  themeChip: { flex: 1, padding: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceAlt },
  themeChipActive: { borderColor: theme.ink, borderWidth: 2, backgroundColor: theme.surface },
  themeLabel: { fontSize: theme.font.sm, fontWeight: '600', color: theme.textSec, marginBottom: 2 },
  themeLabelActive: { color: theme.ink },
  themeDesc: { fontSize: theme.font.xs, color: theme.textTer },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 6,
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: theme.font.md, color: theme.text, fontWeight: '500' },
  settingDesc: { fontSize: theme.font.xs, color: theme.textTer, marginTop: 1 },

  signOutBtn: { paddingVertical: 13, alignItems: 'center', borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.danger },
  signOutText: { fontSize: theme.font.md, color: theme.danger, fontWeight: '600' },
});
