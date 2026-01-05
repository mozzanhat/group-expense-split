import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';

import { useAuth } from '../context/AuthContext'; // Import 'bộ não'
import { useNavigation } from '@react-navigation/native'; // Import navigation
// Tạm thời truyền navigation, lát nữa ta sẽ lấy từ Context
export default function LoginScreen({  }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { login } = useAuth(); // Lấy hàm login từ 'bộ não'
  const navigation = useNavigation(); // Lấy navigation

  const handleLogin = () => {
   if (email && password) {
      login(email, password); // Gọi hàm login
    } else {
      alert('Vui lòng nhập email và mật khẩu.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đăng Nhập</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Mật khẩu"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={true}//
      />
      <Button title="Đăng nhập" onPress={handleLogin} />
      <Button
        title="Chưa có tài khoản? Đăng ký"
        onPress={() => navigation.navigate('Register')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: { height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 12, padding: 10, borderRadius: 5 },
});