// Capture and remove a web recovery callback before navigation reads the URL.
// All other startup, routing and application ownership remains with Expo Router.
import './src/bootstrap/passwordRecoveryBootstrap';
import 'expo-router/entry';
