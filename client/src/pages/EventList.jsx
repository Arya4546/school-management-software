import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit, Trash2, Plus, Minus } from 'lucide-react';
import axios from 'axios';

const EventList = () => {
  const [events, setEvents] = useState([]);
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', description: '', schoolId: '' });
  const [editEventId, setEditEventId] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
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

        if (role === 'School' || role === 'Teacher' || role === 'Student') {
          setSelectedSchool(schoolId);
          setNewEvent((prev) => ({ ...prev, schoolId: schoolId || '' }));
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

  // Fetch events based on selected school
  useEffect(() => {
    if (selectedSchool) {
      fetchEvents();
    }
  }, [selectedSchool, API_URL]);

  const fetchEvents = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/events`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { schoolId: selectedSchool },
      });
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
      setErrorMessage('Failed to load events. Please try again.');
    }
  };

  const handleAddEvent = async () => {
    try {
      if (!newEvent.title || !newEvent.date || !newEvent.description || !newEvent.schoolId) {
        setErrorMessage('All fields are required.');
        return;
      }

      const token = localStorage.getItem('token');
      const eventData = { ...newEvent };

      let response;
      if (editEventId) {
        response = await axios.put(
          `${API_URL}/api/events/${editEventId}`,
          eventData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setEvents(events.map((event) =>
          event.Id === editEventId ? response.data : event
        ));
      } else {
        response = await axios.post(
          `${API_URL}/api/events`,
          eventData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setEvents([...events, response.data]);
      }

      setNewEvent({ title: '', date: '', description: '', schoolId: userRole === 'School' ? userSchoolId : '' });
      setEditEventId(null);
      setIsModalOpen(false);
      setErrorMessage('');
    } catch (error) {
      console.error('Error saving event:', error);
      setErrorMessage(error.response?.data?.message || 'Error saving event. Please try again.');
    }
  };

  const handleEditEvent = (event) => {
    setNewEvent({
      title: event.Title,
      date: event.Date.split('T')[0],
      description: event.Description,
      schoolId: event.SchoolId || ''
    });
    setEditEventId(event.Id);
    setIsModalOpen(true);
    setErrorMessage('');
  };

  const handleDeleteEvent = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/events/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEvents(events.filter((event) => event.Id !== id));
      setErrorMessage('');
    } catch (error) {
      console.error('Error deleting event:', error);
      setErrorMessage('Error deleting event. Please try again.');
    }
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

      {/* Show Events for Selected School */}
      {(selectedSchool || userRole !== 'Admin') && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-dark-gray mb-4 sm:mb-0">
              Events {userRole === 'Admin' ? `for ${schools.find((s) => s.Id === selectedSchool)?.Name}` : 'for Your School'}
            </h1>
            <div className="flex space-x-3">
              {userRole === 'Admin' && (
                <motion.button
                  onClick={() => {
                    setSelectedSchool(null);
                    setEvents([]);
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
                  className="bg-regal-blue text-white px-4 py-2 rounded-lg hover:bg-regal-gold hover:text-regal-blue transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Add Event
                </motion.button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">Title</th>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider hidden sm:table-cell">Date</th>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider hidden lg:table-cell">Description</th>
                  <th className="px-4 py-2 sm:px-6 sm:py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                    {canPerformCRUD() ? 'Actions' : 'Details'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.map((event) => (
                  <>
                    <tr key={event.Id}>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-dark-gray">{event.Title}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-dark-gray hidden sm:table-cell">
                        {new Date(event.Date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 text-sm text-dark-gray hidden lg:table-cell">{event.Description}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm">
                        {canPerformCRUD() && (
                          <>
                            <motion.button
                              onClick={() => handleEditEvent(event)}
                              className="text-regal-blue hover:text-regal-gold mr-2 sm:mr-4"
                              whileHover={{ scale: 1.1 }}
                            >
                              <Edit className="w-5 h-5" />
                            </motion.button>
                            <motion.button
                              onClick={() => handleDeleteEvent(event.Id)}
                              className="text-red-600 hover:text-red-800 mr-2 sm:mr-4"
                              whileHover={{ scale: 1.1 }}
                            >
                              <Trash2 className="w-5 h-5" />
                            </motion.button>
                          </>
                        )}
                        <motion.button
                          onClick={() => toggleRowDetails(event.Id)}
                          className="lg:hidden text-regal-blue hover:text-regal-gold"
                          whileHover={{ scale: 1.1 }}
                        >
                          {expandedRow === event.Id ? (
                            <Minus className="w-5 h-5" />
                          ) : (
                            <Plus className="w-5 h-5" />
                          )}
                        </motion.button>
                      </td>
                    </tr>
                    {expandedRow === event.Id && (
                      <tr key={`${event.Id}-details`} className="lg:hidden">
                        <td colSpan={canPerformCRUD() ? 4 : 2} className="px-4 py-3 sm:px-6 sm:py-4">
                          <motion.div
                            className="bg-soft-gray p-4 rounded-lg border border-regal-gold/30"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <p className="text-sm text-dark-gray mb-2"><span className="font-medium">Date:</span> {new Date(event.Date).toLocaleDateString()}</p>
                            <p className="text-sm text-dark-gray"><span className="font-medium">Description:</span> {event.Description}</p>
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

      {/* Modal for Add/Edit Event */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-sm sm:max-w-md"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-lg sm:text-xl font-bold text-dark-gray mb-4">{editEventId ? 'Edit Event' : 'Add Event'}</h2>
            <div>
              <div className="mb-4">
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="title">
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                  placeholder="Enter event title"
                />
              </div>
              <div className="mb-4">
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="date">
                  Date
                </label>
                <input
                  type="date"
                  id="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                />
              </div>
              <div className="mb-4">
                <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-regal-blue"
                  placeholder="Enter description"
                  rows="3"
                />
              </div>
              {userRole === 'Admin' && (
                <div className="mb-4">
                  <label className="block text-dark-gray text-sm font-medium mb-2" htmlFor="schoolId">School</label>
                  <select
                    id="schoolId"
                    value={newEvent.schoolId}
                    onChange={(e) => setNewEvent({ ...newEvent, schoolId: e.target.value })}
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
                    setNewEvent({ title: '', date: '', description: '', schoolId: userRole === 'School' ? userSchoolId : '' });
                    setEditEventId(null);
                    setErrorMessage('');
                  }}
                  className="px-4 py-2 text-dark-gray hover:text-regal-blue"
                  whileHover={{ scale: 1.05 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handleAddEvent}
                  className="px-4 py-2 bg-regal-blue text-white rounded-lg hover:bg-regal-gold hover:text-regal-blue transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  {editEventId ? 'Update' : 'Add'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default EventList;