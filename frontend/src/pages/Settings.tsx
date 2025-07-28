import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Divider,
} from '@mui/material';

export default function Settings() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Settings
              </Typography>
              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Auto-refresh data"
                />
              </Box>
              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={<Switch />}
                  label="Enable notifications"
                />
              </Box>
              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Show transaction details"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                API Configuration
              </Typography>
              <Box sx={{ mt: 2 }}>
                <TextField
                  label="Command Service URL"
                  defaultValue="http://localhost:3001/api"
                  fullWidth
                  margin="normal"
                />
                <TextField
                  label="Event Store URL"
                  defaultValue="http://localhost:3002/api"
                  fullWidth
                  margin="normal"
                />
                <TextField
                  label="Query Service URL"
                  defaultValue="http://localhost:3003/api"
                  fullWidth
                  margin="normal"
                />
              </Box>
              <Box sx={{ mt: 2 }}>
                <Button variant="contained">
                  Save Configuration
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Information
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Frontend Version
                  </Typography>
                  <Typography variant="body1">
                    1.0.0
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    API Version
                  </Typography>
                  <Typography variant="body1">
                    v1.0.0
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Environment
                  </Typography>
                  <Typography variant="body1">
                    Development
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Last Updated
                  </Typography>
                  <Typography variant="body1">
                    {new Date().toLocaleDateString()}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
} 