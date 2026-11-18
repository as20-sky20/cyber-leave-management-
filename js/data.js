/**
 * Haryana Cyber Police - Leave Management Portal
 * Central Data Definitions & Default Seed Data
 */

const BRANCHES = [
  { id: "cyber_helpline_1930", name: "Cyber Helpline 1930", hindi: "Cyber Helpline 1930 Desk", icon: "phone-call" },
  { id: "data_analysis_wing", name: "Data Analysis Wing", hindi: "Data Analysis Wing", icon: "bar-chart-2" },
  { id: "social_media", name: "Social Media", hindi: "Social Media Monitoring Wing", icon: "share-2" },
  { id: "online_crime_women", name: "Online Crime Against Women", hindi: "Online Crime Against Women Cell", icon: "shield-alert" },
  { id: "cyber_awareness", name: "Cyber Awareness and Content Creation", hindi: "Cyber Awareness & Content Wing", icon: "megaphone" },
  { id: "admin_branch", name: "Admin Branch", hindi: "Cyber Admin & Establishment Branch", icon: "briefcase" },
  { id: "investigation_support", name: "Investigation Support Team", hindi: "Technical Investigation Support", icon: "search" },
  { id: "dark_web_crypto_ai", name: "Dark Web, Crypto Currency & AI Task Force", hindi: "Dark Web, Crypto & AI Task Force", icon: "cpu" },
  { id: "cyber_security", name: "Cyber Security", hindi: "Cyber Security & Infrastructure", icon: "lock" },
  { id: "bank_coordination", name: "Coordination with Bank", hindi: "Banking Liaison & Financial Recovery", icon: "landmark" },
  { id: "other_state_coordination", name: "Coordination with Other State", hindi: "Inter-State Police Coordination", icon: "map-pin" },
  { id: "ncrp_portal_nodal", name: "NCRP Portal Nodal", hindi: "NCRP Portal Nodal Wing", icon: "globe" },
  { id: "cyber_ps_panchkula", name: "Cyber Police Station Panchkula", hindi: "Cyber Police Station Panchkula", icon: "shield" }
];

const LEAVE_TYPES = [
  { code: "CL", name: "Casual Leave", hindi: "Casual Leave (CL)", annualQuota: 20, desc: "Standard casual leave for urgent personal matters" },
  { code: "EL", name: "Earned Leave", hindi: "Earned Leave (EL)", annualQuota: 30, desc: "Accumulated privilege leave" },
  { code: "ML", name: "Medical Leave", hindi: "Medical Leave (ML)", annualQuota: 20, desc: "Leave on medical grounds (certificate required)" },
  { code: "PL", name: "Paternity Leave", hindi: "Paternity Leave (PL)", annualQuota: 15, desc: "For male personnel on childbirth" },
  { code: "CCL", name: "Child Care Leave", hindi: "Child Care Leave (CCL)", annualQuota: 30, desc: "Care of minor child (female personnel)" },
  { code: "C-OFF", name: "Compensatory Off", hindi: "Compensatory Off (C-OFF)", annualQuota: 10, desc: "Against extra weekend/night cyber duty" },
  { code: "HPL", name: "Half Pay Leave", hindi: "Half Pay Leave (HPL)", annualQuota: 20, desc: "Half pay leave on private/medical certificate" },
  { code: "RH", name: "Restricted Holiday", hindi: "Restricted Holiday (RH)", annualQuota: 2, desc: "Selected gazetted optional holidays" }
];

const RANKS = [
  "SP (Superintendent of Police)",
  "DSP (Deputy Superintendent of Police)",
  "Inspector",
  "Sub-Inspector (SI)",
  "Assistant Sub-Inspector (ASI)",
  "Head Constable (HC)",
  "Constable (CT)",
  "Cyber Forensic Analyst",
  "Technical Consultant"
];

const DEFAULT_USERS = [
  // SP Cyber (Top Approver)
  {
    id: "SP-001",
    beltNo: "IPS-2018/01",
    name: "Mayank Gupta, IPS",
    rank: "SP (Superintendent of Police)",
    role: "sp_cyber",
    branchId: "admin_branch",
    mobile: "+91 94160 00001",
    email: "sp.cyber-hry@gov.in",
    isApprover: true,
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  },

  // Branch Incharges
  {
    id: "INCH-1930",
    beltNo: "742/PKL",
    name: "Insp. Rajesh Kumar",
    rank: "Inspector",
    role: "branch_incharge",
    branchId: "cyber_helpline_1930",
    mobile: "+91 98120 11930",
    email: "incharge.1930@cyberhry.gov.in",
    isApprover: true,
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "INCH-DAW",
    beltNo: "512/PKL",
    name: "SI Pooja Sharma",
    rank: "Sub-Inspector (SI)",
    role: "branch_incharge",
    branchId: "data_analysis_wing",
    mobile: "+91 94670 22001",
    email: "incharge.daw@cyberhry.gov.in",
    isApprover: true,
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 0, CCL: 30, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "INCH-SM",
    beltNo: "389/PKL",
    name: "SI Amit Rana",
    rank: "Sub-Inspector (SI)",
    role: "branch_incharge",
    branchId: "social_media",
    mobile: "+91 98123 33001",
    email: "incharge.social@cyberhry.gov.in",
    isApprover: true,
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "INCH-WOMEN",
    beltNo: "614/PKL",
    name: "Insp. Sunita Devi",
    rank: "Inspector",
    role: "branch_incharge",
    branchId: "online_crime_women",
    mobile: "+91 94161 44001",
    email: "incharge.women@cyberhry.gov.in",
    isApprover: true,
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 0, CCL: 30, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "INCH-AWARE",
    beltNo: "277/PKL",
    name: "ASI Gurdeep Singh",
    rank: "Assistant Sub-Inspector (ASI)",
    role: "branch_incharge",
    branchId: "cyber_awareness",
    mobile: "+91 98130 55001",
    email: "incharge.awareness@cyberhry.gov.in",
    isApprover: true,
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "INCH-ADMIN",
    beltNo: "108/PKL",
    name: "Insp. Harinder Singh (Reader)",
    rank: "Inspector",
    role: "branch_incharge",
    branchId: "admin_branch",
    mobile: "+91 94162 66001",
    email: "admin.cyber@cyberhry.gov.in",
    isApprover: true,
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "INCH-INVEST",
    beltNo: "433/PKL",
    name: "SI Vikash Malik",
    rank: "Sub-Inspector (SI)",
    role: "branch_incharge",
    branchId: "investigation_support",
    mobile: "+91 98124 77001",
    email: "incharge.investigation@cyberhry.gov.in",
    isApprover: true,
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "INCH-DARK",
    beltNo: "905/PKL",
    name: "Insp. Ankit Verma",
    rank: "Inspector",
    role: "branch_incharge",
    branchId: "dark_web_crypto_ai",
    mobile: "+91 94671 88001",
    email: "darkweb.crypto@cyberhry.gov.in",
    isApprover: true,
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "INCH-SEC",
    beltNo: "821/PKL",
    name: "SI Deepanshu Narang",
    rank: "Sub-Inspector (SI)",
    role: "branch_incharge",
    branchId: "cyber_security",
    mobile: "+91 98125 99001",
    email: "cybersec.panchkula@cyberhry.gov.in",
    isApprover: true,
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "INCH-BANK",
    beltNo: "367/PKL",
    name: "SI Manjeet Yadav",
    rank: "Sub-Inspector (SI)",
    role: "branch_incharge",
    branchId: "bank_coordination",
    mobile: "+91 94163 10101",
    email: "bank.coord@cyberhry.gov.in",
    isApprover: true,
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "INCH-STATE",
    beltNo: "492/PKL",
    name: "ASI Ramesh Chand",
    rank: "Assistant Sub-Inspector (ASI)",
    role: "branch_incharge",
    branchId: "other_state_coordination",
    mobile: "+91 98126 11201",
    email: "interstate.cyber@cyberhry.gov.in",
    isApprover: true,
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "INCH-NCRP",
    beltNo: "650/PKL",
    name: "SI Preeti Choudhary",
    rank: "Sub-Inspector (SI)",
    role: "branch_incharge",
    branchId: "ncrp_portal_nodal",
    mobile: "+91 94672 12301",
    email: "ncrp.nodal@cyberhry.gov.in",
    isApprover: true,
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 0, CCL: 30, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "INCH-PS-PKL",
    beltNo: "SHO/PKL",
    name: "Insp. Mohinder Singh (SHO)",
    rank: "Inspector",
    role: "branch_incharge",
    branchId: "cyber_ps_panchkula",
    mobile: "+91 94164 13401",
    email: "sho.cyberps-pkl@cyberhry.gov.in",
    isApprover: true,
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  },

  // Police Staff / Members (Regular users across branches)
  {
    id: "CYB-101",
    beltNo: "1420/PKL",
    name: "CT Rahul Deswal",
    rank: "Constable (CT)",
    role: "member",
    branchId: "cyber_helpline_1930",
    mobile: "+91 98121 55678",
    email: "rahul.1420@cyberhry.gov.in",
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "CYB-102",
    beltNo: "1655/PKL",
    name: "HC Sandeep Kumar",
    rank: "Head Constable (HC)",
    role: "member",
    branchId: "cyber_helpline_1930",
    mobile: "+91 94165 77890",
    email: "sandeep.1655@cyberhry.gov.in",
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "CYB-103",
    beltNo: "1892/PKL",
    name: "CT Neha Saini",
    rank: "Constable (CT)",
    role: "member",
    branchId: "data_analysis_wing",
    mobile: "+91 98129 11223",
    email: "neha.1892@cyberhry.gov.in",
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 0, CCL: 30, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "CYB-104",
    beltNo: "1140/PKL",
    name: "ASI Surender Singh",
    rank: "Assistant Sub-Inspector (ASI)",
    role: "member",
    branchId: "dark_web_crypto_ai",
    mobile: "+91 94678 33445",
    email: "surender.1140@cyberhry.gov.in",
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "CYB-105",
    beltNo: "2104/PKL",
    name: "CT Deepak Punia",
    rank: "Constable (CT)",
    role: "member",
    branchId: "cyber_ps_panchkula",
    mobile: "+91 98135 66778",
    email: "deepak.2104@cyberhry.gov.in",
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "CYB-106",
    beltNo: "1780/PKL",
    name: "HC Anita Rani",
    rank: "Head Constable (HC)",
    role: "member",
    branchId: "online_crime_women",
    mobile: "+91 94169 88990",
    email: "anita.1780@cyberhry.gov.in",
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 0, CCL: 30, "C-OFF": 10, HPL: 20, RH: 2 }
  },
  {
    id: "CYB-107",
    beltNo: "1350/PKL",
    name: "CT Naveen Boora",
    rank: "Constable (CT)",
    role: "member",
    branchId: "bank_coordination",
    mobile: "+91 98127 44556",
    email: "naveen.1350@cyberhry.gov.in",
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 10, HPL: 20, RH: 2 }
  }
];

const DEFAULT_LEAVES = [];

const DEFAULT_NOTICES = [
  {
    id: "NOT-2026-001",
    title: "Weekly Cyber Crime Review & 1930 Portal Coordination Meeting",
    category: "MEETING",
    categoryHindi: "Important Meeting",
    priority: "URGENT",
    targetBranch: "ALL",
    targetBranchName: "All 13 Cyber Wings / Branches",
    content: "All Branch Incharges and 1930 Helpdesk Team are directed to attend the weekly review meeting tomorrow at 10:30 AM in Conference Hall, Cyber HQ Panchkula along with updated case pendency and recovery reports.",
    postedBy: "Mayank Gupta, IPS",
    postedByRole: "sp_cyber",
    postedAt: "2026-11-04 09:30 AM",
    pinned: true
  },
  {
    id: "NOT-2026-002",
    title: "Standing Directive: Restriction on Routine Leave during Law & Order / VVIP Cyber Security",
    category: "ORDER",
    categoryHindi: "Office Order",
    priority: "URGENT",
    targetBranch: "ALL",
    targetBranchName: "All 13 Cyber Wings / Branches",
    content: "In view of upcoming festival security and high-level VVIP cyber surveillance duties, only extreme emergency/casual leaves will be entertained during the coming week. Incharges are advised to strictly verify duty handovers before recommending applications.",
    postedBy: "Insp. Harinder Singh (Reader)",
    postedByRole: "admin",
    postedAt: "2026-11-03 04:15 PM",
    pinned: false
  },
  {
    id: "NOT-2026-003",
    title: "NCRP Portal & Banking Liaison - Immediate Disposal of Priority Fraud Liens",
    category: "DIRECTIVE",
    categoryHindi: "Immediate Directive",
    priority: "NORMAL",
    targetBranch: "ncrp_portal_nodal",
    targetBranchName: "NCRP Portal Nodal & Bank Coordination",
    content: "Banking Coordination Team and NCRP Nodal officers are directed to expedite liaison with nodal bank officers for all cyber financial fraud cases pending over 48 hours to ensure immediate account debit-freeze and victim relief.",
    postedBy: "Mayank Gupta, IPS",
    postedByRole: "sp_cyber",
    postedAt: "2026-11-02 11:20 AM",
    pinned: false
  }
];

// ==========================================
// OFFICIAL HARYANA GOVT HOLIDAY CALENDAR 2026
// (Published by Department of Information, Public Relations & Languages, Haryana)
// ==========================================
const HARYANA_GOVT_HOLIDAYS_2026 = [
  // --- JANUARY ---
  {
    id: "HOL-2026-01",
    date: "2026-01-23",
    day: "Friday",
    hindiDay: "शुक्रवार",
    name: "सर छोटू राम जयंती / बसंत पंचमी",
    englishName: "Sir Chhotu Ram Jayanti / Basant Panchami",
    type: "GAZETTED",
    month: "January",
    monthHindi: "जनवरी"
  },
  {
    id: "HOL-2026-02",
    date: "2026-01-23",
    day: "Friday",
    hindiDay: "शुक्रवार",
    name: "नेताजी सुभाष चन्द्र बोस जयंती",
    englishName: "Netaji Subhash Chandra Bose Jayanti",
    type: "RESTRICTED",
    month: "January",
    monthHindi: "जनवरी"
  },
  {
    id: "HOL-2026-03",
    date: "2026-01-26",
    day: "Monday",
    hindiDay: "सोमवार",
    name: "गणतन्त्र दिवस",
    englishName: "Republic Day",
    type: "GAZETTED",
    month: "January",
    monthHindi: "जनवरी"
  },

  // --- FEBRUARY ---
  {
    id: "HOL-2026-04",
    date: "2026-02-01",
    day: "Sunday",
    hindiDay: "रविवार",
    name: "गुरु रविदास जयंती",
    englishName: "Guru Ravidas Jayanti",
    type: "GAZETTED",
    month: "February",
    monthHindi: "फरवरी"
  },
  {
    id: "HOL-2026-05",
    date: "2026-02-15",
    day: "Sunday",
    hindiDay: "रविवार",
    name: "महर्षि दयानंद सरस्वती जयंती",
    englishName: "Maharishi Dayanand Saraswati Jayanti",
    type: "GAZETTED",
    month: "February",
    monthHindi: "फरवरी"
  },
  {
    id: "HOL-2026-06",
    date: "2026-02-15",
    day: "Sunday",
    hindiDay: "रविवार",
    name: "महाशिवरात्रि",
    englishName: "Maha Shivratri",
    type: "GAZETTED",
    month: "February",
    monthHindi: "फरवरी"
  },

  // --- MARCH ---
  {
    id: "HOL-2026-07",
    date: "2026-03-04",
    day: "Wednesday",
    hindiDay: "बुधवार",
    name: "होली",
    englishName: "Holi",
    type: "GAZETTED",
    month: "March",
    monthHindi: "मार्च"
  },
  {
    id: "HOL-2026-08",
    date: "2026-03-12",
    day: "Thursday",
    hindiDay: "गुरुवार",
    name: "संत नामदेव जी जयंती",
    englishName: "Sant Namdev Ji Jayanti",
    type: "RESTRICTED",
    month: "March",
    monthHindi: "मार्च"
  },
  {
    id: "HOL-2026-09",
    date: "2026-03-15",
    day: "Sunday",
    hindiDay: "रविवार",
    name: "कांशीराम जयंती / हस्त कला दिवस",
    englishName: "Kanshi Ram Jayanti / Craft Day",
    type: "RESTRICTED",
    month: "March",
    monthHindi: "मार्च"
  },
  {
    id: "HOL-2026-10",
    date: "2026-03-21",
    day: "Saturday",
    hindiDay: "शनिवार",
    name: "ईद-उल-फितर",
    englishName: "Eid-ul-Fitr",
    type: "GAZETTED",
    month: "March",
    monthHindi: "मार्च"
  },
  {
    id: "HOL-2026-11",
    date: "2026-03-23",
    day: "Monday",
    hindiDay: "सोमवार",
    name: "शहीदी दिवस (भगत सिंह, राजगुरु एवं सुखदेव)",
    englishName: "Shaheedi Diwas (Bhagat Singh, Rajguru & Sukhdev)",
    type: "GAZETTED",
    month: "March",
    monthHindi: "मार्च"
  },
  {
    id: "HOL-2026-12",
    date: "2026-03-27",
    day: "Friday",
    hindiDay: "शुक्रवार",
    name: "रामनवमी",
    englishName: "Ram Navami",
    type: "GAZETTED",
    month: "March",
    monthHindi: "मार्च"
  },
  {
    id: "HOL-2026-13",
    date: "2026-03-31",
    day: "Tuesday",
    hindiDay: "मंगलवार",
    name: "महावीर जयंती",
    englishName: "Mahavir Jayanti",
    type: "GAZETTED",
    month: "March",
    monthHindi: "मार्च"
  },

  // --- APRIL ---
  {
    id: "HOL-2026-14",
    date: "2026-04-03",
    day: "Friday",
    hindiDay: "शुक्रवार",
    name: "गुड फ्राइडे",
    englishName: "Good Friday",
    type: "GAZETTED",
    month: "April",
    monthHindi: "अप्रैल"
  },
  {
    id: "HOL-2026-15",
    date: "2026-04-11",
    day: "Saturday",
    hindiDay: "शनिवार",
    name: "महात्मा ज्योतिबा फुले जयंती",
    englishName: "Mahatma Jyotiba Phule Jayanti",
    type: "RESTRICTED",
    month: "April",
    monthHindi: "अप्रैल"
  },
  {
    id: "HOL-2026-16",
    date: "2026-04-14",
    day: "Tuesday",
    hindiDay: "मंगलवार",
    name: "डॉ. बी.आर. अम्बेडकर जयंती / बैसाखी",
    englishName: "Dr. B.R. Ambedkar Jayanti / Vaisakhi",
    type: "GAZETTED",
    month: "April",
    monthHindi: "अप्रैल"
  },
  {
    id: "HOL-2026-17",
    date: "2026-04-19",
    day: "Sunday",
    hindiDay: "रविवार",
    name: "परशुराम जयंती / अक्षय तृतीया",
    englishName: "Parashurama Jayanti / Akshaya Tritiya",
    type: "GAZETTED",
    month: "April",
    monthHindi: "अप्रैल"
  },
  {
    id: "HOL-2026-18",
    date: "2026-04-27",
    day: "Monday",
    hindiDay: "सोमवार",
    name: "संत धन्ना भगत जयंती",
    englishName: "Sant Dhanna Bhagat Jayanti",
    type: "RESTRICTED",
    month: "April",
    monthHindi: "अप्रैल"
  },
  {
    id: "HOL-2026-19",
    date: "2026-04-29",
    day: "Wednesday",
    hindiDay: "बुधवार",
    name: "श्री गुरु तेग बहादुर जी जयंती",
    englishName: "Shri Guru Tegh Bahadur Ji Jayanti",
    type: "RESTRICTED",
    month: "April",
    monthHindi: "अप्रैल"
  },

  // --- MAY ---
  {
    id: "HOL-2026-20",
    date: "2026-05-01",
    day: "Friday",
    hindiDay: "शुक्रवार",
    name: "बुद्ध पूर्णिमा",
    englishName: "Buddha Purnima",
    type: "GAZETTED",
    month: "May",
    monthHindi: "मई"
  },
  {
    id: "HOL-2026-21",
    date: "2026-05-23",
    day: "Saturday",
    hindiDay: "शनिवार",
    name: "श्री गुरु गोरखनाथ स्मृति दिवस",
    englishName: "Shri Guru Gorakhnath Smriti Diwas",
    type: "RESTRICTED",
    month: "May",
    monthHindi: "मई"
  },
  {
    id: "HOL-2026-22",
    date: "2026-05-24",
    day: "Sunday",
    hindiDay: "रविवार",
    name: "महर्षि कश्यप जयंती",
    englishName: "Maharishi Kashyap Jayanti",
    type: "GAZETTED",
    month: "May",
    monthHindi: "मई"
  },
  {
    id: "HOL-2026-23",
    date: "2026-05-27",
    day: "Wednesday",
    hindiDay: "बुधवार",
    name: "ईद-उल-जुहा (बकरीद)",
    englishName: "Eid-ul-Zuha (Bakrid)",
    type: "GAZETTED",
    month: "May",
    monthHindi: "मई"
  },
  {
    id: "HOL-2026-24",
    date: "2026-05-31",
    day: "Sunday",
    hindiDay: "रविवार",
    name: "महारानी देवी अहिल्याबाई होल्कर जयंती",
    englishName: "Maharani Ahilyabai Holkar Jayanti",
    type: "RESTRICTED",
    month: "May",
    monthHindi: "मई"
  },

  // --- JUNE ---
  {
    id: "HOL-2026-25",
    date: "2026-06-09",
    day: "Tuesday",
    hindiDay: "मंगलवार",
    name: "वीर बंदा बैरागी बलिदान दिवस",
    englishName: "Veer Banda Bairagi Balidan Diwas",
    type: "RESTRICTED",
    month: "June",
    monthHindi: "जून"
  },
  {
    id: "HOL-2026-26",
    date: "2026-06-17",
    day: "Wednesday",
    hindiDay: "बुधवार",
    name: "महाराणा प्रताप जयंती",
    englishName: "Maharana Pratap Jayanti",
    type: "GAZETTED",
    month: "June",
    monthHindi: "जून"
  },
  {
    id: "HOL-2026-27",
    date: "2026-06-18",
    day: "Thursday",
    hindiDay: "गुरुवार",
    name: "गुरु अर्जुन देव शहीदी दिवस",
    englishName: "Guru Arjan Dev Martyrdom Day",
    type: "GAZETTED",
    month: "June",
    monthHindi: "जून"
  },
  {
    id: "HOL-2026-28",
    date: "2026-06-26",
    day: "Friday",
    hindiDay: "शुक्रवार",
    name: "मुहर्रम",
    englishName: "Muharram",
    type: "GAZETTED",
    month: "June",
    monthHindi: "जून"
  },
  {
    id: "HOL-2026-29",
    date: "2026-06-29",
    day: "Monday",
    hindiDay: "सोमवार",
    name: "संत कबीर जयंती",
    englishName: "Sant Kabir Jayanti",
    type: "GAZETTED",
    month: "June",
    monthHindi: "जून"
  },

  // --- JULY ---
  {
    id: "HOL-2026-30",
    date: "2026-07-04",
    day: "Saturday",
    hindiDay: "शनिवार",
    name: "माई लच्छो देवी जयंती",
    englishName: "Mai Lachho Devi Jayanti",
    type: "RESTRICTED",
    month: "July",
    monthHindi: "जुलाई"
  },
  {
    id: "HOL-2026-31",
    date: "2026-07-07",
    day: "Tuesday",
    hindiDay: "मंगलवार",
    name: "बाबा मक्खन शाह लुबाना जयंती",
    englishName: "Baba Makhan Shah Lubana Jayanti",
    type: "RESTRICTED",
    month: "July",
    monthHindi: "जुलाई"
  },
  {
    id: "HOL-2026-32",
    date: "2026-07-15",
    day: "Wednesday",
    hindiDay: "बुधवार",
    name: "कवि बाजे भगत जयंती",
    englishName: "Kavi Baje Bhagat Jayanti",
    type: "RESTRICTED",
    month: "July",
    monthHindi: "जुलाई"
  },
  {
    id: "HOL-2026-33",
    date: "2026-07-27",
    day: "Monday",
    hindiDay: "सोमवार",
    name: "महाराजा दक्ष प्रजापति जयंती",
    englishName: "Maharaja Daksh Prajapati Jayanti",
    type: "RESTRICTED",
    month: "July",
    monthHindi: "जुलाई"
  },
  {
    id: "HOL-2026-34",
    date: "2026-07-31",
    day: "Friday",
    hindiDay: "शुक्रवार",
    name: "शहीद उधम सिंह शहीदी दिवस",
    englishName: "Shaheed Udham Singh Martyrdom Day",
    type: "GAZETTED",
    month: "July",
    monthHindi: "जुलाई"
  },

  // --- AUGUST ---
  {
    id: "HOL-2026-35",
    date: "2026-08-15",
    day: "Saturday",
    hindiDay: "शनिवार",
    name: "स्वतंत्रता दिवस / हरियाली तीज",
    englishName: "Independence Day / Hariyali Teej",
    type: "GAZETTED",
    month: "August",
    monthHindi: "अगस्त"
  },
  {
    id: "HOL-2026-36",
    date: "2026-08-26",
    day: "Wednesday",
    hindiDay: "बुधवार",
    name: "मिलाद-उन-नबी / ईद-ए-मिलाद",
    englishName: "Milad-un-Nabi / Id-e-Milad",
    type: "GAZETTED",
    month: "August",
    monthHindi: "अगस्त"
  },
  {
    id: "HOL-2026-37",
    date: "2026-08-26",
    day: "Wednesday",
    hindiDay: "बुधवार",
    name: "श्री गुरु जम्भेश्वर जी जयंती",
    englishName: "Shri Guru Jambheshwar Ji Jayanti",
    type: "RESTRICTED",
    month: "August",
    monthHindi: "अगस्त"
  },
  {
    id: "HOL-2026-38",
    date: "2026-08-28",
    day: "Friday",
    hindiDay: "शुक्रवार",
    name: "रक्षा बंधन",
    englishName: "Raksha Bandhan",
    type: "GAZETTED",
    month: "August",
    monthHindi: "अगस्त"
  },

  // --- SEPTEMBER ---
  {
    id: "HOL-2026-39",
    date: "2026-09-04",
    day: "Friday",
    hindiDay: "शुक्रवार",
    name: "जन्माष्टमी",
    englishName: "Janmashtami",
    type: "GAZETTED",
    month: "September",
    monthHindi: "सितम्बर"
  },
  {
    id: "HOL-2026-40",
    date: "2026-09-13",
    day: "Sunday",
    hindiDay: "रविवार",
    name: "अनंत चतुर्दशी",
    englishName: "Anant Chaturdashi",
    type: "RESTRICTED",
    month: "September",
    monthHindi: "सितम्बर"
  },
  {
    id: "HOL-2026-41",
    date: "2026-09-23",
    day: "Wednesday",
    hindiDay: "बुधवार",
    name: "शहीदी दिवस / हरियाणा वीर एवं शहीदी दिवस",
    englishName: "Haryana Heroes Martyrdom Day",
    type: "GAZETTED",
    month: "September",
    monthHindi: "सितम्बर"
  },

  // --- OCTOBER ---
  {
    id: "HOL-2026-42",
    date: "2026-10-02",
    day: "Friday",
    hindiDay: "शुक्रवार",
    name: "महात्मा गांधी जयंती",
    englishName: "Mahatma Gandhi Jayanti",
    type: "GAZETTED",
    month: "October",
    monthHindi: "अक्टूबर"
  },
  {
    id: "HOL-2026-43",
    date: "2026-10-06",
    day: "Tuesday",
    hindiDay: "मंगलवार",
    name: "महाराजा अग्रसेन जयंती",
    englishName: "Maharaja Agrasen Jayanti",
    type: "RESTRICTED",
    month: "October",
    monthHindi: "अक्टूबर"
  },
  {
    id: "HOL-2026-44",
    date: "2026-10-20",
    day: "Tuesday",
    hindiDay: "मंगलवार",
    name: "दशहरा",
    englishName: "Dussehra",
    type: "GAZETTED",
    month: "October",
    monthHindi: "अक्टूबर"
  },
  {
    id: "HOL-2026-45",
    date: "2026-10-26",
    day: "Monday",
    hindiDay: "सोमवार",
    name: "महर्षि वाल्मीकि जयंती",
    englishName: "Maharishi Valmiki Jayanti",
    type: "GAZETTED",
    month: "October",
    monthHindi: "अक्टूबर"
  },
  {
    id: "HOL-2026-46",
    date: "2026-10-29",
    day: "Thursday",
    hindiDay: "गुरुवार",
    name: "करवाचौथ",
    englishName: "Karva Chauth",
    type: "GAZETTED",
    month: "October",
    monthHindi: "अक्टूबर"
  },
  {
    id: "HOL-2026-47",
    date: "2026-10-31",
    day: "Saturday",
    hindiDay: "शनिवार",
    name: "सरदार वल्लभभाई पटेल जयंती",
    englishName: "Sardar Vallabhbhai Patel Jayanti",
    type: "RESTRICTED",
    month: "October",
    monthHindi: "अक्टूबर"
  },

  // --- NOVEMBER ---
  {
    id: "HOL-2026-48",
    date: "2026-11-01",
    day: "Sunday",
    hindiDay: "रविवार",
    name: "हरियाणा दिवस",
    englishName: "Haryana Day",
    type: "GAZETTED",
    month: "November",
    monthHindi: "नवम्बर"
  },
  {
    id: "HOL-2026-49",
    date: "2026-11-08",
    day: "Sunday",
    hindiDay: "रविवार",
    name: "दीपावली",
    englishName: "Diwali",
    type: "GAZETTED",
    month: "November",
    monthHindi: "नवम्बर"
  },
  {
    id: "HOL-2026-50",
    date: "2026-11-09",
    day: "Monday",
    hindiDay: "सोमवार",
    name: "विश्वकर्मा दिवस / गोवर्धन पूजा",
    englishName: "Vishwakarma Day / Govardhan Puja",
    type: "GAZETTED",
    month: "November",
    monthHindi: "नवम्बर"
  },
  {
    id: "HOL-2026-51",
    date: "2026-11-15",
    day: "Sunday",
    hindiDay: "रविवार",
    name: "छठ पूजा",
    englishName: "Chhath Puja",
    type: "GAZETTED",
    month: "November",
    monthHindi: "नवम्बर"
  },
  {
    id: "HOL-2026-52",
    date: "2026-11-15",
    day: "Sunday",
    hindiDay: "रविवार",
    name: "संत नामदेव जयंती",
    englishName: "Sant Namdev Jayanti",
    type: "RESTRICTED",
    month: "November",
    monthHindi: "नवम्बर"
  },
  {
    id: "HOL-2026-53",
    date: "2026-11-22",
    day: "Sunday",
    hindiDay: "रविवार",
    name: "वीरांगना झलकारी बाई जयंती",
    englishName: "Veerangana Jhalkari Bai Jayanti",
    type: "RESTRICTED",
    month: "November",
    monthHindi: "नवम्बर"
  },
  {
    id: "HOL-2026-54",
    date: "2026-11-25",
    day: "Wednesday",
    hindiDay: "बुधवार",
    name: "गुरु नानक देव जयंती",
    englishName: "Guru Nanak Dev Jayanti",
    type: "GAZETTED",
    month: "November",
    monthHindi: "नवम्बर"
  },

  // --- DECEMBER ---
  {
    id: "HOL-2026-55",
    date: "2026-12-04",
    day: "Friday",
    hindiDay: "शुक्रवार",
    name: "संत शिरोमणि रविदास जयंती / संत सेन महाराज जयंती",
    englishName: "Sant Shiromani Ravidas Jayanti / Sant Sen Maharaj Jayanti",
    type: "RESTRICTED",
    month: "December",
    monthHindi: "दिसम्बर"
  },
  {
    id: "HOL-2026-56",
    date: "2026-12-14",
    day: "Monday",
    hindiDay: "सोमवार",
    name: "गुरु तेग बहादुर शहीदी दिवस",
    englishName: "Guru Tegh Bahadur Martyrdom Day",
    type: "GAZETTED",
    month: "December",
    monthHindi: "दिसम्बर"
  },
  {
    id: "HOL-2026-57",
    date: "2026-12-20",
    day: "Sunday",
    hindiDay: "रविवार",
    name: "महाराजा शूरसैनी जयंती",
    englishName: "Maharaja Shoorsaini Jayanti",
    type: "RESTRICTED",
    month: "December",
    monthHindi: "दिसम्बर"
  },
  {
    id: "HOL-2026-58",
    date: "2026-12-24",
    day: "Thursday",
    hindiDay: "गुरुवार",
    name: "गुरु ब्रह्मानंद जयंती",
    englishName: "Guru Brahmanand Jayanti",
    type: "GAZETTED",
    month: "December",
    monthHindi: "दिसम्बर"
  },
  {
    id: "HOL-2026-59",
    date: "2026-12-25",
    day: "Friday",
    hindiDay: "शुक्रवार",
    name: "क्रिसमस दिवस",
    englishName: "Christmas Day",
    type: "GAZETTED",
    month: "December",
    monthHindi: "दिसम्बर"
  },
  {
    id: "HOL-2026-60",
    date: "2026-12-26",
    day: "Saturday",
    hindiDay: "शनिवार",
    name: "शहीद उधम सिंह जयंती",
    englishName: "Shaheed Udham Singh Jayanti",
    type: "GAZETTED",
    month: "December",
    monthHindi: "दिसम्बर"
  }
];

