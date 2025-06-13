const express = require('express');
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const cors = require('cors');
const excel = require('exceljs');

dotenv.config();
const app = express();

// Configure CORS to allow requests from the specific origin
app.use(cors({
  origin: '*', // Allow only this origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'UPDATE'], // Specify allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
}));

app.use(express.json());

// SQL Server Configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then(pool => {
    console.log('Connected to SQL Server');
    return pool;
  })
  .catch(err => {
    console.error('Database Connection Failed:', err);
    process.exit(1);
  });

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', sql.Int, decoded.userId)
      .query('SELECT Id, Role, SchoolId FROM Users WHERE Id = @userId');
    const user = result.recordset[0];
    if (!user) return res.status(404).json({ message: 'User not found' });

    req.user = { userId: user.Id, role: user.Role, schoolId: user.SchoolId };
    next();
  } catch (error) {
    res.status(403).json({ message: 'Invalid token' });
  }
};

// Login Route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login request received:', { username });

  if (!username || !password) {
    console.log('Missing username or password');
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    console.log('Attempting to connect to database...');
    const pool = await poolPromise;
    console.log('Database connection successful');

    console.log('Executing query to fetch user...');
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .query('SELECT * FROM Users WHERE Username = @username');
    console.log('Query executed, result:', result);

    const user = result.recordset[0];
    if (!user) {
      console.log('User not found for username:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('Comparing password...');
    const isMatch = await bcrypt.compare(password, user.Password);
    console.log('Password comparison result:', isMatch);

    if (!isMatch) {
      console.log('Password does not match for username:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('Generating JWT token...');
    const token = jwt.sign({ userId: user.Id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('JWT token generated:', token);

    res.json({ token, role: user.Role, username: user.Username, schoolId: user.SchoolId });
  } catch (error) {
    console.error('Error in /api/login:', error);
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT Id, Username, Role, SchoolId FROM Users WHERE Id = @userId');
    const user = result.recordset[0];
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ userId: user.Id, username: user.Username, role: user.Role, schoolId: user.SchoolId });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user details', error: error.message });
  }
});

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const pool = await poolPromise;
    const stats = {};

    const studentsResult = await pool.request().query('SELECT COUNT(*) AS count FROM Students');
    stats.totalStudents = studentsResult.recordset[0].count;

    const teachersResult = await pool.request().query('SELECT COUNT(*) AS count FROM Teachers');
    stats.totalTeachers = teachersResult.recordset[0].count;

    const subjectsResult = await pool.request().query('SELECT COUNT(*) AS count FROM Subjects');
    stats.totalSubjects = subjectsResult.recordset[0].count;

    const noticesResult = await pool.request().query('SELECT COUNT(*) AS count FROM Notices');
    stats.notices = noticesResult.recordset[0].count;

    res.json(stats);
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ message: 'Server error while fetching dashboard stats' });
  }
});

app.get('/api/dashboard/monthly-data', async (req, res) => {
  try {
    const pool = await poolPromise;
    const monthlyData = {
      teachers: Array(12).fill(0),
      students: Array(12).fill(0),
    };

    const teachersResult = await pool.request().query(`
      SELECT MONTH(CreatedAt) AS month, COUNT(*) AS count
      FROM Teachers
      WHERE YEAR(CreatedAt) = YEAR(GETDATE())
      GROUP BY MONTH(CreatedAt)
    `);
    teachersResult.recordset.forEach(row => {
      monthlyData.teachers[row.month - 1] = row.count;
    });

    const studentsResult = await pool.request().query(`
      SELECT MONTH(CreatedAt) AS month, COUNT(*) AS count
      FROM Students
      WHERE YEAR(CreatedAt) = YEAR(GETDATE())
      GROUP BY MONTH(CreatedAt)
    `);
    studentsResult.recordset.forEach(row => {
      monthlyData.students[row.month - 1] = row.count;
    });

    res.json(monthlyData);
  } catch (err) {
    console.error('Error fetching monthly data:', err);
    res.status(500).json({ message: 'Server error while fetching monthly data' });
  }
});

app.get('/api/dashboard/gender-data', async (req, res) => {
  try {
    const pool = await poolPromise;
    const genderData = {
      boys: 0,
      girls: 0,
    };

    const result = await pool.request().query(`
      SELECT Gender, COUNT(*) AS count
      FROM Students
      GROUP BY Gender
    `);
    result.recordset.forEach(row => {
      if (row.Gender && typeof row.Gender === 'string') {
        if (row.Gender.toLowerCase() === 'male') {
          genderData.boys = row.count;
        } else if (row.Gender.toLowerCase() === 'female') {
          genderData.girls = row.count;
        }
      }
    });

    res.json(genderData);
  } catch (err) {
    console.error('Error fetching gender data:', err);
    res.status(500).json({ message: 'Server error while fetching gender data' });
  }
});

// Schools Routes
app.get('/api/schools/names', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'Admin') return res.status(403).json({ message: 'Access denied' });

    const pool = await poolPromise;
    const result = await pool.request().query('SELECT Id, Name FROM Schools ORDER BY Name');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching school names', error: error.message });
  }
});

app.get('/api/schools', authenticateToken, async (req, res) => {
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;
    let query = '';
    if (role === 'Admin') {
      query = 'SELECT * FROM Schools';
    } else {
      query = 'SELECT * FROM Schools WHERE Id = @schoolId';
    }

    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query(query);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching schools', error: error.message });
  }
});

app.post('/api/schools', authenticateToken, async (req, res) => {
  const { name, address, contact, email } = req.body;
  try {
    const { role } = req.user;
    if (role !== 'Admin') return res.status(403).json({ message: 'Access denied' });

    const pool = await poolPromise;
    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('address', sql.NVarChar, address)
      .input('contact', sql.NVarChar, contact)
      .input('email', sql.NVarChar, email)
      .query('INSERT INTO Schools (Name, Address, Contact, Email) VALUES (@name, @address, @contact, @email)');
    res.status(201).json({ message: 'School added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding school', error: error.message });
  }
});

app.put('/api/schools/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, address, contact, email } = req.body;
  try {
    const { role } = req.user;
    if (role !== 'Admin') return res.status(403).json({ message: 'Access denied' });

    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('address', sql.NVarChar, address)
      .input('contact', sql.NVarChar, contact)
      .input('email', sql.NVarChar, email)
      .query('UPDATE Schools SET Name = @name, Address = @address, Contact = @contact, Email = @email WHERE Id = @id');
    res.json({ message: 'School updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating school', error: error.message });
  }
});

app.delete('/api/schools/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const { role } = req.user;
    if (role !== 'Admin') return res.status(403).json({ message: 'Access denied' });

    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Schools WHERE Id = @id');
    res.json({ message: 'School deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting school', error: error.message });
  }
});

// Users Routes
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;
    let query = '';
    if (role === 'Admin') {
      query = 'SELECT Id, Username, Role, Email, SchoolId FROM Users';
    } else if (role === 'School') {
      query = 'SELECT Id, Username, Role, Email, SchoolId FROM Users WHERE SchoolId = @schoolId OR Role = \'Admin\'';
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query(query);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  const { username, password, role, email, schoolId } = req.body;
  try {
    const { role: userRole } = req.user;
    if (userRole !== 'Admin' && userRole !== 'School') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const pool = await poolPromise;
    await pool.request()
      .input('username', sql.NVarChar, username)
      .input('password', sql.NVarChar, hashedPassword)
      .input('role', sql.NVarChar, role)
      .input('email', sql.NVarChar, email)
      .input('schoolId', sql.Int, schoolId)
      .query('INSERT INTO Users (Username, Password, Role, Email, SchoolId) VALUES (@username, @password, @role, @email, @schoolId)');
    res.status(201).json({ message: 'User added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding user', error: error.message });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { username, password, role, email, schoolId } = req.body;
  try {
    const { role: userRole } = req.user;
    if (userRole !== 'Admin' && userRole !== 'School') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const pool = await poolPromise;
    let query = 'UPDATE Users SET Username = @username, Role = @role, Email = @email, SchoolId = @schoolId';
    const request = pool.request()
      .input('id', sql.Int, id)
      .input('username', sql.NVarChar, username)
      .input('role', sql.NVarChar, role)
      .input('email', sql.NVarChar, email)
      .input('schoolId', sql.Int, schoolId);

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', Password = @password';
      request.input('password', sql.NVarChar, hashedPassword);
    }

    query += ' WHERE Id = @id';
    await request.query(query);
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const { role: userRole } = req.user;
    if (userRole !== 'Admin' && userRole !== 'School') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Users WHERE Id = @id');
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { username, password, role, email, schoolId } = req.body;
  try {
    const { role: userRole } = req.user;
    if (userRole !== 'Admin' && userRole !== 'School') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const pool = await poolPromise;
    let query = 'UPDATE Users SET Username = @username, Role = @role, Email = @email, SchoolId = @schoolId';
    const request = pool.request()
      .input('id', sql.Int, id)
      .input('username', sql.NVarChar, username)
      .input('role', sql.NVarChar, role)
      .input('email', sql.NVarChar, email)
      .input('schoolId', sql.Int, schoolId);

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', Password = @password';
      request.input('password', sql.NVarChar, hashedPassword);
    }

    query += ' WHERE Id = @id';
    await request.query(query);
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const { role: userRole } = req.user;
    if (userRole !== 'Admin' && userRole !== 'School') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Users WHERE Id = @id');
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
});

// Classes Routes
app.get('/api/classes', authenticateToken, async (req, res) => {
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;
    let query = '';
    if (role === 'Admin') {
      query = 'SELECT * FROM Classes';
    } else {
      query = 'SELECT * FROM Classes WHERE SchoolId = @schoolId';
    }

    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query(query);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching classes', error: error.message });
  }
});

app.post('/api/classes', authenticateToken, async (req, res) => {
  const { name, section, room, schoolId } = req.body;
  try {
    const { role, schoolId: userSchoolId } = req.user;
    if (role !== 'Admin' && (role !== 'School' || userSchoolId !== schoolId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const pool = await poolPromise;
    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('section', sql.NVarChar, section)
      .input('room', sql.NVarChar, room)
      .input('schoolId', sql.Int, schoolId)
      .query('INSERT INTO Classes (Name, Section, Room, SchoolId) VALUES (@name, @section, @room, @schoolId)');
    res.status(201).json({ message: 'Class added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding class', error: error.message });
  }
});

app.put('/api/classes/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, section, room, schoolId } = req.body;
  try {
    const { role, schoolId: userSchoolId } = req.user;
    if (role !== 'Admin' && (role !== 'School' || userSchoolId !== schoolId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('section', sql.NVarChar, section)
      .input('room', sql.NVarChar, room)
      .input('schoolId', sql.Int, schoolId)
      .query('UPDATE Classes SET Name = @name, Section = @section, Room = @room, SchoolId = @schoolId WHERE Id = @id');
    res.json({ message: 'Class updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating class', error: error.message });
  }
});

app.delete('/api/classes/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;
    const classResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT SchoolId FROM Classes WHERE Id = @id');
    const classData = classResult.recordset[0];
    if (!classData) return res.status(404).json({ message: 'Class not found' });
    if (role !== 'Admin' && (role !== 'School' || classData.SchoolId !== schoolId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Classes WHERE Id = @id');
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting class', error: error.message });
  }
});

// Students Routes (protected)
app.get('/api/students/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, schoolId, userId } = req.user;
    const pool = await poolPromise;

    // Fetch student details
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT s.Id, s.Name, s.RollNo, s.Email, s.Gender, s.ClassId, c.Name AS Class
        FROM Students s
        JOIN Classes c ON s.ClassId = c.Id
        WHERE s.Id = @id
      `);
    const student = result.recordset[0];
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Fetch class details to get SchoolId
    const classResult = await pool.request()
      .input('classId', sql.Int, student.ClassId)
      .query('SELECT SchoolId FROM Classes WHERE Id = @classId');
    const classData = classResult.recordset[0];
    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Access control
    if (role === 'Student' && parseInt(userId) !== parseInt(id)) {
      return res.status(403).json({ message: 'Access denied: Students can only view their own details' });
    }
    if (role !== 'Admin' && classData.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied: You can only view students in your own school' });
    }

    res.json(student);
  } catch (err) {
    console.error('Error fetching student:', err);
    res.status(500).json({ message: 'Server error while fetching student' });
  }
});

app.get('/api/students/class/:classId', authenticateToken, async (req, res) => {
  try {
    const { classId } = req.params;
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    // Verify class exists
    const classResult = await pool.request()
      .input('classId', sql.Int, classId)
      .query('SELECT Id, SchoolId FROM Classes WHERE Id = @classId');
    const classData = classResult.recordset[0];
    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Access control (Admin can access all, others only their own school)
    if (role !== 'Admin' && classData.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied: You can only view students in your own school' });
    }

    const result = await pool.request()
      .input('classId', sql.Int, classId)
      .query(`
        SELECT s.Id, s.Name, s.RollNo, s.Email, s.Gender, s.ClassId, c.Name AS Class
        FROM Students s
        JOIN Classes c ON s.ClassId = c.Id
        WHERE s.ClassId = @classId
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching students by class:', err);
    res.status(500).json({ message: 'Server error while fetching students by class', error: err.message });
  }
});

app.post('/api/students', authenticateToken, async (req, res) => {
  try {
    const { name, rollNo, email, gender, classId } = req.body;
    const { role, schoolId } = req.user;

    if (!name || !rollNo || !email || !classId) {
      return res.status(400).json({ message: 'Name, roll number, email, and classId are required' });
    }

    const pool = await poolPromise;

    // Verify class exists and get SchoolId
    const classResult = await pool.request()
      .input('classId', sql.Int, classId)
      .query('SELECT Id, SchoolId FROM Classes WHERE Id = @classId');
    const classData = classResult.recordset[0];
    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Access control
    if (role !== 'Admin' && classData.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied: You can only add students to your own school' });
    }

    // Check if rollNo already exists within the same class
    const rollNoCheck = await pool.request()
      .input('rollNo', sql.NVarChar, rollNo)
      .input('classId', sql.Int, classId)
      .query('SELECT Id FROM Students WHERE RollNo = @rollNo AND ClassId = @classId');
    if (rollNoCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Roll number already exists in this class' });
    }

    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('rollNo', sql.NVarChar, rollNo)
      .input('email', sql.NVarChar, email)
      .input('gender', sql.NVarChar, gender || null)
      .input('classId', sql.Int, classId)
      .query(`
        INSERT INTO Students (Name, RollNo, Email, Gender, ClassId, Phone, CreatedAt)
        OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.RollNo, INSERTED.Email, INSERTED.Gender, INSERTED.ClassId
        VALUES (@name, @rollNo, @email, @gender, @classId, NULL, GETDATE());
        SELECT c.Name AS Class
        FROM Classes c
        WHERE c.Id = @classId;
      `);

    const insertedStudent = result.recordset[0];
    const classRecord = result.recordsets[1][0];
    insertedStudent.Class = classRecord.Class;

    res.status(201).json(insertedStudent);
  } catch (err) {
    console.error('Error creating student:', err);
    res.status(500).json({ message: 'Server error while creating student' });
  }
});

app.put('/api/students/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, rollNo, email, gender, classId } = req.body;
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    // Verify class exists and get SchoolId
    const classResult = await pool.request()
      .input('classId', sql.Int, classId)
      .query('SELECT Id, SchoolId FROM Classes WHERE Id = @classId');
    const classData = classResult.recordset[0];
    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Access control
    if (role !== 'Admin' && classData.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied: You can only update students in your own school' });
    }

    // Check if rollNo is already used by another student in the same class
    const rollNoCheck = await pool.request()
      .input('rollNo', sql.NVarChar, rollNo)
      .input('id', sql.Int, id)
      .input('classId', sql.Int, classId)
      .query('SELECT Id FROM Students WHERE RollNo = @rollNo AND ClassId = @classId AND Id != @id');
    if (rollNoCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Roll number already exists in this class' });
    }

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('rollNo', sql.NVarChar, rollNo)
      .input('email', sql.NVarChar, email)
      .input('gender', sql.NVarChar, gender || null)
      .input('classId', sql.Int, classId)
      .query(`
        UPDATE Students
        SET Name = @name, RollNo = @rollNo, Email = @email, Gender = @gender, ClassId = @classId
        WHERE Id = @id;
        SELECT s.Id, s.Name, s.RollNo, s.Email, s.Gender, s.ClassId, c.Name AS Class
        FROM Students s
        JOIN Classes c ON s.ClassId = c.Id
        WHERE s.Id = @id;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error updating student:', err);
    res.status(500).json({ message: 'Server error while updating student' });
  }
});

app.delete('/api/students/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    // Fetch student to verify school
    const studentResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT ClassId FROM Students WHERE Id = @id');
    const student = studentResult.recordset[0];
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const classResult = await pool.request()
      .input('classId', sql.Int, student.ClassId)
      .query('SELECT SchoolId FROM Classes WHERE Id = @classId');
    const classData = classResult.recordset[0];
    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Access control
    if (role !== 'Admin' && classData.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied: You can only delete students in your own school' });
    }

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Students WHERE Id = @id');
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ message: 'Server error while deleting student' });
  }
});
app.get('/api/teachers', authenticateToken, async (req, res) => {
  try {
    const { role, schoolId } = req.user;
    const requestedSchoolId = req.query.schoolId ? parseInt(req.query.schoolId) : null;
    const pool = await poolPromise;
    let query = '';
    let request = pool.request();

    if (role === 'Admin') {
      if (requestedSchoolId) {
        query = `
          SELECT Id, Name, Email, Phone, SchoolId, CreatedAt, DateOfBirth
          FROM Teachers
          WHERE SchoolId = @schoolId
          ORDER BY Name
        `;
        request.input('schoolId', sql.Int, requestedSchoolId);
      } else {
        query = `
          SELECT Id, Name, Email, Phone, SchoolId, CreatedAt, DateOfBirth
          FROM Teachers
          ORDER BY Name
        `;
      }
    } else if (role === 'School') {
      query = `
        SELECT Id, Name, Email, Phone, SchoolId, CreatedAt, DateOfBirth
        FROM Teachers
        WHERE SchoolId = @schoolId
        ORDER BY Name
      `;
      request.input('schoolId', sql.Int, schoolId);
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching teachers:', err);
    res.status(500).json({ message: 'Server error while fetching teachers' });
  }
});

app.post('/api/teachers', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, schoolId, dateOfBirth } = req.body;
    const { role, schoolId: userSchoolId } = req.user;

    if (!name || !email || !schoolId) {
      return res.status(400).json({ message: 'Name, email, and schoolId are required' });
    }

    if (role !== 'Admin' && (role !== 'School' || userSchoolId !== parseInt(schoolId))) {
      return res.status(403).json({ message: 'Access denied: You can only add teachers to your own school' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('phone', sql.NVarChar, phone || null)
      .input('schoolId', sql.Int, schoolId)
      .input('dateOfBirth', sql.Date, dateOfBirth || null)
      .query(`
        INSERT INTO Teachers (Name, Email, Phone, SchoolId, CreatedAt, DateOfBirth)
        OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Email, INSERTED.Phone, INSERTED.SchoolId, INSERTED.CreatedAt, INSERTED.DateOfBirth
        VALUES (@name, @email, @phone, @schoolId, GETDATE(), @dateOfBirth)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error creating teacher:', err);
    res.status(500).json({ message: 'Server error while creating teacher' });
  }
});

app.put('/api/teachers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, schoolId, dateOfBirth } = req.body;
    const { role, schoolId: userSchoolId } = req.user;

    if (!name || !email || !schoolId) {
      return res.status(400).json({ message: 'Name, email, and schoolId are required' });
    }

    const pool = await poolPromise;
    const teacherResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT SchoolId FROM Teachers WHERE Id = @id');
    const teacher = teacherResult.recordset[0];
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    if (role !== 'Admin' && (role !== 'School' || (teacher.SchoolId !== userSchoolId || parseInt(schoolId) !== userSchoolId))) {
      return res.status(403).json({ message: 'Access denied: You can only edit teachers in your own school' });
    }

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('phone', sql.NVarChar, phone || null)
      .input('schoolId', sql.Int, schoolId)
      .input('dateOfBirth', sql.Date, dateOfBirth || null)
      .query(`
        UPDATE Teachers
        SET Name = @name, Email = @email, Phone = @phone, SchoolId = @schoolId, DateOfBirth = @dateOfBirth
        WHERE Id = @id;
        SELECT Id, Name, Email, Phone, SchoolId, CreatedAt, DateOfBirth
        FROM Teachers
        WHERE Id = @id;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error updating teacher:', err);
    res.status(500).json({ message: 'Server error while updating teacher' });
  }
});

app.delete('/api/teachers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, schoolId } = req.user;

    const pool = await poolPromise;
    const teacherResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT SchoolId FROM Teachers WHERE Id = @id');
    const teacher = teacherResult.recordset[0];
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    if (role !== 'Admin' && (role !== 'School' || teacher.SchoolId !== schoolId)) {
      return res.status(403).json({ message: 'Access denied: You can only delete teachers in your own school' });
    }

    // Check if the teacher is assigned to any subjects
    const subjectsResult = await pool.request()
      .input('teacherId', sql.Int, id)
      .query('SELECT Id, Name FROM Subjects WHERE TeacherId = @teacherId');
    if (subjectsResult.recordset.length > 0) {
      const subjectNames = subjectsResult.recordset.map(s => s.Name).join(', ');
      return res.status(400).json({
        message: `Cannot delete teacher because they are assigned to the following subjects: ${subjectNames}. Please reassign or remove these subjects first.`
      });
    }

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Teachers WHERE Id = @id');
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting teacher:', err);
    if (err.number === 547) {
      res.status(400).json({ message: 'Cannot delete teacher because they are referenced in other records.' });
    } else {
      res.status(500).json({ message: 'Server error while deleting teacher' });
    }
  }
});
// Events Routes
app.get('/api/events', authenticateToken, async (req, res) => {
  try {
    const { role, schoolId } = req.user;
    const requestedSchoolId = req.query.schoolId ? parseInt(req.query.schoolId) : null;
    const pool = await poolPromise;
    let query = '';
    let request = pool.request();

    if (role === 'Admin') {
      if (requestedSchoolId) {
        query = 'SELECT * FROM Events WHERE SchoolId = @schoolId ORDER BY Date DESC';
        request.input('schoolId', sql.Int, requestedSchoolId);
      } else {
        query = 'SELECT * FROM Events ORDER BY Date DESC';
      }
    } else if (role === 'School' || role === 'Teacher' || role === 'Student') {
      query = 'SELECT * FROM Events WHERE SchoolId = @schoolId ORDER BY Date DESC';
      request.input('schoolId', sql.Int, schoolId);
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Error fetching events', error: error.message });
  }
});

app.post('/api/events', authenticateToken, async (req, res) => {
  const { title, date, description, schoolId } = req.body;
  try {
    const { role, schoolId: userSchoolId } = req.user;

    // Validate required fields
    if (!title || !date || !description || !schoolId) {
      return res.status(400).json({ message: 'Title, date, description, and schoolId are required' });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Validate schoolId
    const parsedSchoolId = parseInt(schoolId);
    if (isNaN(parsedSchoolId)) {
      return res.status(400).json({ message: 'Invalid schoolId' });
    }

    // Access control
    if (role !== 'Admin' && (role !== 'School' || userSchoolId !== parsedSchoolId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('title', sql.NVarChar, title)
      .input('date', sql.Date, date)
      .input('description', sql.NVarChar, description)
      .input('schoolId', sql.Int, parsedSchoolId)
      .query(`
        INSERT INTO Events (Title, Date, Description, SchoolId, CreatedAt)
        OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.Date, INSERTED.Description, INSERTED.SchoolId, INSERTED.CreatedAt
        VALUES (@title, @date, @description, @schoolId, GETDATE())
      `);
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error adding event:', error);
    res.status(500).json({ message: 'Error adding event', error: error.message });
  }
});

app.put('/api/events/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, date, description, schoolId } = req.body;
  try {
    const { role, schoolId: userSchoolId } = req.user;

    // Validate id
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    // Validate required fields
    if (!title || !date || !description || !schoolId) {
      return res.status(400).json({ message: 'Title, date, description, and schoolId are required' });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Validate schoolId
    const parsedSchoolId = parseInt(schoolId);
    if (isNaN(parsedSchoolId)) {
      return res.status(400).json({ message: 'Invalid schoolId' });
    }

    const pool = await poolPromise;

    // Check if event exists and enforce access control
    const eventResult = await pool.request()
      .input('id', sql.Int, parsedId)
      .query('SELECT SchoolId FROM Events WHERE Id = @id');
    const event = eventResult.recordset[0];
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (role !== 'Admin' && (role !== 'School' || event.SchoolId !== userSchoolId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await pool.request()
      .input('id', sql.Int, parsedId)
      .input('title', sql.NVarChar, title)
      .input('date', sql.Date, date)
      .input('description', sql.NVarChar, description)
      .input('schoolId', sql.Int, parsedSchoolId)
      .query(`
        UPDATE Events
        SET Title = @title, Date = @date, Description = @description, SchoolId = @schoolId
        WHERE Id = @id;
        SELECT Id, Title, Date, Description, SchoolId, CreatedAt
        FROM Events
        WHERE Id = @id;
      `);
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ message: 'Error updating event', error: error.message });
  }
});

app.delete('/api/events/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const { role, schoolId: userSchoolId } = req.user;

    // Validate id
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const pool = await poolPromise;

    // Check if event exists and enforce access control
    const eventResult = await pool.request()
      .input('id', sql.Int, parsedId)
      .query('SELECT SchoolId FROM Events WHERE Id = @id');
    const event = eventResult.recordset[0];
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (role !== 'Admin' && (role !== 'School' || event.SchoolId !== userSchoolId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.request()
      .input('id', sql.Int, parsedId)
      .query('DELETE FROM Events WHERE Id = @id');
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ message: 'Error deleting event', error: error.message });
  }
});
// Staff Routes
app.get('/api/staff', authenticateToken, async (req, res) => {
  try {
    const { role, schoolId } = req.user;
    const requestedSchoolId = req.query.schoolId ? parseInt(req.query.schoolId) : null;
    const pool = await poolPromise;
    let query = '';
    let request = pool.request();

    if (role === 'Admin') {
      if (requestedSchoolId) {
        query = `
          SELECT Id, Name, Email, Phone, SchoolId, CreatedAt
          FROM Staff
          WHERE SchoolId = @schoolId
          ORDER BY Name
        `;
        request.input('schoolId', sql.Int, requestedSchoolId);
      } else {
        query = `
          SELECT Id, Name, Email, Phone, SchoolId, CreatedAt
          FROM Staff
          ORDER BY Name
        `;
      }
    } else if (role === 'School') {
      query = `
        SELECT Id, Name, Email, Phone, SchoolId, CreatedAt
        FROM Staff
        WHERE SchoolId = @schoolId
        ORDER BY Name
      `;
      request.input('schoolId', sql.Int, schoolId);
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ message: 'Server error while fetching staff', error: error.message });
  }
});

app.post('/api/staff', authenticateToken, async (req, res) => {
  const { name, email, phone, schoolId } = req.body;
  try {
    const { role: userRole, schoolId: userSchoolId } = req.user;
    if (!name || !email || !schoolId) {
      return res.status(400).json({ message: 'Name, email, and schoolId are required' });
    }

    if (userRole !== 'Admin' && (userRole !== 'School' || userSchoolId !== parseInt(schoolId))) {
      return res.status(403).json({ message: 'Access denied: You can only add staff to your own school' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('phone', sql.NVarChar, phone || null)
      .input('schoolId', sql.Int, schoolId)
      .query(`
        INSERT INTO Staff (Name, Email, Phone, SchoolId)
        OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Email, INSERTED.Phone, INSERTED.SchoolId, INSERTED.CreatedAt
        VALUES (@name, @email, @phone, @schoolId)
      `);
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error adding staff:', error);
    res.status(500).json({ message: 'Error adding staff', error: error.message });
  }
});

app.put('/api/staff/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, schoolId } = req.body;
  try {
    const { role: userRole, schoolId: userSchoolId } = req.user;
    if (!name || !email || !schoolId) {
      return res.status(400).json({ message: 'Name, email, and schoolId are required' });
    }

    const pool = await poolPromise;

    // Check if the staff member exists and get their current SchoolId
    const staffResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT SchoolId FROM Staff WHERE Id = @id');
    const staff = staffResult.recordset[0];
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Access control: Schools can only edit staff in their own school
    if (userRole !== 'Admin' && (userRole !== 'School' || (staff.SchoolId !== userSchoolId || parseInt(schoolId) !== userSchoolId))) {
      return res.status(403).json({ message: 'Access denied: You can only edit staff in your own school' });
    }

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('phone', sql.NVarChar, phone || null)
      .input('schoolId', sql.Int, schoolId)
      .query(`
        UPDATE Staff
        SET Name = @name, Email = @email, Phone = @phone, SchoolId = @schoolId
        WHERE Id = @id;
        SELECT Id, Name, Email, Phone, SchoolId, CreatedAt
        FROM Staff
        WHERE Id = @id;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ message: 'Error updating staff', error: error.message });
  }
});

app.delete('/api/staff/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const { role, schoolId } = req.user;

    const pool = await poolPromise;
    const staffResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT SchoolId FROM Staff WHERE Id = @id');
    const staff = staffResult.recordset[0];
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    if (role !== 'Admin' && (role !== 'School' || staff.SchoolId !== schoolId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Staff WHERE Id = @id');
    res.json({ message: 'Staff deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ message: 'Error deleting staff', error: error.message });
  }
});

// Fees Routes
app.get('/api/fees/student/:studentId', authenticateToken, async (req, res) => {
  const { studentId } = req.params;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;
    const studentResult = await pool.request()
      .input('studentId', sql.Int, studentId)
      .query('SELECT ClassId FROM Students WHERE Id = @studentId');
    const student = studentResult.recordset[0];
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const classResult = await pool.request()
      .input('classId', sql.Int, student.ClassId)
      .query('SELECT SchoolId FROM Classes WHERE Id = @classId');
    const classData = classResult.recordset[0];
    if (role !== 'Admin' && classData.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await pool.request()
      .input('studentId', sql.Int, studentId)
      .query('SELECT * FROM Fees WHERE StudentId = @studentId');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching fees', error: error.message });
  }
});

app.post('/api/fees', authenticateToken, async (req, res) => {
  const { studentId, amount, submitted, fine, dueDate, status } = req.body;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;
    const studentResult = await pool.request()
      .input('studentId', sql.Int, studentId)
      .query('SELECT ClassId FROM Students WHERE Id = @studentId');
    const student = studentResult.recordset[0];
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const classResult = await pool.request()
      .input('classId', sql.Int, student.ClassId)
      .query('SELECT SchoolId FROM Classes WHERE Id = @classId');
    const classData = classResult.recordset[0];
    if (role !== 'Admin' && classData.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.request()
      .input('studentId', sql.Int, studentId)
      .input('amount', sql.Decimal(10, 2), amount)
      .input('submitted', sql.Decimal(10, 2), submitted || 0)
      .input('fine', sql.Decimal(10, 2), fine || 0)
      .input('dueDate', sql.Date, dueDate)
      .input('status', sql.NVarChar, status)
      .query('INSERT INTO Fees (StudentId, Amount, Submitted, Fine, DueDate, Status) VALUES (@studentId, @amount, @submitted, @fine, @dueDate, @status)');
    res.status(201).json({ message: 'Fee record added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding fee record', error: error.message });
  }
});

app.put('/api/fees/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { amountPaid } = req.body;

  if (!amountPaid || isNaN(amountPaid) || amountPaid < 0) {
    return res.status(400).json({ message: 'Invalid amount paid.' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('amountPaid', sql.Decimal(10, 2), amountPaid)
      .query(`
        UPDATE Fees
        SET AmountPaid = AmountPaid + @amountPaid
        WHERE Id = @id;

        SELECT Id, TotalFee, AmountPaid, Balance
        FROM Fees
        WHERE Id = @id;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Fee record not found.' });
    }

    res.json({
      message: 'Fee updated successfully',
      fee: result.recordset[0]
    });
  } catch (error) {
    console.error('Error updating fee:', error);
    res.status(500).json({ message: 'Error updating fee' });
  }
});

app.delete('/api/fees/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;
    const feeResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT StudentId FROM Fees WHERE Id = @id');
    const fee = feeResult.recordset[0];
    if (!fee) return res.status(404).json({ message: 'Fee record not found' });

    const studentResult = await pool.request()
      .input('studentId', sql.Int, fee.StudentId)
      .query('SELECT ClassId FROM Students WHERE Id = @studentId');
    const student = studentResult.recordset[0];
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const classResult = await pool.request()
      .input('classId', sql.Int, student.ClassId)
      .query('SELECT SchoolId FROM Classes WHERE Id = @classId');
    const classData = classResult.recordset[0];
    if (role !== 'Admin' && classData.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Fees WHERE Id = @id');
    res.json({ message: 'Fee record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting fee record', error: error.message });
  }
});

// Salaries Routes
app.get('/api/salaries', authenticateToken, async (req, res) => {
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;
    let query = '';
    if (role === 'Admin') {
      query = `
        SELECT s.*, t.Name AS TeacherName, st.Name AS StaffName
        FROM Salaries s
        LEFT JOIN Teachers t ON s.TeacherId = t.Id
        LEFT JOIN Staff st ON s.StaffId = st.Id
      `;
    } else if (role === 'School') {
      query = `
        SELECT s.*, t.Name AS TeacherName, st.Name AS StaffName
        FROM Salaries s
        LEFT JOIN Teachers t ON s.TeacherId = t.Id
        LEFT JOIN Staff st ON s.StaffId = st.Id
        WHERE (t.SchoolId = @schoolId OR st.SchoolId = @schoolId)
      `;
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query(query);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching salaries', error: error.message });
  }
});

app.post('/api/salaries', authenticateToken, async (req, res) => {
  const { teacherId, staffId, amount, month, year, status } = req.body;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    if (teacherId) {
      const teacherResult = await pool.request()
        .input('teacherId', sql.Int, teacherId)
        .query('SELECT SchoolId FROM Teachers WHERE Id = @teacherId');
      const teacher = teacherResult.recordset[0];
      if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
      if (role !== 'Admin' && teacher.SchoolId !== schoolId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (staffId) {
      const staffResult = await pool.request()
        .input('staffId', sql.Int, staffId)
        .query('SELECT SchoolId FROM Staff WHERE Id = @staffId');
      const staff = staffResult.recordset[0];
      if (!staff) return res.status(404).json({ message: 'Staff not found' });
      if (role !== 'Admin' && staff.SchoolId !== schoolId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else {
      return res.status(400).json({ message: 'Either teacherId or staffId must be provided' });
    }

    await pool.request()
      .input('teacherId', sql.Int, teacherId || null)
      .input('staffId', sql.Int, staffId || null)
      .input('amount', sql.Decimal(10, 2), amount)
      .input('month', sql.NVarChar, month)
      .input('year', sql.Int, year)
      .input('status', sql.NVarChar, status)
      .query('INSERT INTO Salaries (TeacherId, StaffId, Amount, Month, Year, Status) VALUES (@teacherId, @staffId, @amount, @month, @year, @status)');
    res.status(201).json({ message: 'Salary record added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding salary record', error: error.message });
  }
});

app.put('/api/salaries/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { teacherId, staffId, amount, month, year, status } = req.body;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    const salaryResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT TeacherId, StaffId FROM Salaries WHERE Id = @id');
    const salary = salaryResult.recordset[0];
    if (!salary) return res.status(404).json({ message: 'Salary record not found' });

    if (salary.TeacherId) {
      const teacherResult = await pool.request()
        .input('teacherId', sql.Int, salary.TeacherId)
        .query('SELECT SchoolId FROM Teachers WHERE Id = @teacherId');
      const teacher = teacherResult.recordset[0];
      if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
      if (role !== 'Admin' && teacher.SchoolId !== schoolId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (salary.StaffId) {
      const staffResult = await pool.request()
        .input('staffId', sql.Int, salary.StaffId)
        .query('SELECT SchoolId FROM Staff WHERE Id = @staffId');
      const staff = staffResult.recordset[0];
      if (!staff) return res.status(404).json({ message: 'Staff not found' });
      if (role !== 'Admin' && staff.SchoolId !== schoolId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    await pool.request()
      .input('id', sql.Int, id)
      .input('teacherId', sql.Int, teacherId || null)
      .input('staffId', sql.Int, staffId || null)
      .input('amount', sql.Decimal(10, 2), amount)
      .input('month', sql.NVarChar, month)
      .input('year', sql.Int, year)
      .input('status', sql.NVarChar, status)
      .query('UPDATE Salaries SET TeacherId = @teacherId, StaffId = @staffId, Amount = @amount, Month = @month, Year = @year, Status = @status WHERE Id = @id');
    res.json({ message: 'Salary record updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating salary record', error: error.message });
  }
});

app.delete('/api/salaries/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    const salaryResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT TeacherId, StaffId FROM Salaries WHERE Id = @id');
    const salary = salaryResult.recordset[0];
    if (!salary) return res.status(404).json({ message: 'Salary record not found' });

    if (salary.TeacherId) {
      const teacherResult = await pool.request()
        .input('teacherId', sql.Int, salary.TeacherId)
        .query('SELECT SchoolId FROM Teachers WHERE Id = @teacherId');
      const teacher = teacherResult.recordset[0];
      if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
      if (role !== 'Admin' && teacher.SchoolId !== schoolId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (salary.StaffId) {
      const staffResult = await pool.request()
        .input('staffId', sql.Int, salary.StaffId)
        .query('SELECT SchoolId FROM Staff WHERE Id = @staffId');
      const staff = staffResult.recordset[0];
      if (!staff) return res.status(404).json({ message: 'Staff not found' });
      if (role !== 'Admin' && staff.SchoolId !== schoolId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Salaries WHERE Id = @id');
    res.json({ message: 'Salary record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting salary record', error: error.message });
  }
});

// Attendance Routes
app.get('/api/attendance/student/:studentId', authenticateToken, async (req, res) => {
  const { studentId } = req.params;
  try {
    const { role, schoolId, userId } = req.user;
    const pool = await poolPromise;

    const studentResult = await pool.request()
      .input('studentId', sql.Int, studentId)
      .query('SELECT ClassId FROM Students WHERE Id = @studentId');
    const student = studentResult.recordset[0];
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const classResult = await pool.request()
      .input('classId', sql.Int, student.ClassId)
      .query('SELECT SchoolId FROM Classes WHERE Id = @classId');
    const classData = classResult.recordset[0];
    if (!classData) return res.status(404).json({ message: 'Class not found' });

    // Access control
    if (role === 'Student' && parseInt(userId) !== parseInt(studentId)) {
      return res.status(403).json({ message: 'Access denied: Students can only view their own attendance' });
    }
    if (role !== 'Admin' && role !== 'Teacher' && classData.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied: You can only view attendance in your own school' });
    }

    const result = await pool.request()
      .input('studentId', sql.Int, studentId)
      .query('SELECT Id, StudentId, Date, Status FROM Attendance WHERE StudentId = @studentId ORDER BY Date DESC');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching student attendance', error: error.message });
  }
});

app.get('/api/attendance/teacher/:teacherId', authenticateToken, async (req, res) => {
  const { teacherId } = req.params;
  try {
    const { role, schoolId, userId } = req.user;
    const pool = await poolPromise;

    const teacherResult = await pool.request()
      .input('teacherId', sql.Int, teacherId)
      .query('SELECT SchoolId FROM Teachers WHERE Id = @teacherId');
    const teacher = teacherResult.recordset[0];
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    // Access control
    if (role === 'Teacher' && parseInt(userId) !== parseInt(teacherId)) {
      return res.status(403).json({ message: 'Access denied: Teachers can only view their own attendance' });
    }
    if (role !== 'Admin' && role !== 'School' && teacher.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied: You can only view attendance in your own school' });
    }

    const result = await pool.request()
      .input('teacherId', sql.Int, teacherId)
      .query('SELECT Id, TeacherId, Date, Status FROM Attendance WHERE TeacherId = @teacherId ORDER BY Date DESC');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching teacher attendance', error: error.message });
  }
});

app.post('/api/attendance', authenticateToken, async (req, res) => {
  const { studentId, teacherId, date, status } = req.body;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    if (!date || !status) {
      return res.status(400).json({ message: 'Date and status are required' });
    }

    if (studentId) {
      const studentResult = await pool.request()
        .input('studentId', sql.Int, studentId)
        .query('SELECT ClassId FROM Students WHERE Id = @studentId');
      const student = studentResult.recordset[0];
      if (!student) return res.status(404).json({ message: 'Student not found' });

      const classResult = await pool.request()
        .input('classId', sql.Int, student.ClassId)
        .query('SELECT SchoolId FROM Classes WHERE Id = @classId');
      const classData = classResult.recordset[0];
      if (role !== 'Admin' && role !== 'Teacher' && classData.SchoolId !== schoolId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check for duplicate attendance record on the same date
      const duplicateCheck = await pool.request()
        .input('studentId', sql.Int, studentId)
        .input('date', sql.Date, date)
        .query('SELECT Id FROM Attendance WHERE StudentId = @studentId AND CAST(Date AS DATE) = @date');
      if (duplicateCheck.recordset.length > 0) {
        return res.status(400).json({ message: 'Attendance record already exists for this student on this date' });
      }

      await pool.request()
        .input('studentId', sql.Int, studentId)
        .input('date', sql.Date, date)
        .input('status', sql.NVarChar, status)
        .query('INSERT INTO Attendance (StudentId, Date, Status) VALUES (@studentId, @date, @status)');
    } else if (teacherId) {
      const teacherResult = await pool.request()
        .input('teacherId', sql.Int, teacherId)
        .query('SELECT SchoolId FROM Teachers WHERE Id = @teacherId');
      const teacher = teacherResult.recordset[0];
      if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
      if (role !== 'Admin' && role !== 'School' && teacher.SchoolId !== schoolId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check for duplicate attendance record on the same date
      const duplicateCheck = await pool.request()
        .input('teacherId', sql.Int, teacherId)
        .input('date', sql.Date, date)
        .query('SELECT Id FROM Attendance WHERE TeacherId = @teacherId AND CAST(Date AS DATE) = @date');
      if (duplicateCheck.recordset.length > 0) {
        return res.status(400).json({ message: 'Attendance record already exists for this teacher on this date' });
      }

      await pool.request()
        .input('teacherId', sql.Int, teacherId)
        .input('date', sql.Date, date)
        .input('status', sql.NVarChar, status)
        .query('INSERT INTO Attendance (TeacherId, Date, Status) VALUES (@teacherId, @date, @status)');
    } else {
      return res.status(400).json({ message: 'Either studentId or teacherId must be provided' });
    }

    res.status(201).json({ message: 'Attendance record added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding attendance record', error: error.message });
  }
});

app.put('/api/attendance/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { studentId, teacherId, date, status } = req.body;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    const attendanceResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT StudentId, TeacherId FROM Attendance WHERE Id = @id');
    const attendance = attendanceResult.recordset[0];
    if (!attendance) return res.status(404).json({ message: 'Attendance record not found' });

    if (attendance.StudentId) {
      const studentResult = await pool.request()
        .input('studentId', sql.Int, attendance.StudentId)
        .query('SELECT ClassId FROM Students WHERE Id = @studentId');
      const student = studentResult.recordset[0];
      if (!student) return res.status(404).json({ message: 'Student not found' });

      const classResult = await pool.request()
        .input('classId', sql.Int, student.ClassId)
        .query('SELECT SchoolId FROM Classes WHERE Id = @classId');
      const classData = classResult.recordset[0];
      if (role !== 'Admin' && role !== 'Teacher' && classData.SchoolId !== schoolId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check for duplicate attendance record on the same date (excluding current record)
      const duplicateCheck = await pool.request()
        .input('studentId', sql.Int, studentId || attendance.StudentId)
        .input('date', sql.Date, date)
        .input('id', sql.Int, id)
        .query('SELECT Id FROM Attendance WHERE StudentId = @studentId AND CAST(Date AS DATE) = @date AND Id != @id');
      if (duplicateCheck.recordset.length > 0) {
        return res.status(400).json({ message: 'Another attendance record already exists for this student on this date' });
      }

      await pool.request()
        .input('id', sql.Int, id)
        .input('studentId', sql.Int, studentId || attendance.StudentId)
        .input('date', sql.Date, date)
        .input('status', sql.NVarChar, status)
        .query('UPDATE Attendance SET StudentId = @studentId, Date = @date, Status = @status WHERE Id = @id');
    } else if (attendance.TeacherId) {
      const teacherResult = await pool.request()
        .input('teacherId', sql.Int, attendance.TeacherId)
        .query('SELECT SchoolId FROM Teachers WHERE Id = @teacherId');
      const teacher = teacherResult.recordset[0];
      if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
      if (role !== 'Admin' && role !== 'School' && teacher.SchoolId !== schoolId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check for duplicate attendance record on the same date (excluding current record)
      const duplicateCheck = await pool.request()
        .input('teacherId', sql.Int, teacherId || attendance.TeacherId)
        .input('date', sql.Date, date)
        .input('id', sql.Int, id)
        .query('SELECT Id FROM Attendance WHERE TeacherId = @teacherId AND CAST(Date AS DATE) = @date AND Id != @id');
      if (duplicateCheck.recordset.length > 0) {
        return res.status(400).json({ message: 'Another attendance record already exists for this teacher on this date' });
      }

      await pool.request()
        .input('id', sql.Int, id)
        .input('teacherId', sql.Int, teacherId || attendance.TeacherId)
        .input('date', sql.Date, date)
        .input('status', sql.NVarChar, status)
        .query('UPDATE Attendance SET TeacherId = @teacherId, Date = @date, Status = @status WHERE Id = @id');
    }

    res.json({ message: 'Attendance record updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating attendance record', error: error.message });
  }
});

app.delete('/api/attendance/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    const attendanceResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT StudentId, TeacherId FROM Attendance WHERE Id = @id');
    const attendance = attendanceResult.recordset[0];
    if (!attendance) return res.status(404).json({ message: 'Attendance record not found' });

    if (attendance.StudentId) {
      const studentResult = await pool.request()
        .input('studentId', sql.Int, attendance.StudentId)
        .query('SELECT ClassId FROM Students WHERE Id = @studentId');
      const student = studentResult.recordset[0];
      if (!student) return res.status(404).json({ message: 'Student not found' });

      const classResult = await pool.request()
        .input('classId', sql.Int, student.ClassId)
        .query('SELECT SchoolId FROM Classes WHERE Id = @classId');
      const classData = classResult.recordset[0];
      if (role !== 'Admin' && role !== 'Teacher' && classData.SchoolId !== schoolId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (attendance.TeacherId) {
      const teacherResult = await pool.request()
        .input('teacherId', sql.Int, attendance.TeacherId)
        .query('SELECT SchoolId FROM Teachers WHERE Id = @teacherId');
      const teacher = teacherResult.recordset[0];
      if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
      if (role !== 'Admin' && role !== 'School' && teacher.SchoolId !== schoolId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Attendance WHERE Id = @id');
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting attendance record', error: error.message });
  }
});

// Subjects Routes
app.get('/api/subjects', authenticateToken, async (req, res) => {
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;
    let query = '';
    if (role === 'Admin') {
      query = `
        SELECT s.*, c.Name AS ClassName, c.Section AS ClassSection
        FROM Subjects s
        JOIN Classes c ON s.ClassId = c.Id
      `;
    } else {
      query = `
        SELECT s.*, c.Name AS ClassName, c.Section AS ClassSection
        FROM Subjects s
        JOIN Classes c ON s.ClassId = c.Id
        WHERE c.SchoolId = @schoolId
      `;
    }

    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query(query);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching subjects', error: error.message });
  }
});

app.post('/api/subjects', authenticateToken, async (req, res) => {
  const { name, classId } = req.body;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    const classResult = await pool.request()
      .input('classId', sql.Int, classId)
      .query('SELECT SchoolId FROM Classes WHERE Id = @classId');
    const classData = classResult.recordset[0];
    if (!classData) return res.status(404).json({ message: 'Class not found' });
    if (role !== 'Admin' && classData.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('classId', sql.Int, classId)
      .query('INSERT INTO Subjects (Name, ClassId) VALUES (@name, @classId)');
    res.status(201).json({ message: 'Subject added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding subject', error: error.message });
  }
});

app.put('/api/subjects/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, classId } = req.body;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    const classResult = await pool.request()
      .input('classId', sql.Int, classId)
      .query('SELECT SchoolId FROM Classes WHERE Id = @classId');
    const classData = classResult.recordset[0];
    if (!classData) return res.status(404).json({ message: 'Class not found' });
    if (role !== 'Admin' && classData.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('classId', sql.Int, classId)
      .query('UPDATE Subjects SET Name = @name, ClassId = @classId WHERE Id = @id');
    res.json({ message: 'Subject updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating subject', error: error.message });
  }
});

app.delete('/api/subjects/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    const subjectResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT ClassId FROM Subjects WHERE Id = @id');
    const subject = subjectResult.recordset[0];
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const classResult = await pool.request()
      .input('classId', sql.Int, subject.ClassId)
      .query('SELECT SchoolId FROM Classes WHERE Id = @classId');
    const classData = classResult.recordset[0];
    if (role !== 'Admin' && classData.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Subjects WHERE Id = @id');
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting subject', error: error.message });
  }
});

// Timetables Routes
app.get('/api/timetables', authenticateToken, async (req, res) => {
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;
    let query = '';
    if (role === 'Admin') {
      query = `
        SELECT t.*, c.Name AS ClassName, c.Section AS ClassSection
        FROM Timetables t
        JOIN Classes c ON t.ClassId = c.Id
      `;
    } else {
      query = `
        SELECT t.*, c.Name AS ClassName, c.Section AS ClassSection
        FROM Timetables t
        JOIN Classes c ON t.ClassId = c.Id
        WHERE c.SchoolId = @schoolId
      `;
    }

    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query(query);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching timetables', error: error.message });
  }
});

app.post('/api/timetables', authenticateToken, async (req, res) => {
  const { classId, day, period, subject, teacherId } = req.body;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    const classResult = await pool.request()
      .input('classId', sql.Int, classId)
      .query('SELECT SchoolId FROM Classes WHERE Id = @classId');
    const classData = classResult.recordset[0];
    if (!classData) return res.status(404).json({ message: 'Class not found' });
    if (role !== 'Admin' && classData.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.request()
      .input('classId', sql.Int, classId)
      .input('day', sql.NVarChar, day)
      .input('period', sql.NVarChar, period)
      .input('subject', sql.NVarChar, subject)
      .input('teacherId', sql.Int, teacherId)
      .query('INSERT INTO Timetables (ClassId, Day, Period, Subject, TeacherId) VALUES (@classId, @day, @period, @subject, @teacherId)');
    res.status(201).json({ message: 'Timetable entry added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding timetable entry', error: error.message });
  }
});

app.put('/api/timetables/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { classId, day, period, subject, teacherId } = req.body;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    const classResult = await pool.request()
      .input('classId', sql.Int, classId)
      .query('SELECT SchoolId FROM Classes WHERE Id = @classId');
    const classData = classResult.recordset[0];
    if (!classData) return res.status(404).json({ message: 'Class not found' });
    if (role !== 'Admin' && classData.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.request()
      .input('id', sql.Int, id)
      .input('classId', sql.Int, classId)
      .input('day', sql.NVarChar, day)
      .input('period', sql.NVarChar, period)
      .input('subject', sql.NVarChar, subject)
      .input('teacherId', sql.Int, teacherId)
      .query('UPDATE Timetables SET ClassId = @classId, Day = @day, Period = @period, Subject = @subject, TeacherId = @teacherId WHERE Id = @id');
    res.json({ message: 'Timetable entry updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating timetable entry', error: error.message });
  }
});

app.delete('/api/timetables/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    const timetableResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT ClassId FROM Timetables WHERE Id = @id');
    const timetable = timetableResult.recordset[0];
    if (!timetable) return res.status(404).json({ message: 'Timetable entry not found' });

    const classResult = await pool.request()
      .input('classId', sql.Int, timetable.ClassId)
      .query('SELECT SchoolId FROM Classes WHERE Id = @classId');
    const classData = classResult.recordset[0];
    if (role !== 'Admin' && classData.SchoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Timetables WHERE Id = @id');
    res.json({ message: 'Timetable entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting timetable entry', error: error.message });
  }
});
// Notices Routes
app.get('/api/notices', authenticateToken, async (req, res) => {
  try {
    const { role, schoolId } = req.user;
    const requestedSchoolId = req.query.schoolId ? parseInt(req.query.schoolId) : null;
    const pool = await poolPromise;
    let query = '';
    let request = pool.request();

    if (role === 'Admin') {
      if (requestedSchoolId) {
        query = 'SELECT * FROM Notices WHERE SchoolId = @schoolId ORDER BY CreatedAt DESC';
        request.input('schoolId', sql.Int, requestedSchoolId);
      } else {
        query = 'SELECT * FROM Notices ORDER BY CreatedAt DESC';
      }
    } else if (role === 'School' || role === 'Teacher' || role === 'Student') {
      query = 'SELECT * FROM Notices WHERE SchoolId = @schoolId ORDER BY CreatedAt DESC';
      request.input('schoolId', sql.Int, schoolId);
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching notices:', error);
    res.status(500).json({ message: 'Error fetching notices', error: error.message });
  }
});

app.post('/api/notices', authenticateToken, async (req, res) => {
  const { title, description, date, schoolId } = req.body;
  try {
    const { role, schoolId: userSchoolId } = req.user;
    if (role !== 'Admin' && (role !== 'School' || userSchoolId !== schoolId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!title || !description || !date || !schoolId) {
      return res.status(400).json({ message: 'Title, description, date, and schoolId are required' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('title', sql.NVarChar, title)
      .input('description', sql.NVarChar, description)
      .input('date', sql.Date, date)
      .input('schoolId', sql.Int, schoolId)
      .query(`
        INSERT INTO Notices (Title, Description, Date, SchoolId, CreatedAt)
        OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.Description, INSERTED.Date, INSERTED.SchoolId, INSERTED.CreatedAt
        VALUES (@title, @description, @date, @schoolId, GETDATE())
      `);
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error adding notice:', error);
    res.status(500).json({ message: 'Error adding notice', error: error.message });
  }
});

app.put('/api/notices/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, description, date, schoolId } = req.body;
  try {
    const { role, schoolId: userSchoolId } = req.user;
    const pool = await poolPromise;

    const noticeResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT SchoolId FROM Notices WHERE Id = @id');
    const notice = noticeResult.recordset[0];
    if (!notice) return res.status(404).json({ message: 'Notice not found' });
    if (role !== 'Admin' && (role !== 'School' || notice.SchoolId !== userSchoolId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!title || !description || !date || !schoolId) {
      return res.status(400).json({ message: 'Title, description, date, and schoolId are required' });
    }

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('title', sql.NVarChar, title)
      .input('description', sql.NVarChar, description)
      .input('date', sql.Date, date)
      .input('schoolId', sql.Int, schoolId)
      .query(`
        UPDATE Notices
        SET Title = @title, Description = @description, Date = @date, SchoolId = @schoolId
        WHERE Id = @id;
        SELECT Id, Title, Description, Date, SchoolId, CreatedAt
        FROM Notices
        WHERE Id = @id;
      `);
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Notice not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error updating notice:', error);
    res.status(500).json({ message: 'Error updating notice', error: error.message });
  }
});

app.delete('/api/notices/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const { role, schoolId } = req.user;
    const pool = await poolPromise;

    const noticeResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT SchoolId FROM Notices WHERE Id = @id');
    const notice = noticeResult.recordset[0];
    if (!notice) return res.status(404).json({ message: 'Notice not found' });
    if (role !== 'Admin' && (role !== 'School' || notice.SchoolId !== schoolId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Notices WHERE Id = @id');
    res.json({ message: 'Notice deleted successfully' });
  } catch (error) {
    console.error('Error deleting notice:', error);
    res.status(500).json({ message: 'Error deleting notice', error: error.message });
  }
});

// Holidays Routes
app.get('/api/holidays', authenticateToken, async (req, res) => {
  try {
    const { role, schoolId } = req.user;
    const requestedSchoolId = req.query.schoolId ? parseInt(req.query.schoolId) : null;
    const pool = await poolPromise;
    let query = '';
    let request = pool.request();

    if (role === 'Admin') {
      if (requestedSchoolId) {
        query = 'SELECT * FROM Holidays WHERE SchoolId = @schoolId ORDER BY StartDate';
        request.input('schoolId', sql.Int, requestedSchoolId);
      } else {
        query = 'SELECT * FROM Holidays ORDER BY StartDate';
      }
    } else if (role === 'School' || role === 'Teacher' || role === 'Student') {
      query = 'SELECT * FROM Holidays WHERE SchoolId = @schoolId ORDER BY StartDate';
      request.input('schoolId', sql.Int, schoolId);
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ message: 'Error fetching holidays', error: error.message });
  }
});

app.post('/api/holidays', authenticateToken, async (req, res) => {
  const { name, startDate, endDate, description, schoolId } = req.body;
  try {
    const { role, schoolId: userSchoolId } = req.user;

    // Validate required fields
    if (!name || !startDate || !endDate || !description || !schoolId) {
      return res.status(400).json({ message: 'Name, start date, end date, description, and schoolId are required' });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Validate that endDate is not before startDate
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return res.status(400).json({ message: 'End date cannot be before start date' });
    }

    // Validate schoolId
    const parsedSchoolId = parseInt(schoolId);
    if (isNaN(parsedSchoolId)) {
      return res.status(400).json({ message: 'Invalid schoolId' });
    }

    // Access control
    if (role !== 'Admin' && (role !== 'School' || userSchoolId !== parsedSchoolId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('startDate', sql.Date, startDate)
      .input('endDate', sql.Date, endDate)
      .input('description', sql.NVarChar, description)
      .input('schoolId', sql.Int, parsedSchoolId)
      .query(`
        INSERT INTO Holidays (Name, StartDate, EndDate, Description, SchoolId, CreatedAt)
        OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.StartDate, INSERTED.EndDate, INSERTED.Description, INSERTED.SchoolId, INSERTED.CreatedAt
        VALUES (@name, @startDate, @endDate, @description, @schoolId, GETDATE())
      `);
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error adding holiday:', error);
    res.status(500).json({ message: 'Error adding holiday', error: error.message });
  }
});

app.put('/api/holidays/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, startDate, endDate, description, schoolId } = req.body;
  try {
    const { role, schoolId: userSchoolId } = req.user;

    // Validate id
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return res.status(400).json({ message: 'Invalid holiday ID' });
    }

    // Validate required fields
    if (!name || !startDate || !endDate || !description || !schoolId) {
      return res.status(400).json({ message: 'Name, start date, end date, description, and schoolId are required' });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Validate that endDate is not before startDate
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return res.status(400).json({ message: 'End date cannot be before start date' });
    }

    // Validate schoolId
    const parsedSchoolId = parseInt(schoolId);
    if (isNaN(parsedSchoolId)) {
      return res.status(400).json({ message: 'Invalid schoolId' });
    }

    const pool = await poolPromise;

    // Check if holiday exists and enforce access control
    const holidayResult = await pool.request()
      .input('id', sql.Int, parsedId)
      .query('SELECT SchoolId FROM Holidays WHERE Id = @id');
    const holiday = holidayResult.recordset[0];
    if (!holiday) return res.status(404).json({ message: 'Holiday not found' });

    if (role !== 'Admin' && (role !== 'School' || holiday.SchoolId !== userSchoolId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await pool.request()
      .input('id', sql.Int, parsedId)
      .input('name', sql.NVarChar, name)
      .input('startDate', sql.Date, startDate)
      .input('endDate', sql.Date, endDate)
      .input('description', sql.NVarChar, description)
      .input('schoolId', sql.Int, parsedSchoolId)
      .query(`
        UPDATE Holidays
        SET Name = @name, StartDate = @startDate, EndDate = @endDate, Description = @description, SchoolId = @schoolId
        WHERE Id = @id;
        SELECT Id, Name, StartDate, EndDate, Description, SchoolId, CreatedAt
        FROM Holidays
        WHERE Id = @id;
      `);
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Holiday not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error updating holiday:', error);
    res.status(500).json({ message: 'Error updating holiday', error: error.message });
  }
});

app.delete('/api/holidays/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const { role, schoolId: userSchoolId } = req.user;

    // Validate id
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return res.status(400).json({ message: 'Invalid holiday ID' });
    }

    const pool = await poolPromise;

    // Check if holiday exists and enforce access control
    const holidayResult = await pool.request()
      .input('id', sql.Int, parsedId)
      .query('SELECT SchoolId FROM Holidays WHERE Id = @id');
    const holiday = holidayResult.recordset[0];
    if (!holiday) return res.status(404).json({ message: 'Holiday not found' });

    if (role !== 'Admin' && (role !== 'School' || holiday.SchoolId !== userSchoolId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.request()
      .input('id', sql.Int, parsedId)
      .query('DELETE FROM Holidays WHERE Id = @id');
    res.json({ message: 'Holiday deleted successfully' });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(500).json({ message: 'Error deleting holiday', error: error.message });
  }
});
app.get('/api/accounts/school/:schoolId/fees', authenticateToken, async (req, res) => {
  const { schoolId } = req.params;
  const { role, schoolId: userSchoolId } = req.user;

  // Validate schoolId
  if (isNaN(schoolId)) {
    return res.status(400).json({ message: 'Invalid school ID.' });
  }

  if (role !== 'Admin' && (role !== 'School' || userSchoolId !== parseInt(schoolId))) {
    return res.status(403).json({ message: 'Access denied.' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query(`
        SELECT f.Id, s.Id AS StudentId, s.Name AS StudentName, f.Amount, f.Submitted, f.Balance, f.Fine, f.DueDate, f.Status, f.CreatedAt
        FROM Fees f
        JOIN Students s ON f.StudentId = s.Id
        JOIN Classes c ON s.ClassId = c.Id
        WHERE c.SchoolId = @schoolId
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching fees:', error);
    res.status(500).json({ message: 'Server error while fetching fees.' });
  }
});
// Validate numeric fields to ensure they are non-negative and within reasonable bounds
const validateNumericField = (value, fieldName, maxValue = 1000000) => {
  if (value === undefined || value === null) return 0;
  const num = parseFloat(value);
  if (isNaN(num)) throw new Error(`${fieldName} must be a numeric value.`);
  if (num < 0) throw new Error(`${fieldName} cannot be negative.`);
  if (num > maxValue) throw new Error(`${fieldName} exceeds maximum allowed value (${maxValue}).`);
  return num;
};

// Validate status for salaries
const validateSalaryStatus = (status) => {
  const allowedStatuses = ['Not Credited', 'Credited'];
  if (!status) return 'Not Credited';
  if (!allowedStatuses.includes(status)) {
    throw new Error(`Status must be one of: ${allowedStatuses.join(', ')}.`);
  }
  return status;
};

// Validate status for fees
const validateFeeStatus = (status) => {
  const allowedStatuses = ['Pending', 'Paid', 'Overdue'];
  if (!status) return 'Pending';
  if (!allowedStatuses.includes(status)) {
    throw new Error(`Status must be one of: ${allowedStatuses.join(', ')}.`);
  }
  return status;
};

// GET /api/accounts/school/:schoolId/teacher-salaries
app.get('/api/accounts/school/:schoolId/teacher-salaries', authenticateToken, async (req, res) => {
  const { schoolId } = req.params;
  const { role, schoolId: userSchoolId } = req.user;

  // Validate schoolId
  const parsedSchoolId = parseInt(schoolId);
  if (isNaN(parsedSchoolId)) {
    return res.status(400).json({ message: 'Invalid school ID.' });
  }

  if (role !== 'Admin' && (role !== 'School' || userSchoolId !== parsedSchoolId)) {
    return res.status(403).json({ message: 'Access denied.' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('schoolId', sql.Int, parsedSchoolId)
      .query(`
        SELECT t.Id, t.Name, s.Id AS SalaryId, s.Amount, s.Month, s.Status, s.Tax, s.PF, s.Bonus,
               (s.Amount - s.Tax - s.PF + s.Bonus) AS NetSalary, s.CreatedAt
        FROM Teachers t
        JOIN Salaries s ON t.Id = s.TeacherId
        WHERE t.SchoolId = @schoolId
          AND s.TeacherId IS NOT NULL
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching teacher salaries:', error);
    res.status(500).json({ message: 'Server error while fetching teacher salaries.' });
  }
});

// GET /api/accounts/school/:schoolId/staff-salaries
app.get('/api/accounts/school/:schoolId/staff-salaries', authenticateToken, async (req, res) => {
  const { schoolId } = req.params;
  const { role, schoolId: userSchoolId } = req.user;

  // Validate schoolId
  const parsedSchoolId = parseInt(schoolId);
  if (isNaN(parsedSchoolId)) {
    return res.status(400).json({ message: 'Invalid school ID.' });
  }

  if (role !== 'Admin' && (role !== 'School' || userSchoolId !== parsedSchoolId)) {
    return res.status(403).json({ message: 'Access denied.' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('schoolId', sql.Int, parsedSchoolId)
      .query(`
        SELECT st.Id, st.Name, s.Id AS SalaryId, s.Amount, s.Month, s.Status, s.Tax, s.PF, s.Bonus,
               (s.Amount - s.Tax - s.PF + s.Bonus) AS NetSalary, s.CreatedAt
        FROM Staff st
        JOIN Salaries s ON st.Id = s.StaffId
        WHERE st.SchoolId = @schoolId
          AND s.StaffId IS NOT NULL
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching staff salaries:', error);
    res.status(500).json({ message: 'Server error while fetching staff salaries.' });
  }
});

// POST /api/accounts/fees
app.post('/api/accounts/fees', authenticateToken, async (req, res) => {
  const { role, schoolId: userSchoolId } = req.user;
  const { studentId, amount, submitted, fine, dueDate, status } = req.body;

  if (role !== 'Admin' && role !== 'School') {
    return res.status(403).json({ message: 'Access denied.' });
  }

  // Validate required fields
  if (!studentId || amount === undefined || !dueDate) {
    return res.status(400).json({ message: 'Student ID, amount, and due date are required.' });
  }

  // Validate studentId
  const parsedStudentId = parseInt(studentId);
  if (isNaN(parsedStudentId)) {
    return res.status(400).json({ message: 'Invalid student ID.' });
  }

  // Validate dueDate format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dueDate)) {
    return res.status(400).json({ message: 'Invalid due date format. Use YYYY-MM-DD.' });
  }

  try {
    const validatedAmount = validateNumericField(amount, 'Amount');
    const validatedSubmitted = validateNumericField(submitted, 'Submitted');
    const validatedFine = validateNumericField(fine, 'Fine');
    const validatedStatus = validateFeeStatus(status);

    // Validate that submitted amount does not exceed the total amount
    if (validatedSubmitted > validatedAmount) {
      throw new Error('Submitted amount cannot exceed the total amount.');
    }

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const studentCheckRequest = new sql.Request(transaction);
      studentCheckRequest.input('studentId', sql.Int, parsedStudentId);
      if (role === 'School') {
        studentCheckRequest.input('schoolId', sql.Int, userSchoolId);
      }

      const studentQuery = `
        SELECT s.Id
        FROM Students s
        JOIN Classes c ON s.ClassId = c.Id
        WHERE s.Id = @studentId
        ${role === 'School' ? 'AND c.SchoolId = @schoolId' : ''}
      `;
      const studentCheck = await studentCheckRequest.query(studentQuery);

      if (studentCheck.recordset.length === 0) {
        throw new Error('Student not found or not in your school.');
      }

      const insertRequest = new sql.Request(transaction);
      insertRequest.input('studentId', sql.Int, parsedStudentId);
      insertRequest.input('amount', sql.Decimal(10, 2), validatedAmount);
      insertRequest.input('submitted', sql.Decimal(10, 2), validatedSubmitted);
      insertRequest.input('fine', sql.Decimal(10, 2), validatedFine);
      insertRequest.input('dueDate', sql.Date, dueDate);
      insertRequest.input('status', sql.NVarChar, validatedStatus);

      const result = await insertRequest.query(`
        INSERT INTO Fees (StudentId, Amount, Submitted, Fine, DueDate, Status, CreatedAt)
        OUTPUT INSERTED.Id, INSERTED.StudentId, INSERTED.Amount, INSERTED.Submitted, INSERTED.Balance, INSERTED.Fine, INSERTED.DueDate, INSERTED.Status, INSERTED.CreatedAt
        VALUES (@studentId, @amount, @submitted, @fine, @dueDate, @status, GETDATE())
      `);

      await transaction.commit();
      res.status(201).json(result.recordset[0]);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error adding fee:', error);
    res.status(500).json({ message: error.message || 'Server error while adding fee.' });
  }
});

// PUT /api/accounts/fees/:id
app.put('/api/accounts/fees/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { role, schoolId: userSchoolId } = req.user;
  const { amount, submitted, fine, dueDate, status } = req.body;

  if (role !== 'Admin' && role !== 'School') {
    return res.status(403).json({ message: 'Access denied.' });
  }

  // Validate id
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) {
    return res.status(400).json({ message: 'Invalid fee ID.' });
  }

  // Validate required fields
  if (amount === undefined || !dueDate) {
    return res.status(400).json({ message: 'Amount and due date are required.' });
  }

  // Validate dueDate format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dueDate)) {
    return res.status(400).json({ message: 'Invalid due date format. Use YYYY-MM-DD.' });
  }

  try {
    const validatedAmount = validateNumericField(amount, 'Amount');
    const validatedSubmitted = validateNumericField(submitted, 'Submitted');
    const validatedFine = validateNumericField(fine, 'Fine');
    const validatedStatus = validateFeeStatus(status);

    // Validate that submitted amount does not exceed the total amount
    if (validatedSubmitted > validatedAmount) {
      throw new Error('Submitted amount cannot exceed the total amount.');
    }

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const feeCheckRequest = new sql.Request(transaction);
      feeCheckRequest.input('id', sql.Int, parsedId);
      if (role === 'School') {
        feeCheckRequest.input('schoolId', sql.Int, userSchoolId);
      }

      const feeQuery = `
        SELECT f.Id
        FROM Fees f
        JOIN Students s ON f.StudentId = s.Id
        JOIN Classes c ON s.ClassId = c.Id
        WHERE f.Id = @id
        ${role === 'School' ? 'AND c.SchoolId = @schoolId' : ''}
      `;
      const feeCheck = await feeCheckRequest.query(feeQuery);

      if (feeCheck.recordset.length === 0) {
        throw new Error('Fee not found or not in your school.');
      }

      const updateRequest = new sql.Request(transaction);
      updateRequest.input('id', sql.Int, parsedId);
      updateRequest.input('amount', sql.Decimal(10, 2), validatedAmount);
      updateRequest.input('submitted', sql.Decimal(10, 2), validatedSubmitted);
      updateRequest.input('fine', sql.Decimal(10, 2), validatedFine);
      updateRequest.input('dueDate', sql.Date, dueDate);
      updateRequest.input('status', sql.NVarChar, validatedStatus);

      const result = await updateRequest.query(`
        UPDATE Fees
        SET Amount = @amount, Submitted = @submitted, Fine = @fine, DueDate = @dueDate, Status = @status
        OUTPUT INSERTED.Id, INSERTED.StudentId, INSERTED.Amount, INSERTED.Submitted, INSERTED.Balance, INSERTED.Fine, INSERTED.DueDate, INSERTED.Status, INSERTED.CreatedAt
        WHERE Id = @id
      `);

      await transaction.commit();
      res.json(result.recordset[0]);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error updating fee:', error);
    res.status(500).json({ message: error.message || 'Server error while updating fee.' });
  }
});

// DELETE /api/accounts/fees/:id
app.delete('/api/accounts/fees/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { role, schoolId: userSchoolId } = req.user;

  if (role !== 'Admin' && role !== 'School') {
    return res.status(403).json({ message: 'Access denied.' });
  }

  // Validate id
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) {
    return res.status(400).json({ message: 'Invalid fee ID.' });
  }

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const feeCheckRequest = new sql.Request(transaction);
      feeCheckRequest.input('id', sql.Int, parsedId);
      if (role === 'School') {
        feeCheckRequest.input('schoolId', sql.Int, userSchoolId);
      }

      const feeQuery = `
        SELECT f.Id
        FROM Fees f
        JOIN Students s ON f.StudentId = s.Id
        JOIN Classes c ON s.ClassId = c.Id
        WHERE f.Id = @id
        ${role === 'School' ? 'AND c.SchoolId = @schoolId' : ''}
      `;
      const feeCheck = await feeCheckRequest.query(feeQuery);

      if (feeCheck.recordset.length === 0) {
        throw new Error('Fee not found or not in your school.');
      }

      const deleteRequest = new sql.Request(transaction);
      deleteRequest.input('id', sql.Int, parsedId);
      await deleteRequest.query('DELETE FROM Fees WHERE Id = @id');

      await transaction.commit();
      res.status(204).send();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error deleting fee:', error);
    res.status(500).json({ message: error.message || 'Server error while deleting fee.' });
  }
});

// POST /api/accounts/salaries
app.post('/api/accounts/salaries', authenticateToken, async (req, res) => {
  const { role, schoolId: userSchoolId } = req.user;
  const { teacherId, staffId, amount, month, status, tax, pf, bonus } = req.body;

  if (role !== 'Admin' && role !== 'School') {
    return res.status(403).json({ message: 'Access denied.' });
  }

  // Validate required fields
  if ((!teacherId && !staffId) || amount === undefined || !month) {
    return res.status(400).json({ message: 'Teacher ID or Staff ID, amount, and month are required.' });
  }

  if (teacherId && staffId) {
    return res.status(400).json({ message: 'Provide either Teacher ID or Staff ID, not both.' });
  }

  // Validate teacherId or staffId
  const parsedTeacherId = teacherId ? parseInt(teacherId) : null;
  const parsedStaffId = staffId ? parseInt(staffId) : null;
  if (parsedTeacherId && isNaN(parsedTeacherId)) {
    return res.status(400).json({ message: 'Invalid teacher ID.' });
  }
  if (parsedStaffId && isNaN(parsedStaffId)) {
    return res.status(400).json({ message: 'Invalid staff ID.' });
  }

  // Validate month format (YYYY-MM-DD, as per your table data)
  const monthRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!monthRegex.test(month)) {
    return res.status(400).json({ message: 'Invalid month format. Use YYYY-MM-DD.' });
  }

  try {
    const validatedAmount = validateNumericField(amount, 'Amount');
    const validatedTax = validateNumericField(tax, 'Tax');
    const validatedPf = validateNumericField(pf, 'PF');
    const validatedBonus = validateNumericField(bonus, 'Bonus');
    const validatedStatus = validateSalaryStatus(status);

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const employeeCheckRequest = new sql.Request(transaction);
      if (parsedTeacherId) {
        employeeCheckRequest.input('teacherId', sql.Int, parsedTeacherId);
      } else {
        employeeCheckRequest.input('staffId', sql.Int, parsedStaffId);
      }
      if (role === 'School') {
        employeeCheckRequest.input('schoolId', sql.Int, userSchoolId);
      }

      const employeeQuery = parsedTeacherId
        ? `
          SELECT Id
          FROM Teachers
          WHERE Id = @teacherId
          ${role === 'School' ? 'AND SchoolId = @schoolId' : ''}
        `
        : `
          SELECT Id
          FROM Staff
          WHERE Id = @staffId
          ${role === 'School' ? 'AND SchoolId = @schoolId' : ''}
        `;
      const employeeCheck = await employeeCheckRequest.query(employeeQuery);

      if (employeeCheck.recordset.length === 0) {
        throw new Error('Teacher or Staff not found or not in your school.');
      }

      const insertRequest = new sql.Request(transaction);
      insertRequest.input('teacherId', sql.Int, parsedTeacherId || null);
      insertRequest.input('staffId', sql.Int, parsedStaffId || null);
      insertRequest.input('amount', sql.Decimal(10, 2), validatedAmount);
      insertRequest.input('month', sql.Date, month);
      insertRequest.input('status', sql.NVarChar, validatedStatus);
      insertRequest.input('tax', sql.Decimal(10, 2), validatedTax);
      insertRequest.input('pf', sql.Decimal(10, 2), validatedPf);
      insertRequest.input('bonus', sql.Decimal(10, 2), validatedBonus);

      const result = await insertRequest.query(`
        INSERT INTO Salaries (TeacherId, StaffId, Amount, Month, Status, Tax, PF, Bonus, CreatedAt)
        OUTPUT INSERTED.Id, INSERTED.TeacherId, INSERTED.StaffId, INSERTED.Amount, INSERTED.Month, INSERTED.Status, INSERTED.Tax, INSERTED.PF, INSERTED.Bonus, INSERTED.CreatedAt
        VALUES (@teacherId, @staffId, @amount, @month, @status, @tax, @pf, @bonus, GETDATE())
      `);

      await transaction.commit();
      res.status(201).json(result.recordset[0]);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error adding salary:', error);
    res.status(500).json({ message: error.message || 'Server error while adding salary.' });
  }
});

// PUT /api/accounts/salaries/:id
app.put('/api/accounts/salaries/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { role, schoolId: userSchoolId } = req.user;
  const { amount, month, status, tax, pf, bonus } = req.body;

  if (role !== 'Admin' && role !== 'School') {
    return res.status(403).json({ message: 'Access denied.' });
  }

  // Validate id
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) {
    return res.status(400).json({ message: 'Invalid salary ID.' });
  }

  // Validate required fields
  if (amount === undefined || !month) {
    return res.status(400).json({ message: 'Amount and month are required.' });
  }

  // Validate month format (YYYY-MM-DD)
  const monthRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!monthRegex.test(month)) {
    return res.status(400).json({ message: 'Invalid month format. Use YYYY-MM-DD.' });
  }

  try {
    const validatedAmount = validateNumericField(amount, 'Amount');
    const validatedTax = validateNumericField(tax, 'Tax');
    const validatedPf = validateNumericField(pf, 'PF');
    const validatedBonus = validateNumericField(bonus, 'Bonus');
    const validatedStatus = validateSalaryStatus(status);

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const salaryCheckRequest = new sql.Request(transaction);
      salaryCheckRequest.input('id', sql.Int, parsedId);
      if (role === 'School') {
        salaryCheckRequest.input('schoolId', sql.Int, userSchoolId);
      }

      const salaryQuery = `
        SELECT s.Id
        FROM Salaries s
        LEFT JOIN Teachers t ON s.TeacherId = t.Id
        LEFT JOIN Staff st ON s.StaffId = st.Id
        WHERE s.Id = @id
        ${role === 'School' ? 'AND (t.SchoolId = @schoolId OR st.SchoolId = @schoolId)' : ''}
      `;
      const salaryCheck = await salaryCheckRequest.query(salaryQuery);

      if (salaryCheck.recordset.length === 0) {
        throw new Error('Salary not found or not in your school.');
      }

      const updateRequest = new sql.Request(transaction);
      updateRequest.input('id', sql.Int, parsedId);
      updateRequest.input('amount', sql.Decimal(10, 2), validatedAmount);
      updateRequest.input('month', sql.Date, month);
      updateRequest.input('status', sql.NVarChar, validatedStatus);
      updateRequest.input('tax', sql.Decimal(10, 2), validatedTax);
      updateRequest.input('pf', sql.Decimal(10, 2), validatedPf);
      updateRequest.input('bonus', sql.Decimal(10, 2), validatedBonus);

      const result = await updateRequest.query(`
        UPDATE Salaries
        SET Amount = @amount, Month = @month, Status = @status, Tax = @tax, PF = @pf, Bonus = @bonus
        OUTPUT INSERTED.Id, INSERTED.TeacherId, INSERTED.StaffId, INSERTED.Amount, INSERTED.Month, INSERTED.Status, INSERTED.Tax, INSERTED.PF, INSERTED.Bonus, INSERTED.CreatedAt
        WHERE Id = @id
      `);

      await transaction.commit();
      res.json(result.recordset[0]);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error updating salary:', error);
    res.status(500).json({ message: error.message || 'Server error while updating salary.' });
  }
});

// DELETE /api/accounts/salaries/:id
app.delete('/api/accounts/salaries/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { role, schoolId: userSchoolId } = req.user;

  if (role !== 'Admin' && role !== 'School') {
    return res.status(403).json({ message: 'Access denied.' });
  }

  // Validate id
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) {
    return res.status(400).json({ message: 'Invalid salary ID.' });
  }

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const salaryCheckRequest = new sql.Request(transaction);
      salaryCheckRequest.input('id', sql.Int, parsedId);
      if (role === 'School') {
        salaryCheckRequest.input('schoolId', sql.Int, userSchoolId);
      }

      const salaryQuery = `
        SELECT s.Id
        FROM Salaries s
        LEFT JOIN Teachers t ON s.TeacherId = t.Id
        LEFT JOIN Staff st ON s.StaffId = st.Id
        WHERE s.Id = @id
        ${role === 'School' ? 'AND (t.SchoolId = @schoolId OR st.SchoolId = @schoolId)' : ''}
      `;
      const salaryCheck = await salaryCheckRequest.query(salaryQuery);

      if (salaryCheck.recordset.length === 0) {
        throw new Error('Salary not found or not in your school.');
      }

      const deleteRequest = new sql.Request(transaction);
      deleteRequest.input('id', sql.Int, parsedId);
      await deleteRequest.query('DELETE FROM Salaries WHERE Id = @id');

      await transaction.commit();
      res.status(204).send();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error deleting salary:', error);
    res.status(500).json({ message: error.message || 'Server error while deleting salary.' });
  }
});

app.get('/api/students', authenticateToken, async (req, res) => {
  const { schoolId } = req.query;
  const { role, schoolId: userSchoolId } = req.user;

  // Validate schoolId
  if (!schoolId || isNaN(schoolId)) {
    return res.status(400).json({ message: 'Invalid school ID.' });
  }

  // Access control: Admins can access all, Schools can only access their own
  if (role !== 'Admin' && (role !== 'School' || userSchoolId !== parseInt(schoolId))) {
    return res.status(403).json({ message: 'Access denied.' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query(`
        SELECT s.Id, s.Name
        FROM Students s
        JOIN Classes c ON s.ClassId = c.Id
        WHERE c.SchoolId = @schoolId
        ORDER BY s.Name
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Server error while fetching students.' });
  }
});

app.get('/api/teachers', authenticateToken, async (req, res) => {
  const { schoolId } = req.query;
  const { role, schoolId: userSchoolId } = req.user;

  if (role !== 'Admin' && (role !== 'School' || userSchoolId !== parseInt(schoolId))) {
    return res.status(403).json({ message: 'Access denied.' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query('SELECT Id, Name FROM Teachers WHERE SchoolId = @schoolId');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ message: 'Server error while fetching teachers.' });
  }
});

app.get('/api/staff', authenticateToken, async (req, res) => {
  const { schoolId } = req.query;
  const { role, schoolId: userSchoolId } = req.user;

  if (role !== 'Admin' && (role !== 'School' || userSchoolId !== parseInt(schoolId))) {
    return res.status(403).json({ message: 'Access denied.' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query('SELECT Id, Name FROM Staff WHERE SchoolId = @schoolId');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ message: 'Server error while fetching staff.' });
  }
});
// Get schools (names only for Admin)
app.get('/api/schools/names', authenticateToken, async (req, res) => {
  const { role } = req.user;

  if (role !== 'Admin') {
    return res.status(403).json({ message: 'Access denied. Admins only.' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT Id, Name
      FROM Schools;
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching schools:', error);
    res.status(500).json({ message: 'Error fetching schools' });
  }
});

// Get classes for a school
app.get('/api/classes', authenticateToken, async (req, res) => {
  const { role, schoolId: userSchoolId } = req.user;
  const { schoolId } = req.query;

  let targetSchoolId;
  if (role === 'Admin') {
    if (!schoolId) {
      return res.status(400).json({ message: 'School ID is required' });
    }
    targetSchoolId = schoolId;
  } else if (role === 'School') {
    targetSchoolId = userSchoolId;
  } else {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('schoolId', sql.Int, targetSchoolId)
      .query(`
        SELECT Id, Name, Section, Room
        FROM Classes
        WHERE SchoolId = @schoolId;
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ message: 'Error fetching classes' });
  }
});

// Get teachers for a school
app.get('/api/teachers', authenticateToken, async (req, res) => {
  const { role, schoolId: userSchoolId } = req.user;
  const { schoolId } = req.query;

  let targetSchoolId;
  if (role === 'Admin') {
    if (!schoolId) {
      return res.status(400).json({ message: 'School ID is required' });
    }
    targetSchoolId = schoolId;
  } else if (role === 'School') {
    targetSchoolId = userSchoolId;
  } else {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('schoolId', sql.Int, targetSchoolId)
      .query(`
        SELECT Id, Name
        FROM Teachers
        WHERE SchoolId = @schoolId;
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ message: 'Error fetching teachers' });
  }
});

// Get teacher details
app.get('/api/teachers/:teacherId', authenticateToken, async (req, res) => {
  const { teacherId } = req.params;
  const { role, schoolId: userSchoolId, id: userId } = req.user;

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('teacherId', sql.Int, teacherId)
      .query(`
        SELECT t.Id, t.Name, t.SchoolId, t.ClassId
        FROM Teachers t
        WHERE t.Id = @teacherId;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const teacher = result.recordset[0];
    if (role === 'School' && teacher.SchoolId !== userSchoolId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (role === 'Teacher' && teacher.Id !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(teacher);
  } catch (error) {
    console.error('Error fetching teacher:', error);
    res.status(500).json({ message: 'Error fetching teacher' });
  }
});

// Get student details
app.get('/api/students/:studentId', authenticateToken, async (req, res) => {
  const { studentId } = req.params;
  const { role, schoolId: userSchoolId, id: userId } = req.user;

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('studentId', sql.Int, studentId)
      .query(`
        SELECT s.Id, s.Name, s.ClassId, c.SchoolId
        FROM Students s
        JOIN Classes c ON s.ClassId = c.Id
        WHERE s.Id = @studentId;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const student = result.recordset[0];
    if (role === 'School' && student.SchoolId !== userSchoolId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (role === 'Student' && student.Id !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(student);
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ message: 'Error fetching student' });
  }
});

// Get classes for a school
app.get('/api/classes', authenticateToken, async (req, res) => {
  const { role, schoolId: userSchoolId } = req.user;
  const { schoolId } = req.query;

  console.log(`Request to /api/classes - role: ${role}, userSchoolId: ${userSchoolId}, query schoolId: ${schoolId}`);

  let targetSchoolId;
  if (role === 'Admin') {
    if (!schoolId) {
      console.error('Admin request missing schoolId parameter');
      return res.status(400).json({ message: 'School ID is required for Admins' });
    }
    targetSchoolId = parseInt(schoolId);
  } else if (role === 'School') {
    targetSchoolId = userSchoolId; // Use the logged-in school's ID
    console.log(`School role - using userSchoolId: ${targetSchoolId}`);
  } else {
    console.error(`Access denied for role: ${role}`);
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('schoolId', sql.Int, targetSchoolId)
      .query(`
        SELECT Id, Name, Section, Room, SchoolId
        FROM Classes
        WHERE SchoolId = @schoolId;
      `);

    console.log(`Classes fetched for schoolId ${targetSchoolId}:`, result.recordset);
    if (result.recordset.length === 0) {
      console.log(`No classes found for schoolId ${targetSchoolId}`);
    }
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ message: 'Error fetching classes' });
  }
});
// Create a subject (POST /api/subjects)
app.post('/api/subjects', authenticateToken, async (req, res) => {
  const { classId, name, teacherId, periodsPerWeek } = req.body;
  const { role, schoolId: userSchoolId } = req.user;

  if (!classId || !name || !teacherId || !periodsPerWeek) {
    return res.status(400).json({ message: 'Class ID, Name, Teacher ID, and Periods Per Week are required' });
  }

  try {
    const pool = await poolPromise;

    // Verify the class exists and belongs to the user's school
    const classResult = await pool
      .request()
      .input('classId', sql.Int, classId)
      .query(`
        SELECT SchoolId
        FROM Classes
        WHERE Id = @classId;
      `);

    if (classResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Class not found' });
    }

    const classSchoolId = classResult.recordset[0].SchoolId;
    if (role === 'School' && classSchoolId !== userSchoolId) {
      return res.status(403).json({ message: 'Access denied: Class does not belong to your school' });
    }

    if (role !== 'Admin' && role !== 'School') {
      return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
    }

    // Verify the teacher exists in the Teachers table and belongs to the same school
    const teacherResult = await pool
      .request()
      .input('teacherId', sql.Int, teacherId)
      .input('schoolId', sql.Int, classSchoolId)
      .query(`
        SELECT Id
        FROM Teachers
        WHERE Id = @teacherId AND SchoolId = @schoolId;
      `);

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found or does not belong to the same school as the class' });
    }

    // Insert the subject
    const result = await pool
      .request()
      .input('classId', sql.Int, classId)
      .input('name', sql.VarChar, name)
      .input('teacherId', sql.Int, teacherId)
      .input('periodsPerWeek', sql.Int, periodsPerWeek)
      .query(`
        INSERT INTO Subjects (ClassId, Name, TeacherId, PeriodsPerWeek, CreatedAt)
        OUTPUT INSERTED.*
        VALUES (@classId, @name, @teacherId, @periodsPerWeek, GETDATE());
      `);

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({ message: `Error creating subject: ${error.message}` });
  }
});

// Read subjects by ClassId (GET /api/subjects/class/:classId)
app.get('/api/subjects/class/:classId', authenticateToken, async (req, res) => {
  const { classId } = req.params;
  const { role, schoolId: userSchoolId } = req.user;

  try {
    const pool = await poolPromise;

    // Verify the class exists and belongs to the user's school
    const classResult = await pool
      .request()
      .input('classId', sql.Int, classId)
      .query(`
        SELECT SchoolId
        FROM Classes
        WHERE Id = @classId;
      `);

    if (classResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Class not found' });
    }

    const classSchoolId = classResult.recordset[0].SchoolId;
    if (role === 'School' && classSchoolId !== userSchoolId) {
      return res.status(403).json({ message: 'Access denied: Class does not belong to your school' });
    }

    // Fetch subjects for the class, including teacher names
    const result = await pool
      .request()
      .input('classId', sql.Int, classId)
      .query(`
        SELECT s.Id, s.Name, s.ClassId, s.TeacherId, s.PeriodsPerWeek, s.CreatedAt,
               t.Name AS TeacherName
        FROM Subjects s
        LEFT JOIN Teachers t ON s.TeacherId = t.Id
        WHERE s.ClassId = @classId;
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ message: `Error fetching subjects: ${error.message}` });
  }
});

// Update a subject (PUT /api/subjects/:id)
app.put('/api/subjects/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { classId, name, teacherId, periodsPerWeek } = req.body;
  const { role, schoolId: userSchoolId } = req.user;

  if (!classId || !name || !teacherId || !periodsPerWeek) {
    return res.status(400).json({ message: 'Class ID, Name, Teacher ID, and Periods Per Week are required' });
  }

  try {
    const pool = await poolPromise;

    // Verify the subject exists
    const subjectResult = await pool
      .request()
      .input('id', sql.Int, id)
      .query(`
        SELECT ClassId
        FROM Subjects
        WHERE Id = @id;
      `);

    if (subjectResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    // Verify the class exists and belongs to the user's school
    const classResult = await pool
      .request()
      .input('classId', sql.Int, classId)
      .query(`
        SELECT SchoolId
        FROM Classes
        WHERE Id = @classId;
      `);

    if (classResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Class not found' });
    }

    const classSchoolId = classResult.recordset[0].SchoolId;
    if (role === 'School' && classSchoolId !== userSchoolId) {
      return res.status(403).json({ message: 'Access denied: Class does not belong to your school' });
    }

    if (role !== 'Admin' && role !== 'School') {
      return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
    }

    // Verify the teacher exists and belongs to the same school
    const teacherResult = await pool
      .request()
      .input('teacherId', sql.Int, teacherId)
      .input('schoolId', sql.Int, classSchoolId)
      .query(`
        SELECT Id
        FROM Teachers
        WHERE Id = @teacherId AND SchoolId = @schoolId;
      `);

    if (teacherResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found or does not belong to the same school as the class' });
    }

    // Update the subject
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('classId', sql.Int, classId)
      .input('name', sql.VarChar, name)
      .input('teacherId', sql.Int, teacherId)
      .input('periodsPerWeek', sql.Int, periodsPerWeek)
      .query(`
        UPDATE Subjects
        SET ClassId = @classId, Name = @name, TeacherId = @teacherId, PeriodsPerWeek = @periodsPerWeek
        OUTPUT INSERTED.*
        WHERE Id = @id;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ message: `Error updating subject: ${error.message}` });
  }
});

// Delete a subject (DELETE /api/subjects/:id)
app.delete('/api/subjects/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { role, schoolId: userSchoolId } = req.user;

  try {
    const pool = await poolPromise;

    // Verify the subject exists and get its ClassId
    const subjectResult = await pool
      .request()
      .input('id', sql.Int, id)
      .query(`
        SELECT ClassId
        FROM Subjects
        WHERE Id = @id;
      `);

    if (subjectResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    const classId = subjectResult.recordset[0].ClassId;

    // Verify the class belongs to the user's school
    const classResult = await pool
      .request()
      .input('classId', sql.Int, classId)
      .query(`
        SELECT SchoolId
        FROM Classes
        WHERE Id = @classId;
      `);

    if (classResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Class not found' });
    }

    const classSchoolId = classResult.recordset[0].SchoolId;
    if (role === 'School' && classSchoolId !== userSchoolId) {
      return res.status(403).json({ message: 'Access denied: Class does not belong to your school' });
    }

    if (role !== 'Admin' && role !== 'School') {
      return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
    }

    // Delete the subject
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query(`
        DELETE FROM Subjects
        OUTPUT DELETED.*
        WHERE Id = @id;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ message: `Error deleting subject: ${error.message}` });
  }
});
// Classes Routes
app.get('/api/classes', authenticateToken, async (req, res) => {
  try {
    const { role, schoolId: userSchoolId } = req.user;
    let schoolId = userSchoolId;

    // Handle schoolId query parameter for Admin users
    if (req.query.schoolId) {
      const parsedSchoolId = parseInt(req.query.schoolId);
      if (isNaN(parsedSchoolId)) {
        return res.status(400).json({ message: 'Invalid school ID.' });
      }

      if (role === 'School' && parsedSchoolId !== userSchoolId) {
        return res.status(403).json({ message: 'Access denied. You can only view classes for your own school.' });
      }

      schoolId = parsedSchoolId;
    }

    if (!schoolId) {
      return res.status(400).json({ message: 'School ID is required.' });
    }

    const pool = await poolPromise;
    let query;
    if (role === 'Admin') {
      // Admin can fetch classes for any school based on query parameter
      query = 'SELECT Id, Name AS ClassName, Section, Room, SchoolId, CreatedAt FROM Classes WHERE SchoolId = @schoolId';
    } else {
      // Non-Admin users (School) can only fetch classes for their own school
      query = 'SELECT Id, Name AS ClassName, Section, Room, SchoolId, CreatedAt FROM Classes WHERE SchoolId = @schoolId';
    }

    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query(query);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching classes:', err.message, err.stack);
    res.status(500).json({ message: 'Server error while fetching classes', error: err.message });
  }
});

app.get('/api/classes', authenticateToken, async (req, res) => {
  try {
    const { role, schoolId: userSchoolId } = req.user;
    let schoolId = userSchoolId;

    // Handle schoolId query parameter for Admin users
    if (req.query.schoolId) {
      const parsedSchoolId = parseInt(req.query.schoolId);
      if (isNaN(parsedSchoolId)) {
        return res.status(400).json({ message: 'Invalid school ID.' });
      }

      if (role === 'School' && parsedSchoolId !== userSchoolId) {
        return res.status(403).json({ message: 'Access denied. You can only view classes for your own school.' });
      }

      schoolId = parsedSchoolId;
    }

    if (!schoolId) {
      return res.status(400).json({ message: 'School ID is required.' });
    }

    console.log(`Fetching classes for schoolId: ${schoolId}, role: ${role}`); // Debug log

    const pool = await poolPromise;
    let query;
    if (role === 'Admin') {
      query = 'SELECT Id, Name AS ClassName, Section, Room, SchoolId, CreatedAt FROM Classes WHERE SchoolId = @schoolId';
    } else {
      query = 'SELECT Id, Name AS ClassName, Section, Room, SchoolId, CreatedAt FROM Classes WHERE SchoolId = @schoolId';
    }

    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query(query);

    console.log(`Classes fetched: ${JSON.stringify(result.recordset)}`); // Debug log
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching classes:', err.message, err.stack);
    res.status(500).json({ message: 'Server error while fetching classes', error: err.message });
  }
});

app.post('/api/classes', authenticateToken, async (req, res) => {
  try {
    const { name, section, room, schoolId: schoolIdFromBody } = req.body;
    const { role, schoolId: userSchoolId } = req.user;
    let schoolId;

    if (role === 'Admin') {
      if (!schoolIdFromBody) {
        return res.status(400).json({ message: 'School ID is required for Admin users.' });
      }
      schoolId = parseInt(schoolIdFromBody);
      if (isNaN(schoolId)) {
        return res.status(400).json({ message: 'Invalid school ID.' });
      }
    } else if (role === 'School') {
      schoolId = userSchoolId;
      if (!schoolId) {
        return res.status(400).json({ message: 'School ID is missing for School user.' });
      }
      if (schoolIdFromBody && schoolIdFromBody !== userSchoolId) {
        return res.status(403).json({ message: 'Access denied: You can only add classes for your own school.' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied: Only Admin and School users can add classes.' });
    }

    if (!name || !section || !room) {
      return res.status(400).json({ message: 'Class name, section, and room are required.' });
    }

    const pool = await poolPromise;

    // Verify the school exists
    const schoolCheck = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query('SELECT Id FROM Schools WHERE Id = @schoolId');
    if (schoolCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'School not found.' });
    }

    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('section', sql.NVarChar, section)
      .input('room', sql.NVarChar, room)
      .input('schoolId', sql.Int, schoolId)
      .query(`
        INSERT INTO Classes (Name, Section, Room, SchoolId, CreatedAt)
        OUTPUT INSERTED.Id, INSERTED.Name AS ClassName, INSERTED.Section, INSERTED.Room, INSERTED.SchoolId, INSERTED.CreatedAt
        VALUES (@name, @section, @room, @schoolId, GETDATE())
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error adding class:', err.message, err.stack);
    res.status(500).json({ message: 'Server error while adding class', error: err.message });
  }
})
app.put('/api/classes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, section, room, schoolId: schoolIdFromBody } = req.body;
    const { role, schoolId: userSchoolId } = req.user;
    let schoolId;

    if (role === 'Admin') {
      if (!schoolIdFromBody) {
        return res.status(400).json({ message: 'School ID is required for Admin users.' });
      }
      schoolId = parseInt(schoolIdFromBody);
      if (isNaN(schoolId)) {
        return res.status(400).json({ message: 'Invalid school ID.' });
      }
    } else if (role === 'School') {
      schoolId = userSchoolId;
      if (!schoolId) {
        return res.status(400).json({ message: 'School ID is missing for School user.' });
      }
      if (schoolIdFromBody && schoolIdFromBody !== userSchoolId) {
        return res.status(403).json({ message: 'Access denied: You can only update classes for your own school.' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied: Only Admin and School users can update classes.' });
    }

    if (!name || !section || !room) {
      return res.status(400).json({ message: 'Class name, section, and room are required.' });
    }

    const pool = await poolPromise;

    // Verify the school exists
    const schoolCheck = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query('SELECT Id FROM Schools WHERE Id = @schoolId');
    if (schoolCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'School not found.' });
    }

    // Verify the class exists and belongs to the correct school
    const classCheck = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT SchoolId FROM Classes WHERE Id = @id');
    const classData = classCheck.recordset[0];
    if (!classData) {
      return res.status(404).json({ message: 'Class not found.' });
    }
    if (role !== 'Admin' && classData.SchoolId !== userSchoolId) {
      return res.status(403).json({ message: 'Access denied: You can only update classes in your own school.' });
    }

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar, name)
      .input('section', sql.NVarChar, section)
      .input('room', sql.NVarChar, room)
      .input('schoolId', sql.Int, schoolId)
      .query(`
        UPDATE Classes
        SET Name = @name, Section = @section, Room = @room, SchoolId = @schoolId
        OUTPUT INSERTED.Id, INSERTED.Name AS ClassName, INSERTED.Section, INSERTED.Room, INSERTED.SchoolId, INSERTED.CreatedAt
        WHERE Id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error updating class:', err.message, err.stack);
    res.status(500).json({ message: 'Server error while updating class', error: err.message });
  }
});

app.delete('/api/classes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, schoolId: userSchoolId } = req.user;

    if (role !== 'Admin' && role !== 'School') {
      return res.status(403).json({ message: 'Access denied: Only Admin and School users can delete classes.' });
    }

    const pool = await poolPromise;

    // Verify the class exists and get its SchoolId
    const classCheck = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT SchoolId FROM Classes WHERE Id = @id');
    const classData = classCheck.recordset[0];
    if (!classData) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    // Access control
    if (role !== 'Admin' && classData.SchoolId !== userSchoolId) {
      return res.status(403).json({ message: 'Access denied: You can only delete classes in your own school.' });
    }

    // Check if the class has associated students
    const studentCheck = await pool.request()
      .input('classId', sql.Int, id)
      .query('SELECT Id FROM Students WHERE ClassId = @classId');
    if (studentCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Cannot delete class: It has associated students.' });
    }

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Classes WHERE Id = @id');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting class:', err.message, err.stack);
    res.status(500).json({ message: 'Server error while deleting class', error: err.message });
  }
});
// Existing Accounts Routes (unchanged)
app.get('/api/accounts', authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT Id, Username, Email, Role, SchoolId FROM Users');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching accounts:', err);
    res.status(500).json({ message: 'Server error while fetching accounts' });
  }
});

app.get('/api/accounts/school/:schoolId/fees', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query('SELECT * FROM StudentFees WHERE SchoolId = @schoolId');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching student fees:', err);
    res.status(500).json({ message: 'Server error while fetching student fees' });
  }
});

app.get('/api/accounts/school/:schoolId/teacher-salaries', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query('SELECT * FROM TeacherSalaries WHERE SchoolId = @schoolId');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching teacher salaries:', err);
    res.status(500).json({ message: 'Server error while fetching teacher salaries' });
  }
});

app.get('/api/accounts/school/:schoolId/staff-salaries', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query('SELECT * FROM StaffSalaries WHERE SchoolId = @schoolId');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching staff salaries:', err);
    res.status(500).json({ message: 'Server error while fetching staff salaries' });
  }
});

app.put('/api/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const { username, email, role } = req.body;
    const userId = req.params.id;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .input('username', sql.NVarChar, username)
      .input('email', sql.NVarChar, email)
      .input('role', sql.NVarChar, role)
      .query('UPDATE Users SET Username = @username, Email = @email, Role = @role WHERE Id = @userId OUTPUT INSERTED.*');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error updating account:', err);
    res.status(500).json({ message: 'Server error while updating account' });
  }
});

app.delete('/api/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query('DELETE FROM Users WHERE Id = @userId');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting account:', err);
    res.status(500).json({ message: 'Server error while deleting account' });
  }
});


// Fetch all users (filtered by role)
// Fetch all users (filtered by role)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    let query = '';

    if (req.user.Role === 'Admin') {
      // Admin sees all users
      query = 'SELECT Id, Username, Role, Email, SchoolId, Permissions FROM Users';
    } else if (req.user.Role === 'School') {
      // School user sees:
      // 1. Themselves (Id = @userId and Role = 'School')
      // 2. Teachers, Students, and Staff from their own school (SchoolId = @schoolId)
      query = `
        SELECT Id, Username, Role, Email, SchoolId, Permissions 
        FROM Users 
        WHERE (Id = @userId AND Role = 'School')
           OR (SchoolId = @schoolId AND Role IN ('Teacher', 'Student', 'Staff'))
      `;
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const request = pool.request();
    if (req.user.Role === 'School') {
      request.input('schoolId', sql.Int, req.user.SchoolId);
      request.input('userId', sql.Int, req.user.Id);
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
});

// Fetch all schools (for dropdown)
app.get('/api/schools', authenticateToken, async (req, res) => {
  try {
    if (req.user.Role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT Id, Name FROM Schools');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching schools:', err);
    res.status(500).json({ message: 'Server error while fetching schools' });
  }
});

// Add a new user
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const { username, email, role, schoolId, password, permissions } = req.body;

    // Validate role
    if (!['Admin', 'School', 'Teacher', 'Student', 'Staff'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Role-based access control
    if (req.user.Role === 'Admin') {
      if (role === 'Admin' && schoolId) {
        return res.status(400).json({ message: 'Admins cannot be associated with a school' });
      }
      if (['Teacher', 'Student', 'Staff'].includes(role) && !schoolId) {
        return res.status(400).json({ message: 'School ID is required for Teachers, Students, and Staff' });
      }
    } else if (req.user.Role === 'School') {
      if (!['Teacher', 'Student', 'Staff'].includes(role)) {
        return res.status(403).json({ message: 'Access denied: Schools can only add Teachers, Students, or Staff' });
      }
      if (schoolId && schoolId !== req.user.SchoolId) {
        return res.status(403).json({ message: 'Access denied: Cannot add users to another school' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Check for duplicate email
    const pool = await poolPromise;
    const emailCheck = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT Id FROM Users WHERE Email = @email');
    if (emailCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const request = pool.request()
      .input('username', sql.NVarChar, username)
      .input('password', sql.NVarChar, hashedPassword)
      .input('role', sql.NVarChar, role)
      .input('email', sql.NVarChar, email)
      .input('schoolId', sql.Int, schoolId || null);

    // Handle permissions (optional)
    if (permissions) {
      request.input('permissions', sql.NVarChar, JSON.stringify(permissions));
    } else {
      request.input('permissions', sql.NVarChar, null);
    }

    const result = await request.query(
      'INSERT INTO Users (Username, Password, Role, Email, SchoolId, Permissions, CreatedAt) OUTPUT INSERTED.* VALUES (@username, @password, @role, @email, @schoolId, @permissions, GETDATE())'
    );

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error adding user:', err);
    if (err.number === 2627) { // SQL Server error code for unique constraint violation
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    res.status(500).json({ message: 'Server error while adding user', error: err.message });
  }
});

// Update a user
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const { username, email, role, schoolId, permissions } = req.body;

    // Fetch the user to update
    const pool = await poolPromise;
    const userResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT * FROM Users WHERE Id = @userId');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUser = userResult.recordset[0];

    // Role-based access control
    if (req.user.Role === 'Admin') {
      if (role === 'Admin' && schoolId) {
        return res.status(400).json({ message: 'Admins cannot be associated with a school' });
      }
      if (['Teacher', 'Student', 'Staff'].includes(role) && !schoolId) {
        return res.status(400).json({ message: 'School ID is required for Teachers, Students, and Staff' });
      }
    } else if (req.user.Role === 'School') {
      if (targetUser.SchoolId !== req.user.SchoolId || targetUser.Role === 'Admin') {
        return res.status(403).json({ message: 'Access denied: Can only update users under your school' });
      }
      if (!['Teacher', 'Student', 'Staff'].includes(role)) {
        return res.status(403).json({ message: 'Access denied: Schools can only update Teachers, Students, or Staff' });
      }
      if (schoolId && schoolId !== req.user.SchoolId) {
        return res.status(403).json({ message: 'Access denied: Cannot move users to another school' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Validate required fields
    if (!username || !email) {
      return res.status(400).json({ message: 'Username and email are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Check for duplicate email (excluding the current user)
    const emailCheck = await pool.request()
      .input('email', sql.NVarChar, email)
      .input('userId', sql.Int, userId)
      .query('SELECT Id FROM Users WHERE Email = @email AND Id != @userId');
    if (emailCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const request = pool.request()
      .input('userId', sql.Int, userId)
      .input('username', sql.NVarChar, username)
      .input('role', sql.NVarChar, role)
      .input('email', sql.NVarChar, email)
      .input('schoolId', sql.Int, schoolId || null);

    // Handle permissions (optional)
    if (permissions) {
      request.input('permissions', sql.NVarChar, JSON.stringify(permissions));
    } else {
      request.input('permissions', sql.NVarChar, null);
    }

    const result = await request.query(
      'UPDATE Users SET Username = @username, Role = @role, Email = @email, SchoolId = @schoolId, Permissions = @permissions WHERE Id = @userId OUTPUT INSERTED.*'
    );

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error updating user:', err);
    if (err.number === 2627) { // SQL Server error code for unique constraint violation
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    res.status(500).json({ message: 'Server error while updating user', error: err.message });
  }
});

// Delete a user
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;

    // Fetch the user to delete
    const pool = await poolPromise;
    const userResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT * FROM Users WHERE Id = @userId');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUser = userResult.recordset[0];

    // Role-based access control
    if (req.user.Role === 'Admin') {
      // Admin can delete any user
    } else if (req.user.Role === 'School') {
      if (targetUser.SchoolId !== req.user.SchoolId || targetUser.Role === 'Admin') {
        return res.status(403).json({ message: 'Access denied: Can only delete users under your school' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.request()
      .input('userId', sql.Int, userId)
      .query('DELETE FROM Users WHERE Id = @userId');

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Server error while deleting user' });
  }
});

// Reset own password
app.post('/api/users/reset-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const pool = await poolPromise;

    // Verify current password
    const user = req.user;
    const isMatch = await bcrypt.compare(currentPassword, user.Password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.request()
      .input('userId', sql.Int, user.Id)
      .input('password', sql.NVarChar, hashedPassword)
      .query('UPDATE Users SET Password = @password WHERE Id = @userId');

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ message: 'Server error while resetting password' });
  }
});

// Change another user's password
app.put('/api/users/:id/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;

    // Fetch the user to update
    const pool = await poolPromise;
    const userResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT * FROM Users WHERE Id = @userId');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUser = userResult.recordset[0];

    // Role-based access control
    if (req.user.Role === 'Admin') {
      // Admin can change any user's password
    } else if (req.user.Role === 'School') {
      if (targetUser.SchoolId !== req.user.SchoolId || targetUser.Role === 'Admin') {
        return res.status(403).json({ message: 'Access denied: Can only change passwords for users under your school' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('password', sql.NVarChar, hashedPassword)
      .query('UPDATE Users SET Password = @password WHERE Id = @userId');

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ message: 'Server error while changing password' });
  }
});
// Existing Routes (unchanged from previous conversations)

// Classes Routes
app.get('/api/classes', authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const schoolId = req.user.SchoolId;
    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query('SELECT * FROM Classes WHERE SchoolId = @schoolId');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching classes:', err);
    res.status(500).json({ message: 'Server error while fetching classes' });
  }
});

app.post('/api/classes', authenticateToken, async (req, res) => {
  try {
    const { className, section } = req.body;
    const schoolId = req.user.SchoolId;

    if (!className || !section || !schoolId) {
      return res.status(400).json({ message: 'Class name, section, and school ID are required' });
    }

    const pool = await poolPromise;

    const schoolCheck = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query('SELECT * FROM Schools WHERE Id = @schoolId');

    if (schoolCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'School not found' });
    }

    const result = await pool.request()
      .input('className', sql.NVarChar, className)
      .input('section', sql.NVarChar, section)
      .input('schoolId', sql.Int, schoolId)
      .query('INSERT INTO Classes (ClassName, Section, SchoolId) OUTPUT INSERTED.* VALUES (@className, @section, @schoolId)');

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error adding class:', err);
    res.status(500).json({ message: 'Server error while adding class' });
  }
});

app.put('/api/classes/:id', authenticateToken, async (req, res) => {
  try {
    const { className, section } = req.body;
    const classId = req.params.id;
    const schoolId = req.user.SchoolId;

    const pool = await poolPromise;
    const result = await pool.request()
      .input('classId', sql.Int, classId)
      .input('className', sql.NVarChar, className)
      .input('section', sql.NVarChar, section)
      .input('schoolId', sql.Int, schoolId)
      .query('UPDATE Classes SET ClassName = @className, Section = @section WHERE Id = @classId AND SchoolId = @schoolId OUTPUT INSERTED.*');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Class not found or you do not have permission to update it' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error updating class:', err);
    res.status(500).json({ message: 'Server error while updating class' });
  }
});

app.delete('/api/classes/:id', authenticateToken, async (req, res) => {
  try {
    const classId = req.params.id;
    const schoolId = req.user.SchoolId;

    const pool = await poolPromise;
    const result = await pool.request()
      .input('classId', sql.Int, classId)
      .input('schoolId', sql.Int, schoolId)
      .query('DELETE FROM Classes WHERE Id = @classId AND SchoolId = @schoolId');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Class not found or you do not have permission to delete it' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting class:', err);
    res.status(500).json({ message: 'Server error while deleting class' });
  }
});

// Accounts Routes
app.get('/api/accounts', authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT Id, Username, Email, Role, SchoolId FROM Users');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching accounts:', err);
    res.status(500).json({ message: 'Server error while fetching accounts' });
  }
});

app.get('/api/accounts/school/:schoolId/fees', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query('SELECT * FROM StudentFees WHERE SchoolId = @schoolId');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching student fees:', err);
    res.status(500).json({ message: 'Server error while fetching student fees' });
  }
});

app.get('/api/accounts/school/:schoolId/teacher-salaries', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query('SELECT * FROM TeacherSalaries WHERE SchoolId = @schoolId');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching teacher salaries:', err);
    res.status(500).json({ message: 'Server error while fetching teacher salaries' });
  }
});

app.get('/api/accounts/school/:schoolId/staff-salaries', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('schoolId', sql.Int, schoolId)
      .query('SELECT * FROM StaffSalaries WHERE SchoolId = @schoolId');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching staff salaries:', err);
    res.status(500).json({ message: 'Server error while fetching staff salaries' });
  }
});

app.put('/api/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const { username, email, role } = req.body;
    const userId = req.params.id;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .input('username', sql.NVarChar, username)
      .input('email', sql.NVarChar, email)
      .input('role', sql.NVarChar, role)
      .query('UPDATE Users SET Username = @username, Email = @email, Role = @role WHERE Id = @userId OUTPUT INSERTED.*');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error updating account:', err);
    res.status(500).json({ message: 'Server error while updating account' });
  }
});

app.delete('/api/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query('DELETE FROM Users WHERE Id = @userId');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting account:', err);
    res.status(500).json({ message: 'Server error while deleting account' });
  }
});

// Get current user
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    res.json(req.user);
  } catch (err) {
    console.error('Error fetching current user:', err);
    res.status(500).json({ message: 'Server error while fetching current user' });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});