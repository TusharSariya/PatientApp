import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './src/HomeScreen';
import AddPatientScreen from './src/AddPatientScreen';
import SearchScreen from './src/SearchScreen';
import PatientDetailScreen from './src/PatientDetailScreen';
import EditPatientScreen from './src/EditPatientScreen';
import PatientMedicinesScreen from './src/PatientMedicinesScreen';
import PatientVisitsScreen from './src/PatientVisitsScreen';
import SettingsScreen from './src/SettingsScreen';
import ClinicProfileScreen from './src/ClinicProfileScreen';
import CurrencySettingsScreen from './src/CurrencySettingsScreen';
import InputModeSettingsScreen from './src/InputModeSettingsScreen';
import ManageGesturesScreen from './src/ManageGesturesScreen';
import TestGestureScreen from './src/TestGestureScreen';
import AllVisitsScreen from './src/AllVisitsScreen';
import ReportProblemScreen from './src/ReportProblemScreen';
import AppErrorBoundary from './src/AppErrorBoundary';
import { GestureInputProvider } from './src/GestureInputProvider';
import { initSentry } from './src/sentry';

initSentry();

const Stack = createNativeStackNavigator();
export const navigationRef = createNavigationContainerRef();

function navigateToReportProblem(params = {}) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('ReportProblem', params);
  }
}

export default function App() {
  return (
    <GestureInputProvider>
      <AppErrorBoundary
        onReportProblem={(prefill) => navigateToReportProblem({ prefill })}
      >
        <NavigationContainer ref={navigationRef}>
          <StatusBar style="dark" />
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: '#fff' },
              headerTitleStyle: { fontWeight: '700', color: '#1a1a2e' },
              headerTintColor: '#4f6ef7',
            }}
          >
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AddPatient"
              component={AddPatientScreen}
              options={{ title: 'New Patient' }}
            />
            <Stack.Screen
              name="Search"
              component={SearchScreen}
              options={{ title: 'Search Patients' }}
            />
            <Stack.Screen
              name="AllVisits"
              component={AllVisitsScreen}
              options={{ title: 'All Visits' }}
            />
            <Stack.Screen
              name="PatientDetail"
              component={PatientDetailScreen}
              options={({ route }) => ({ title: route.params.patient.name })}
            />
            <Stack.Screen
              name="EditPatient"
              component={EditPatientScreen}
              options={{ title: 'Edit Patient' }}
            />
            <Stack.Screen
              name="PatientMedicines"
              component={PatientMedicinesScreen}
              options={({ route }) => ({ title: `${route.params.patient.name} Medicines` })}
            />
            <Stack.Screen
              name="PatientVisits"
              component={PatientVisitsScreen}
              options={({ route }) => ({ title: `${route.params.patient.name} Visits` })}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
            <Stack.Screen
              name="ClinicProfile"
              component={ClinicProfileScreen}
              options={{ title: 'Doctor details' }}
            />
            <Stack.Screen
              name="CurrencySettings"
              component={CurrencySettingsScreen}
              options={{ title: 'Currency' }}
            />
            <Stack.Screen
              name="InputModeSettings"
              component={InputModeSettingsScreen}
              options={{ title: 'Input Mode' }}
            />
            <Stack.Screen
              name="ManageGestures"
              component={ManageGesturesScreen}
              options={{ title: 'Manage Gestures' }}
            />
            <Stack.Screen
              name="TestGesture"
              component={TestGestureScreen}
              options={{ title: 'Test Gesture' }}
            />
            <Stack.Screen
              name="ReportProblem"
              component={ReportProblemScreen}
              options={{ title: 'Report a problem' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </AppErrorBoundary>
    </GestureInputProvider>
  );
}
