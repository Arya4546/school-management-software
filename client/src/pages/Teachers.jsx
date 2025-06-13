import React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Edit, Trash2 } from 'lucide-react';
import axios from 'axios';

const Teachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTeacher, setNewTeacher] = useState({ name: '', email: '', phone: '', schoolId: '', dateOfBirth: '' });
  const [editTeacherId, setEditTeacherId] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userSchoolId, setUserSchoolId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
          setNewTeacher((prev) => ({ ...prev, schoolId: schoolId || '' }));
          setSelectedSchool(schoolId);
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
        setErrorMessage('Failed to load user details. Please try again.');
      }
    };

    fetchUserDetails();
  }, [API_URL]);

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

  useEffect(() => {
    if (selectedSchool) {
      fetchTeachers();
    }
  }, [selectedSchool]);

  const fetchTeachers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/teachers`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { schoolId: selectedSchool },
      });
      setTeachers(response.data);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      setErrorMessage('Failed to load teachers. Please try again.');
    }
  };

  const handleAddTeacher = async () => {
    try {
      if (!newTeacher.name || !newTeacher.email || !newTeacher.schoolId) {
        setErrorMessage('Name, email, and school are required.');
        return;
      }

      const token = localStorage.getItem('token');
      const teacherData = {
        name: newTeacher.name,
        email: newTeacher.email,
        phone: newTeacher.phone || null,
        schoolId: parseInt(newTeacher.schoolId),
        dateOfBirth: newTeacher.dateOfBirth || null,
      };

      if (editTeacherId) {
        const response = await axios.put(`${API_URL}/api/teachers/${editTeacherId}`, teacherData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTeachers(teachers.map((teacher) =>
          teacher.Id === editTeacherId ? response.data : teacher
        ));
        setEditTeacherId(null);
      } else {
        const response = await axios.post(`${API_URL}/api/teachers`, teacherData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTeachers([...teachers, response.data]);
      }
      setNewTeacher({ name: '', email: '', phone: '', schoolId: userRole === 'School' ? userSchoolId : '', dateOfBirth: '' });
      setIsModalOpen(false);
      setErrorMessage('');
    } catch (error) {
      console.error('Error saving teacher:', error);
      setErrorMessage(error.response?.data?.message || 'Error saving teacher. Please try again.');
    }
  };

  const handleEditTeacher = (teacher) => {
    setNewTeacher({
      name: teacher.Name,
      email: teacher.Email,
      phone: teacher.Phone || '',
      schoolId: teacher.SchoolId || '',
      dateOfBirth: teacher.DateOfBirth ? teacher.DateOfBirth.split('T')[0] : '',
    });
    setEditTeacherId(teacher.Id);
    setIsModalOpen(true);
    setErrorMessage('');
  };

  const handleDeleteTeacher = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/teachers/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTeachers(teachers.filter((teacher) => teacher.Id !== id));
      setErrorMessage('');
    } catch (error) {
      console.error('Error deleting teacher:', error);
      setErrorMessage(error.response?.data?.message || 'Error deleting teacher. Please try again.');
    }
  };

  const toggleRowDetails = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <motion.div
      className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Teachers Management</h1>

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        {userRole === 'Admin' && !selectedSchool && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {schools.map((school) => (
              <motion.div
                key={school.Id}
                className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer"
                onClick={() => setSelectedSchool(school.Id)}
                whileHover={{ scale: 1.03 }}
              >
                <h2 className="text-lg font-semibold text-gray-800">{school.Name}</h2>
              </motion.div>
            ))}
          </div>
        )}

        {(selectedSchool || userRole !== 'Admin') && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 sm:mb-0">
                Teachers {userRole === 'Admin' ? `for ${schools.find((s) => s.Id === selectedSchool)?.Name}` : 'for Your School'}
              </h2>
              <div className="flex space-x-3">
                {userRole === 'Admin' && (
                  <motion.button
                    onClick={() => {
                      setSelectedSchool(null);
                      setTeachers([]);
                    }}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    Back to Schools
                  </motion.button>
                )}
                <motion.button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  Add Teacher
                </motion.button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden sm:table-cell">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden sm:table-cell">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden sm:table-cell">Date of Birth</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden sm:table-cell">School ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {teachers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-3 text-center text-sm text-gray-700">
                          No teachers found.
                        </td>
                      </tr>
                    ) : (
                      teachers.map((teacher) => (
                        <React.Fragment key={teacher.Id}>
                          <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{teacher.Name}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 hidden sm:table-cell">{teacher.Email}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 hidden sm:table-cell">{teacher.Phone || 'N/A'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 hidden sm:table-cell">{teacher.DateOfBirth ? new Date(teacher.DateOfBirth).toLocaleDateString() : 'N/A'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 hidden sm:table-cell">{teacher.SchoolId || 'N/A'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              <motion.button
                                onClick={() => handleEditTeacher(teacher)}
                                className="text-blue-600 hover:text-blue-800 mr-2 sm:mr-4"
                                whileHover={{ scale: 1.1 }}
                              >
                                <Edit className="w-5 h-5" />
                              </motion.button>
                              <motion.button
                                onClick={() => handleDeleteTeacher(teacher.Id)}
                                className="text-red-600 hover:text-red-800 mr-2 sm:mr-4"
                                whileHover={{ scale: 1.1 }}
                              >
                                <Trash2 className="w-5 h-5" />
                              </motion.button>
                              <motion.button
                                onClick={() => toggleRowDetails(teacher.Id)}
                                className="lg:hidden text-blue-600 hover:text-blue-800"
                                whileHover={{ scale: 1.1 }}
                              >
                                {expandedRow === teacher.Id ? (
                                  <Minus className="w-5 h-5" />
                                ) : (
                                  <Plus className="w-5 h-5" />
                                )}
                              </motion.button>
                            </td>
                          </tr>
                          {expandedRow === teacher.Id && (
                            <tr className="lg:hidden">
                              <td colSpan="6" className="px-4 py-3">
                                <motion.div
                                  className="bg-gray-100 p-4 rounded-lg border border-gray-300"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  <p className="text-sm text-gray-700 mb-2"><span className="font-medium">Email:</span> {teacher.Email}</p>
                                  <p className="text-sm text-gray-700 mb-2"><span className="font-medium">Phone:</span> {teacher.Phone || 'N/A'}</p>
                                  <p className="text-sm text-gray-700 mb-2"><span className="font-medium">Date of Birth:</span> {teacher.DateOfBirth ? new Date(teacher.DateOfBirth).toLocaleDateString() : 'N/A'}</p>
                                  <p className="text-sm text-gray-700"><span className="font-medium">School ID:</span> {teacher.SchoolId || 'N/A'}</p>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              className="bg-white rounded-lg p-6 w-full max-w-md"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">{editTeacherId ? 'Edit Teacher' : 'Add Teacher'}</h2>
              <div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="name">Name</label>
                  <input
                    type="text"
                    id="name"
                    value={newTeacher.name}
                    onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                    placeholder="Enter teacher name"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    value={newTeacher.email}
                    onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                    placeholder="Enter email"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="phone">Phone (Optional)</label>
                  <input
                    type="text"
                    id="phone"
                    value={newTeacher.phone}
                    onChange={(e) => setNewTeacher({ ...newTeacher, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="dateOfBirth">Date of Birth (Optional)</label>
                  <input
                    type="date"
                    id="dateOfBirth"
                    value={newTeacher.dateOfBirth}
                    onChange={(e) => setNewTeacher({ ...newTeacher, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                  />
                </div>
                {userRole === 'Admin' && (
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="schoolId">School</label>
                    <select
                      id="schoolId"
                      value={newTeacher.schoolId}
                      onChange={(e) => setNewTeacher({ ...newTeacher, schoolId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
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
                <div className="flex justify-end space-x-3">
                  <motion.button
                    onClick={() => {
                      setIsModalOpen(false);
                      setNewTeacher({ name: '', email: '', phone: '', schoolId: userRole === 'School' ? userSchoolId : '', dateOfBirth: '' });
                      setErrorMessage('');
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleAddTeacher}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    {editTeacherId ? 'Update' : 'Add'}
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

export default Teachers;