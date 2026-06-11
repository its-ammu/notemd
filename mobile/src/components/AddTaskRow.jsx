import React, { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Keyboard } from 'react-native';
import { useTheme } from '../theme';

export default function AddTaskRow({ onSubmit }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [active, setActive] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  const activate = () => {
    setActive(true);
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  const submit = () => {
    const t = text.trim();
    if (t) onSubmit(t);
    setText('');
    setActive(false);
    Keyboard.dismiss();
  };

  const deactivate = () => { setText(''); setActive(false); };

  if (!active) {
    return (
      <TouchableOpacity style={styles.trigger} onPress={activate} activeOpacity={0.6}>
        <Text style={styles.triggerPlus}>+</Text>
        <Text style={styles.triggerText}>Add task</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.inputRow}>
      <View style={styles.dot} />
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Task name…"
        placeholderTextColor={theme.textTer}
        onSubmitEditing={submit}
        returnKeyType="done"
        blurOnSubmit
        onBlur={deactivate}
        autoFocus
      />
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    minHeight: 44,
  },
  triggerPlus: { fontSize: 18, color: theme.textSec, lineHeight: 20, fontWeight: '500', width: 24, textAlign: 'center' },
  triggerText: { fontSize: theme.font.sm, color: theme.textSec, fontWeight: '500' },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    gap: 10, minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border,
    backgroundColor: theme.surfaceAlt,
  },
  dot: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: theme.borderEm },
  input: { flex: 1, fontSize: theme.font.md, color: theme.text, fontWeight: '500', paddingVertical: 4 },
});
