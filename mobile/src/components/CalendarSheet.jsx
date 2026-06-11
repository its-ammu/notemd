import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { fmtDate, addDays } from '../utils/time';
import { useTheme } from '../theme';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function buildCalendar(year, month) {
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const offset = firstDow === 0 ? 6 : firstDow - 1;  // shift to Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = offset - 1; i >= 0; i--)
    cells.push({ date: new Date(year, month, -i), inMonth: false });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ date: new Date(year, month, d), inMonth: true });
  while (cells.length < 42)
    cells.push({ date: new Date(year, month + 1, cells.length - offset - daysInMonth + 1), inMonth: false });
  return cells;
}

export default function CalendarSheet({ visible, weekStart, onSelectDate, onClose }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => ['55%'], []);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  useEffect(() => {
    if (visible) {
      const t = new Date();
      setViewYear(t.getFullYear());
      setViewMonth(t.getMonth());
      setTimeout(() => sheetRef.current?.snapToIndex(0), 50);
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  const renderBackdrop = useCallback(props => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.35} pressBehavior="close" />
  ), []);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = fmtDate(today);
  const weekKeys = new Set(
    Array.from({ length: 7 }, (_, i) => fmtDate(addDays(weekStart, i)))
  );

  const cells = buildCalendar(viewYear, viewMonth);

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
      <BottomSheetView style={styles.content}>
        {/* Month nav */}
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Day-of-week header */}
        <View style={styles.dowRow}>
          {DAY_LABELS.map((d, i) => (
            <Text key={i} style={styles.dowLabel}>{d}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.grid}>
          {cells.map(({ date, inMonth }, i) => {
            const key = fmtDate(date);
            const isToday = key === todayStr;
            const inWeek = weekKeys.has(key);
            const isWeekStart = fmtDate(weekStart) === key;
            const isWeekEnd = fmtDate(addDays(weekStart, 6)) === key;

            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.cell,
                  inWeek && styles.cellInWeek,
                  isWeekStart && styles.cellWeekStart,
                  isWeekEnd && styles.cellWeekEnd,
                ]}
                onPress={() => onSelectDate(date)}
                activeOpacity={0.7}
              >
                <View style={[styles.dayCircle, isToday && styles.dayCircleToday]}>
                  <Text style={[
                    styles.dayNum,
                    !inMonth && styles.dayNumFaded,
                    isToday && styles.dayNumToday,
                  ]}>
                    {date.getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

const createStyles = (theme) => StyleSheet.create({
  sheetBg: { backgroundColor: theme.surface },
  handle: { backgroundColor: theme.border, width: 36 },
  content: { paddingHorizontal: 16, paddingBottom: 24, backgroundColor: theme.surface },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navArrow: { fontSize: 30, color: theme.ink, lineHeight: 34 },
  monthLabel: { fontSize: theme.font.lg, fontWeight: '700', color: theme.ink },

  dowRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  dowLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.font.xs,
    fontWeight: '700',
    color: theme.textTer,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.285%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellInWeek: { backgroundColor: theme.surfaceAlt },
  cellWeekStart: { borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  cellWeekEnd:   { borderTopRightRadius: 20, borderBottomRightRadius: 20 },

  dayCircle: {
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: { backgroundColor: theme.ink },
  dayNum: { fontSize: theme.font.sm, color: theme.text, fontWeight: '500' },
  dayNumFaded: { color: theme.textTer },
  dayNumToday: { color: theme.surface, fontWeight: '700' },
});
