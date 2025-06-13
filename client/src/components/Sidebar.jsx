import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import logo from '../assets/logo.png';

const Sidebar = ({ onLogout, user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    const handleToggleSidebar = () => {
      setIsOpen((prev) => !prev);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('toggleSidebar', handleToggleSidebar);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('toggleSidebar', handleToggleSidebar);
    };
  }, []);

  // Role-based menu items
  const roleMenuItems = {
    Admin: [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Students', path: '/students' },
      { name: 'Teachers', path: '/teachers' },
      { name: 'Staff', path: '/staff' },
      { name: 'Notice Board', path: '/notice-board' },
      { name: 'Attendance', path: '/attendance' },
      { name: 'Event List', path: '/eventslist' },
      { name: 'Holiday', path: '/holiday' },
      { name: 'Accounts', path: '/accounts' },
      { name: 'Reports', path: '/reports' },
      { name: 'Subjects', path: '/subjects' },
      { name: 'Classes', path: '/classes' },
      { name: 'Settings', path: '/settings' },
      { name: 'Logout', path: '/' },
    ],
    School: [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Students', path: '/students' },
      { name: 'Teachers', path: '/teachers' },
      { name: 'Staff', path: '/staff' },
      { name: 'Notice Board', path: '/notice-board' },
      { name: 'Attendance', path: '/attendance' },
      { name: 'Event List', path: '/eventslist' },
      { name: 'Holiday', path: '/holiday' },
      { name: 'Accounts', path: '/accounts' },
      { name: 'Reports', path: '/reports' },
      { name: 'Subjects', path: '/subjects' },
      { name: 'Classes', path: '/classes' },
      { name: 'Settings', path: '/settings' },
      { name: 'Logout', path: '/' },
    ],
    Teacher: [
      { name: 'Notice Board', path: '/notice-board' },
      { name: 'Attendance', path: '/attendance' },
      { name: 'Event List', path: '/eventslist' },
      { name: 'Holiday', path: '/holiday' },
      { name: 'Reports', path: '/reports' },
      { name: 'Subjects', path: '/subjects' },
      { name: 'Classes', path: '/classes' },
      { name: 'Settings', path: '/settings' },
      { name: 'Logout', path: '/' },
    ],
    Student: [
      { name: 'Notice Board', path: '/notice-board' },
      { name: 'Event List', path: '/eventslist' },
      { name: 'Holiday', path: '/holiday' },
      { name: 'Subjects', path: '/subjects' },
      { name: 'Settings', path: '/settings' },
      { name: 'Logout', path: '/' },
    ],
    Staff: [
      { name: 'Notice Board', path: '/notice-board' },
      { name: 'Event List', path: '/eventslist' },
      { name: 'Holiday', path: '/holiday' },
      { name: 'Logout', path: '/' },
    ],
  };

  const menuItems = user?.role ? roleMenuItems[user.role] : [];

  const handleNavClick = (path) => {
    if (path === '/') {
      onLogout();
    }
    setIsOpen(false);
  };

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 h-full bg-regal-blue text-white w-64 p-6 flex flex-col space-y-6 z-50 overflow-y-auto"
        initial={{ x: isLargeScreen ? 0 : -260 }}
        animate={{ x: isLargeScreen ? 0 : (isOpen ? 0 : -260) }}
        transition={{ duration: 0.3 }}
      >
        <div className="relative mb-8">
          <div className="flex justify-center">
            <img src={logo} alt="School Logo" className="h-12 w-auto" />
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden absolute top-0 right-0 text-white hover:text-regal-gold"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => handleNavClick(item.path)}
              className={({ isActive }) =>
                `block py-3 px-4 mb-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isActive ? 'bg-regal-gold text-regal-blue' : 'text-white hover:bg-white hover:bg-opacity-10'
                }`
              }
            >
              {item.name}
            </NavLink>
          ))}
        </nav>
      </motion.div>
      {isOpen && !isLargeScreen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </>
  );
};

export default Sidebar;