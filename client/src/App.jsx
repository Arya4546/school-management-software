import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import Staff from './pages/Staff';
import NoticeBoard from './pages/NoticeBoard';
import Attendance from './pages/Attendance';
import EventList from './pages/EventList';
import Holiday from './pages/Holiday';
import Accounts from './pages/Accounts';
import Reports from './pages/Reports';
import Subjects from './pages/Subjects';
import Classes from './pages/Classes';
import Settings from './pages/Settings';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem('token');
    console.log('Initial isAuthenticated check:', token !== null);
    return token !== null;
  });
  const [user, setUser] = useState(() => {
    const savedUsername = localStorage.getItem('username');
    const savedRole = localStorage.getItem('role');
    return savedUsername && savedRole ? { username: savedUsername, role: savedRole } : null;
  });
  const navigate = useNavigate();
  const location = useLocation();

  // Monitor isAuthenticated changes for debugging
  useEffect(() => {
    console.log('isAuthenticated updated:', isAuthenticated);
  }, [isAuthenticated]);

  // Recheck token on route change and isAuthenticated changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    const isTokenPresent = token !== null;
    console.log('Route changed to:', location.pathname, 'Token present:', isTokenPresent, 'isAuthenticated:', isAuthenticated);
    if (isTokenPresent && !isAuthenticated) {
      console.log('Token found in localStorage, setting isAuthenticated to true');
      setIsAuthenticated(true);
      const savedUsername = localStorage.getItem('username');
      const savedRole = localStorage.getItem('role');
      if (savedUsername && savedRole) {
        setUser({ username: savedUsername, role: savedRole });
      }
    } else if (!isTokenPresent && isAuthenticated) {
      console.log('No token found, logging out');
      handleLogout();
    }
  }, [location.pathname, isAuthenticated]);

  const handleLogin = (userData) => {
    console.log('handleLogin called with userData:', userData);
    setIsAuthenticated(true);
    setUser(userData);
    // Add a slight delay to ensure state update takes effect
    setTimeout(() => {
      console.log('Navigating to /dashboard after delay');
      navigate('/dashboard', { replace: true });
    }, 100);
  };

  const handleLogout = () => {
    console.log('handleLogout called');
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen">
      <ErrorBoundary>
        <Routes>
          {/* Public Route: Login page without Sidebar and Navbar */}
          <Route path="/login" element={<Login onLogin={handleLogin} />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <div className="flex">
                  <Sidebar onLogout={handleLogout} user={user} />
                  <div className="flex-1 flex flex-col lg:ml-64 overflow-y-auto">
                    <Navbar user={user} onLogout={handleLogout} />
                    <motion.div
                      className="flex-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Dashboard />
                    </motion.div>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/students"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <div className="flex">
                  <Sidebar onLogout={handleLogout} user={user} />
                  <div className="flex-1 flex flex-col lg:ml-64 overflow-y-auto">
                    <Navbar user={user} onLogout={handleLogout} />
                    <motion.div
                      className="flex-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Students />
                    </motion.div>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/teachers"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <div className="flex">
                  <Sidebar onLogout={handleLogout} user={user} />
                  <div className="flex-1 flex flex-col lg:ml-64 overflow-y-auto">
                    <Navbar user={user} onLogout={handleLogout} />
                    <motion.div
                      className="flex-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Teachers />
                    </motion.div>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <div className="flex">
                  <Sidebar onLogout={handleLogout} user={user} />
                  <div className="flex-1 flex flex-col lg:ml-64 overflow-y-auto">
                    <Navbar user={user} onLogout={handleLogout} />
                    <motion.div
                      className="flex-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Staff />
                    </motion.div>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notice-board"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <div className="flex">
                  <Sidebar onLogout={handleLogout} user={user} />
                  <div className="flex-1 flex flex-col lg:ml-64 overflow-y-auto">
                    <Navbar user={user} onLogout={handleLogout} />
                    <motion.div
                      className="flex-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <NoticeBoard />
                    </motion.div>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <div className="flex">
                  <Sidebar onLogout={handleLogout} user={user} />
                  <div className="flex-1 flex flex-col lg:ml-64 overflow-y-auto">
                    <Navbar user={user} onLogout={handleLogout} />
                    <motion.div
                      className="flex-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Attendance />
                    </motion.div>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/eventslist"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <div className="flex">
                  <Sidebar onLogout={handleLogout} user={user} />
                  <div className="flex-1 flex flex-col lg:ml-64 overflow-y-auto">
                    <Navbar user={user} onLogout={handleLogout} />
                    <motion.div
                      className="flex-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <EventList />
                    </motion.div>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/holiday"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <div className="flex">
                  <Sidebar onLogout={handleLogout} user={user} />
                  <div className="flex-1 flex flex-col lg:ml-64 overflow-y-auto">
                    <Navbar user={user} onLogout={handleLogout} />
                    <motion.div
                      className="flex-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Holiday />
                    </motion.div>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounts"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <div className="flex">
                  <Sidebar onLogout={handleLogout} user={user} />
                  <div className="flex-1 flex flex-col lg:ml-64 overflow-y-auto">
                    <Navbar user={user} onLogout={handleLogout} />
                    <motion.div
                      className="flex-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Accounts />
                    </motion.div>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <div className="flex">
                  <Sidebar onLogout={handleLogout} user={user} />
                  <div className="flex-1 flex flex-col lg:ml-64 overflow-y-auto">
                    <Navbar user={user} onLogout={handleLogout} />
                    <motion.div
                      className="flex-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Reports />
                    </motion.div>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subjects"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <div className="flex">
                  <Sidebar onLogout={handleLogout} user={user} />
                  <div className="flex-1 flex flex-col lg:ml-64 overflow-y-auto">
                    <Navbar user={user} onLogout={handleLogout} />
                    <motion.div
                      className="flex-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Subjects />
                    </motion.div>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/classes"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <div className="flex">
                  <Sidebar onLogout={handleLogout} user={user} />
                  <div className="flex-1 flex flex-col lg:ml-64 overflow-y-auto">
                    <Navbar user={user} onLogout={handleLogout} />
                    <motion.div
                      className="flex-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Classes />
                    </motion.div>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <div className="flex">
                  <Sidebar onLogout={handleLogout} user={user} />
                  <div className="flex-1 flex flex-col lg:ml-64 overflow-y-auto">
                    <Navbar user={user} onLogout={handleLogout} />
                    <motion.div
                      className="flex-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Settings />
                    </motion.div>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />

          {/* Redirect root path based on authentication */}
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <ProtectedRoute isAuthenticated={isAuthenticated}>
                  <div className="flex">
                    <Sidebar onLogout={handleLogout} user={user} />
                    <div className="flex-1 flex flex-col lg:ml-64 overflow-y-auto">
                      <Navbar user={user} onLogout={handleLogout} />
                      <motion.div
                        className="flex-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                      >
                        <Dashboard />
                      </motion.div>
                    </div>
                  </div>
                </ProtectedRoute>
              ) : (
                <Login onLogin={handleLogin} />
              )
            }
          />

          {/* Catch-all route for unauthenticated users */}
          <Route path="*" element={<Login onLogin={handleLogin} />} />
        </Routes>
      </ErrorBoundary>
    </div>
  );
}

export default App;