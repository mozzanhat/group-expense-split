import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, RefreshControl, TouchableOpacity, Button } from 'react-native';
import { useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import api from '../api';
import { formatCurrency, formatDate } from '../utils/format';

export default function GroupDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { groupId, groupName } = route.params;

  const [groupDetails, setGroupDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({ 
      title: groupName,
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => navigation.navigate('AddExpense', { groupId: groupId })}
        >
          <Text style={styles.headerButton}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, groupName, groupId]);

  const fetchGroupDetails = async () => {
    try {
      const response = await api.get(`/groups/${groupId}`);
      setGroupDetails(response.data);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải chi tiết nhóm.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchGroupDetails();
    }, [groupId])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGroupDetails();
  }, [groupId]);

  // --- [MỚI] HÀM XỬ LÝ XÓA CHI PHÍ ---
 // --- HÀM XỬ LÝ KHI NHẤN GIỮ (SỬA HOẶC XÓA) ---
  const handleExpenseAction = (item) => {
    Alert.alert(
      "Tùy chọn",
      `Bạn muốn làm gì với khoản "${item.description}"?`,
      [
        { text: "Hủy", style: "cancel" },
        { 
            text: "Sửa ✏️", 
            onPress: () => navigation.navigate('EditExpense', { expense: item }) 
        },
        { 
          text: "Xóa 🗑️", 
          style: "destructive",
          onPress: () => confirmDelete(item.id) // Gọi hàm xóa riêng
        }
      ]
    );
  };

  // Hàm xóa (tách riêng ra cho gọn)
  const confirmDelete = (expenseId) => {
      api.delete(`/expenses/${expenseId}`)
         .then(() => {
             Alert.alert("Thành công", "Đã xóa.");
             fetchGroupDetails();
         })
         .catch(() => Alert.alert("Lỗi", "Không thể xóa hoặc không có quyền."));
  };
// ------------------------------------

// --- HÀM XỬ LÝ XÓA NHÓM -------------
  const handleDeleteGroup = () => {
    Alert.alert(
      "Cảnh báo",
      "Bạn có chắc chắn muốn xóa nhóm này không? Hành động này không thể hoàn tác.",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Xóa Nhóm", 
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/groups/${groupId}`);
              Alert.alert("Thành công", "Đã xóa nhóm.");
              // Quay về màn hình danh sách nhóm
              navigation.navigate('Home'); 
            } catch (error) {
              // Hiển thị thông báo lỗi từ Backend gửi về
              const msg = error.response?.data?.message || "Không thể xóa nhóm.";
              Alert.alert("Lỗi", msg);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" />;
  }

  if (!groupDetails) {
    return <Text style={styles.emptyText}>Không tìm thấy dữ liệu nhóm.</Text>;
  }

  return (
    <View style={styles.container}>
      {/* 1. KHU VỰC 3 NÚT CHỨC NĂNG (Xếp hàng ngang) */}
      <View style={{ padding: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
         <View style={{ flex: 1, marginRight: 5 }}>
            <Button 
                title="Xem Nợ" 
                color="green"
                onPress={() => navigation.navigate('Debts', { groupId: groupId })} 
            />
         </View>
         <View style={{ flex: 1, marginHorizontal: 5 }}>
            <Button 
                title="Sửa Tên" 
                color="#007AFF" 
                onPress={() => navigation.navigate('EditGroup', { 
                    groupId: groupId, 
                    currentName: groupDetails.name 
                })} 
            />
         </View>
         <View style={{ flex: 1, marginLeft: 5 }}>
            <Button 
                title="Xóa Nhóm" 
                color="red"
                onPress={handleDeleteGroup} 
            />
         </View>
      </View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Thành viên</Text>
        <TouchableOpacity 
            onPress={() => navigation.navigate('InviteMember', { groupId: groupId })}
            style={styles.addButtonSmall}
        >
            <Text style={styles.addButtonText}>+ Thêm</Text>
        </TouchableOpacity>
      </View>

      {/* 2. DANH SÁCH THÀNH VIÊN */}
    <FlatList
        data={groupDetails.members}
        keyExtractor={(item) => item.userId.toString()}
        renderItem={({ item }) => {
          // 1. Kiểm tra xem người này có phải chủ nhóm không
          const isCreator = groupDetails.creatorId === item.userId;

          return (
            <View style={styles.item}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.itemName}>
                    {item.user?.name || 'Thành viên'}
                </Text>
                
                {/* 2. Nếu là chủ nhóm thì hiện cái huy hiệu này lên */}
                {isCreator && (
                    <View style={styles.adminBadge}>
                        <Text style={styles.adminText}>Trưởng nhóm</Text>
                    </View>
                )}
              </View>
              
              <Text style={styles.itemSubtitle}>{item.user?.email}</Text>
            </View>
          );
        }}
        style={{ flexGrow: 0, marginBottom: 10 }} 

      />
      {/* 3. DANH SÁCH CHI PHÍ */}
      <Text style={styles.sectionTitle}>Chi phí</Text>
      <Text style={{paddingHorizontal: 16, color: '#666', fontSize: 12, marginBottom: 5}}>
        (Nhấn giữ vào khoản chi để tùy chọn)
      </Text>
      
      <FlatList
        data={groupDetails.expenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.item}
            onLongPress={() => handleExpenseAction(item)} 
            delayLongPress={500} 
            activeOpacity={0.7} 
          >
            <View style={styles.rowBetween}>
                <Text style={styles.itemName}>{item.description}</Text>
                <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
            </View>
            
            <Text style={styles.amountText}>
              {formatCurrency(item.amount)}
            </Text>
            
            <Text style={styles.itemSubtitle}>
              Trả bởi: {item.paidBy?.name || 'Không rõ'}
            </Text>
          </TouchableOpacity>
        )}
        style={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>Chưa có chi phí nào.</Text>}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  list: {
    marginBottom: 10,
  },
  item: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemSubtitle: {
    fontSize: 14,
    color: 'gray',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: 'gray',
  },
  headerButton: {
    fontSize: 30,
    color: 'blue', 
    marginRight: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32', 
    marginVertical: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#888',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 10,
    backgroundColor: '#eee'
  },
  addButtonSmall: {
    backgroundColor: '#007AFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },  
  adminBadge: {
    backgroundColor: '#ffeb3b', // Màu vàng nhạt
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#fbc02d',
  },
  adminText: {
    color: '#f57f17', // Chữ màu cam đậm
    fontSize: 10,
    fontWeight: 'bold',
  },
});