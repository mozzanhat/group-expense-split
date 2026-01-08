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

  // Modal Thu tiền thủ công
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDebtorId, setSelectedDebtorId] = useState(null); 
  const [selectedDebtorName, setSelectedDebtorName] = useState('');
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

  useFocusEffect(useCallback(() => { fetchDebts(); }, [groupId]));
  const onRefresh = () => { setRefreshing(true); fetchDebts(); };

  // --- LOGIC 1: NGƯỜI NỢ BẤM "TRẢ NỢ" ---
  const handleNotifyPayment = async (creditorId, amount) => {
    try {
        await api.post(`/groups/${groupId}/notify-payment`, {
            creditorId, amount
        });
        Alert.alert("Đã gửi", "Đã thông báo cho chủ nợ. Chờ họ xác nhận.");
        fetchDebts();
    } catch (error) {
        Alert.alert("Lỗi", "Không gửi được thông báo");
    }
  };

  // --- LOGIC 2: CHỦ NỢ BẤM "XÁC NHẬN" (Dùng API confirm có sẵn) ---
  const handleConfirm = async (expenseId) => {
    try {
        await api.put(`/expenses/${expenseId}/confirm`);
        Alert.alert("Thành công", "Đã xác nhận đã nhận tiền!");
        fetchDebts();
    } catch (error) {
        Alert.alert("Lỗi", "Không thể xác nhận");
    }
  };

  // --- LOGIC 3: CHỦ NỢ BẤM "CHƯA NHẬN" ---
  const handleReject = async (expenseId) => {
    try {
        await api.post(`/expenses/${expenseId}/reject`);
        Alert.alert("Đã từ chối", "Yêu cầu thanh toán đã bị hủy.");
        fetchDebts();
    } catch (error) {
        Alert.alert("Lỗi", "Không thể từ chối");
    }
  };

  // --- LOGIC 4: THU TIỀN THỦ CÔNG (Giữ nguyên) ---
  const openSettleModal = (debtorId, debtorName, amount) => {
    setSelectedDebtorId(debtorId);
    setSelectedDebtorName(debtorName);
    setSettleAmount(amount.toString());
    setModalVisible(true);
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

  // --- RENDER ---
  const renderDebtItem = ({ item }) => {
    const isMe = item.userId === user.id;

    // 1. DANH SÁCH MÌNH NỢ NGƯỜI KHÁC (Cần Trả)
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
                        
                        {/* NÚT TRẢ NỢ: Chỉ hiện cho chính mình */}
                        {isMe && (
                            d.pending ? (
                                <Text style={styles.waitingText}>🕒 Đang chờ xác nhận...</Text>
                            ) : (
                                <TouchableOpacity 
                                    style={styles.payButton} 
                                    onPress={() => handleNotifyPayment(d.toId, d.amount)}
                                >
                                    <Text style={styles.btnText}>Trả nợ</Text>
                                </TouchableOpacity>
                            )
                        )}
                    </View>
                ))}
            </View>
        );
    };

   // 2. DANH SÁCH NGƯỜI KHÁC NỢ MÌNH (Được Nhận)
  const renderCreditsList = () => {
    if (!item.credits || item.credits.length === 0) return null;
    
    return (
        <View style={styles.sectionBlock}>
            <Text style={styles.labelGreen}>❇️ {isMe ? "Người khác nợ bạn:" : `Được nhận từ:`}</Text>
            {item.credits.map((c, idx) => (
                <View key={idx} style={styles.creditRow}>
                    <View style={{flex: 1}}>
                        <Text style={styles.debtText}>← {c.fromName} nợ: <Text style={{fontWeight:'bold'}}>{formatCurrency(c.amount)}</Text></Text>
                        
                        {/* Hiện trạng thái nếu có */}
                        {c.pending ? (
                            <Text style={{fontSize:11, color:'#e67e22', fontStyle:'italic'}}>🔔 Đã báo trả: {formatCurrency(c.pending.amount)}</Text>
                        ) : (
                            // Nếu chưa báo trả -> Hiện dòng này
                            <Text style={{fontSize:11, color:'#999', fontStyle:'italic'}}>(Chưa thanh toán)</Text>
                        )}

                        {c.dueDate && <Text style={styles.dateText}> (Hạn: {new Date(c.dueDate).toLocaleDateString('vi-VN')})</Text>}
                    </View>
                    
                    {/* CÁC NÚT BẤM (Chỉ hiện cho mình) */}
                    {isMe && (
                        c.pending ? (
                            // TRƯỜNG HỢP 1: Họ đã bấm "Trả nợ" -> Hiện nút xác nhận
                            <View style={{flexDirection: 'row'}}>
                                <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleReject(c.pending.expenseId)}>
                                    <Text style={styles.btnText}>Chưa nhận</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.actionBtn, styles.confirmBtn]} onPress={() => handleConfirm(c.pending.expenseId)}>
                                    <Text style={styles.btnText}>Đã nhận</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            // TRƯỜNG HỢP 2: Họ CHƯA bấm "Trả nợ" -> KHÔNG HIỆN NÚT THU TIỀN NỮA
                            // (Bạn có thể để trống null hoặc hiện icon chờ)
                            <View style={{padding: 5}}>
                                <Text style={{fontSize: 18}}>⏳</Text> 
                            </View>
                        )
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
        data={data?.debts} keyExtractor={item => item.userId.toString()} 
        renderItem={renderDebtItem} 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
      {/* Modal Thu Tiền (Giữ nguyên) */}
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
  
  // Button Styles
  payButton: { backgroundColor: '#e67e22', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 4 },
  collectButton: { backgroundColor: '#007bff', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 4 },
  actionBtn: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 4, marginLeft: 5 },
  confirmBtn: { backgroundColor: '#28a745' },
  rejectBtn: { backgroundColor: '#dc3545' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 11 },
  waitingText: { fontSize: 11, color: '#e67e22', fontStyle: 'italic' },

  // Modal Styles
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalView: { width: '80%', backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  modalInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginVertical: 10, fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalBtn: { padding: 10, borderRadius: 5, marginLeft: 10 }
});