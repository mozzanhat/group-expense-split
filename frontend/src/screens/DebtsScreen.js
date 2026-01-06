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

  // State cho Modal Thu tiền
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState(null); 
  const [settleAmount, setSettleAmount] = useState(''); 

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

  // --- LOGIC THU TIỀN (Giữ nguyên) ---
  const openSettleModal = (debtor) => {
    setSelectedDebtor(debtor);
    const suggestedAmount = debtor.balance < 0 ? Math.abs(debtor.balance) : '';
    setSettleAmount(suggestedAmount.toString());
    setModalVisible(true);
  };

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
      Alert.alert("Thành công", "Đã cập nhật thanh toán!");
      setModalVisible(false);
      fetchDebts(); 
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể cập nhật thanh toán");
    }
  };

  // --- RENDER MỤC HÀNG CHỜ (MỚI) ---
  const renderPendingExpenses = () => {
    if (!data?.pendingExpenses || data.pendingExpenses.length === 0) return null;

    return (
      <View style={styles.pendingContainer}>
        <Text style={styles.pendingHeader}>⏳ Hàng chờ duyệt ({data.pendingExpenses.length})</Text>
        <Text style={styles.pendingSubtext}>Các khoản này chưa được tính vào nợ chính thức.</Text>
        
        {data.pendingExpenses.map((item) => (
          <View key={item.id} style={styles.pendingItem}>
            <View>
                <Text style={styles.pendingDesc}>{item.description}</Text>
                <Text style={styles.pendingTime}>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</Text>
            </View>
            <View style={{alignItems: 'flex-end'}}>
                <Text style={styles.pendingAmount}>{formatCurrency(item.amount)}</Text>
                {item.profit > 0 && <Text style={styles.pendingProfit}>+ Lãi: {formatCurrency(item.profit)}</Text>}
            </View>
          </View>
        ))}
        
        <TouchableOpacity 
            style={styles.voteLinkButton}
            onPress={() => navigation.navigate('EditGroup', { groupId })}
        >
            <Text style={styles.voteLinkText}>👉 Vào "Sửa nhóm" để biểu quyết</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDebtItem = ({ item }) => {
    const isCreditor = item.balance >= 0; 
    const isMe = item.userId === user.id;

    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.name}>{item.name} {isMe ? '(Bạn)' : ''}</Text>
          {!isMe && (
            <TouchableOpacity style={styles.settleButton} onPress={() => openSettleModal(item)}>
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
        <Text style={styles.summaryText}>Tổng chi tiêu (Đã duyệt): {formatCurrency(data?.total || 0)}</Text>
      </View>

      <FlatList
        data={data?.debts}
        keyExtractor={(item) => item.userId.toString()}
        renderItem={renderDebtItem}
        // ✅ THÊM PHẦN HÀNG CHỜ VÀO ĐẦU DANH SÁCH
        ListHeaderComponent={renderPendingExpenses}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      {/* MODAL THU TIỀN */}
      <Modal
        animationType="slide" transparent={true} visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
            <View style={styles.modalView}>
                <Text style={styles.modalTitle}>Xác nhận thu tiền</Text>
                <Text style={styles.modalDesc}>Bạn đã nhận bao nhiêu tiền từ {selectedDebtor?.name}?</Text>
                <TextInput 
                    style={styles.modalInput} value={settleAmount} onChangeText={setSettleAmount}
                    keyboardType="numeric" placeholder="Nhập số tiền..." autoFocus={true}
                />
                <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setModalVisible(false)}>
                        <Text style={styles.btnText}>Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.btnConfirm]} onPress={handleSettle}>
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
  
  // STYLE HÀNG CHỜ (MỚI)
  pendingContainer: { backgroundColor: '#fff3cd', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#ffeeba' },
  pendingHeader: { fontSize: 16, fontWeight: 'bold', color: '#856404', marginBottom: 5 },
  pendingSubtext: { fontSize: 12, color: '#856404', marginBottom: 10, fontStyle: 'italic' },
  pendingItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#faeec5', paddingBottom: 5 },
  pendingDesc: { fontWeight: 'bold', color: '#555' },
  pendingAmount: { fontWeight: 'bold', color: '#e67e22' },
  pendingProfit: { fontSize: 10, color: '#d35400' },
  pendingTime: { fontSize: 10, color: '#777' },
  voteLinkButton: { marginTop: 5, padding: 8, backgroundColor: '#ffc107', borderRadius: 5, alignItems: 'center' },
  voteLinkText: { fontWeight: 'bold', color: '#333' },

  // STYLE CŨ
  card: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 10, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  name: { fontSize: 17, fontWeight: 'bold' },
  paid: { color: 'gray', fontSize: 13, marginBottom: 10 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#eee', paddingTop: 10 },
  label: { fontSize: 15 },
  balance: { fontSize: 16, fontWeight: 'bold' },
  settleButton: { backgroundColor: '#007bff', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 5 },
  settleBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },

  // Modal Styles
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