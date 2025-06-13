import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit, Trash2, Plus, Lock } from 'lucide-react';
import axios from 'axios';

// Utility function to transform object keys to match expected format
const normalizeUserData = (user) => ({
  Id: user.Id || user.id || user.userId,
  Username: user.Username || user.username,
  Role: user.Role || user.role,
  Email: user.Email || user.email,
  SchoolId: user.SchoolId || user.schoolId || null,
});

const Settings = () => {
  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    role: '',
    schoolId: '',
    password: '',
  });
  const [editUserId, setEditUserId] = useState(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [newPasswordData, setNewPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [newPasswordError, setNewPasswordError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userModalError, setUserModalError] = useState('');

  // Define the API URL from the .env file
  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('No authentication token found. Please log in again.');
        }

        // Fetch current user
        const userRes = await axios.get(`${API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const normalizedCurrentUser = normalizeUserData(userRes.data);
        console.log('Current User:', normalizedCurrentUser);
        setCurrentUser(normalizedCurrentUser);

        // Fetch users (only for Admin and School users)
        if (normalizedCurrentUser.Role === 'Admin' || normalizedCurrentUser.Role === 'School') {
          const usersRes = await axios.get(`${API_URL}/api/users`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const normalizedUsers = usersRes.data.map(normalizeUserData);
          console.log('Fetched Users:', normalizedUsers);
          if (normalizedUsers.length > 0) {
            console.log('First User Structure:', normalizedUsers[0]);
          }
          setUsers(normalizedUsers);
        }

        // Fetch schools (only for Admin)
        if (normalizedCurrentUser.Role === 'Admin') {
          const schoolsRes = await axios.get(`${API_URL}/api/schools`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log('Fetched Schools:', schoolsRes.data);
          setSchools(schoolsRes.data);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.response?.data?.message || 'Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (isUserModalOpen || isPasswordModalOpen || isChangePasswordModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isUserModalOpen, isPasswordModalOpen, isChangePasswordModalOpen]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddUser = async () => {
    try {
      // Validate inputs
      if (!newUser.username || !newUser.email || (!editUserId && !newUser.password)) {
        setUserModalError('Username, email, and password are required');
        return;
      }
      if (!validateEmail(newUser.email)) {
        setUserModalError('Invalid email format');
        return;
      }
      if (!newUser.role) {
        setUserModalError('Please select a role');
        return;
      }
      if (['Teacher', 'Student', 'Staff'].includes(newUser.role) && currentUser.Role === 'Admin' && !newUser.schoolId) {
        setUserModalError('Please select a school');
        return;
      }

      const token = localStorage.getItem('token');
      const userData = { ...newUser };

      if (currentUser.Role === 'School' && ['Teacher', 'Student', 'Staff'].includes(newUser.role)) {
        userData.schoolId = currentUser.SchoolId;
      }

      if (editUserId) {
        await axios.put(`${API_URL}/api/users/${editUserId}`, userData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(`${API_URL}/api/users`, userData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      const usersRes = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const normalizedUsers = usersRes.data.map(normalizeUserData);
      setUsers(normalizedUsers);

      setNewUser({
        username: '',
        email: '',
        role: '',
        schoolId: '',
        password: '',
      });
      setEditUserId(null);
      setIsUserModalOpen(false);
      setUserModalError('');
    } catch (err) {
      console.error('Error adding/updating user:', err);
      setUserModalError(err.response?.data?.message || 'Failed to add/update user. Please try again.');
    }
  };

  const handleEditUser = (user) => {
    setNewUser({
      username: user.Username,
      email: user.Email,
      role: user.Role,
      schoolId: user.SchoolId || '',
      password: '',
    });
    setEditUserId(user.Id);
    setIsUserModalOpen(true);
    setUserModalError('');
  };

  const handleDeleteUser = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const usersRes = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const normalizedUsers = usersRes.data.map(normalizeUserData);
      setUsers(normalizedUsers);
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Failed to delete user: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleResetPassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordData;
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/users/reset-password`,
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Password successfully changed!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordError('');
      setIsPasswordModalOpen(false);
    } catch (err) {
      console.error('Error resetting password:', err);
      setPasswordError(err.response?.data?.message || 'Failed to reset password');
    }
  };

  const handleChangePassword = async () => {
    const { newPassword, confirmPassword } = newPasswordData;
    if (newPassword !== confirmPassword) {
      setNewPasswordError('New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setNewPasswordError('New password must be at least 6 characters long.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/api/users/${selectedUserId}/change-password`,
        { newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Password successfully updated!');
      setNewPasswordData({ newPassword: '', confirmPassword: '' });
      setNewPasswordError('');
      setIsChangePasswordModalOpen(false);
    } catch (err) {
      console.error('Error changing password:', err);
      setNewPasswordError(err.response?.data?.message || 'Failed to change password');
    }
  };

  const canManageUsers = currentUser && (currentUser.Role === 'Admin' || currentUser.Role === 'School');
  const canChangeUserPassword = (user) => {
    if (currentUser.Role === 'Admin') return true;
    if (currentUser.Role === 'School' && user.SchoolId === currentUser.SchoolId && user.Role !== 'Admin') return true;
    return false;
  };

  // Filter users for School role to ensure Admin and other School users are not shown
  const filteredUsers = currentUser?.Role === 'School'
    ? users.filter(user => 
        (user.Id === currentUser.Id && user.Role === 'School') || // Show the logged-in School user
        (user.SchoolId === currentUser.SchoolId && ['Teacher', 'Student', 'Staff'].includes(user.Role)) // Show Teachers, Students, Staff under their school
      )
    : users;

  if (loading) return <div className="text-center text-dark-gray">Loading...</div>;
  if (error) return <div className="text-center text-red-600">{error}</div>;
  if (!currentUser) return <div className="text-center text-dark-gray">Unable to load user data. Please log in again.</div>;

  return (
    <motion.div
      className="p-4 sm:p-6 lg:p-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-2xl sm:text-3xl font-bold text-dark-gray mb-4 sm:mb-6">Settings</h1>

      {/* Users Section (Visible only to Admin and School) */}
      {canManageUsers && (
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-dark-gray mb-4 sm:mb-0">Manage Users</h2>
            <motion.button
              onClick={() => setIsUserModalOpen(true)}
              className="bg-regal-blue text-white px-4 py-2 rounded-lg hover:bg-regal-gold hover:text-regal-blue transition-all duration-300 flex items-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus className="w-5 h-5 mr-2" />
              Add User
            </motion.button>
          </div>
          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            {filteredUsers.length === 0 ? (
              <div className="text-center text-dark-gray py-4">No users found.</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">Username</th>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">Email</th>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">Role</th>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">School ID</th>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.Id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-dark-gray">{user.Username || 'N/A'}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-dark-gray">{user.Email || 'N/A'}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-dark-gray">{user.Role || 'N/A'}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-dark-gray">{user.SchoolId || 'All (Admin)'}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm flex space-x-2">
                        <motion.button
                          onClick={() => handleEditUser(user)}
                          className="text-regal-blue hover:text-regal-gold"
                          whileHover={{ scale: 1.1 }}
                        >
                          <Edit className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                          onClick={() => handleDeleteUser(user.Id)}
                          className="text-red-600 hover:text-red-800"
                          whileHover={{ scale: 1.1 }}
                        >
                          <Trash2 className="w-5 h-5" />
                        </motion.button>
                        {canChangeUserPassword(user) && (
                          <motion.button
                            onClick={() => {
                              setSelectedUserId(user.Id);
                              setIsChangePasswordModalOpen(true);
                            }}
                            className="text-green-600 hover:text-green-800"
                            whileHover={{ scale: 1.1 }}
                          >
                            <Lock className="w-5 h-5" />
                          </motion.button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Reset Password Section (Visible to All Users) */}
      <div className="mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-dark-gray mb-4">Reset Password</h2>
        <motion.button
          onClick={() => setIsPasswordModalOpen(true)}
          className="bg-regal-blue text-white px-4 py-2 rounded-lg hover:bg-regal-gold hover:text-regal-blue transition-all duration-300"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Change Password
        </motion.button>
      </div>

      {/* Modal for Adding/Editing User */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-4xl"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-lg sm:text-xl font-bold text-dark-gray mb-4">
              {editUserId ? 'Edit User' : 'Add User'}
            </h2>
            {userModalError && <p className="text-red-600 mb-4">{userModalError}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="username">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="email">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                  placeholder="Enter email"
                />
              </div>
              <div>
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="role">
                  Role
                </label>
                <select
                  id="role"
                  value={newUser.role}
                  onChange={(e) => {
                    const role = e.target.value;
                    setNewUser((prev) => ({
                      ...prev,
                      role,
                      schoolId: role === 'Admin' ? '' : prev.schoolId,
                    }));
                  }}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                >
                  <option value="">Select Role</option>
                  {/* Admins can add any role, Schools can only add Teacher, Student, Staff */}
                  {currentUser.Role === 'Admin' && <option value="Admin">Admin</option>}
                  {currentUser.Role === 'Admin' && <option value="School">School</option>}
                  <option value="Teacher">Teacher</option>
                  <option value="Student">Student</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>
              {['Teacher', 'Student', 'Staff'].includes(newUser.role) && currentUser.Role === 'Admin' && (
                <div>
                  <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="schoolId">
                    School
                  </label>
                  <select
                    id="schoolId"
                    value={newUser.schoolId}
                    onChange={(e) => setNewUser({ ...newUser, schoolId: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                  >
                    <option value="">Select School</option>
                    {schools.map((school) => (
                      <option key={school.Id} value={school.Id}>
                        {school.Name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!editUserId && (
                <div>
                  <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="password">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                    placeholder="Enter password"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-4 mt-4">
              <motion.button
                onClick={() => {
                  setIsUserModalOpen(false);
                  setUserModalError('');
                }}
                className="px-4 py-2 text-dark-gray hover:text-regal-blue"
                whileHover={{ scale: 1.05 }}
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={handleAddUser}
                className="px-4 py-2 bg-regal-blue text-white rounded-lg hover:bg-regal-gold hover:text-regal-blue transition-all duration-300"
                whileHover={{ scale: 1.05 }}
              >
                {editUserId ? 'Update' : 'Add'} User
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal for Reset Password (Own Password) */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-sm sm:max-w-md"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-lg sm:text-xl font-bold text-dark-gray mb-4">Reset Password</h2>
            {passwordError && <p className="text-red-600 mb-4">{passwordError}</p>}
            <div className="mb-4">
              <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="currentPassword">
                Current Password
              </label>
              <input
                type="password"
                id="currentPassword"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                placeholder="Enter current password"
              />
            </div>
            <div className="mb-4">
              <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="newPassword">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                placeholder="Enter new password"
              />
            </div>
            <div className="mb-4">
              <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="confirmPassword">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                placeholder="Confirm new password"
              />
            </div>
            <div className="flex justify-end space-x-4">
              <motion.button
                onClick={() => setIsPasswordModalOpen(false)}
                className="px-4 py-2 text-dark-gray hover:text-regal-blue"
                whileHover={{ scale: 1.05 }}
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={handleResetPassword}
                className="px-4 py-2 bg-regal-blue text-white rounded-lg hover:bg-regal-gold hover:text-regal-blue transition-all duration-300"
                whileHover={{ scale: 1.05 }}
              >
                Reset Password
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal for Changing Other User's Password */}
      {isChangePasswordModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-sm sm:max-w-md"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-lg sm:text-xl font-bold text-dark-gray mb-4">Change User Password</h2>
            {newPasswordError && <p className="text-red-600 mb-4">{newPasswordError}</p>}
            <div className="mb-4">
              <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="newPassword">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPasswordData.newPassword}
                onChange={(e) => setNewPasswordData({ ...newPasswordData, newPassword: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                placeholder="Enter new password"
              />
            </div>
            <div className="mb-4">
              <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="confirmPassword">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={newPasswordData.confirmPassword}
                onChange={(e) => setNewPasswordData({ ...newPasswordData, confirmPassword: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                placeholder="Confirm new password"
              />
            </div>
            <div className="flex justify-end space-x-4">
              <motion.button
                onClick={() => setIsChangePasswordModalOpen(false)}
                className="px-4 py-2 text-dark-gray hover:text-regal-blue"
                whileHover={{ scale: 1.05 }}
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={handleChangePassword}
                className="px-4 py-2 bg-regal-blue text-white rounded-lg hover:bg-regal-gold hover:text-regal-blue transition-all duration-300"
                whileHover={{ scale: 1.05 }}
              >
                Change Password
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default Settings;