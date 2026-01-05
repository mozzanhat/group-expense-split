import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext'; // Import 'bộ não'

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const { register } = useAuth(); // Lấy hàm register từ 'bộ não'
  const navigation = useNavigation();

 const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin.');
      return;
    }
    
    // Gọi hàm register và nhận kết quả
    const success = await register(name, email, password);
    
    // Chỉ điều hướng nếu đăng ký thành công
    if (success) {
      navigation.navigate('Login');
    }
    // Nếu thất bại, context đã tự động hiển thị alert, ta không làm gì cả
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tạo Tài Khoản</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Tên của bạn"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      
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
      
      <Button title="Đăng ký" onPress={handleRegister} />
      
      <Button
        title="Đã có tài khoản? Đăng nhập"
        onPress={() => navigation.goBack()} // Quay lại màn hình trước đó
      />
    </View>
  );
}

// Bạn có thể dùng chung 1 file styles nếu muốn, ở đây tôi copy lại cho rõ ràng
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: { height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 12, padding: 10, borderRadius: 5 },
});