import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useQuery } from 'react-query';
import { queryService } from '../services/api';
import { formatCurrency } from '../utils/formatters';

export default function Analytics() {
  const { data: dailyStats, isLoading: statsLoading, error: statsError } = useQuery(
    'dailyStats',
    () => queryService.getDailyTransactionStats(30)
  );

  const { data: accounts = [], isLoading: accountsLoading } = useQuery(
    'accounts',
    queryService.getAllAccounts
  );

  if (statsLoading || accountsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (statsError) {
    return (
      <Alert severity="error">
        Failed to load analytics data. Please try again.
      </Alert>
    );
  }

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const activeAccounts = accounts.filter(account => account.status === 'ACTIVE').length;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Analytics
      </Typography>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Balance
              </Typography>
              <Typography variant="h4">
                {formatCurrency(totalBalance)}
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
                {activeAccounts}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Transactions
              </Typography>
              <Typography variant="h4">
                {dailyStats?.totalTransactions || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Volume
              </Typography>
              <Typography variant="h4">
                {formatCurrency(dailyStats?.totalVolume || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Transaction Volume (Last 30 Days)
              </Typography>
              <Box height={300} display="flex" alignItems="center" justifyContent="center">
                <Typography color="textSecondary">
                  Chart component would go here
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account Distribution
              </Typography>
              <Box height={300} display="flex" alignItems="center" justifyContent="center">
                <Typography color="textSecondary">
                  Pie chart would go here
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Daily Transaction Trends
              </Typography>
              <Box height={400} display="flex" alignItems="center" justifyContent="center">
                <Typography color="textSecondary">
                  Line chart would go here
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
} 