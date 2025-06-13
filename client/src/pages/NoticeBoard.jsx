import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Edit, Trash2 } from 'lucide-react';
import axios from 'axios';

const NoticeBoard = () => {
  const [notices, setNotices] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newNotice, setNewNotice] = useState({ title: '', description: '', date: '', schoolId: '' });
  const [editNoticeId, setEditNoticeId] = useState(null);
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userSchoolId, setUserSchoolId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Fetch the logged-in user's role and schoolId
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

        // If the user is a School, Teacher, or Student, pre-set the schoolId and select the school
        if (role === 'School' || role === 'Teacher' || role === 'Student') {
          setNewNotice((prev) => ({ ...prev, schoolId: schoolId || '' }));
          setSelectedSchool(schoolId);
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
        setErrorMessage('Failed to load user details. Please try again.');
      }
    };

    fetchUserDetails();
  }, [API_URL]);

  // Fetch schools for the dropdown if the user is an Admin
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

  // Fetch notices based on selected school
  useEffect(() => {
    if (selectedSchool) {
      fetchNotices();
    }
  }, [selectedSchool, API_URL]);

  const fetchNotices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/notices`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { schoolId: selectedSchool },
      });
      setNotices(response.data);
    } catch (error) {
      console.error('Error fetching notices:', error);
      setErrorMessage('Failed to load notices. Please try again.');
    }
  };

  // Handle modal open/close effect on body overflow
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isModalOpen]);

  const handleAddNotice = async () => {
    try {
      if (!newNotice.title || !newNotice.description || !newNotice.date || !newNotice.schoolId) {
        setErrorMessage('Title, description, date, and school are required.');
        return;
      }

      const token = localStorage.getItem('token');
      const noticeData = { ...newNotice };

      let response;
      if (editNoticeId) {
        response = await axios.put(
          `${API_URL}/api/notices/${editNoticeId}`,
          noticeData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setNotices(notices.map((notice) =>
          notice.Id === editNoticeId ? response.data : notice
        ));
      } else {
        response = await axios.post(
          `${API_URL}/api/notices`,
          noticeData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setNotices([...notices, response.data]);
      }

      setNewNotice({ title: '', description: '', date: '', schoolId: userRole === 'School' ? userSchoolId : '' });
      setEditNoticeId(null);
      setIsModalOpen(false);
      setErrorMessage('');
    } catch (error) {
      console.error('Error saving notice:', error);
      setErrorMessage(error.response?.data?.message || 'Error saving notice. Please try again.');
    }
  };

  const handleEditNotice = (notice) => {
    setNewNotice({
      title: notice.Title,
      description: notice.Description,
      date: notice.Date.split('T')[0],
      schoolId: notice.SchoolId || (userRole === 'School' ? userSchoolId : ''),
    });
    setEditNoticeId(notice.Id);
    setIsModalOpen(true);
    setErrorMessage('');
  };

  const handleDeleteNotice = async (id) => {
    if (window.confirm('Are you sure you want to delete this notice?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_URL}/api/notices/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotices(notices.filter((notice) => notice.Id !== id));
        setErrorMessage('');
      } catch (error) {
        console.error('Error deleting notice:', error);
        setErrorMessage('Error deleting notice. Please try again.');
      }
    }
  };

  const canPerformCRUD = () => {
    return userRole === 'Admin' || userRole === 'School';
  };

  const toggleRowDetails = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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

      {/* Show Notices for Selected School */}
      {(selectedSchool || userRole !== 'Admin') && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-dark-gray mb-4 sm:mb-0">
              Notice Board {userRole === 'Admin' ? `for ${schools.find((s) => s.Id === selectedSchool)?.Name}` : 'for Your School'}
            </h1>
            <div className="flex space-x-3">
              {userRole === 'Admin' && (
                <motion.button
                  onClick={() => {
                    setSelectedSchool(null);
                    setNotices([]);
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  Back to Schools
                </motion.button>
              )}
              {canPerformCRUD() && (
                <motion.button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-regal-blue text-white px-4 py-2 rounded-lg hover:bg-regal-gold hover:text-regal-blue transition-all duration-300 flex items-center"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Notice
                </motion.button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">Title</th>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider hidden sm:table-cell">Description</th>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider hidden sm:table-cell">Date</th>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                    {canPerformCRUD() ? 'Actions' : 'Details'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {notices.map((notice) => (
                  <>
                    <tr key={notice.Id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-dark-gray">{notice.Title}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 text-sm text-dark-gray hidden sm:table-cell">{notice.Description}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-dark-gray hidden sm:table-cell">{formatDate(notice.Date)}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm">
                        {canPerformCRUD() && (
                          <>
                            <motion.button
                              onClick={() => handleEditNotice(notice)}
                              className="text-regal-blue hover:text-regal-gold mr-2 sm:mr-4"
                              whileHover={{ scale: 1.1 }}
                            >
                              <Edit className="w-5 h-5" />
                            </motion.button>
                            <motion.button
                              onClick={() => handleDeleteNotice(notice.Id)}
                              className="text-red-600 hover:text-red-800 mr-2 sm:mr-4"
                              whileHover={{ scale: 1.1 }}
                            >
                              <Trash2 className="w-5 h-5" />
                            </motion.button>
                          </>
                        )}
                        <motion.button
                          onClick={() => toggleRowDetails(notice.Id)}
                          className="sm:hidden text-regal-blue hover:text-regal-gold"
                          whileHover={{ scale: 1.1 }}
                        >
                          {expandedRow === notice.Id ? (
                            <Minus className="w-5 h-5" />
                          ) : (
                            <Plus className="w-5 h-5" />
                          )}
                        </motion.button>
                      </td>
                    </tr>
                    {expandedRow === notice.Id && (
                      <tr key={`${notice.Id}-details`} className="sm:hidden">
                        <td colSpan={canPerformCRUD() ? 4 : 2} className="px-4 py-3 sm:px-6 sm:py-4">
                          <motion.div
                            className="bg-soft-gray p-4 rounded-lg border border-regal-gold/30"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <p className="text-sm text-dark-gray mb-2"><span className="font-medium">Description:</span> {notice.Description}</p>
                            <p className="text-sm text-dark-gray"><span className="font-medium">Date:</span> {formatDate(notice.Date)}</p>
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
            <h2 className="text-lg sm:text-xl font-bold text-dark-gray mb-4">
              {editNoticeId ? 'Edit Notice' : 'Add Notice'}
            </h2>
            <div>
              <div className="mb-4">
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="title">
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={newNotice.title}
                  onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                  placeholder="Enter notice title"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  value={newNotice.description}
                  onChange={(e) => setNewNotice({ ...newNotice, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                  placeholder="Enter description"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="date">
                  Date
                </label>
                <input
                  type="date"
                  id="date"
                  value={newNotice.date}
                  onChange={(e) => setNewNotice({ ...newNotice, date: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                  required
                />
              </div>
              {userRole === 'Admin' && (
                <div className="mb-4">
                  <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="schoolId">
                    School
                  </label>
                  <select
                    id="schoolId"
                    value={newNotice.schoolId}
                    onChange={(e) => setNewNotice({ ...newNotice, schoolId: e.target.value })}
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
                    setNewNotice({ title: '', description: '', date: '', schoolId: userRole === 'School' ? userSchoolId : '' });
                    setErrorMessage('');
                  }}
                  className="px-4 py-2 text-dark-gray hover:text-regal-blue"
                  whileHover={{ scale: 1.05 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handleAddNotice}
                  className="px-4 py-2 bg-regal-blue text-white rounded-lg hover:bg-regal-gold hover:text-regal-blue transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  {editNoticeId ? 'Update' : 'Add'} Notice
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default NoticeBoard;