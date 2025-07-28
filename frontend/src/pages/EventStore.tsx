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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  Timeline as EventIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { useForm, Controller } from 'react-hook-form';
import { eventStoreService } from '../services/api';
import { formatDateTime, formatRelativeTime } from '../utils/formatters';
import { DomainEvent } from '../types';

interface FilterFormData {
  aggregateId?: string;
  eventType?: string;
  fromDate?: string;
  toDate?: string;
}

export default function EventStore() {
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<DomainEvent | null>(null);

  const { data: events = [], isLoading, error } = useQuery(
    ['events', page, limit, offset],
    () => eventStoreService.getAllEvents(limit, offset),
    { keepPreviousData: true }
  );

  const { control, handleSubmit, reset } = useForm<FilterFormData>({
    defaultValues: {
      aggregateId: '',
      eventType: '',
      fromDate: '',
      toDate: '',
    },
  });

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    setOffset((value - 1) * limit);
  };

  const handleFilterSubmit = (data: FilterFormData) => {
    // Apply filters - in a real app, you'd pass these to the API
    console.log('Applying filters:', data);
    setFilterDialogOpen(false);
  };

  const handleClearFilters = () => {
    reset();
  };

  const handleViewEvent = (event: DomainEvent) => {
    setSelectedEvent(event);
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'AccountCreated':
        return 'success';
      case 'MoneyDeposited':
        return 'primary';
      case 'MoneyWithdrawn':
        return 'warning';
      case 'MoneyTransferred':
        return 'info';
      case 'TransactionRolledBack':
        return 'error';
      default:
        return 'default';
    }
  };

  const eventTypes = [
    'AccountCreated',
    'MoneyDeposited',
    'MoneyWithdrawn',
    'MoneyTransferred',
    'MoneyReceived',
    'TransactionRolledBack',
    'AccountBlocked',
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
        Failed to load events. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Event Store
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
                Total Events
              </Typography>
              <Typography variant="h4">
                {events.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Event Types
              </Typography>
              <Typography variant="h4">
                {new Set(events.map(e => e.eventType)).size}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Aggregates
              </Typography>
              <Typography variant="h4">
                {new Set(events.map(e => e.aggregateId)).size}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Latest Event
              </Typography>
              <Typography variant="body2">
                {events.length > 0 ? formatRelativeTime(events[0].occurredOn) : 'N/A'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Events Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Domain Events
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Event Type</TableCell>
                  <TableCell>Aggregate ID</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.eventId} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <EventIcon color="primary" />
                        <Chip
                          label={event.eventType}
                          color={getEventColor(event.eventType)}
                          size="small"
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" noWrap>
                        {event.aggregateId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {event.version}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDateTime(event.occurredOn)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Event Details">
                        <IconButton
                          size="small"
                          onClick={() => handleViewEvent(event)}
                        >
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
          <Box display="flex" justifyContent="center" mt={3}>
            <Pagination
              count={Math.ceil(events.length / limit)}
              page={page}
              onChange={handlePageChange}
              color="primary"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Filter Dialog */}
      <Dialog open={filterDialogOpen} onClose={() => setFilterDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Filter Events</DialogTitle>
        <form onSubmit={handleSubmit(handleFilterSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="aggregateId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Aggregate ID"
                      fullWidth
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="eventType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Event Type</InputLabel>
                      <Select {...field} label="Event Type">
                        <MenuItem value="">All Types</MenuItem>
                        {eventTypes.map((type) => (
                          <MenuItem key={type} value={type}>
                            {type}
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
                      type="datetime-local"
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
                      type="datetime-local"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
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

      {/* Event Details Dialog */}
      <Dialog
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedEvent && (
          <>
            <DialogTitle>
              Event Details: {selectedEvent.eventType}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Event Information
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary">
                      Event ID: {selectedEvent.eventId}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Aggregate ID: {selectedEvent.aggregateId}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Version: {selectedEvent.version}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Occurred: {formatDateTime(selectedEvent.occurredOn)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6">Event Data</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <pre style={{ 
                        backgroundColor: '#f5f5f5', 
                        padding: '16px', 
                        borderRadius: '4px',
                        overflow: 'auto',
                        fontSize: '12px'
                      }}>
                        {JSON.stringify(selectedEvent.eventData, null, 2)}
                      </pre>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
                {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                  <Grid item xs={12}>
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6">Metadata</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <pre style={{ 
                          backgroundColor: '#f5f5f5', 
                          padding: '16px', 
                          borderRadius: '4px',
                          overflow: 'auto',
                          fontSize: '12px'
                        }}>
                          {JSON.stringify(selectedEvent.metadata, null, 2)}
                        </pre>
                      </AccordionDetails>
                    </Accordion>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
} 