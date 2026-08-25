import os
import sys
sys.path.append(os.path.dirname(__file__))
from flowchart_renderer import FlowchartRenderer

FIGURES_DIR = os.path.join(os.path.dirname(__file__), "figures")
os.makedirs(FIGURES_DIR, exist_ok=True)

# ══════════════════════════════════════════════════════════════════════
# FIGURE 2: LANDING PAGE & AUTHENTICATION FLOWCHART
# ══════════════════════════════════════════════════════════════════════
def generate_figure_2():
    r = FlowchartRenderer(1120, 790)
    
    # 1. Start node
    r.draw_terminal(70, 140, 80, 44, "START")
    
    # 2. Main Choices Parallelogram
    r.draw_parallelogram(230, 140, 180, 110, "Choices:\nA. Overview / Home\nB. View Candidates\nC. Live Results\nD. Sign In", slant=18)
    r.draw_arrow([(110, 140), (140, 140)])
    
    # 3. Decision: if choice == A
    r.draw_decision(390, 140, 95, 65, "if choice\n== A")
    r.draw_arrow([(320, 140), (342, 140)])
    
    # Down branch A
    r.draw_display(390, 260, 150, 55, "Display Overview &\nTurnout Stats")
    r.draw_arrow([(390, 172), (390, 232)], label="Y", label_pos="right")
    
    # 4. Decision: if choice == B
    r.draw_decision(530, 140, 95, 65, "if choice\n== B")
    r.draw_arrow([(438, 140), (482, 140)], label="N", label_pos="top")
    
    # Down branch B
    r.draw_data_input(530, 250, 130, 50, "Search Name /\nFilter Party / Position")
    r.draw_arrow([(530, 172), (530, 225)], label="Y", label_pos="right")
    
    r.draw_display(530, 340, 145, 52, "Display Candidates\nGallery Cards")
    r.draw_arrow([(530, 275), (530, 314)])
    
    # 5. Decision: if choice == C
    r.draw_decision(680, 140, 95, 65, "if choice\n== C")
    r.draw_arrow([(578, 140), (632, 140)], label="N", label_pos="top")
    
    # Down branch C
    r.draw_data_input(680, 250, 140, 50, "Filter by Position,\nGrade & Section")
    r.draw_arrow([(680, 172), (680, 225)], label="Y", label_pos="right")
    
    r.draw_display(680, 340, 150, 52, "Display Live Tallies &\nPast Elections")
    r.draw_arrow([(680, 275), (680, 314)])
    
    # 6. Decision: if choice == D
    r.draw_decision(840, 140, 95, 65, "if choice\n== D")
    r.draw_arrow([(728, 140), (792, 140)], label="N", label_pos="top")
    
    # Loop back for choice == D 'N' branch
    r.draw_arrow([(888, 140), (950, 140), (950, 40), (230, 40), (230, 85)], label="N", label_pos="top")
    
    # Down branch D (Sign in flow)
    r.draw_data_input(840, 245, 120, 55, "LRN (12 digits)\nPassword")
    r.draw_arrow([(840, 172), (840, 218)], label="Y", label_pos="right")
    
    # Decision: Valid credentials?
    r.draw_decision(840, 345, 105, 65, "credentials\nvalid?")
    r.draw_arrow([(840, 272), (840, 312)])
    
    # Invalid credentials branch
    r.draw_display(980, 345, 120, 48, "Display Login\nError Toast")
    r.draw_arrow([(892, 345), (920, 345)], label="N", label_pos="top")
    r.draw_arrow([(980, 321), (980, 245), (900, 245)])
    
    # Valid credentials -> Check role
    r.draw_decision(840, 465, 115, 68, "is the role\n'admin'?")
    r.draw_arrow([(840, 378), (840, 431)], label="Y", label_pos="right")
    
    # Admin -> Admin Dashboard
    r.draw_offpage_connector(700, 465, 110, 55, "Admin\nDashboard", direction='left')
    r.draw_arrow([(782, 465), (755, 465)], label="Y", label_pos="top")
    
    # Not admin -> Check must_change_password
    r.draw_decision(840, 585, 125, 70, "must_change\npassword?")
    r.draw_arrow([(840, 499), (840, 550)], label="N", label_pos="right")
    
    # must_change_password == Y -> Force password update
    r.draw_data_input(990, 585, 130, 55, "New Password\nConfirm Password")
    r.draw_arrow([(902, 585), (925, 585)], label="Y", label_pos="top")
    
    r.draw_process(990, 680, 120, 45, "Update Password\n& Clear Flag")
    r.draw_arrow([(990, 612), (990, 657)])
    
    # Student Voter Dashboard
    r.draw_offpage_connector(840, 715, 120, 55, "Student Voter\nDashboard", direction='down')
    r.draw_arrow([(840, 620), (840, 687)], label="N", label_pos="right")
    r.draw_arrow([(930, 680), (840, 680), (840, 687)])
    
    out_path = os.path.join(FIGURES_DIR, "figure2_landing_page.png")
    r.save(out_path)
    return out_path


# ══════════════════════════════════════════════════════════════════════
# FIGURE 3: STUDENT VOTER DASHBOARD FLOWCHART
# ══════════════════════════════════════════════════════════════════════
def generate_figure_3():
    r = FlowchartRenderer(1180, 880)
    
    # 1. Entry node: Student Voter Dashboard
    r.draw_offpage_connector(75, 120, 110, 55, "Student Voter\nDashboard", direction='right')
    
    # 2. Main Choices Parallelogram
    r.draw_parallelogram(235, 120, 175, 115, "Choices:\n1. Dashboard\n2. Candidates\n3. Cast Vote (/vote)\n4. Live Results\n5. Account Settings", slant=18)
    r.draw_arrow([(130, 120), (148, 120)])
    
    # 3. Decision: if choice == 1
    r.draw_decision(390, 120, 95, 65, "if choice\n== 1")
    r.draw_arrow([(322, 120), (342, 120)])
    
    # Down branch 1
    r.draw_display(390, 230, 145, 52, "Display Personal\nDashboard & Status")
    r.draw_arrow([(390, 152), (390, 204)], label="Y", label_pos="right")
    
    # 4. Decision: if choice == 2
    r.draw_decision(530, 120, 95, 65, "if choice\n== 2")
    r.draw_arrow([(438, 120), (482, 120)], label="N", label_pos="top")
    
    # Down branch 2
    r.draw_display(530, 230, 145, 52, "Display Candidates\nwith Filters")
    r.draw_arrow([(530, 152), (530, 204)], label="Y", label_pos="right")
    
    # 5. Decision: if choice == 3 (Cast Vote)
    r.draw_decision(720, 120, 95, 65, "if choice\n== 3")
    r.draw_arrow([(578, 120), (672, 120)], label="N", label_pos="top")
    
    # Down branch 3: Detailed Voting Process
    r.draw_decision(720, 230, 120, 68, "is election\n'ongoing'?")
    r.draw_arrow([(720, 152), (720, 196)], label="Y", label_pos="right")
    
    # Election not ongoing branch
    r.draw_display(865, 230, 135, 52, "Display Status:\nUpcoming / Ended")
    r.draw_arrow([(780, 230), (797, 230)], label="N", label_pos="top")
    
    # Election ongoing -> Check has_voted
    r.draw_decision(720, 350, 120, 68, "has voter\nalready voted?")
    r.draw_arrow([(720, 264), (720, 316)], label="Y", label_pos="right")
    
    # Already voted branch
    r.draw_display(865, 350, 135, 52, "Display 'Already\nVoted' Guard")
    r.draw_arrow([(780, 350), (797, 350)], label="Y", label_pos="top")
    
    # Not voted -> Load ballot & select candidates
    r.draw_data_input(720, 470, 150, 65, "Load Positions &\nFilter Grade Rep\nSelect Candidates")
    r.draw_arrow([(720, 384), (720, 437)], label="N", label_pos="right")
    
    # Review Selections
    r.draw_display(720, 580, 150, 50, "Display Ballot\nSelections Summary")
    r.draw_arrow([(720, 502), (720, 555)])
    
    # Submit Ballot (Atomic Transaction)
    r.draw_process(720, 675, 150, 55, "Submit Final Ballot\nPOST /api/votes\n(Atomic DB Tx)")
    r.draw_arrow([(720, 605), (720, 647)])
    
    # Display Vote Confirmation
    r.draw_display(720, 775, 150, 52, "Display 'Vote\nSubmitted!' & Tallies")
    r.draw_arrow([(720, 702), (720, 749)])
    
    # 6. Decision: if choice == 4 (Live Results)
    r.draw_decision(880, 120, 95, 65, "if choice\n== 4")
    r.draw_arrow([(768, 120), (832, 120)], label="N", label_pos="top")
    
    # Down branch 4
    r.draw_display(880, 175, 140, 35, "Display Live Tallies", font_name='small_bold')
    r.draw_arrow([(880, 152), (880, 157)], label="Y", label_pos="right")
    
    # 7. Decision: if choice == 5 (Account Settings / Profile)
    r.draw_decision(1030, 120, 95, 65, "if choice\n== 5")
    r.draw_arrow([(928, 120), (982, 120)], label="N", label_pos="top")
    
    # Loop back for choice 5 'N'
    r.draw_arrow([(1078, 120), (1130, 120), (1130, 40), (235, 40), (235, 62)], label="N", label_pos="top")
    
    # Down branch 5: Sub-choices (5.1 Change Password, 5.2 Sign Out)
    r.draw_parallelogram(1030, 240, 150, 80, "Choices:\n5.1 Change Password\n5.2 Sign Out", slant=14)
    r.draw_arrow([(1030, 152), (1030, 200)], label="Y", label_pos="right")
    
    # Decision: if choice == 5.1
    r.draw_decision(1030, 360, 105, 65, "if choice\n== 5.1")
    r.draw_arrow([(1030, 280), (1030, 327)])
    
    # Change Password flow
    r.draw_data_input(1030, 460, 130, 50, "Input New Password\n(min 6 chars)")
    r.draw_arrow([(1030, 392), (1030, 435)], label="Y", label_pos="right")
    
    r.draw_process(1030, 545, 120, 45, "Save Password\n& Toast Success")
    r.draw_arrow([(1030, 485), (1030, 522)])
    
    # Decision: if choice == 5.2 (Sign Out)
    r.draw_decision(1030, 655, 105, 65, "if choice\n== 5.2")
    r.draw_arrow([(1030, 568), (1030, 622)], label="N", label_pos="right")
    
    # Loop back for choice 5.2 'N'
    r.draw_arrow([(1082, 655), (1130, 655), (1130, 240), (1105, 240)], label="N", label_pos="top")
    
    # Sign Out Action & END
    r.draw_process(1030, 750, 120, 45, "Clear Session &\nAuth Token")
    r.draw_arrow([(1030, 688), (1030, 727)], label="Y", label_pos="right")
    
    r.draw_terminal(1030, 835, 80, 40, "END")
    r.draw_arrow([(1030, 772), (1030, 815)])
    
    out_path = os.path.join(FIGURES_DIR, "figure3_voter_dashboard.png")
    r.save(out_path)
    return out_path


# ══════════════════════════════════════════════════════════════════════
# FIGURE 4: ADMIN DASHBOARD FLOWCHART
# ══════════════════════════════════════════════════════════════════════
def generate_figure_4():
    r = FlowchartRenderer(1160, 680)
    
    # 1. Entry node: Admin Dashboard
    r.draw_offpage_connector(75, 120, 110, 55, "Admin\nDashboard", direction='right')
    
    # 2. Main Choices Parallelogram
    r.draw_parallelogram(230, 120, 160, 130, "Choices:\n1. Overview\n2. Voters\n3. Candidates\n4. Archive\n5. Settings\n6. Results\n7. Sign Out", slant=18)
    r.draw_arrow([(130, 120), (150, 120)])
    
    # 3. Decision: if choice == 1
    r.draw_decision(370, 120, 90, 65, "if choice\n== 1")
    r.draw_arrow([(310, 120), (325, 120)])
    
    # Down branch 1
    r.draw_display(370, 230, 140, 55, "Display Admin\nOverview & Stats")
    r.draw_arrow([(370, 152), (370, 202)], label="Y", label_pos="right")
    
    # 4. Decision: if choice == 2 (Voters Management)
    r.draw_decision(490, 120, 90, 65, "if choice\n== 2")
    r.draw_arrow([(415, 120), (445, 120)], label="N", label_pos="top")
    
    # Connector 2
    r.draw_offpage_connector(490, 230, 60, 50, "2", direction='down')
    r.draw_arrow([(490, 152), (490, 205)], label="Y", label_pos="right")
    
    # 5. Decision: if choice == 3 (Candidates Management)
    r.draw_decision(610, 120, 90, 65, "if choice\n== 3")
    r.draw_arrow([(535, 120), (565, 120)], label="N", label_pos="top")
    
    # Connector 3
    r.draw_offpage_connector(610, 230, 60, 50, "3", direction='down')
    r.draw_arrow([(610, 152), (610, 205)], label="Y", label_pos="right")
    
    # 6. Decision: if choice == 4 (Archive Management)
    r.draw_decision(730, 120, 90, 65, "if choice\n== 4")
    r.draw_arrow([(655, 120), (685, 120)], label="N", label_pos="top")
    
    # Connector 4
    r.draw_offpage_connector(730, 230, 60, 50, "4", direction='down')
    r.draw_arrow([(730, 152), (730, 205)], label="Y", label_pos="right")
    
    # 7. Decision: if choice == 5 (Settings & Election Control)
    r.draw_decision(850, 120, 90, 65, "if choice\n== 5")
    r.draw_arrow([(775, 120), (805, 120)], label="N", label_pos="top")
    
    # Connector 5
    r.draw_offpage_connector(850, 230, 60, 50, "5", direction='down')
    r.draw_arrow([(850, 152), (850, 205)], label="Y", label_pos="right")
    
    # 8. Decision: if choice == 6 (Results & Official Tally)
    r.draw_decision(970, 120, 90, 65, "if choice\n== 6")
    r.draw_arrow([(895, 120), (925, 120)], label="N", label_pos="top")
    
    # Connector 6
    r.draw_offpage_connector(970, 230, 60, 50, "6", direction='down')
    r.draw_arrow([(970, 152), (970, 205)], label="Y", label_pos="right")
    
    # 9. Decision: if choice == 7 (Sign Out)
    r.draw_decision(970, 360, 95, 65, "if choice\n== 7")
    r.draw_arrow([(1015, 120), (1070, 120), (1070, 360), (1018, 360)], label="N", label_pos="top")
    
    # Loop back for choice 7 'N'
    r.draw_arrow([(970, 392), (970, 450), (230, 450), (230, 185)], label="N", label_pos="bottom")
    
    # Sign Out -> Clear Session & END
    r.draw_process(820, 360, 120, 45, "Clear Admin Token\n& Session State")
    r.draw_arrow([(922, 360), (880, 360)], label="Y", label_pos="top")
    
    r.draw_terminal(690, 360, 80, 40, "END")
    r.draw_arrow([(760, 360), (730, 360)])
    
    out_path = os.path.join(FIGURES_DIR, "figure4_admin_dashboard.png")
    r.save(out_path)
    return out_path


# ══════════════════════════════════════════════════════════════════════
# FIGURE 5: VOTERS & CANDIDATES MANAGEMENT FLOWCHART (CONNECTORS 2 & 3)
# ══════════════════════════════════════════════════════════════════════
def generate_figure_5():
    r = FlowchartRenderer(1180, 680)
    
    # PART A: CONNECTOR 2 (VOTERS MANAGEMENT)
    r.draw_offpage_connector(55, 120, 50, 45, "2", direction='right')
    
    r.draw_decision(160, 120, 85, 60, "if choice\n== 2.1")
    r.draw_arrow([(80, 120), (117, 120)])
    r.draw_display(160, 210, 100, 45, "Display All\nVoters List")
    r.draw_arrow([(160, 150), (160, 187)], label="Y", label_pos="right")
    
    r.draw_decision(290, 120, 85, 60, "if choice\n== 2.2")
    r.draw_arrow([(202, 120), (247, 120)], label="N", label_pos="top")
    r.draw_data_input(290, 210, 110, 45, "Add Voter Form\n(12-digit LRN)")
    r.draw_arrow([(290, 150), (290, 187)], label="Y", label_pos="right")
    
    r.draw_decision(430, 120, 85, 60, "if choice\n== 2.3")
    r.draw_arrow([(332, 120), (387, 120)], label="N", label_pos="top")
    r.draw_process(430, 210, 115, 45, "Bulk CSV Upload\n& Dedup Import")
    r.draw_arrow([(430, 150), (430, 187)], label="Y", label_pos="right")
    
    r.draw_decision(570, 120, 85, 60, "if choice\n== 2.4")
    r.draw_arrow([(472, 120), (527, 120)], label="N", label_pos="top")
    r.draw_process(570, 210, 110, 45, "Edit Voter Info\n& Save Changes")
    r.draw_arrow([(570, 150), (570, 187)], label="Y", label_pos="right")
    
    r.draw_decision(710, 120, 85, 60, "if choice\n== 2.5")
    r.draw_arrow([(612, 120), (667, 120)], label="N", label_pos="top")
    r.draw_process(710, 210, 115, 45, "Reset Password\n(Reset to LRN)")
    r.draw_arrow([(710, 150), (710, 187)], label="Y", label_pos="right")
    
    r.draw_decision(850, 120, 85, 60, "if choice\n== 2.6")
    r.draw_arrow([(752, 120), (807, 120)], label="N", label_pos="top")
    r.draw_process(850, 210, 115, 45, "Archive Voter\n(Soft Delete)")
    r.draw_arrow([(850, 150), (850, 187)], label="Y", label_pos="right")
    
    r.draw_decision(990, 120, 85, 60, "if choice\n== 2.7")
    r.draw_arrow([(892, 120), (947, 120)], label="N", label_pos="top")
    r.draw_process(990, 210, 120, 45, "Reset All Voting\nStatuses & Votes")
    r.draw_arrow([(990, 150), (990, 187)], label="Y", label_pos="right")
    
    r.draw_circle_connector(1110, 120, 22, "2")
    r.draw_arrow([(1032, 120), (1088, 120)], label="N", label_pos="top")
    
    # PART B: CONNECTOR 3 (CANDIDATES MANAGEMENT)
    r.draw_offpage_connector(55, 450, 50, 45, "3", direction='right')
    
    r.draw_decision(180, 450, 85, 60, "if choice\n== 3.1")
    r.draw_arrow([(80, 450), (137, 450)])
    r.draw_display(180, 540, 115, 45, "Display All\nCandidates List")
    r.draw_arrow([(180, 480), (180, 517)], label="Y", label_pos="right")
    
    r.draw_decision(340, 450, 85, 60, "if choice\n== 3.2")
    r.draw_arrow([(222, 450), (297, 450)], label="N", label_pos="top")
    r.draw_data_input(340, 540, 125, 48, "Add Candidate Form\n+ Photo Upload")
    r.draw_arrow([(340, 480), (340, 516)], label="Y", label_pos="right")
    
    r.draw_decision(510, 450, 85, 60, "if choice\n== 3.3")
    r.draw_arrow([(382, 450), (467, 450)], label="N", label_pos="top")
    r.draw_process(510, 540, 125, 45, "Bulk CSV Upload\n& Position Mapping")
    r.draw_arrow([(510, 480), (510, 517)], label="Y", label_pos="right")
    
    r.draw_decision(680, 450, 85, 60, "if choice\n== 3.4")
    r.draw_arrow([(552, 450), (637, 450)], label="N", label_pos="top")
    r.draw_process(680, 540, 125, 45, "Edit Candidate &\nReplace Photo")
    r.draw_arrow([(680, 480), (680, 517)], label="Y", label_pos="right")
    
    r.draw_decision(850, 450, 85, 60, "if choice\n== 3.5")
    r.draw_arrow([(722, 450), (807, 450)], label="N", label_pos="top")
    r.draw_process(850, 540, 125, 45, "Archive Candidate\n(Soft Delete)")
    r.draw_arrow([(850, 480), (850, 517)], label="Y", label_pos="right")
    
    r.draw_circle_connector(1010, 450, 22, "3")
    r.draw_arrow([(892, 450), (988, 450)], label="N", label_pos="top")
    
    out_path = os.path.join(FIGURES_DIR, "figure5_voters_candidates.png")
    r.save(out_path)
    return out_path


# ══════════════════════════════════════════════════════════════════════
# FIGURE 6: ARCHIVE & RECOVERY MANAGEMENT FLOWCHART (CONNECTOR 4) (OPTIMIZED)
# ══════════════════════════════════════════════════════════════════════
def generate_figure_6():
    r = FlowchartRenderer(1120, 720)
    
    # 1. Entry connector 4
    r.draw_offpage_connector(65, 120, 50, 45, "4", direction='right')
    
    # 2. Display Archive Dashboard
    r.draw_display(200, 120, 140, 50, "Display Archive\nManagement Panel")
    r.draw_arrow([(90, 120), (130, 120)])
    
    # 3. Sub-tab choices: 4.1 Archived Voters, 4.2 Archived Candidates
    r.draw_parallelogram(390, 120, 160, 80, "Choices:\n4.1 Archived Voters\n4.2 Archived Candidates", slant=14)
    r.draw_arrow([(270, 120), (310, 120)])
    
    # 4. Decision: if choice == 4.1
    r.draw_decision(570, 120, 95, 65, "if choice\n== 4.1")
    r.draw_arrow([(470, 120), (522, 120)])
    
    # 4.1 Down branch (Archived Voters)
    r.draw_display(570, 230, 140, 50, "Display Archived\nVoters Table")
    r.draw_arrow([(570, 152), (570, 205)], label="Y", label_pos="right")
    
    r.draw_decision(570, 335, 120, 65, "select voter\naction?")
    r.draw_arrow([(570, 255), (570, 302)])
    
    # Restore Voter (left)
    r.draw_process(440, 435, 115, 45, "Restore Voter to\nActive List")
    r.draw_arrow([(510, 335), (440, 335), (440, 412)])
    r.draw_label("Restore", 450, 318)
    
    # Permanently Delete Voter (down)
    r.draw_process(570, 435, 115, 45, "Permanent Delete\n(Cascade Hard Del)")
    r.draw_arrow([(570, 368), (570, 412)])
    r.draw_label("Delete", 578, 380)
    
    # 5. Decision: if choice == 4.2 (Archived Candidates)
    r.draw_decision(780, 120, 95, 65, "if choice\n== 4.2")
    r.draw_arrow([(618, 120), (732, 120)], label="N", label_pos="top")
    
    # Loop back for choice 4.2 'N'
    r.draw_arrow([(828, 120), (880, 120), (880, 40), (390, 40), (390, 80)], label="N", label_pos="top")
    
    # 4.2 Down branch (Archived Candidates)
    r.draw_display(780, 230, 145, 50, "Display Archived\nCandidates Table")
    r.draw_arrow([(780, 152), (780, 205)], label="Y", label_pos="right")
    
    r.draw_decision(780, 335, 125, 65, "select candidate\naction?")
    r.draw_arrow([(780, 255), (780, 302)])
    
    # Restore Candidate (down)
    r.draw_process(780, 435, 120, 45, "Restore Candidate\nto Active Ballot")
    r.draw_arrow([(780, 368), (780, 412)])
    r.draw_label("Restore", 788, 380)
    
    # Permanently Delete Candidate (right)
    r.draw_process(930, 435, 120, 45, "Permanent Delete\n(Hard Delete Cand)")
    r.draw_arrow([(842, 335), (930, 335), (930, 412)])
    r.draw_label("Delete", 855, 318)
    
    # Completed action toast / refresh
    r.draw_display(680, 560, 160, 50, "Display Toast &\nInvalidate Queries")
    r.draw_arrow([(440, 458), (440, 510), (680, 510), (680, 535)])
    r.draw_arrow([(570, 458), (570, 510)])
    r.draw_arrow([(780, 458), (780, 510)])
    r.draw_arrow([(930, 458), (930, 510), (680, 510), (680, 535)])
    
    out_path = os.path.join(FIGURES_DIR, "figure6_archive_flowchart.png")
    r.save(out_path)
    return out_path


# ══════════════════════════════════════════════════════════════════════
# FIGURE 7: ELECTION CONTROL, SCHEDULE & HISTORY (CONNECTOR 5) (OPTIMIZED)
# ══════════════════════════════════════════════════════════════════════
def generate_figure_7():
    r = FlowchartRenderer(1140, 680)
    
    # 1. Entry connector 5
    r.draw_offpage_connector(55, 120, 50, 45, "5", direction='right')
    
    # 2. Display Settings Panel
    r.draw_display(190, 120, 135, 50, "Display Election\nSettings Panel")
    r.draw_arrow([(80, 120), (122, 120)])
    
    # 3. Sub-choices parallelogram
    r.draw_parallelogram(370, 120, 160, 100, "Choices:\n5.1 Status Control\n5.2 Schedule Config\n5.3 Election Info\n5.4 Election History", slant=14)
    r.draw_arrow([(258, 120), (290, 120)])
    
    # 4. Decision: if choice == 5.1 (Status Control)
    r.draw_decision(530, 120, 95, 65, "if choice\n== 5.1")
    r.draw_arrow([(450, 120), (482, 120)])
    
    # Down branch 5.1: Status Controls
    r.draw_data_input(530, 230, 130, 60, "Buttons: Upcoming /\nStart / End /\nReset Voters")
    r.draw_arrow([(530, 152), (530, 200)], label="Y", label_pos="right")
    
    r.draw_process(530, 340, 130, 50, "Validate Schedule &\nUpdate Status State")
    r.draw_arrow([(530, 260), (530, 315)])
    
    # 5. Decision: if choice == 5.2 (Schedule Config)
    r.draw_decision(680, 120, 95, 65, "if choice\n== 5.2")
    r.draw_arrow([(578, 120), (632, 120)], label="N", label_pos="top")
    
    # Down branch 5.2: Schedule
    r.draw_data_input(680, 230, 130, 60, "Date, Start Time,\nEnd Time, Auto-End\nScheduler Toggle")
    r.draw_arrow([(680, 152), (680, 200)], label="Y", label_pos="right")
    
    r.draw_process(680, 340, 130, 50, "Save Schedule to\nDB & Activate Cron")
    r.draw_arrow([(680, 260), (680, 315)])
    
    # 6. Decision: if choice == 5.3 (Election Info)
    r.draw_decision(830, 120, 95, 65, "if choice\n== 5.3")
    r.draw_arrow([(728, 120), (782, 120)], label="N", label_pos="top")
    
    # Down branch 5.3: Info
    r.draw_data_input(830, 230, 130, 60, "Election Title,\nSchool Year, School\nName & Location")
    r.draw_arrow([(830, 152), (830, 200)], label="Y", label_pos="right")
    
    r.draw_process(830, 340, 130, 50, "Save Info & Update\nApp Headers/Footers")
    r.draw_arrow([(830, 260), (830, 315)])
    
    # 7. Decision: if choice == 5.4 (Election History Archive)
    r.draw_decision(980, 120, 95, 65, "if choice\n== 5.4")
    r.draw_arrow([(878, 120), (932, 120)], label="N", label_pos="top")
    
    # Loop back for choice 5.4 'N'
    r.draw_arrow([(1028, 120), (1070, 120), (1070, 40), (370, 40), (370, 70)], label="N", label_pos="top")
    
    # Down branch 5.4: Archive Results to History
    r.draw_data_input(980, 230, 135, 60, "Snapshot Current\nElection Results &\nRankings Archive")
    r.draw_arrow([(980, 152), (980, 200)], label="Y", label_pos="right")
    
    r.draw_process(980, 340, 135, 50, "Insert/Replace into\nelection_results_archive")
    r.draw_arrow([(980, 260), (980, 315)])
    
    # Common Success Toast & Invalidate
    r.draw_display(755, 470, 170, 50, "Display Success Toast\n& Invalidate Settings")
    r.draw_arrow([(530, 365), (530, 415), (755, 415), (755, 445)])
    r.draw_arrow([(680, 365), (680, 415), (755, 415), (755, 445)])
    r.draw_arrow([(830, 365), (830, 415), (755, 415), (755, 445)])
    r.draw_arrow([(980, 365), (980, 415), (755, 415), (755, 445)])
    
    out_path = os.path.join(FIGURES_DIR, "figure7_settings_flowchart.png")
    r.save(out_path)
    return out_path


# ══════════════════════════════════════════════════════════════════════
# FIGURE 8: ELECTION RESULTS & ANALYTICS FLOWCHART (CONNECTOR 6)
# ══════════════════════════════════════════════════════════════════════
def generate_figure_8():
    r = FlowchartRenderer(1140, 740)
    
    # 1. Entry connector 6
    r.draw_offpage_connector(55, 120, 50, 45, "6", direction='right')
    
    # 2. Display Results Page
    r.draw_display(190, 120, 135, 50, "Display Election\nResults Module")
    r.draw_arrow([(80, 120), (122, 120)])
    
    # 3. Sub-choices parallelogram
    r.draw_parallelogram(370, 120, 160, 110, "Choices:\n6.1 Live Results\n6.2 Multi-filter Drilldown\n6.3 Winners Summary\n6.4 Past Elections Tab\n6.5 Print Official Tally", slant=14)
    r.draw_arrow([(258, 120), (290, 120)])
    
    # 4. Decision: if choice == 6.1 (Live Results)
    r.draw_decision(530, 120, 95, 65, "if choice\n== 6.1")
    r.draw_arrow([(450, 120), (482, 120)])
    
    # Down branch 6.1: Live WebSocket Tallies
    r.draw_display(530, 230, 135, 50, "Connect Realtime\nWebSocket Channel")
    r.draw_arrow([(530, 152), (530, 205)], label="Y", label_pos="right")
    
    r.draw_display(530, 330, 135, 50, "Display Live Tally\nBars & Percentages")
    r.draw_arrow([(530, 255), (530, 305)])
    
    # 5. Decision: if choice == 6.2 (Multi-filter)
    r.draw_decision(680, 120, 95, 65, "if choice\n== 6.2")
    r.draw_arrow([(578, 120), (632, 120)], label="N", label_pos="top")
    
    # Down branch 6.2: Filters
    r.draw_data_input(680, 230, 130, 55, "Filter by Position,\nVoter Grade / Section")
    r.draw_arrow([(680, 152), (680, 202)], label="Y", label_pos="right")
    
    r.draw_process(680, 330, 130, 50, "Query Filtered Vote\nCounts from Server")
    r.draw_arrow([(680, 258), (680, 305)])
    
    # 6. Decision: if choice == 6.3 (Winners Summary)
    r.draw_decision(830, 120, 95, 65, "if choice\n== 6.3")
    r.draw_arrow([(728, 120), (782, 120)], label="N", label_pos="top")
    
    # Down branch 6.3: Winners Leaderboard
    r.draw_display(830, 230, 135, 50, "Compute Top Vote\nper Position Group")
    r.draw_arrow([(830, 152), (830, 205)], label="Y", label_pos="right")
    
    r.draw_display(830, 330, 135, 50, "Display Golden\nWinner Badges")
    r.draw_arrow([(830, 255), (830, 305)])
    
    # 7. Decision: if choice == 6.4 (Past Elections / History Tab)
    r.draw_decision(980, 120, 95, 65, "if choice\n== 6.4")
    r.draw_arrow([(878, 120), (932, 120)], label="N", label_pos="top")
    
    # Down branch 6.4: History Tab
    r.draw_data_input(980, 230, 130, 55, "Select Archived\nSchool Year (S.Y.)")
    r.draw_arrow([(980, 152), (980, 202)], label="Y", label_pos="right")
    
    r.draw_display(980, 330, 135, 50, "Display Historical\nResults Snapshot")
    r.draw_arrow([(980, 258), (980, 305)])
    
    # 8. Decision: if choice == 6.5 (Print Official Tally Sheet)
    r.draw_decision(980, 460, 95, 65, "if choice\n== 6.5")
    r.draw_arrow([(1028, 120), (1080, 120), (1080, 460), (1028, 460)], label="N", label_pos="top")
    
    # Loop back for choice 6.5 'N'
    r.draw_arrow([(980, 492), (980, 560), (370, 560), (370, 175)], label="N", label_pos="bottom")
    
    # Down branch 6.5: Official Print Layout
    r.draw_process(830, 460, 135, 50, "Render BNHS Seal\n& Official Letterhead")
    r.draw_arrow([(932, 460), (898, 460)], label="Y", label_pos="top")
    
    r.draw_display(680, 460, 135, 50, "Open Browser Print\n/ PDF Save Dialog")
    r.draw_arrow([(762, 460), (748, 460)])
    
    out_path = os.path.join(FIGURES_DIR, "figure8_results_flowchart.png")
    r.save(out_path)
    return out_path


def main():
    print("Generating all flowchart diagram figures...")
    generate_figure_2()
    generate_figure_3()
    generate_figure_4()
    generate_figure_5()
    generate_figure_6()
    generate_figure_7()
    generate_figure_8()
    print("All figures successfully generated!")

if __name__ == "__main__":
    main()
