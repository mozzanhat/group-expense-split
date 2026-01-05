import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext'; // Import 'bộ não'

// Import các màn hình
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import { ActivityIndicator, View } from 'react-native';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  // Lấy trạng thái từ 'bộ não'
  const { token, isLoading } = useAuth();

  // Nếu đang tải token, hiển thị màn hình chờ
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {token == null ? (
          // Chưa đăng nhập: Chỉ hiển thị màn Login/Register
          <>
            <Stack.Screen
             name="Login"
             component={LoginScreen} 
             //options={{ title: 'Đăng Nhập' }} 
             options={{ title: 'Đăng Nhập', headerShown: false }}
             />
            <Stack.Screen
             name="Register"
              component={RegisterScreen}
              // options={{ title: 'Đăng Ký' }} 
                 options={{ title: 'Đăng Ký',headerShown: false }} 
                                  
               />
          </>
        ) : (
          // Đã đăng nhập: Chỉ hiển thị màn Home (và các màn hình chính khác)
          <>
            <Stack.Screen
             name="Home"
              component={HomeScreen}
               //options={{ title: 'Trang Chủ' }} 
               options={{ title: 'Trang Chủ',headerShown: false }} 
               
               />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}