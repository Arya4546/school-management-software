import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit, Trash2 } from 'lucide-react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const Accounts = () => {
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [entities, setEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [data, setData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRecord, setNewRecord] = useState({});
  const [editRecordId, setEditRecordId] = useState(null);
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
    if (selectedSchool && selectedType) {
      fetchEntities();
    }
  }, [selectedSchool, selectedType]);

  const fetchEntities = async () => {
    try {
      let url = '';
      if (selectedType === 'Teachers') {
        url = `${API_URL}/api/teachers`;
      } else if (selectedType === 'Staff') {
        url = `${API_URL}/api/staff`;
      } else if (selectedType === 'Students') {
        url = `${API_URL}/api/students`;
      }
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { schoolId: selectedSchool },
      });
      setEntities(response.data);
      setSelectedEntity(null);
      setData([]);
    } catch (error) {
      console.error(`Error fetching ${selectedType.toLowerCase()}:`, error);
      const errorMsg = error.response?.data?.message || `Failed to load ${selectedType.toLowerCase()}. Please try again.`;
      setErrorMessage(errorMsg);
    }
  };

  useEffect(() => {
    if (selectedSchool && selectedType && selectedEntity) {
      fetchData();
    }
  }, [selectedSchool, selectedType, selectedEntity]);

  const fetchData = async () => {
    try {
      let url = '';
      if (selectedType === 'Students') {
        url = `${API_URL}/api/accounts/school/${selectedSchool}/fees`;
      } else if (selectedType === 'Teachers') {
        url = `${API_URL}/api/accounts/school/${selectedSchool}/teacher-salaries`;
      } else if (selectedType === 'Staff') {
        url = `${API_URL}/api/accounts/school/${selectedSchool}/staff-salaries`;
      }
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const filteredData = response.data.filter(item => {
        if (selectedType === 'Students') {
          return item.StudentId === selectedEntity;
        } else {
          return item.Id === selectedEntity;
        }
      });
      setData(filteredData);
    } catch (error) {
      console.error(`Error fetching ${selectedType.toLowerCase()} data:`, error);
      const errorMsg = error.response?.data?.message || `Failed to load ${selectedType.toLowerCase()} data. Please try again.`;
      setErrorMessage(errorMsg);
    }
  };

  const formatMonthForDisplay = (month) => {
    if (!month) return '';
    const date = new Date(month);
    if (isNaN(date.getTime())) return month; // Fallback if not a valid date
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // Convert to YYYY-MM
  };

  const convertMonthToDate = (month) => {
    if (!month) return null;
    // If month is already a full date (e.g., from database), extract YYYY-MM
    const date = new Date(month);
    if (!isNaN(date.getTime())) {
      month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    // Ensure month is in YYYY-MM format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      throw new Error('Invalid month format. Use YYYY-MM.');
    }
    // Convert to full date by appending -01
    return `${month}-01`;
  };

  const handleAddOrUpdateRecord = async () => {
    try {
      if (selectedType === 'Students') {
        if (!newRecord.studentId || !newRecord.amount || !newRecord.dueDate) {
          setErrorMessage('Student ID, Amount, and Due Date are required.');
          return;
        }
      } else {
        if (!newRecord.employeeId || !newRecord.amount || !newRecord.month) {
          setErrorMessage('Employee ID, Amount, and Month are required.');
          return;
        }
      }

      const token = localStorage.getItem('token');
      const recordData = { ...newRecord };

      if (selectedType === 'Students') {
        recordData.submitted = recordData.submitted || 0;
        recordData.fine = recordData.fine || 0;
      } else {
        recordData.tax = recordData.tax || 0;
        recordData.pf = recordData.pf || 0;
        recordData.bonus = recordData.bonus || 0;
        // Convert month to full date (YYYY-MM-DD)
        try {
          recordData.month = convertMonthToDate(recordData.month);
        } catch (error) {
          setErrorMessage(error.message);
          return;
        }
      }

      if (selectedType === 'Teachers') {
        recordData.teacherId = newRecord.employeeId;
      } else if (selectedType === 'Staff') {
        recordData.staffId = newRecord.employeeId;
      } else {
        recordData.studentId = newRecord.studentId;
      }
      delete recordData.employeeId;

      const url = editRecordId
        ? `${API_URL}/api/accounts/${selectedType === 'Students' ? 'fees' : 'salaries'}/${editRecordId}`
        : `${API_URL}/api/accounts/${selectedType === 'Students' ? 'fees' : 'salaries'}`;

      if (editRecordId) {
        await axios.put(url, recordData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(url, recordData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      fetchData();
      setNewRecord({});
      setEditRecordId(null);
      setIsModalOpen(false);
      setErrorMessage('');
    } catch (error) {
      console.error('Error saving record:', error);
      const errorMsg = error.response?.data?.message || 'Error saving record. Please try again.';
      setErrorMessage(errorMsg);
    }
  };

  const handleEditRecord = (record) => {
    if (selectedType === 'Students') {
      setNewRecord({
        studentId: record.StudentId,
        amount: record.Amount,
        submitted: record.Submitted,
        fine: record.Fine,
        dueDate: record.DueDate.split('T')[0],
        status: record.Status,
      });
    } else {
      setNewRecord({
        employeeId: record.Id,
        amount: record.Amount,
        month: formatMonthForDisplay(record.Month), // Convert to YYYY-MM for input
        status: record.Status,
        tax: record.Tax,
        pf: record.PF,
        bonus: record.Bonus,
      });
    }
    setEditRecordId(record.SalaryId || record.Id); // Use SalaryId for salaries, Id for fees
    setIsModalOpen(true);
  };

  const handleDeleteRecord = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/accounts/${selectedType === 'Students' ? 'fees' : 'salaries'}/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting record:', error);
      const errorMsg = error.response?.data?.message || 'Error deleting record. Please try again.';
      setErrorMessage(errorMsg);
    }
  };

  const downloadExcel = () => {
    const exportData = data.map((item) => {
      if (selectedType === 'Students') {
        return {
          StudentID: item.StudentId,
          StudentName: item.StudentName || 'N/A', // Fallback if StudentName is undefined
          Amount: item.Amount,
          Submitted: item.Submitted,
          Balance: item.Balance,
          Fine: item.Fine,
          DueDate: item.DueDate.split('T')[0],
          Status: item.Status,
          CreatedAt: item.CreatedAt.split('T')[0],
        };
      } else {
        return {
          EmployeeID: item.Id,
          Name: item.Name,
          Amount: item.Amount,
          Month: formatMonthForDisplay(item.Month),
          Status: item.Status,
          Tax: item.Tax,
          PF: item.PF,
          Bonus: item.Bonus,
          NetSalary: item.NetSalary,
          CreatedAt: item.CreatedAt.split('T')[0],
        };
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, selectedType);
    XLSX.writeFile(workbook, `${selectedType}_Accounts.xlsx`);
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
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Accounts Management</h1>

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        {!selectedSchool && userRole === 'Admin' && (
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

        {selectedSchool && !selectedType && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 sm:mb-0">
                Select a Category
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <motion.div
                className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer"
                onClick={() => setSelectedType('Teachers')}
                whileHover={{ scale: 1.03 }}
              >
                <h2 className="text-lg font-semibold text-gray-800">Teachers</h2>
                <p className="text-sm text-gray-600">View and manage teacher salaries</p>
              </motion.div>
              <motion.div
                className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer"
                onClick={() => setSelectedType('Staff')}
                whileHover={{ scale: 1.03 }}
              >
                <h2 className="text-lg font-semibold text-gray-800">Staff</h2>
                <p className="text-sm text-gray-600">View and manage staff salaries</p>
              </motion.div>
              <motion.div
                className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer"
                onClick={() => setSelectedType('Students')}
                whileHover={{ scale: 1.03 }}
              >
                <h2 className="text-lg font-semibold text-gray-800">Students</h2>
                <p className="text-sm text-gray-600">View and manage student fees</p>
              </motion.div>
            </div>
          </>
        )}

        {selectedType && !selectedEntity && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 sm:mb-0">
                Select a {selectedType.slice(0, -1)}
              </h2>
              <motion.button
                onClick={() => {
                  setSelectedType(null);
                  setEntities([]);
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-300"
                whileHover={{ scale: 1.05 }}
              >
                Back to Categories
              </motion.button>
            </div>
            {entities.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-4 text-center text-gray-600">
                No {selectedType.toLowerCase()} found for this school.
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {entities.map((entity) => (
                        <tr key={entity.Id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{entity.Id}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{entity.Name}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <motion.button
                              onClick={() => setSelectedEntity(entity.Id)}
                              className="text-blue-600 hover:text-blue-800"
                              whileHover={{ scale: 1.1 }}
                            >
                              View Records
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

        {selectedType && selectedEntity && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 sm:mb-0">
                {selectedType === 'Students' ? 'Fees' : 'Salaries'} for {entities.find(e => e.Id === selectedEntity)?.Name}
              </h2>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <motion.button
                  onClick={() => {
                    setSelectedEntity(null);
                    setData([]);
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                >
                  Back to {selectedType}
                </motion.button>
                {canPerformCRUD() && (
                  <motion.button
                    onClick={() => {
                      setNewRecord({ employeeId: selectedEntity, studentId: selectedEntity });
                      setEditRecordId(null);
                      setIsModalOpen(true);
                    }}
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
                      {selectedType === 'Students' ? (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Student ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Student Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Submitted</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Balance</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Fine</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Due Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Created At</th>
                          {canPerformCRUD() && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                          )}
                        </>
                      ) : (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Employee ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Month</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Tax</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">PF</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Bonus</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Net Salary</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Created At</th>
                          {canPerformCRUD() && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                          )}
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((item) => (
                      <tr key={item.SalaryId || item.Id} className="hover:bg-gray-50">
                        {selectedType === 'Students' ? (
                          <>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.StudentId}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.StudentName || 'N/A'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.Amount}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.Submitted}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.Balance}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.Fine}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.DueDate.split('T')[0]}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.Status}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.CreatedAt.split('T')[0]}</td>
                            {canPerformCRUD() && (
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <motion.button
                                  onClick={() => handleEditRecord(item)}
                                  className="text-blue-600 hover:text-blue-800 mr-2 sm:mr-4"
                                  whileHover={{ scale: 1.1 }}
                                >
                                  <Edit className="w-5 h-5" />
                                </motion.button>
                                <motion.button
                                  onClick={() => handleDeleteRecord(item.Id)}
                                  className="text-red-600 hover:text-red-800"
                                  whileHover={{ scale: 1.1 }}
                                >
                                  <Trash2 className="w-5 h-5" />
                                </motion.button>
                              </td>
                            )}
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.Id}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.Name}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.Amount}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatMonthForDisplay(item.Month)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.Status}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.Tax}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.PF}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.Bonus}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.NetSalary}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.CreatedAt.split('T')[0]}</td>
                            {canPerformCRUD() && (
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <motion.button
                                  onClick={() => handleEditRecord(item)}
                                  className="text-blue-600 hover:text-blue-800 mr-2 sm:mr-4"
                                  whileHover={{ scale: 1.1 }}
                                >
                                  <Edit className="w-5 h-5" />
                                </motion.button>
                                <motion.button
                                  onClick={() => handleDeleteRecord(item.SalaryId || item.Id)}
                                  className="text-red-600 hover:text-red-800"
                                  whileHover={{ scale: 1.1 }}
                                >
                                  <Trash2 className="w-5 h-5" />
                                </motion.button>
                              </td>
                            )}
                          </>
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
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                {editRecordId ? 'Edit' : 'Add'} {selectedType === 'Students' ? 'Fee' : 'Salary'}
              </h2>
              <div>
                {selectedType === 'Students' ? (
                  <>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="studentId">
                        Student ID
                      </label>
                      <motion.input
                        type="number"
                        id="studentId"
                        value={newRecord.studentId || ''}
                        onChange={(e) => setNewRecord({ ...newRecord, studentId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        whileFocus={{ scale: 1.02 }}
                        disabled
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="amount">
                        Amount
                      </label>
                      <motion.input
                        type="number"
                        step="0.01"
                        id="amount"
                        value={newRecord.amount || ''}
                        onChange={(e) => setNewRecord({ ...newRecord, amount: parseFloat(e.target.value) || '' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        whileFocus={{ scale: 1.02 }}
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="submitted">
                        Submitted
                      </label>
                      <motion.input
                        type="number"
                        step="0.01"
                        id="submitted"
                        value={newRecord.submitted || ''}
                        onChange={(e) => setNewRecord({ ...newRecord, submitted: parseFloat(e.target.value) || '' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        whileFocus={{ scale: 1.02 }}
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="fine">
                        Fine
                      </label>
                      <motion.input
                        type="number"
                        step="0.01"
                        id="fine"
                        value={newRecord.fine || ''}
                        onChange={(e) => setNewRecord({ ...newRecord, fine: parseFloat(e.target.value) || '' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        whileFocus={{ scale: 1.02 }}
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="dueDate">
                        Due Date
                      </label>
                      <motion.input
                        type="date"
                        id="dueDate"
                        value={newRecord.dueDate || ''}
                        onChange={(e) => setNewRecord({ ...newRecord, dueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        whileFocus={{ scale: 1.02 }}
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="status">
                        Status
                      </label>
                      <select
                        id="status"
                        value={newRecord.status || 'Pending'}
                        onChange={(e) => setNewRecord({ ...newRecord, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Paid">Paid</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="employeeId">
                        {selectedType.slice(0, -1)} ID
                      </label>
                      <motion.input
                        type="number"
                        id="employeeId"
                        value={newRecord.employeeId || ''}
                        onChange={(e) => setNewRecord({ ...newRecord, employeeId: parseInt(e.target.value) || '' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        whileFocus={{ scale: 1.02 }}
                        disabled
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="amount">
                        Amount
                      </label>
                      <motion.input
                        type="number"
                        step="0.01"
                        id="amount"
                        value={newRecord.amount || ''}
                        onChange={(e) => setNewRecord({ ...newRecord, amount: parseFloat(e.target.value) || '' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        whileFocus={{ scale: 1.02 }}
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="month">
                        Month (YYYY-MM)
                      </label>
                      <motion.input
                        type="text"
                        id="month"
                        placeholder="YYYY-MM"
                        value={newRecord.month || ''}
                        onChange={(e) => setNewRecord({ ...newRecord, month: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        whileFocus={{ scale: 1.02 }}
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="status">
                        Status
                      </label>
                      <select
                        id="status"
                        value={newRecord.status || 'Not Credited'}
                        onChange={(e) => setNewRecord({ ...newRecord, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                      >
                        <option value="Not Credited">Not Credited</option>
                        <option value="Credited">Credited</option>
                      </select>
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="tax">
                        Tax
                      </label>
                      <motion.input
                        type="number"
                        step="0.01"
                        id="tax"
                        value={newRecord.tax || ''}
                        onChange={(e) => setNewRecord({ ...newRecord, tax: parseFloat(e.target.value) || '' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        whileFocus={{ scale: 1.02 }}
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="pf">
                        PF
                      </label>
                      <motion.input
                        type="number"
                        step="0.01"
                        id="pf"
                        value={newRecord.pf || ''}
                        onChange={(e) => setNewRecord({ ...newRecord, pf: parseFloat(e.target.value) || '' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        whileFocus={{ scale: 1.02 }}
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="bonus">
                        Bonus
                      </label>
                      <motion.input
                        type="number"
                        step="0.01"
                        id="bonus"
                        value={newRecord.bonus || ''}
                        onChange={(e) => setNewRecord({ ...newRecord, bonus: parseFloat(e.target.value) || '' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                        whileFocus={{ scale: 1.02 }}
                      />
                    </div>
                  </>
                )}
                <div className="flex justify-end space-x-3">
                  <motion.button
                    onClick={() => {
                      setIsModalOpen(false);
                      setNewRecord({});
                      setEditRecordId(null);
                      setErrorMessage('');
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleAddOrUpdateRecord}
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

export default Accounts;