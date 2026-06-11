import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useTheme } from '../theme';

const SNAP_POINTS = ['60%', '90%'];
const DURATION_OPTIONS = [
  { label: '15m', value: '15' },
  { label: '30m', value: '30' },
  { label: '45m', value: '45' },
  { label: '1h',  value: '60' },
  { label: '90m', value: '90' },
  { label: '2h',  value: '120' },
];
const REPEAT_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
];

export default function MeetingSheet({
  meeting, dateKey, isNew, onClose, onSave, onDelete, onDeleteOccurrence, onDeleteFuture,
}) {
  const theme = useTheme();
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => SNAP_POINTS, []);

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('30');
  const [repeat, setRepeat] = useState('none');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const visible = isNew || meeting;
    if (visible) {
      if (isNew) {
        setTitle(''); setTime(''); setDuration('30'); setRepeat('none'); setNotes('');
      } else if (meeting) {
        setTitle(meeting.title || '');
        setTime(meeting.time || '');
        setDuration(String(meeting.duration ?? 30));
        setRepeat(meeting.repeat || 'none');
        setNotes(meeting.notes || '');
      }
      setTimeout(() => sheetRef.current?.snapToIndex(0), 50);
    } else {
      sheetRef.current?.close();
    }
  }, [isNew, meeting?.id]);

  const handleTimeChange = useCallback((input) => {
    const digits = input.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) { setTime(digits); return; }
    setTime(digits.slice(0, 2) + ':' + digits.slice(2));
  }, []);

  const handleSave = useCallback(() => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), time, duration, repeat, notes });
  }, [title, time, duration, repeat, notes, onSave]);

  const handleDelete = useCallback(() => {
    if (!meeting) return;
    const isRecurring = meeting._recurring || (meeting.repeat && meeting.repeat !== 'none');

    if (isRecurring) {
      Alert.alert('Delete recurring meeting', 'Which events would you like to remove?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'This only', onPress: onDeleteOccurrence },
        { text: 'This and future', onPress: onDeleteFuture },
        { text: 'All events', style: 'destructive', onPress: onDelete },
      ]);
    } else {
      Alert.alert('Delete meeting?', meeting.title || '', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]);
    }
  }, [meeting, onDelete, onDeleteOccurrence, onDeleteFuture]);

  const renderBackdrop = useCallback(
    props => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  );

  const styles = useMemo(() => createStyles(theme), [theme]);
  const visible = isNew || !!meeting;
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
      <BottomSheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sheetTitle}>{isNew ? 'New Meeting' : 'Edit Meeting'}</Text>

        {/* Title */}
        <Text style={styles.label}>Title</Text>
        <BottomSheetTextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Meeting title"
          placeholderTextColor={theme.textTer}
          returnKeyType="next"
        />

        {/* Time */}
        <Text style={styles.label}>Time</Text>
        <BottomSheetTextInput
          style={styles.input}
          value={time}
          onChangeText={handleTimeChange}
          placeholder="09:00"
          placeholderTextColor={theme.textTer}
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={5}
        />

        {/* Duration */}
        <Text style={styles.label}>Duration</Text>
        <View style={styles.chipRow}>
          {DURATION_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, duration === opt.value && styles.chipActive]}
              onPress={() => setDuration(opt.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, duration === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Repeat */}
        <Text style={styles.label}>Repeat</Text>
        <View style={styles.segmented}>
          {REPEAT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.segment, repeat === opt.value && styles.segmentActive]}
              onPress={() => setRepeat(opt.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, repeat === opt.value && styles.segmentTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Notes */}
        <Text style={styles.label}>Notes</Text>
        <BottomSheetTextInput
          style={[styles.input, styles.inputMulti]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add notes…"
          placeholderTextColor={theme.textTer}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Actions */}
        <TouchableOpacity
          style={[styles.saveBtn, !title.trim() && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!title.trim()}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>{isNew ? 'Add Meeting' : 'Save Changes'}</Text>
        </TouchableOpacity>

        {!isNew && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Delete meeting…</Text>
          </TouchableOpacity>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const createStyles = (theme) => StyleSheet.create({
  sheetBg: { backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle: { backgroundColor: theme.border, width: 36 },
  content: { padding: 20, paddingBottom: 48, backgroundColor: theme.surface },
  sheetTitle: { fontSize: theme.font.xl, fontWeight: '700', color: theme.text, marginBottom: 16 },

  label: {
    fontSize: theme.font.xs,
    fontWeight: '700',
    color: theme.textTer,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 14,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  chipActive: {
    backgroundColor: theme.ink,
    borderColor: theme.ink,
  },
  chipText: {
    fontSize: theme.font.sm,
    color: theme.textSec,
    fontWeight: '500',
  },
  chipTextActive: {
    color: theme.surface,
    fontWeight: '700',
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    fontSize: theme.font.md,
    color: theme.text,
    backgroundColor: theme.bg,
    textAlignVertical: 'center',
  },
  inputMulti: { height: undefined, minHeight: 70, textAlignVertical: 'top', paddingVertical: 10 },

  segmented: {
    flexDirection: 'row',
    backgroundColor: theme.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: theme.radius.sm,
  },
  segmentActive: { backgroundColor: theme.ink },
  segmentText: { fontSize: theme.font.xs, color: theme.textSec, fontWeight: '500' },
  segmentTextActive: { color: theme.surface, fontWeight: '700' },

  saveBtn: {
    marginTop: 24,
    backgroundColor: theme.ink,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: theme.font.md, color: '#fff', fontWeight: '600' },

  deleteBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.danger,
  },
  deleteBtnText: { fontSize: theme.font.md, color: theme.danger, fontWeight: '500' },
});
