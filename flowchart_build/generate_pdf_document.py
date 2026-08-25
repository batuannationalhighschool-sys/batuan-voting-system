import os
import sys
import shutil
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, PageBreak, HRFlowable
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FIGURES_DIR = os.path.join(BASE_DIR, "figures")

PDF_TARGETS = [
    os.path.join(os.path.dirname(BASE_DIR), "Batuan_Voting_System_Flowcharts_Master.pdf"),
    os.path.join(BASE_DIR, "Batuan_Voting_System_Flowcharts.pdf"),
    r"C:\Users\johnley\Downloads\Batuan_Voting_System_Flowcharts.pdf",
    r"C:\Users\johnley\Downloads\Batuan_Voting_System_Flowcharts_Master.pdf",
    os.path.join(os.path.dirname(BASE_DIR), "Batuan_Voting_System_Flowcharts.pdf"),
]

def build_flowchart_pdf():
    main_pdf = PDF_TARGETS[0]
    doc = SimpleDocTemplate(
        main_pdf,
        pagesize=letter,
        leftMargin=45,
        rightMargin=45,
        topMargin=45,
        bottomMargin=45
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    primary_color = colors.HexColor("#102C57")
    secondary_color = colors.HexColor("#2980B9")
    dark_color = colors.HexColor("#212529")
    gray_color = colors.HexColor("#6C757D")
    
    title_inst_style = ParagraphStyle(
        'InstTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=secondary_color,
        alignment=1, # Center
        spaceAfter=2
    )
    
    title_main_style = ParagraphStyle(
        'MainTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=primary_color,
        alignment=1,
        spaceAfter=4
    )
    
    title_sub_style = ParagraphStyle(
        'SubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=10.5,
        leading=13,
        textColor=gray_color,
        alignment=1,
        spaceAfter=12
    )
    
    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=primary_color,
        spaceBefore=12,
        spaceAfter=6
    )
    
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=dark_color,
        spaceAfter=6
    )
    
    bullet_style = ParagraphStyle(
        'BulletText',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )
    
    caption_style = ParagraphStyle(
        'FigCaption',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=12,
        textColor=primary_color,
        alignment=1,
        spaceBefore=4,
        spaceAfter=10
    )
    
    meta_key_style = ParagraphStyle(
        'MetaKey',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=primary_color
    )
    
    meta_val_style = ParagraphStyle(
        'MetaVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=11,
        textColor=dark_color
    )
    
    story = []
    
    # ── HEADER / METADATA ──
    story.append(Paragraph("BATUAN NATIONAL HIGH SCHOOL", title_inst_style))
    story.append(Paragraph("SUPREME SECONDARY LEARNER GOVERNMENT (SSLG)<br/>AUTOMATED VOTING & MANAGEMENT SYSTEM", title_main_style))
    story.append(Paragraph("Comprehensive System Architecture & Flowchart Documentation", title_sub_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=primary_color, spaceAfter=8))
    
    meta_rows = [
        [Paragraph("System Name:", meta_key_style), Paragraph("Batuan National High School — SSLG Voting System (batuan-voting)", meta_val_style)],
        [Paragraph("Architecture:", meta_key_style), Paragraph("React 18 (Vite SPA) + Node.js Express REST API + MySQL / Supabase", meta_val_style)],
        [Paragraph("Target Roles:", meta_key_style), Paragraph("Student Voters (Grades 7–12), SSLG COMELEC, System Administrators", meta_val_style)],
        [Paragraph("Document Version:", meta_key_style), Paragraph("Version 1.0 (Official Technical Specification & Customizable Appendix)", meta_val_style)]
    ]
    meta_t = Table(meta_rows, colWidths=[1.4*inch, 5.8*inch])
    meta_t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D3D3D3")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(meta_t)
    story.append(Spacer(1, 10))
    
    # ── SECTION 1: OVERVIEW ──
    story.append(Paragraph("1. System Overview and Flowchart Architecture", h1_style))
    story.append(Paragraph(
        "The Batuan National High School SSLG Voting System is an automated web-based election and voter governance platform. "
        "The system provides complete end-to-end election workflows including voter credential management, candidate profiling, "
        "secure real-time ballot casting with atomic transaction safeguards, grade-level representation filtering, "
        "live tally broadcasting via WebSockets, official tally sheet generation, and past election archiving.<br/><br/>"
        "This document presents the complete system flowcharts structured in full accordance with the academic reference standard "
        "(matching the layout and decomposed off-page connector architecture of <i>CargoExpressFlowchart.docx</i>). "
        "Each figure is accompanied by an in-depth breakdown of user decisions, state transitions, validation trappings, "
        "and database mutations.",
        body_style
    ))
    
    # ── SECTION 2: SYMBOL KEY ──
    story.append(Paragraph("2. Flowchart Conventions and Symbol Key", h1_style))
    sym_headers = [
        Paragraph("<b>Flowchart Shape</b>", ParagraphStyle('SH', parent=meta_key_style, textColor=colors.white)),
        Paragraph("<b>ANSI / ISO Name</b>", ParagraphStyle('SH', parent=meta_key_style, textColor=colors.white)),
        Paragraph("<b>Functional Role in Batuan Voting System</b>", ParagraphStyle('SH', parent=meta_key_style, textColor=colors.white))
    ]
    sym_rows = [
        sym_headers,
        [Paragraph("Oval / Stadium", meta_key_style), Paragraph("Terminal Node", meta_val_style), Paragraph("Represents the absolute system entry (START) and session termination (END).", meta_val_style)],
        [Paragraph("Parallelogram", meta_key_style), Paragraph("Input / Choices", meta_val_style), Paragraph("Represents user interface menu choices, form input data (e.g. LRN, Password), and filters.", meta_val_style)],
        [Paragraph("Diamond", meta_key_style), Paragraph("Decision Gate", meta_val_style), Paragraph("Evaluates boolean conditions (e.g. credentials valid, role=='admin', must_change_password, ongoing).", meta_val_style)],
        [Paragraph("Rectangle", meta_key_style), Paragraph("Process / Action", meta_val_style), Paragraph("Represents password hashing, SQL database transactions, CSV parsing, and state updates.", meta_val_style)],
        [Paragraph("Rounded Bullet", meta_key_style), Paragraph("Display Output", meta_val_style), Paragraph("Represents user-facing rendered UI screens, toast alerts, statistical summaries, and print dialogs.", meta_val_style)]
    ]
    sym_t = Table(sym_rows, colWidths=[1.5*inch, 1.4*inch, 4.3*inch])
    sym_t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#B0C4DE")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#FFFFFF"), colors.HexColor("#F8FAFC")]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(sym_t)
    story.append(PageBreak())
    
    # ── HELPER FUNCTION FOR FIGURE PAGES ──
    def add_figure_section(sec_title, img_name, fig_caption, overview_text, steps, trappings_text=None):
        story.append(Paragraph(sec_title, h1_style))
        img_path = os.path.join(FIGURES_DIR, img_name)
        if os.path.exists(img_path):
            img = RLImage(img_path, width=7.0*inch, height=4.7*inch)
            story.append(img)
            story.append(Paragraph(fig_caption, caption_style))
        
        story.append(Paragraph(overview_text, body_style))
        for prefix, txt in steps:
            story.append(Paragraph(f"• <b>{prefix}</b> {txt}", bullet_style))
        
        if trappings_text:
            story.append(Spacer(1, 4))
            story.append(Paragraph(trappings_text, body_style))
        story.append(PageBreak())

    # ── FIGURE 2 ──
    add_figure_section(
        "3. Public Landing Page and Authentication Module",
        "figure2_landing_page.png",
        "Figure 2. Landing Page & Authentication Flowchart",
        "Figure 2 illustrates the entry gateway and public navigation for the Batuan Voting System. Upon loading the system at the root URL (/), users are presented with four primary choices (A through D):",
        [
            ("Choice A (Overview / Home):", "Displays the election hero banner, countdown timer, real-time voter turnout percentage, total registered voters, and the top 5 leading candidates leaderboard."),
            ("Choice B (View Candidates):", "Provides a public candidate directory where students can search candidates by full name or party list, and filter by position."),
            ("Choice C (Live Results):", "Renders the live election analytics tab with position, voter grade level, and section drilldowns, as well as archived past elections."),
            ("Choice D (Sign In Gate):", "Accepts 12-digit Learner Reference Number (LRN) and password credentials. Submits to POST /api/auth/login.")
        ],
        "<b>Authentication Logic Trapping:</b><br/>"
        "1. <i>Credentials Validation:</i> If credentials are invalid, an error toast is rendered and user loops back.<br/>"
        "2. <i>Role Check:</i> If user role is 'admin', user is immediately routed to the Admin Dashboard (Connector 4).<br/>"
        "3. <i>Forced Password Change:</i> If user is a student voter with must_change_password == true (e.g. newly imported voter whose default password equals their LRN), the system forces a redirect to /change-password before granting access."
    )

    # ── FIGURE 3 ──
    add_figure_section(
        "4. Student Voter Portal and Ballot Casting Module",
        "figure3_voter_dashboard.png",
        "Figure 3. Student Voter Dashboard Flowchart",
        "Figure 3 details the student voter's journey from landing on their dashboard to casting an immutable electronic ballot. The Voter Dashboard exposes choices 1 through 5:",
        [
            ("Choice 1 (Dashboard):", "Displays personalized voting status badge ('Voted' or 'Not Yet Voted') and election status countdown."),
            ("Choice 2 (Candidates Directory):", "Allows exploring candidate platforms, party affiliations, and mottos."),
            ("Choice 3 (Cast Vote /vote):", "Initiates the ballot casting engine with rigorous pre-conditions and validation."),
            ("Choice 4 (Live Results):", "Provides voter access to real-time election statistics."),
            ("Choice 5 (Account Settings):", "Sub-menu containing Choice 5.1 (Change Password) and Choice 5.2 (Sign Out with session invalidation).")
        ],
        "<b>Detailed Ballot Casting Validation Trappings (Choice 3):</b><br/>"
        "• <i>Election State Guard:</i> Verifies that election_status == 'ongoing'. If 'upcoming' or 'completed', casting is blocked.<br/>"
        "• <i>Duplicate Vote Prevention:</i> Checks if voter profile has_voted == true. If already voted, a security guard screen blocks further submission.<br/>"
        "• <i>Grade Representative Constraint:</i> Candidates for grade-level representative positions (Grade 7 to 12) are filtered to only show candidates in voter's own grade.<br/>"
        "• <i>Atomic DB Transaction:</i> POST /api/votes performs an ACID database transaction that inserts into votes and updates has_voted = true."
    )

    # ── FIGURE 4 ──
    add_figure_section(
        "5. System Administrator Dashboard & Navigation Hub",
        "figure4_admin_dashboard.png",
        "Figure 4. Admin Dashboard Flowchart",
        "Figure 4 outlines the Master Admin Navigation Hub. Administrators authenticated with administrative role permissions gain access to centralized election governance tabs mapped directly to specialized sub-flowchart connectors:",
        [
            ("Choice 1 (Overview Tab):", "Renders high-level KPIs: Total Registered Voters, Total Votes Cast, Voter Turnout Percentage, and Active Candidates."),
            ("Choice 2 (Voters Tab -> Connector 2):", "Directs to full Voter Management, single registration, CSV bulk upload, and password reset operations."),
            ("Choice 3 (Candidates Tab -> Connector 3):", "Directs to Candidate Management, photo uploads, position assignments, and party list configuration."),
            ("Choice 4 (Archive Tab -> Connector 4):", "Directs to Soft-Delete Archive Management for restoring or permanently deleting archived voters and candidates."),
            ("Choice 5 (Settings Tab -> Connector 5):", "Directs to Election Lifecycle Control, scheduling, automated end crons, and historical snapshots."),
            ("Choice 6 (Results Tab -> Connector 6):", "Directs to Real-time Results, multi-filter analytics drilldowns, and official printable tally sheets."),
            ("Choice 7 (Sign Out):", "Prompts confirmation modal, destroys JWT token in browser storage, and terminates admin session (END).")
        ]
    )

    # ── FIGURE 5 ──
    add_figure_section(
        "6. Voters and Candidates Management Modules (Connectors 2 & 3)",
        "figure5_voters_candidates.png",
        "Figure 5. Voters and Candidates Management Flowchart",
        "Figure 5 decomposes off-page Connectors 2 and 3 into detailed administrative sub-flows:",
        [
            ("Connector 2 (Voters Management):", "Choice 2.1 (View Voters), Choice 2.2 (Add Single Voter), Choice 2.3 (Bulk CSV Upload & Dedup), Choice 2.4 (Edit Voter Info), Choice 2.5 (Reset Password to LRN), Choice 2.6 (Soft-Delete Archive Voter), Choice 2.7 (Reset All Voting Statuses & Votes for new election)."),
            ("Connector 3 (Candidates Management):", "Choice 3.1 (View Candidates Gallery), Choice 3.2 (Add Candidate with Photo Upload to Supabase Storage), Choice 3.3 (Bulk CSV Upload & Position Mapping), Choice 3.4 (Edit Candidate & Replace Photo), Choice 3.5 (Soft-Delete Archive Candidate).")
        ]
    )

    # ── FIGURE 6 ──
    add_figure_section(
        "7. Archive and Recovery Management Module (Connector 4)",
        "figure6_archive_flowchart.png",
        "Figure 6. Archive and Recovery Management Flowchart",
        "Figure 6 specifies the soft-delete safety architecture managed under off-page Connector 4. Accidental deletions in critical school election environments can disrupt ongoing tallies. The system segregates active and deleted entities into two sub-tabs:",
        [
            ("Choice 4.1 (Archived Voters Sub-tab):", "Displays list of soft-deleted voters. Admin can 'Restore' (resets archived=false, restoring voter to active roster) or 'Permanent Delete' (triggers hard SQL DELETE with foreign key cascade)."),
            ("Choice 4.2 (Archived Candidates Sub-tab):", "Displays archived candidates. Admin can 'Restore' (resumes candidacy on ballots) or 'Permanent Delete' (removes record permanently).")
        ]
    )

    # ── FIGURE 7 ──
    add_figure_section(
        "8. Election Settings, Schedule, and History Module (Connector 5)",
        "figure7_settings_flowchart.png",
        "Figure 7. Election Settings, Schedule, and History Flowchart",
        "Figure 7 details the election lifecycle state machine under off-page Connector 5, structured into four core functional areas:",
        [
            ("Choice 5.1 (Election Status Control):", "Controls live election states (Upcoming, Ongoing, Completed) with automatic schedule safety validation."),
            ("Choice 5.2 (Schedule Configuration):", "Sets Election Date, Start Time (e.g. 08:00 AM), End Time (e.g. 04:00 PM), and enables automated background scheduler daemon."),
            ("Choice 5.3 (Election Info):", "Sets School Year (e.g. 2025-2026), Election Title (e.g. SSLG General Election 2026), and School Location for system-wide branding."),
            ("Choice 5.4 (Election History Archive):", "Captures full result snapshots into election_results_archive with candidate ranks, vote tallies, and declared winners.")
        ]
    )

    # ── FIGURE 8 ──
    add_figure_section(
        "9. Election Results, Analytics, and Official Tally Module (Connector 6)",
        "figure8_results_flowchart.png",
        "Figure 8. Election Results and Analytics Flowchart",
        "Figure 8 outlines the election results visualization and official DepEd reporting engine under off-page Connector 6:",
        [
            ("Choice 6.1 (Live Results):", "Subscribes to Supabase Realtime WebSocket channel ('live-votes'), dynamically updating vote count progress bars as ballots are submitted."),
            ("Choice 6.2 (Multi-Filter Drilldown):", "Allows filtering results by Position, Voter Grade Level (Grades 7 to 12), and Section to analyze voter participation by class."),
            ("Choice 6.3 (Winners Summary):", "Automatically identifies and highlights the candidate with the highest votes per position with Golden Winner badges."),
            ("Choice 6.4 (Past Elections Tab):", "Allows selecting past school years to retrieve immutable historical election outcomes."),
            ("Choice 6.5 (Official Print Layout):", "Generates a printable DepEd-standard Results Tally Sheet complete with Batuan National High School seal, letterhead, and certification signature lines.")
        ]
    )

    # ── SECTION 10: DATABASE & API ──
    story.append(Paragraph("10. Database Schema and API Endpoint Architecture Reference", h1_style))
    story.append(Paragraph(
        "To facilitate technical development, customization, and academic defense, the table below maps the core flowchart entities "
        "to their underlying database tables and REST API endpoints:",
        body_style
    ))
    
    api_headers = [
        Paragraph("<b>Flowchart Component</b>", ParagraphStyle('AH', parent=meta_key_style, textColor=colors.white)),
        Paragraph("<b>HTTP Route</b>", ParagraphStyle('AH', parent=meta_key_style, textColor=colors.white)),
        Paragraph("<b>Method</b>", ParagraphStyle('AH', parent=meta_key_style, textColor=colors.white, alignment=1)),
        Paragraph("<b>Underlying Database Actions</b>", ParagraphStyle('AH', parent=meta_key_style, textColor=colors.white))
    ]
    api_rows = [
        api_headers,
        [Paragraph("Authentication (Fig 2)", meta_key_style), Paragraph("/api/auth/login", meta_val_style), Paragraph("POST", meta_key_style), Paragraph("users, profiles (Bcrypt verify, issue JWT)", meta_val_style)],
        [Paragraph("Change Password (Fig 2, 3)", meta_key_style), Paragraph("/api/auth/change-password", meta_val_style), Paragraph("POST", meta_key_style), Paragraph("users (Update password_hash, clear flag)", meta_val_style)],
        [Paragraph("Ballot Submit (Fig 3)", meta_key_style), Paragraph("/api/votes", meta_val_style), Paragraph("POST", meta_key_style), Paragraph("votes, profiles (Atomic ACID transaction)", meta_val_style)],
        [Paragraph("Voters CRUD (Fig 5)", meta_key_style), Paragraph("/api/voters, /bulk-upload", meta_val_style), Paragraph("GET/POST", meta_key_style), Paragraph("users, profiles, user_roles (Manage LRNs)", meta_val_style)],
        [Paragraph("Candidates CRUD (Fig 5)", meta_key_style), Paragraph("/api/candidates", meta_val_style), Paragraph("GET/POST", meta_key_style), Paragraph("candidates (Photos, positions, party lists)", meta_val_style)],
        [Paragraph("Archive & Restore (Fig 6)", meta_key_style), Paragraph("/api/voters/:id/archive", meta_val_style), Paragraph("PUT/DEL", meta_key_style), Paragraph("profiles, candidates (Soft/Hard cascade)", meta_val_style)],
        [Paragraph("Settings & Schedule (Fig 7)", meta_key_style), Paragraph("/api/election-settings", meta_val_style), Paragraph("GET/PUT", meta_key_style), Paragraph("election_settings, election_results_archive", meta_val_style)]
    ]
    api_t = Table(api_rows, colWidths=[1.8*inch, 1.8*inch, 0.8*inch, 2.8*inch])
    api_t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#B0C4DE")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#FFFFFF"), colors.HexColor("#F8FAFC")]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(api_t)
    story.append(Spacer(1, 10))

    # ── SECTION 11: CUSTOMIZATION GUIDE ──
    story.append(Paragraph("11. Human Customization and Adaptation Guide", h1_style))
    story.append(Paragraph(
        "To ensure that this documentation and its diagrams are 100% customizable by human teachers, students, and thesis panelists, "
        "multiple editing pathways are provided:<br/><br/>"
        "1. <b>Microsoft Word (.docx) Customization:</b> All narrative text, decision tables, step numbers, and bullet points in the accompanying <code>.docx</code> document are fully editable.<br/>"
        "2. <b>Diagram Editing via Draw.io (diagrams.net):</b> The companion file <code>Batuan_Voting_Flowcharts.drawio</code> can be opened directly at https://app.diagrams.net to drag, drop, recolor, or modify any node.<br/>"
        "3. <b>Programmatic Generation:</b> Python scripts in <code>c:\\batuan-voting\\flowchart_build\\</code> can be executed to regenerate 300 DPI high-resolution figures automatically.",
        body_style
    ))
    
    doc.build(story)
    print(f"Successfully generated master PDF: {main_pdf}")
    
    for p in PDF_TARGETS[1:]:
        try:
            shutil.copy2(main_pdf, p)
            print(f"Copied PDF to: {p}")
        except Exception as e:
            print(f"Could not copy PDF to {p}: {e}")

if __name__ == "__main__":
    build_flowchart_pdf()
