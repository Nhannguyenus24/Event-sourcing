import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Paper,
  Divider,
} from '@mui/material';
import {
  AccountBalance,
  TrendingUp,
  TrendingDown,
  Receipt,
  Add as AddIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { queryService } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: accounts = [], isLoading: accountsLoading } = useQuery(
    'accounts',
    queryService.getAllAccounts,
    { refetchInterval: 30000 } // Refresh every 30 seconds
  );

  const { data: recentTransactions = [], isLoading: transactionsLoading } = useQuery(
    'recentTransactions',
    () => queryService.getTransactionHistory({ limit: 10 }),
    { refetchInterval: 30000 }
  );

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const activeAccounts = accounts.filter(account => account.status === 'ACTIVE').length;
  const totalTransactions = recentTransactions.transactions?.length || 0;

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

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
      case 'TRANSFER_IN':
        return 'success';
      case 'WITHDRAWAL':
      case 'TRANSFER_OUT':
        return 'error';
      default:
        return 'default';
    }
  };

  const quickActions = [
    {
      title: 'Create Account',
      description: 'Open a new bank account',
      icon: <AddIcon />,
      action: () => navigate('/accounts/create'),
      color: 'primary',
    },
    {
      title: 'View Accounts',
      description: 'Manage existing accounts',
      icon: <ViewIcon />,
      action: () => navigate('/accounts'),
      color: 'secondary',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <AccountBalance color="primary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Balance
                  </Typography>
                  <Typography variant="h5">
                    {formatCurrency(totalBalance)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <AccountBalance color="secondary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Active Accounts
                  </Typography>
                  <Typography variant="h5">
                    {activeAccounts}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Receipt color="info" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Recent Transactions
                  </Typography>
                  <Typography variant="h5">
                    {totalTransactions}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <TrendingUp color="success" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    System Status
                  </Typography>
                  <Chip label="Online" color="success" size="small" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Transactions */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Transactions
              </Typography>
              <List>
                {recentTransactions.transactions?.slice(0, 5).map((transaction, index) => (
                  <React.Fragment key={transaction.id}>
                    <ListItem>
                      <Box sx={{ mr: 2 }}>
                        {getTransactionIcon(transaction.transactionType)}
                      </Box>
                      <ListItemText
                        primary={transaction.description || transaction.transactionType}
                        secondary={formatDate(transaction.createdAt)}
                      />
                      <ListItemSecondaryAction>
                        <Box display="flex" alignItems="center">
                          <Typography
                            variant="body2"
                            color={getTransactionColor(transaction.transactionType)}
                            sx={{ mr: 1 }}
                          >
                            {transaction.transactionType === 'WITHDRAWAL' || 
                             transaction.transactionType === 'TRANSFER_OUT' ? '-' : '+'}
                            {formatCurrency(transaction.amount)}
                          </Typography>
                          <Chip
                            label={transaction.status}
                            size="small"
                            color={transaction.status === 'COMPLETED' ? 'success' : 'warning'}
                          />
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < 4 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/transactions')}
                >
                  View All Transactions
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <List>
                {quickActions.map((action) => (
                  <ListItem key={action.title} button onClick={action.action}>
                    <Box sx={{ mr: 2, color: `${action.color}.main` }}>
                      {action.icon}
                    </Box>
                    <ListItemText
                      primary={action.title}
                      secondary={action.description}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>

          {/* Account Summary */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account Summary
              </Typography>
              {accounts.slice(0, 3).map((account) => (
                <Box key={account.accountId} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">
                    {account.accountNumber} - {account.ownerName}
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {formatCurrency(account.balance)}
                  </Typography>
                  <Chip
                    label={account.status}
                    size="small"
                    color={account.status === 'ACTIVE' ? 'success' : 'error'}
                  />
                </Box>
              ))}
              {accounts.length > 3 && (
                <Button
                  variant="text"
                  onClick={() => navigate('/accounts')}
                  sx={{ mt: 1 }}
                >
                  View All Accounts
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
} 