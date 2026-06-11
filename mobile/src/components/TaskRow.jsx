import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { PRIO } from '../utils/constants';
import { useTheme } from '../theme';

function TaskRow({ task, onToggle, onPress, onDelete, onMoveNext }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const prio = PRIO[task.priority] || PRIO.none;
  const hasPrio = task.priority !== 'none';
  const subtaskTotal = task.subtasks?.length || 0;
  const subtaskDone = task.subtasks?.filter(s => s.done).length || 0;

  const renderRightActions = () => (
    <TouchableOpacity style={[styles.action, { backgroundColor: theme.danger }]} onPress={onDelete} activeOpacity={0.85}>
      <Text style={styles.actionIcon}>✕</Text>
      <Text style={styles.actionText}>Delete</Text>
    </TouchableOpacity>
  );
  const renderLeftActions = () => (
    <TouchableOpacity style={[styles.action, { backgroundColor: theme.textSec }]} onPress={onMoveNext} activeOpacity={0.85}>
      <Text style={styles.actionIcon}>→</Text>
      <Text style={styles.actionText}>+1 Day</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}
      overshootLeft={false} overshootRight={false} friction={2} leftThreshold={60} rightThreshold={60}>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
        <View style={styles.body}>
          <View style={[styles.titleWrap, hasPrio && !task.done && { backgroundColor: prio.color }]}>
            <Text style={[styles.title, task.done && styles.titleDone, hasPrio && !task.done && styles.titleOnChip]} numberOfLines={2}>
              {task.title || '(No title)'}
            </Text>
          </View>
          {subtaskTotal > 0 && <Text style={styles.sub}>{subtaskDone}/{subtaskTotal} subtasks</Text>}
        </View>
        <TouchableOpacity onPress={onToggle} style={styles.checkWrap} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <View style={[styles.check, task.done && styles.checkDone]}>
            {task.done && <Text style={styles.checkMark}>✓</Text>}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Swipeable>
  );
}

export default memo(TaskRow);

const createStyles = (theme) => StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 14, minHeight: 38,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
    backgroundColor: theme.surface, gap: 12,
  },
  checkWrap: { padding: 2 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: theme.borderEm, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: theme.ink, borderColor: theme.ink },
  checkMark: { color: theme.surface, fontSize: 12, fontWeight: '800', lineHeight: 14 },
  body: { flex: 1, gap: 3 },
  titleWrap: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  title: { fontSize: theme.font.md, color: theme.text, fontWeight: '500', lineHeight: 21 },
  titleOnChip: { color: '#fff', fontWeight: '600' },
  titleDone: { color: theme.textTer, fontWeight: '400', textDecorationLine: 'line-through' },
  sub: { fontSize: theme.font.xs, color: theme.textTer, paddingLeft: 10 },
  action: { justifyContent: 'center', alignItems: 'center', width: 88, gap: 3 },
  actionIcon: { color: '#fff', fontSize: 16, lineHeight: 18 },
  actionText: { color: '#fff', fontSize: theme.font.xs, fontWeight: '700' },
});
