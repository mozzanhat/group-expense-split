import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api from '../api';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Hàm để tải danh sách nhóm
  const fetchGroups = async () => {
    try {
      const response = await api.get('/groups');
      setGroups(response.data);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải danh sách nhóm.');
      console.error('Fetch groups error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Dùng useFocusEffect thay vì useEffect
  // để nó tự động tải lại data mỗi khi quay lại màn hình này
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchGroups();
    }, [])
  );

  // Hàm cho "Kéo để làm mới"
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGroups();
  }, []);

  // Hàm render một item trong danh sách
  const renderGroupItem = ({ item }) => (
    <TouchableOpacity
      style={styles.groupItem}
      onPress={() => 
        navigation.navigate('GroupDetail', { 
          groupId: item.id, 
          groupName: item.name // Truyền tên nhóm qua để đặt tiêu đề
        })
      }
    >
      <Text style={styles.groupName}>{item.name}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chào, {user?.name}!</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutButton}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        renderItem={renderGroupItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={<Text style={styles.listHeader}>Các nhóm của bạn</Text>}
        ListEmptyComponent={<Text style={styles.emptyText}>Bạn chưa tham gia nhóm nào.</Text>}
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
    paddingTop: 50, // Cho an toàn (dưới tai thỏ)
    backgroundColor: '#f5f5f5',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoutButton: {
    fontSize: 16,
    color: 'red',
  },
  listHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  groupItem: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
    elevation: 2, // Bóng đổ cho Android
    shadowColor: '#000', // Bóng đổ cho iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  groupName: {
    fontSize: 18,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: 'gray',
  },
});