import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, 
  Alert, ActivityIndicator, Modal, FlatList, Button 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../api';

// Danh sách ngân hàng
const BANK_LIST = [
  { name: "Vietcombank", code: "VCB", bin: "970436", shortName: "Vietcombank" },
  { name: "MBBank", code: "MB", bin: "970422", shortName: "MB" },
  { name: "Techcombank", code: "TCB", bin: "970407", shortName: "Techcombank" },
  { name: "ACB", code: "ACB", bin: "970416", shortName: "ACB" },
  { name: "VietinBank", code: "ICB", bin: "970415", shortName: "VietinBank" },
  { name: "BIDV", code: "BIDV", bin: "970418", shortName: "BIDV" },
  { name: "VPBank", code: "VPB", bin: "970432", shortName: "VPBank" },
  { name: "TPBank", code: "TPB", bin: "970423", shortName: "TPBank" },
  { name: "Sacombank", code: "STB", bin: "970403", shortName: "Sacombank" },
  { name: "HDBank", code: "HDB", bin: "970437", shortName: "HDBank" },
  { name: "VIB", code: "VIB", bin: "970441", shortName: "VIB" },
  { name: "Agribank", code: "VBA", bin: "970405", shortName: "Agribank" },
  { name: "OCB", code: "OCB", bin: "970448", shortName: "OCB" },
  { name: "MSB", code: "MSB", bin: "970426", shortName: "MSB" },
  { name: "SHB", code: "SHB", bin: "970443", shortName: "SHB" },
  { name: "Eximbank", code: "EIB", bin: "970431", shortName: "Eximbank" },
  { name: "SeABank", code: "SEAB", bin: "970440", shortName: "SeABank" },
  { name: "Nam A Bank", code: "NAB", bin: "970428", shortName: "NamABank" },
  { name: "LienVietPostBank", code: "LPB", bin: "970449", shortName: "LienVietPostBank" },
  { name: "Timo", code: "TIMO", bin: "963388", shortName: "Timo" },
  { name: "Viettel Money", code: "VTLMONEY", bin: "971005", shortName: "ViettelMoney" },
  { name: "VNPT Money", code: "VNPTMONEY", bin: "971011", shortName: "VNPTMoney" },
];

export default function ProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '', // Chỉ gửi đi nếu muốn đổi pass
    phone: '',
    address: '',
    gender: 'Nam',
    dob: new Date(),
    cccd: '',
    bankAccount: '',
    bankBin: '',
    bankName: ''
  });

  // UI State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [modalVisible, setModalVisible] = useState(false); // Modal chọn ngân hàng

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/profile');
      const user = res.data;
      
      setFormData({
        ...user,
        dob: user.dob ? new Date(user.dob) : new Date(),
        password: '' // Không hiển thị pass cũ
      });
    } catch (error) {
      Alert.alert("Lỗi", "Không thể tải thông tin cá nhân");
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    // 1. Số điện thoại (10 số, bắt đầu bằng 0)
    const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
    if (formData.phone && !phoneRegex.test(formData.phone)) {
      Alert.alert("Lỗi", "Số điện thoại không đúng định dạng VN");
      return false;
    }

    // 2. CCCD (12 số)
    if (formData.cccd && formData.cccd.length !== 12) {
      Alert.alert("Lỗi", "CCCD phải có đúng 12 chữ số");
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await api.put('/profile', formData);
      Alert.alert("Thành công", "Đã cập nhật thông tin!");
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.error || "Lỗi cập nhật";
      Alert.alert("Thất bại", msg);
    } finally {
      setLoading(false);
    }
  };

  const renderBankItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.bankItem}
      onPress={() => {
        setFormData({ ...formData, bankBin: item.bin, bankName: item.shortName });
        setModalVisible(false);
      }}
    >
      <Text style={styles.bankName}>{item.shortName} - {item.name}</Text>
    </TouchableOpacity>
  );

  if (loading && !formData.email) return <ActivityIndicator size="large" style={{flex:1}} />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Thông Tin Tài Khoản</Text>

      {/* --- THÔNG TIN CÁ NHÂN --- */}
      <View style={styles.section}>
        <Text style={styles.label}>Tên đăng nhập</Text>
        <TextInput 
          style={styles.input} value={formData.name} 
          onChangeText={t => setFormData({...formData, name: t})} 
        />

        <Text style={styles.label}>Email (Không thể sửa)</Text>
        <TextInput style={[styles.input, {backgroundColor: '#eee'}]} value={formData.email} editable={false} />

        <Text style={styles.label}>Họ và tên đầy đủ</Text>
        <TextInput 
          style={styles.input} value={formData.username} 
          onChangeText={t => setFormData({...formData, username: t})} 
          placeholder="VD: Nguyễn Văn A"
        />

        <Text style={styles.label}>Mật khẩu mới (Để trống nếu không đổi)</Text>
        <TextInput 
          style={styles.input} value={formData.password} 
          onChangeText={t => setFormData({...formData, password: t})} 
          secureTextEntry placeholder="******"
        />

        <Text style={styles.label}>Số điện thoại</Text>
        <TextInput 
          style={styles.input} value={formData.phone} 
          onChangeText={t => setFormData({...formData, phone: t})} 
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Địa chỉ</Text>
        <TextInput 
          style={styles.input} value={formData.address} 
          onChangeText={t => setFormData({...formData, address: t})} 
        />

        <Text style={styles.label}>Giới tính</Text>
        <View style={styles.row}>
          {['Nam', 'Nữ', 'Khác'].map(g => (
            <TouchableOpacity 
              key={g} 
              style={[styles.genderBtn, formData.gender === g && styles.genderBtnSelected]}
              onPress={() => setFormData({...formData, gender: g})}
            >
              <Text style={formData.gender === g ? {color:'white', fontWeight:'bold'} : {color: '#333'}}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Ngày sinh</Text>
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateBtn}>
          <Text>{formData.dob ? formData.dob.toLocaleDateString('vi-VN') : 'Chọn ngày'}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={formData.dob || new Date()}
            mode="date" display="default"
            onChange={(e, d) => { setShowDatePicker(false); if(d) setFormData({...formData, dob: d}); }}
          />
        )}

        <Text style={styles.label}>CCCD (12 số)</Text>
        <TextInput 
          style={styles.input} value={formData.cccd} 
          onChangeText={t => setFormData({...formData, cccd: t})} 
          keyboardType="numeric" maxLength={12}
        />
      </View>

      {/* --- THÔNG TIN NGÂN HÀNG --- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tài Khoản Ngân Hàng</Text>
        
        <Text style={styles.label}>Ngân hàng</Text>
        <TouchableOpacity style={styles.dropdownBtn} onPress={() => setModalVisible(true)}>
          <Text style={{fontWeight: 'bold'}}>
            {formData.bankName ? `${formData.bankName}` : "-- Chọn ngân hàng --"}
          </Text>
          <Text>▼</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Số tài khoản</Text>
        <TextInput 
          style={styles.input} value={formData.bankAccount} 
          onChangeText={t => setFormData({...formData, bankAccount: t})} 
          keyboardType="numeric" placeholder="Nhập số tài khoản"
        />
      </View>

      <TouchableOpacity 
  style={styles.bigButton} 
  onPress={handleSave}
  activeOpacity={0.7} // Hiệu ứng mờ khi ấn vào
>
  {loading ? (
    <ActivityIndicator color="white" />
  ) : (
    <Text style={styles.bigButtonText}>LƯU THÔNG TIN</Text>
  )}
</TouchableOpacity>

      {/* --- MODAL CHỌN NGÂN HÀNG --- */}
      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Chọn Ngân Hàng</Text>
          <FlatList
            data={BANK_LIST}
            keyExtractor={item => item.bin}
            renderItem={renderBankItem}
          />
          <Button title="Đóng" color="red" onPress={() => setModalVisible(false)} />
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  section: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#007bff' },
  label: { fontSize: 14, color: '#555', marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, fontSize: 16 },
  
  // Gender
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  genderBtn: { flex: 1, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginHorizontal: 2 },
  genderBtnSelected: { backgroundColor: '#007bff', borderColor: '#007bff' },

  // Date
  dateBtn: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 5, alignItems: 'center', backgroundColor: '#f9f9f9' },

  // Bank Dropdown
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 5, backgroundColor: '#f9f9f9' },

  // Modal
  modalContainer: { flex: 1, padding: 20, paddingTop: 50 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  bankItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  bankName: { fontSize: 16 },

  bigButton: {
    backgroundColor: '#007bff', // Màu xanh
    paddingVertical: 16,        // Tăng chiều cao nút (quan trọng để dễ ấn)
    borderRadius: 10,           // Bo góc tròn
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,              // Cách phần trên một chút
    marginBottom: 50,           // Cách đáy màn hình 50px (đẩy cao lên để ngón cái dễ với tới)
    elevation: 3,               // Đổ bóng nhẹ (Android)
    shadowColor: '#000',        // Đổ bóng nhẹ (iOS)
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  bigButtonText: {
    color: 'white',
    fontSize: 18,               // Chữ to rõ
    fontWeight: 'bold',
  },
});