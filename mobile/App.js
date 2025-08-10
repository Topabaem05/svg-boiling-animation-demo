import { StatusBar, StyleSheet, Platform, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

function AppContent() {
  const uri = Platform.OS === 'ios' ? 'http://localhost:3000/' : 'http://10.0.2.2:3000/';
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />
        <WebView
          originWhitelist={["*"]}
          source={{ uri }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          automaticallyAdjustContentInsets={false}
        />
      </SafeAreaView>
      {/* Bottom safe area fill */}
      <View style={{ height: insets.bottom, backgroundColor: '#303030' }} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#303030' },
  container: { flex: 1, backgroundColor: '#FFB784' },
  webview: { flex: 1 },
});
