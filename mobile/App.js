import { SafeAreaView, StatusBar, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  const uri = Platform.OS === 'ios' ? 'http://localhost:3000/' : 'http://10.0.2.2:3000/';

  return (
    <SafeAreaView style={styles.container}>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFB784' },
  webview: { flex: 1 },
});
