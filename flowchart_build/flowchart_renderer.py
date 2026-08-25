import os
import math
from PIL import Image, ImageDraw, ImageFont

# Canvas Configuration
BG_COLOR = (255, 255, 255)
LINE_COLOR = (0, 0, 0)
FILL_COLOR = (255, 255, 255)
TEXT_COLOR = (0, 0, 0)
LINE_WIDTH = 2
SCALE = 2  # Supersampling for ultra-crisp output

# Font paths
FONT_REGULAR_PATH = 'C:/Windows/Fonts/arial.ttf'
FONT_BOLD_PATH = 'C:/Windows/Fonts/arialbd.ttf'

def get_fonts(scale=SCALE):
    return {
        'title': ImageFont.truetype(FONT_BOLD_PATH, int(18 * scale)),
        'header': ImageFont.truetype(FONT_BOLD_PATH, int(14 * scale)),
        'body': ImageFont.truetype(FONT_REGULAR_PATH, int(12 * scale)),
        'body_bold': ImageFont.truetype(FONT_BOLD_PATH, int(12 * scale)),
        'small': ImageFont.truetype(FONT_REGULAR_PATH, int(10.5 * scale)),
        'small_bold': ImageFont.truetype(FONT_BOLD_PATH, int(10.5 * scale)),
        'tiny': ImageFont.truetype(FONT_REGULAR_PATH, int(9.5 * scale)),
        'branch': ImageFont.truetype(FONT_BOLD_PATH, int(11 * scale)),
    }

class FlowchartRenderer:
    def __init__(self, width, height, scale=SCALE):
        self.scale = scale
        self.width = width
        self.height = height
        self.img = Image.new('RGB', (int(width * scale), int(height * scale)), BG_COLOR)
        self.draw = ImageDraw.Draw(self.img)
        self.fonts = get_fonts(scale)

    def draw_text_centered(self, text, cx, cy, font_name='body', color=TEXT_COLOR, line_spacing=4):
        font = self.fonts[font_name]
        lines = text.split('\n')
        line_heights = []
        line_widths = []
        for line in lines:
            bbox = self.draw.textbbox((0, 0), line, font=font)
            line_widths.append(bbox[2] - bbox[0])
            line_heights.append(bbox[3] - bbox[1])
        
        total_h = sum(line_heights) + (len(lines) - 1) * int(line_spacing * self.scale)
        start_y = int(cy * self.scale) - total_h // 2
        
        cur_y = start_y
        for i, line in enumerate(lines):
            lw = line_widths[i]
            x = int(cx * self.scale) - lw // 2
            self.draw.text((x, cur_y), line, font=font, fill=color)
            cur_y += line_heights[i] + int(line_spacing * self.scale)

    def draw_text_left(self, text, x, y, font_name='body', color=TEXT_COLOR, line_spacing=4):
        font = self.fonts[font_name]
        lines = text.split('\n')
        cur_y = int(y * self.scale)
        for line in lines:
            self.draw.text((int(x * self.scale), cur_y), line, font=font, fill=color)
            bbox = self.draw.textbbox((0, 0), line, font=font)
            cur_y += (bbox[3] - bbox[1]) + int(line_spacing * self.scale)

    def draw_terminal(self, cx, cy, w, h, text="START"):
        x1 = int((cx - w / 2) * self.scale)
        y1 = int((cy - h / 2) * self.scale)
        x2 = int((cx + w / 2) * self.scale)
        y2 = int((cy + h / 2) * self.scale)
        r = int(h / 2 * self.scale)
        
        self.draw.rounded_rectangle([x1, y1, x2, y2], radius=r, fill=FILL_COLOR, outline=LINE_COLOR, width=int(LINE_WIDTH * self.scale))
        self.draw_text_centered(text, cx, cy, font_name='body_bold')

    def draw_process(self, cx, cy, w, h, text, font_name='body'):
        x1 = int((cx - w / 2) * self.scale)
        y1 = int((cy - h / 2) * self.scale)
        x2 = int((cx + w / 2) * self.scale)
        y2 = int((cy + h / 2) * self.scale)
        
        self.draw.rectangle([x1, y1, x2, y2], fill=FILL_COLOR, outline=LINE_COLOR, width=int(LINE_WIDTH * self.scale))
        self.draw_text_centered(text, cx, cy, font_name=font_name)

    def draw_decision(self, cx, cy, w, h, text, font_name='body'):
        cx_s = int(cx * self.scale)
        cy_s = int(cy * self.scale)
        hw_s = int(w / 2 * self.scale)
        hh_s = int(h / 2 * self.scale)
        
        points = [
            (cx_s, cy_s - hh_s), # Top
            (cx_s + hw_s, cy_s), # Right
            (cx_s, cy_s + hh_s), # Bottom
            (cx_s - hw_s, cy_s), # Left
        ]
        self.draw.polygon(points, fill=FILL_COLOR, outline=LINE_COLOR, width=int(LINE_WIDTH * self.scale))
        self.draw_text_centered(text, cx, cy, font_name=font_name)

    def draw_parallelogram(self, cx, cy, w, h, text, slant=18, align='left', font_name='body'):
        cx_s = int(cx * self.scale)
        cy_s = int(cy * self.scale)
        hw_s = int(w / 2 * self.scale)
        hh_s = int(h / 2 * self.scale)
        sl_s = int(slant * self.scale)
        
        points = [
            (cx_s - hw_s + sl_s, cy_s - hh_s),  # Top-left
            (cx_s + hw_s, cy_s - hh_s),         # Top-right
            (cx_s + hw_s - sl_s, cy_s + hh_s),  # Bottom-right
            (cx_s - hw_s, cy_s + hh_s),         # Bottom-left
        ]
        self.draw.polygon(points, fill=FILL_COLOR, outline=LINE_COLOR, width=int(LINE_WIDTH * self.scale))
        if align == 'left':
            self.draw_text_left(text, cx - w / 2 + slant + 10, cy - h / 2 + 10, font_name=font_name)
        else:
            self.draw_text_centered(text, cx, cy, font_name=font_name)

    def draw_display(self, cx, cy, w, h, text, font_name='body'):
        cx_s = int(cx * self.scale)
        cy_s = int(cy * self.scale)
        hw_s = int(w / 2 * self.scale)
        hh_s = int(h / 2 * self.scale)
        
        x1 = cx_s - hw_s
        y1 = cy_s - hh_s
        x2 = cx_s + hw_s
        y2 = cy_s + hh_s
        r = hh_s
        
        self.draw.rounded_rectangle([x1, y1, x2, y2], radius=r, fill=FILL_COLOR, outline=LINE_COLOR, width=int(LINE_WIDTH * self.scale))
        self.draw_text_centered(text, cx, cy, font_name=font_name)

    def draw_data_input(self, cx, cy, w, h, text, font_name='body'):
        cx_s = int(cx * self.scale)
        cy_s = int(cy * self.scale)
        hw_s = int(w / 2 * self.scale)
        hh_s = int(h / 2 * self.scale)
        sl_s = int(14 * self.scale)
        
        points = [
            (cx_s - hw_s, cy_s - hh_s + sl_s), # Top-left (slanted down)
            (cx_s + hw_s, cy_s - hh_s),        # Top-right
            (cx_s + hw_s, cy_s + hh_s),        # Bottom-right
            (cx_s - hw_s, cy_s + hh_s),        # Bottom-left
        ]
        self.draw.polygon(points, fill=FILL_COLOR, outline=LINE_COLOR, width=int(LINE_WIDTH * self.scale))
        self.draw_text_centered(text, cx, cy + 4, font_name=font_name)

    def draw_offpage_connector(self, cx, cy, w, h, text, direction='right'):
        cx_s = int(cx * self.scale)
        cy_s = int(cy * self.scale)
        hw_s = int(w / 2 * self.scale)
        hh_s = int(h / 2 * self.scale)
        
        if direction == 'right':
            tip = int(14 * self.scale)
            points = [
                (cx_s - hw_s, cy_s - hh_s),
                (cx_s + hw_s - tip, cy_s - hh_s),
                (cx_s + hw_s, cy_s),
                (cx_s + hw_s - tip, cy_s + hh_s),
                (cx_s - hw_s, cy_s + hh_s),
            ]
            self.draw.polygon(points, fill=FILL_COLOR, outline=LINE_COLOR, width=int(LINE_WIDTH * self.scale))
            self.draw_text_centered(text, cx - 3, cy, font_name='body_bold')
        elif direction == 'down':
            tip = int(14 * self.scale)
            points = [
                (cx_s - hw_s, cy_s - hh_s),
                (cx_s + hw_s, cy_s - hh_s),
                (cx_s + hw_s, cy_s + hh_s - tip),
                (cx_s, cy_s + hh_s),
                (cx_s - hw_s, cy_s + hh_s - tip),
            ]
            self.draw.polygon(points, fill=FILL_COLOR, outline=LINE_COLOR, width=int(LINE_WIDTH * self.scale))
            self.draw_text_centered(text, cx, cy - 3, font_name='body_bold')
        elif direction == 'left':
            tip = int(14 * self.scale)
            points = [
                (cx_s - hw_s + tip, cy_s - hh_s),
                (cx_s + hw_s, cy_s - hh_s),
                (cx_s + hw_s, cy_s + hh_s),
                (cx_s - hw_s + tip, cy_s + hh_s),
                (cx_s - hw_s, cy_s),
            ]
            self.draw.polygon(points, fill=FILL_COLOR, outline=LINE_COLOR, width=int(LINE_WIDTH * self.scale))
            self.draw_text_centered(text, cx + 3, cy, font_name='body_bold')

    def draw_circle_connector(self, cx, cy, r, text):
        cx_s = int(cx * self.scale)
        cy_s = int(cy * self.scale)
        r_s = int(r * self.scale)
        
        self.draw.ellipse([cx_s - r_s, cy_s - r_s, cx_s + r_s, cy_s + r_s], fill=FILL_COLOR, outline=LINE_COLOR, width=int(LINE_WIDTH * self.scale))
        self.draw_text_centered(text, cx, cy, font_name='body_bold')

    def draw_label(self, text, x, y, font_name='branch', color=TEXT_COLOR):
        font = self.fonts[font_name]
        self.draw.text((int(x * self.scale), int(y * self.scale)), text, font=font, fill=color)

    def draw_arrow(self, points, label=None, label_pos='top', arrowhead=True):
        scaled_points = [(int(p[0] * self.scale), int(p[1] * self.scale)) for p in points]
        
        for i in range(len(scaled_points) - 1):
            p1 = scaled_points[i]
            p2 = scaled_points[i + 1]
            self.draw.line([p1, p2], fill=LINE_COLOR, width=int(LINE_WIDTH * self.scale))
            
        if arrowhead and len(scaled_points) >= 2:
            p_end = scaled_points[-1]
            p_prev = scaled_points[-2]
            dx = p_end[0] - p_prev[0]
            dy = p_end[1] - p_prev[1]
            angle = math.atan2(dy, dx)
            
            arrow_len = 10 * self.scale
            arrow_w = 6 * self.scale
            
            x1 = p_end[0] - arrow_len * math.cos(angle) + arrow_w * math.sin(angle)
            y1 = p_end[1] - arrow_len * math.sin(angle) - arrow_w * math.cos(angle)
            x2 = p_end[0] - arrow_len * math.cos(angle) - arrow_w * math.sin(angle)
            y2 = p_end[1] - arrow_len * math.sin(angle) + arrow_w * math.cos(angle)
            
            self.draw.polygon([p_end, (x1, y1), (x2, y2)], fill=LINE_COLOR)
            
        if label:
            p0 = points[0]
            mx = p0[0]
            my = p0[1]
            font = self.fonts['branch']
            if label_pos == 'top':
                self.draw.text((int((mx + 6) * self.scale), int((my - 18) * self.scale)), label, font=font, fill=TEXT_COLOR)
            elif label_pos == 'right':
                self.draw.text((int((mx + 6) * self.scale), int((my + 4) * self.scale)), label, font=font, fill=TEXT_COLOR)
            elif label_pos == 'left':
                self.draw.text((int((mx - 20) * self.scale), int((my + 4) * self.scale)), label, font=font, fill=TEXT_COLOR)
            elif label_pos == 'bottom':
                self.draw.text((int((mx + 6) * self.scale), int((my + 6) * self.scale)), label, font=font, fill=TEXT_COLOR)

    def save(self, filepath):
        self.img.save(filepath, format='PNG', dpi=(300, 300))
        print(f"Saved: {filepath} ({self.img.size[0]}x{self.img.size[1]})")
