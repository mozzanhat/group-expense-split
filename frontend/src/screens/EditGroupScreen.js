import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';

export default function EditGroupScreen({ route, navigation }) {
    const { groupId } = route.params;
    const { user } = useAuth();
    const [pendingExpenses, setPendingExpenses] = useState([]);
    const [groupName, setGroupName] = useState('');

    const fetchData = async () => {
        try {
            // Tận dụng API debts để lấy danh sách pending (đã sửa ở server)
            const res = await api.get(`/groups/${groupId}/debts`);
            setPendingExpenses(res.data.pendingExpenses || []);
            // Gọi thêm API lấy tên nhóm nếu cần
        } catch (error) {
            console.error(error);
        }
    };

    useFocusEffect(useCallback(() => { fetchData(); }, []));

    const handleVote = async (expenseId, action) => {
        try {
            await api.post(`/expenses/${expenseId}/vote`, { action });
            Alert.alert("Thành công", action === "AGREE" ? "Đã đồng ý!" : "Đã từ chối và thoát khỏi khoản chi!");
            fetchData(); // Tải lại để cập nhật danh sách
        } catch (error) {
            console.error(error);
            Alert.alert("Lỗi", "Không thể gửi biểu quyết.");
        }
    };

    const renderPendingItem = ({ item }) => {
        // Kiểm tra xem User hiện tại có nằm trong split và CHƯA duyệt không
        const mySplit = item.splits.find(s => s.userId === user.id);
        
        // Nếu mình không liên quan, hoặc đã duyệt rồi -> Không hiện nút
        if (!mySplit || mySplit.hasApproved) return null;

        return (
            <View style={styles.pendingCard}>
                <Text style={styles.pendingTitle}>{item.description}</Text>
                <Text>Tổng: {formatCurrency(item.amount)} + Lãi: {formatCurrency(item.profit)}</Text>
                <Text style={{fontStyle: 'italic', color: 'gray', marginBottom: 10}}>
                    Cần bạn xác nhận để chuyển sang Hàng chính
                </Text>

                <View style={styles.btnRow}>
                    <TouchableOpacity 
                        style={[styles.btn, styles.btnReject]} 
                        onPress={() => handleVote(item.id, "REJECT")}
                    >
                        <Text style={styles.btnText}>Không đồng ý</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.btn, styles.btnAgree]} 
                        onPress={() => handleVote(item.id, "AGREE")}
                    >
                        <Text style={styles.btnText}>Đồng ý</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.header}>Quản lý nhóm</Text>

            {pendingExpenses.length > 0 && (
                <View>
                    <Text style={styles.sectionTitle}>⚠️ Hàng chờ duyệt ({pendingExpenses.length})</Text>
                    <FlatList 
                        data={pendingExpenses}
                        keyExtractor={item => item.id.toString()}
                        renderItem={renderPendingItem}
                        scrollEnabled={false}
                    />
                </View>
            )}

            {/* Các chức năng khác của EditGroupScreen như Đổi tên, Xóa thành viên... */}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
    header: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 10, color: '#e67e22' },
    pendingCard: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 10, elevation: 3 },
    pendingTitle: { fontSize: 16, fontWeight: 'bold' },
    btnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    btn: { flex: 0.48, padding: 10, borderRadius: 5, alignItems: 'center' },
    btnAgree: { backgroundColor: '#2ecc71' },
    btnReject: { backgroundColor: '#e74c3c' },
    btnText: { color: 'white', fontWeight: 'bold' }
});