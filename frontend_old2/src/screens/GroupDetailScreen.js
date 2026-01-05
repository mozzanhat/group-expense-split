import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import api from '../api';

import { TouchableOpacity } from 'react-native'; // Import

export default function GroupDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { groupId, groupName } = route.params;

  const [groupDetails, setGroupDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Đặt tiêu đề của màn hình bằng tên nhóm đã được truyền qua
 React.useLayoutEffect(() => {
    navigation.setOptions({ 
      title: groupName,
      // Thêm nút (+) vào bên phải tiêu đề
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => navigation.navigate('AddExpense', { groupId: groupId })}
        >
          <Text style={styles.headerButton}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, groupName, groupId]); // Thêm groupId vào dependency

  // Hàm tải chi tiết nhóm
  const fetchGroupDetails = async () => {
    try {
      const response = await api.get(`/groups/${groupId}`);
      setGroupDetails(response.data);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải chi tiết nhóm.');
      console.error('Fetch group details error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Tải dữ liệu mỗi khi vào màn hình
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchGroupDetails();
    }, [groupId])
  );

  // Hàm "Kéo để làm mới"
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGroupDetails();
  }, [groupId]);

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" />;
  }

  if (!groupDetails) {
    return <Text style={styles.emptyText}>Không tìm thấy dữ liệu nhóm.</Text>;
  }

  return (
    <View style={styles.container}>
      {/* PHẦN 1: DANH SÁCH THÀNH VIÊN */}
      <Text style={styles.sectionTitle}>Thành viên</Text>
      <FlatList
        data={groupDetails.members}
        keyExtractor={(item) => item.userId.toString()}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemName}>{item.user.name}</Text>
            <Text style={styles.itemSubtitle}>{item.user.email}</Text>
          </View>
        )}
        style={styles.list}
      />

      {/* PHẦN 2: DANH SÁCH CHI PHÍ */}
      <Text style={styles.sectionTitle}>Chi phí</Text>
      <FlatList
        data={groupDetails.expenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemName}>{item.description}</Text>
            <Text style={styles.itemSubtitle}>
              {item.amount} VNĐ - (Trả bởi: {item.paidBy.name})
            </Text>
          </View>
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
    padding: 16,
    paddingBottom: 10,
    backgroundColor: '#eee'
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
    color: 'blue', // (Bạn có thể đổi màu)
    marginRight: 10,
  },
});