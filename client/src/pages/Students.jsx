import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit, Trash2 } from 'lucide-react'; // Added lucide-react icons
import axios from 'axios';
import * as XLSX from 'xlsx';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', rollNo: '', email: '', gender: '', classId: '' });
  const [editStudentId, setEditStudentId] = useState(null);
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
          setSelectedSchool(schoolId);
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
        setErrorMessage('Failed to load user details. Please try again.');
      }
    };
    fetchUserDetails();
  }, [API_URL]);

  // Fetch schools for Admins
  useEffect(() => {
    if (userRole === 'Admin') {
      const fetchSchools = async () => {
        try {
          const response = await axios.get(`${API_URL}/api/schools/names`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
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

  // Fetch classes
  useEffect(() => {
    if (selectedSchool || userRole !== 'Admin') {
      fetchClasses();
    }
  }, [selectedSchool, userRole]);

  const fetchClasses = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/classes`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      // Filter classes by selectedSchool for Admins
      const filteredClasses = userRole === 'Admin' && selectedSchool
        ? response.data.filter(cls => cls.SchoolId === selectedSchool)
        : response.data;
      setClasses(filteredClasses);
      if (filteredClasses.length > 0) {
        setSelectedClass(filteredClasses[0].Id); // Set default selected class
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      setErrorMessage('Failed to load classes. Please try again.');
    }
  };

  // Fetch students based on selected class
  useEffect(() => {
    if (selectedClass) {
      fetchStudents();
    }
  }, [selectedClass]);

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/students/class/${selectedClass}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setStudents(response.data);
    } catch (error) {
      console.error('Error fetching students:', error);
      setErrorMessage('Failed to load students. Please try again.');
    }
  };

  const handleAddStudent = async () => {
    try {
      if (!newStudent.name || !newStudent.rollNo || !newStudent.email || !newStudent.classId) {
        setErrorMessage('All fields are required.');
        return;
      }

      const token = localStorage.getItem('token');
      if (editStudentId) {
        await axios.put(
          `${API_URL}/api/students/${editStudentId}`,
          newStudent,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(
          `${API_URL}/api/students`,
          newStudent,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      fetchStudents();
      setNewStudent({ name: '', rollNo: '', email: '', gender: '', classId: '' });
      setEditStudentId(null);
      setIsModalOpen(false);
      setErrorMessage('');
    } catch (error) {
      console.error('Error saving student:', error);
      setErrorMessage('Error saving student. Please try again.');
    }
  };

  const handleEditStudent = (student) => {
    setNewStudent({
      name: student.Name,
      rollNo: student.RollNo,
      email: student.Email,
      gender: student.Gender || '',
      classId: student.ClassId,
    });
    setEditStudentId(student.Id);
    setIsModalOpen(true);
  };

  const handleDeleteStudent = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/students/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: userRole === 'Admin' ? { schoolId: selectedSchool } : {}, // Pass selectedSchool for Admins
      });
      fetchStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      setErrorMessage('Error deleting student. Please try again.');
    }
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(students);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, 'Students.xlsx');
  };

  return (
    <motion.div
      className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Students Management</h1>

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
                <h2 className="text-lg font-semibold text-gray-800">{school.Name}</h2>
              </motion.div>
            ))}
          </div>
        )}

        {(selectedSchool || userRole !== 'Admin') && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                >
                  <option value="">Select Class</option>
                  {classes.map((cls) => (
                    <option key={cls.Id} value={cls.Id}>
                      {cls.Name} - {cls.Section}
                    </option>
                  ))}
                </select>
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
              <div className="flex space-x-3 mt-3 sm:mt-0">
                <motion.button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  Add Student
                </motion.button>
                <motion.button
                  onClick={downloadExcel}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  Download Excel
                </motion.button>
              </div>
            </div>

            {selectedClass && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Roll No</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Gender</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Class</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.map((student) => (
                        <tr key={student.Id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{student.Name}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{student.RollNo}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{student.Email}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{student.Gender || 'N/A'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{student.Class || 'N/A'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <motion.button
                              onClick={() => handleEditStudent(student)}
                              className="text-regal-blue hover:text-regal-gold mr-2 sm:mr-4"
                              whileHover={{ scale: 1.1 }}
                            >
                              <Edit className="w-5 h-5" />
                            </motion.button>
                            <motion.button
                              onClick={() => handleDeleteStudent(student.Id)}
                              className="text-red-600 hover:text-red-800"
                              whileHover={{ scale: 1.1 }}
                            >
                              <Trash2 className="w-5 h-5" />
                            </motion.button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
              <h2 className="text-xl font-bold text-gray-800 mb-4">{editStudentId ? 'Edit Student' : 'Add Student'}</h2>
              <div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="name">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="rollNo">
                    Roll No
                  </label>
                  <input
                    type="text"
                    id="rollNo"
                    value={newStudent.rollNo}
                    onChange={(e) => setNewStudent({ ...newStudent, rollNo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="email">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="gender">
                    Gender
                  </label>
                  <select
                    id="gender"
                    value={newStudent.gender}
                    onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="classId">
                    Class
                  </label>
                  <select
                    id="classId"
                    value={newStudent.classId}
                    onChange={(e) => setNewStudent({ ...newStudent, classId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                  >
                    <option value="">Select Class</option>
                    {classes.map((cls) => (
                      <option key={cls.Id} value={cls.Id}>
                        {cls.Name} - {cls.Section}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end space-x-3">
                  <motion.button
                    onClick={() => {
                      setIsModalOpen(false);
                      setNewStudent({ name: '', rollNo: '', email: '', gender: '', classId: '' });
                      setEditStudentId(null);
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleAddStudent}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    {editStudentId ? 'Update' : 'Add'}
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

export default Students;