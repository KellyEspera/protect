// Template data for demo / offline use
// Used as fallback when Supabase is not yet configured

export const mockResidents = [
  { id: '1', resident_no: 'RES-0001', first_name: 'Maria', last_name: 'Santos', purok: 'Purok 1', date_of_birth: '1984-03-12', sex: 'Female', civil_status: 'Married', is_household_head: true, is_pwd: false, is_solo_parent: false, is_senior_citizen: false, monthly_income: 12000, age: 42 },
  { id: '2', resident_no: 'RES-0002', first_name: 'Pedro', last_name: 'Mabanag', purok: 'Purok 2', date_of_birth: '1989-07-22', sex: 'Male', civil_status: 'Married', is_household_head: true, is_pwd: false, is_solo_parent: false, is_senior_citizen: false, monthly_income: 9500, age: 35 },
  { id: '3', resident_no: 'RES-0003', first_name: 'Elena', last_name: 'Bernardo', purok: 'Purok 3', date_of_birth: '1997-01-05', sex: 'Female', civil_status: 'Single', is_household_head: false, is_pwd: false, is_solo_parent: true, is_senior_citizen: false, monthly_income: 6000, age: 29 },
  { id: '4', resident_no: 'RES-0004', first_name: 'Ramon', last_name: 'Claveria', purok: 'Purok 4', date_of_birth: '1966-11-30', sex: 'Male', civil_status: 'Widowed', is_household_head: true, is_pwd: true, pwd_type: 'Physical', is_solo_parent: false, is_senior_citizen: false, monthly_income: 4500, age: 58 },
  { id: '5', resident_no: 'RES-0005', first_name: 'Lucia', last_name: 'Valdez', purok: 'Purok 5', date_of_birth: '1959-06-14', sex: 'Female', civil_status: 'Widowed', is_household_head: true, is_pwd: false, is_solo_parent: false, is_senior_citizen: true, monthly_income: 3000, age: 67 },
  { id: '6', resident_no: 'RES-0006', first_name: 'Carlos', last_name: 'Tadena', purok: 'Purok 1', date_of_birth: '1993-09-18', sex: 'Male', civil_status: 'Single', is_household_head: false, is_pwd: false, is_solo_parent: false, is_senior_citizen: false, monthly_income: 8000, age: 31 },
  { id: '7', resident_no: 'RES-0007', first_name: 'Ana', last_name: 'Flores', purok: 'Purok 2', date_of_birth: '2002-04-25', sex: 'Female', civil_status: 'Single', is_household_head: false, is_pwd: false, is_solo_parent: false, is_senior_citizen: false, monthly_income: 5000, age: 24 },
  { id: '8', resident_no: 'RES-0008', first_name: 'Benigno', last_name: 'Cruz', purok: 'Purok 1', date_of_birth: '1952-02-08', sex: 'Male', civil_status: 'Married', is_household_head: true, is_pwd: false, is_solo_parent: false, is_senior_citizen: true, monthly_income: 4000, age: 74 },
  { id: '9', resident_no: 'RES-0009', first_name: 'Mia', last_name: 'Balanoy', purok: 'Purok 3', date_of_birth: '1993-12-01', sex: 'Female', civil_status: 'Single', is_household_head: true, is_pwd: false, is_solo_parent: true, is_senior_citizen: false, monthly_income: 5500, age: 31 },
  { id: '10', resident_no: 'RES-0010', first_name: 'Raul', last_name: 'Domingo', purok: 'Purok 2', date_of_birth: '1979-08-17', sex: 'Male', civil_status: 'Married', is_household_head: true, is_pwd: true, pwd_type: 'Visual', is_solo_parent: false, is_senior_citizen: false, monthly_income: 7000, age: 45 },
]

export const mockIncidents = [
  { id: '1', case_no: 'INC-2026-028', incident_type: 'Theft', purok: 'Purok 2', complainant: 'M. Santos', incident_date: '2026-06-03', status: 'Ongoing' },
  { id: '2', case_no: 'INC-2026-027', incident_type: 'Noise/Disturbance', purok: 'Purok 1', complainant: 'P. Mabanag', incident_date: '2026-06-02', status: 'Resolved' },
  { id: '3', case_no: 'INC-2026-026', incident_type: 'Accident', purok: 'Purok 4', complainant: 'Barangay', incident_date: '2026-06-01', status: 'Resolved' },
  { id: '4', case_no: 'INC-2026-025', incident_type: 'Domestic Violence', purok: 'Purok 3', complainant: 'Anonymous', incident_date: '2026-05-29', status: 'Resolved' },
  { id: '5', case_no: 'INC-2026-024', incident_type: 'Trespassing', purok: 'Purok 5', complainant: 'R. Domingo', incident_date: '2026-05-28', status: 'Escalated' },
]

export const mockBeneficiaries = [
  { id: '1', resident_no: 'RES-0001', name: 'Rosa Marcos', program: '4Ps', last_release_date: '2026-05-30', total_released: 3000, status: 'Active' },
  { id: '2', resident_no: 'RES-0002', name: 'Andres Batac', program: '4Ps, Rice Subsidy', last_release_date: '2026-05-30', total_released: 3250, status: 'Active' },
  { id: '3', resident_no: 'RES-0003', name: 'Nelia Darilag', program: 'Medical Assistance', last_release_date: '2026-05-20', total_released: 5000, status: 'Pending' },
  { id: '4', resident_no: 'RES-0004', name: 'Ana Flores', program: 'Educational Grant', last_release_date: '2026-04-15', total_released: 2500, status: 'Completed' },
  { id: '5', resident_no: 'RES-0005', name: 'Corazon Ibanag', program: 'Rice Subsidy', last_release_date: '2026-05-30', total_released: 250, status: 'Active' },
]

export const mockHouseholds = [
  { id: '1', household_no: 'HH-001', purok: 'Purok 1', address: 'Sitio Norte', latitude: 20.449, longitude: 121.9685, housing_type: 'Concrete', resident_count: 5 },
  { id: '2', household_no: 'HH-002', purok: 'Purok 2', address: 'Sitio Sur', latitude: 20.4475, longitude: 121.968, housing_type: 'Concrete', resident_count: 4 },
  { id: '3', household_no: 'HH-003', purok: 'Purok 3', address: 'Sitio Centro', latitude: 20.4462, longitude: 121.971, housing_type: 'Semi-concrete', resident_count: 6 },
  { id: '4', household_no: 'HH-004', purok: 'Purok 4', address: 'Sitio Este', latitude: 20.451, longitude: 121.9725, housing_type: 'Concrete', resident_count: 3 },
  { id: '5', household_no: 'HH-005', purok: 'Purok 5', address: 'Sitio Oeste', latitude: 20.453, longitude: 121.9745, housing_type: 'Wood', resident_count: 4 },
]

export const populationByYear = [
  { year: 2019, count: 1134 },
  { year: 2020, count: 1152 },
  { year: 2021, count: 1171 },
  { year: 2022, count: 1196 },
  { year: 2023, count: 1218 },
  { year: 2024, count: 1241 },
  { year: 2025, count: 1261 },
  { year: 2026, count: 1284 },
]

export const surveyNeeds = [
  { need: 'Health Services', count: 187 },
  { need: 'Road / Infrastructure', count: 142 },
  { need: 'Educational Support', count: 118 },
  { need: 'Livelihood Programs', count: 97 },
  { need: 'Water Supply', count: 74 },
  { need: 'Peace & Order', count: 52 },
]
