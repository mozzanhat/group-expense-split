import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ActivityIndicator, FlatList, 
  RefreshControl, Alert, TouchableOpacity, TextInput, Modal 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';

export default function DebtsScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { user } = useAuth(); 
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // State cho Modal nhập tiền
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState(null); // Người trả tiền
  const [settleAmount, setSettleAmount] = useState(''); // Số tiền trả

  const fetchDebts = async () => {
    try {
      const response = await api.get(`/groups/${groupId}/debts`);
      setData(response.data);
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => { fetchDebts(); }, [groupId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDebts();
  };

  // 1. Mở Modal khi bấm nút "Thu tiền"
  const openSettleModal = (debtor) => {
    setSelectedDebtor(debtor);
    // Gợi ý số tiền: Nếu họ đang âm (nợ), gợi ý luôn số dương của khoản nợ đó
    const suggestedAmount = debtor.balance < 0 ? Math.abs(debtor.balance) : '';
    setSettleAmount(suggestedAmount.toString());
    setModalVisible(true);
  };

  // 2. Gọi API xác nhận đã nhận tiền
  const handleSettle = async () => {
    if (!settleAmount || parseFloat(settleAmount) <= 0) {
      Alert.alert("Lỗi", "Vui lòng nhập số tiền hợp lệ");
      return;
    }

    try {
      await api.post(`/groups/${groupId}/settle`, {
        debtorId: selectedDebtor.userId,
        amount: parseFloat(settleAmount)
      });
      
      Alert.alert("Thành công", `Đã xác nhận nhận ${formatCurrency(settleAmount)} từ ${selectedDebtor.name}`);
      setModalVisible(false);
      fetchDebts(); // Tải lại danh sách để thấy nợ giảm ngay lập tức
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể cập nhật thanh toán");
    }
  };

  const renderDebtItem = ({ item }) => {
    const isCreditor = item.balance >= 0; 
    const isMe = item.userId === user.id;

    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.name}>
            {item.name} {isMe ? '(Bạn)' : ''}
          </Text>
          
          {/* NÚT THU TIỀN: Chỉ hiện ở dòng của người khác (không phải mình) */}
          {!isMe && (
            <TouchableOpacity 
                style={styles.settleButton} 
                onPress={() => openSettleModal(item)}
            >
                <Text style={styles.settleBtnText}>Thu tiền</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.paid}>Đã chi: {formatCurrency(item.paid)}</Text>
        
        <View style={styles.resultRow}>
            <Text style={styles.label}>Hiện tại:</Text>
            <Text style={[styles.balance, { color: isCreditor ? 'green' : 'red' }]}>
                {isCreditor ? 'Dư (Thu về)' : 'Thiếu (Phải trả)'} {formatCurrency(Math.abs(item.balance))}
            </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>Tổng chi tiêu nhóm: {formatCurrency(data?.total || 0)}</Text>
      </View>

      <FlatList
        data={data?.debts}
        keyExtractor={(item) => item.userId.toString()}
        renderItem={renderDebtItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      {/* --- MODAL NHẬP SỐ TIỀN --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
            <View style={styles.modalView}>
                <Text style={styles.modalTitle}>Xác nhận thu tiền</Text>
                <Text style={styles.modalDesc}>
                    Bạn đã nhận bao nhiêu tiền từ {selectedDebtor?.name}?
                </Text>

                <TextInput 
                    style={styles.modalInput}
                    value={settleAmount}
                    onChangeText={setSettleAmount}
                    keyboardType="numeric"
                    placeholder="Nhập số tiền..."
                    autoFocus={true}
                />

                <View style={styles.modalButtons}>
                    <TouchableOpacity 
                        style={[styles.btn, styles.btnCancel]} 
                        onPress={() => setModalVisible(false)}
                    >
                        <Text style={styles.btnText}>Hủy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.btn, styles.btnConfirm]} 
                        onPress={handleSettle}
                    >
                        <Text style={styles.btnText}>Xác nhận</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 10 },
  summary: { backgroundColor: '#333', padding: 15, borderRadius: 10, marginBottom: 10 },
  summaryText: { color: 'white', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  card: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 10, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  name: { fontSize: 17, fontWeight: 'bold' },
  paid: { color: 'gray', fontSize: 13, marginBottom: 10 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#eee', paddingTop: 10 },
  label: { fontSize: 15 },
  balance: { fontSize: 16, fontWeight: 'bold' },
  
  // Style nút Thu tiền
  settleButton: { backgroundColor: '#007bff', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 5 },
  settleBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },

  // Style Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalView: { width: '85%', backgroundColor: 'white', borderRadius: 10, padding: 20, alignItems: 'center', elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  modalDesc: { fontSize: 16, textAlign: 'center', marginBottom: 15, color: '#555' },
  modalInput: { width: '100%', borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, fontSize: 18, marginBottom: 20, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  btn: { flex: 1, padding: 12, borderRadius: 5, alignItems: 'center', marginHorizontal: 5 },
  btnCancel: { backgroundColor: '#aaa' },
  btnConfirm: { backgroundColor: '#28a745' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});