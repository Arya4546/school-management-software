import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit, Plus, Minus, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Utility function to normalize subject data
const normalizeSubjectData = (subject) => {
  const getProp = (obj, keys) => {
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key];
    }
    return undefined;
  };

  return {
    Id: getProp(subject, ['Id', 'id']),
    Name: getProp(subject, ['Name', 'name']),
    ClassId: getProp(subject, ['ClassId', 'classId']),
    TeacherId: getProp(subject, ['TeacherId', 'teacherId']),
    TeacherName: getProp(subject, ['TeacherName', 'teacherName']) || 'N/A',
    PeriodsPerWeek: getProp(subject, ['PeriodsPerWeek', 'periodsPerWeek']),
  };
};

const Subjects = ({ userRole }) => {
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState({ name: '', teacherId: '', periodsPerWeek: '' });
  const [editSubjectId, setEditSubjectId] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [userSchoolId, setUserSchoolId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;

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
        const { schoolId, userId } = response.data;
        setUserSchoolId(schoolId);
        setUserId(userId);

        if (userRole === 'School') {
          setSelectedSchool(schoolId);
        } else if (userRole === 'Teacher' || userRole === 'Student') {
          fetchUserClass(userId, userRole);
        }
      } catch (error) {
        console.error('Error fetching user details:', error.response?.data || error);
        setErrorMessage(error.response?.data?.message || 'Failed to load user details. Please try again.');
        navigate('/login');
      }
    };
    fetchUserDetails();
  }, [API_URL, navigate, userRole]);

  useEffect(() => {
    if (userRole === 'Admin' && !selectedSchool) {
      const fetchSchools = async () => {
        setLoading(true);
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API_URL}/api/schools/names`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setSchools(response.data);
        } catch (error) {
          console.error('Error fetching schools:', error.response?.data || error);
          setErrorMessage(error.response?.data?.message || 'Failed to load schools. Please try again.');
        } finally {
          setLoading(false);
        }
      };
      fetchSchools();
    }
  }, [userRole, API_URL]);

  useEffect(() => {
    if (selectedSchool) {
      fetchClasses();
      fetchTeachers();
    }
  }, [selectedSchool]);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/classes`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { schoolId: selectedSchool },
      });
      setClasses(response.data);
    } catch (error) {
      console.error('Error fetching classes:', error.response?.data || error);
      setErrorMessage(error.response?.data?.message || 'Failed to load classes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/teachers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { schoolId: selectedSchool },
      });
      setTeachers(response.data);
    } catch (error) {
      console.error('Error fetching teachers:', error.response?.data || error);
      setErrorMessage(error.response?.data?.message || 'Failed to load teachers. Please try again.');
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

      if (userData.SchoolId) {
        setSelectedSchool(userData.SchoolId);
      }

      if (userData.ClassId) {
        setSelectedClass(userData.ClassId);
        fetchSubjects(userData.ClassId);
      } else {
        setErrorMessage('No class assigned to this user.');
      }
    } catch (error) {
      console.error('Error fetching user class:', error.response?.data || error);
      setErrorMessage(error.response?.data?.message || 'Failed to load user class. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async (classId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/subjects/class/${classId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const normalizedSubjects = response.data.map(normalizeSubjectData);
      setSubjects(normalizedSubjects);
    } catch (error) {
      console.error('Error fetching subjects:', error.response?.data || error);
      setErrorMessage(error.response?.data?.message || 'Failed to load subjects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubject = async () => {
    if (!newSubject.name || !newSubject.teacherId || !newSubject.periodsPerWeek) {
      setErrorMessage('All fields are required.');
      return;
    }

    if (newSubject.periodsPerWeek <= 0) {
      setErrorMessage('Periods per week must be greater than 0.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const subjectData = {
        classId: selectedClass,
        name: newSubject.name,
        teacherId: parseInt(newSubject.teacherId),
        periodsPerWeek: parseInt(newSubject.periodsPerWeek),
      };

      console.log('Sending subject data:', subjectData);

      if (editSubjectId) {
        const response = await axios.put(`${API_URL}/api/subjects/${editSubjectId}`, subjectData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('PUT response:', response.data);
      } else {
        const response = await axios.post(`${API_URL}/api/subjects`, subjectData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('POST response:', response.data);
      }

      fetchSubjects(selectedClass);
      setNewSubject({ name: '', teacherId: '', periodsPerWeek: '' });
      setEditSubjectId(null);
      setIsModalOpen(false);
      setErrorMessage('');
    } catch (error) {
      console.error('Error saving subject:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
      });
      setErrorMessage(error.response?.data?.message || 'Error saving subject. Please try again.');
    }
  };

  const handleEditSubject = (subject) => {
    setNewSubject({
      name: subject.Name,
      teacherId: subject.TeacherId.toString(),
      periodsPerWeek: subject.PeriodsPerWeek.toString(),
    });
    setEditSubjectId(subject.Id);
    setIsModalOpen(true);
  };

  const handleDeleteSubject = async (subjectId) => {
    try {
      await axios.delete(`${API_URL}/api/subjects/${subjectId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      fetchSubjects(selectedClass);
      setExpandedRow(null);
      setErrorMessage('');
    } catch (error) {
      console.error('Error deleting subject:', error.response?.data || error);
      setErrorMessage(error.response?.data?.message || 'Error deleting subject. Please try again.');
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Subjects Management</h1>

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
                  onClick={() => setSelectedSchool(school.Id)}
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

        {(userRole === 'Admin' || userRole === 'School') && selectedSchool && !selectedClass && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4 sm:mb-0">Select a Class</h2>
              {userRole === 'Admin' && (
                <motion.button
                  onClick={() => setSelectedSchool(null)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  Back to Schools
                </motion.button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? (
                <p className="col-span-full text-center text-gray-600">Loading classes...</p>
              ) : classes.length > 0 ? (
                classes.map((classItem) => (
                  <motion.div
                    key={classItem.Id}
                    className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer"
                    onClick={() => {
                      setSelectedClass(classItem.Id);
                      fetchSubjects(classItem.Id);
                    }}
                    whileHover={{ scale: 1.03 }}
                  >
                    <h2 className="text-lg font-semibold text-gray-800">{classItem.Name} - {classItem.Section}</h2>
                    <p className="text-sm text-gray-600">Room: {classItem.Room}</p>
                  </motion.div>
                ))
              ) : (
                <p className="col-span-full text-center text-gray-600">No classes available.</p>
              )}
            </div>
          </>
        )}

        {(userRole === 'Teacher' || userRole === 'Student') && !selectedClass && (
          <p className="text-center text-gray-600">
            {loading ? 'Loading class...' : errorMessage || 'No class assigned.'}
          </p>
        )}

        {selectedClass && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4 sm:mb-0">
                Subjects for Class {classes.find((c) => c.Id === selectedClass)?.Name || selectedClass}
              </h2>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                {canPerformCRUD() && (
                  <motion.button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Add Subject
                  </motion.button>
                )}
                {(userRole === 'Admin' || userRole === 'School') && (
                  <motion.button
                    onClick={() => {
                      setSelectedClass(null);
                      setSubjects([]);
                    }}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Back to Classes
                  </motion.button>
                )}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Subject Name
                    </th>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Teacher
                    </th>
                    <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden sm:table-cell">
                      Periods/Week
                    </th>
                    {canPerformCRUD() && (
                      <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={canPerformCRUD() ? 4 : 3}
                        className="px-4 py-3 sm:px-6 sm:py-4 text-center text-sm text-gray-600"
                      >
                        Loading subjects...
                      </td>
                    </tr>
                  ) : subjects.length > 0 ? (
                    subjects.map((subject) => (
                      <React.Fragment key={subject.Id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-700">
                            {subject.Name}
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-700">
                            {subject.TeacherName || 'N/A'}
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-700 hidden sm:table-cell">
                            {subject.PeriodsPerWeek}
                          </td>
                          {canPerformCRUD() && (
                            <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm">
                              <motion.button
                                onClick={() => handleEditSubject(subject)}
                                className="text-blue-600 hover:text-blue-800 mr-2 sm:mr-4"
                                whileHover={{ scale: 1.1 }}
                              >
                                <Edit className="w-5 h-5" />
                              </motion.button>
                              <motion.button
                                onClick={() => handleDeleteSubject(subject.Id)}
                                className="text-red-600 hover:text-red-800 mr-2 sm:mr-4"
                                whileHover={{ scale: 1.1 }}
                              >
                                <Trash2 className="w-5 h-5" />
                              </motion.button>
                            </td>
                          )}
                          <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm lg:hidden">
                            <motion.button
                              onClick={() => toggleRowDetails(subject.Id)}
                              className="text-blue-600 hover:text-blue-800"
                              whileHover={{ scale: 1.1 }}
                            >
                              {expandedRow === subject.Id ? (
                                <Minus className="w-5 h-5" />
                              ) : (
                                <Plus className="w-5 h-5" />
                              )}
                            </motion.button>
                          </td>
                        </tr>
                        {expandedRow === subject.Id && (
                          <tr className="lg:hidden">
                            <td colSpan={canPerformCRUD() ? 4 : 3} className="px-4 py-3 sm:px-6 sm:py-4">
                              <motion.div
                                className="bg-gray-100 p-4 rounded-lg border border-gray-200"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                <p className="text-sm text-gray-700">
                                  <span className="font-medium">Periods/Week:</span> {subject.PeriodsPerWeek}
                                </p>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={canPerformCRUD() ? 4 : 3}
                        className="px-4 py-3 sm:px-6 sm:py-4 text-center text-sm text-gray-700"
                      >
                        No subjects found for this class.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {isModalOpen && canPerformCRUD() && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-sm sm:max-w-md"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">
                {editSubjectId ? 'Edit Subject' : 'Add Subject'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="subjectName">
                    Subject Name
                  </label>
                  <input
                    type="text"
                    id="subjectName"
                    value={newSubject.name}
                    onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                    placeholder="Enter subject name"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="teacher">
                    Teacher
                  </label>
                  <select
                    id="teacher"
                    value={newSubject.teacherId}
                    onChange={(e) => setNewSubject({ ...newSubject, teacherId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                  >
                    <option value="">Select a teacher</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.Id} value={teacher.Id}>
                        {teacher.Name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="periodsPerWeek">
                    Periods Per Week
                  </label>
                  <input
                    type="number"
                    id="periodsPerWeek"
                    value={newSubject.periodsPerWeek}
                    onChange={(e) => setNewSubject({ ...newSubject, periodsPerWeek: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                    placeholder="Enter periods per week"
                    min="1"
                  />
                </div>
                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 mt-6">
                  <motion.button
                    onClick={() => {
                      setIsModalOpen(false);
                      setNewSubject({ name: '', teacherId: '', periodsPerWeek: '' });
                      setEditSubjectId(null);
                    }}
                    className="w-full sm:w-auto bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleAddSubject}
                    className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    {editSubjectId ? 'Update' : 'Add'}
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

export default Subjects;