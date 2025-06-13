import { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { motion } from 'framer-motion';
import { Edit, Trash2, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Reports = () => {
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [reports, setReports] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newReport, setNewReport] = useState({ subjectId: '', marks: '', remarks: '' });
  const [editReportId, setEditReportId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userSchoolId, setUserSchoolId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Fetch user details (role, schoolId, userId)
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
        setUserRole(role);
        setUserSchoolId(schoolId);
        setUserId(userId);

        if (role === 'School') {
          setSelectedSchool(schoolId);
        } else if (role === 'Student') {
          fetchStudentClassAndReports(userId);
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
        setErrorMessage('Failed to load user details. Please try again.');
        navigate('/login');
      }
    };
    fetchUserDetails();
  }, [API_URL, navigate]);

  // Fetch schools for Admins
  useEffect(() => {
    if (userRole === 'Admin') {
      const fetchSchools = async () => {
        setLoading(true);
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API_URL}/api/schools/names`, {
            headers: { Authorization: `Bearer ${token}` },
          });
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

  // Fetch classes based on selected school
  useEffect(() => {
    if (selectedSchool) {
      fetchClasses();
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
      console.error('Error fetching classes:', error);
      setErrorMessage('Failed to load classes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (classId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/students/class/${classId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setStudents(response.data);
      setSelectedClass(classId);
      setSelectedStudent(null);
      setReports([]);
    } catch (error) {
      console.error('Error fetching students:', error);
      setErrorMessage('Failed to load students. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentClassAndReports = async (studentId) => {
    setLoading(true);
    try {
      const studentResponse = await axios.get(`${API_URL}/api/students/${studentId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const student = studentResponse.data;
      if (student.ClassId) {
        setSelectedClass(student.ClassId);
      }

      const reportsResponse = await axios.get(`${API_URL}/api/reports?studentId=${studentId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setReports(reportsResponse.data);
      setSelectedStudent(studentId);
    } catch (error) {
      console.error('Error fetching student class or reports:', error);
      setErrorMessage('Failed to load student reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentReports = async (studentId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/reports?studentId=${studentId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setReports(response.data);
      setSelectedStudent(studentId);
    } catch (error) {
      console.error('Error fetching student reports:', error);
      setErrorMessage('Failed to load student reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch subjects for the modal dropdown
  useEffect(() => {
    const fetchSubjects = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_URL}/api/subjects`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setSubjects(response.data);
      } catch (error) {
        console.error('Error fetching subjects:', error);
        setErrorMessage('Failed to load subjects. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchSubjects();
  }, [API_URL]);

  const handleAddReport = async () => {
    try {
      if (!newReport.subjectId || !newReport.marks) {
        setErrorMessage('Subject and marks are required.');
        return;
      }

      const token = localStorage.getItem('token');
      const reportData = {
        studentId: selectedStudent,
        classId: selectedClass,
        subjectId: parseInt(newReport.subjectId),
        marks: parseFloat(newReport.marks),
        remarks: newReport.remarks || '',
      };

      if (editReportId) {
        await axios.put(`${API_URL}/api/reports/${editReportId}`, reportData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(`${API_URL}/api/reports`, reportData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      fetchStudentReports(selectedStudent);
      setNewReport({ subjectId: '', marks: '', remarks: '' });
      setEditReportId(null);
      setIsModalOpen(false);
      setErrorMessage('');
    } catch (error) {
      console.error('Error saving report:', error);
      setErrorMessage('Error saving report. Please try again.');
    }
  };

  const handleEditReport = (report) => {
    setNewReport({
      subjectId: report.SubjectId.toString(),
      marks: report.Marks.toString(),
      remarks: report.Remarks || '',
    });
    setEditReportId(report.Id);
    setIsModalOpen(true);
  };

  const handleDeleteReport = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/reports/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      fetchStudentReports(selectedStudent);
    } catch (error) {
      console.error('Error deleting report:', error);
      setErrorMessage('Error deleting report. Please try again.');
    }
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      reports.map((report) => ({
        'Report ID': report.Id,
        Subject: report.SubjectName,
        Marks: report.Marks,
        Remarks: report.Remarks || '',
        'Created At': report.CreatedAt.split('T')[0],
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reports');
    XLSX.writeFile(workbook, `Student_Reports_${selectedStudent}.xlsx`);
  };

  const canPerformCRUD = () => {
    if (userRole === 'Admin') return true;
    if (userRole === 'School') return true;
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
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Reports Management</h1>

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        {/* Student View: Show only their own reports */}
        {userRole === 'Student' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Subject</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Marks</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Remarks</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Created At</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.map((report) => (
                    <tr key={report.Id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.SubjectName}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.Marks}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.Remarks || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.CreatedAt.split('T')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Admin/School View */}
        {userRole !== 'Student' && !selectedSchool && userRole === 'Admin' && (
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

        {selectedSchool && !selectedClass && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 sm:mb-0">Select a Class</h2>
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
                    onClick={() => fetchStudents(classItem.Id)}
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

        {selectedClass && !selectedStudent && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 sm:mb-0">
                Students in Class {classes.find((c) => c.Id === selectedClass)?.Name}
              </h2>
              <motion.button
                onClick={() => {
                  setSelectedClass(null);
                  setStudents([]);
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-300"
                whileHover={{ scale: 1.05 }}
              >
                Back to Classes
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
                    {loading ? (
                      <tr>
                        <td colSpan="3" className="px-4 py-3 text-center text-gray-600">
                          Loading students...
                        </td>
                      </tr>
                    ) : students.length > 0 ? (
                      students.map((student) => (
                        <tr key={student.Id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{student.Name}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{student.RollNo}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <motion.button
                              onClick={() => fetchStudentReports(student.Id)}
                              className="text-blue-600 hover:text-blue-800"
                              whileHover={{ scale: 1.1 }}
                            >
                              View Reports
                            </motion.button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="px-4 py-3 text-center text-gray-600">
                          No students available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {selectedStudent && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 sm:mb-0">
                Reports for {students.find((s) => s.Id === selectedStudent)?.Name}
              </h2>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <motion.button
                  onClick={() => {
                    setSelectedStudent(null);
                    setReports([]);
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  Back to Students
                </motion.button>
                {canPerformCRUD() && (
                  <motion.button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    Add Report
                  </motion.button>
                )}
                <motion.button
                  onClick={downloadExcel}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-300 flex items-center"
                  whileHover={{ scale: 1.05 }}
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download Excel
                </motion.button>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Marks</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Remarks</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Created At</th>
                      {canPerformCRUD() && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={canPerformCRUD() ? 5 : 4} className="px-4 py-3 text-center text-gray-600">
                          Loading reports...
                        </td>
                      </tr>
                    ) : reports.length > 0 ? (
                      reports.map((report) => (
                        <tr key={report.Id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.SubjectName}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.Marks}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.Remarks || '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{report.CreatedAt.split('T')[0]}</td>
                          {canPerformCRUD() && (
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              <motion.button
                                onClick={() => handleEditReport(report)}
                                className="text-blue-600 hover:text-blue-800 mr-4"
                                whileHover={{ scale: 1.1 }}
                              >
                                <Edit className="w-5 h-5" />
                              </motion.button>
                              <motion.button
                                onClick={() => handleDeleteReport(report.Id)}
                                className="text-red-600 hover:text-red-800"
                                whileHover={{ scale: 1.1 }}
                              >
                                <Trash2 className="w-5 h-5" />
                              </motion.button>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={canPerformCRUD() ? 5 : 4} className="px-4 py-3 text-center text-gray-600">
                          No reports found for this student.
                        </td>
                      </tr>
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
              <h2 className="text-xl font-bold text-gray-800 mb-4">{editReportId ? 'Edit Report' : 'Add Report'}</h2>
              <div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="subjectId">Subject</label>
                  <select
                    id="subjectId"
                    value={newReport.subjectId}
                    onChange={(e) => setNewReport({ ...newReport, subjectId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                  >
                    <option value="">Select a subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.Id} value={subject.Id}>
                        {subject.Name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="marks">
                    Marks (out of 100)
                  </label>
                  <motion.input
                    type="number"
                    id="marks"
                    value={newReport.marks}
                    onChange={(e) => setNewReport({ ...newReport, marks: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                    placeholder="Enter marks"
                    min="0"
                    max="100"
                    step="0.01"
                    whileFocus={{ scale: 1.02 }}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="remarks">Remarks</label>
                  <textarea
                    id="remarks"
                    value={newReport.remarks}
                    onChange={(e) => setNewReport({ ...newReport, remarks: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                    placeholder="Enter remarks (optional)"
                    rows="3"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <motion.button
                    onClick={() => {
                      setIsModalOpen(false);
                      setNewReport({ subjectId: '', marks: '', remarks: '' });
                      setEditReportId(null);
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleAddReport}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    {editReportId ? 'Update' : 'Add'}
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

export default Reports;