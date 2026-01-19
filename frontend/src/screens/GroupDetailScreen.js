import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, RefreshControl, TouchableOpacity, Button, ScrollView } from 'react-native';
import { useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import api from '../api';
import { formatCurrency, formatDate } from '../utils/format';

// Component Thanh tiến độ nhỏ
const ProgressBar = ({ progress }) => {
  return (
    <View style={{ height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${Math.min(progress * 100, 100)}%`, backgroundColor: progress >= 1 ? '#4caf50' : '#2196f3' }} />
    </View>
  );
};

export default function GroupDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { groupId, groupName } = route.params;

  const [groupDetails, setGroupDetails] = useState(null);
  const [fundraisings, setFundraisings] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({ 
      title: groupName,
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => navigation.navigate('CreateFundraising', { groupId: groupId })}
        >
          <Text style={styles.headerButton}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, groupName, groupId]);

  const fetchData = async () => {
    try {
      const [groupRes, fundRes] = await Promise.all([
        api.get(`/groups/${groupId}`),
        api.get(`/groups/${groupId}/fundraisings`) 
      ]);
      
      setGroupDetails(groupRes.data);
      setFundraisings(fundRes.data);
    } catch (error) {
      console.log(error);
      Alert.alert('Lỗi', 'Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [groupId])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [groupId]);

  const handleExpenseAction = (item) => {
      Alert.alert("Tùy chọn", `Xử lý khoản chi: ${item.description}`, [
          { text: "Hủy", style: "cancel" },
          { text: "Xóa", style: "destructive", onPress: () => confirmDelete(item.id) }
      ]);
  };
  
  const confirmDelete = async (id) => {
      try { await api.delete(`/expenses/${id}`); fetchData(); } 
      catch (e) { Alert.alert("Lỗi", "Không thể xóa"); }
  }

  const handleDeleteGroup = () => {
    Alert.alert("Cảnh báo", "Bạn có chắc muốn xóa nhóm?", [
        { text: "Hủy", style: "cancel" },
        { text: "Xóa", style: "destructive", onPress: async () => {
            try { await api.delete(`/groups/${groupId}`); navigation.navigate('Home'); }
            catch (e) { Alert.alert("Lỗi", "Không thể xóa nhóm"); }
        }}
    ]);
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" />;
  if (!groupDetails) return <Text style={styles.emptyText}>Lỗi dữ liệu.</Text>;

  const renderFundraisingItem = ({ item }) => {
    const progress = item.currentAmount / item.targetAmount;
    return (
      <TouchableOpacity 
        style={styles.fundItem}
        onPress={() => navigation.navigate('FundraisingDetail', { fundraisingId: item.id, groupId })}
      >
        <View style={styles.rowBetween}>
          <Text style={styles.fundTitle}>📢 {item.description}</Text>
          <Text style={styles.fundPercent}>{item.interestRate}% lãi</Text>
        </View>
        <Text style={styles.fundAmount}>Mục tiêu: {formatCurrency(item.targetAmount)}</Text>
        <ProgressBar progress={progress} />
        <View style={styles.rowBetween}>
           <Text style={styles.fundStatusText}>Đã góp: <Text style={{fontWeight:'bold', color: '#2196f3'}}>{formatCurrency(item.currentAmount)}</Text></Text>
           <Text style={styles.fundStatusText}>{(progress * 100).toFixed(0)}%</Text>
        </View>
        {progress < 1 && (
           <Text style={{fontSize: 11, color: '#f57f17', marginTop: 4, fontStyle:'italic'}}>
             Còn thiếu: {formatCurrency(item.targetAmount - item.currentAmount)}
           </Text>
        )}
      </TouchableOpacity>
    );
  };

  // ✅ Render Item Thành viên (Hiển thị ngang)
  const renderMemberItem = ({ item }) => (
    <View style={styles.memberChip}>
        <Text style={styles.memberName}>{item.user?.name || item.user?.email}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 1. Menu Chức năng */}
      <View style={styles.actionRow}>
         <Button title="Xem Nợ" color="green" onPress={() => navigation.navigate('Debts', { groupId })} />
         <Button title="Sửa Tên" color="#007AFF" onPress={() => navigation.navigate('EditGroup', { groupId, currentName: groupDetails.name })} />
         <Button title="Xóa Nhóm" color="red" onPress={handleDeleteGroup} />
      </View>

      {/* ✅ 2. KHU VỰC THÀNH VIÊN (MỚI THÊM) */}
      <View style={styles.memberSection}>
          <View style={styles.rowBetween}>
             <Text style={styles.sectionTitle}>
                Thành viên ({groupDetails.members?.length || 0})
             </Text>
             <TouchableOpacity 
                style={styles.addMemberBtn}
                onPress={() => navigation.navigate('InviteMember', { groupId })}
             >
                <Text style={styles.addMemberText}>+ Thêm</Text>
             </TouchableOpacity>
          </View>
          
          {/* Danh sách thành viên cuộn ngang */}
          <FlatList 
             horizontal
             data={groupDetails.members}
             keyExtractor={item => item.userId.toString()}
             renderItem={renderMemberItem}
             showsHorizontalScrollIndicator={false}
             style={{ marginLeft: 16, marginBottom: 5 }}
          />
      </View>

      {/* 3. KHU VỰC GỌI VỐN */}
      {fundraisings.length > 0 && (
        <View>
            <Text style={[styles.sectionTitle, {color: '#e65100', marginTop: 5}]}>🔥 Đang Gọi Vốn</Text>
            <FlatList 
                data={fundraisings}
                keyExtractor={item => item.id.toString()}
                renderItem={renderFundraisingItem}
                style={{maxHeight: 200, marginBottom: 5}}
            />
        </View>
      )}

      {/* 4. Danh sách Chi phí cũ */}
      <Text style={styles.sectionTitle}>Lịch sử Chi phí</Text>
      <FlatList
        data={groupDetails.expenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.item}
            onLongPress={() => handleExpenseAction(item)}
          >
            <View style={styles.rowBetween}>
                <Text style={styles.itemName}>{item.description}</Text>
                <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
            </View>
            <Text style={styles.amountText}>{formatCurrency(item.amount)}</Text>
            <Text style={styles.itemSubtitle}>
                {item.isApproved ? "✅ Đã duyệt" : "⏳ Đang chờ duyệt"} - Trả bởi: {item.paidBy?.name}
            </Text>
          </TouchableOpacity>
        )}
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.emptyText}>Chưa có chi phí nào.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  actionRow: { padding: 10, flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', marginBottom: 5, elevation: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 16, marginTop: 10, marginBottom: 5, color: '#333' },
  headerButton: { fontSize: 30, color: 'blue', marginRight: 10 },
  list: { marginBottom: 10 },
  emptyText: { textAlign: 'center', marginTop: 20, color: '#999' },
  
  // Style Item Chi phí
  item: { backgroundColor: 'white', padding: 12, marginHorizontal: 10, marginBottom: 8, borderRadius: 8, elevation: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 16, fontWeight: '500' },
  amountText: { fontSize: 18, fontWeight: 'bold', color: '#2e7d32' },
  dateText: { fontSize: 12, color: '#888' },
  itemSubtitle: { fontSize: 12, color: '#666' },

  // Style Gọi Vốn
  fundItem: { 
    backgroundColor: '#fff3e0', padding: 12, marginHorizontal: 10, marginBottom: 8, 
    borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#ff9800', elevation: 2 
  },
  fundTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  fundPercent: { fontSize: 12, fontWeight: 'bold', color: '#bf360c', backgroundColor: '#ffccbc', paddingHorizontal: 6, borderRadius: 4 },
  fundAmount: { fontSize: 14, color: '#555', marginVertical: 4 },
  fundStatusText: { fontSize: 12, color: '#555', marginTop: 4 },

  // ✅ Style Thành viên mới
  memberSection: { backgroundColor: '#fff', paddingBottom: 10, marginBottom: 5 },
  addMemberBtn: { backgroundColor: '#007AFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15, marginRight: 16 },
  addMemberText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  memberChip: { backgroundColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#ddd' },
  memberName: { fontSize: 14, color: '#333', fontWeight: '500' }
});