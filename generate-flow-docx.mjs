import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, HeadingLevel,
  TableLayoutType, VerticalAlign, convertInchesToTwip,
} from "docx";
import fs from "fs";

// ── Helpers ──────────────────────────────────────────────────────────
const GOLD = "C9A84C";
const NAVY = "1E3A5F";
const GREEN = "15803D";
const DARK_GREEN = "14532D";
const ORANGE = "B45309";
const DARK_ORANGE = "78350F";
const RED = "991B1B";
const DARK_RED = "7F1D1D";
const BLUE = "1E40AF";
const PURPLE = "4338CA";
const TEAL = "0F766E";
const GRAY = "1E293B";
const WHITE = "FFFFFF";
const LIGHT = "E2E8F0";

function spacer(size = 200) {
  return new Paragraph({ spacing: { after: size } });
}

function centeredTitle(text, size = 32, color = GOLD, bold = true) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text, bold, size, color, font: "Calibri" })],
  });
}

function centeredText(text, size = 20, color = LIGHT) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text, size, color, font: "Calibri" })],
  });
}

function connectorLine() {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text: "│", size: 28, color: "64748B", font: "Consolas" })],
  });
}

function connectorTriple() {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text: "┌──────────────────────┼──────────────────────┐", size: 18, color: "64748B", font: "Consolas" })],
  });
}

function connectorQuad() {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text: "┌─────────────┬───────────┼───────────┬─────────────┐", size: 16, color: "64748B", font: "Consolas" })],
  });
}

function connectorDouble() {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text: "┌──────────────────────┴──────────────────────┐", size: 18, color: "64748B", font: "Consolas" })],
  });
}

// Box in a table cell
function makeBoxCell(title, desc, bgColor, textColor = WHITE, width = 2400) {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.SOLID, color: bgColor },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: textColor === WHITE ? "64748B" : bgColor },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: textColor === WHITE ? "64748B" : bgColor },
      left: { style: BorderStyle.SINGLE, size: 1, color: textColor === WHITE ? "64748B" : bgColor },
      right: { style: BorderStyle.SINGLE, size: 1, color: textColor === WHITE ? "64748B" : bgColor },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [new TextRun({ text: title, bold: true, size: 20, color: textColor, font: "Calibri" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: desc, size: 16, color: textColor, font: "Calibri", italics: true })],
      }),
    ],
  });
}

function emptyCell(width = 200) {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
    children: [new Paragraph("")],
  });
}

function makeRow(cells) {
  return new Table({
    layout: TableLayoutType.FIXED,
    alignment: AlignmentType.CENTER,
    rows: [new TableRow({ children: cells })],
    borders: {
      top: { style: BorderStyle.NONE, size: 0 },
      bottom: { style: BorderStyle.NONE, size: 0 },
      left: { style: BorderStyle.NONE, size: 0 },
      right: { style: BorderStyle.NONE, size: 0 },
      insideHorizontal: { style: BorderStyle.NONE, size: 0 },
      insideVertical: { style: BorderStyle.NONE, size: 0 },
    },
  });
}

// ── Section heading with line ──
function sectionHeading(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 300, after: 150 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "475569" } },
    children: [new TextRun({ text, bold: true, size: 26, color: GOLD, font: "Calibri" })],
  });
}

// ── Indented bullet line ──
function bulletLine(indent, title, desc, titleColor = WHITE) {
  const prefix = "    ".repeat(indent);
  const connector = indent === 0 ? "■" : indent === 1 ? "├── " : "│   ├── ";
  return new Paragraph({
    spacing: { after: 30 },
    children: [
      new TextRun({ text: prefix + connector, size: 18, color: "64748B", font: "Consolas" }),
      new TextRun({ text: title, bold: true, size: 19, color: titleColor, font: "Calibri" }),
      new TextRun({ text: " — " + desc, size: 17, color: "94A3B8", font: "Calibri" }),
    ],
  });
}

function treeLine(indent, title, desc, titleColor = LIGHT) {
  const bars = [];
  for (let i = 0; i < indent; i++) bars.push("│   ");
  const prefix = bars.join("");
  const conn = "├── ";
  return new Paragraph({
    spacing: { after: 20 },
    children: [
      new TextRun({ text: prefix + conn, size: 18, color: "475569", font: "Consolas" }),
      new TextRun({ text: title, bold: true, size: 18, color: titleColor, font: "Calibri" }),
      new TextRun({ text: "  " + desc, size: 16, color: "94A3B8", font: "Calibri", italics: true }),
    ],
  });
}

function treeLastLine(indent, title, desc, titleColor = LIGHT) {
  const bars = [];
  for (let i = 0; i < indent; i++) bars.push("│   ");
  const prefix = bars.join("");
  const conn = "└── ";
  return new Paragraph({
    spacing: { after: 20 },
    children: [
      new TextRun({ text: prefix + conn, size: 18, color: "475569", font: "Consolas" }),
      new TextRun({ text: title, bold: true, size: 18, color: titleColor, font: "Calibri" }),
      new TextRun({ text: "  " + desc, size: 16, color: "94A3B8", font: "Calibri", italics: true }),
    ],
  });
}

// ── Build document ─────────────────────────────────────────────────

const doc = new Document({
  background: { color: "0F1117" },
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 20, color: LIGHT },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 720, bottom: 720, left: 900, right: 900 },
        size: { width: 12240, height: 15840 },
      },
    },
    children: [

      // ════════════ TITLE ════════════
      centeredTitle("BATUAN NATIONAL HIGH SCHOOL", 36, GOLD),
      centeredTitle("SSLG Election System — Program Flow Diagram", 26, LIGHT, false),
      spacer(300),

      // ════════════ LEVEL 0: ROOT ════════════
      sectionHeading("1. System Hierarchy"),
      spacer(100),

      makeRow([
        emptyCell(2800),
        makeBoxCell("Election System", "Web Application (React + Express + MySQL)", NAVY, WHITE, 4000),
        emptyCell(2800),
      ]),
      connectorLine(),
      connectorTriple(),

      // ════════════ LEVEL 1: THREE PORTALS ════════════
      makeRow([
        makeBoxCell("Public Access", "No login needed", GREEN, WHITE, 3000),
        emptyCell(300),
        makeBoxCell("Voter Portal", "Logged-in student", ORANGE, WHITE, 3000),
        emptyCell(300),
        makeBoxCell("Admin Panel", "Administrator only", RED, WHITE, 3000),
      ]),
      spacer(200),

      // ════════════ PUBLIC ACCESS DETAILS ════════════
      sectionHeading("2. Public Access (No Login Required)"),
      spacer(50),
      treeLine(0, "Dashboard (Index.jsx)", "Home page — election info, countdown, stats", GREEN),
      treeLine(0, "Candidates (Candidates.jsx)", "Browse all candidates by position", GREEN),
      treeLine(0, "Results (Results.jsx)", "Live vote tally with filter dropdowns", GREEN),
      treeLastLine(0, "Sign In Page (AuthPage.jsx)", "LRN + Password authentication gate", BLUE),
      spacer(200),

      // ════════════ VOTER PORTAL DETAILS ════════════
      sectionHeading("3. Voter Portal (Logged-in Student)"),
      spacer(50),
      treeLine(0, "Dashboard (Index.jsx)", "Personal home with election status", ORANGE),
      treeLine(0, "Candidates (Candidates.jsx)", "Browse candidates list", ORANGE),
      treeLine(0, "Vote Page (VotePage.jsx)", "Cast ballot interface", ORANGE),
      treeLine(1, "Select candidates per position", "Max votes enforced per position"),
      treeLine(1, "Grade Rep restriction", "Can only vote for own grade level candidates"),
      treeLine(1, "Already voted guard", "Blocks re-voting if has_voted = true"),
      treeLastLine(1, "Submit ballot", "DB transaction → inserts votes → marks has_voted"),
      treeLine(0, "Results (Results.jsx)", "View live results with filters", ORANGE),
      treeLastLine(0, "Change Password (ChangePassword.jsx)", "Required on first login (forced redirect)", BLUE),
      spacer(200),

      // ════════════ ADMIN PANEL DETAILS ════════════
      sectionHeading("4. Admin Panel (Administrator Only)"),
      spacer(50),
      treeLine(0, "Overview Tab", "Dashboard statistics summary", RED),
      treeLine(1, "StatCard — Registered voters", "Total voter count"),
      treeLine(1, "StatCard — Voted count", "How many have voted"),
      treeLine(1, "StatCard — Turnout %", "Percentage calculation"),
      treeLastLine(1, "StatCard — Candidates", "Total candidates registered"),

      spacer(80),
      treeLine(0, "Voters Tab", "Voter account management (CRUD)", RED),
      treeLine(1, "Add Voter form", "LRN (12 digits) + full name + grade + section"),
      treeLine(1, "Search/filter voters", "By LRN, name, or section"),
      treeLine(1, "Edit voter", "Update LRN, name, grade, section"),
      treeLine(1, "Delete voter", "Remove account + cascading delete votes"),
      treeLastLine(1, "Reset password", "Resets to LRN, forces change on next login"),

      spacer(80),
      treeLine(0, "Candidates Tab", "Candidate entry management (CRUD)", RED),
      treeLine(1, "Add Candidate form", "Name, position, grade, section, party, motto, photo"),
      treeLine(1, "Photo upload", "Multer — 5MB max, jpg/png/webp"),
      treeLine(1, "Edit candidate", "Update all fields + replace photo"),
      treeLastLine(1, "Delete candidate", "Remove entry + cascading delete votes"),

      spacer(80),
      treeLine(0, "Settings Tab", "Election configuration and control", RED),
      treeLine(1, "Election Status Control", "Set: Upcoming → Ongoing → Completed"),
      treeLine(1, "Election Schedule", "Set date, voting start time, end time"),
      treeLastLine(1, "Election Info", "Displays school year, date summary"),
      spacer(200),

      // ════════════ AUTHENTICATION FLOW ════════════
      sectionHeading("5. Authentication Flow"),
      spacer(50),
      new Paragraph({
        spacing: { after: 30 },
        children: [new TextRun({ text: "  Step 1  ", bold: true, size: 18, color: NAVY, font: "Calibri", shading: { type: ShadingType.SOLID, color: GOLD } })],
      }),
      treeLine(0, "User enters LRN + Password", "On /auth page (AuthPage.jsx)"),

      new Paragraph({
        spacing: { before: 80, after: 30 },
        children: [new TextRun({ text: "  Step 2  ", bold: true, size: 18, color: NAVY, font: "Calibri", shading: { type: ShadingType.SOLID, color: GOLD } })],
      }),
      treeLine(0, "POST /api/auth/login", "Server verifies LRN exists in users table"),
      treeLine(1, "bcrypt.compare()", "Validates password against hash"),
      treeLastLine(1, "generateToken()", "Creates JWT with 7-day expiry"),

      new Paragraph({
        spacing: { before: 80, after: 30 },
        children: [new TextRun({ text: "  Step 3  ", bold: true, size: 18, color: NAVY, font: "Calibri", shading: { type: ShadingType.SOLID, color: GOLD } })],
      }),
      treeLine(0, "Token stored in localStorage", "auth_token key"),
      treeLastLine(0, "GET /api/auth/me", "Fetches profile, roles, isAdmin flag"),

      new Paragraph({
        spacing: { before: 80, after: 30 },
        children: [new TextRun({ text: "  Step 4  ", bold: true, size: 18, color: NAVY, font: "Calibri", shading: { type: ShadingType.SOLID, color: GOLD } })],
      }),
      treeLine(0, "If must_change_password = true", "Redirect to /change-password"),
      treeLastLine(1, "POST /api/auth/change-password", "Updates hash, clears flag, issues new token"),
      spacer(200),

      // ════════════ VOTING WORKFLOW ════════════
      sectionHeading("6. Voting Workflow"),
      spacer(50),
      new Paragraph({
        spacing: { after: 30 },
        children: [new TextRun({ text: "  Step 1  ", bold: true, size: 18, color: NAVY, font: "Calibri", shading: { type: ShadingType.SOLID, color: GOLD } })],
      }),
      treeLine(0, "Voter navigates to /vote", "VotePage.jsx loads"),
      treeLine(1, "Fetch positions", "GET /api/positions?grade_level=X"),
      treeLine(1, "Fetch candidates", "GET /api/candidates"),
      treeLastLine(1, "Fetch election settings", "GET /api/election-settings"),

      new Paragraph({
        spacing: { before: 80, after: 30 },
        children: [new TextRun({ text: "  Step 2  ", bold: true, size: 18, color: NAVY, font: "Calibri", shading: { type: ShadingType.SOLID, color: GOLD } })],
      }),
      treeLine(0, "Election status check", "Must be 'ongoing' to proceed"),
      treeLastLine(0, "Already voted check", "If has_voted = true, show guard screen"),

      new Paragraph({
        spacing: { before: 80, after: 30 },
        children: [new TextRun({ text: "  Step 3  ", bold: true, size: 18, color: NAVY, font: "Calibri", shading: { type: ShadingType.SOLID, color: GOLD } })],
      }),
      treeLine(0, "Voter selects candidates", "Per position, max_votes enforced"),
      treeLastLine(0, "Grade Rep validation", "Only own grade level candidates allowed"),

      new Paragraph({
        spacing: { before: 80, after: 30 },
        children: [new TextRun({ text: "  Step 4  ", bold: true, size: 18, color: NAVY, font: "Calibri", shading: { type: ShadingType.SOLID, color: GOLD } })],
      }),
      treeLine(0, "POST /api/votes", "Submit ballot to server"),
      treeLine(1, "Server validates", "Auth, admin check, max_votes, grade restrictions"),
      treeLine(1, "BEGIN TRANSACTION", "Atomic database operation"),
      treeLine(1, "INSERT votes", "One row per candidate selected"),
      treeLine(1, "UPDATE profiles", "Set has_voted = 1"),
      treeLastLine(1, "COMMIT", "All or nothing — rollback on error"),
      spacer(200),

      // ════════════ BACKEND SERVICES ════════════
      sectionHeading("7. Backend Services"),
      spacer(50),
      treeLine(0, "Express Server (server.js)", "Port 3001, REST API", TEAL),
      treeLine(1, "CORS middleware", "Cross-origin requests allowed"),
      treeLine(1, "JSON body parser", "express.json()"),
      treeLastLine(1, "Static file serving", "/uploads/ directory for candidate photos"),

      spacer(80),
      treeLine(0, "Auth Middleware (middleware/auth.js)", "JWT-based authentication", BLUE),
      treeLine(1, "generateToken(user)", "jwt.sign() — 7-day expiry"),
      treeLine(1, "requireAuth(req, res, next)", "Verify Bearer token, load user from DB"),
      treeLastLine(1, "requireAdmin(req, res, next)", "Check user_roles for admin role"),

      spacer(80),
      treeLine(0, "Auto-End Scheduler", "Background task, runs every 60 seconds", TEAL),
      treeLastLine(1, "autoEndElections()", "Checks ongoing elections → auto-completes if past end time"),

      spacer(80),
      treeLine(0, "File Upload (Multer)", "Candidate photo handling", PURPLE),
      treeLine(1, "Storage", "Disk storage, UUID filenames"),
      treeLine(1, "Limits", "5MB max file size"),
      treeLastLine(1, "Filter", "Only .jpg, .jpeg, .png, .webp"),
      spacer(200),

      // ════════════ DATABASE ════════════
      sectionHeading("8. Database Schema (MySQL)"),
      spacer(50),
      treeLine(0, "users", "id, lrn, password_hash, full_name, must_change_password", PURPLE),
      treeLine(0, "user_roles", "id, user_id (FK), role (admin/voter)", PURPLE),
      treeLine(0, "profiles", "id, user_id (FK), full_name, grade_level, section, has_voted", PURPLE),
      treeLine(0, "positions", "id, title, display_order, max_votes", PURPLE),
      treeLine(0, "candidates", "id, name, position_id (FK), grade_level, section, party_list, motto, avatar_url", PURPLE),
      treeLine(0, "votes", "id, voter_id (FK), candidate_id (FK), position_id (FK) — unique(voter,candidate)", PURPLE),
      treeLine(0, "election_settings", "id, name, school_year, election_date, voting_start, voting_end, status", PURPLE),
      treeLastLine(0, "vote_counts (VIEW)", "Aggregated view: candidates + positions + vote tallies", PURPLE),
      spacer(200),

      // ════════════ API ROUTES ════════════
      sectionHeading("9. API Route Map"),
      spacer(50),

      treeLine(0, "Auth Routes", "", BLUE),
      treeLine(1, "POST /api/auth/login", "Public — LRN + password authentication"),
      treeLine(1, "POST /api/auth/change-password", "🔒 requireAuth — update password"),
      treeLastLine(1, "GET /api/auth/me", "🔒 requireAuth — get current user profile"),

      spacer(80),
      treeLine(0, "Voter Routes", "(Admin only)", RED),
      treeLine(1, "GET /api/voters", "🔒 Admin — list all voters"),
      treeLine(1, "POST /api/voters", "🔒 Admin — add new voter"),
      treeLine(1, "PUT /api/voters/:id", "🔒 Admin — update voter info"),
      treeLine(1, "DELETE /api/voters/:id", "🔒 Admin — delete voter"),
      treeLastLine(1, "POST /api/voters/:id/reset-password", "🔒 Admin — reset to LRN"),

      spacer(80),
      treeLine(0, "Position Routes", "", GREEN),
      treeLine(1, "GET /api/positions", "Public — list positions (filterable by grade)"),
      treeLine(1, "POST /api/positions", "🔒 Admin — create position"),
      treeLastLine(1, "DELETE /api/positions/:id", "🔒 Admin — delete position"),

      spacer(80),
      treeLine(0, "Candidate Routes", "", GREEN),
      treeLine(1, "GET /api/candidates", "Public — list all candidates"),
      treeLine(1, "POST /api/candidates", "🔒 Admin — add candidate + photo upload"),
      treeLine(1, "PUT /api/candidates/:id", "🔒 Admin — update candidate + photo"),
      treeLastLine(1, "DELETE /api/candidates/:id", "🔒 Admin — delete candidate"),

      spacer(80),
      treeLine(0, "Vote Routes", "", ORANGE),
      treeLine(1, "POST /api/votes", "🔒 requireAuth — submit ballot"),
      treeLine(1, "GET /api/votes/counts", "Public — get vote tallies (filterable)"),
      treeLastLine(1, "GET /api/voters/groups", "Public — get grade levels & sections"),

      spacer(80),
      treeLine(0, "Election & Stats Routes", "", TEAL),
      treeLine(1, "GET /api/election-settings", "Public — get election config"),
      treeLine(1, "PUT /api/election-settings/:id", "🔒 Admin — update settings/status"),
      treeLastLine(1, "GET /api/stats", "Public — voter count, voted, turnout"),
      spacer(200),

      // ════════════ TECH STACK ════════════
      sectionHeading("10. Technology Stack"),
      spacer(50),
      treeLine(0, "Frontend", "React 18 + Vite (SPA)"),
      treeLine(1, "Routing", "React Router v6"),
      treeLine(1, "State Management", "React Context (AuthContext, ElectionContext)"),
      treeLine(1, "Data Fetching", "TanStack React Query"),
      treeLine(1, "Styling", "Tailwind CSS"),
      treeLastLine(1, "Icons", "Lucide React"),

      spacer(80),
      treeLine(0, "Backend", "Node.js + Express"),
      treeLine(1, "Authentication", "JWT (jsonwebtoken) + bcryptjs"),
      treeLine(1, "Database Driver", "mysql2/promise (connection pool)"),
      treeLine(1, "File Upload", "Multer"),
      treeLastLine(1, "IDs", "uuid v4"),

      spacer(80),
      treeLastLine(0, "Database", "MySQL — batuan_voting"),
      spacer(300),

      // ════════════ FOOTER ════════════
      centeredText("─────────────────────────────────────────", 18, "475569"),
      centeredText("© 2026 Batuan National High School — Batuan, Bohol, Philippines", 16, "64748B"),
      centeredText("SSLG Election System — Program Flow Diagram", 16, "64748B"),
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync("program-flow.docx", buffer);
console.log("✅ program-flow.docx created successfully!");
