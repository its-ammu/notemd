import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { addDays, fmtDate } from '../utils/time';
import { useTheme, useThemeControl } from '../theme';
import TaskRow from './TaskRow';
import MeetingRow from './MeetingRow';
import AddTaskRow from './AddTaskRow';

const ACCENT = '#5167F4';

export default function DaySection({
  date, dateKey, isToday, isPast,
  tasks, meetings,
  onAddTask, onUpdateTask, onDeleteTask, onMoveTask,
  onEditTask, onEditMeeting, onAddMeeting,
  onLayout,
}) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { showMeetings } = useThemeControl();
  const dayNum = date.getDate();
  const monthLabel = date.toLocaleDateString(undefined, { month: 'short' });
  const weekdayLabel = date.toLocaleDateString(undefined, { weekday: 'long' });
  const nextDateKey = fmtDate(addDays(date, 1));
  const tasksDone = tasks.filter(t => t.done).length;

  return (
    <View style={styles.section} onLayout={onLayout}>
      <View style={[styles.header, isToday && styles.headerToday]}>
        {/* Date badge — number in circle (blue for today) */}
        <View style={[styles.numWrap, isToday && styles.numWrapToday]}>
          <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{dayNum}</Text>
        </View>

        {/* Month + weekday below */}
        <View style={styles.headerText}>
          <Text style={[styles.monthLabel, isToday && styles.monthLabelToday]}>{monthLabel}</Text>
          <Text style={[styles.weekday, isToday && styles.weekdayToday]}>{weekdayLabel}</Text>
        </View>

        {/* Day stats — right side */}
        {tasks.length > 0 && (
          <Text style={styles.progress}>{tasksDone}/{tasks.length} done</Text>
        )}

        {/* Add meeting button — hidden when meetings are toggled off */}
        {showMeetings && (
          <TouchableOpacity
            style={[styles.addMtgBtn, isToday && styles.addMtgBtnToday]}
            onPress={() => onAddMeeting(dateKey)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[styles.addMtgIcon, isToday && styles.addMtgIconToday]}>＋</Text>
            <Text style={[styles.addMtgLabel, isToday && styles.addMtgLabelToday]}>Mtg</Text>
          </TouchableOpacity>
        )}
      </View>

      {showMeetings && meetings.map(m => (
        <MeetingRow key={m.id} meeting={m} onPress={() => onEditMeeting(m, dateKey)} compact />
      ))}

      {tasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          onToggle={() => onUpdateTask(dateKey, task.id, { done: !task.done })}
          onPress={() => onEditTask(task, dateKey)}
          onDelete={() => onDeleteTask(dateKey, task.id)}
          onMoveNext={() => onMoveTask(task.id, nextDateKey)}
        />
      ))}

      <AddTaskRow onSubmit={(title) => onAddTask(dateKey, title)} />
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  section: { marginBottom: 4, backgroundColor: theme.surface },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12,
    borderTopWidth: 2, borderTopColor: theme.border,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    gap: 10,
  },
  headerToday: { borderTopColor: ACCENT, borderTopWidth: 2 },

  numWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  numWrapToday: { backgroundColor: ACCENT },
  dayNum: { fontSize: theme.font.xl, fontWeight: '900', color: theme.ink, lineHeight: 26 },
  dayNumToday: { color: '#fff' },

  headerText: { flex: 1 },
  monthLabel: { fontSize: theme.font.lg, fontWeight: '800', color: theme.ink },
  monthLabelToday: { color: ACCENT },
  weekday: { fontSize: theme.font.xs, fontWeight: '500', color: theme.textTer, marginTop: 1 },
  weekdayToday: { color: theme.textSec },
  progress: { fontSize: theme.font.xs, color: theme.textTer, fontWeight: '600' },

  addMtgBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.surfaceAlt,
    minWidth: 64,
    justifyContent: 'center',
  },
  addMtgBtnToday: { borderColor: theme.borderEm, backgroundColor: theme.surfaceEm },
  addMtgIcon: { fontSize: 13, color: theme.textSec, fontWeight: '600', lineHeight: 16 },
  addMtgIconToday: { color: theme.ink },
  addMtgLabel: { fontSize: theme.font.xs, color: theme.textSec, fontWeight: '600' },
  addMtgLabelToday: { color: theme.ink },
});
