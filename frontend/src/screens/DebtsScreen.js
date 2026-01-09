import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, RefreshControl, Alert, 
  TouchableOpacity, TextInput, Modal, ActivityIndicator 
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

  // Modal Thu tiền
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDebtorId, setSelectedDebtorId] = useState(null); 
  const [selectedDebtorName, setSelectedDebtorName] = useState('');
  const [settleAmount, setSettleAmount] = useState(''); 

  // --- 1. GỌI API ---
  const fetchDebts = async () => {
    try {
      const response = await api.get(`/groups/${groupId}/debts`);
      // console.log("Data check:", response.data); // Bỏ comment để debug nếu cần
      setData(response.data);
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchDebts(); }, [groupId]));
  const onRefresh = () => { setRefreshing(true); fetchDebts(); };

  // --- CÁC HÀM XỬ LÝ ---
  const handleNotifyPayment = async (creditorId, amount) => {
    try {
        await api.post(`/groups/${groupId}/notify-payment`, { creditorId, amount });
        Alert.alert("Đã gửi", "Đã thông báo trả nợ.");
        fetchDebts();
    } catch (error) { Alert.alert("Lỗi", "Không gửi được thông báo"); }
  };

  const handleConfirm = async (expenseId) => {
    try {
        await api.put(`/expenses/${expenseId}/confirm`);
        Alert.alert("Thành công", "Đã xác nhận!");
        fetchDebts();
    } catch (error) { Alert.alert("Lỗi", "Lỗi xác nhận"); }
  };

  const handleReject = async (expenseId) => {
    try {
        await api.post(`/expenses/${expenseId}/reject`);
        Alert.alert("Đã hủy", "Đã từ chối thanh toán.");
        fetchDebts();
    } catch (error) { Alert.alert("Lỗi", "Lỗi từ chối"); }
  };

  const handleManualSettle = async () => {
    if (!settleAmount) return;
    try {
      await api.post(`/groups/${groupId}/settle`, {
        debtorId: selectedDebtorId,
        amount: parseFloat(settleAmount)
      });
      setModalVisible(false);
      fetchDebts(); 
    } catch (error) { Alert.alert("Lỗi", "Lỗi"); }
  };

  const openSettleModal = (debtorId, debtorName, amount) => {
    setSelectedDebtorId(debtorId);
    setSelectedDebtorName(debtorName);
    setSettleAmount(amount.toString());
    setModalVisible(true);
  };

  // --- 2. RENDER GIAO DIỆN ---

  // === QUAN TRỌNG: PHẦN HIỂN THỊ HÀNG CHỜ ===
  const renderPendingExpenses = () => {
    if (!data?.pendingExpenses || data.pendingExpenses.length === 0) return null;

    return (
      <View style={styles.pendingContainer}>
        <Text style={styles.pendingHeader}>⏳ Hàng chờ duyệt ({data.pendingExpenses.length})</Text>
        <Text style={{fontSize: 12, color: '#666', marginBottom: 10, fontStyle: 'italic'}}>
            (Chi phí mới tạo chưa được tính vào nợ. Cần vào Sửa nhóm để duyệt)
        </Text>
        
        {data.pendingExpenses.map((item) => (
          <View key={item.id} style={styles.pendingItem}>
            <View style={{flex: 1}}>
                <Text style={styles.pendingDesc}>{item.description}</Text>
                <Text style={styles.pendingDetail}>👤 Tạo bởi: {item.paidBy?.name}</Text>
                {item.dueDate && (
                     <Text style={styles.pendingDetail}>📅 Hạn: {new Date(item.dueDate).toLocaleDateString('vi-VN')}</Text>
                )}
            </View>
            <Text style={styles.pendingAmount}>{formatCurrency(item.amount)}</Text>
          </View>
        ))}
        
        <TouchableOpacity 
            style={styles.voteLinkButton} 
            onPress={() => navigation.navigate('EditGroup', { groupId })}
        >
            <Text style={styles.voteLinkText}>👉 Vào "Sửa nhóm" để Duyệt ngay</Text>
        </TouchableOpacity>
      </View>
    );
  };
  // ===========================================

  const renderDebtItem = ({ item }) => {
    const isMe = item.userId === user.id;

    // Danh sách Cần trả
    const renderDebtsList = () => {
        if (!item.debts || item.debts.length === 0) return null;
        return (
            <View style={styles.sectionBlock}>
                <Text style={styles.labelRed}>🔻 {isMe ? "Bạn cần trả:" : `Cần trả:`}</Text>
                {item.debts.map((d, idx) => (
                    <View key={idx} style={styles.debtRow}>
                        <View style={{flex: 1}}>
                            <Text style={styles.debtText}>→ Trả {d.toName}: <Text style={{fontWeight:'bold'}}>{formatCurrency(d.amount)}</Text></Text>
                            {d.dueDate && <Text style={styles.dateText}> (Hạn: {new Date(d.dueDate).toLocaleDateString('vi-VN')})</Text>}
                        </View>
                        {isMe && (
                            d.pending ? <Text style={styles.waitingText}>🕒 Chờ xác nhận...</Text>
                            : <TouchableOpacity style={styles.payButton} onPress={() => handleNotifyPayment(d.toId, d.amount)}>
                                <Text style={styles.btnText}>Trả nợ</Text>
                              </TouchableOpacity>
                        )}
                    </View>
                ))}
            </View>
        );
    };

    // Danh sách Được nhận
    const renderCreditsList = () => {
        if (!item.credits || item.credits.length === 0) return null;
        return (
            <View style={styles.sectionBlock}>
                <Text style={styles.labelGreen}>❇️ {isMe ? "Người khác nợ bạn:" : `Được nhận từ:`}</Text>
                {item.credits.map((c, idx) => (
                    <View key={idx} style={styles.creditRow}>
                        <View style={{flex: 1}}>
                            <Text style={styles.debtText}>← {c.fromName} nợ: <Text style={{fontWeight:'bold'}}>{formatCurrency(c.amount)}</Text></Text>
                            {c.pending ? <Text style={{fontSize:11, color:'#e67e22', fontStyle:'italic'}}>🔔 Đã báo trả: {formatCurrency(c.pending.amount)}</Text>
                            : <Text style={{fontSize:11, color:'#999', fontStyle:'italic'}}>(Chưa thanh toán)</Text>}
                        </View>
                        {isMe && c.pending && (
                            <View style={{flexDirection: 'row'}}>
                                <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleReject(c.pending.expenseId)}>
                                    <Text style={styles.btnText}>Từ chối</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.actionBtn, styles.confirmBtn]} onPress={() => handleConfirm(c.pending.expenseId)}>
                                    <Text style={styles.btnText}>Đã nhận</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                ))}
            </View>
        );
    };

    return (
      <View style={styles.card}>
        <Text style={styles.name}>{item.name} {isMe ? '(Bạn)' : ''}</Text>
        <View style={styles.statsRow}>
            <Text style={styles.statsText}>Đã chi gốc: {formatCurrency(item.paidOriginal)}</Text>
            <Text style={styles.statsText}>Đã thu về: {formatCurrency(item.received)}</Text>
        </View>
        <View style={styles.debtContainer}>
            {renderDebtsList()}
            {renderCreditsList()}
            {(!item.debts.length && !item.credits.length) && <Text style={styles.emptyText}>Không có công nợ</Text>}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.summary}><Text style={styles.summaryText}>Tổng chi tiêu nhóm: {formatCurrency(data?.total || 0)}</Text></View>
      
      <FlatList 
        data={data?.debts} 
        keyExtractor={item => item.userId.toString()} 
        renderItem={renderDebtItem}
        
        // --- CHỖ NÀY QUAN TRỌNG NHẤT: ---
        // Phải gọi hàm renderPendingExpenses() ở đây nó mới hiện
        ListHeaderComponent={renderPendingExpenses()} 
        
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      {/* Modal Thu tiền */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
            <View style={styles.modalView}>
                <Text style={styles.modalTitle}>Xác nhận thu tiền</Text>
                <Text>Xác nhận {selectedDebtorName} trả:</Text>
                <TextInput style={styles.modalInput} value={settleAmount} onChangeText={setSettleAmount} keyboardType="numeric" autoFocus/>
                <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.modalBtn, {backgroundColor:'#ccc'}]} onPress={()=>setModalVisible(false)}><Text>Hủy</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, {backgroundColor:'#28a745'}]} onPress={handleManualSettle}><Text style={{color:'white'}}>OK</Text></TouchableOpacity>
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
  
  // Style Hàng chờ
  pendingContainer: { backgroundColor: '#fff3cd', padding: 10, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#ffeeba' },
  pendingHeader: { fontSize: 16, fontWeight: 'bold', color: '#856404', marginBottom: 5 },
  pendingItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#faeec5', paddingBottom: 5 },
  pendingDesc: { fontWeight: 'bold', color: '#555', fontSize: 15 },
  pendingDetail: { fontSize: 12, color: '#666', marginTop: 2 },
  pendingAmount: { fontWeight: 'bold', color: '#e67e22', fontSize: 15 },
  voteLinkButton: { marginTop: 5, padding: 8, backgroundColor: '#ffc107', borderRadius: 5, alignItems: 'center' },
  voteLinkText: { fontWeight: 'bold', color: '#333' },

  card: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 10, elevation: 2 },
  name: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, backgroundColor: '#f0f0f0', padding: 8, borderRadius: 5 },
  statsText: { fontSize: 12, color: '#555' },
  debtContainer: { borderTopWidth: 1, borderColor: '#eee', paddingTop: 5 },
  sectionBlock: { marginBottom: 10 },
  labelRed: { color: '#e74c3c', fontWeight: 'bold', fontSize: 13, marginBottom: 4 },
  labelGreen: { color: '#27ae60', fontWeight: 'bold', fontSize: 13, marginBottom: 4 },
  debtRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  creditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  debtText: { fontSize: 14, color: '#333' },
  dateText: { fontSize: 11, color: '#e67e22', fontStyle: 'italic' },
  emptyText: { textAlign: 'center', color: '#999', fontStyle: 'italic', marginTop: 10 },
  
  payButton: { backgroundColor: '#e67e22', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 4 },
  actionBtn: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 4, marginLeft: 5 },
  confirmBtn: { backgroundColor: '#28a745' },
  rejectBtn: { backgroundColor: '#dc3545' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 11 },
  waitingText: { fontSize: 11, color: '#e67e22', fontStyle: 'italic' },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalView: { width: '80%', backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  modalInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginVertical: 10, fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalBtn: { padding: 10, borderRadius: 5, marginLeft: 10 }
});