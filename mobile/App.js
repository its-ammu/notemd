import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from './src/hooks/useAuth';
import AuthScreen from './src/screens/AuthScreen';
import TrackerScreen from './src/screens/TrackerScreen';
import { ThemeProvider, useTheme } from './src/theme';

function Root() {
  const { user, loading } = useAuth();
  const theme = useTheme();

  return (
    <>
      <StatusBar style={theme.id === 'dark' ? 'light' : 'dark'} />
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg }}>
          <ActivityIndicator color={theme.ink} size="large" />
        </View>
      ) : user ? (
        <TrackerScreen user={user} />
      ) : (
        <AuthScreen />
      )}
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Root />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
