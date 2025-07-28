import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Fab,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  AccountBalance,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { queryService, commandService, handleApiError } from '../services/api';
import { formatCurrency, formatDate, getStatusColor } from '../utils/formatters';
import { CreateAccountDto } from '../types';

interface CreateAccountFormData {
  accountNumber: string;
  ownerName: string;
  initialBalance: number | string;
}

export default function Accounts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  const { data: accounts = [], isLoading, error, refetch } = useQuery(
    'accounts',
    queryService.getAllAccounts,
    { 
      refetchInterval: 30000,
      staleTime: 0, // Always consider data stale
      cacheTime: 0, // Don't cache
    }
  );

  const createAccountMutation = useMutation(
    (data: CreateAccountDto) => commandService.createAccount(data),
    {
      onSuccess: (response) => {
        console.log('Account creation response:', response);
        toast.success('Account created successfully!');
        // Force refetch the accounts data
        queryClient.invalidateQueries('accounts');
        queryClient.refetchQueries('accounts');
        // Also manually refetch
        refetch();
        setCreateDialogOpen(false);
      },
      onError: (error) => {
        console.error('Account creation error:', error);
        toast.error(handleApiError(error));
      },
    }
  );

  const blockAccountMutation = useMutation(
    (data: { accountId: string; reason: string }) => commandService.blockAccount(data),
    {
      onSuccess: () => {
        toast.success('Account blocked successfully!');
        queryClient.invalidateQueries('accounts');
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  const { control, handleSubmit, reset, formState: { errors } } = useForm<CreateAccountFormData>({
    defaultValues: {
      accountNumber: '',
      ownerName: '',
      initialBalance: 0,
    },
    mode: 'onChange',
  });

  const onSubmit = (data: CreateAccountFormData) => {
    // Ensure initialBalance is a number
    const formData = {
      ...data,
      initialBalance: Number(data.initialBalance) || 0
    };
    createAccountMutation.mutate(formData);
  };

  const handleCreateAccount = () => {
    reset();
    setCreateDialogOpen(true);
  };

  const handleBlockAccount = (accountId: string) => {
    const reason = prompt('Enter reason for blocking account:');
    if (reason) {
      blockAccountMutation.mutate({ accountId, reason });
    }
  };

  const handleViewAccount = (account: any) => {
    setSelectedAccount(account);
    navigate(`/accounts/${account.accountId}`);
  };

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
        Failed to load accounts. Please try again.
      </Alert>
    );
  }
  console.log('Current accounts data:', accounts);
  console.log('Accounts length:', accounts.length);
  console.log('Is loading:', isLoading);
  console.log('Error:', error);


  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Accounts
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            onClick={() => {
              console.log('Manual refresh clicked');
              refetch();
            }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateAccount}
          >
            Create Account
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Accounts
              </Typography>
              <Typography variant="h4">
                {accounts.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Accounts
              </Typography>
              <Typography variant="h4">
                {accounts.filter(a => a.status === 'ACTIVE').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Balance
              </Typography>
              <Typography variant="h4">
                {formatCurrency(accounts.reduce((sum, a) => sum + a.balance, 0))}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Average Balance
              </Typography>
              <Typography variant="h4">
                {formatCurrency(accounts.length > 0 ? accounts.reduce((sum, a) => sum + a.balance, 0) / accounts.length : 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Accounts Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Account List
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Account Number</TableCell>
                  <TableCell>Owner Name</TableCell>
                  <TableCell>Balance</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.accountId} hover>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {account.accountNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>{account.ownerName}</TableCell>
                    <TableCell>
                      <Typography variant="h6" color="primary">
                        {formatCurrency(account.balance)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={account.status}
                        color={getStatusColor(account.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(account.createdAt)}</TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleViewAccount(account)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        {account.status === 'ACTIVE' && (
                          <Tooltip title="Block Account">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleBlockAccount(account.accountId)}
                            >
                              <BlockIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Create Account Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Account</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="accountNumber"
                  control={control}
                  rules={{ required: 'Account number is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Account Number"
                      fullWidth
                      error={!!errors.accountNumber}
                      helperText={errors.accountNumber?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="ownerName"
                  control={control}
                  rules={{ required: 'Owner name is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Owner Name"
                      fullWidth
                      error={!!errors.ownerName}
                      helperText={errors.ownerName?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="initialBalance"
                  control={control}
                  rules={{ 
                    required: 'Initial balance is required',
                    min: { value: 0, message: 'Balance must be non-negative' }
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Initial Balance"
                      type="number"
                      inputProps={{ min: 0, step: 1 }}
                      fullWidth
                      error={!!errors.initialBalance}
                      helperText={errors.initialBalance?.message}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        field.onChange(value);
                      }}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createAccountMutation.isLoading}
            >
              {createAccountMutation.isLoading ? <CircularProgress size={20} /> : 'Create Account'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleCreateAccount}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
} 