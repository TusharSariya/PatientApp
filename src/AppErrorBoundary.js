import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { reportError } from './errorLog';
import { SCREEN_PADDING, screenColors } from './screenLayout';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportError(error, {
      screen: 'AppErrorBoundary',
      action: 'render_crash',
      prefill: info?.componentStack?.slice(0, 500) ?? error?.message,
    });
  }

  handleReport = () => {
    this.props.onReportProblem?.(this.state.error?.message ?? 'App crashed');
  };

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          The app hit an unexpected error. You can retry or send a diagnostic report from Settings.
        </Text>
        <TouchableOpacity testID="error-boundary-retry" style={styles.primaryButton} onPress={this.handleRetry}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </TouchableOpacity>
        {this.props.onReportProblem ? (
          <TouchableOpacity testID="error-boundary-report" style={styles.secondaryButton} onPress={this.handleReport}>
            <Text style={styles.secondaryButtonText}>Report problem</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 40,
    backgroundColor: screenColors.bg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#65708a',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#4f6ef7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#4f6ef7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4f6ef7',
    fontWeight: '700',
    fontSize: 15,
  },
});
