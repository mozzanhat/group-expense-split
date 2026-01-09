import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext'; 
import { ActivityIndicator, View } from 'react-native';

// --- IMPORT CÁC MÀN HÌNH ---
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import DebtsScreen from '../screens/DebtsScreen'; 
import InviteMemberScreen from '../screens/InviteMemberScreen'; 

import EditExpenseScreen from '../screens/EditExpenseScreen';

import ProfileScreen from '../screens/ProfileScreen';
// 1. NHỚ IMPORT MÀN HÌNH TẠO NHÓM
import CreateGroupScreen from '../screens/CreateGroupScreen'; 

import EditGroupScreen from '../screens/EditGroupScreen';

const Stack = createNativeStackNavigator();

function MainStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'Trang Chủ', headerShown: false }} 
      />
      <Stack.Screen 
    name="Profile" 
    component={ProfileScreen} 
    options={{ title: 'Hồ sơ cá nhân' }} 
  />
      <Stack.Screen 
        name="GroupDetail" 
        component={GroupDetailScreen} 
        options={({ route }) => ({ 
          title: route.params.groupName 
        })}
      />
      <Stack.Screen 
        name="Debts" 
        component={DebtsScreen} 
        options={{ title: 'Tình Hình Nợ' }} 
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { token, isLoading } = useAuth();

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
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <Stack.Group>
            <Stack.Screen 
              name="Main" 
              component={MainStack} 
              options={{ headerShown: false }} 
            />
            
            <Stack.Screen 
              name="AddExpense" 
              component={AddExpenseScreen} 
              options={{ presentation: 'modal', title: 'Thêm Chi Phí Mới' }} 
            />
            
            <Stack.Screen 
              name="InviteMember" 
              component={InviteMemberScreen} 
              options={{ presentation: 'modal', title: 'Mời Thành Viên' }} 
            />

            <Stack.Screen
              name="CreateGroup"
              component={CreateGroupScreen} 
              options={{ title: 'Tạo Nhóm Mới' }}
            />

            <Stack.Screen 
            name="EditExpense" 
            component={EditExpenseScreen} 
            options={{ title: 'Sửa Chi Phí', presentation: 'modal' }} 
            />

            <Stack.Screen 
            name="EditGroup" 
            component={EditGroupScreen} 
            options={{ title: 'Đổi Tên Nhóm', presentation: 'modal' }} 
            />
            
          </Stack.Group>
          
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}