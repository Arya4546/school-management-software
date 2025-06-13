import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Edit, Trash2 } from 'lucide-react';
import axios from 'axios';

const Staff = () => {
  const [staff, setStaff] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', phone: '', schoolId: '' });
  const [editStaffId, setEditStaffId] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userSchoolId, setUserSchoolId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Fetch user details
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setErrorMessage('No authentication token found. Please log in.');
          return;
        }

        const response = await axios.get(`${API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const { role, schoolId } = response.data;
        setUserRole(role);
        setUserSchoolId(schoolId);

        if (role === 'School') {
          setNewStaff((prev) => ({ ...prev, schoolId: schoolId || '' }));
          setSelectedSchool(schoolId);
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
        setErrorMessage('Failed to load user details. Please try again.');
      }
    };
    fetchUserDetails();
  }, [API_URL]);

  // Fetch schools for Admin
  useEffect(() => {
    if (userRole === 'Admin') {
      const fetchSchools = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API_URL}/api/schools/names`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setSchools(response.data);
        } catch (error) {
          console.error('Error fetching schools:', error);
          setErrorMessage('Failed to load schools. Please try again.');
        }
      };
      fetchSchools();
    }
  }, [userRole, API_URL]);

  // Fetch staff based on selected school
  useEffect(() => {
    if (selectedSchool) {
      fetchStaff();
    }
  }, [selectedSchool, API_URL]);

  const fetchStaff = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/staff`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { schoolId: selectedSchool },
      });
      setStaff(response.data);
    } catch (error) {
      console.error('Error fetching staff:', error);
      setErrorMessage('Failed to load staff. Please try again.');
    }
  };

  const handleAddStaff = async () => {
    try {
      if (!newStaff.name || !newStaff.email || !newStaff.schoolId) {
        setErrorMessage('Name, email, and school are required.');
        return;
      }

      const token = localStorage.getItem('token');
      if (editStaffId) {
        const response = await axios.put(
          `${API_URL}/api/staff/${editStaffId}`,
          newStaff,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setStaff(staff.map((staffMember) =>
          staffMember.Id === editStaffId ? response.data : staffMember
        ));
        setEditStaffId(null);
      } else {
        const response = await axios.post(
          `${API_URL}/api/staff`,
          newStaff,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setStaff([...staff, response.data]);
      }
      setNewStaff({ name: '', email: '', phone: '', schoolId: userRole === 'School' ? userSchoolId : '' });
      setIsModalOpen(false);
      setErrorMessage('');
    } catch (error) {
      console.error('Error saving staff:', error);
      setErrorMessage(error.response?.data?.message || 'Error saving staff. Please try again.');
    }
  };

  const handleEditStaff = (staffMember) => {
    setNewStaff({ 
      name: staffMember.Name, 
      email: staffMember.Email, 
      phone: staffMember.Phone || '', 
      schoolId: staffMember.SchoolId || '' 
    });
    setEditStaffId(staffMember.Id);
    setIsModalOpen(true);
    setErrorMessage('');
  };

  const handleDeleteStaff = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/staff/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStaff(staff.filter((staffMember) => staffMember.Id !== id));
      setErrorMessage('');
    } catch (error) {
      console.error('Error deleting staff:', error);
      setErrorMessage('Error deleting staff. Please try again.');
    }
  };

  const toggleRowDetails = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <motion.div
      className="p-4 sm:p-6 lg:p-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Error Message */}
      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}

      {/* Admin: Select School */}
      {userRole === 'Admin' && !selectedSchool && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {schools.map((school) => (
            <motion.div
              key={school.Id}
              className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer"
              onClick={() => setSelectedSchool(school.Id)}
              whileHover={{ scale: 1.03 }}
            >
              <h2 className="text-lg font-semibold text-dark-gray">{school.Name}</h2>
            </motion.div>
          ))}
        </div>
      )}

      {/* Show Staff for Selected School */}
      {(selectedSchool || userRole !== 'Admin') && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-dark-gray mb-4 sm:mb-0">
              Staff {userRole === 'Admin' ? `for ${schools.find((s) => s.Id === selectedSchool)?.Name}` : 'for Your School'}
            </h1>
            <div className="flex space-x-3">
              {userRole === 'Admin' && (
                <motion.button
                  onClick={() => {
                    setSelectedSchool(null);
                    setStaff([]);
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  Back to Schools
                </motion.button>
              )}
              <motion.button
                onClick={() => setIsModalOpen(true)}
                className="bg-regal-blue text-white px-4 py-2 rounded-lg hover:bg-regal-gold hover:text-regal-blue transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Add Staff
              </motion.button>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider hidden sm:table-cell">Email</th>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider hidden sm:table-cell">Phone</th>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider hidden lg:table-cell">Created At</th>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {staff.map((staffMember) => (
                  <>
                    <tr key={staffMember.Id}>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-dark-gray">{staffMember.Name}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-dark-gray hidden sm:table-cell">{staffMember.Email}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-dark-gray hidden sm:table-cell">{staffMember.Phone}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-dark-gray hidden lg:table-cell">
                        {new Date(staffMember.CreatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm">
                        <motion.button
                          onClick={() => handleEditStaff(staffMember)}
                          className="text-regal-blue hover:text-regal-gold mr-2 sm:mr-4"
                          whileHover={{ scale: 1.1 }}
                        >
                          <Edit className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                          onClick={() => handleDeleteStaff(staffMember.Id)}
                          className="text-red-600 hover:text-red-800 mr-2 sm:mr-4"
                          whileHover={{ scale: 1.1 }}
                        >
                          <Trash2 className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                          onClick={() => toggleRowDetails(staffMember.Id)}
                          className="lg:hidden text-regal-blue hover:text-regal-gold"
                          whileHover={{ scale: 1.1 }}
                        >
                          {expandedRow === staffMember.Id ? (
                            <Minus className="w-5 h-5" />
                          ) : (
                            <Plus className="w-5 h-5" />
                          )}
                        </motion.button>
                      </td>
                    </tr>
                    {expandedRow === staffMember.Id && (
                      <tr key={`${staffMember.Id}-details`} className="lg:hidden">
                        <td colSpan="5" className="px-4 py-3 sm:px-6 sm:py-4">
                          <motion.div
                            className="bg-soft-gray p-4 rounded-lg border border-regal-gold/30"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <p className="text-sm text-dark-gray mb-2"><span className="font-medium">Email:</span> {staffMember.Email}</p>
                            <p className="text-sm text-dark-gray mb-2"><span className="font-medium">Phone:</span> {staffMember.Phone}</p>
                            <p className="text-sm text-dark-gray"><span className="font-medium">Created At:</span> {new Date(staffMember.CreatedAt).toLocaleDateString()}</p>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-sm sm:max-w-md"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-lg sm:text-xl font-bold text-dark-gray mb-4">{editStaffId ? 'Edit Staff' : 'Add Staff'}</h2>
            <div>
              <div className="mb-4">
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="name">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                  placeholder="Enter staff name"
                />
              </div>
              <div className="mb-4">
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="email">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                  placeholder="Enter email"
                />
              </div>
              <div className="mb-4">
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="phone">
                  Phone
                </label>
                <input
                  type="text"
                  id="phone"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                  placeholder="Enter phone number"
                />
              </div>
              {userRole === 'Admin' && (
                <div className="mb-4">
                  <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="schoolId">School</label>
                  <select
                    id="schoolId"
                    value={newStaff.schoolId}
                    onChange={(e) => setNewStaff({ ...newStaff, schoolId: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                    required
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
              <div className="flex justify-end space-x-4">
                <motion.button
                  onClick={() => {
                    setIsModalOpen(false);
                    setNewStaff({ name: '', email: '', phone: '', schoolId: userRole === 'School' ? userSchoolId : '' });
                    setErrorMessage('');
                  }}
                  className="px-4 py-2 text-dark-gray hover:text-regal-blue"
                  whileHover={{ scale: 1.05 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handleAddStaff}
                  className="px-4 py-2 bg-regal-blue text-white rounded-lg hover:bg-regal-gold hover:text-regal-blue transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  {editStaffId ? 'Update' : 'Add'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default Staff;