import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext'; 

// Import các màn hình
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import { ActivityIndicator, View } from 'react-native';

// Import các màn hình MỚI
import GroupDetailScreen from '../screens/GroupDetailScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen'; // <--- Đã có

const Stack = createNativeStackNavigator();

// Tách luồng chính (Home, Chi tiết) ra một component riêng
function MainStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'Trang Chủ', headerShown: false }} 
      />
      <Stack.Screen 
        name="GroupDetail" 
        component={GroupDetailScreen} 
        // Lấy tiêu đề động từ param được truyền qua
        options={({ route }) => ({ 
          title: route.params.groupName 
        })}
      />
    </Stack.Navigator>
  );
}

// Đây là code AppNavigator đầy đủ cho Tuần 7
export default function AppNavigator() {
  const { token, isLoading } = useAuth();

  // Phần "isLoading" giữ nguyên
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {/* Sửa lại Stack.Navigator bên ngoài */}
      <Stack.Navigator>
        {token == null ? (
          // Luồng chưa đăng nhập
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          </>
        ) : (
          // Luồng đã đăng nhập (Dùng Stack.Group)
          <Stack.Group>
            {/* 1. Các màn hình chính (bọc trong 'Main') */}
            <Stack.Screen 
              name="Main" 
              component={MainStack} 
              options={{ headerShown: false }} 
            />
            
            {/* 2. Các màn hình Modal (trượt từ dưới lên) */}
            <Stack.Screen 
              name="AddExpense" 
              component={AddExpenseScreen} 
              options={{ 
                presentation: 'modal', // Kiểu trượt từ dưới lên
                title: 'Thêm Chi Phí Mới' 
              }} 
            />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}