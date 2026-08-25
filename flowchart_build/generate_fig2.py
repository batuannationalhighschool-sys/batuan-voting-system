import os
import sys
sys.path.append(os.path.dirname(__file__))
from flowchart_renderer import FlowchartRenderer

def generate_figure_2():
    """Figure 2. Landing Page & Authentication Flowchart"""
    r = FlowchartRenderer(1100, 780)
    
    # 1. Start node
    r.draw_terminal(70, 140, 80, 44, "START")
    
    # 2. Main Choices Parallelogram
    r.draw_parallelogram(230, 140, 180, 110, "Choices:\nA. Overview / Home\nB. View Candidates\nC. Live Results\nD. Sign In", slant=18)
    
    # Arrow Start -> Choices
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
    r.draw_arrow([(888, 140), (940, 140), (940, 40), (230, 40), (230, 85)], label="N", label_pos="top")
    
    # Down branch D (Sign in flow)
    r.draw_data_input(840, 245, 120, 55, "LRN (12 digits)\nPassword")
    r.draw_arrow([(840, 172), (840, 218)], label="Y", label_pos="right")
    
    # Decision: Valid credentials?
    r.draw_decision(840, 345, 105, 65, "credentials\nvalid?")
    r.draw_arrow([(840, 272), (840, 312)])
    
    # Invalid credentials branch
    r.draw_display(975, 345, 120, 48, "Display Login\nError Toast")
    r.draw_arrow([(892, 345), (915, 345)], label="N", label_pos="top")
    r.draw_arrow([(975, 321), (975, 245), (900, 245)])
    
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
    r.draw_offpage_connector(840, 710, 120, 55, "Student Voter\nDashboard", direction='down')
    r.draw_arrow([(840, 620), (840, 682)], label="N", label_pos="right")
    r.draw_arrow([(930, 680), (900, 680), (900, 710), (900, 710)])
    
    out_path = os.path.join(os.path.dirname(__file__), "figures", "figure2_landing_page.png")
    r.save(out_path)
    return out_path

if __name__ == "__main__":
    generate_figure_2()
