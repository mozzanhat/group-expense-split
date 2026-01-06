import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, Button, StyleSheet, Alert, 
  ActivityIndicator, TouchableOpacity, ScrollView 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import api from '../api';

export default function EditExpenseScreen({ route, navigation }) {
  // Lấy dữ liệu cũ từ màn hình danh sách
  const { expense } = route.params; 

  // State cho form
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(expense.amount.toString());
  const [profit, setProfit] = useState(expense.profit ? expense.profit.toString() : '');
  const [dueDate, setDueDate] = useState(expense.dueDate ? new Date(expense.dueDate) : new Date());
  
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // --- STATE MỚI: Danh sách thành viên & Người được chọn ---
  const [members, setMembers] = useState([]);
  const [involvedUserIds, setInvolvedUserIds] = useState([]); 

  // 1. Chạy ngay khi mở màn hình: Tải thành viên & Khôi phục danh sách cũ
  useEffect(() => {
    fetchGroupInfo();
  }, []);

  const fetchGroupInfo = async () => {
    try {
      // Gọi API lấy danh sách thành viên của nhóm hiện tại
      const response = await api.get(`/groups/${expense.groupId}`);
      const groupMembers = response.data.members || [];
      setMembers(groupMembers);

      // Khôi phục những người đã được chọn trước đó
      // (Dựa vào mảng 'splits' có sẵn trong expense)
      if (expense.splits && Array.isArray(expense.splits)) {
        const existingIds = expense.splits.map(split => split.userId);
        setInvolvedUserIds(existingIds);
      } else {
        // Nếu dữ liệu cũ không có splits, mặc định chọn tất cả (để an toàn)
        setInvolvedUserIds(groupMembers.map(m => m.user.id));
      }

    } catch (error) {
      console.error("Lỗi tải thông tin nhóm:", error);
      Alert.alert("Lỗi", "Không thể tải danh sách thành viên");
    }
  };

  // Hàm chọn/bỏ chọn người (Copy từ AddExpenseScreen)
  const toggleUserSelection = (userId) => {
    if (involvedUserIds.includes(userId)) {
      setInvolvedUserIds(involvedUserIds.filter(id => id !== userId));
    } else {
      setInvolvedUserIds([...involvedUserIds, userId]);
    }
  };

  const handleUpdate = async () => {
    // Kiểm tra nhập liệu
    if (!description || !amount) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên và số tiền!");
      return;
    }

    if (involvedUserIds.length === 0) {
      Alert.alert("Lỗi", "Phải chọn ít nhất 1 người chịu tiền!");
      return;
    }

    setLoading(true);
    try {
      // 2. Gửi yêu cầu cập nhật lên Server
      await api.put(`/expenses/${expense.id}`, {
        description: description,
        amount: parseFloat(amount),
        profit: parseFloat(profit) || 0, 
        dueDate: dueDate.toISOString(),
        
        // Gửi danh sách người chịu tiền mới
        involvedUserIds: involvedUserIds
      });
      
      Alert.alert("Thành công", "Đã cập nhật chi phí!");
      navigation.goBack(); 

    } catch (error) {
      console.error("Lỗi update:", error);
      
      // Xử lý lỗi thông minh
      if (error.response) {
        const serverMessage = error.response.data?.error || "Có lỗi xảy ra từ phía Server";
        Alert.alert("Không thể sửa", serverMessage);
      } else if (error.request) {
        Alert.alert("Lỗi kết nối", "Kiểm tra mạng Wifi/4G.");
      } else {
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

      {showDatePicker && (
        <DateTimePicker
          value={dueDate}
          mode="date"
          display="default"
          onChange={onChangeDate}
        />
      )}

      {/* --- PHẦN MỚI: CHỌN NGƯỜI CHIA TIỀN --- */}
      <Text style={styles.sectionTitle}>Chia cho ai? (Sửa đổi)</Text>
      <View style={styles.membersContainer}>
        {members.map((member) => {
          const isSelected = involvedUserIds.includes(member.user.id);
          return (
            <TouchableOpacity 
              key={member.userId} 
              style={[styles.memberBadge, isSelected ? styles.badgeSelected : styles.badgeUnselected]}
              onPress={() => toggleUserSelection(member.user.id)}
            >
              <Text style={[styles.memberText, isSelected ? styles.textSelected : styles.textUnselected]}>
                {isSelected ? "☑️ " : "⬜ "} {member.user.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ marginTop: 30, marginBottom: 50 }}>
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
  dateText: { fontSize: 16, fontWeight: 'bold', color: '#333' },

  // Style cho phần chọn thành viên
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 25, marginBottom: 10, color: '#007bff' },
  membersContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  memberBadge: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
    marginRight: 10, marginBottom: 10, borderWidth: 1
  },
  badgeSelected: { backgroundColor: '#e7f1ff', borderColor: '#007bff' },
  badgeUnselected: { backgroundColor: '#f0f0f0', borderColor: '#ccc' },
  memberText: { fontSize: 14, fontWeight: '500' },
  textSelected: { color: '#007bff', fontWeight: 'bold' },
  textUnselected: { color: '#777' }
});