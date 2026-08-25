import os
import sys
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FIGURES_DIR = os.path.join(BASE_DIR, "figures")

OUTPUT_PATHS = [
    os.path.join(os.path.dirname(BASE_DIR), "Batuan_Voting_System_Flowcharts_Master.docx"),
    os.path.join(BASE_DIR, "Batuan_Voting_System_Flowcharts.docx"),
    r"C:\Users\johnley\Downloads\Batuan_Voting_System_Flowcharts.docx",
    r"C:\Users\johnley\Downloads\Batuan_Voting_System_Flowcharts_Master.docx",
    os.path.join(os.path.dirname(BASE_DIR), "Batuan_Voting_System_Flowcharts.docx"),
]

def set_cell_background(cell, fill_hex):
    """Set background color of a table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    """Set cell margins in twips."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def set_table_borders(table, color="D3D3D3"):
    """Set light borders on table."""
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="{color}"/>'
        f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="{color}"/>'
        f'<w:insideV w:val="none"/>'
        f'<w:left w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def build_flowchart_document():
    doc = Document()
    
    # Page setup - Normal margins (1 inch / 0.8 inch)
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.85)
        section.right_margin = Inches(0.85)
        section.page_width = Inches(8.5)
        section.page_height = Inches(11.0)
    
    # Define primary palette
    PRIMARY_COLOR = RGBColor(16, 44, 87)       # Deep Navy
    SECONDARY_COLOR = RGBColor(41, 128, 185)   # Tech Blue
    TEXT_DARK = RGBColor(33, 37, 41)           # Charcoal
    TEXT_MUTED = RGBColor(108, 117, 125)       # Gray
    
    # ─────────────────────────────────────────────────────────────────
    # TITLE & HEADER BLOCK
    # ─────────────────────────────────────────────────────────────────
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_p.paragraph_format.space_after = Pt(2)
    title_p.paragraph_format.space_before = Pt(10)
    run_inst = title_p.add_run("BATUAN NATIONAL HIGH SCHOOL\n")
    run_inst.font.name = "Arial"
    run_inst.font.size = Pt(13)
    run_inst.font.bold = True
    run_inst.font.color.rgb = SECONDARY_COLOR
    
    run_sys = title_p.add_run("SUPREME SECONDARY LEARNER GOVERNMENT (SSLG)\nAUTOMATED VOTING & MANAGEMENT SYSTEM\n")
    run_sys.font.name = "Arial"
    run_sys.font.size = Pt(17)
    run_sys.font.bold = True
    run_sys.font.color.rgb = PRIMARY_COLOR
    
    run_sub = title_p.add_run("Comprehensive System Architecture & Flowchart Documentation")
    run_sub.font.name = "Arial"
    run_sub.font.size = Pt(12)
    run_sub.font.italic = True
    run_sub.font.color.rgb = TEXT_MUTED

    # Metadata Table
    meta_table = doc.add_table(rows=4, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_table.autofit = False
    set_table_borders(meta_table, "CCCCCC")
    
    meta_data = [
        ("System Name:", "Batuan National High School — SSLG Voting System (batuan-voting)"),
        ("Architecture:", "React 18 (Vite SPA) + Node.js Express REST API + MySQL / Supabase"),
        ("Target Roles:", "Student Voters (Grades 7–12), SSLG Commission on Elections, System Administrators"),
        ("Document Version:", "Version 1.0 (Official Specification & Customizable Thesis Appendix)")
    ]
    
    for row_idx, (k, v) in enumerate(meta_data):
        row = meta_table.rows[row_idx]
        cell_k, cell_v = row.cells[0], row.cells[1]
        cell_k.width = Inches(1.8)
        cell_v.width = Inches(4.9)
        set_cell_margins(cell_k, top=60, bottom=60, left=100, right=100)
        set_cell_margins(cell_v, top=60, bottom=60, left=100, right=100)
        set_cell_background(cell_k, "F4F6F9")
        
        p_k = cell_k.paragraphs[0]
        p_k.paragraph_format.space_after = Pt(2)
        r_k = p_k.add_run(k)
        r_k.font.name = "Arial"
        r_k.font.size = Pt(9.5)
        r_k.font.bold = True
        r_k.font.color.rgb = PRIMARY_COLOR
        
        p_v = cell_v.paragraphs[0]
        p_v.paragraph_format.space_after = Pt(2)
        r_v = p_v.add_run(v)
        r_v.font.name = "Arial"
        r_v.font.size = Pt(9.5)
        r_v.font.color.rgb = TEXT_DARK

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # ─────────────────────────────────────────────────────────────────
    # SECTION 1: SYSTEM OVERVIEW & FLOWCHART SPECIFICATION
    # ─────────────────────────────────────────────────────────────────
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)
    r1 = h1.add_run("1. System Overview and Flowchart Architecture")
    r1.font.name = "Arial"
    r1.font.size = Pt(14)
    r1.font.bold = True
    r1.font.color.rgb = PRIMARY_COLOR

    p_intro = doc.add_paragraph()
    p_intro.paragraph_format.space_after = Pt(6)
    p_intro.paragraph_format.line_spacing = 1.15
    p_intro.add_run(
        "The Batuan National High School SSLG Voting System is an automated web-based election and voter governance platform. "
        "The system provides complete end-to-end election workflows including voter credential management, candidate profiling, "
        "secure real-time ballot casting with atomic transaction safeguards, grade-level representation filtering, "
        "live tally broadcasting via WebSockets, official tally sheet generation, and past election archiving.\n\n"
        "This document presents the complete system flowcharts structured in full accordance with the academic reference standard "
        "(matching the layout and decomposed off-page connector architecture of CargoExpressFlowchart.docx). "
        "Each figure is accompanied by an in-depth breakdown of user decisions, state transitions, validation trappings, "
        "and database mutations."
    )

    # ─────────────────────────────────────────────────────────────────
    # SECTION 2: FLOWCHART SYMBOL KEY
    # ─────────────────────────────────────────────────────────────────
    h2 = doc.add_heading(level=1)
    h2.paragraph_format.space_before = Pt(14)
    h2.paragraph_format.space_after = Pt(6)
    r2 = h2.add_run("2. Flowchart Conventions and Symbol Key")
    r2.font.name = "Arial"
    r2.font.size = Pt(14)
    r2.font.bold = True
    r2.font.color.rgb = PRIMARY_COLOR

    sym_table = doc.add_table(rows=6, cols=3)
    sym_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(sym_table, "B0C4DE")
    
    headers = ["Flowchart Shape", "ANSI / ISO Name", "Functional Role in Batuan Voting System"]
    hdr_row = sym_table.rows[0]
    for c_idx, h_text in enumerate(headers):
        cell = hdr_row.cells[c_idx]
        set_cell_background(cell, "102C57")
        set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h_text)
        r.font.name = "Arial"
        r.font.size = Pt(9.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    sym_rows = [
        ("Oval / Stadium", "Terminal Node", "Represents the absolute system entry (START) and session termination (END)."),
        ("Parallelogram", "Input / Output / Choices", "Represents user interface menu choices, form input data (e.g. LRN, Password, Candidate forms), and filters."),
        ("Diamond", "Decision Gate", "Evaluates boolean conditions (e.g. valid credentials, role=='admin', must_change_password, election ongoing, has_voted)."),
        ("Rectangle", "Process / Action", "Represents internal calculations, password hashing, SQL database transactions, CSV parsing, and state updates."),
        ("Rounded Bullet", "Display Output", "Represents user-facing rendered UI screens, toast alerts, statistical summaries, charts, and print dialogs."),
    ]
    
    for r_idx, (shape, name, desc) in enumerate(sym_rows, start=1):
        row = sym_table.rows[r_idx]
        row.cells[0].width = Inches(1.5)
        row.cells[1].width = Inches(1.5)
        row.cells[2].width = Inches(3.7)
        if r_idx % 2 == 1:
            set_cell_background(row.cells[0], "F8FAFC")
            set_cell_background(row.cells[1], "F8FAFC")
            set_cell_background(row.cells[2], "F8FAFC")
        for c_idx, val in enumerate([shape, name, desc]):
            cell = row.cells[c_idx]
            set_cell_margins(cell, top=70, bottom=70, left=100, right=100)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(1)
            r = p.add_run(val)
            r.font.name = "Arial"
            r.font.size = Pt(9)
            if c_idx < 2:
                r.font.bold = True
                r.font.color.rgb = PRIMARY_COLOR
            else:
                r.font.color.rgb = TEXT_DARK

    doc.add_page_break()

    # ─────────────────────────────────────────────────────────────────
    # FIGURE 2: LANDING PAGE & AUTHENTICATION FLOWCHART
    # ─────────────────────────────────────────────────────────────────
    h_f2 = doc.add_heading(level=1)
    r_f2 = h_f2.add_run("3. Public Landing Page and Authentication Module")
    r_f2.font.name = "Arial"
    r_f2.font.size = Pt(14)
    r_f2.font.bold = True
    r_f2.font.color.rgb = PRIMARY_COLOR

    img_f2_path = os.path.join(FIGURES_DIR, "figure2_landing_page.png")
    if os.path.exists(img_f2_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(4)
        run = p_img.add_run()
        run.add_picture(img_f2_path, width=Inches(6.6))

    p_cap2 = doc.add_paragraph()
    p_cap2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap2.paragraph_format.space_after = Pt(12)
    r_cap2 = p_cap2.add_run("Figure 2. Landing Page & Authentication Flowchart")
    r_cap2.font.name = "Arial"
    r_cap2.font.size = Pt(10.5)
    r_cap2.font.bold = True
    r_cap2.font.color.rgb = PRIMARY_COLOR

    p_desc2 = doc.add_paragraph()
    p_desc2.paragraph_format.line_spacing = 1.15
    p_desc2.paragraph_format.space_after = Pt(6)
    p_desc2.add_run(
        "Figure 2 illustrates the entry gateway and public navigation for the Batuan Voting System. "
        "Upon loading the system at the root URL (/), users are presented with four primary choices (A through D):\n"
    )

    f2_steps = [
        ("Choice A (Overview / Home): ", "Displays the election hero banner, countdown timer, real-time voter turnout percentage, total registered voters, and the top 5 leading candidates leaderboard."),
        ("Choice B (View Candidates): ", "Provides a public candidate directory where students can search candidates by full name or party list, and filter by position."),
        ("Choice C (Live Results): ", "Renders the live election analytics tab with position, voter grade level, and section drilldowns, as well as archived past elections."),
        ("Choice D (Sign In Gate): ", "Accepts 12-digit Learner Reference Number (LRN) and password credentials. Submits to POST /api/auth/login.")
    ]
    for bold_prefix, text in f2_steps:
        p_item = doc.add_paragraph(style='List Bullet')
        p_item.paragraph_format.space_after = Pt(3)
        r_b = p_item.add_run(bold_prefix)
        r_b.font.name = "Arial"
        r_b.font.size = Pt(9.5)
        r_b.font.bold = True
        r_t = p_item.add_run(text)
        r_t.font.name = "Arial"
        r_t.font.size = Pt(9.5)

    p_f2_auth = doc.add_paragraph()
    p_f2_auth.paragraph_format.space_before = Pt(6)
    p_f2_auth.paragraph_format.space_after = Pt(12)
    p_f2_auth.paragraph_format.line_spacing = 1.15
    p_f2_auth.add_run(
        "Authentication Logic Trapping:\n"
        "1. Credentials Validation: If credentials are invalid, an error toast is rendered and user loops back.\n"
        "2. Role Check: If user role is 'admin', user is immediately routed to the Admin Dashboard (Connector 4).\n"
        "3. Forced Password Change Check: If user is a student voter with must_change_password == true (e.g. newly imported voter whose default password equals their LRN), "
        "the system intercepts the session and forces a redirect to /change-password. Once a valid password (minimum 6 characters) is set, the flag is cleared and the voter enters the Student Voter Dashboard."
    )

    doc.add_page_break()

    # ─────────────────────────────────────────────────────────────────
    # FIGURE 3: STUDENT VOTER DASHBOARD FLOWCHART
    # ─────────────────────────────────────────────────────────────────
    h_f3 = doc.add_heading(level=1)
    r_f3 = h_f3.add_run("4. Student Voter Portal and Ballot Casting Module")
    r_f3.font.name = "Arial"
    r_f3.font.size = Pt(14)
    r_f3.font.bold = True
    r_f3.font.color.rgb = PRIMARY_COLOR

    img_f3_path = os.path.join(FIGURES_DIR, "figure3_voter_dashboard.png")
    if os.path.exists(img_f3_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(4)
        run = p_img.add_run()
        run.add_picture(img_f3_path, width=Inches(6.6))

    p_cap3 = doc.add_paragraph()
    p_cap3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap3.paragraph_format.space_after = Pt(12)
    r_cap3 = p_cap3.add_run("Figure 3. Student Voter Dashboard Flowchart")
    r_cap3.font.name = "Arial"
    r_cap3.font.size = Pt(10.5)
    r_cap3.font.bold = True
    r_cap3.font.color.rgb = PRIMARY_COLOR

    p_desc3 = doc.add_paragraph()
    p_desc3.paragraph_format.line_spacing = 1.15
    p_desc3.paragraph_format.space_after = Pt(6)
    p_desc3.add_run(
        "Figure 3 details the student voter's journey from landing on their dashboard to casting an immutable electronic ballot. "
        "The Voter Dashboard exposes choices 1 through 5:\n"
    )

    f3_steps = [
        ("Choice 1 (Dashboard): ", "Displays personalized voting status badge ('Voted' or 'Not Yet Voted') and election status countdown."),
        ("Choice 2 (Candidates Directory): ", "Allows exploring candidate platforms, party affiliations, and mottos."),
        ("Choice 3 (Cast Vote /vote): ", "Initiates the ballot casting engine with rigorous pre-conditions and validation."),
        ("Choice 4 (Live Results): ", "Provides voter access to real-time election statistics."),
        ("Choice 5 (Account Settings): ", "Sub-menu containing Choice 5.1 (Change Password) and Choice 5.2 (Sign Out with session invalidation).")
    ]
    for bold_prefix, text in f3_steps:
        p_item = doc.add_paragraph(style='List Bullet')
        p_item.paragraph_format.space_after = Pt(3)
        r_b = p_item.add_run(bold_prefix)
        r_b.font.name = "Arial"
        r_b.font.size = Pt(9.5)
        r_b.font.bold = True
        r_t = p_item.add_run(text)
        r_t.font.name = "Arial"
        r_t.font.size = Pt(9.5)

    p_f3_ballot = doc.add_paragraph()
    p_f3_ballot.paragraph_format.space_before = Pt(6)
    p_f3_ballot.paragraph_format.space_after = Pt(12)
    p_f3_ballot.paragraph_format.line_spacing = 1.15
    p_f3_ballot.add_run(
        "Detailed Ballot Casting Validation Trappings (Choice 3):\n"
        "• Election State Guard: Verifies that election_status == 'ongoing'. If 'upcoming' or 'completed', casting is blocked.\n"
        "• Duplicate Vote Prevention: Checks if voter profile has_voted == true. If already voted, a security guard screen blocks further submission.\n"
        "• Grade Representative Constraint: Candidates for grade-level representative positions (Grade 7, 8, 9, 10, 11, 12) are dynamically filtered so a student only sees and votes for candidates in their own grade level.\n"
        "• Max Votes Enforcement: Each position enforces max_votes (e.g. 1 for President, 1 for Representative). Exceeding max_votes requires deselecting a prior candidate.\n"
        "• Atomic Database Transaction: On submission, POST /api/votes begins an ACID database transaction that inserts records into votes, sets profiles.has_voted = true, and commits. The backend then broadcasts a WebSocket event to update all live screens."
    )

    doc.add_page_break()

    # ─────────────────────────────────────────────────────────────────
    # FIGURE 4: ADMIN DASHBOARD FLOWCHART
    # ─────────────────────────────────────────────────────────────────
    h_f4 = doc.add_heading(level=1)
    r_f4 = h_f4.add_run("5. System Administrator Dashboard & Navigation Hub")
    r_f4.font.name = "Arial"
    r_f4.font.size = Pt(14)
    r_f4.font.bold = True
    r_f4.font.color.rgb = PRIMARY_COLOR

    img_f4_path = os.path.join(FIGURES_DIR, "figure4_admin_dashboard.png")
    if os.path.exists(img_f4_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(4)
        run = p_img.add_run()
        run.add_picture(img_f4_path, width=Inches(6.6))

    p_cap4 = doc.add_paragraph()
    p_cap4.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap4.paragraph_format.space_after = Pt(12)
    r_cap4 = p_cap4.add_run("Figure 4. Admin Dashboard Flowchart")
    r_cap4.font.name = "Arial"
    r_cap4.font.size = Pt(10.5)
    r_cap4.font.bold = True
    r_cap4.font.color.rgb = PRIMARY_COLOR

    p_desc4 = doc.add_paragraph()
    p_desc4.paragraph_format.line_spacing = 1.15
    p_desc4.paragraph_format.space_after = Pt(6)
    p_desc4.add_run(
        "Figure 4 outlines the Master Admin Navigation Hub. Administrators authenticated with administrative role permissions "
        "gain access to centralized election governance tabs mapped directly to specialized sub-flowchart connectors:\n"
    )

    f4_steps = [
        ("Choice 1 (Overview Tab): ", "Renders high-level KPIs: Total Registered Voters, Total Votes Cast, Voter Turnout Percentage, and Active Candidates."),
        ("Choice 2 (Voters Tab -> Connector 2): ", "Directs to full Voter Management, single registration, CSV bulk upload, and password reset operations."),
        ("Choice 3 (Candidates Tab -> Connector 3): ", "Directs to Candidate Management, photo uploads, position assignments, and party list configuration."),
        ("Choice 4 (Archive Tab -> Connector 4): ", "Directs to Soft-Delete Archive Management for restoring or permanently deleting archived voters and candidates."),
        ("Choice 5 (Settings Tab -> Connector 5): ", "Directs to Election Lifecycle Control, scheduling, automated end crons, and historical snapshots."),
        ("Choice 6 (Results Tab -> Connector 6): ", "Directs to Real-time Results, multi-filter analytics drilldowns, and official printable tally sheets."),
        ("Choice 7 (Sign Out): ", "Prompts confirmation modal, destroys JWT token in browser storage, and terminates admin session (END).")
    ]
    for bold_prefix, text in f4_steps:
        p_item = doc.add_paragraph(style='List Bullet')
        p_item.paragraph_format.space_after = Pt(3)
        r_b = p_item.add_run(bold_prefix)
        r_b.font.name = "Arial"
        r_b.font.size = Pt(9.5)
        r_b.font.bold = True
        r_t = p_item.add_run(text)
        r_t.font.name = "Arial"
        r_t.font.size = Pt(9.5)

    doc.add_page_break()

    # ─────────────────────────────────────────────────────────────────
    # FIGURE 5: VOTERS AND CANDIDATES MANAGEMENT FLOWCHART
    # ─────────────────────────────────────────────────────────────────
    h_f5 = doc.add_heading(level=1)
    r_f5 = h_f5.add_run("6. Voters and Candidates Management Modules (Connectors 2 & 3)")
    r_f5.font.name = "Arial"
    r_f5.font.size = Pt(14)
    r_f5.font.bold = True
    r_f5.font.color.rgb = PRIMARY_COLOR

    img_f5_path = os.path.join(FIGURES_DIR, "figure5_voters_candidates.png")
    if os.path.exists(img_f5_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(4)
        run = p_img.add_run()
        run.add_picture(img_f5_path, width=Inches(6.6))

    p_cap5 = doc.add_paragraph()
    p_cap5.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap5.paragraph_format.space_after = Pt(12)
    r_cap5 = p_cap5.add_run("Figure 5. Voters and Candidates Management Flowchart")
    r_cap5.font.name = "Arial"
    r_cap5.font.size = Pt(10.5)
    r_cap5.font.bold = True
    r_cap5.font.color.rgb = PRIMARY_COLOR

    p_desc5 = doc.add_paragraph()
    p_desc5.paragraph_format.line_spacing = 1.15
    p_desc5.paragraph_format.space_after = Pt(6)
    p_desc5.add_run(
        "Figure 5 decomposes off-page Connectors 2 and 3 into detailed administrative sub-flows:\n\n"
        "Part A: Connector 2 (Voters Management Operations):\n"
        "• Choice 2.1: View and search voters table by LRN, full name, or section.\n"
        "• Choice 2.2: Add single voter (validates 12-digit numeric LRN format; initializes password to LRN with must_change_password=true).\n"
        "• Choice 2.3: Bulk upload voters via CSV/JSON (parses file, validates LRN format, checks for duplicates, renders preview modal, batch inserts).\n"
        "• Choice 2.4: Edit voter details (name, grade level, section).\n"
        "• Choice 2.5: Reset password (resets voter hash to LRN and sets must_change_password=true).\n"
        "• Choice 2.6: Archive voter (performs soft-delete, archiving the record with archived_at timestamp).\n"
        "• Choice 2.7: Reset all voting statuses (prompts safety modal, resets all has_voted flags to false, truncates votes table for new election).\n\n"
        "Part B: Connector 3 (Candidates Management Operations):\n"
        "• Choice 3.1: View candidates table filtered by position or party list.\n"
        "• Choice 3.2: Add candidate with photo file upload (uploads to Supabase Storage / Multer backend; stores photo_url and metadata).\n"
        "• Choice 3.3: Bulk upload candidates via CSV/JSON (maps position names, verifies grade requirements, batch inserts).\n"
        "• Choice 3.4: Edit candidate details or replace campaign photo.\n"
        "• Choice 3.5: Archive candidate (soft-delete, instantly removing candidate from student ballots while preserving audit trail)."
    )

    doc.add_page_break()

    # ─────────────────────────────────────────────────────────────────
    # FIGURE 6: ARCHIVE & RECOVERY MANAGEMENT FLOWCHART
    # ─────────────────────────────────────────────────────────────────
    h_f6 = doc.add_heading(level=1)
    r_f6 = h_f6.add_run("7. Archive and Recovery Management Module (Connector 4)")
    r_f6.font.name = "Arial"
    r_f6.font.size = Pt(14)
    r_f6.font.bold = True
    r_f6.font.color.rgb = PRIMARY_COLOR

    img_f6_path = os.path.join(FIGURES_DIR, "figure6_archive_flowchart.png")
    if os.path.exists(img_f6_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(4)
        run = p_img.add_run()
        run.add_picture(img_f6_path, width=Inches(6.6))

    p_cap6 = doc.add_paragraph()
    p_cap6.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap6.paragraph_format.space_after = Pt(12)
    r_cap6 = p_cap6.add_run("Figure 6. Archive and Recovery Management Flowchart")
    r_cap6.font.name = "Arial"
    r_cap6.font.size = Pt(10.5)
    r_cap6.font.bold = True
    r_cap6.font.color.rgb = PRIMARY_COLOR

    p_desc6 = doc.add_paragraph()
    p_desc6.paragraph_format.line_spacing = 1.15
    p_desc6.paragraph_format.space_after = Pt(6)
    p_desc6.add_run(
        "Figure 6 specifies the soft-delete safety architecture managed under off-page Connector 4. "
        "Accidental deletions in critical school election environments can disrupt ongoing tallies. "
        "The system segregates active and deleted entities into two sub-tabs:\n"
    )

    f6_steps = [
        ("Choice 4.1 (Archived Voters Sub-tab): ", "Displays list of soft-deleted voters. Admin can 'Restore' (resets archived=false, restoring voter to active roster) or 'Permanent Delete' (triggers hard SQL DELETE with foreign key cascade)."),
        ("Choice 4.2 (Archived Candidates Sub-tab): ", "Displays archived candidates. Admin can 'Restore' (resumes candidacy on ballots) or 'Permanent Delete' (removes record permanently).")
    ]
    for bold_prefix, text in f6_steps:
        p_item = doc.add_paragraph(style='List Bullet')
        p_item.paragraph_format.space_after = Pt(3)
        r_b = p_item.add_run(bold_prefix)
        r_b.font.name = "Arial"
        r_b.font.size = Pt(9.5)
        r_b.font.bold = True
        r_t = p_item.add_run(text)
        r_t.font.name = "Arial"
        r_t.font.size = Pt(9.5)

    doc.add_page_break()

    # ─────────────────────────────────────────────────────────────────
    # FIGURE 7: ELECTION CONTROL, SCHEDULE & HISTORY
    # ─────────────────────────────────────────────────────────────────
    h_f7 = doc.add_heading(level=1)
    r_f7 = h_f7.add_run("8. Election Settings, Schedule, and History Module (Connector 5)")
    r_f7.font.name = "Arial"
    r_f7.font.size = Pt(14)
    r_f7.font.bold = True
    r_f7.font.color.rgb = PRIMARY_COLOR

    img_f7_path = os.path.join(FIGURES_DIR, "figure7_settings_flowchart.png")
    if os.path.exists(img_f7_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(4)
        run = p_img.add_run()
        run.add_picture(img_f7_path, width=Inches(6.6))

    p_cap7 = doc.add_paragraph()
    p_cap7.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap7.paragraph_format.space_after = Pt(12)
    r_cap7 = p_cap7.add_run("Figure 7. Election Settings, Schedule, and History Flowchart")
    r_cap7.font.name = "Arial"
    r_cap7.font.size = Pt(10.5)
    r_cap7.font.bold = True
    r_cap7.font.color.rgb = PRIMARY_COLOR

    p_desc7 = doc.add_paragraph()
    p_desc7.paragraph_format.line_spacing = 1.15
    p_desc7.paragraph_format.space_after = Pt(6)
    p_desc7.add_run(
        "Figure 7 details the election lifecycle state machine under off-page Connector 5, structured into four core functional areas:\n\n"
        "• Choice 5.1 (Election Status Control): Controls live election states (Upcoming, Ongoing, Completed). Includes intelligent time trapping (e.g. prompt to extend end time if attempting to start after scheduled end).\n"
        "• Choice 5.2 (Schedule Configuration): Sets Election Date, Start Time (e.g. 08:00 AM), End Time (e.g. 04:00 PM), and enables the automated background scheduler (periodic daemon checking every 10 seconds to auto-start and auto-end elections).\n"
        "• Choice 5.3 (Election Info): Sets School Year (e.g. 2025-2026), Election Title (e.g. SSLG General Election 2026), and School Location for system-wide branding.\n"
        "• Choice 5.4 (Election History Archive): Captures full result snapshots into election_results_archive with candidate ranks, vote tallies, and declared winners. Supports historical review and deletion of past records."
    )

    doc.add_page_break()

    # ─────────────────────────────────────────────────────────────────
    # FIGURE 8: ELECTION RESULTS & ANALYTICS FLOWCHART
    # ─────────────────────────────────────────────────────────────────
    h_f8 = doc.add_heading(level=1)
    r_f8 = h_f8.add_run("9. Election Results, Analytics, and Official Tally Module (Connector 6)")
    r_f8.font.name = "Arial"
    r_f8.font.size = Pt(14)
    r_f8.font.bold = True
    r_f8.font.color.rgb = PRIMARY_COLOR

    img_f8_path = os.path.join(FIGURES_DIR, "figure8_results_flowchart.png")
    if os.path.exists(img_f8_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(4)
        run = p_img.add_run()
        run.add_picture(img_f8_path, width=Inches(6.6))

    p_cap8 = doc.add_paragraph()
    p_cap8.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap8.paragraph_format.space_after = Pt(12)
    r_cap8 = p_cap8.add_run("Figure 8. Election Results and Analytics Flowchart")
    r_cap8.font.name = "Arial"
    r_cap8.font.size = Pt(10.5)
    r_cap8.font.bold = True
    r_cap8.font.color.rgb = PRIMARY_COLOR

    p_desc8 = doc.add_paragraph()
    p_desc8.paragraph_format.line_spacing = 1.15
    p_desc8.paragraph_format.space_after = Pt(6)
    p_desc8.add_run(
        "Figure 8 outlines the election results visualization and official DepEd reporting engine under off-page Connector 6:\n\n"
        "• Choice 6.1 (Live Results): Subscribes to Supabase Realtime WebSocket channel ('live-votes'), dynamically updating vote count progress bars and percentages as ballots are submitted across the campus.\n"
        "• Choice 6.2 (Multi-Filter Drilldown): Allows administrators and election officers to filter results by Position, Voter Grade Level (Grades 7 to 12), and Section to analyze voter participation by class.\n"
        "• Choice 6.3 (Winners Summary): Automatically identifies and highlights the candidate with the highest votes per position with official Golden Winner badges.\n"
        "• Choice 6.4 (Past Elections Tab): Allows selecting past school years to retrieve immutable historical election outcomes.\n"
        "• Choice 6.5 (Official Print Layout): Generates a printable DepEd-standard Results Tally Sheet complete with Batuan National High School seal, official letterhead, position breakdowns, and certification signature lines for COMELEC advisers and the School Principal."
    )

    doc.add_page_break()

    # ─────────────────────────────────────────────────────────────────
    # SECTION 10: DATABASE & API SPECIFICATION
    # ─────────────────────────────────────────────────────────────────
    h10 = doc.add_heading(level=1)
    r10 = h10.add_run("10. Database Schema and API Endpoint Architecture Reference")
    r10.font.name = "Arial"
    r10.font.size = Pt(14)
    r10.font.bold = True
    r10.font.color.rgb = PRIMARY_COLOR

    p10 = doc.add_paragraph()
    p10.paragraph_format.line_spacing = 1.15
    p10.paragraph_format.space_after = Pt(6)
    p10.add_run(
        "To facilitate technical development, customization, and academic defense, the table below maps the core flowchart entities "
        "to their underlying database tables and REST API endpoints:"
    )

    api_table = doc.add_table(rows=8, cols=4)
    api_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(api_table, "B0C4DE")
    
    api_headers = ["Flowchart Component", "HTTP Route", "Method", "Underlying Database Table & Actions"]
    for c_idx, h_text in enumerate(api_headers):
        cell = api_table.rows[0].cells[c_idx]
        set_cell_background(cell, "102C57")
        set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h_text)
        r.font.name = "Arial"
        r.font.size = Pt(9)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    api_rows = [
        ("Authentication Gate (Fig 2)", "/api/auth/login", "POST", "users, profiles, user_roles (Validates bcrypt hash, issues JWT)"),
        ("Change Password (Fig 2 & 3)", "/api/auth/change-password", "POST", "users (Updates password_hash, clears must_change_password)"),
        ("Ballot Submission (Fig 3)", "/api/votes", "POST", "votes, profiles (Atomic transaction: inserts votes & sets has_voted=true)"),
        ("Voters CRUD & Bulk (Fig 5)", "/api/voters, /bulk-upload", "GET/POST/PUT", "users, profiles, user_roles (Manages student accounts & LRNs)"),
        ("Candidates CRUD (Fig 5)", "/api/candidates", "GET/POST/PUT", "candidates (Stores photo URLs, positions, party lists, mottos)"),
        ("Archive & Restore (Fig 6)", "/api/voters/:id/archive, /restore", "PUT/DELETE", "profiles, candidates (Toggles archived column or hard cascades)"),
        ("Settings & Schedule (Fig 7)", "/api/election-settings", "GET/PUT", "election_settings, election_results_archive (Status, timer, history)")
    ]

    for r_idx, row_data in enumerate(api_rows, start=1):
        row = api_table.rows[r_idx]
        row.cells[0].width = Inches(1.8)
        row.cells[1].width = Inches(1.8)
        row.cells[2].width = Inches(0.9)
        row.cells[3].width = Inches(2.5)
        if r_idx % 2 == 1:
            for cell in row.cells:
                set_cell_background(cell, "F8FAFC")
        for c_idx, val in enumerate(row_data):
            cell = row.cells[c_idx]
            set_cell_margins(cell, top=60, bottom=60, left=80, right=80)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(1)
            r = p.add_run(val)
            r.font.name = "Arial"
            r.font.size = Pt(8.5)
            if c_idx == 2:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r.font.bold = True
                r.font.color.rgb = SECONDARY_COLOR
            elif c_idx == 0:
                r.font.bold = True
                r.font.color.rgb = PRIMARY_COLOR
            else:
                r.font.color.rgb = TEXT_DARK

    doc.add_page_break()

    # ─────────────────────────────────────────────────────────────────
    # SECTION 11: HUMAN CUSTOMIZATION GUIDE
    # ─────────────────────────────────────────────────────────────────
    h11 = doc.add_heading(level=1)
    r11 = h11.add_run("11. Human Customization and Adaptation Guide")
    r11.font.name = "Arial"
    r11.font.size = Pt(14)
    r11.font.bold = True
    r11.font.color.rgb = PRIMARY_COLOR

    p11 = doc.add_paragraph()
    p11.paragraph_format.line_spacing = 1.15
    p11.paragraph_format.space_after = Pt(6)
    p11.add_run(
        "To ensure that this documentation and its diagrams are 100% customizable by human teachers, students, and thesis panelists, "
        "multiple editing pathways are provided:\n\n"
        "1. Microsoft Word (.docx) Customization:\n"
        "   • All narrative text, decision tables, step numbers, and bullet points in this Word document are fully editable.\n"
        "   • You can modify position names (e.g. changing 'SSLG' to 'SPG' or 'Supreme Student Council'), grade levels, and school years directly in this document.\n\n"
        "2. Diagram Editing via Draw.io (diagrams.net):\n"
        "   • The companion file 'Batuan_Voting_Flowcharts.drawio' can be opened directly in any web browser at https://app.diagrams.net or using the Draw.io Desktop app.\n"
        "   • You can drag, drop, recolor, add new decision diamonds, or alter text on any shape across all 7 figures.\n"
        "   • Once edited, export the updated diagram to PNG or PDF and replace the figure in this document.\n\n"
        "3. Programmatic Generation (Python Scripts):\n"
        "   • The python scripts in 'c:\\batuan-voting\\flowchart_build\\' can be re-run at any time to regenerate ultra-high-resolution (300 DPI) diagrams automatically with custom dimensions or styles."
    )

    saved_files = []
    for out_path in OUTPUT_PATHS:
        try:
            doc.save(out_path)
            print(f"Successfully saved DOCX: {out_path}")
            saved_files.append(out_path)
        except Exception as e:
            print(f"Could not save to {out_path}: {e}")
            
    return saved_files

if __name__ == "__main__":
    build_flowchart_document()
