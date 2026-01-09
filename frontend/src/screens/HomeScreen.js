import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  RefreshControl, 
  SafeAreaView, 
  StatusBar 
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api from '../api';

// Hàm chọn màu ngẫu nhiên (Pastel colors) cho Avatar dựa trên tên
const getAvatarColor = (name) => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6'];
  const charCode = name.charCodeAt(0);
  return colors[charCode % colors.length];
};

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGroups = async () => {
    try {
      const response = await api.get('/groups');
      setGroups(response.data);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải danh sách nhóm.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchGroups(); }, []));
  const onRefresh = useCallback(() => { setRefreshing(true); fetchGroups(); }, []);

  // --- RENDER CARD NHÓM ---
  const renderGroupItem = ({ item }) => {
    const avatarColor = getAvatarColor(item.name);
    
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('GroupDetail', { groupId: item.id, groupName: item.name })}
      >
        {/* Avatar bên trái */}
        <View style={[styles.avatarContainer, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>

        {/* Nội dung text */}
        <View style={styles.cardContent}>
          <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.groupSubtitle}>Chạm để xem chi tiết</Text>
        </View>

        {/* Icon mũi tên */}
        <View style={styles.iconContainer}>
           <Text style={styles.arrowIcon}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // --- HEADER CỦA LIST (Chứa nút tạo nhóm to đẹp) ---
  const renderListHeader = () => (
    <View style={styles.listHeaderContainer}>
      {/* Hero Banner Button */}
      <TouchableOpacity 
        style={styles.createBanner} 
        activeOpacity={0.8}
        onPress={() => navigation.navigate('CreateGroup')}
      >
        <View>
          <Text style={styles.createBannerTitle}>Tạo Nhóm Mới</Text>
          <Text style={styles.createBannerSubtitle}>Bắt đầu chia sẻ chi tiêu ngay</Text>
        </View>
        <View style={styles.plusIconCircle}>
          <Text style={styles.plusIcon}>+</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Các nhóm của bạn</Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* --- HEADER TRÊN CÙNG --- */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.userNameText}>{user?.name || 'Thành viên'}</Text>
        </View>
        <View style={styles.headerActions}>
           <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.iconBtn}>
              <Text style={{fontSize: 20}}>👤</Text>
           </TouchableOpacity>
           <TouchableOpacity onPress={logout} style={[styles.iconBtn, styles.logoutBtn]}>
              <Text style={{fontSize: 20}}>🚪</Text>
           </TouchableOpacity>
        </View>
      </View>

      {/* --- DANH SÁCH --- */}
      <FlatList
        data={groups}
        renderItem={renderGroupItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderListHeader}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyText}>Chưa có nhóm nào</Text>
            <Text style={styles.emptySubText}>Hãy tạo nhóm để bắt đầu quản lý chi tiêu!</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4A90E2']} />
        }
      />
    </SafeAreaView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa', // Màu nền sáng, hiện đại
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Top Header
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    // Shadow nhẹ cho header
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 3,
    zIndex: 10,
  },
  greetingText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  userNameText: {
    fontSize: 22,
    fontWeight: '800', // Chữ đậm
    color: '#333',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#f0f2f5',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  logoutBtn: {
    backgroundColor: '#fff0f0',
  },

  // List Styles
  listContent: {
    paddingBottom: 40,
  },
  listHeaderContainer: {
    paddingHorizontal: 20,
    paddingTop: 25,
    marginBottom: 10,
  },

  // Banner Button (Nút tạo nhóm)
  createBanner: {
    backgroundColor: '#4A90E2',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // Shadow cho nút nổi bật
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  createBannerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  createBannerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  plusIconCircle: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
    marginTop: -2,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2d3436',
    marginTop: 25,
    marginBottom: 5,
    marginLeft: 5,
  },

  // Group Card Styles
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    // Shadow mềm
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 18, // Bo góc kiểu iOS
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardContent: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2d3436',
    marginBottom: 4,
  },
  groupSubtitle: {
    fontSize: 12,
    color: '#b2bec3',
    fontWeight: '500',
  },
  iconContainer: {
    width: 30, 
    alignItems: 'flex-end'
  },
  arrowIcon: {
    fontSize: 20,
    color: '#dfe6e9',
    fontWeight: 'bold',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    opacity: 0.7,
  },
  emptyIcon: {
    fontSize: 50,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#636e72',
    marginBottom: 5,
  },
  emptySubText: {
    fontSize: 14,
    color: '#b2bec3',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});