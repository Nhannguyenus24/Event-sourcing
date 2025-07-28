# 🏦 Banking System Frontend

A modern React frontend for the Event Sourcing Banking System built with Material-UI.

## 🚀 Features

- **Dashboard**: Real-time overview with statistics and recent transactions
- **Account Management**: Create, view, and manage bank accounts
- **Transaction History**: Comprehensive transaction listing with filtering
- **Event Store Viewer**: Browse and inspect domain events
- **Analytics**: Charts and statistics for business insights
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## 🛠️ Tech Stack

- **React 18** - Modern React with hooks
- **TypeScript** - Type safety and better developer experience
- **Material-UI (MUI)** - Beautiful and consistent UI components
- **React Router** - Client-side routing
- **React Query** - Server state management and caching
- **React Hook Form** - Form handling and validation
- **Axios** - HTTP client for API communication
- **Vite** - Fast build tool and development server

## 📦 Installation

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## 🔧 Configuration

The frontend is configured to connect to the backend services running on:

- **Command Service**: `http://localhost:3001/api`
- **Event Store Service**: `http://localhost:3002/api`
- **Query Service**: `http://localhost:3003/api`

You can modify these URLs in `src/services/api.ts` if needed.

## 📱 Pages & Features

### 🏠 Dashboard
- Real-time account statistics
- Recent transaction feed
- Quick action buttons
- System status indicators

### 💳 Accounts
- List all bank accounts
- Create new accounts
- View account details
- Block/unblock accounts
- Account balance tracking

### 💰 Transactions
- Comprehensive transaction history
- Advanced filtering options
- Pagination support
- Transaction status tracking
- Export capabilities

### 📊 Event Store
- Browse domain events
- Event filtering and search
- Event details inspection
- Event type statistics
- Aggregate tracking

### 📈 Analytics
- Transaction volume charts
- Account distribution
- Daily trends
- Performance metrics

### ⚙️ Settings
- System configuration
- API endpoint settings
- User preferences
- System information

## 🎨 UI Components

The application uses Material-UI components for a consistent and professional look:

- **Cards**: Information display and grouping
- **Tables**: Data presentation with sorting and pagination
- **Dialogs**: Modal forms and detailed views
- **Charts**: Data visualization (placeholder for chart libraries)
- **Forms**: Input validation and user interaction
- **Navigation**: Responsive sidebar and breadcrumbs

## 🔄 State Management

- **React Query**: Server state management with caching
- **React Hook Form**: Form state and validation
- **Local State**: Component-specific state with useState
- **URL State**: Route parameters and query strings

## 📊 Data Flow

1. **API Calls**: Axios for HTTP requests to backend services
2. **Caching**: React Query handles caching and background updates
3. **Real-time Updates**: Automatic data refresh every 30 seconds
4. **Error Handling**: Comprehensive error states and user feedback
5. **Loading States**: Skeleton loaders and progress indicators

## 🎯 Key Features

### Real-time Updates
- Automatic data refresh
- Optimistic updates for better UX
- Background synchronization

### Responsive Design
- Mobile-first approach
- Adaptive layouts
- Touch-friendly interfaces

### Error Handling
- Graceful error states
- User-friendly error messages
- Retry mechanisms

### Performance
- Code splitting
- Lazy loading
- Optimized re-renders
- Efficient data fetching

## 🚀 Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development Tips

1. **Hot Reload**: Changes are reflected immediately
2. **TypeScript**: Full type safety and IntelliSense
3. **ESLint**: Code quality and consistency
4. **Prettier**: Automatic code formatting

## 🔧 Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_EVENT_STORE_URL=http://localhost:3002/api
VITE_QUERY_SERVICE_URL=http://localhost:3003/api
```

## 📦 Build & Deploy

### Production Build
```bash
npm run build
```

The build output will be in the `dist` directory.

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## 🧪 Testing

The application is set up for testing with:

- **Unit Tests**: Component testing with React Testing Library
- **Integration Tests**: API integration testing
- **E2E Tests**: End-to-end testing with Playwright

## 📚 API Integration

The frontend integrates with three main backend services:

### Command Service (Port 3001)
- Account creation and management
- Transaction commands (deposit, withdraw, transfer)
- Account blocking and rollback operations

### Event Store Service (Port 3002)
- Domain event storage and retrieval
- Event filtering and search
- Snapshot management

### Query Service (Port 3003)
- Read-optimized data access
- Transaction history and filtering
- Account balance queries
- Analytics and reporting

## 🎨 Customization

### Theme Customization
Modify the theme in `src/main.tsx`:

```typescript
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});
```

### Component Styling
Use Material-UI's `sx` prop for custom styling:

```typescript
<Box sx={{ 
  backgroundColor: 'primary.main',
  borderRadius: 1,
  p: 2 
}}>
  Content
</Box>
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:

1. Check the documentation
2. Review existing issues
3. Create a new issue with detailed information

---

**Happy Banking! 🏦✨** 