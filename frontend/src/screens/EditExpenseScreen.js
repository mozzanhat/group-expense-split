import React, { useState } from 'react';
import { 
  View, Text, TextInput, Button, StyleSheet, Alert, 
  ActivityIndicator, TouchableOpacity, ScrollView, Platform 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import api from '../api';

export default function EditExpenseScreen({ route, navigation }) {
  // Lấy dữ liệu cũ từ màn hình danh sách
  const { expense } = route.params; 

  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(expense.amount.toString());
  
  // Xử lý Lãi và Ngày (Nếu không có thì để mặc định)
  const [profit, setProfit] = useState(expense.profit ? expense.profit.toString() : '');
  const [dueDate, setDueDate] = useState(expense.dueDate ? new Date(expense.dueDate) : new Date());
  
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleUpdate = async () => {
    // 1. Kiểm tra nhập liệu
    if (!description || !amount) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên và số tiền!");
      return;
    }

    setLoading(true);
    try {
      // 2. Gửi yêu cầu cập nhật lên Server
      await api.put(`/expenses/${expense.id}`, {
        description: description,
        amount: parseFloat(amount),
        profit: parseFloat(profit) || 0, 
        dueDate: dueDate.toISOString()    
      });
      
      Alert.alert("Thành công", "Đã cập nhật chi phí!");
      navigation.goBack(); 

    } catch (error) {
      console.error("Lỗi update:", error);
      
      // 3. XỬ LÝ LỖI THÔNG MINH (PHẦN QUAN TRỌNG NHẤT)
      if (error.response) {
        // Nếu Server có trả về phản hồi (ví dụ: lỗi 403, 404, 500)
        // Ta lấy tin nhắn cụ thể trong biến "error" mà backend gửi sang
        const serverMessage = error.response.data?.error || "Có lỗi xảy ra từ phía Server";
        
        // Hiện thông báo đúng nội dung đó (Ví dụ: "Bạn không có quyền sửa...")
        Alert.alert("Không thể sửa", serverMessage);
      } else if (error.request) {
        // Lỗi không nhận được phản hồi (thường do mất mạng hoặc sai IP)
        Alert.alert("Lỗi kết nối", "Không thể kết nối đến Server. Vui lòng kiểm tra Wifi/4G.");
      } else {
        // Lỗi khác
        Alert.alert("Lỗi", "Đã có lỗi không xác định xảy ra.");
      }
    } finally {
      setLoading(false);
    }
  };

  const onChangeDate = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Mô tả (Mua gì?):</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="Ví dụ: Mua nước ngọt"
      />

      <Text style={styles.label}>Số tiền gốc (VNĐ):</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="Ví dụ: 50000"
      />

      <Text style={styles.label}>Tiền lãi (Nếu có):</Text>
      <TextInput
        style={styles.input}
        value={profit}
        onChangeText={setProfit}
        keyboardType="numeric"
        placeholder="Nhập tiền lãi..."
      />

      <Text style={styles.label}>Hạn trả tiền:</Text>
      <TouchableOpacity 
        onPress={() => setShowDatePicker(true)} 
        style={styles.dateButton}
      >
        <Text style={styles.dateText}>
          📅 {dueDate.toLocaleDateString('vi-VN')}
        </Text>
      </TouchableOpacity>

      {/* Hiển thị lịch chọn ngày */}
      {showDatePicker && (
        <DateTimePicker
          value={dueDate}
          mode="date"
          display="default"
          onChange={onChangeDate}
        />
      )}

      <View style={{ marginTop: 30 }}>
        {loading ? (
          <ActivityIndicator size="large" color="blue" />
        ) : (
          <Button title="LƯU THAY ĐỔI" onPress={handleUpdate} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  input: { 
    borderWidth: 1, 
    borderColor: '#ccc', 
    padding: 12, 
    borderRadius: 8, 
    fontSize: 16,
    backgroundColor: '#f9f9f9'
  },
  dateButton: {
    padding: 12,
    backgroundColor: '#e6e6e6',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc'
  },
  dateText: { fontSize: 16, fontWeight: 'bold', color: '#333' }
});