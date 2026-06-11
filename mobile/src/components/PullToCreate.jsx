// Pull-down-to-create-task gesture.
// Wraps the task list in a PanGestureHandler. When the user is scrolled to the top
// and pulls down past PULL_THRESHOLD, an inline "New task" input is revealed and focused.
// Submitting keeps focus so multiple tasks can be entered in rapid succession.

import React, { useRef, useState, useCallback } from 'react';
import { View, TextInput, Text, StyleSheet, Animated } from 'react-native';
import { PanGestureHandler, ScrollView, State } from 'react-native-gesture-handler';
import { theme } from '../theme';

const PULL_THRESHOLD = 64;
const INPUT_HEIGHT = 52;

export default function PullToCreate({ children, onSubmit }) {
  const [revealed, setRevealed] = useState(false);
  const [inputText, setInputText] = useState('');
  const inputRef = useRef(null);
  const scrollY = useRef(0);
  const revealedRef = useRef(false);
  const headerAnim = useRef(new Animated.Value(0)).current;

  const panRef = useRef(null);
  const scrollRef = useRef(null);

  const revealInput = useCallback(() => {
    revealedRef.current = true;
    setRevealed(true);
    Animated.spring(headerAnim, {
      toValue: 1,
      useNativeDriver: false,
      tension: 180,
      friction: 14,
    }).start(() => {
      inputRef.current?.focus();
    });
  }, [headerAnim]);

  const hideInput = useCallback(() => {
    revealedRef.current = false;
    setRevealed(false);
    setInputText('');
    Animated.spring(headerAnim, {
      toValue: 0,
      useNativeDriver: false,
      tension: 200,
      friction: 18,
    }).start();
  }, [headerAnim]);

  const handleSubmit = useCallback(() => {
    const text = inputText.trim();
    if (text) {
      onSubmit(text);
      setInputText('');
      // keep focus for rapid entry
      inputRef.current?.focus();
    }
  }, [inputText, onSubmit]);

  const onGestureEvent = useCallback(({ nativeEvent }) => {
    const { translationY } = nativeEvent;
    if (scrollY.current <= 0 && translationY > 0 && !revealedRef.current) {
      const progress = Math.min(translationY / (PULL_THRESHOLD * 2), 0.8);
      headerAnim.setValue(progress);
    }
  }, [headerAnim]);

  const onHandlerStateChange = useCallback(({ nativeEvent }) => {
    const { state, translationY } = nativeEvent;
    if (state === State.END || state === State.FAILED || state === State.CANCELLED) {
      if (scrollY.current <= 0 && translationY > PULL_THRESHOLD && !revealedRef.current) {
        revealInput();
      } else if (!revealedRef.current) {
        Animated.spring(headerAnim, { toValue: 0, useNativeDriver: false }).start();
      }
    }
  }, [revealInput, headerAnim]);

  const headerHeight = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, INPUT_HEIGHT],
    extrapolate: 'clamp',
  });
  const headerOpacity = headerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const childArray = React.Children.toArray(children);
  const isEmptyList = childArray.length === 0;

  return (
    <PanGestureHandler
      ref={panRef}
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      simultaneousHandlers={scrollRef}
      activeOffsetY={[0, Infinity]}
      failOffsetX={[-15, 15]}
    >
      <Animated.View style={styles.wrapper}>
        {/* Pull-to-create input */}
        <Animated.View style={[styles.inputHeader, { height: headerHeight, opacity: headerOpacity }]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Task title…"
            placeholderTextColor={theme.textTer}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
            blurOnSubmit={false}
            onBlur={hideInput}
          />
        </Animated.View>

        <ScrollView
          ref={scrollRef}
          waitFor={panRef}
          onScroll={({ nativeEvent }) => { scrollY.current = nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.list, isEmptyList && styles.listEmpty]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isEmptyList ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Pull down to add a task</Text>
            </View>
          ) : childArray}
        </ScrollView>
      </Animated.View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  inputHeader: {
    overflow: 'hidden',
    backgroundColor: theme.accentLight,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: theme.font.md,
    color: theme.text,
  },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  listEmpty: { flex: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: theme.font.sm, color: theme.textTer },
});
