import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import { useCloudData } from '../hooks/useCloudData';
import { useAuth } from '../hooks/useAuth';
import { startOfWeek, addDays, fmtDate } from '../utils/time';
import { expandRecurringMeetings } from '../utils/meetings';
import { useTheme } from '../theme';
import DaySection from '../components/DaySection';
import TaskSheet from '../components/TaskSheet';
import MeetingSheet from '../components/MeetingSheet';
import AccountSheet from '../components/AccountSheet';
import CalendarSheet from '../components/CalendarSheet';

const getToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export default function TrackerScreen({ user }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { tasksByDate, setTasksByDate, meetingsByDate, setMeetingsByDate, loaded, error, saving } =
    useCloudData(user.id);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(getToday()));
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showAccount, setShowAccount] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const scrollRef = useRef(null);
  const dayOffsets = useRef({});
  const hasScrolled = useRef(false);

  const allDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const todayStr = fmtDate(getToday());
  const isCurrentWeek = allDays.some(d => fmtDate(d) === todayStr);

  const expandedMeetings = useMemo(
    () => expandRecurringMeetings(meetingsByDate, allDays),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meetingsByDate, allDays.map(d => fmtDate(d)).join(',')],
  );

  // Scroll to today when data first loads
  useEffect(() => {
    if (!loaded || hasScrolled.current) return;
    const offset = dayOffsets.current[todayStr];
    if (offset != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, offset - 12), animated: false });
      hasScrolled.current = true;
    }
  }, [loaded, todayStr]);

  // Reset scroll flag when week changes
  useEffect(() => { hasScrolled.current = false; }, [weekStart]);

  // ── Week label ────────────────────────────────────────────────────

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const s = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const e = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${s} – ${e}`;
  }, [weekStart]);

  // ── Stats ────────────────────────────────────────────────────────

  const weekTasks = allDays.flatMap(d => tasksByDate[fmtDate(d)] || []);
  const doneCount = weekTasks.filter(t => t.done).length;
  const totalCount = weekTasks.length;
  const highPrio = weekTasks.filter(t => t.priority === 'high' && !t.done).length;

  // ── Task operations ──────────────────────────────────────────────

  const updateTasks = useCallback((dateKey, fn) => {
    setTasksByDate(prev => {
      const next = fn(prev[dateKey] || []);
      if (next.length === 0) {
        const { [dateKey]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [dateKey]: next };
    });
  }, [setTasksByDate]);

  const addTask = useCallback((dateKey, title) => {
    const t = { id: randomUUID(), title, done: false, priority: 'none', subtasks: [], created: Date.now() };
    updateTasks(dateKey, tasks => [...tasks, t]);
  }, [updateTasks]);

  const updateTask = useCallback((dateKey, id, patch) => {
    updateTasks(dateKey, tasks => tasks.map(t => t.id === id ? { ...t, ...patch } : t));
  }, [updateTasks]);

  const deleteTask = useCallback((dateKey, id) => {
    updateTasks(dateKey, tasks => tasks.filter(t => t.id !== id));
  }, [updateTasks]);

  const moveTask = useCallback((taskId, toDateKey) => {
    let task = null, fromKey = null;
    for (const [k, list] of Object.entries(tasksByDate)) {
      const f = list.find(t => t.id === taskId);
      if (f) { task = f; fromKey = k; break; }
    }
    if (!task || fromKey === toDateKey) return;
    setTasksByDate(prev => {
      const next = { ...prev };
      const fromList = (next[fromKey] || []).filter(t => t.id !== taskId);
      if (fromList.length === 0) delete next[fromKey]; else next[fromKey] = fromList;
      next[toDateKey] = [...(next[toDateKey] || []), task];
      return next;
    });
  }, [tasksByDate, setTasksByDate]);

  // ── Meeting operations ───────────────────────────────────────────

  const saveMeeting = useCallback((dateKey, id, patch) => {
    setMeetingsByDate(prev => {
      const list = prev[dateKey] || [];
      const existing = list.find(m => m.id === id);
      return {
        ...prev,
        [dateKey]: existing
          ? list.map(m => m.id === id ? { ...m, ...patch } : m)
          : [...list, { id, ...patch }],
      };
    });
  }, [setMeetingsByDate]);

  const deleteMeeting = useCallback((dateKey, id) => {
    setMeetingsByDate(prev => {
      const list = (prev[dateKey] || []).filter(m => m.id !== id);
      if (list.length === 0) {
        const { [dateKey]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [dateKey]: list };
    });
  }, [setMeetingsByDate]);

  const skipMeetingOccurrence = useCallback((sourceDate, sourceId, skipKey) => {
    setMeetingsByDate(prev => ({
      ...prev,
      [sourceDate]: (prev[sourceDate] || []).map(m =>
        m.id !== sourceId ? m
          : { ...m, skipDates: Array.from(new Set([...(m.skipDates || []), skipKey])) }
      ),
    }));
  }, [setMeetingsByDate]);

  const endMeetingFrom = useCallback((sourceDate, sourceId, endKey) => {
    setMeetingsByDate(prev => {
      const list = prev[sourceDate] || [];
      if (endKey <= sourceDate) {
        const filtered = list.filter(m => m.id !== sourceId);
        if (filtered.length === 0) {
          const { [sourceDate]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [sourceDate]: filtered };
      }
      return { ...prev, [sourceDate]: list.map(m => m.id === sourceId ? { ...m, endDate: endKey } : m) };
    });
  }, [setMeetingsByDate]);

  // ── Render ───────────────────────────────────────────────────────
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!loaded) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Sticky week header */}
      <View style={styles.header}>
        {/* Top row: logo left, account right */}
        <View style={styles.topRow}>
          <View style={styles.logoWrap}>
            {/* Matches web mark.svg — cream rect, lowercase m, blue bar */}
            <View style={styles.logoMark}>
              <Text style={styles.logoMarkText}>m</Text>
              <View style={styles.logoMarkBar} />
            </View>
            <View>
              <Text style={styles.logoText}>NoteMD</Text>
              <View style={styles.logoUnderline} />
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowAccount(true)}
            style={styles.avatarBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.avatarInitial}>
              {user.email?.[0]?.toUpperCase() || 'A'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Nav row: ‹ · [week label + Today centered] · › */}
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={() => setWeekStart(w => addDays(w, -7))}
            style={styles.chevronBtn}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={styles.chevron}>‹</Text>
          </TouchableOpacity>

          <View style={styles.navCenter}>
            <TouchableOpacity
              onPress={() => setShowCalendar(true)}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            >
              <Text style={styles.weekLabel}>{weekLabel}</Text>
            </TouchableOpacity>
            {!isCurrentWeek && (
              <TouchableOpacity
                onPress={() => { setWeekStart(startOfWeek(getToday())); hasScrolled.current = false; }}
                style={styles.todayBtn}
              >
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>
            )}
            {(saving || error) && (
              <Text style={saving ? styles.savingText : styles.errorText}>
                {saving ? 'saving…' : 'sync error'}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setWeekStart(w => addDays(w, 7))}
            style={styles.chevronBtn}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Week scroll — KeyboardAvoidingView pushes content above keyboard */}
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={12}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.weekContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {allDays.map(day => {
            const key = fmtDate(day);
            const isToday = key === todayStr;
            const isPast = key < todayStr;
            const meetings = [...(expandedMeetings[key] || [])].sort(
              (a, b) => (a.time || '').localeCompare(b.time || ''),
            );
            const tasks = tasksByDate[key] || [];

            return (
              <DaySection
                key={key}
                date={day}
                dateKey={key}
                isToday={isToday}
                isPast={isPast}
                tasks={tasks}
                meetings={meetings}
                onAddTask={addTask}
                onUpdateTask={updateTask}
                onDeleteTask={deleteTask}
                onMoveTask={moveTask}
                onEditTask={(task, dk) => setSelectedTask({ task, dateKey: dk })}
                onEditMeeting={(meeting, dk) => setSelectedMeeting({ meeting, dateKey: dk, isNew: false })}
                onAddMeeting={(dk) => setSelectedMeeting({ meeting: null, dateKey: dk, isNew: true })}
                onLayout={(e) => { dayOffsets.current[key] = e.nativeEvent.layout.y; }}
              />
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Task sheet */}
      <TaskSheet
        task={selectedTask?.task}
        dateKey={selectedTask?.dateKey}
        onClose={() => setSelectedTask(null)}
        onUpdate={(patch) => {
          if (selectedTask) updateTask(selectedTask.dateKey, selectedTask.task.id, patch);
        }}
        onDelete={() => {
          if (selectedTask) { deleteTask(selectedTask.dateKey, selectedTask.task.id); setSelectedTask(null); }
        }}
        onMove={(toKey) => {
          if (selectedTask) { moveTask(selectedTask.task.id, toKey); setSelectedTask(null); }
        }}
      />

      {/* Meeting sheet */}
      <MeetingSheet
        meeting={selectedMeeting?.meeting}
        dateKey={selectedMeeting?.dateKey}
        isNew={selectedMeeting?.isNew}
        onClose={() => setSelectedMeeting(null)}
        onSave={(patch) => {
          if (!selectedMeeting) return;
          const { meeting, dateKey, isNew } = selectedMeeting;
          if (isNew) {
            saveMeeting(dateKey, randomUUID(), patch);
          } else if (meeting._recurring) {
            saveMeeting(meeting.sourceDate, meeting.sourceId, patch);
          } else {
            saveMeeting(dateKey, meeting.id, patch);
          }
          setSelectedMeeting(null);
        }}
        onDelete={() => {
          if (!selectedMeeting) return;
          const { meeting, dateKey } = selectedMeeting;
          if (meeting._recurring) deleteMeeting(meeting.sourceDate, meeting.sourceId);
          else deleteMeeting(dateKey, meeting.id);
          setSelectedMeeting(null);
        }}
        onDeleteOccurrence={() => {
          if (!selectedMeeting) return;
          const { meeting, dateKey } = selectedMeeting;
          if (meeting._recurring) skipMeetingOccurrence(meeting.sourceDate, meeting.sourceId, dateKey);
          else skipMeetingOccurrence(dateKey, meeting.id, dateKey);
          setSelectedMeeting(null);
        }}
        onDeleteFuture={() => {
          if (!selectedMeeting) return;
          const { meeting, dateKey } = selectedMeeting;
          if (meeting._recurring) endMeetingFrom(meeting.sourceDate, meeting.sourceId, dateKey);
          else endMeetingFrom(dateKey, meeting.id, dateKey);
          setSelectedMeeting(null);
        }}
      />

      {/* Account sheet */}
      <AccountSheet
        visible={showAccount}
        user={user}
        onClose={() => setShowAccount(false)}
        onSignOut={() => { setShowAccount(false); signOut(); }}
      />

      {/* Calendar sheet */}
      <CalendarSheet
        visible={showCalendar}
        weekStart={weekStart}
        onSelectDate={(date) => {
          setWeekStart(startOfWeek(date));
          hasScrolled.current = false;
          setShowCalendar(false);
        }}
        onClose={() => setShowCalendar(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: theme.bg,
    paddingBottom: 10,
  },

  // Top row: logo + account avatar
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMark: {
    alignItems: 'center',
  },
  logoMarkText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.ink,
    lineHeight: 22,
  },
  logoMarkBar: {
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#5167F4',
    marginTop: 1,
  },
  logoText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.ink,
    letterSpacing: -0.2,
  },
  // Blue bar under "Note" — width ≈ 47% of "NoteMD" (matching SVG 86/180 ratio)
  logoUnderline: {
    position: 'absolute',
    bottom: -2,
    left: 0,
    width: 38,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#5167F4',
  },

  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: theme.surface, fontSize: theme.font.md, fontWeight: '800' },

  // Nav row
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  chevronBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chevron: { fontSize: 32, color: theme.ink, lineHeight: 36, fontWeight: '300' },
  navCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  weekLabel: { fontSize: theme.font.sm, color: theme.textSec, fontWeight: '600' },
  todayBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: theme.surfaceEm,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: theme.borderEm,
  },
  todayBtnText: { fontSize: theme.font.sm, color: theme.ink, fontWeight: '700' },
  savingText: { fontSize: theme.font.xs, color: theme.textTer },
  errorText: { fontSize: theme.font.xs, color: theme.danger },

  kav: { flex: 1 },
  weekContent: {},
});
