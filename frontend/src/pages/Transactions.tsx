import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  TrendingUp,
  TrendingDown,
  Receipt,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { useForm, Controller } from 'react-hook-form';
import { queryService } from '../services/api';
import { formatCurrency, formatDate, getTransactionColor, formatTransactionType } from '../utils/formatters';
import { TransactionFilterDto } from '../types';

interface FilterFormData {
  accountId?: string;
  transactionType?: string;
  fromDate?: string;
  toDate?: string;
  minAmount?: number;
  maxAmount?: number;
  status?: string;
}

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TransactionFilterDto>({
    page: 1,
    limit: 20,
  });
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);

  const { data: transactionData, isLoading, error } = useQuery(
    ['transactions', filters],
    () => queryService.getTransactionHistory(filters),
    { keepPreviousData: true }
  );

  const { control, handleSubmit, reset } = useForm<FilterFormData>({
    defaultValues: {
      accountId: '',
      transactionType: '',
      fromDate: '',
      toDate: '',
      minAmount: undefined,
      maxAmount: undefined,
      status: '',
    },
  });

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    setFilters(prev => ({ ...prev, page: value }));
  };

  const handleFilterSubmit = (data: FilterFormData) => {
    const newFilters: TransactionFilterDto = {
      ...data,
      page: 1,
      limit: 20,
    };
    setFilters(newFilters);
    setPage(1);
    setFilterDialogOpen(false);
  };

  const handleClearFilters = () => {
    reset();
    setFilters({ page: 1, limit: 20 });
    setPage(1);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
      case 'TRANSFER_IN':
        return <TrendingUp color="success" />;
      case 'WITHDRAWAL':
      case 'TRANSFER_OUT':
        return <TrendingDown color="error" />;
      default:
        return <Receipt />;
    }
  };

  const transactionTypes = [
    'DEPOSIT',
    'WITHDRAWAL',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'ROLLBACK',
  ];

  const statusOptions = [
    'PENDING',
    'COMPLETED',
    'FAILED',
    'ROLLED_BACK',
  ];

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load transactions. Please try again.
      </Alert>
    );
  }

  const transactions = transactionData?.transactions || [];
  const pagination = transactionData?.pagination;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Transactions
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => setFilterDialogOpen(true)}
          >
            Filters
          </Button>
          <Button
            variant="outlined"
            onClick={handleClearFilters}
          >
            Clear Filters
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Transactions
              </Typography>
              <Typography variant="h4">
                {pagination?.total || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Completed
              </Typography>
              <Typography variant="h4">
                {transactions.filter(t => t.status === 'COMPLETED').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Pending
              </Typography>
              <Typography variant="h4">
                {transactions.filter(t => t.status === 'PENDING').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Failed
              </Typography>
              <Typography variant="h4">
                {transactions.filter(t => t.status === 'FAILED').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Transactions Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Transaction History
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Account</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {getTransactionIcon(transaction.transactionType)}
                        <Typography variant="body2">
                          {formatTransactionType(transaction.transactionType)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {transaction.accountId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="h6"
                        color={getTransactionColor(transaction.transactionType)}
                      >
                        {transaction.transactionType === 'WITHDRAWAL' || 
                         transaction.transactionType === 'TRANSFER_OUT' ? '-' : '+'}
                        {formatCurrency(transaction.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {transaction.description || 'No description'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={transaction.status}
                        color={transaction.status === 'COMPLETED' ? 'success' : 
                               transaction.status === 'FAILED' ? 'error' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(transaction.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton size="small">
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={pagination.totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Filter Dialog */}
      <Dialog open={filterDialogOpen} onClose={() => setFilterDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Filter Transactions</DialogTitle>
        <form onSubmit={handleSubmit(handleFilterSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="accountId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Account ID"
                      fullWidth
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="transactionType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Transaction Type</InputLabel>
                      <Select {...field} label="Transaction Type">
                        <MenuItem value="">All Types</MenuItem>
                        {transactionTypes.map((type) => (
                          <MenuItem key={type} value={type}>
                            {formatTransactionType(type)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="fromDate"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="From Date"
                      type="date"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="toDate"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="To Date"
                      type="date"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="minAmount"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Minimum Amount"
                      type="number"
                      fullWidth
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="maxAmount"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Maximum Amount"
                      type="number"
                      fullWidth
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select {...field} label="Status">
                        <MenuItem value="">All Statuses</MenuItem>
                        {statusOptions.map((status) => (
                          <MenuItem key={status} value={status}>
                            {status}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFilterDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              Apply Filters
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
} 