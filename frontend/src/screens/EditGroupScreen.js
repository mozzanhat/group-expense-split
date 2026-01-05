import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import api from '../api';

export default function EditGroupScreen({ route, navigation }) {
  // Nhận ID và Tên cũ từ màn hình trước
  const { groupId, currentName } = route.params;

  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!name.trim()) {
      Alert.alert('Lỗi', 'Tên nhóm không được để trống');
      return;
    }

    setLoading(true);
    try {
      // Gọi API PUT vừa viết
      await api.put(`/groups/${groupId}`, { name: name });
      
      Alert.alert('Thành công', 'Đã đổi tên nhóm!', [
        { 
            text: 'OK', 
            onPress: () => {
                // Quay về và yêu cầu màn hình trước cập nhật lại tên (nếu cần thiết)
                // Tuy nhiên, GroupDetail sẽ tự reload nhờ useFocusEffect
                navigation.goBack();
            } 
        }
      ]);
    } catch (error) {
        const msg = error.response?.data?.message || "Không thể đổi tên.";
        Alert.alert("Lỗi", msg);
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
        autoFocus={true} // Tự động bật bàn phím
      />

      {loading ? (
        <ActivityIndicator size="large" color="blue" />
      ) : (
        <Button title="Lưu Thay Đổi" onPress={handleUpdate} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff', justifyContent: 'center' },
  label: { fontSize: 16, marginBottom: 8, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 18 },
});