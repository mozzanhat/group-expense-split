import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';

export default function DebtsScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { user } = useAuth(); // Vẫn giữ để biết dòng nào là của "Bạn"
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Hàm tải dữ liệu công nợ
  const fetchDebts = async () => {
    try {
      const response = await api.get(`/groups/${groupId}/debts`);
      setData(response.data);
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể tải thông tin nợ.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDebts();
    }, [groupId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDebts();
  };

  // Logic hiển thị từng dòng
  const renderItem = ({ item }) => {
    const isCreditor = item.balance >= 0; // Dương tiền -> Là chủ nợ (Được nhận)
    
    // Kiểm tra xem dòng này có phải là CỦA TÔI không (để thêm chữ 'Bạn')
    const isMe = item.userId === user.id;

    return (
      <View style={styles.card}>
        {/* Hàng 1: Tên và Số tiền đã chi */}
        <View style={styles.row}>
          <Text style={styles.name}>
            {item.name} {isMe ? '(Bạn)' : ''}
          </Text>
          <Text style={styles.paid}>Đã chi: {formatCurrency(item.paid)}</Text>
        </View>

        {/* Hàng 2: Kết quả (Nhận lại hay Phải trả) */}
        <View style={styles.resultRow}>
            <Text style={styles.label}>Kết quả:</Text>
            <Text style={[styles.balance, { color: isCreditor ? 'green' : 'red' }]}>
                {isCreditor ? 'Nhận lại' : 'Phải trả'} {formatCurrency(Math.abs(item.balance))}
            </Text>
        </View>
        
      </View>
    );
  };

  if (loading && !refreshing) return <ActivityIndicator style={styles.center} size="large" />;

  return (
    <View style={styles.container}>
      {/* Phần tổng kết trên đầu */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>Tổng chi tiêu: {formatCurrency(data?.total || 0)}</Text>
        <Text style={styles.summaryText}>Chia đều mỗi người: {formatCurrency(data?.sharePerPerson || 0)}</Text>
      </View>

      {/* Danh sách chi tiết */}
      <FlatList
        data={data?.debts}
        keyExtractor={(item) => item.userId.toString()}
        renderItem={renderItem}
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>Chưa có dữ liệu công nợ.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summary: { backgroundColor: '#333', padding: 20, borderRadius: 10, marginBottom: 15 },
  summaryText: { color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
  card: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 10, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  name: { fontSize: 18, fontWeight: 'bold' },
  paid: { color: 'gray' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#eee', paddingTop: 10 },
  label: { fontSize: 16 },
  balance: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 20, color: 'gray' }
});