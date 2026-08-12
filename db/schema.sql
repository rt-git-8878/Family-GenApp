-- Family-GenApp Relational Database Schema (PostgreSQL & SQLite Compatible)
-- Preserves parent-child genealogy hierarchy via father_id foreign key

-- 1. Members Table (Village Family Lineage Tree Nodes)
CREATE TABLE IF NOT EXISTS members (
    id VARCHAR(50) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    raw_name VARCHAR(255) NOT NULL,
    father_id VARCHAR(50),
    dob VARCHAR(100),
    title VARCHAR(255),
    gender VARCHAR(20) DEFAULT 'Male',
    occupation VARCHAR(255),
    profile_image VARCHAR(255) DEFAULT './default_avatar.png',
    marriage_note VARCHAR(100),
    marriages_count INT DEFAULT 1,
    generation_level INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (father_id) REFERENCES members(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_members_father_id ON members(father_id);
CREATE INDEX IF NOT EXISTS idx_members_dob ON members(dob);

-- 2. Users Table (Registered Application Accounts)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    dob VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'MEMBER',
    status VARCHAR(50) DEFAULT 'Active',
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_online BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile_number);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_online ON users(is_online);

-- 3. Audit Logs Table (Security Audit Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    action_type VARCHAR(255) NOT NULL,
    user_modified VARCHAR(255) NOT NULL,
    old_role VARCHAR(50),
    new_role VARCHAR(50),
    changed_by VARCHAR(255) NOT NULL,
    date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Pending Requests Table (New Birth Registration & Approval Workflow)
CREATE TABLE IF NOT EXISTS pending_requests (
    id VARCHAR(50) PRIMARY KEY,
    child_name VARCHAR(255) NOT NULL,
    dob VARCHAR(100) NOT NULL,
    father_id VARCHAR(50) NOT NULL,
    father_name VARCHAR(255) NOT NULL,
    photo_data TEXT,
    requested_by VARCHAR(255) NOT NULL,
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'PENDING',
    rejection_reason TEXT,
    approved_by VARCHAR(255),
    approval_date TIMESTAMP,
    FOREIGN KEY (father_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_requests_status ON pending_requests(status);

-- 5. Notifications Table (Approval & System Notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY,
    recipient_mobile VARCHAR(15),
    recipient_email VARCHAR(255),
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE
);

-- 6. Email OTP Verification Table (Free SMTP Email OTP Security Engine)
CREATE TABLE IF NOT EXISTS email_otp_verification (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    attempt_count INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'PENDING',
    verified_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_otp_email ON email_otp_verification(email);
