-- Schools table
CREATE TABLE Schools (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Name NVARCHAR(100) NOT NULL,
    Address NVARCHAR(200),
    Contact NVARCHAR(15),
    Email NVARCHAR(100) UNIQUE NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Users table for authentication
CREATE TABLE Users (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Username NVARCHAR(50) UNIQUE NOT NULL,
    Password NVARCHAR(255) NOT NULL,
    Role NVARCHAR(20) NOT NULL CHECK (Role IN ('Admin', 'School', 'Teacher', 'Student', 'Staff')),
    Email NVARCHAR(100) UNIQUE NOT NULL,
    SchoolId INT,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (SchoolId) REFERENCES Schools(Id)
);

-- Classes table
CREATE TABLE Classes (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Name NVARCHAR(50) NOT NULL,
    Section NVARCHAR(10) NOT NULL,
    Room NVARCHAR(20) NOT NULL,
    SchoolId INT NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (SchoolId) REFERENCES Schools(Id)
);

-- Students table
CREATE TABLE Students (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Name NVARCHAR(100) NOT NULL,
    RollNo NVARCHAR(20) UNIQUE NOT NULL,
    Email NVARCHAR(100) UNIQUE NOT NULL,
    Phone NVARCHAR(15),
    ClassId INT NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (ClassId) REFERENCES Classes(Id) ON DELETE CASCADE
);

-- Teachers table
CREATE TABLE Teachers (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Name NVARCHAR(100) NOT NULL,
    Email NVARCHAR(100) UNIQUE NOT NULL,
    Phone NVARCHAR(15),
    SchoolId INT NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (SchoolId) REFERENCES Schools(Id)
);

-- Staff table
CREATE TABLE Staff (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Name NVARCHAR(100) NOT NULL,
    Email NVARCHAR(100) UNIQUE NOT NULL,
    Phone NVARCHAR(15),
    SchoolId INT NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (SchoolId) REFERENCES Schools(Id)
);

-- Fees table
CREATE TABLE Fees (
    Id INT PRIMARY KEY IDENTITY(1,1),
    StudentId INT NOT NULL,
    Amount DECIMAL(10, 2) NOT NULL,
    Submitted DECIMAL(10, 2) DEFAULT 0,
    Balance DECIMAL(10, 2) GENERATED ALWAYS AS (Amount - Submitted),
    Fine DECIMAL(10, 2) DEFAULT 0,
    DueDate DATE NOT NULL,
    Status NVARCHAR(20) NOT NULL CHECK (Status IN ('Pending', 'Paid')),
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (StudentId) REFERENCES Students(Id) ON DELETE CASCADE
);

-- Salaries table (for both Teachers and Staff)
CREATE TABLE Salaries (
    Id INT PRIMARY KEY IDENTITY(1,1),
    TeacherId INT,
    StaffId INT,
    Amount DECIMAL(10, 2) NOT NULL,
    Month DATE NOT NULL,
    Status NVARCHAR(20) NOT NULL CHECK (Status IN ('Credited', 'Not Credited')),
    Tax DECIMAL(10, 2) DEFAULT 0,
    PF DECIMAL(10, 2) DEFAULT 0,
    Bonus DECIMAL(10, 2) DEFAULT 0,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (TeacherId) REFERENCES Teachers(Id) ON DELETE CASCADE,
    FOREIGN KEY (StaffId) REFERENCES Staff(Id) ON DELETE CASCADE,
    CHECK ((TeacherId IS NOT NULL AND StaffId IS NULL) OR (TeacherId IS NULL AND StaffId IS NOT NULL))
);

-- Notices table
CREATE TABLE Notices (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Title NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NOT NULL,
    Date DATE NOT NULL,
    SchoolId INT NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (SchoolId) REFERENCES Schools(Id)
);

-- Events table
CREATE TABLE Events (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Title NVARCHAR(100) NOT NULL,
    Date DATE NOT NULL,
    Description NVARCHAR(500) NOT NULL,
    SchoolId INT NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (SchoolId) REFERENCES Schools(Id)
);

-- Holidays table
CREATE TABLE Holidays (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Name NVARCHAR(100) NOT NULL,
    Date DATE NOT NULL,
    Description NVARCHAR(500) NOT NULL,
    SchoolId INT NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (SchoolId) REFERENCES Schools(Id)
);

-- Attendance table
CREATE TABLE Attendance (
    Id INT PRIMARY KEY IDENTITY(1,1),
    StudentId INT NOT NULL,
    Date DATE NOT NULL,
    Status NVARCHAR(20) NOT NULL CHECK (Status IN ('Present', 'Absent')),
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (StudentId) REFERENCES Students(Id) ON DELETE CASCADE
);

-- Reports table
CREATE TABLE Reports (
    Id INT PRIMARY KEY IDENTITY(1,1),
    StudentId INT NOT NULL,
    ClassId INT NOT NULL,
    SubjectId INT NOT NULL,
    Marks DECIMAL(5, 2) NOT NULL,
    Remarks NVARCHAR(200),
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (StudentId) REFERENCES Students(Id) ON DELETE CASCADE,
    FOREIGN KEY (ClassId) REFERENCES Classes(Id),
    FOREIGN KEY (SubjectId) REFERENCES Subjects(Id)
);

-- Subjects table
CREATE TABLE Subjects (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Name NVARCHAR(100) NOT NULL,
    ClassId INT NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (ClassId) REFERENCES Classes(Id) ON DELETE CASCADE
);