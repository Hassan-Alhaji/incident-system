import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { CreateReportScreen } from './src/screens/CreateReportScreen';
import { TicketDetailScreen } from './src/screens/TicketDetailScreen';

type Screen = 'DASHBOARD' | 'CREATE_REPORT' | 'TICKET_DETAIL';

const AppNavigator: React.FC = () => {
  const { user, token, isLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('DASHBOARD');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#090d16" />
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  if (!token || !user) {
    return <LoginScreen />;
  }

  const handleOpenDetail = (id: string) => {
    setSelectedTicketId(id);
    setCurrentScreen('TICKET_DETAIL');
  };

  const handleBackToDashboard = () => {
    setSelectedTicketId(null);
    setCurrentScreen('DASHBOARD');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {currentScreen === 'DASHBOARD' && (
        <DashboardScreen
          onOpenNewTicket={() => setCurrentScreen('CREATE_REPORT')}
          onSelectTicket={handleOpenDetail}
        />
      )}

      {currentScreen === 'CREATE_REPORT' && (
        <CreateReportScreen
          onBack={handleBackToDashboard}
          onSuccess={handleBackToDashboard}
        />
      )}

      {currentScreen === 'TICKET_DETAIL' && selectedTicketId && (
        <TicketDetailScreen
          ticketId={selectedTicketId}
          onBack={handleBackToDashboard}
        />
      )}
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
