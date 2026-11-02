// Entry: background tasks must be defined before anything else runs, so they exist when Android or iOS
// wakes Pavurio in the background (no UI, so expo-router's routes never load).
import './src/native/backgroundTasks';
import 'expo-router/entry';
