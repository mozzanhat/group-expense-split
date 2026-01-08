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

  // State danh sách thành viên
  const [members, setMembers] = useState([]);
  
  // State 1: Danh sách người chịu tiền GỐC
  const [involvedUserIds, setInvolvedUserIds] = useState([]); 

  // State 2: Danh sách người chịu tiền LÃI (Mới)
  const [profitPayerIds, setProfitPayerIds] = useState([]);

  // 1. Tải danh sách thành viên khi vừa vào màn hình
  useEffect(() => {
    fetchGroupMembers();
  }, []);

  const fetchGroupMembers = async () => {
    try {
      const response = await api.get(`/groups/${groupId}`);
      const groupMembers = response.data.members || [];
      setMembers(groupMembers);

      // Mặc định: Chọn TẤT CẢ mọi người (chia đều Gốc và Lãi)
      const allMemberIds = groupMembers.map(m => m.user.id);
      setInvolvedUserIds(allMemberIds);
      setProfitPayerIds(allMemberIds);

    } catch (error) {
      console.error("Lỗi tải thành viên:", error);
      Alert.alert("Lỗi", "Không thể tải danh sách thành viên");
    }
  };

  // Hàm chọn/bỏ chọn người chịu GỐC
  const toggleUserSelection = (userId) => {
    if (involvedUserIds.includes(userId)) {
      // Nếu bỏ chọn Gốc -> Tự động bỏ chọn Lãi luôn (vì không vay thì không trả lãi)
      setInvolvedUserIds(involvedUserIds.filter(id => id !== userId));
      setProfitPayerIds(profitPayerIds.filter(id => id !== userId));
    } else {
      // Nếu chọn thêm Gốc -> Tự động thêm vào Lãi (để tiện thao tác)
      setInvolvedUserIds([...involvedUserIds, userId]);
      setProfitPayerIds([...profitPayerIds, userId]);
    }
  };

  // Hàm chọn/bỏ chọn người chịu LÃI
  const toggleProfitPayer = (userId) => {
    if (profitPayerIds.includes(userId)) {
      setProfitPayerIds(profitPayerIds.filter(id => id !== userId));
    } else {
      setProfitPayerIds([...profitPayerIds, userId]);
    }
  };

  const handleSave = async () => {
    // Validate cơ bản
    if (!description || !amount) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên khoản chi và số tiền!');
      return;
    }

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
        
        // Gửi danh sách người chịu Gốc
        involvedUserIds: involvedUserIds,
        // Gửi danh sách người chịu Lãi
        profitPayerIds: profitPayerIds
      });
      
      // Thông báo khác đi một chút vì giờ nó vào Hàng chờ
      Alert.alert('Đã gửi yêu cầu', 'Khoản chi đã được thêm vào Hàng Chờ. Chờ các thành viên khác duyệt!');
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
      <Text style={styles.label}>Tên khoản chi</Text>
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

      {/* --- PHẦN 2: CHỌN NGƯỜI CHIA TIỀN GỐC --- */}
      <Text style={styles.sectionTitle}>1. Chia GỐC cho ai?</Text>
      <View style={styles.membersContainer}>
        {members.map((member) => {
          const isSelected = involvedUserIds.includes(member.user.id);
          return (
            <TouchableOpacity 
              key={member.userId} // Đã sửa key
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

      {/* --- PHẦN 3: CHỌN NGƯỜI TRẢ LÃI (MỚI) --- */}
      {/* Chỉ hiện phần này nếu có nhập tiền lãi */}
      {(parseFloat(profit) > 0) && (
        <View>
          <Text style={[styles.sectionTitle, { color: '#e67e22' }]}>2. Chia LÃI cho ai?</Text>
          <Text style={styles.hintText}>(Chỉ những người được chọn ở trên mới hiện ở đây)</Text>
          
          <View style={styles.membersContainer}>
            {members.map((member) => {
              // Chỉ hiện những người ĐÃ ĐƯỢC CHỌN chia tiền Gốc
              if (!involvedUserIds.includes(member.user.id)) return null;
              
              const isProfitPayer = profitPayerIds.includes(member.user.id);
              return (
                <TouchableOpacity 
                  key={`profit-${member.userId}`} 
                  style={[styles.memberBadge, isProfitPayer ? styles.badgeProfit : styles.badgeUnselected]}
                  onPress={() => toggleProfitPayer(member.user.id)}
                >
                  <Text style={[styles.memberText, isProfitPayer ? {color: '#d35400', fontWeight:'bold'} : styles.textUnselected]}>
                    {isProfitPayer ? "💸 Chịu lãi" : "🙅 Miễn lãi"} - {member.user.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <View style={{marginTop: 30, marginBottom: 50}}>
        {loading ? (
          <ActivityIndicator size="large" color="blue" />
        ) : (
          <Button title="GỬI YÊU CẦU DUYỆT" onPress={handleSave} color="#28a745" />
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
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 25, marginBottom: 5, color: '#007bff' },
  hintText: { fontSize: 13, color: '#666', marginBottom: 10, fontStyle: 'italic' },
  
  membersContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  memberBadge: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
    marginRight: 10, marginBottom: 10, borderWidth: 1
  },
  
  // Style Gốc
  badgeSelected: { backgroundColor: '#e7f1ff', borderColor: '#007bff' },
  textSelected: { color: '#007bff', fontWeight: 'bold' },
  
  // Style Lãi
  badgeProfit: { backgroundColor: '#fadbd8', borderColor: '#e67e22' },
  
  // Style Chung
  badgeUnselected: { backgroundColor: '#f0f0f0', borderColor: '#ccc' },
  memberText: { fontSize: 14, fontWeight: '500' },
  textUnselected: { color: '#777' }
});