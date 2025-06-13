import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Menu } from 'lucide-react';
import axios from 'axios';
import logo from '../assets/logo.png';

const Navbar = ({ user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [username, setUsername] = useState('User');

  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setUsername(response.data.username || 'User'); // Fix: Use 'username' instead of 'name'
      } catch (error) {
        console.error('Error fetching username:', error);
        setUsername(user?.username || 'User'); // Fix: Use 'username' instead of 'name'
      }
    };
    if (user) fetchUsername();
  }, [user]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
    const event = new CustomEvent('toggleSidebar');
    window.dispatchEvent(event);
  };

  return (
    <motion.div
      className="bg-white shadow-md p-4 flex items-center justify-between lg:justify-end"
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="lg:hidden flex items-center">
        <button onClick={toggleSidebar}>
          <Menu className="w-6 h-6 text-regal-blue" />
        </button>
        <img src={logo} alt="School Logo" className="h-8 w-auto ml-4" />
      </div>
      <div className="flex items-center space-x-4">
        <h1 className="text-lg sm:text-xl font-semibold text-dark-gray">
          Welcome, {username}
        </h1>
        <button
          onClick={onLogout}
          className="flex items-center space-x-2 text-regal-blue hover:text-regal-gold transition-colors duration-300"
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </motion.div>
  );
};

export default Navbar;