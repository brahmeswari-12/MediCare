-- Creates the application database, the test database and a dedicated user.
-- Run as a MySQL administrator (e.g. root). Replace CHANGE_ME with the
-- DB_PASSWORD value from backend/.env before running.
CREATE DATABASE IF NOT EXISTS healthcare_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'healthcare_user'@'localhost' IDENTIFIED BY 'CHANGE_ME';
CREATE USER IF NOT EXISTS 'healthcare_user'@'127.0.0.1' IDENTIFIED BY 'CHANGE_ME';
GRANT ALL PRIVILEGES ON healthcare_db.* TO 'healthcare_user'@'localhost';
GRANT ALL PRIVILEGES ON healthcare_db.* TO 'healthcare_user'@'127.0.0.1';
-- Django's test runner creates and drops this database.
GRANT ALL PRIVILEGES ON test_healthcare_db.* TO 'healthcare_user'@'localhost';
GRANT ALL PRIVILEGES ON test_healthcare_db.* TO 'healthcare_user'@'127.0.0.1';
FLUSH PRIVILEGES;
