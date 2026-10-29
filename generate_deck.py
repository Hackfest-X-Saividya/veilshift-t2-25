import os
import pptx
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# ---------------------------------------------------------------------------
# FRIDAY Pitch Deck Generator: 16:9 Widescreen Professional Deck
# ---------------------------------------------------------------------------

def create_deck(output_path="FRIDAY_Security_Pitch_Deck.pptx"):
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Theme Palette (Cyber Executive Dark Theme)
    BG_DARK = RGBColor(11, 15, 25)           # #0B0F19
    CARD_BG = RGBColor(18, 24, 38)           # #121826
    CARD_BG_ALT = RGBColor(22, 30, 48)       # #161E30
    CARD_BORDER = RGBColor(38, 50, 77)       # #26324D
    CARD_BORDER_CYAN = RGBColor(0, 229, 255) # #00E5FF
    
    CYAN = RGBColor(0, 229, 255)             # #00E5FF Electric Cyan
    EMERALD = RGBColor(16, 185, 129)         # #10B981 Neon Emerald
    PURPLE = RGBColor(168, 85, 247)          # #A855F7 Radiant Purple
    AMBER = RGBColor(245, 158, 11)           # #F59E0B Amber
    CRIMSON = RGBColor(239, 68, 68)          # #EF4444 Crimson Red
    
    TEXT_WHITE = RGBColor(255, 255, 255)     # #FFFFFF
    TEXT_LIGHT = RGBColor(226, 232, 240)     # #E2E8F0
    TEXT_MUTED = RGBColor(148, 163, 184)     # #94A3B8
    TEXT_DIM = RGBColor(100, 116, 139)       # #64748B

    def set_slide_background(slide):
        background = slide.background
        fill = background.fill
        fill.solid()
        fill.fore_color.rgb = BG_DARK

    def add_header(slide, kicker, title, subtitle=None):
        # Kicker Badge / Text
        tx_kicker = slide.shapes.add_textbox(Inches(0.8), Inches(0.45), Inches(11.5), Inches(0.35))
        tf_k = tx_kicker.text_frame
        tf_k.word_wrap = True
        tf_k.margin_left = tf_k.margin_top = tf_k.margin_right = tf_k.margin_bottom = 0
        p_k = tf_k.paragraphs[0]
        p_k.text = kicker.upper()
        p_k.font.name = "Segoe UI"
        p_k.font.size = Pt(11)
        p_k.font.bold = True
        p_k.font.color.rgb = CYAN

        # Title
        tx_title = slide.shapes.add_textbox(Inches(0.8), Inches(0.75), Inches(11.5), Inches(0.6))
        tf_t = tx_title.text_frame
        tf_t.word_wrap = True
        tf_t.margin_left = tf_t.margin_top = tf_t.margin_right = tf_t.margin_bottom = 0
        p_t = tf_t.paragraphs[0]
        p_t.text = title
        p_t.font.name = "Segoe UI"
        p_t.font.size = Pt(24)
        p_t.font.bold = True
        p_t.font.color.rgb = TEXT_WHITE

        # Subtitle
        if subtitle:
            tx_sub = slide.shapes.add_textbox(Inches(0.8), Inches(1.35), Inches(11.5), Inches(0.45))
            tf_s = tx_sub.text_frame
            tf_s.word_wrap = True
            tf_s.margin_left = tf_s.margin_top = tf_s.margin_right = tf_s.margin_bottom = 0
            p_s = tf_s.paragraphs[0]
            p_s.text = subtitle
            p_s.font.name = "Segoe UI"
            p_s.font.size = Pt(13)
            p_s.font.color.rgb = TEXT_MUTED

        # Thin cyan accent divider line
        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.85), Inches(11.733), Inches(0.02))
        line.fill.solid()
        line.fill.fore_color.rgb = RGBColor(28, 38, 59)
        line.line.color.rgb = RGBColor(28, 38, 59)

    def add_footer(slide, current_slide, total_slides=12):
        tx_foot = slide.shapes.add_textbox(Inches(0.8), Inches(7.05), Inches(9.0), Inches(0.3))
        tf = tx_foot.text_frame
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = "FRIDAY Security  |  Explainable Zero-Day Security & Autonomous Virtual Hotpatching"
        p.font.name = "Segoe UI"
        p.font.size = Pt(9)
        p.font.color.rgb = TEXT_DIM

        tx_num = slide.shapes.add_textbox(Inches(11.5), Inches(7.05), Inches(1.0), Inches(0.3))
        tf_n = tx_num.text_frame
        tf_n.margin_left = tf_n.margin_top = tf_n.margin_right = tf_n.margin_bottom = 0
        p_n = tf_n.paragraphs[0]
        p_n.alignment = PP_ALIGN.RIGHT
        p_n.text = f"{current_slide:02d} / {total_slides:02d}"
        p_n.font.name = "Segoe UI"
        p_n.font.size = Pt(9)
        p_n.font.bold = True
        p_n.font.color.rgb = CYAN

    def set_notes(slide, notes_text):
        notes_slide = slide.notes_slide
        tf = notes_slide.notes_text_frame
        tf.text = notes_text

    def create_card(slide, left, top, width, height, bg_color=CARD_BG, border_color=CARD_BORDER, border_width=1):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color
        card.line.color.rgb = border_color
        card.line.width = Pt(border_width)
        return card

    # =========================================================================
    # SLIDE 1: Title & Hero Slide (The Hook)
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_background(s1)

    # Hero glowing container
    hero_card = create_card(s1, Inches(0.8), Inches(0.8), Inches(11.733), Inches(5.9), bg_color=CARD_BG, border_color=CARD_BORDER, border_width=1.5)

    # Top Brand Kicker
    tx = s1.shapes.add_textbox(Inches(1.2), Inches(1.2), Inches(10.9), Inches(0.4))
    tf = tx.text_frame
    p = tf.paragraphs[0]
    p.text = "AUTONOMOUS APPLICATION SECURITY PLATFORM  ·  OFFICIAL DEFENSE PITCH"
    p.font.name = "Segoe UI"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = CYAN

    # Main Project Title
    tx = s1.shapes.add_textbox(Inches(1.2), Inches(1.65), Inches(10.9), Inches(1.2))
    tf = tx.text_frame
    p = tf.paragraphs[0]
    p.text = "FRIDAY"
    p.font.name = "Segoe UI"
    p.font.size = Pt(56)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE

    # Headline Subtitle
    tx = s1.shapes.add_textbox(Inches(1.2), Inches(2.85), Inches(10.9), Inches(0.8))
    tf = tx.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "Explainable Zero-Day Security & Autonomous Virtual Hotpatching"
    p.font.name = "Segoe UI"
    p.font.size = Pt(22)
    p.font.bold = True
    p.font.color.rgb = CYAN

    # Value Description
    tx = s1.shapes.add_textbox(Inches(1.2), Inches(3.45), Inches(10.5), Inches(0.7))
    tf = tx.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "Deterministic Client-Side AST Taint Analysis  ×  NVIDIA Nemotron 3.5 Super VL Reasoning Engine"
    p.font.name = "Segoe UI"
    p.font.size = Pt(14)
    p.font.color.rgb = TEXT_LIGHT

    # 3 Bottom Value Pillar Cards
    pillars = [
        ("ZERO-KNOWLEDGE PRIVACY", "100% In-Browser Execution", "0 LOC transmitted to remote servers or cloud AI. Code is parsed locally; company IP never leaks.", EMERALD),
        ("NO CVE REGISTRY NEEDED", "Grammar AST Taint Flow", "Detects novel zero-day execution reachability via mathematical graph traversal before a CVE exists.", CYAN),
        ("CLOSING THE 60-DAY GAP", "Instant Virtual Hotpatching", "Autonomous drop-in middleware & Cloudflare/ModSecurity WAF rules synthesized in under 30 seconds.", PURPLE)
    ]

    for i, (kicker, head, body, accent_col) in enumerate(pillars):
        x = Inches(1.2 + i * 3.7)
        c = create_card(s1, x, Inches(4.3), Inches(3.5), Inches(2.1), bg_color=CARD_BG_ALT, border_color=accent_col, border_width=1)
        
        tx = s1.shapes.add_textbox(x + Inches(0.2), Inches(4.45), Inches(3.1), Inches(1.8))
        tf = tx.text_frame
        tf.word_wrap = True
        
        p0 = tf.paragraphs[0]
        p0.text = kicker
        p0.font.name = "Segoe UI"
        p0.font.size = Pt(10)
        p0.font.bold = True
        p0.font.color.rgb = accent_col
        
        p1 = tf.add_paragraph()
        p1.text = head
        p1.font.name = "Segoe UI"
        p1.font.size = Pt(13)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE
        p1.space_before = Pt(4)
        
        p2 = tf.add_paragraph()
        p2.text = body
        p2.font.name = "Segoe UI"
        p2.font.size = Pt(10.5)
        p2.font.color.rgb = TEXT_MUTED
        p2.space_before = Pt(4)

    set_notes(s1, """SPEAKER SCRIPT (Slide 1 - 0:00 to 0:45):
"Good morning, judges. Today we are proud to present FRIDAY: an explainable code security and zero-day defense platform that eliminates the two greatest vulnerabilities facing modern enterprises: the 60-day patching window, and the cloud AI privacy hazard.

Most security scanners either rely on outdated CVE signatures, or require you to upload your proprietary code to a third-party server. FRIDAY fundamentally shifts this paradigm: 100% of our code analysis runs inside the auditor's browser with zero code transmission, while combining mathematical taint flow analysis with NVIDIA Nemotron-powered virtual hotpatching to neutralize zero-days in seconds."
""")

    # =========================================================================
    # SLIDE 2: The Core Problem
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_background(s2)
    add_header(s2, "THE INDUSTRY CRISIS", "The 60-Day Zero-Day Dilemma & The Privacy Hazard", 
               "Why traditional application security scanners (SonarQube, Snyk, Semgrep) fail modern enterprise engineering teams.")
    add_footer(s2, 2)

    problems = [
        ("01", "The Zero-Day Blindspot", "0 CVEs in Databases", 
         "Conventional SAST tools rely strictly on known signature registries and rigid pattern databases. Novel zero-day logic flaws, unsanitized route parameters, and complex AST execution sinks remain 100% invisible because no CVE exists yet.", CRIMSON),
        ("02", "The 60-Day Exposure Window", "45 to 60 Days Lag", 
         "When a high-severity vulnerability is confirmed, enterprise engineering teams take an average of 45-60 days to triage, assign, write code patches, test regressions, and deploy. During this window, production systems remain defenseless.", AMBER),
        ("03", "The Cloud Privacy Trap", "100% IP Exfiltration", 
         "Modern 'AI-powered' scanners require shipping proprietary enterprise repositories to remote third-party cloud LLMs. This directly violates SOC2, HIPAA, GDPR compliance and exposes confidential intellectual property to leakage.", PURPLE)
    ]

    for i, (num, title, stat, desc, col) in enumerate(problems):
        x = Inches(0.8 + i * 4.0)
        card = create_card(s2, x, Inches(2.1), Inches(3.733), Inches(4.6), bg_color=CARD_BG, border_color=CARD_BORDER)

        # Number pill
        tx = s2.shapes.add_textbox(x + Inches(0.3), Inches(2.3), Inches(3.1), Inches(0.4))
        tf = tx.text_frame
        p = tf.paragraphs[0]
        p.text = f"CRITICAL FLAW #{num}"
        p.font.name = "Segoe UI"
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = col

        # Title
        tx_t = s2.shapes.add_textbox(x + Inches(0.3), Inches(2.7), Inches(3.1), Inches(0.7))
        tf_t = tx_t.text_frame
        tf_t.word_wrap = True
        p_t = tf_t.paragraphs[0]
        p_t.text = title
        p_t.font.name = "Segoe UI"
        p_t.font.size = Pt(17)
        p_t.font.bold = True
        p_t.font.color.rgb = TEXT_WHITE

        # Stat Card
        stat_box = create_card(s2, x + Inches(0.3), Inches(3.45), Inches(3.133), Inches(0.85), bg_color=CARD_BG_ALT, border_color=col)
        tx_st = s2.shapes.add_textbox(x + Inches(0.4), Inches(3.55), Inches(2.9), Inches(0.65))
        tf_st = tx_st.text_frame
        p_st = tf_st.paragraphs[0]
        p_st.text = stat
        p_st.font.name = "Segoe UI"
        p_st.font.size = Pt(16)
        p_st.font.bold = True
        p_st.font.color.rgb = col

        # Description
        tx_d = s2.shapes.add_textbox(x + Inches(0.3), Inches(4.5), Inches(3.133), Inches(2.0))
        tf_d = tx_d.text_frame
        tf_d.word_wrap = True
        p_d = tf_d.paragraphs[0]
        p_d.text = desc
        p_d.font.name = "Segoe UI"
        p_d.font.size = Pt(11.5)
        p_d.font.color.rgb = TEXT_MUTED

    set_notes(s2, """SPEAKER SCRIPT (Slide 2 - 0:45 to 1:30):
"Let's look at why current AppSec pipelines fail when it matters most.
First, traditional scanners like SonarQube or Snyk look backward: they search for known CVE signatures. If a developer introduces a bespoke dataflow trap in Python or TypeScript that has no CVE, it passes right through to production.
Second, the remediation gap: finding a flaw is only 10% of the battle. It takes 45 to 60 days on average to write, test, and ship a production refactor. What protects the server tonight? Nothing.
Third, modern cloud AI security tools demand that you upload your secret source code to an external cloud API. For regulated banking, healthcare, and enterprise teams, that's an immediate non-starter."
""")

    # =========================================================================
    # SLIDE 3: The FRIDAY Solution
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_background(s3)
    add_header(s3, "THE PARADIGM SHIFT", "The FRIDAY Solution: Real-Time Client Taint & AI Defense",
               "A revolutionary privacy-preserving architecture that proves exploitability and neutralizes zero-days instantly.")
    add_footer(s3, 3)

    solutions = [
        ("1. Zero-Day Reachability", "Deterministic AST Grammar Modeling",
         "Instead of string matches, FRIDAY tokenizes code into full Abstract Syntax Trees. It mathematically models taint propagation from untrusted ingress (HTTP query/body) to sensitive execution sinks without needing pre-existing signatures.", CYAN),
        ("2. Visual Explainability", "Interactive Graph (@xyflow/react)",
         "Eliminates alert fatigue. FRIDAY renders interactive node-and-edge graphs that visually demonstrate the unbroken dataflow pathway. If the untrusted input cannot reach the execution sink, it is never flagged as an alert.", EMERALD),
        ("3. Instant Virtual Hotpatching", "Dual-Layer Middleware & WAF Defense",
         "While developers plan long-term refactoring, FRIDAY's NVIDIA Nemotron engine generates drop-in Express/Flask middleware and perimeter ModSecurity/Cloudflare WAF rules in seconds, neutralizing zero-days immediately at the edge.", PURPLE),
        ("4. Zero-Knowledge Privacy", "100% In-Browser Execution & Storage",
         "The entire parsing, AST lexing, and taint analysis engine executes locally in the auditor's browser tab. Uploaded code is stored in client IndexedDB. Zero proprietary lines of code are ever sent to an external server or AI provider.", AMBER)
    ]

    for i, (title, tag, desc, col) in enumerate(solutions):
        col_idx = i % 2
        row_idx = i // 2
        x = Inches(0.8 + col_idx * 5.95)
        y = Inches(2.1 + row_idx * 2.4)
        
        card = create_card(s3, x, y, Inches(5.78), Inches(2.2), bg_color=CARD_BG, border_color=CARD_BORDER)
        
        # Color bar on the left edge
        bar = s3.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, Inches(0.1), Inches(2.2))
        bar.fill.solid()
        bar.fill.fore_color.rgb = col
        bar.line.fill.background()

        # Text container
        tx = s3.shapes.add_textbox(x + Inches(0.25), y + Inches(0.15), Inches(5.35), Inches(1.9))
        tf = tx.text_frame
        tf.word_wrap = True
        
        p0 = tf.paragraphs[0]
        p0.text = title.upper()
        p0.font.name = "Segoe UI"
        p0.font.size = Pt(15)
        p0.font.bold = True
        p0.font.color.rgb = TEXT_WHITE
        
        p1 = tf.add_paragraph()
        p1.text = tag
        p1.font.name = "Segoe UI"
        p1.font.size = Pt(11)
        p1.font.bold = True
        p1.font.color.rgb = col
        p1.space_before = Pt(2)
        
        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = "Segoe UI"
        p2.font.size = Pt(11)
        p2.font.color.rgb = TEXT_MUTED
        p2.space_before = Pt(4)

    set_notes(s3, """SPEAKER SCRIPT (Slide 3 - 1:30 to 2:15):
"FRIDAY is built on four core technical breakthroughs:
1. Zero-Day Reachability: We analyze the AST grammar. If user input flows from an HTTP parameter into `child_process.exec()` or `subprocess.check_output(shell=True)`, we detect it deterministically—even if that code was written this morning.
2. Visual Explainability: We replace endless CSV alert lists with interactive React Flow graphs showing the exact source-to-sink chain.
3. Autonomous Virtual Hotpatching: We close the 60-day lag by instantly producing production-ready WAF signatures and application middleware.
4. Absolute Zero-Knowledge Privacy: Everything runs client-side in the browser. Zero lines of code ever hit a remote server."
""")

    # =========================================================================
    # SLIDE 4: High-Performance System Architecture
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    set_slide_background(s4)
    add_header(s4, "SYSTEM ARCHITECTURE", "High-Performance In-Browser Triad Architecture",
               "A decoupled defense pipeline strictly separating client AST parsing, AI reasoning, and defensive enforcement.")
    add_footer(s4, 4)

    tiers = [
        ("TIER 1: CLIENT TAINT ENGINE", "Deterministic In-Browser Core",
         [
             ("Tech Stack", "Vite 8 · TanStack Start SSR · Nitro · Web Workers"),
             ("Parsing", "Python AST & TS/JS Lexer tokenizes passive code streams"),
             ("Data Storage", "Local IndexedDB via `idb-keyval` (Zero remote DB)"),
             ("Performance", "< 3.5s scan time; 0 LOC transmitted across network")
         ], CYAN),
        ("TIER 2: NVIDIA NEMOTRON AI", "Zero-Day Exploitability Triage",
         [
             ("Model", "NVIDIA Nemotron 3.5 Super VL (120B Parameters)"),
             ("Interface", "Streaming Integrate API with thinking reasoning tokens"),
             ("Synthesis", "Analyzes Ingress Vector, Constraint Gaps, & Impact"),
             ("Privacy Boundary", "Strictly scrubbed: Only category & framework transmitted")
         ], PURPLE),
        ("TIER 3: VIRTUAL HOTPATCHING", "Autonomous Defense & Verification",
         [
             ("Perimeter WAF", "Instant ModSecurity CRS / Cloudflare regex rules"),
             ("App Middleware", "Drop-in Node/Express & Python input sanitizers"),
             ("Verification", "Deterministic 'System Check' AST re-evaluator"),
             ("Countermeasure Lab", "Interactive symbolic sandbox with live probes")
         ], EMERALD)
    ]

    for i, (tier_title, tier_sub, bullet_list, accent_col) in enumerate(tiers):
        x = Inches(0.8 + i * 4.0)
        card = create_card(s4, x, Inches(2.1), Inches(3.733), Inches(4.6), bg_color=CARD_BG, border_color=accent_col, border_width=1.5)

        tx = s4.shapes.add_textbox(x + Inches(0.25), Inches(2.3), Inches(3.233), Inches(0.8))
        tf = tx.text_frame
        tf.word_wrap = True
        
        p0 = tf.paragraphs[0]
        p0.text = tier_title
        p0.font.name = "Segoe UI"
        p0.font.size = Pt(11)
        p0.font.bold = True
        p0.font.color.rgb = accent_col
        
        p1 = tf.add_paragraph()
        p1.text = tier_sub
        p1.font.name = "Segoe UI"
        p1.font.size = Pt(15)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE
        p1.space_before = Pt(2)

        # Bullet items as structured mini-cards
        for b_idx, (b_label, b_val) in enumerate(bullet_list):
            y_box = Inches(3.25 + b_idx * 0.8)
            create_card(s4, x + Inches(0.25), y_box, Inches(3.233), Inches(0.72), bg_color=CARD_BG_ALT, border_color=CARD_BORDER)
            
            tx_b = s4.shapes.add_textbox(x + Inches(0.35), y_box + Inches(0.06), Inches(3.0), Inches(0.6))
            tf_b = tx_b.text_frame
            tf_b.word_wrap = True
            
            p_lbl = tf_b.paragraphs[0]
            p_lbl.text = b_label.upper()
            p_lbl.font.name = "Segoe UI"
            p_lbl.font.size = Pt(9)
            p_lbl.font.bold = True
            p_lbl.font.color.rgb = accent_col
            
            p_val = tf_b.add_paragraph()
            p_val.text = b_val
            p_val.font.name = "Segoe UI"
            p_val.font.size = Pt(10)
            p_val.font.color.rgb = TEXT_LIGHT

    set_notes(s4, """SPEAKER SCRIPT (Slide 4 - 2:15 to 3:00):
"Here is how FRIDAY's Triad Architecture operates under the hood.
Tier 1 is our client-side deterministic taint engine. In under 3.5 seconds, it tokenizes ASTs directly in the user's browser, tracing inputs to sinks and caching everything in IndexedDB.
Tier 2 is our NVIDIA Nemotron 3.5 Super VL integration. Notice our strict privacy barrier: we scrub the payload completely. We send only the abstract vulnerability category and target framework—never the user's proprietary source code. Nemotron then streams its reasoning tokens to formulate an exploitability rationale.
Tier 3 is our autonomous hotpatching and verification layer: generating perimeter WAF rules, drop-in application middleware, and testing the fix in our live Countermeasure Lab."
""")

    # =========================================================================
    # SLIDE 5: Vulnerability Coverage Matrix
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    set_slide_background(s5)
    add_header(s5, "ENGINE CAPABILITIES", "Zero-Day Vulnerability Coverage Matrix",
               "Grammar-level lexical taint tracking across Python and modern Full-Stack TypeScript/Node ecosystems.")
    add_footer(s5, 5)

    # Table layout
    table_shape = s5.shapes.add_table(8, 5, Inches(0.8), Inches(2.1), Inches(11.733), Inches(4.5))
    table = table_shape.table

    # Column widths
    table.columns[0].width = Inches(2.1)
    table.columns[1].width = Inches(1.8)
    table.columns[2].width = Inches(1.9)
    table.columns[3].width = Inches(3.8)
    table.columns[4].width = Inches(2.133)

    headers = ["RULE ID", "CATEGORY", "TARGET STACK", "DETECTION MECHANISM & TAINT SINK", "SEVERITY & IMPACT"]
    for j, h in enumerate(headers):
        cell = table.cell(0, j)
        cell.fill.solid()
        cell.fill.fore_color.rgb = RGBColor(16, 24, 40)
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.name = "Segoe UI"
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = CYAN

    matrix_data = [
        ("NODE-CMDI-004", "Command Injection", "Node.js, Express, TS", "Traces req.query/body into child_process.exec() lacking argument arrays", "CRITICAL (Host Shell)"),
        ("NODE-SQLI-005", "SQL Injection", "Node.js, pg, mysql2", "Identifies dynamic ES6 template literals assigned to unparameterized clients", "CRITICAL (Data Breach)"),
        ("REACT-XSS-001", "Cross-Site Scripting", "React, Next.js, TSX", "Flags dangerouslySetInnerHTML without DOMPurify.sanitize() wrapper", "HIGH (Session Theft)"),
        ("JS-CODE-EVAL-003", "Code Execution", "JavaScript, TypeScript", "Flags dynamic evaluation: eval(), new Function(), and string timer sinks", "CRITICAL (RCE)"),
        ("PY-SQLI-001", "SQL Injection", "Python, Flask, FastAPI", "Lexically tracks f-strings & % formatting reaching db.execute() & cursor", "CRITICAL (Database Dump)"),
        ("PY-CMDI-001", "Command Injection", "Python, Flask, FastAPI", "Traces route variables into os.system, os.popen, or subprocess(shell=True)", "CRITICAL (Container RCE)"),
        ("WEB-LEAKED-SECRET", "Secret Exposure", "All Files / Bundles", "Entropy scanner detecting hardcoded JWT secrets, AWS tokens, API keys", "HIGH (Privilege Escalation)")
    ]

    for row_idx, row_data in enumerate(matrix_data, start=1):
        bg_col = CARD_BG if row_idx % 2 == 1 else CARD_BG_ALT
        for col_idx, cell_value in enumerate(row_data):
            cell = table.cell(row_idx, col_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = bg_col
            p = cell.text_frame.paragraphs[0]
            p.text = cell_value
            p.font.name = "Segoe UI"
            p.font.size = Pt(9.5)
            
            if col_idx == 0:
                p.font.bold = True
                p.font.color.rgb = CYAN
            elif col_idx == 4:
                p.font.bold = True
                p.font.color.rgb = CRIMSON if "CRITICAL" in cell_value else AMBER
            else:
                p.font.color.rgb = TEXT_LIGHT

    set_notes(s5, """SPEAKER SCRIPT (Slide 5 - 3:00 to 3:45):
"Let's look at the actual vulnerability coverage.
FRIDAY ships with two dual-engine parsers: one for Python web frameworks (Flask, FastAPI, SQLAlchemy) and one for TypeScript, React, and Node.js.
Notice the depth of these rules: we don't look for CVE keywords. In `NODE-CMDI-004`, we trace parameter ingress directly into `child_process.exec()`. In `REACT-XSS-001`, we verify whether `DOMPurify.sanitize()` wraps `dangerouslySetInnerHTML`.
Because we analyze the grammar and taint graph directly, novel logic flaws introduced in zero-day commits are flagged with mathematical accuracy."
""")

    # =========================================================================
    # SLIDE 6: Visual Explainability (Flow Graph)
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    set_slide_background(s6)
    add_header(s6, "VISUAL EXPLAINABILITY", "Mathematical Proof of Exploitability via Flow Graphs",
               "Replacing 500-line static warning lists with deterministic, verifiable source-to-sink pathways.")
    add_footer(s6, 6)

    # 3 Graph Nodes visual representation
    nodes = [
        ("NODE 1: UNTRUSTED INGRESS", "HTTP Ingress Source", "request.args['host']\nreq.query.target", "Attacker controls network payload", AMBER),
        ("NODE 2: TAINT PROPAGATOR", "Variable Flow & Concat", "cmd = f'ping -c 2 {host}'\n`SELECT * FROM users ${id}`", "Unsanitized string interpolation", PURPLE),
        ("NODE 3: SENSITIVE SINK", "Unconstrained Execution", "subprocess.check_output(..., shell=True)\nchild_process.exec()", "Arbitrary command execution on host", CRIMSON)
    ]

    for i, (n_tag, n_title, n_code, n_expl, n_col) in enumerate(nodes):
        x = Inches(0.8 + i * 4.0)
        card = create_card(s6, x, Inches(2.1), Inches(3.733), Inches(2.7), bg_color=CARD_BG, border_color=n_col, border_width=1.5)

        tx = s6.shapes.add_textbox(x + Inches(0.2), Inches(2.25), Inches(3.333), Inches(0.5))
        tf = tx.text_frame
        p = tf.paragraphs[0]
        p.text = n_tag
        p.font.name = "Segoe UI"
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = n_col

        p_t = tf.add_paragraph()
        p_t.text = n_title
        p_t.font.name = "Segoe UI"
        p_t.font.size = Pt(14)
        p_t.font.bold = True
        p_t.font.color.rgb = TEXT_WHITE

        # Code block
        code_box = create_card(s6, x + Inches(0.2), Inches(3.05), Inches(3.333), Inches(1.0), bg_color=RGBColor(15, 23, 42), border_color=CARD_BORDER)
        tx_c = s6.shapes.add_textbox(x + Inches(0.25), Inches(3.1), Inches(3.2), Inches(0.9))
        tf_c = tx_c.text_frame
        tf_c.word_wrap = True
        p_c = tf_c.paragraphs[0]
        p_c.text = n_code
        p_c.font.name = "Consolas"
        p_c.font.size = Pt(9.5)
        p_c.font.color.rgb = CYAN

        # Explanation
        tx_e = s6.shapes.add_textbox(x + Inches(0.2), Inches(4.15), Inches(3.333), Inches(0.55))
        tf_e = tx_e.text_frame
        p_e = tf_e.paragraphs[0]
        p_e.text = n_expl
        p_e.font.name = "Segoe UI"
        p_e.font.size = Pt(10.5)
        p_e.font.color.rgb = TEXT_MUTED

    # Bottom Explainability Callouts
    bottom_cards = [
        ("Zero False-Positive Hallucinations", "Traditional AI scanners guess based on keywords. FRIDAY requires a complete, unbroken graph edge from ingress to sink before flagging an issue.", CYAN),
        ("Instant Auditor Alignment", "Compliance auditors and developers inspect the exact same interactive visual canvas (@xyflow/react), collapsing review discussions from days to seconds.", EMERALD),
        ("0-Day Threat Surface Quick-Filter", "One-click filter instantly isolates only reachable Critical & High severity zero-day vulnerabilities, cutting through noise in production codebases.", AMBER)
    ]

    for i, (b_title, b_desc, b_col) in enumerate(bottom_cards):
        x = Inches(0.8 + i * 4.0)
        card = create_card(s6, x, Inches(5.0), Inches(3.733), Inches(1.7), bg_color=CARD_BG_ALT, border_color=CARD_BORDER)
        
        tx = s6.shapes.add_textbox(x + Inches(0.2), Inches(5.1), Inches(3.333), Inches(1.5))
        tf = tx.text_frame
        tf.word_wrap = True
        
        p = tf.paragraphs[0]
        p.text = b_title
        p.font.name = "Segoe UI"
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = b_col
        
        p1 = tf.add_paragraph()
        p1.text = b_desc
        p1.font.name = "Segoe UI"
        p1.font.size = Pt(10)
        p1.font.color.rgb = TEXT_LIGHT
        p1.space_before = Pt(3)

    set_notes(s6, """SPEAKER SCRIPT (Slide 6 - 3:45 to 4:30):
"Judges, security engineers hate alert fatigue. When a scanner outputs 500 warnings, nobody fixes them.
In FRIDAY, we provide visual explainability. We built an interactive security flow graph using React Flow.
Look at how a finding is represented:
Node 1: The untrusted user ingress.
Node 2: The concatenation and data passing step.
Node 3: The unconstrained execution sink.
This isn't an AI hallucination or a vague heuristic. It is a mathematical graph proving reachability. If an attacker cannot reach the sink from user input, FRIDAY eliminates the alert."
""")

    # =========================================================================
    # SLIDE 7: Autonomous Virtual Hotpatching
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    set_slide_background(s7)
    add_header(s7, "AUTONOMOUS REMEDIATION", "Closing the 60-Day Exposure Window in Seconds",
               "Instant defense-in-depth generated at runtime before manual code refactoring begins.")
    add_footer(s7, 7)

    # 2 Comparison Split Columns: Middleware vs WAF
    hotpatches = [
        ("DEFENSE LAYER 1: APPLICATION MIDDLEWARE", "Drop-In Input Sanitization",
         "Express / Node.js & Flask / Python Middleware",
         "FRIDAY's NVIDIA Nemotron 3.5 engine automatically generates a drop-in middleware function tailored precisely to the identified ingress parameter.",
         [
             "Intercepts raw parameters before they reach business logic",
             "Neutralizes shell metacharacters: `& | ; $ > < `",
             "Enforces strict alphanumeric regex constraints",
             "Can be committed and deployed to containers in minutes"
         ], CYAN),
        ("DEFENSE LAYER 2: PERIMETER WAF SIGNATURE", "Zero-Touch Edge Blocking",
         "Cloudflare WAF / ModSecurity Core Rule Set (CRS)",
         "For true zero-day emergencies where code cannot be immediately redeployed, FRIDAY generates instant perimeter inspection rules.",
         [
             "Deploys directly to Cloudflare, AWS WAF, or Nginx reverse proxies",
             "Blocks exploitation at the network edge in < 30 seconds",
             "Requires zero application restarts and zero downtime",
             "Buys engineering teams the full 60 days to refactor safely"
         ], EMERALD)
    ]

    for i, (kicker, title, stack, desc, points, col) in enumerate(hotpatches):
        x = Inches(0.8 + i * 5.95)
        card = create_card(s7, x, Inches(2.1), Inches(5.78), Inches(4.6), bg_color=CARD_BG, border_color=col, border_width=1.5)

        tx = s7.shapes.add_textbox(x + Inches(0.3), Inches(2.3), Inches(5.18), Inches(0.8))
        tf = tx.text_frame
        tf.word_wrap = True
        
        p = tf.paragraphs[0]
        p.text = kicker
        p.font.name = "Segoe UI"
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = col
        
        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = "Segoe UI"
        p1.font.size = Pt(17)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE
        p1.space_before = Pt(2)

        # Tech stack badge
        badge = create_card(s7, x + Inches(0.3), Inches(3.2), Inches(5.18), Inches(0.45), bg_color=CARD_BG_ALT, border_color=CARD_BORDER)
        tx_b = s7.shapes.add_textbox(x + Inches(0.4), Inches(3.25), Inches(5.0), Inches(0.35))
        tf_b = tx_b.text_frame
        p_b = tf_b.paragraphs[0]
        p_b.text = f"DEPLOYMENT TARGET: {stack}"
        p_b.font.name = "Segoe UI"
        p_b.font.size = Pt(10)
        p_b.font.bold = True
        p_b.font.color.rgb = CYAN

        # Description
        tx_d = s7.shapes.add_textbox(x + Inches(0.3), Inches(3.8), Inches(5.18), Inches(0.8))
        tf_d = tx_d.text_frame
        tf_d.word_wrap = True
        p_d = tf_d.paragraphs[0]
        p_d.text = desc
        p_d.font.name = "Segoe UI"
        p_d.font.size = Pt(11.5)
        p_d.font.color.rgb = TEXT_LIGHT

        # Bullet points
        tx_pts = s7.shapes.add_textbox(x + Inches(0.3), Inches(4.7), Inches(5.18), Inches(1.8))
        tf_pts = tx_pts.text_frame
        tf_pts.word_wrap = True
        
        for idx, pt in enumerate(points):
            p_pt = tf_pts.paragraphs[0] if idx == 0 else tf_pts.add_paragraph()
            p_pt.text = f"•  {pt}"
            p_pt.font.name = "Segoe UI"
            p_pt.font.size = Pt(11)
            p_pt.font.color.rgb = TEXT_MUTED
            p_pt.space_before = Pt(4)

    set_notes(s7, """SPEAKER SCRIPT (Slide 7 - 4:30 to 5:15):
"Now comes the most critical capability of FRIDAY: Virtual Hotpatching.
When a zero-day is discovered at 2:00 AM on a Friday, you cannot wait 60 days for a sprint cycle to refactor the codebase.
FRIDAY synthesizes two immediate defensive layers:
1. Application Middleware: A drop-in sanitizer for Express or Flask that intercepts the exact parameter and strips malicious metacharacters.
2. Perimeter WAF Rule: A ModSecurity or Cloudflare rule ready to deploy at your reverse proxy in 30 seconds.
This neutralizes exploitation at the network edge immediately, protecting your infrastructure while developers take the necessary time to refactor."
""")

    # =========================================================================
    # SLIDE 8: Interactive Verification & Countermeasure Lab
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    set_slide_background(s8)
    add_header(s8, "VERIFICATION & TESTING", "The Countermeasure Lab: Proof Before Production",
               "Deterministic AST re-verification ensures fixes actually neutralize the vulnerability.")
    add_footer(s8, 8)

    steps = [
        ("STEP 1: TRIGGER", "One-Click 'Verify Solution'", "Click 'Verify Solution with System Check' directly in the findings interface. FRIDAY extracts the candidate remediation patch and parses the proposed syntax tree.", CYAN),
        ("STEP 2: AST AUDIT", "Deterministic Re-Evaluation", "The static taint engine re-analyzes the dataflow. It explicitly verifies that sanitizers (e.g. DOMPurify, shlex.quote, parameter binding) break the reachability edge.", PURPLE),
        ("STEP 3: PROOF", "Verified Fixed Status", "Once verified, the issue status transitions to 'Verified Fixed' with a tamper-evident audit badge. The edge in the Security Graph is severed.", EMERALD)
    ]

    for i, (s_tag, s_title, s_desc, s_col) in enumerate(steps):
        x = Inches(0.8 + i * 4.0)
        card = create_card(s8, x, Inches(2.1), Inches(3.733), Inches(2.4), bg_color=CARD_BG, border_color=s_col, border_width=1.5)

        tx = s8.shapes.add_textbox(x + Inches(0.2), Inches(2.25), Inches(3.333), Inches(2.0))
        tf = tx.text_frame
        tf.word_wrap = True
        
        p = tf.paragraphs[0]
        p.text = s_tag
        p.font.name = "Segoe UI"
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = s_col
        
        p1 = tf.add_paragraph()
        p1.text = s_title
        p1.font.name = "Segoe UI"
        p1.font.size = Pt(15)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE
        p1.space_before = Pt(2)
        
        p2 = tf.add_paragraph()
        p2.text = s_desc
        p2.font.name = "Segoe UI"
        p2.font.size = Pt(10.5)
        p2.font.color.rgb = TEXT_MUTED
        p2.space_before = Pt(4)

    # Big Banner: Live Countermeasure Lab (/lab)
    lab_card = create_card(s8, Inches(0.8), Inches(4.7), Inches(11.733), Inches(2.0), bg_color=CARD_BG_ALT, border_color=CARD_BORDER_CYAN, border_width=1)
    
    tx_lab = s8.shapes.add_textbox(Inches(1.1), Inches(4.85), Inches(11.1), Inches(1.7))
    tf_lab = tx_lab.text_frame
    tf_lab.word_wrap = True
    
    p = tf_lab.paragraphs[0]
    p.text = "THE LIVE SYMBOLIC SANDBOX (/lab)"
    p.font.name = "Segoe UI"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = CYAN
    
    p1 = tf_lab.add_paragraph()
    p1.text = "Interactive Live Probe Simulator with Toggleable Countermeasures"
    p1.font.name = "Segoe UI"
    p1.font.size = Pt(16)
    p1.font.bold = True
    p1.font.color.rgb = TEXT_WHITE
    p1.space_before = Pt(2)
    
    p2 = tf_lab.add_paragraph()
    p2.text = "Allows security teams and developers to simulate hostile attack vectors (SQLi `' OR '1'='1`, Command Injection `; rm -rf /`, XSS `<script>`) in real-time against mocked AST nodes. Toggling defenses demonstrates instant payload neutralization without touching live production infrastructure."
    p2.font.name = "Segoe UI"
    p2.font.size = Pt(11)
    p2.font.color.rgb = TEXT_LIGHT
    p2.space_before = Pt(4)

    set_notes(s8, """SPEAKER SCRIPT (Slide 8 - 5:15 to 6:00):
"Anyone can generate an AI code snippet, but how do you know the fix actually works?
FRIDAY introduces the Countermeasure Lab and 'Verify Solution with System Check'.
When you click Verify, FRIDAY doesn't ask an LLM if it looks good. It re-runs our deterministic AST engine over the proposed code.
It checks mathematically: Is the untrusted parameter sanitized? Is `DOMPurify` present? Is the SQL query parameterized?
If the taint edge is broken, the status transitions to 'Verified Fixed'.
Furthermore, our `/lab` route lets developers test simulated attack payloads against active defenses in a live symbolic sandbox."
""")

    # =========================================================================
    # SLIDE 9: Self-Security & Zero-Knowledge Privacy Architecture
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    set_slide_background(s9)
    add_header(s9, "SELF-SECURITY & PRIVACY", "Who Audits the Auditor? Zero-Trust Client Sandbox",
               "Built under strict zero-trust principles to protect against hostile scanned code and IP leakage.")
    add_footer(s9, 9)

    security_pillars = [
        ("01", "Zero Code Execution", "Passive Lexical Stream",
         "Uploaded or ingested repositories are treated strictly as passive data strings. Code is tokenized symbolically—it is NEVER executed, evaluated with eval(), or spawned inside a VM or container.", CYAN),
        ("02", "Zero Remote Storage", "Local IndexedDB Isolation",
         "100% of parsed ASTs, taint graphs, and scan history persist exclusively in the browser's local IndexedDB (`idb-keyval`). No project code is ever written to a backend database or cloud bucket.", EMERALD),
        ("03", "Scrubbed AI Boundary", "0 LOC Transmitted to Cloud",
         "When calling the NVIDIA Integrate API, source code is strictly stripped. We transmit only abstract category tags (e.g. 'Command Injection') and target framework names. Your proprietary code never leaves the tab.", PURPLE),
        ("04", "DOM XSS Immunity", "Sanitized UI Rendering",
         "Hostile repositories cannot exploit the scanner interface. All rendered syntax snippets utilize strict HTML entity escaping, and all dynamic Markdown is passed through DOMPurify before DOM insertion.", AMBER)
    ]

    for i, (num, title, badge_text, desc, col) in enumerate(security_pillars):
        x = Inches(0.8 + i * 2.95)
        card = create_card(s9, x, Inches(2.1), Inches(2.8), Inches(4.6), bg_color=CARD_BG, border_color=CARD_BORDER)

        tx = s9.shapes.add_textbox(x + Inches(0.2), Inches(2.3), Inches(2.4), Inches(0.4))
        tf = tx.text_frame
        p = tf.paragraphs[0]
        p.text = f"PILLAR #{num}"
        p.font.name = "Segoe UI"
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = col

        tx_t = s9.shapes.add_textbox(x + Inches(0.2), Inches(2.7), Inches(2.4), Inches(0.7))
        tf_t = tx_t.text_frame
        tf_t.word_wrap = True
        p_t = tf_t.paragraphs[0]
        p_t.text = title
        p_t.font.name = "Segoe UI"
        p_t.font.size = Pt(15)
        p_t.font.bold = True
        p_t.font.color.rgb = TEXT_WHITE

        # Badge
        badge = create_card(s9, x + Inches(0.2), Inches(3.45), Inches(2.4), Inches(0.45), bg_color=CARD_BG_ALT, border_color=col)
        tx_b = s9.shapes.add_textbox(x + Inches(0.25), Inches(3.5), Inches(2.3), Inches(0.35))
        tf_b = tx_b.text_frame
        p_b = tf_b.paragraphs[0]
        p_b.text = badge_text.upper()
        p_b.font.name = "Segoe UI"
        p_b.font.size = Pt(8.5)
        p_b.font.bold = True
        p_b.font.color.rgb = col

        # Description
        tx_d = s9.shapes.add_textbox(x + Inches(0.2), Inches(4.1), Inches(2.4), Inches(2.4))
        tf_d = tx_d.text_frame
        tf_d.word_wrap = True
        p_d = tf_d.paragraphs[0]
        p_d.text = desc
        p_d.font.name = "Segoe UI"
        p_d.font.size = Pt(10.5)
        p_d.font.color.rgb = TEXT_MUTED

    set_notes(s9, """SPEAKER SCRIPT (Slide 9 - 6:00 to 6:45):
"Judges often ask: 'Who audits the auditor? What if someone feeds malicious code into your security scanner?'
We engineered FRIDAY with a strict defense-in-depth model:
1. Zero Code Execution: Code is purely a passive string. We never run it.
2. Zero Remote Storage: Scanned code lives solely in the browser's IndexedDB. If you clear cache or close the tab, the data is gone.
3. AI Privacy Boundary: We scrub all payloads before hitting NVIDIA Nemotron. 0 lines of code leave your computer.
4. DOM XSS Immunity: Scanned files cannot exploit the UI because of strict DOMPurify sanitization.
This gives regulated enterprises the confidence to audit internal codebases with zero IP risk."
""")

    # =========================================================================
    # SLIDE 10: Competitive Matrix & Benchmark Comparison
    # =========================================================================
    s10 = prs.slides.add_slide(blank_layout)
    set_slide_background(s10)
    add_header(s10, "COMPETITIVE ADVANTAGE", "Why FRIDAY Wins: Outperforming Traditional AppSec",
               "A side-by-side comparison across detection, privacy, explainability, and remediation speed.")
    add_footer(s10, 10)

    # Table layout
    table_shape = s10.shapes.add_table(8, 5, Inches(0.8), Inches(2.1), Inches(11.733), Inches(4.6))
    table = table_shape.table

    table.columns[0].width = Inches(2.533)
    table.columns[1].width = Inches(2.3)
    table.columns[2].width = Inches(2.3)
    table.columns[3].width = Inches(2.3)
    table.columns[4].width = Inches(2.3)

    comp_headers = ["CAPABILITY / CRITERIA", "SONARQUBE", "SNYK / CHECKMARX", "CLOUD AI TOOLS", "FRIDAY PLATFORM"]
    for j, h in enumerate(comp_headers):
        cell = table.cell(0, j)
        cell.fill.solid()
        cell.fill.fore_color.rgb = RGBColor(16, 24, 40)
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.name = "Segoe UI"
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = CYAN if j == 4 else TEXT_LIGHT

    comp_data = [
        ("Zero-Day Logic Flaws", "❌ Invisible (No CVE)", "❌ Invisible (No CVE)", "⚠️ Frequent Hallucinations", "✅ Deterministic AST Taint"),
        ("Source Code Privacy", "❌ Central Server Required", "❌ Uploaded to Cloud", "❌ Exfiltrates Full Code", "✅ 100% In-Browser (0 LOC)"),
        ("Visual Proof Graph", "❌ Static Text Logs", "❌ Text-Only Traces", "❌ None / Chat Text", "✅ Interactive Flow Graph"),
        ("Autonomous Hotpatching", "❌ None (Manual Fix)", "❌ None (Manual Fix)", "⚠️ Unverified Code Gen", "✅ Middleware + WAF Rules"),
        ("Countermeasure Verify", "❌ Manual Code Review", "❌ Manual Code Review", "❌ Blind LLM Trust", "✅ AST System Check"),
        ("Setup & Dependency", "❌ Heavy JVM / Server", "❌ CI/CD Agent Pipeline", "❌ Cloud API Account", "✅ Zero Config (Open Tab)"),
        ("Scan Latency (Avg)", "⏳ 5 - 15 Minutes", "⏳ 2 - 5 Minutes", "⏳ 30 - 60 Seconds", "⚡ < 3.5 Seconds (In-Tab)")
    ]

    for row_idx, row_data in enumerate(comp_data, start=1):
        bg_col = CARD_BG if row_idx % 2 == 1 else CARD_BG_ALT
        for col_idx, cell_value in enumerate(row_data):
            cell = table.cell(row_idx, col_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = bg_col
            p = cell.text_frame.paragraphs[0]
            p.text = cell_value
            p.font.name = "Segoe UI"
            p.font.size = Pt(10)
            
            if col_idx == 0:
                p.font.bold = True
                p.font.color.rgb = TEXT_LIGHT
            elif col_idx == 4:
                p.font.bold = True
                p.font.color.rgb = CYAN
            elif "❌" in cell_value:
                p.font.color.rgb = TEXT_DIM
            else:
                p.font.color.rgb = TEXT_MUTED

    set_notes(s10, """SPEAKER SCRIPT (Slide 10 - 6:45 to 7:30):
"When you compare FRIDAY against existing market solutions, the contrast is stark.
SonarQube and Snyk require complex server configurations, rely on backward-looking CVE databases, and leave you with a 60-day patching lag.
Cloud AI tools hallucinate and leak proprietary source code to cloud servers.
FRIDAY is the only platform that gives you:
- Deterministic zero-day detection via AST taint flow
- 100% zero-knowledge in-browser privacy with 0 LOC transmitted
- Instant virtual hotpatching at the middleware and WAF level
- Sub-3.5-second scan speed right in the browser."
""")

    # =========================================================================
    # SLIDE 11: Production Verification & Engineering Metrics
    # =========================================================================
    s11 = prs.slides.add_slide(blank_layout)
    set_slide_background(s11)
    add_header(s11, "PRODUCTION READINESS", "Enterprise-Grade Engineering & Benchmark Metrics",
               "Battle-tested across automated suites, production builds, and real repositories.")
    add_footer(s11, 11)

    metrics = [
        ("31 / 31 (100%)", "Automated Tests Passing", "Vitest suite verifying Python lexers, web AST analyzers, taint propagators, and GitHub ingestion.", EMERALD),
        ("< 3.5 Seconds", "Real-Time Scan Latency", "Average full-repository AST parsing and taint dataflow synthesis running in browser worker threads.", CYAN),
        ("0 Lines of Code", "Source Code Transmitted", "Zero proprietary code sent to servers or LLMs. Verifiable via browser Network Inspector.", PURPLE),
        ("120B Parameters", "NVIDIA Nemotron 3.5 VL", "Advanced reasoning engine powering structured exploitability analysis and virtual hotpatching.", AMBER)
    ]

    for i, (stat, title, desc, col) in enumerate(metrics):
        x = Inches(0.8 + i * 2.95)
        card = create_card(s11, x, Inches(2.1), Inches(2.8), Inches(2.2), bg_color=CARD_BG, border_color=col, border_width=1.5)

        tx = s11.shapes.add_textbox(x + Inches(0.15), Inches(2.25), Inches(2.5), Inches(1.9))
        tf = tx.text_frame
        tf.word_wrap = True
        
        p = tf.paragraphs[0]
        p.text = stat
        p.font.name = "Segoe UI"
        p.font.size = Pt(22)
        p.font.bold = True
        p.font.color.rgb = col
        
        p1 = tf.add_paragraph()
        p1.text = title
        p1.font.name = "Segoe UI"
        p1.font.size = Pt(12)
        p1.font.bold = True
        p1.font.color.rgb = TEXT_WHITE
        p1.space_before = Pt(3)
        
        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.name = "Segoe UI"
        p2.font.size = Pt(9.5)
        p2.font.color.rgb = TEXT_MUTED
        p2.space_before = Pt(3)

    # Engineering Stack Card
    stack_card = create_card(s11, Inches(0.8), Inches(4.5), Inches(11.733), Inches(2.2), bg_color=CARD_BG_ALT, border_color=CARD_BORDER)
    
    tx_st = s11.shapes.add_textbox(Inches(1.1), Inches(4.65), Inches(11.1), Inches(1.9))
    tf_st = tx_st.text_frame
    tf_st.word_wrap = True
    
    p = tf_st.paragraphs[0]
    p.text = "MODERN HIGH-PERFORMANCE TECH STACK"
    p.font.name = "Segoe UI"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = CYAN
    
    stack_items = [
        ("Frontend & SSR", "TanStack Start · React 19 · Vite 8 · Nitro Engine · TypeScript 5.8"),
        ("Taint Graph Engine", "@xyflow/react (React Flow) · Custom Python & Web AST Lexers"),
        ("AI Integration", "NVIDIA Integrate API (nvidia/nemotron-3.5-super-vl-120b-a12b)"),
        ("Security & Sandbox", "IndexedDB (idb-keyval) · DOMPurify · JSZip · jsPDF Executive Reports")
    ]
    
    for s_title, s_detail in stack_items:
        p_item = tf_st.add_paragraph()
        p_item.text = f"•  {s_title}: {s_detail}"
        p_item.font.name = "Segoe UI"
        p_item.font.size = Pt(11)
        p_item.font.color.rgb = TEXT_LIGHT
        p_item.space_before = Pt(3)

    set_notes(s11, """SPEAKER SCRIPT (Slide 11 - 7:30 to 8:15):
"FRIDAY is not a weekend proof-of-concept; it is built with enterprise engineering rigor.
Our automated test suite runs 31 automated unit and AST integration tests with 100% passing status.
Our production build compiles cleanly on Vite 8, TanStack Start SSR, and Nitro.
Our average scan latency is under 3.5 seconds for complete repositories, all running client-side.
And our privacy boundary is 100% verifiable: you can inspect the browser's Network tab live and see that zero lines of code leave the machine."
""")

    # =========================================================================
    # SLIDE 12: The 5-Minute Pitch & Demo Script
    # =========================================================================
    s12 = prs.slides.add_slide(blank_layout)
    set_slide_background(s12)
    add_header(s12, "LIVE DEMO ROADMAP", "The Winning 5-Minute Jury Defense Roadmap",
               "Execute this exact 5-step live sequence during the judging presentation.")
    add_footer(s12, 12)

    demo_steps = [
        ("MIN 1", "The Hook & Live GitHub Ingestion", "Open `/scan` · Paste live repo URL · Point out client progress bar: AST Tokenizing -> Taint Flow -> Graph Synthesis completed in < 3s without server transmission.", CYAN),
        ("MIN 2", "Visual Proof & Findings Explorer", "Click `🔥 0-Day Threat Surface (High/Crit Reachable)` filter on `/findings`. Open Command Injection finding. Trace the visual Source-to-Sink Security Flow Graph.", PURPLE),
        ("MIN 3", "NVIDIA Nemotron 3.5 Hotpatch", "Click 'Run Zero-Day Analysis'. Showcase Nemotron reasoning stream: Exploitability Rationale -> Drop-in Express/Flask Middleware -> Perimeter Cloudflare/ModSecurity WAF rule.", EMERALD),
        ("MIN 4", "System Check Verification", "Click 'Verify Solution with System Check'. Demonstrate deterministic AST re-evaluation severing the taint edge, transitioning status to 'Verified Fixed'.", AMBER),
        ("MIN 5", "Zero-Knowledge Privacy Punchline", "Open `/settings`. Show Analysis Engine: 'Active · 100% in-browser' and Privacy Boundary: 'Enforced · 0 LOC transmitted'. Conclude with enterprise security impact.", CYAN)
    ]

    for i, (m_tag, m_title, m_desc, m_col) in enumerate(demo_steps):
        y = Inches(2.1 + i * 0.92)
        card = create_card(s12, Inches(0.8), y, Inches(11.733), Inches(0.82), bg_color=CARD_BG, border_color=m_col if i == 0 else CARD_BORDER)

        # Minute Pill
        pill = create_card(s12, Inches(0.95), y + Inches(0.12), Inches(1.1), Inches(0.58), bg_color=CARD_BG_ALT, border_color=m_col)
        tx_p = s12.shapes.add_textbox(Inches(0.95), y + Inches(0.18), Inches(1.1), Inches(0.45))
        tf_p = tx_p.text_frame
        p_p = tf_p.paragraphs[0]
        p_p.alignment = PP_ALIGN.CENTER
        p_p.text = m_tag
        p_p.font.name = "Segoe UI"
        p_p.font.size = Pt(11)
        p_p.font.bold = True
        p_p.font.color.rgb = m_col

        # Step Title & Desc
        tx_s = s12.shapes.add_textbox(Inches(2.25), y + Inches(0.1), Inches(10.1), Inches(0.65))
        tf_s = tx_s.text_frame
        tf_s.word_wrap = True
        
        p_s = tf_s.paragraphs[0]
        p_s.text = m_title
        p_s.font.name = "Segoe UI"
        p_s.font.size = Pt(13)
        p_s.font.bold = True
        p_s.font.color.rgb = TEXT_WHITE
        
        p_d = tf_s.add_paragraph()
        p_d.text = m_desc
        p_d.font.name = "Segoe UI"
        p_d.font.size = Pt(10.5)
        p_d.font.color.rgb = TEXT_LIGHT
        p_d.space_before = Pt(2)

    set_notes(s12, """SPEAKER SCRIPT (Slide 12 - Conclusion & Live Demo Transition):
"Judges, to see this live in action right now:
In Minute 1, we ingest a live GitHub repository in under 3 seconds right inside the browser.
In Minute 2, we show you the mathematical proof: an interactive source-to-sink taint graph.
In Minute 3, NVIDIA Nemotron synthesizes a drop-in middleware hotpatch and Cloudflare WAF rule.
In Minute 4, our system re-verifies the fix deterministically and marks it Verified Fixed.
And in Minute 5, we verify our privacy boundary: zero lines of code ever left this browser.
Thank you, and we welcome your questions!"
""")

    prs.save(output_path)
    print(f"Presentation saved successfully to: {output_path}")

if __name__ == "__main__":
    create_deck()

