import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { randomUUID } from 'expo-crypto';
import { addDays, fmtDate } from '../utils/time';
import { PRIO } from '../utils/constants';
import { useTheme } from '../theme';

const SNAP_POINTS = ['55%', '90%'];
const PRIO_KEYS = ['none', 'low', 'med', 'high'];

export default function TaskSheet({ task, dateKey, onClose, onUpdate, onDelete, onMove }) {
  const theme = useTheme();
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => SNAP_POINTS, []);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('none');
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [showMovePanel, setShowMovePanel] = useState(false);

  // Sync local state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setPriority(task.priority || 'none');
      setSubtasks(task.subtasks || []);
      setNewSubtask('');
      setShowMovePanel(false);
      setTimeout(() => sheetRef.current?.snapToIndex(0), 50);
    } else {
      sheetRef.current?.close();
    }
  }, [task?.id]);

  // Flush title change to parent on blur
  const commitTitle = useCallback(() => {
    if (task && title !== task.title) onUpdate({ title });
  }, [task, title, onUpdate]);

  const handlePriority = useCallback((p) => {
    setPriority(p);
    onUpdate({ priority: p });
  }, [onUpdate]);

  const addSubtask = useCallback(() => {
    const text = newSubtask.trim();
    if (!text) return;
    const updated = [...subtasks, { id: randomUUID(), text, done: false }];
    setSubtasks(updated);
    setNewSubtask('');
    onUpdate({ subtasks: updated });
  }, [newSubtask, subtasks, onUpdate]);

  const toggleSubtask = useCallback((id) => {
    const updated = subtasks.map(s => s.id === id ? { ...s, done: !s.done } : s);
    setSubtasks(updated);
    onUpdate({ subtasks: updated });
  }, [subtasks, onUpdate]);

  const removeSubtask = useCallback((id) => {
    const updated = subtasks.filter(s => s.id !== id);
    setSubtasks(updated);
    onUpdate({ subtasks: updated });
  }, [subtasks, onUpdate]);

  const handleMove = useCallback((days) => {
    if (!dateKey) return;
    const to = fmtDate(addDays(new Date(dateKey + 'T00:00:00'), days));
    onMove(to);
  }, [dateKey, onMove]);

  const confirmDelete = useCallback(() => {
    Alert.alert('Delete task?', task?.title || '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  }, [task, onDelete]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

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

  // Move panel: next 14 days
  const moveDays = useMemo(() => {
    if (!dateKey) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(new Date(dateKey + 'T00:00:00'), i + 1);
      return {
        key: fmtDate(d),
        label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        days: i + 1,
      };
    });
  }, [dateKey]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!task) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onClose={handleClose}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <BottomSheetTextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          onBlur={commitTitle}
          multiline
          placeholder="Task title"
          placeholderTextColor={theme.textTer}
          returnKeyType="done"
          blurOnSubmit
        />

        {/* Priority */}
        <Text style={styles.label}>Priority</Text>
        <View style={styles.segmented}>
          {PRIO_KEYS.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.segment, priority === p && { backgroundColor: PRIO[p].color }]}
              onPress={() => handlePriority(p)}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, priority === p && styles.segmentTextActive]}>
                {PRIO[p].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Subtasks */}
        <Text style={styles.label}>Subtasks</Text>
        {subtasks.map(s => (
          <View key={s.id} style={styles.subtaskRow}>
            <TouchableOpacity onPress={() => toggleSubtask(s.id)} style={styles.stCheck}>
              <View style={[styles.stBox, s.done && styles.stBoxDone]}>
                {s.done && <Text style={styles.stMark}>✓</Text>}
              </View>
            </TouchableOpacity>
            <Text style={[styles.stTitle, s.done && styles.stTitleDone]}>{s.text ?? s.title}</Text>
            <TouchableOpacity onPress={() => removeSubtask(s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.stRemove}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.addSubtaskRow}>
          <TextInput
            style={styles.subtaskInput}
            value={newSubtask}
            onChangeText={setNewSubtask}
            placeholder="Add subtask…"
            placeholderTextColor={theme.textTer}
            onSubmitEditing={addSubtask}
            returnKeyType="done"
            blurOnSubmit={false}
          />
          <TouchableOpacity onPress={addSubtask} style={styles.addSubtaskBtn} disabled={!newSubtask.trim()}>
            <Text style={[styles.addSubtaskBtnText, !newSubtask.trim() && styles.addSubtaskBtnDisabled]}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Quick move */}
        <Text style={styles.label}>Move to</Text>
        <View style={styles.moveRow}>
          <TouchableOpacity style={styles.moveBtn} onPress={() => handleMove(1)}>
            <Text style={styles.moveBtnText}>+1 Day</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moveBtn} onPress={() => handleMove(7)}>
            <Text style={styles.moveBtnText}>+1 Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.moveBtn, showMovePanel && styles.moveBtnActive]}
            onPress={() => setShowMovePanel(v => !v)}
          >
            <Text style={[styles.moveBtnText, showMovePanel && styles.moveBtnTextActive]}>Pick date</Text>
          </TouchableOpacity>
        </View>

        {showMovePanel && (
          <View style={styles.movePicker}>
            {moveDays.map(({ key, label, days }) => (
              <TouchableOpacity
                key={key}
                style={styles.movePickerItem}
                onPress={() => handleMove(days)}
              >
                <Text style={styles.movePickerText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Delete */}
        <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete}>
          <Text style={styles.deleteBtnText}>Delete task</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const createStyles = (theme) => StyleSheet.create({
  sheetBg: { backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle: { backgroundColor: theme.border, width: 36 },
  content: { padding: 20, paddingBottom: 48, backgroundColor: theme.surface },

  titleInput: {
    fontSize: theme.font.xl,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 20,
    lineHeight: 26,
  },

  label: {
    fontSize: theme.font.xs,
    fontWeight: '700',
    color: theme.textTer,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 16,
  },

  segmented: {
    flexDirection: 'row',
    backgroundColor: theme.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: theme.radius.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  segmentText: { fontSize: theme.font.sm, color: theme.textSec, fontWeight: '600' },
  segmentTextActive: { color: '#fff', fontWeight: '700' },

  subtaskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, minHeight: 46,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  stCheck: { padding: 2 },
  stBox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: theme.border, alignItems: 'center', justifyContent: 'center',
  },
  stBoxDone: { backgroundColor: theme.ink, borderColor: theme.ink },
  stMark: { color: theme.surface, fontSize: 11, fontWeight: '700', lineHeight: 13 },
  stTitle: { flex: 1, fontSize: theme.font.md, color: theme.text, fontWeight: '400' },
  stTitleDone: { color: theme.textTer, textDecorationLine: 'line-through' },
  stRemove: { fontSize: 18, color: theme.textTer, paddingHorizontal: 4, paddingVertical: 2 },

  addSubtaskRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  subtaskInput: {
    flex: 1, height: 44,
    borderWidth: 1, borderColor: theme.border, borderRadius: theme.radius.sm,
    paddingHorizontal: 12, fontSize: theme.font.md, color: theme.text,
    backgroundColor: theme.bg, textAlignVertical: 'center',
  },
  addSubtaskBtn: {
    height: 44, paddingHorizontal: 18,
    backgroundColor: theme.ink, borderRadius: theme.radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  addSubtaskBtnText: { fontSize: theme.font.sm, color: theme.surface, fontWeight: '700' },
  addSubtaskBtnDisabled: { opacity: 0.4 },

  moveRow: { flexDirection: 'row', gap: 8 },
  moveBtn: {
    flex: 1, height: 44,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.surfaceAlt,
    borderRadius: theme.radius.sm,
    borderWidth: 1, borderColor: theme.border,
  },
  moveBtnActive: { backgroundColor: theme.ink, borderColor: theme.ink },
  moveBtnText: { fontSize: theme.font.sm, color: theme.textSec, fontWeight: '600' },
  moveBtnTextActive: { color: theme.surface },

  movePicker: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  movePickerItem: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  movePickerText: { fontSize: theme.font.sm, color: theme.text },

  deleteBtn: {
    marginTop: 28,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.danger,
  },
  deleteBtnText: { fontSize: theme.font.md, color: theme.danger, fontWeight: '600' },
});
