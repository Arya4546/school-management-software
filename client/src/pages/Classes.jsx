import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit, Plus, Minus, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Classes = () => {
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', section: '', room: '' });
  const [editClassId, setEditClassId] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userSchoolId, setUserSchoolId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setErrorMessage('No authentication token found. Please log in.');
          navigate('/login');
          return;
        }

        const response = await axios.get(`${API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const { role, schoolId, userId } = response.data;
        console.log(`User details: role=${role}, schoolId=${schoolId}, userId=${userId}`);
        setUserRole(role);
        setUserSchoolId(schoolId);
        setUserId(userId);

        if (role === 'School') {
          setSelectedSchool(schoolId);
        } else if (role === 'Teacher' || role === 'Student') {
          fetchUserClass(userId, role);
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
        setErrorMessage('Failed to load user details. Please try again.');
        navigate('/login');
      }
    };
    fetchUserDetails();
  }, [API_URL, navigate]);

  useEffect(() => {
    if (userRole === 'Admin') {
      const fetchSchools = async () => {
        setLoading(true);
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API_URL}/api/schools/names`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log('Schools fetched:', response.data);
          setSchools(response.data);
        } catch (error) {
          console.error('Error fetching schools:', error);
          setErrorMessage('Failed to load schools. Please try again.');
        } finally {
          setLoading(false);
        }
      };
      fetchSchools();
    }
  }, [userRole, API_URL]);

  // Fetch classes when selectedSchool changes
  useEffect(() => {
    if (selectedSchool && (userRole === 'Admin' || userRole === 'School')) {
      fetchClasses(selectedSchool);
    }
  }, [selectedSchool, userRole]);

  const fetchClasses = async (schoolId) => {
    if (!schoolId) {
      setErrorMessage('School ID is required to fetch classes.');
      console.error('No schoolId provided for fetchClasses');
      return;
    }

    setLoading(true);
    setClasses([]); // Clear classes to prevent stale data
    try {
      console.log(`Fetching classes for schoolId: ${schoolId}`);
      const response = await axios.get(`${API_URL}/api/classes`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { schoolId: schoolId.toString() },
      });
      console.log('Classes received:', response.data);
      // Normalize the ClassName field to match what the table expects
      const normalizedClasses = response.data.map(classItem => ({
        ...classItem,
        Name: classItem.ClassName || classItem.name || classItem.Name,
      }));
      setClasses(normalizedClasses);
    } catch (error) {
      console.error('Error fetching classes:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to load classes. Please try again.');
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserClass = async (userId, role) => {
    setLoading(true);
    try {
      const endpoint = role === 'Teacher' ? `/api/teachers/${userId}` : `/api/students/${userId}`;
      const response = await axios.get(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const userData = response.data;
      console.log(`User class data for ${role}:`, userData);

      if (userData.SchoolId) {
        setSelectedSchool(userData.SchoolId);
      }

      if (userData.ClassId) {
        setSelectedClass(userData.ClassId);
        const classResponse = await axios.get(`${API_URL}/api/classes/${userData.ClassId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        console.log('Class details for user:', classResponse.data);
        // Normalize the ClassName field to match what the table expects
        const normalizedClass = {
          ...classResponse.data,
          Name: classResponse.data.ClassName || classResponse.data.name || classResponse.data.Name,
        };
        setClasses([normalizedClass]);
      } else {
        setErrorMessage('No class assigned to this user.');
      }
    } catch (error) {
      console.error('Error fetching user class:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to load user class. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = async () => {
    if (!newClass.name || !newClass.section || !newClass.room) {
      setErrorMessage('All fields are required.');
      return;
    }

    if (!selectedSchool) {
      setErrorMessage('No school selected. Please select a school.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const classData = {
        schoolId: selectedSchool,
        name: newClass.name,
        section: newClass.section,
        room: newClass.room,
      };

      if (editClassId) {
        await axios.put(`${API_URL}/api/classes/${editClassId}`, classData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(`${API_URL}/api/classes`, classData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      // Refresh the class list for the current school
      fetchClasses(selectedSchool);
      setNewClass({ name: '', section: '', room: '' });
      setEditClassId(null);
      setIsModalOpen(false);
      setErrorMessage('');
    } catch (error) {
      console.error('Error saving class:', error);
      setErrorMessage(error.response?.data?.message || 'Error saving class. Please try again.');
    }
  };

  const handleEditClass = (classItem) => {
    setNewClass({
      name: classItem.Name,
      section: classItem.Section,
      room: classItem.Room,
    });
    setEditClassId(classItem.Id);
    setIsModalOpen(true);
  };

  const handleDeleteClass = async (classId) => {
    if (!selectedSchool) {
      setErrorMessage('No school selected. Please select a school.');
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/classes/${classId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      // Refresh the class list for the current school
      fetchClasses(selectedSchool);
      setExpandedRow(null);
    } catch (error) {
      console.error('Error deleting class:', error);
      setErrorMessage(error.response?.data?.message || 'Error deleting class. Please try again.');
    }
  };

  const toggleRowDetails = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const canPerformCRUD = () => {
    return userRole === 'Admin' || userRole === 'School';
  };

  return (
    <motion.div
      className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Classes Management</h1>

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        {userRole === 'Admin' && !selectedSchool && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <p className="col-span-full text-center text-gray-600">Loading schools...</p>
            ) : schools.length > 0 ? (
              schools.map((school) => (
                <motion.div
                  key={school.Id}
                  className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer"
                  onClick={() => {
                    setSelectedSchool(school.Id);
                    setClasses([]); // Clear classes when changing school
                    fetchClasses(school.Id);
                  }}
                  whileHover={{ scale: 1.03 }}
                >
                  <h2 className="text-lg font-semibold text-gray-800">{school.Name}</h2>
                </motion.div>
              ))
            ) : (
              <p className="col-span-full text-center text-gray-600">No schools available.</p>
            )}
          </div>
        )}

        {(userRole === 'Admin' || userRole === 'School') && selectedSchool && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 sm:mb-0">
                Classes for School {schools.find((s) => s.Id === selectedSchool)?.Name || selectedSchool}
              </h2>
              <div className="flex space-x-3">
                {canPerformCRUD() && (
                  <motion.button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Add Class
                  </motion.button>
                )}
                {userRole === 'Admin' && (
                  <motion.button
                    onClick={() => {
                      setSelectedSchool(null);
                      setClasses([]);
                    }}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Back to Schools
                  </motion.button>
                )}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Class Name
                    </th>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Section
                    </th>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden sm:table-cell">
                      Room
                    </th>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-3 sm:px-6 sm:py-4 text-center text-sm text-gray-600">
                        Loading classes...
                      </td>
                    </tr>
                  ) : classes.length > 0 ? (
                    classes.map((classItem) => (
                      <React.Fragment key={classItem.Id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-700">
                            {classItem.Name}
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-700">
                            {classItem.Section}
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-700 hidden sm:table-cell">
                            {classItem.Room}
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm">
                            {canPerformCRUD() && (
                              <>
                                <motion.button
                                  onClick={() => handleEditClass(classItem)}
                                  className="text-blue-600 hover:text-blue-800 mr-2 sm:mr-4"
                                  whileHover={{ scale: 1.1 }}
                                >
                                  <Edit className="w-5 h-5" />
                                </motion.button>
                                <motion.button
                                  onClick={() => handleDeleteClass(classItem.Id)}
                                  className="text-red-600 hover:text-red-800 mr-2 sm:mr-4"
                                  whileHover={{ scale: 1.1 }}
                                >
                                  <Trash2 className="w-5 h-5" />
                                </motion.button>
                              </>
                            )}
                            <motion.button
                              onClick={() => toggleRowDetails(classItem.Id)}
                              className="lg:hidden text-blue-600 hover:text-blue-800"
                              whileHover={{ scale: 1.1 }}
                            >
                              {expandedRow === classItem.Id ? (
                                <Minus className="w-5 h-5" />
                              ) : (
                                <Plus className="w-5 h-5" />
                              )}
                            </motion.button>
                          </td>
                        </tr>
                        {expandedRow === classItem.Id && (
                          <tr className="lg:hidden">
                            <td colSpan="4" className="px-4 py-3 sm:px-6 sm:py-4">
                              <motion.div
                                className="bg-gray-100 p-4 rounded-lg border border-gray-200"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                <p className="text-sm text-gray-700">
                                  <span className="font-medium">Room:</span> {classItem.Room}
                                </p>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-3 sm:px-6 sm:py-4 text-center text-sm text-gray-700">
                        No classes found for this school.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {(userRole === 'Teacher' || userRole === 'Student') && (
          <>
            {selectedClass ? (
              <div className="bg-white rounded-lg shadow-md overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Class Name
                      </th>
                      <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Section
                      </th>
                      <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden sm:table-cell">
                        Room
                      </th>
                      <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan="4" className="px-4 py-3 sm:px-6 sm:py-4 text-center text-sm text-gray-600">
                          Loading class...
                        </td>
                      </tr>
                    ) : classes.length > 0 ? (
                      classes.map((classItem) => (
                        <React.Fragment key={classItem.Id}>
                          <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-700">
                              {classItem.Name}
                            </td>
                            <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-700">
                              {classItem.Section}
                            </td>
                            <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-700 hidden sm:table-cell">
                              {classItem.Room}
                            </td>
                            <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm">
                              <motion.button
                                onClick={() => toggleRowDetails(classItem.Id)}
                                className="lg:hidden text-blue-600 hover:text-blue-800"
                                whileHover={{ scale: 1.1 }}
                              >
                                {expandedRow === classItem.Id ? (
                                  <Minus className="w-5 h-5" />
                                ) : (
                                  <Plus className="w-5 h-5" />
                                )}
                              </motion.button>
                            </td>
                          </tr>
                          {expandedRow === classItem.Id && (
                            <tr className="lg:hidden">
                              <td colSpan="4" className="px-4 py-3 sm:px-6 sm:py-4">
                                <motion.div
                                  className="bg-gray-100 p-4 rounded-lg border border-gray-200"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  <p className="text-sm text-gray-700">
                                    <span className="font-medium">Room:</span> {classItem.Room}
                                  </p>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-4 py-3 sm:px-6 sm:py-4 text-center text-sm text-gray-700">
                          No class assigned.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-600">
                {loading ? 'Loading class...' : errorMessage || 'No class assigned.'}
              </p>
            )}
          </>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-sm sm:max-w-md"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                {editClassId ? 'Edit Class' : 'Add Class'}
              </h2>
              <div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="name">
                    Class Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={newClass.name}
                    onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                    placeholder="Enter class name"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="section">
                    Section
                  </label>
                  <input
                    type="text"
                    id="section"
                    value={newClass.section}
                    onChange={(e) => setNewClass({ ...newClass, section: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                    placeholder="Enter section"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="room">
                    Room
                  </label>
                  <input
                    type="text"
                    id="room"
                    value={newClass.room}
                    onChange={(e) => setNewClass({ ...newClass, room: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                    placeholder="Enter room number"
                  />
                </div>
                <div className="flex justify-end space-x-4">
                  <motion.button
                    onClick={() => {
                      setIsModalOpen(false);
                      setNewClass({ name: '', section: '', room: '' });
                      setEditClassId(null);
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleAddClass}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    {editClassId ? 'Update' : 'Add'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Classes;