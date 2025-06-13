import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Edit, Trash2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';

const Holiday = ({ role }) => {
  const [holidays, setHolidays] = useState([]);
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ name: '', startDate: '', endDate: '', description: '', schoolId: '' });
  const [editHolidayId, setEditHolidayId] = useState(null);
  const [loading, setLoading] = useState(false);
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
        const { role: fetchedRole, schoolId } = response.data;
        setUserRole(fetchedRole);
        setUserSchoolId(schoolId);

        // If the user is a School, Teacher, or Student, pre-set the schoolId and select the school
        if (fetchedRole === 'School' || fetchedRole === 'Teacher' || fetchedRole === 'Student') {
          setNewHoliday((prev) => ({ ...prev, schoolId: schoolId || '' }));
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
          const response = await axios.get(`${API_URL}/api/schools/names`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          });
          setSchools(response.data);
        } catch (error) {
          console.error('Error fetching schools:', error);
          toast.error('Error fetching schools');
          setErrorMessage('Failed to load schools. Please try again.');
        }
      };
      fetchSchools();
    }
  }, [userRole, API_URL]);

  // Fetch holidays based on selected school
  useEffect(() => {
    if (selectedSchool) {
      fetchHolidays();
    }
  }, [selectedSchool, API_URL]);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const params = userRole === 'Admin' && selectedSchool ? { schoolId: selectedSchool } : {};
      const response = await axios.get(`${API_URL}/api/holidays`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params,
      });
      setHolidays(response.data);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast.error('Error fetching holidays');
      setErrorMessage('Failed to load holidays. Please try again.');
    } finally {
      setLoading(false);
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

  // Format date for display and input
  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewHoliday((prev) => ({ ...prev, [name]: value }));
  };

  // Add or update holiday
  const handleAddHoliday = async () => {
    try {
      // Validate inputs
      if (!newHoliday.name || !newHoliday.startDate || !newHoliday.endDate || !newHoliday.description || !newHoliday.schoolId) {
        setErrorMessage('Name, start date, end date, description, and school are required.');
        return;
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(newHoliday.startDate) || !dateRegex.test(newHoliday.endDate)) {
        setErrorMessage('Invalid date format. Use YYYY-MM-DD');
        return;
      }

      // Validate that endDate is not before startDate
      const start = new Date(newHoliday.startDate);
      const end = new Date(newHoliday.endDate);
      if (end < start) {
        setErrorMessage('End date cannot be before start date');
        return;
      }

      const holidayData = { ...newHoliday };
      let response;
      if (editHolidayId) {
        // Update holiday
        response = await axios.put(
          `${API_URL}/api/holidays/${editHolidayId}`,
          holidayData,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setHolidays(
          holidays.map((holiday) =>
            holiday.Id === editHolidayId ? response.data : holiday
          )
        );
        toast.success('Holiday updated successfully');
      } else {
        // Add new holiday
        response = await axios.post(
          `${API_URL}/api/holidays`,
          holidayData,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setHolidays([response.data, ...holidays]);
        toast.success('Holiday added successfully');
      }
      setNewHoliday({ name: '', startDate: '', endDate: '', description: '', schoolId: selectedSchool || userSchoolId });
      setEditHolidayId(null);
      setIsModalOpen(false);
      setErrorMessage('');
    } catch (error) {
      console.error('Error saving holiday:', error);
      setErrorMessage(error.response?.data?.message || 'Error saving holiday. Please try again.');
    }
  };

  // Handle edit holiday
  const handleEditHoliday = (holiday) => {
    if (!holiday || !holiday.Id) {
      toast.error('Invalid holiday selected for editing');
      setErrorMessage('Invalid holiday selected for editing');
      return;
    }
    setNewHoliday({
      name: holiday.Name,
      startDate: formatDateForInput(holiday.StartDate),
      endDate: formatDateForInput(holiday.EndDate),
      description: holiday.Description,
      schoolId: holiday.SchoolId,
    });
    setEditHolidayId(holiday.Id);
    setIsModalOpen(true);
    setErrorMessage('');
  };

  // Handle delete holiday
  const handleDeleteHoliday = async (id) => {
    if (window.confirm('Are you sure you want to delete this holiday?')) {
      try {
        await axios.delete(`${API_URL}/api/holidays/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setHolidays(holidays.filter((holiday) => holiday.Id !== id));
        toast.success('Holiday deleted successfully');
        setErrorMessage('');
      } catch (error) {
        console.error('Error deleting holiday:', error);
        setErrorMessage('Error deleting holiday. Please try again.');
      }
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setNewHoliday({ name: '', startDate: '', endDate: '', description: '', schoolId: selectedSchool || userSchoolId });
    setEditHolidayId(null);
    setIsModalOpen(false);
    setErrorMessage('');
  };

  const canPerformCRUD = () => {
    return userRole === 'Admin' || userRole === 'School';
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

      {/* Show Holidays for Selected School */}
      {(selectedSchool || userRole !== 'Admin') && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-dark-gray mb-4 sm:mb-0">
              Holidays {userRole === 'Admin' ? `for ${schools.find((s) => s.Id === selectedSchool)?.Name}` : 'for Your School'}
            </h1>
            <div className="flex space-x-3">
              {userRole === 'Admin' && (
                <motion.button
                  onClick={() => {
                    setSelectedSchool(null);
                    setHolidays([]);
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
                  Add Holiday
                </motion.button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider hidden sm:table-cell">Description</th>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider hidden sm:table-cell">Start Date</th>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider hidden sm:table-cell">End Date</th>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                    {canPerformCRUD() ? 'Actions' : 'Details'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={canPerformCRUD() ? 5 : 4} className="px-4 py-3 sm:px-6 sm:py-4 text-center text-sm text-dark-gray">
                      Loading holidays...
                    </td>
                  </tr>
                ) : holidays.length === 0 ? (
                  <tr>
                    <td colSpan={canPerformCRUD() ? 5 : 4} className="px-4 py-3 sm:px-6 sm:py-4 text-center text-sm text-dark-gray">
                      No holidays found.
                    </td>
                  </tr>
                ) : (
                  holidays.map((holiday) => (
                    <>
                      <tr key={holiday.Id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-dark-gray">{holiday.Name}</td>
                        <td className="px-4 py-3 sm:px-6 sm:py-4 text-sm text-dark-gray hidden sm:table-cell">{holiday.Description}</td>
                        <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-dark-gray hidden sm:table-cell">{formatDate(holiday.StartDate)}</td>
                        <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-dark-gray hidden sm:table-cell">{formatDate(holiday.EndDate)}</td>
                        <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm">
                          {canPerformCRUD() && (
                            <>
                              <motion.button
                                onClick={() => handleEditHoliday(holiday)}
                                className="text-regal-blue hover:text-regal-gold mr-2 sm:mr-4"
                                whileHover={{ scale: 1.1 }}
                              >
                                <Edit className="w-5 h-5" />
                              </motion.button>
                              <motion.button
                                onClick={() => handleDeleteHoliday(holiday.Id)}
                                className="text-red-600 hover:text-red-800 mr-2 sm:mr-4"
                                whileHover={{ scale: 1.1 }}
                              >
                                <Trash2 className="w-5 h-5" />
                              </motion.button>
                            </>
                          )}
                          <motion.button
                            onClick={() => toggleRowDetails(holiday.Id)}
                            className="sm:hidden text-regal-blue hover:text-regal-gold"
                            whileHover={{ scale: 1.1 }}
                          >
                            {expandedRow === holiday.Id ? (
                              <Minus className="w-5 h-5" />
                            ) : (
                              <Plus className="w-5 h-5" />
                            )}
                          </motion.button>
                        </td>
                      </tr>
                      {expandedRow === holiday.Id && (
                        <tr key={`${holiday.Id}-details`} className="sm:hidden">
                          <td colSpan={canPerformCRUD() ? 5 : 4} className="px-4 py-3 sm:px-6 sm:py-4">
                            <motion.div
                              className="bg-soft-gray p-4 rounded-lg border border-regal-gold/30"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <p className="text-sm text-dark-gray mb-2"><span className="font-medium">Description:</span> {holiday.Description}</p>
                              <p className="text-sm text-dark-gray mb-2"><span className="font-medium">Start Date:</span> {formatDate(holiday.StartDate)}</p>
                              <p className="text-sm text-dark-gray"><span className="font-medium">End Date:</span> {formatDate(holiday.EndDate)}</p>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
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
              {editHolidayId ? 'Edit Holiday' : 'Add Holiday'}
            </h2>
            <div>
              <div className="mb-4">
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="name">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={newHoliday.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                  placeholder="Enter holiday name"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={newHoliday.description}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                  placeholder="Enter description"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="startDate">
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={newHoliday.startDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="endDate">
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={newHoliday.endDate}
                  onChange={handleInputChange}
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
                    name="schoolId"
                    value={newHoliday.schoolId}
                    onChange={handleInputChange}
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
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-dark-gray hover:text-regal-blue"
                  whileHover={{ scale: 1.05 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handleAddHoliday}
                  className="px-4 py-2 bg-regal-blue text-white rounded-lg hover:bg-regal-gold hover:text-regal-blue transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  {editHolidayId ? 'Update' : 'Add'} Holiday
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default Holiday;