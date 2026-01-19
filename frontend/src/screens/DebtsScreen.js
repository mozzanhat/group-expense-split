import React, { useState, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, RefreshControl, Alert, 
  TouchableOpacity, TextInput, Modal, ActivityIndicator, Image, Platform 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

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

  // Modal QR Code
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [qrInfo, setQrInfo] = useState({ name: '', amount: 0 });

  const viewRef = useRef();
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();

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

  // --- LOGIC TÍNH TOÁN THANH TRẠNG THÁI ---
  const calculateProgress = () => {
    if (!data || !data.debts) return { settled: 0, outstanding: 0, percent: 0 };

    // 1. Tổng tiền ĐÃ TRẢ (Settled)
    // Cộng dồn số tiền 'received' (đã thu) của tất cả mọi người
    const totalSettled = data.debts.reduce((sum, member) => sum + (member.received || 0), 0);

    // 2. Tổng tiền ĐANG NỢ (Outstanding)
    // Cộng dồn tất cả các khoản người khác nợ mình (credits) của tất cả thành viên
    let totalOutstanding = 0;
    data.debts.forEach(member => {
        if (member.credits) {
            member.credits.forEach(c => totalOutstanding += c.amount);
        }
    });

    // 3. Tổng quy mô nợ
    const totalVolume = totalSettled + totalOutstanding;
    
    // 4. Phần trăm
    const percent = totalVolume > 0 ? (totalSettled / totalVolume) * 100 : 0; // Nếu không có nợ thì là 0%

    // Trường hợp đặc biệt: Nếu không có nợ (totalVolume = 0) nhưng có chi tiêu -> Coi như hoàn thành 100%
    const finalPercent = totalVolume === 0 && data.total > 0 ? 100 : percent;

    return { 
        settled: totalSettled, 
        outstanding: totalOutstanding, 
        percent: finalPercent 
    };
  };

  // --- CÁC HÀM XỬ LÝ (Giữ nguyên) ---
  const handleNotifyPayment = async (creditorId, amount) => {
    try {
        await api.post(`/groups/${groupId}/notify-payment`, { creditorId, amount });
        Alert.alert("Đã gửi", "Đã thông báo trả nợ.");
        fetchDebts();
    } catch (error) { Alert.alert("Lỗi", "Không gửi được thông báo"); }
  };

const handleApprove = async (expenseId) => {
    try {
      // Gọi API duyệt chi phí (Backend cần có API này)
      await api.put(`/expenses/${expenseId}/approve`);
      Alert.alert("Thành công", "Đã duyệt chi phí! Nợ đã được tính.");
      fetchDebts(); // Tải lại dữ liệu
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể duyệt chi phí.");
    }
  };

  const handleConfirm = async (expenseId) => {
    try {
        await api.put(`/expenses/${expenseId}/confirm`);
        Alert.alert("Thành công", "Đã xác nhận thanh toán!");
        fetchDebts();
    } catch (error) {
        Alert.alert("Lỗi", "Không thể xác nhận.");
    }
  };

  const handleReject = async (expenseId) => {
    try {
        await api.post(`/expenses/${expenseId}/reject`);
        Alert.alert("Đã hủy", "Đã từ chối thanh toán.");
        fetchDebts();
    } catch (error) { Alert.alert("Lỗi", "Lỗi từ chối"); }
  };

  const handleManualSettle = async () => {
   try {
      // Gọi API duyệt chi phí (Backend cần có API này)
      await api.put(`/expenses/${expenseId}/approve`);
      Alert.alert("Thành công", "Đã duyệt chi phí! Nợ đã được tính.");
      fetchDebts(); // Tải lại dữ liệu
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể duyệt chi phí.");
    }
  };

  const openSettleModal = (debtorId, debtorName, amount) => {
    setSelectedDebtorId(debtorId);
    setSelectedDebtorName(debtorName);
    setSettleAmount(amount.toString());
    setModalVisible(true);
  };

  const openQrModal = (creditor) => {
    if (!creditor.bankBin || !creditor.bankAccount) {
        Alert.alert("Thông báo", `Chủ nợ ${creditor.toName} chưa cập nhật thông tin ngân hàng trong Hồ sơ.`);
        return;
    }
    const removeVietnameseTones = (str) => {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    }
    const content = `${removeVietnameseTones(user.name)} tra no`; 
    const url = `https://img.vietqr.io/image/${creditor.bankBin}-${creditor.bankAccount}-compact2.png?amount=${creditor.amount}&addInfo=${encodeURIComponent(content)}`;
    
    setQrUrl(url);
    setQrInfo({ name: creditor.toName, amount: creditor.amount });
    setQrModalVisible(true);
  };

  const handleSaveQr = async () => {
    try {
        if (permissionResponse?.status !== 'granted') {
            const { status } = await requestPermission();
            if (status !== 'granted') {
                Alert.alert("Lỗi", "Cần cấp quyền truy cập thư viện ảnh để lưu!");
                return;
            }
        }
        const localUri = await captureRef(viewRef, { format: 'png', quality: 1 });
        await MediaLibrary.saveToLibraryAsync(localUri);
        if (localUri) Alert.alert("Thành công", "Đã lưu ảnh QR vào thư viện!");
    } catch (e) {
        console.log(e);
        Alert.alert("Lỗi", "Không thể lưu ảnh.");
    }
  };

  // --- RENDER ---
  
  // ✅ 1. Component Thanh Trạng Thái (MỚI)
  const renderProgressBar = () => {
    const { settled, outstanding, percent } = calculateProgress();
    
    return (
        <View style={styles.progressContainer}>
            <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Tiến độ thanh toán:</Text>
                <Text style={styles.progressPercent}>{percent.toFixed(0)}%</Text>
            </View>
            
            {/* Thanh Bar */}
            <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
            </View>

            <View style={styles.progressStatsRow}>
                <Text style={styles.progressSmallText}>✅ Đã trả: {formatCurrency(settled)}</Text>
                <Text style={styles.progressSmallText}>⏳ Còn nợ: {formatCurrency(outstanding)}</Text>
            </View>
        </View>
    );
  };

const renderPendingExpenses = () => {
    if (!data?.pendingExpenses || data.pendingExpenses.length === 0) return null;
    
    return (
      <View style={styles.pendingContainer}>
        <Text style={styles.pendingHeader}>⏳ Hàng chờ duyệt ({data.pendingExpenses.length})</Text>
        <Text style={{fontSize: 12, color: '#666', marginBottom: 10, fontStyle: 'italic'}}>
            (Tất cả thành viên liên quan phải duyệt thì nợ mới được tính)
        </Text>
        
        {data.pendingExpenses.map((item) => {
            // Tìm xem mình (user hiện tại) nằm ở đâu trong danh sách chia tiền
            // Lưu ý: Backend cần trả về include: { splits: true } trong API get debts
            const mySplit = item.splits?.find(s => s.userId === user.id);
            const hasApproved = mySplit?.hasApproved; // Kiểm tra mình đã duyệt chưa

            return (
              <View key={item.id} style={styles.pendingItem}>
                {/* Bên trái: Thông tin */}
                <View style={{flex: 1, marginRight: 10}}>
                    <Text style={styles.pendingDesc}>{item.description}</Text>
                    <Text style={styles.pendingDetail}>👤 Tạo bởi: {item.paidBy?.name}</Text>
                    {item.dueDate && <Text style={styles.pendingDetail}>📅 Hạn: {new Date(item.dueDate).toLocaleDateString('vi-VN')}</Text>}
                    
                    {/* Hiển thị tiến độ duyệt */}
                    <Text style={{fontSize: 11, color: '#888', marginTop: 3}}>
                       {item.splits.filter(s => s.hasApproved).length}/{item.splits.length} người đã duyệt
                    </Text>
                </View>

                {/* Bên phải: Nút Duyệt hoặc Trạng thái */}
                <View style={{alignItems: 'flex-end', justifyContent: 'center'}}>
                    <Text style={styles.pendingAmount}>{formatCurrency(item.amount)}</Text>
                    
                    {!hasApproved ? (
                        // Nếu chưa duyệt thì hiện nút
                        <TouchableOpacity 
                            style={[styles.actionBtn, styles.confirmBtn, {marginTop: 5}]}
                            onPress={() => handleApprove(item.id)}
                        >
                            <Text style={styles.btnText}>✔ Duyệt</Text>
                        </TouchableOpacity>
                    ) : (
                        // Nếu đã duyệt rồi thì hiện text chờ
                        <Text style={{fontSize: 11, color: '#f39c12', marginTop: 5, fontStyle: 'italic'}}>
                            ⏳ Đang chờ...
                        </Text>
                    )}
                </View>
              </View>
            );
        })}
      </View>
    );
  };

  const renderDebtItem = ({ item }) => {
    const isMe = item.userId === user.id;
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
                        {isMe && !d.pending && (
                            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                <TouchableOpacity style={styles.qrButton} onPress={() => openQrModal(d)}>
                                    <Text style={{fontSize: 20}}>🏧</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.payButton} onPress={() => handleNotifyPayment(d.toId, d.amount)}>
                                    <Text style={styles.btnText}>Đã Trả</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {isMe && d.pending && <Text style={styles.waitingText}>🕒 Chờ xác nhận...</Text>}
                    </View>
                ))}
            </View>
        );
    };

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
      {/* 2. CHÈN THANH TRẠNG THÁI VÀO ĐÂY */}
      <View style={styles.headerBlock}>
          <Text style={styles.summaryText}>Tổng chi tiêu nhóm: {formatCurrency(data?.total || 0)}</Text>
          {renderProgressBar()}
      </View>
      
      <FlatList 
        data={data?.debts} keyExtractor={item => item.userId.toString()} renderItem={renderDebtItem}
        ListHeaderComponent={renderPendingExpenses()} 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      {/* Modal QR Code */}
      <Modal visible={qrModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
            <View style={styles.modalQrView}>
                <View ref={viewRef} collapsable={false} style={styles.qrCaptureArea}>
                    <Text style={styles.modalTitle}>Quét mã để trả tiền</Text>
                    <Text style={{marginBottom: 5}}>Chủ tài khoản: <Text style={{fontWeight:'bold'}}>{qrInfo.name}</Text></Text>
                    <Text style={{marginBottom: 15, fontSize: 18, color: 'green', fontWeight:'bold'}}>{formatCurrency(qrInfo.amount)}</Text>
                    {qrUrl ? (
                        <Image source={{ uri: qrUrl }} style={{ width: 220, height: 220 }} resizeMode="contain" />
                    ) : <ActivityIndicator />}
                    <Text style={{fontSize:10, color:'#999', marginTop:5}}>Được tạo bởi App Chia Tiền</Text>
                </View>
                <View style={{flexDirection:'row', marginTop: 20, width: '100%', justifyContent:'space-between'}}>
                    <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#6c757d', flex: 1, marginRight: 5}]} onPress={() => setQrModalVisible(false)}><Text style={{color:'white', textAlign:'center'}}>Đóng</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#28a745', flex: 1, marginLeft: 5}]} onPress={handleSaveQr}><Text style={{color:'white', textAlign:'center'}}>📸 Lưu ảnh</Text></TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

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
  
  // Header Styles (Thay đổi phần summary cũ)
  headerBlock: { backgroundColor: '#333', padding: 15, borderRadius: 10, marginBottom: 10 },
  summaryText: { color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },

  // Progress Bar Styles (MỚI)
  progressContainer: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 8 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressLabel: { color: '#ddd', fontSize: 12 },
  progressPercent: { color: '#4cd137', fontWeight: 'bold' },
  progressBarBackground: { height: 8, backgroundColor: '#555', borderRadius: 4, overflow: 'hidden', marginBottom: 5 },
  progressBarFill: { height: '100%', backgroundColor: '#4cd137', borderRadius: 4 },
  progressStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressSmallText: { color: '#aaa', fontSize: 11 },

  // Pending Styles
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
  qrButton: { marginRight: 10, padding: 5 },
  actionBtn: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 4, marginLeft: 5 },
  confirmBtn: { backgroundColor: '#28a745' },
  rejectBtn: { backgroundColor: '#dc3545' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 11 },
  waitingText: { fontSize: 11, color: '#e67e22', fontStyle: 'italic' },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalView: { width: '80%', backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 5 },
  modalQrView: { width: '90%', backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 5, alignItems: 'center' },
  qrCaptureArea: { alignItems: 'center', backgroundColor: 'white', padding: 10, borderRadius: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  modalInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginVertical: 10, fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalBtn: { padding: 10, borderRadius: 5, marginLeft: 10 }
});