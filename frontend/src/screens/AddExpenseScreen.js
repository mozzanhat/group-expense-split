import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, Button, StyleSheet, Alert, 
  TouchableOpacity, ScrollView, ActivityIndicator 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../api';
import { useAuth } from '../context/AuthContext'; 

export default function AddExpenseScreen({ route, navigation }) {
  const { user } = useAuth(); 
  const { groupId } = route.params; 

  // State cho form nhập liệu
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [profit, setProfit] = useState(''); 
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 86400000)); // Mặc định mai trả
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // State cho danh sách thành viên và việc chọn người chia tiền
  const [members, setMembers] = useState([]);
  const [involvedUserIds, setInvolvedUserIds] = useState([]); // Danh sách ID người được chọn

  // 1. Tải danh sách thành viên khi vừa vào màn hình
  useEffect(() => {
    fetchGroupMembers();
  }, []);

  const fetchGroupMembers = async () => {
    try {
      // Gọi API lấy chi tiết nhóm (bao gồm thành viên)
      const response = await api.get(`/groups/${groupId}`);
      const groupMembers = response.data.members || [];
      
      setMembers(groupMembers);

      // Mặc định: Chọn TẤT CẢ mọi người (chia đều cho cả nhóm)
      const allMemberIds = groupMembers.map(m => m.user.id);
      setInvolvedUserIds(allMemberIds);

    } catch (error) {
      console.error("Lỗi tải thành viên:", error);
      Alert.alert("Lỗi", "Không thể tải danh sách thành viên");
    }
  };

  // Hàm xử lý khi bấm vào tên thành viên (Chọn/Bỏ chọn)
  const toggleUserSelection = (userId) => {
    if (involvedUserIds.includes(userId)) {
      // Nếu đang chọn -> Bỏ chọn
      setInvolvedUserIds(involvedUserIds.filter(id => id !== userId));
    } else {
      // Nếu chưa chọn -> Thêm vào
      setInvolvedUserIds([...involvedUserIds, userId]);
    }
  };

  const handleSave = async () => {
    // Validate cơ bản
    if (!description || !amount) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên khoản chi và số tiền!');
      return;
    }

    // Validate danh sách chia tiền
    if (involvedUserIds.length === 0) {
      Alert.alert('Chưa chọn người', 'Phải chọn ít nhất 1 người để chia tiền!');
      return;
    }

    setLoading(true);
    try {
      await api.post('/expenses', {
        description,
        amount: parseFloat(amount),
        groupId,
        paidById: user.id,
        profit: parseFloat(profit) || 0,
        dueDate: dueDate.toISOString(),
        
        // Gửi kèm danh sách người chịu tiền
        involvedUserIds: involvedUserIds 
      });
      
      Alert.alert('Thành công', 'Đã thêm khoản chi mới!');
      navigation.goBack(); 
    } catch (error) {
      console.log(error);
      Alert.alert('Lỗi', 'Không thể lưu chi phí. Kiểm tra kết nối mạng!');
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
      {/* --- PHẦN 1: NHẬP THÔNG TIN CƠ BẢN --- */}
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
      <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
        <Text style={styles.dateText}>📅 {dueDate.toLocaleDateString('vi-VN')}</Text>
      </TouchableOpacity>
      
      {showDatePicker && (
        <DateTimePicker value={dueDate} mode="date" display="default" onChange={onChangeDate} />
      )}

      {/* --- PHẦN 2: CHỌN NGƯỜI CHIA TIỀN --- */}
      <Text style={styles.sectionTitle}>Chia cho ai? (Chọn người phải trả)</Text>
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

      <View style={{marginTop: 30, marginBottom: 50}}>
        {loading ? (
          <ActivityIndicator size="large" color="blue" />
        ) : (
          <Button title="LƯU CHI PHÍ" onPress={handleSave} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  input: { 
    borderWidth: 1, borderColor: '#ccc', padding: 12, 
    borderRadius: 8, fontSize: 16, backgroundColor: '#f9f9f9'
  },
  dateButton: {
    padding: 15, backgroundColor: '#e6e6e6', 
    borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ccc'
  },
  dateText: { fontSize: 16, color: '#333', fontWeight: 'bold' },
  
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