import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen() {
  const { logout, user } = useAuth(); // Lấy thêm 'user' từ 'bộ não'

  return (
    <View style={styles.container}>
      {/* Hiển thị tên user nếu có */}
      <Text style={styles.title}>Chào mừng, {user ? user.name : 'bạn'}!</Text>
      
      <Text style={styles.subtitle}>Bạn đã đăng nhập thành công.</Text>
      
      <View style={styles.buttonContainer}>
        <Button title="Đăng xuất" onPress={logout} color="#ff3b30" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 16 
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 10 
  },
  subtitle: {
    fontSize: 16,
    color: 'gray',
    marginBottom: 40
  },
  buttonContainer: {
    width: '60%'
  }
});