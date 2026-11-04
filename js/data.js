/**
 * Haryana Cyber Police - Leave Management Portal
 * Central Data Definitions & Default Seed Data
 */

const BRANCHES = [
  { id: "cyber_helpline_1930", name: "Cyber Helpline 1930", hindi: "साइबर हेल्पलाइन 1930", icon: "phone-call" },
  { id: "data_analysis_wing", name: "Data Analysis Wing", hindi: "डेटा एनालिसिस विंग", icon: "bar-chart-2" },
  { id: "social_media", name: "Social Media", hindi: "सोशल मीडिया मॉनिटरिंग", icon: "share-2" },
  { id: "online_crime_women", name: "Online Crime Against Women", hindi: "ऑनलाइन क्राइम अगेंस्ट विमेन", icon: "shield-alert" },
  { id: "cyber_awareness", name: "Cyber Awareness and Content Creation", hindi: "साइबर अवेयरनेस एंड कंटेंट क्रिएशन", icon: "megaphone" },
  { id: "admin_branch", name: "Admin Branch", hindi: "एडमिन ब्रांच", icon: "briefcase" },
  { id: "investigation_support", name: "Investigation Support Team", hindi: "इन्वेस्टिगेशन सपोर्ट टीम", icon: "search" },
  { id: "dark_web_crypto_ai", name: "Dark Web, Crypto Currency & AI Task Force", hindi: "डार्क वेब, क्रिप्टोकरेंसी एवं एआई टास्क फ़ोर्स", icon: "cpu" },
  { id: "cyber_security", name: "Cyber Security", hindi: "साइबर सिक्योरिटी", icon: "lock" },
  { id: "bank_coordination", name: "Coordination with Bank", hindi: "कोऑर्डिनेशन विद बैंक", icon: "landmark" },
  { id: "other_state_coordination", name: "Coordination with Other State", hindi: "कोऑर्डिनेशन विद अदर स्टेट्स", icon: "map-pin" },
  { id: "ncrp_portal_nodal", name: "NCRP Portal Nodal", hindi: "NCRP पोर्टल नोडल", icon: "globe" },
  { id: "cyber_ps_panchkula", name: "Cyber Police Station Panchkula", hindi: "साइबर पुलिस स्टेशन पंचकूला", icon: "shield" }
];

const LEAVE_TYPES = [
  { code: "CL", name: "Casual Leave", hindi: "आकस्मिक अवकाश", annualQuota: 20, desc: "Standard casual leave for urgent personal matters" },
  { code: "EL", name: "Earned Leave", hindi: "अर्जित अवकाश", annualQuota: 30, desc: "Accumulated privilege leave" },
  { code: "ML", name: "Medical Leave", hindi: "चिकित्सा अवकाश", annualQuota: 20, desc: "Leave on medical grounds (certificate required)" },
  { code: "PL", name: "Paternity Leave", hindi: "पितृत्व अवकाश", annualQuota: 15, desc: "For male personnel on childbirth" },
  { code: "CCL", name: "Child Care Leave", hindi: "बाल देखभाल अवकाश", annualQuota: 30, desc: "Care of minor child (female personnel)" },
  { code: "C-OFF", name: "Compensatory Off", hindi: "क्षतिपूर्ति अवकाश", annualQuota: 10, desc: "Against extra weekend/night cyber duty" },
  { code: "HPL", name: "Half Pay Leave", hindi: "अर्ध वेतन अवकाश", annualQuota: 20, desc: "Half pay leave on private/medical certificate" },
  { code: "RH", name: "Restricted Holiday", hindi: "प्रतिबंधित अवकाश", annualQuota: 2, desc: "Selected gazetted optional holidays" }
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
    leaveBalances: { CL: 18, EL: 28, ML: 20, PL: 15, CCL: 0, "C-OFF": 5, HPL: 20, RH: 2 }
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
    leaveBalances: { CL: 14, EL: 26, ML: 20, PL: 15, CCL: 0, "C-OFF": 6, HPL: 20, RH: 1 }
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
    leaveBalances: { CL: 12, EL: 22, ML: 18, PL: 0, CCL: 28, "C-OFF": 4, HPL: 20, RH: 2 }
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
    leaveBalances: { CL: 15, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 3, HPL: 20, RH: 1 }
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
    leaveBalances: { CL: 11, EL: 25, ML: 20, PL: 0, CCL: 25, "C-OFF": 4, HPL: 20, RH: 2 }
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
    leaveBalances: { CL: 16, EL: 28, ML: 20, PL: 15, CCL: 0, "C-OFF": 5, HPL: 20, RH: 2 }
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
    leaveBalances: { CL: 13, EL: 27, ML: 20, PL: 15, CCL: 0, "C-OFF": 2, HPL: 20, RH: 1 }
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
    leaveBalances: { CL: 10, EL: 24, ML: 19, PL: 15, CCL: 0, "C-OFF": 8, HPL: 20, RH: 2 }
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
    leaveBalances: { CL: 15, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 7, HPL: 20, RH: 2 }
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
    leaveBalances: { CL: 14, EL: 28, ML: 20, PL: 15, CCL: 0, "C-OFF": 6, HPL: 20, RH: 1 }
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
    leaveBalances: { CL: 12, EL: 26, ML: 20, PL: 15, CCL: 0, "C-OFF": 4, HPL: 20, RH: 2 }
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
    leaveBalances: { CL: 16, EL: 29, ML: 20, PL: 15, CCL: 0, "C-OFF": 3, HPL: 20, RH: 2 }
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
    leaveBalances: { CL: 11, EL: 23, ML: 20, PL: 0, CCL: 26, "C-OFF": 5, HPL: 20, RH: 1 }
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
    leaveBalances: { CL: 10, EL: 20, ML: 19, PL: 15, CCL: 0, "C-OFF": 9, HPL: 20, RH: 2 }
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
    leaveBalances: { CL: 12, EL: 28, ML: 18, PL: 15, CCL: 0, "C-OFF": 3, HPL: 20, RH: 2 }
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
    leaveBalances: { CL: 8, EL: 22, ML: 20, PL: 15, CCL: 0, "C-OFF": 2, HPL: 20, RH: 1 }
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
    leaveBalances: { CL: 15, EL: 29, ML: 20, PL: 0, CCL: 30, "C-OFF": 4, HPL: 20, RH: 2 }
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
    leaveBalances: { CL: 10, EL: 24, ML: 16, PL: 15, CCL: 0, "C-OFF": 5, HPL: 20, RH: 1 }
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
    leaveBalances: { CL: 14, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 6, HPL: 20, RH: 2 }
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
    leaveBalances: { CL: 9, EL: 25, ML: 20, PL: 0, CCL: 22, "C-OFF": 3, HPL: 20, RH: 2 }
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
    leaveBalances: { CL: 11, EL: 27, ML: 19, PL: 15, CCL: 0, "C-OFF": 4, HPL: 20, RH: 1 }
  }
];

const DEFAULT_LEAVES = [
  {
    id: "LV-2026-001",
    sanctionNo: "CYB/PKL/LEAVE/2026/0142",
    applicantId: "CYB-101",
    applicantName: "CT Rahul Deswal",
    beltNo: "1420/PKL",
    rank: "Constable (CT)",
    branchId: "cyber_helpline_1930",
    branchName: "Cyber Helpline 1930",
    leaveType: "CL",
    leaveTypeName: "Casual Leave (आकस्मिक अवकाश)",
    fromDate: "2026-11-05",
    toDate: "2026-11-07",
    totalDays: 3,
    reason: "Urgent family property registration at native village (Rohtak)",
    stationLeave: true,
    stationLeaveAddress: "VPO Sampla, District Rohtak (Haryana) - Ph: 9812155678",
    handoverTo: "HC Sandeep Kumar (Belt No. 1655/PKL)",
    emergencyContact: "+91 98121 55678",
    status: "PENDING_INCHARGE", // Awaiting Branch Incharge recommendation
    appliedAt: "2026-11-02 08:30 AM",
    inchargeRemarks: "",
    inchargeActionAt: "",
    spRemarks: "",
    spActionAt: ""
  },
  {
    id: "LV-2026-002",
    sanctionNo: "CYB/PKL/LEAVE/2026/0141",
    applicantId: "CYB-103",
    applicantName: "CT Neha Saini",
    beltNo: "1892/PKL",
    rank: "Constable (CT)",
    branchId: "data_analysis_wing",
    branchName: "Data Analysis Wing",
    leaveType: "EL",
    leaveTypeName: "Earned Leave (अर्जित अवकाश)",
    fromDate: "2026-11-10",
    toDate: "2026-11-15",
    totalDays: 6,
    reason: "Brother's marriage ceremony at Karnal",
    stationLeave: true,
    stationLeaveAddress: "House No 42, Model Town, Karnal (Haryana)",
    handoverTo: "SI Pooja Sharma (Incharge DAW)",
    emergencyContact: "+91 98129 11223",
    status: "RECOMMENDED", // Recommended by Incharge, awaiting SP Cyber Approval
    appliedAt: "2026-11-01 10:15 AM",
    inchargeRemarks: "Recommended. Suitable staff arrangement made in Data Analysis shift.",
    inchargeActionAt: "2026-11-01 02:30 PM",
    spRemarks: "",
    spActionAt: "",
    attachment: {
      name: "Marriage_Invitation_Card_Karnal.pdf",
      size: "245.8 KB",
      type: "application/pdf"
    },
    originalDays: 6,
    originalToDate: "2026-11-15",
    curtailedBy: "",
    curtailReason: ""
  },
  {
    id: "LV-2026-003",
    sanctionNo: "CYB/PKL/LEAVE/2026/0138",
    applicantId: "CYB-104",
    applicantName: "ASI Surender Singh",
    beltNo: "1140/PKL",
    rank: "Assistant Sub-Inspector (ASI)",
    branchId: "dark_web_crypto_ai",
    branchName: "Dark Web, Crypto Currency & AI Task Force",
    leaveType: "ML",
    leaveTypeName: "Medical Leave (चिकित्सा अवकाश)",
    fromDate: "2026-10-25",
    toDate: "2026-10-29",
    totalDays: 5,
    reason: "Severe viral fever & typhoid treatment prescribed by Civil Hospital Panchkula",
    stationLeave: false,
    stationLeaveAddress: "Police Lines Panchkula Qtr No. B-12",
    handoverTo: "Insp. Ankit Verma",
    emergencyContact: "+91 94678 33445",
    status: "APPROVED", // Fully sanctioned by SP Cyber
    appliedAt: "2026-10-24 09:00 AM",
    inchargeRemarks: "Recommended. Medical certificate attached.",
    inchargeActionAt: "2026-10-24 11:30 AM",
    spRemarks: "Sanctioned on medical grounds with station permission.",
    spActionAt: "2026-10-24 03:45 PM",
    attachment: {
      name: "Civil_Hospital_Panchkula_Medical_Fitness_Cert.pdf",
      size: "412.3 KB",
      type: "application/pdf"
    },
    originalDays: 5,
    originalToDate: "2026-10-29",
    curtailedBy: "",
    curtailReason: ""
  },
  {
    id: "LV-2026-004",
    sanctionNo: "CYB/PKL/LEAVE/2026/0135",
    applicantId: "CYB-105",
    applicantName: "CT Deepak Punia",
    beltNo: "2104/PKL",
    rank: "Constable (CT)",
    branchId: "cyber_ps_panchkula",
    branchName: "Cyber Police Station Panchkula",
    leaveType: "CL",
    leaveTypeName: "Casual Leave (आकस्मिक अवकाश)",
    fromDate: "2026-10-20",
    toDate: "2026-10-21",
    totalDays: 2,
    reason: "Personal domestic work",
    stationLeave: false,
    stationLeaveAddress: "Local Panchkula",
    handoverTo: "HC Sandeep",
    emergencyContact: "+91 98135 66778",
    status: "REJECTED",
    appliedAt: "2026-10-19 11:00 AM",
    inchargeRemarks: "Rejected due to VVIP cyber security bandobast in Panchkula on 20th Oct.",
    inchargeActionAt: "2026-10-19 12:45 PM",
    spRemarks: "",
    spActionAt: "",
    attachment: null,
    originalDays: 2,
    originalToDate: "2026-10-21",
    curtailedBy: "",
    curtailReason: ""
  }
];
