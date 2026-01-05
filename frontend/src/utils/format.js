// Hàm định dạng tiền tệ VNĐ (Ví dụ: 20000 -> 20.000 ₫)
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};

// Hàm định dạng ngày tháng (Ví dụ: 2025-10-30 -> 30/10/2025)
export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('vi-VN');
};