import { Platform } from 'react-native';

import appConfig from '../app.json';

function readExpoApplication() {
  try {
    return require('expo-application');
  } catch {
    return null;
  }
}

function readExpoDevice() {
  try {
    return require('expo-device');
  } catch {
    return null;
  }
}

export function getAppMetadata() {
  const Application = readExpoApplication();
  const expo = appConfig.expo ?? {};

  return {
    version: Application?.nativeApplicationVersion ?? expo.version ?? 'unknown',
    build:
      Application?.nativeBuildVersion ??
      String(expo.android?.versionCode ?? 'unknown'),
    applicationId:
      Application?.applicationId ??
      expo.android?.package ??
      expo.ios?.bundleIdentifier ??
      'unknown',
  };
}

export function getDeviceMetadata() {
  const Device = readExpoDevice();

  return {
    manufacturer: Device?.manufacturer ?? 'unknown',
    modelName: Device?.modelName ?? 'unknown',
    osName: Device?.osName ?? Platform.OS,
    osVersion: Device?.osVersion ?? String(Platform.Version ?? ''),
  };
}
