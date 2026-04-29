import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './src/HomeScreen';
import AddPatientScreen from './src/AddPatientScreen';
import SearchScreen from './src/SearchScreen';
import PatientDetailScreen from './src/PatientDetailScreen';
import PatientMedicinesScreen from './src/PatientMedicinesScreen';
import SettingsScreen from './src/SettingsScreen';
import ManageGesturesScreen from './src/ManageGesturesScreen';
import TestGestureScreen from './src/TestGestureScreen';
import { GestureInputProvider } from './src/GestureInputProvider';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <GestureInputProvider>
      <NavigationContainer>
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
            name="PatientDetail"
            component={PatientDetailScreen}
            options={({ route }) => ({ title: route.params.patient.name })}
          />
          <Stack.Screen
            name="PatientMedicines"
            component={PatientMedicinesScreen}
            options={({ route }) => ({ title: `${route.params.patient.name} Medicines` })}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings' }}
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
        </Stack.Navigator>
      </NavigationContainer>
    </GestureInputProvider>
  );
}
