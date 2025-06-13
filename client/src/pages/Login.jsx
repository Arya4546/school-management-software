import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.jpg';
import PropTypes from 'prop-types';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return; // Prevent multiple submissions
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      console.log('Backend response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store token and user data in localStorage
      console.log('Storing token in localStorage:', data.token);
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('username', data.username);

      // Call onLogin to update parent state
      if (typeof onLogin === 'function') {
        console.log('Calling onLogin with:', { username: data.username, role: data.role });
        onLogin({ username: data.username, role: data.role });
      }

      // Log localStorage state after setting
      console.log('localStorage after login:', {
        token: localStorage.getItem('token'),
        role: localStorage.getItem('role'),
        username: localStorage.getItem('username'),
      });

      // Redirect to dashboard
      console.log('Navigating to /dashboard');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-regal-blue to-regal-gold p-4">
      <motion.div
        className="relative bg-white/10 backdrop-blur-lg p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-sm sm:max-w-md border border-regal-gold/30 overflow-hidden"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-regal-blue/10 to-regal-gold/10 pointer-events-none" />
        <div className="flex justify-center mb-6 sm:mb-8">
          <img src={logo} alt="School Logo" className="h-12 sm:h-16 w-auto" />
        </div>
        <form onSubmit={handleSubmit}>
          {error && (
            <motion.div
              className="bg-red-500/20 text-white p-3 rounded-lg mb-6 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {error}
            </motion.div>
          )}
          <div className="mb-6">
            <label className="block text-white text-sm font-medium mb-2" htmlFor="username">
              Username
            </label>
            <motion.input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-white/20 border border-regal-gold/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-gold focus:border-transparent transition-all duration-300"
              placeholder="Enter your username"
              whileFocus={{ scale: 1.02 }}
              required
            />
          </div>
          <div className="mb-6 sm:mb-8">
            <label className="block text-white text-sm font-medium mb-2" htmlFor="password">
              Password
            </label>
            <motion.input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/20 border border-regal-gold/30 text-white placeholder-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-gold focus:border-transparent transition-all duration-300"
              placeholder="Enter your password"
              whileFocus={{ scale: 1.02 }}
              required
            />
          </div>
          <motion.button
            type="submit"
            className="w-full bg-regal-blue text-white py-3 rounded-lg hover:bg-regal-gold hover:text-regal-blue transition-all duration-300 flex items-center justify-center relative overflow-hidden"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isLoading}
          >
            {isLoading ? (
              <motion.div
                className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            ) : (
              'Login'
            )}
          </motion.button>
        </form>
        <p className="text-center text-white/70 text-sm mt-6 sm:mt-8 font-light">
          © 2025 All Rights Reserved
        </p>
      </motion.div>
    </div>
  );
};

Login.propTypes = {
  onLogin: PropTypes.func,
};

Login.defaultProps = {
  onLogin: () => {},
};

export default Login;
