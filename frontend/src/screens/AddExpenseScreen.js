import React, { useState } from 'react';
import { 
  View, Text, TextInput, Button, StyleSheet, Alert, 
  TouchableOpacity, ScrollView, Platform 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../api';
import { useAuth } from '../context/AuthContext'; 

export default function AddExpenseScreen({ route, navigation }) {
  const { user } = useAuth(); 
  const { groupId } = route.params; 

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [profit, setProfit] = useState(''); 
  
  // Mặc định hạn trả là ngày mai
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 86400000));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSave = async () => {
    if (!description || !amount) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên khoản chi và số tiền!');
      return;
    }

    try {
      await api.post('/expenses', {
        description,
        amount: parseFloat(amount),
        groupId,
        paidById: user.id,
        profit: parseFloat(profit) || 0,
        dueDate: dueDate.toISOString() // Gửi ngày dạng chuỗi chuẩn quốc tế
      });
      
      Alert.alert('Thành công', 'Đã thêm khoản chi mới!');
      navigation.goBack(); 
    } catch (error) {
      console.log(error);
      Alert.alert('Lỗi', 'Không thể lưu chi phí. Kiểm tra kết nối mạng!');
    }
  };

  const onChangeDate = (event, selectedDate) => {
    setShowDatePicker(false); // Ẩn lịch sau khi chọn
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Tên khoản chi (Ví dụ: Bia, Mồi...)</Text>
      <TextInput 
        style={styles.input} 
        value={description} 
        onChangeText={setDescription} 
        placeholder="Nhập tên..." 
      />

      <Text style={styles.label}>Số tiền gốc</Text>
      <TextInput 
        style={styles.input} 
        value={amount} 
        onChangeText={setAmount} 
        keyboardType="numeric" 
        placeholder="0" 
      />

      <Text style={styles.label}>Tiền lãi (Nếu có)</Text>
      <TextInput 
        style={styles.input} 
        value={profit} 
        onChangeText={setProfit} 
        keyboardType="numeric" 
        placeholder="0" 
      />

      <Text style={styles.label}>Hạn trả tiền</Text>
      <TouchableOpacity 
        onPress={() => setShowDatePicker(true)} 
        style={styles.dateButton}
      >
        <Text style={styles.dateText}>
          📅 {dueDate.toLocaleDateString('vi-VN')}
        </Text>
      </TouchableOpacity>
      
      {showDatePicker && (
        <DateTimePicker
          value={dueDate}
          mode="date"
          display="default"
          onChange={onChangeDate}
        />
      )}

      <View style={{marginTop: 20}}>
        <Button title="Lưu Chi Phí" onPress={handleSave} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  input: { 
    borderWidth: 1, borderColor: '#ccc', padding: 12, 
    borderRadius: 8, fontSize: 16 
  },
  dateButton: {
    padding: 15, backgroundColor: '#f0f0f0', 
    borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ddd'
  },
  dateText: { fontSize: 16, color: '#333', fontWeight: 'bold' }
});