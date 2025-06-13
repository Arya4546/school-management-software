import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit, Trash2 } from 'lucide-react'; // Added lucide-react icons
import axios from 'axios';
import * as XLSX from 'xlsx';

const Attendance = () => {
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRecord, setNewRecord] = useState({ date: '', status: 'Present' });
  const [editRecordId, setEditRecordId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userSchoolId, setUserSchoolId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [viewMode, setViewMode] = useState(null); // 'students' or 'teachers'
  const [errorMessage, setErrorMessage] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Fetch user details (role, schoolId, userId)
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
        const { role, schoolId, userId } = response.data;
        setUserRole(role);
        setUserSchoolId(schoolId);
        setUserId(userId);

        if (role === 'School') {
          setSelectedSchool(schoolId);
        } else if (role === 'Student') {
          fetchStudentClassAndAttendance(userId);
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

  // Fetch classes based on selected school
  useEffect(() => {
    if (selectedSchool) {
      fetchClasses();
    }
  }, [selectedSchool]);

  // Fetch teachers based on selected school (for Admin/School)
  useEffect(() => {
    if (selectedSchool && (userRole === 'Admin' || userRole === 'School')) {
      fetchTeachers();
    }
  }, [selectedSchool, userRole]);

  const fetchClasses = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/classes`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setClasses(response.data);
    } catch (error) {
      console.error('Error fetching classes:', error);
      setErrorMessage('Failed to load classes. Please try again.');
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/teachers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { schoolId: selectedSchool }, // Pass selectedSchool as a query parameter
      });
      setTeachers(response.data);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      setErrorMessage('Failed to load teachers. Please try again.');
    }
  };

  const fetchStudents = async (classId) => {
    try {
      const response = await axios.get(`${API_URL}/api/students/class/${classId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setStudents(response.data);
      setSelectedClass(classId);
      setSelectedStudent(null);
      setSelectedTeacher(null);
      setAttendanceRecords([]);
      setViewMode('students');
    } catch (error) {
      console.error('Error fetching students:', error);
      setErrorMessage('Failed to load students. Please try again.');
    }
  };

  const fetchStudentClassAndAttendance = async (studentId) => {
    try {
      const studentResponse = await axios.get(`${API_URL}/api/students/${studentId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const student = studentResponse.data;
      if (student.ClassId) {
        setSelectedClass(student.ClassId);
      }

      const attendanceResponse = await axios.get(`${API_URL}/api/attendance/student/${studentId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setAttendanceRecords(attendanceResponse.data);
      setSelectedStudent(studentId);
      setViewMode('students');
    } catch (error) {
      console.error('Error fetching student class or attendance:', error);
      setErrorMessage('Failed to load student attendance. Please try again.');
    }
  };

  const fetchStudentAttendance = async (studentId) => {
    try {
      const response = await axios.get(`${API_URL}/api/attendance/student/${studentId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setAttendanceRecords(response.data);
      setSelectedStudent(studentId);
      setSelectedTeacher(null);
      setViewMode('students');
    } catch (error) {
      console.error('Error fetching student attendance:', error);
      setErrorMessage('Failed to load student attendance. Please try again.');
    }
  };

  const fetchTeacherAttendance = async (teacherId) => {
    try {
      const response = await axios.get(`${API_URL}/api/attendance/teacher/${teacherId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setAttendanceRecords(response.data);
      setSelectedTeacher(teacherId);
      setSelectedStudent(null);
      setViewMode('teachers');
    } catch (error) {
      console.error('Error fetching teacher attendance:', error);
      setErrorMessage('Failed to load teacher attendance. Please try again.');
    }
  };

  const handleAddRecord = async () => {
    try {
      if (!newRecord.date || !newRecord.status) {
        setErrorMessage('Date and status are required.');
        return;
      }

      const token = localStorage.getItem('token');
      const recordData = { ...newRecord };

      if (viewMode === 'students') {
        recordData.studentId = selectedStudent;
      } else if (viewMode === 'teachers') {
        recordData.teacherId = selectedTeacher;
      }

      if (editRecordId) {
        await axios.put(
          `${API_URL}/api/attendance/${editRecordId}`,
          recordData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(
          `${API_URL}/api/attendance`,
          recordData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      if (viewMode === 'students') {
        fetchStudentAttendance(selectedStudent);
      } else if (viewMode === 'teachers') {
        fetchTeacherAttendance(selectedTeacher);
      }

      setNewRecord({ date: '', status: 'Present' });
      setEditRecordId(null);
      setIsModalOpen(false);
      setErrorMessage('');
    } catch (error) {
      console.error('Error saving attendance record:', error);
      setErrorMessage('Error saving attendance record. Please try again.');
    }
  };

  const handleEditRecord = (record) => {
    setNewRecord({ date: record.Date.split('T')[0], status: record.Status });
    setEditRecordId(record.Id);
    setIsModalOpen(true);
  };

  const handleDeleteRecord = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/attendance/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (viewMode === 'students') {
        fetchStudentAttendance(selectedStudent);
      } else if (viewMode === 'teachers') {
        fetchTeacherAttendance(selectedTeacher);
      }
    } catch (error) {
      console.error('Error deleting attendance record:', error);
      setErrorMessage('Error deleting attendance record. Please try again.');
    }
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(attendanceRecords);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
    XLSX.writeFile(workbook, `${viewMode === 'students' ? 'Student' : 'Teacher'}_Attendance.xlsx`);
  };

  const canPerformCRUD = () => {
    if (userRole === 'Admin') return true;
    if (userRole === 'School') return true;
    if (userRole === 'Teacher' && viewMode === 'students') return true;
    return false;
  };

  return (
    <motion.div
      className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Attendance Management</h1>

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        {/* Student View: Show only their own attendance */}
        {userRole === 'Student' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceRecords.map((record) => (
                    <tr key={record.Id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.Date.split('T')[0]}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.Status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Admin/School/Teacher View */}
        {userRole !== 'Student' && !selectedSchool && userRole === 'Admin' && (
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

        {selectedSchool && !selectedClass && !selectedTeacher && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 sm:mb-0">
                Select a Class or Teacher
              </h2>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Classes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {classes.map((classItem) => (
                    <motion.div
                      key={classItem.Id}
                      className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer"
                      onClick={() => fetchStudents(classItem.Id)}
                      whileHover={{ scale: 1.03 }}
                    >
                      <h2 className="text-lg font-semibold text-gray-800">{classItem.Name} - {classItem.Section}</h2>
                      <p className="text-sm text-gray-600">Room: {classItem.Room}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
              {(userRole === 'Admin' || userRole === 'School') && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Teachers</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {teachers.map((teacher) => (
                      <motion.div
                        key={teacher.Id}
                        className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer"
                        onClick={() => fetchTeacherAttendance(teacher.Id)}
                        whileHover={{ scale: 1.03 }}
                      >
                        <h2 className="text-lg font-semibold text-gray-800">{teacher.Name}</h2>
                        <p className="text-sm text-gray-600">{teacher.Email}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              {userRole === 'Teacher' && (
                <motion.button
                  onClick={() => fetchTeacherAttendance(userId)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  View My Attendance
                </motion.button>
              )}
            </div>
          </>
        )}

        {selectedClass && !selectedStudent && !selectedTeacher && viewMode === 'students' && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 sm:mb-0">
                Students in Class {classes.find((c) => c.Id === selectedClass)?.Name}
              </h2>
              <motion.button
                onClick={() => {
                  setSelectedClass(null);
                  setStudents([]);
                  setViewMode(null);
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-300"
                whileHover={{ scale: 1.05 }}
              >
                Back to Selection
              </motion.button>
            </div>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Roll No</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => (
                      <tr key={student.Id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{student.Name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{student.RollNo}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <motion.button
                            onClick={() => fetchStudentAttendance(student.Id)}
                            className="text-blue-600 hover:text-blue-800"
                            whileHover={{ scale: 1.1 }}
                          >
                            View Attendance
                          </motion.button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {(selectedStudent || selectedTeacher) && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 sm:mb-0">
                Attendance for {viewMode === 'students' 
                  ? students.find((s) => s.Id === selectedStudent)?.Name 
                  : teachers.find((t) => t.Id === selectedTeacher)?.Name || 'You'}
              </h2>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <motion.button
                  onClick={() => {
                    setSelectedStudent(null);
                    setSelectedTeacher(null);
                    setAttendanceRecords([]);
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  Back to {viewMode === 'students' ? 'Students' : 'Selection'}
                </motion.button>
                {canPerformCRUD() && (
                  <motion.button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    Add Record
                  </motion.button>
                )}
                <motion.button
                  onClick={downloadExcel}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  Download Excel
                </motion.button>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                      {canPerformCRUD() && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendanceRecords.map((record) => (
                      <tr key={record.Id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.Date.split('T')[0]}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.Status}</td>
                        {canPerformCRUD() && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <motion.button
                              onClick={() => handleEditRecord(record)}
                              className="text-regal-blue hover:text-regal-gold mr-2 sm:mr-4"
                              whileHover={{ scale: 1.1 }}
                            >
                              <Edit className="w-5 h-5" />
                            </motion.button>
                            <motion.button
                              onClick={() => handleDeleteRecord(record.Id)}
                              className="text-red-600 hover:text-red-800"
                              whileHover={{ scale: 1.1 }}
                            >
                              <Trash2 className="w-5 h-5" />
                            </motion.button>
                          </td>
                        )}
                      </tr>
                    ))}
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
              <h2 className="text-xl font-bold text-gray-800 mb-4">{editRecordId ? 'Edit Attendance' : 'Add Attendance'}</h2>
              <div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="date">
                    Date
                  </label>
                  <motion.input
                    type="date"
                    id="date"
                    value={newRecord.date}
                    onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                    whileFocus={{ scale: 1.02 }}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="status">
                    Status
                  </label>
                  <select
                    id="status"
                    value={newRecord.status}
                    onChange={(e) => setNewRecord({ ...newRecord, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                  >
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-3">
                  <motion.button
                    onClick={() => {
                      setIsModalOpen(false);
                      setNewRecord({ date: '', status: 'Present' });
                      setEditRecordId(null);
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleAddRecord}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    {editRecordId ? 'Update' : 'Add'}
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

export default Attendance;