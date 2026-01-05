import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import api from '../api';

export default function EditExpenseScreen({ route, navigation }) {
  // Lấy dữ liệu cũ được truyền sang từ màn hình danh sách
  const { expense } = route.params; 

  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(expense.amount.toString());
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!description || !amount) {
      Alert.alert("Lỗi", "Vui lòng nhập đủ thông tin");
      return;
    }

    setLoading(true);
    try {
      await api.put(`/expenses/${expense.id}`, {
        description: description,
        amount: amount
      });
      
      Alert.alert("Thành công", "Đã cập nhật chi phí!");
      // Quay lại màn hình trước và tự động reload danh sách
      navigation.goBack(); 
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể lưu thay đổi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Mô tả (Mua gì?):</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="Ví dụ: Mua nước ngọt"
      />

      <Text style={styles.label}>Số tiền (VNĐ):</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric" // Bàn phím số
        placeholder="Ví dụ: 50000"
      />

      {loading ? (
        <ActivityIndicator size="large" color="blue" />
      ) : (
        <Button title="LƯU THAY ĐỔI" onPress={handleUpdate} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  input: { 
    borderWidth: 1, 
    borderColor: '#ccc', 
    padding: 10, 
    borderRadius: 8, 
    fontSize: 16,
    backgroundColor: '#f9f9f9'
  }
});