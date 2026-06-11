import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

function MeetingRow({ meeting, onPress, compact }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const hasTime = !!meeting.time;
  const mins = parseInt(meeting.duration, 10) || 30;
  const durLabel = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h${mins % 60 ? (mins % 60) + 'm' : ''}`;
  const isRecurring = meeting.repeat && meeting.repeat !== 'none';

  if (compact) {
    return (
      <TouchableOpacity style={styles.compact} onPress={onPress} activeOpacity={0.65}>
        <View style={styles.compactLine} />
        <View style={styles.compactBody}>
          <Text style={styles.compactTitle} numberOfLines={1}>{meeting.title || '(No title)'}</Text>
          <Text style={styles.compactMeta}>{hasTime ? meeting.time + ' · ' : ''}{durLabel}{isRecurring ? ' · ↻' : ''}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.timeBadge}>
        {hasTime ? <Text style={styles.timeText}>{meeting.time}</Text> : <Text style={styles.noTime}>—</Text>}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{meeting.title || '(No title)'}</Text>
        <Text style={styles.meta}>{durLabel}{isRecurring ? ' · ' + meeting.repeat : ''}</Text>
      </View>
      {isRecurring && <Text style={styles.recurIcon}>↻</Text>}
    </TouchableOpacity>
  );
}

export default memo(MeetingRow);

const createStyles = (theme) => StyleSheet.create({
  compact: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 7, gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
    backgroundColor: theme.surfaceAlt,
  },
  compactLine: { width: 2, height: 22, backgroundColor: theme.borderEm, borderRadius: 1 },
  compactBody: { flex: 1 },
  compactTitle: { fontSize: theme.font.sm, color: theme.text, fontWeight: '600' },
  compactMeta: { fontSize: theme.font.xs, color: theme.textTer, marginTop: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.surface, borderRadius: theme.radius.md,
    marginBottom: 6, paddingVertical: 10, paddingHorizontal: 12, gap: 10,
    borderWidth: 1, borderColor: theme.border,
  },
  timeBadge: { width: 46 },
  timeText: { fontSize: theme.font.sm, fontWeight: '700', color: theme.text },
  noTime: { fontSize: theme.font.sm, color: theme.textTer },
  body: { flex: 1 },
  title: { fontSize: theme.font.md, color: theme.text, fontWeight: '600' },
  meta: { fontSize: theme.font.xs, color: theme.textSec, marginTop: 1 },
  recurIcon: { fontSize: 13, color: theme.textTer },
});
