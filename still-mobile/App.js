import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden={true} />
      <WebView
        originWhitelist={['*']}
        source={{ uri: 'https://still-prayer.netlify.app' }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030305',
  },
  webview: {
    flex: 1,
  },
});