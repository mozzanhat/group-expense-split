// frontend/src/screens/InviteMemberScreen.js

import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import api from '../api'; // Import API client đã cấu hình

export default function InviteMemberScreen({ route, navigation }) {
  // Lấy groupId được truyền từ màn hình trước
  const { groupId } = route.params;
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    // 1. Validate đầu vào cơ bản
    if (!email.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập địa chỉ Email.');
      return;
    }

    setLoading(true);
    try {
      // 2. Gọi API Backend (Đã viết ở Tuần 4)
      // POST /groups/:id/members với body là { email: "..." }
      await api.post(`/groups/${groupId}/members`, {
        email: email.trim().toLowerCase(), // Nên chuyển về chữ thường
      });

      // 3. Thành công
      Alert.alert(
        'Thành công', 
        `Đã thêm thành viên có email: ${email}`,
        [
          { 
            text: 'OK', 
            // Đóng modal và quay lại màn hình trước
            onPress: () => navigation.goBack() 
          }
        ]
      );

    } catch (error) {
      // 4. Xử lý lỗi từ Backend trả về
      let errorMessage = 'Không thể mời thành viên này.';
      // Nếu backend trả về message chi tiết (ví dụ: "User not found" hoặc "User already in group")
      if (error.response && error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message;
      }
      Alert.alert('Lỗi', errorMessage);
      console.error('Invite Error:', error);

    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nhập Email người muốn mời:</Text>
      <TextInput
        style={styles.input}
        placeholder="ví dụ: name@gmail.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none" // Không tự động viết hoa ký tự đầu
      />
      
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Gửi Lời Mời" onPress={handleInvite} />
      )}
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 16,
    marginBottom: 10,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    marginBottom: 20,
  },
});