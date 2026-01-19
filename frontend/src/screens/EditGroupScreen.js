import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import api from '../api';

export default function EditGroupScreen({ route, navigation }) {
  // Lấy dữ liệu từ params (được truyền từ GroupDetail)
  const { groupId, currentName } = route.params;
  
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!name.trim()) {
      Alert.alert("Lỗi", "Tên nhóm không được để trống");
      return;
    }

    setLoading(true);
    try {
      await api.put(`/groups/${groupId}`, { name });
      Alert.alert("Thành công", "Đã đổi tên nhóm!");
      
      // Quay lại và báo cho màn hình trước biết cần load lại
      navigation.goBack(); 
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể cập nhật tên nhóm");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Tên nhóm mới:</Text>
      <TextInput 
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Nhập tên nhóm..."
      />
      
      {loading ? (
        <ActivityIndicator color="blue" />
      ) : (
        <Button title="Lưu Thay Đổi" onPress={handleUpdate} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontSize: 16, marginBottom: 10, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 20, fontSize: 16 }
});