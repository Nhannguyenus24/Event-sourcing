import dayjs from 'dayjs';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  return dayjs(dateString).format('MMM DD, YYYY HH:mm');
};

export const formatDateShort = (dateString: string): string => {
  return dayjs(dateString).format('MM/DD/YYYY');
};

export const formatDateTime = (dateString: string): string => {
  return dayjs(dateString).format('MMM DD, YYYY HH:mm:ss');
};

export const formatRelativeTime = (dateString: string): string => {
  return dayjs(dateString).fromNow();
};

export const formatTransactionType = (type: string): string => {
  return type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

export const formatAccountNumber = (accountNumber: string): string => {
  // Format as XXXX-XXXX-XXXX
  return accountNumber.replace(/(\d{4})(?=\d)/g, '$1-');
};

export const formatTransactionId = (transactionId: string): string => {
  // Show only last 8 characters for brevity
  return transactionId.length > 8 ? `...${transactionId.slice(-8)}` : transactionId;
};

export const getStatusColor = (status: string): 'success' | 'error' | 'warning' | 'default' => {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
    case 'COMPLETED':
      return 'success';
    case 'BLOCKED':
    case 'FAILED':
      return 'error';
    case 'PENDING':
      return 'warning';
    default:
      return 'default';
  }
};

export const getTransactionColor = (type: string): 'success' | 'error' | 'info' | 'default' => {
  switch (type.toUpperCase()) {
    case 'DEPOSIT':
    case 'TRANSFER_IN':
      return 'success';
    case 'WITHDRAWAL':
    case 'TRANSFER_OUT':
      return 'error';
    case 'ROLLBACK':
      return 'info';
    default:
      return 'default';
  }
}; 