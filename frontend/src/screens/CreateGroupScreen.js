import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import api from '../api'; // File cấu hình axios của bạn

export default function CreateGroupScreen({ navigation }) {
  const [groupName, setGroupName] = useState('');

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Lỗi', 'Tên nhóm không được để trống');
      return;
    }

    try {
      await api.post('/groups', { name: groupName });
      Alert.alert('Thành công', 'Đã tạo nhóm mới!');
      navigation.goBack(); // Quay lại màn hình trước
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tạo nhóm. Vui lòng thử lại.');
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Tên nhóm:</Text>
      <TextInput
        style={styles.input}
        value={groupName}
        onChangeText={setGroupName}
        placeholder="Nhập tên nhóm..."
      />
      <Button title="Tạo Nhóm" onPress={handleCreateGroup} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  label: { fontSize: 18, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 20, borderRadius: 5 },
});