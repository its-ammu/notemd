import 'react-native-url-polyfill/auto'; // must be first — polyfills URL for Supabase
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
