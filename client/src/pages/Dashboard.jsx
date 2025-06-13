import { motion } from 'framer-motion';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useState, useEffect } from 'react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalSubjects: 0,
    notices: 0,
  });
  const [lineData, setLineData] = useState({
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Teachers',
        data: [],
        borderColor: '#1E3A8A',
        backgroundColor: 'rgba(30, 58, 138, 0.2)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Students',
        data: [],
        borderColor: '#93C5FD',
        backgroundColor: 'rgba(147, 197, 253, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  });
  const [barData, setBarData] = useState({
    labels: ['Students'],
    datasets: [
      {
        label: 'Boys',
        data: [0],
        backgroundColor: '#93C5FD',
      },
      {
        label: 'Girls',
        data: [0],
        backgroundColor: '#1E3A8A',
      },
    ],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError('');

      try {
        // Fetch stats
        const statsResponse = await fetch('http://localhost:5000/api/dashboard/stats');
        if (!statsResponse.ok) {
          throw new Error('Failed to fetch dashboard stats');
        }
        const statsData = await statsResponse.json();
        setStats(statsData);

        // Fetch monthly data for line chart
        const monthlyResponse = await fetch('http://localhost:5000/api/dashboard/monthly-data');
        if (!monthlyResponse.ok) {
          throw new Error('Failed to fetch monthly data');
        }
        const monthlyData = await monthlyResponse.json();
        setLineData(prev => ({
          ...prev,
          datasets: [
            { ...prev.datasets[0], data: monthlyData.teachers },
            { ...prev.datasets[1], data: monthlyData.students },
          ],
        }));

        // Fetch gender data for bar chart
        const genderResponse = await fetch('http://localhost:5000/api/dashboard/gender-data');
        if (!genderResponse.ok) {
          throw new Error('Failed to fetch gender data');
        }
        const genderData = await genderResponse.json();
        setBarData(prev => ({
          ...prev,
          datasets: [
            { ...prev.datasets[0], data: [genderData.boys] },
            { ...prev.datasets[1], data: [genderData.girls] },
          ],
        }));
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message || 'An error occurred while fetching dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          className="w-12 h-12 border-4 border-regal-blue border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-500/20 text-white p-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="p-4 sm:p-6 lg:p-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-2xl sm:text-3xl font-bold text-dark-gray mb-6 sm:mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <motion.div
          className="bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
          whileHover={{ scale: 1.03 }}
        >
          <h2 className="text-base sm:text-lg font-semibold text-dark-gray">Total Students</h2>
          <p className="text-2xl sm:text-3xl font-bold text-regal-blue">{stats.totalStudents}</p>
        </motion.div>
        <motion.div
          className="bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
          whileHover={{ scale: 1.03 }}
        >
          <h2 className="text-base sm:text-lg font-semibold text-dark-gray">Total Teachers</h2>
          <p className="text-2xl sm:text-3xl font-bold text-regal-blue">{stats.totalTeachers}</p>
        </motion.div>
        <motion.div
          className="bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
          whileHover={{ scale: 1.03 }}
        >
          <h2 className="text-base sm:text-lg font-semibold text-dark-gray">Total Subjects</h2>
          <p className="text-2xl sm:text-3xl font-bold text-regal-blue">{stats.totalSubjects}</p>
        </motion.div>
        <motion.div
          className="bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
          whileHover={{ scale: 1.03 }}
        >
          <h2 className="text-base sm:text-lg font-semibold text-dark-gray">Notices</h2>
          <p className="text-2xl sm:text-3xl font-bold text-regal-blue">{stats.notices}</p>
        </motion.div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <h2 className="text-base sm:text-lg font-semibold text-dark-gray mb-4">Overview</h2>
          <div className="h-48 sm:h-64">
            <Line data={lineData} options={chartOptions} />
          </div>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <h2 className="text-base sm:text-lg font-semibold text-dark-gray mb-4">Number of Students</h2>
          <div className="h-48 sm:h-64">
            <Bar data={barData} options={chartOptions} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;