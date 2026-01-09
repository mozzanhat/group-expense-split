import React from 'react';
import { AuthProvider } from './src/context/AuthContext'; // 1. Import 'bộ não'
import AppNavigator from './src/navigation/AppNavigator'; // 2. Import 'bộ điều hướng'

import ProfileScreen from './src/screens/ProfileScreen';

export default function App() {
  return (
    // 3. Bao bọc toàn bộ ứng dụng bằng AuthProvider
    <AuthProvider>
      {/* 4. Hiển thị bộ điều hướng */}
      <AppNavigator />
    </AuthProvider>
  );
}