import Employee from '../models/Employee.js';

export const MOBILE_REGEX = /^[6-9]\d{9}$/;

export const validateMobile = (mobile) => {
  const cleaned = String(mobile || '').replace(/\D/g, '');
  if (!MOBILE_REGEX.test(cleaned)) {
    return { valid: false, message: 'Mobile number must be exactly 10 digits and start with 6-9' };
  }
  return { valid: true, value: cleaned };
};

export const generateEmployeeCode = async () => {
  const employees = await Employee.find({}, 'employeeCode');
  let maxNum = 0;
  employees.forEach((emp) => {
    const match = emp.employeeCode?.match(/^EMP(\d+)$/i);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  });
  return `EMP${String(maxNum + 1).padStart(3, '0')}`;
};
