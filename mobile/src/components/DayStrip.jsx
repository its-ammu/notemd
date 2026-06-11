import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { addDays, fmtDate } from '../utils/time';
import { DAY_NAMES } from '../utils/constants';
import { theme } from '../theme';

export default function DayStrip({ weekStart, selectedDate, tasksByDate, meetingsByDate, onSelectDate, onWeekChange }) {
  const scrollRef = useRef(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = fmtDate(today);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    const idx = days.findIndex(d => fmtDate(d) === selectedDate);
    if (idx >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ x: idx * 56, animated: true });
    }
  }, [selectedDate, weekStart]);

  const goToPrevWeek = () => onWeekChange(addDays(weekStart, -7));
  const goToNextWeek = () => onWeekChange(addDays(weekStart, 7));

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={goToPrevWeek} style={styles.arrow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.arrowText}>‹</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {days.map((day, i) => {
          const key = fmtDate(day);
          const isSelected = key === selectedDate;
          const isToday = key === todayStr;
          const hasItems = (tasksByDate[key]?.length > 0) || (meetingsByDate[key]?.length > 0);

          return (
            <TouchableOpacity
              key={key}
              style={[styles.pill, isSelected && styles.pillSelected, isToday && !isSelected && styles.pillToday]}
              onPress={() => onSelectDate(key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayName, isSelected && styles.dayNameSelected, isToday && !isSelected && styles.dayNameToday]}>
                {DAY_NAMES[i]}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>
                {day.getDate()}
              </Text>
              {hasItems && (
                <View style={[styles.dot, isSelected && styles.dotSelected]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity onPress={goToNextWeek} style={styles.arrow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.arrowText}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    paddingVertical: 8,
  },
  arrow: { paddingHorizontal: 8 },
  arrowText: { fontSize: 22, color: theme.textSec, lineHeight: 26 },
  strip: { paddingHorizontal: 4, gap: 4 },
  pill: {
    width: 48,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    gap: 2,
  },
  pillSelected: { backgroundColor: theme.accent },
  pillToday: { backgroundColor: theme.accentLight },
  dayName: { fontSize: theme.font.xs, color: theme.textSec, fontWeight: '500' },
  dayNameSelected: { color: '#fff' },
  dayNameToday: { color: theme.accent },
  dayNum: { fontSize: theme.font.md, fontWeight: '700', color: theme.text },
  dayNumSelected: { color: '#fff' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.accent },
  dotSelected: { backgroundColor: 'rgba(255,255,255,0.7)' },
});
