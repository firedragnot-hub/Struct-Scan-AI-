import sqlite3
import base64
import random
import io
from functools import wraps
from flask import Flask, request, jsonify, session, render_template, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = 'super_secret_structscan_key'
DB_PATH = 'users.db'

# ==============================================================================
# Database Initialization & Management
# ==============================================================================
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            name TEXT,
            structure_type TEXT,
            age_years TEXT,
            location TEXT,
            material_brand TEXT,
            material_amount TEXT,
            material_composition TEXT,
            inspection_zone TEXT,
            notes TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS analyses (
            project_id TEXT PRIMARY KEY,
            risk_level TEXT,
            risk_desc TEXT,
            primary_defect TEXT,
            health INTEGER,
            image_b64 TEXT,
            boxes_json TEXT,
            probabilities_json TEXT,
            specs_json TEXT,
            report_text TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

def login_required_api(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Unauthorized. Please log in."}), 401
        return f(*args, **kwargs)
    return decorated_function

# ==============================================================================
# Page Routes
# ==============================================================================
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/login")
def login():
    return render_template("login.html")

@app.route("/signup")
def signup():
    return render_template("signup.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/app.js")
def serve_app_js():
    return send_from_directory(".", "app.js")

# ==============================================================================
# Auth API
# ==============================================================================
@app.route("/api/auth/register", methods=["POST"])
def api_register():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not name or not email or len(password) < 6:
        return jsonify({"error": "Invalid registrations input criteria parameters."}), 400
        
    if " " in name:
        return jsonify({"error": "Spaces are not allowed in the username."}), 400
        
    if " " in password:
        return jsonify({"error": "Spaces are not allowed in the password."}), 400

    hashed_pw = generate_password_hash(password)
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", (name, email, hashed_pw))
        user_id = c.lastrowid
        conn.commit()
        conn.close()
        
        session['user_id'] = user_id
        session['username'] = name
        return jsonify({
            "token": f"mock_token_{user_id}",
            "user": {"id": user_id, "name": name, "email": email}
        }), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Account registration email already coordinates inside user files."}), 400

@app.route("/api/auth/login", methods=["POST"])
def api_login():
    data = request.get_json() or {}
    email = data.get("email", "").strip()
    password = data.get("password", "")
    
    if " " in password:
        return jsonify({"error": "Spaces are not allowed in the password."}), 400

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, name, password FROM users WHERE email = ?", (email,))
    row = c.fetchone()
    conn.close()

    if row and check_password_hash(row[2], password):
        session['user_id'] = row[0]
        session['username'] = row[1]
        return jsonify({
            "token": f"mock_token_{row[0]}",
            "user": {"id": row[0], "name": row[1], "email": email}
        }), 200
    return jsonify({"error": "Invalid account email or credential authorization signature verification failure."}), 401

@app.route("/api/auth/profile", methods=["PUT"])
@login_required_api
def update_profile():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    password = data.get("password", "")
    user_id = session.get("user_id")

    if not name:
        return jsonify({"error": "Name cannot be empty."}), 400
    if " " in name:
        return jsonify({"error": "Spaces are not allowed in the username."}), 400
        
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    if password:
        if " " in password:
            conn.close()
            return jsonify({"error": "Spaces are not allowed in the password."}), 400
        if len(password) < 6:
            conn.close()
            return jsonify({"error": "Password must be at least 6 characters."}), 400
        hashed_pw = generate_password_hash(password)
        c.execute("UPDATE users SET name = ?, password = ? WHERE id = ?", (name, hashed_pw, user_id))
    else:
        c.execute("UPDATE users SET name = ? WHERE id = ?", (name, user_id))
        
    conn.commit()
    conn.close()
    
    session['username'] = name
    return jsonify({"success": True, "name": name}), 200

# ==============================================================================
# Projects API
# ==============================================================================
@app.route("/api/projects", methods=["GET"])
@login_required_api
def get_projects():
    user_id = session['user_id']
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("""
        SELECT p.*, a.risk_level, a.risk_desc, a.primary_defect, a.health, 
               a.image_b64, a.boxes_json, a.probabilities_json, a.specs_json, a.report_text 
        FROM projects p 
        LEFT JOIN analyses a ON p.id = a.project_id
        WHERE p.user_id = ?
    """, (user_id,))
    rows = c.fetchall()
    conn.close()

    import json
    project_list = []
    for row in rows:
        project_dict = {
            "id": row["id"],
            "name": row["name"],
            "structure_type": row["structure_type"],
            "age_years": row["age_years"],
            "location": row["location"],
            "material_brand": row["material_brand"],
            "material_amount": row["material_amount"],
            "material_composition": row["material_composition"],
            "inspection_zone": row["inspection_zone"],
            "notes": row["notes"],
            "last_analysis": None
        }
        if row["health"] is not None:
            project_dict["last_analysis"] = {
                "risk_level": row["risk_level"],
                "risk_desc": row["risk_desc"],
                "primary_defect": row["primary_defect"],
                "health": row["health"],
                "image_b64": row["image_b64"],
                "boxes": json.loads(row["boxes_json"]) if row["boxes_json"] else [],
                "probabilities": json.loads(row["probabilities_json"]) if row["probabilities_json"] else [],
                "specs": json.loads(row["specs_json"]) if row["specs_json"] else {},
                "report": row["report_text"]
            }
        project_list.append(project_dict)

    return jsonify(project_list), 200

@app.route("/api/projects", methods=["POST"])
@login_required_api
def create_project():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    loc = data.get("location", "").strip()
    brand = data.get("material_brand", "").strip()
    amount = data.get("material_amount", "").strip()

    if not name or not loc or not brand or not amount:
        return jsonify({"error": "Missing essential structure data fields configuration bounds."}), 400

    project_id = f"proj_{int(random.random() * 1000000)}"
    user_id = session['user_id']

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT INTO projects (id, user_id, name, structure_type, age_years, location, 
                             material_brand, material_amount, material_composition, inspection_zone, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (project_id, user_id, name, data.get("structure_type"), data.get("age_years"), loc,
          brand, amount, data.get("material_composition"), data.get("inspection_zone"), data.get("notes")))
    conn.commit()
    conn.close()

    return jsonify({
        "id": project_id,
        "name": name,
        "structure_type": data.get("structure_type"),
        "age_years": data.get("age_years"),
        "location": loc,
        "material_brand": brand,
        "material_amount": amount,
        "material_composition": data.get("material_composition"),
        "inspection_zone": data.get("inspection_zone"),
        "notes": data.get("notes"),
        "last_analysis": None
    }), 201

@app.route("/api/projects/<project_id>/analyze", methods=["POST"])
@login_required_api
def analyze_project(project_id):
    if "file" not in request.files:
        return jsonify({"error": "No image resource payload submitted inside structural file paths."}), 400

    file = request.files["file"]
    img_bytes = file.read()

    # Fetch project details to get the grade
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT material_composition, material_brand FROM projects WHERE id = ?", (project_id,))
    proj = c.fetchone()
    
    grade = proj["material_composition"] if proj and proj["material_composition"] else "OPC 43"
    brand = proj["material_brand"] if proj and proj["material_brand"] else "Unknown"
    
    lookup_grade = grade
    if grade and "OPC 33" in grade: lookup_grade = "OPC 33"
    elif grade and "OPC 43" in grade: lookup_grade = "OPC 43"
    elif grade and "OPC 53" in grade: lookup_grade = "OPC 53"
    elif grade and "PPC" in grade: lookup_grade = "PPC"
    elif grade and "PSC" in grade: lookup_grade = "PSC"
    else: lookup_grade = "OPC 43"
    
    cement_info = CEMENT_DATA.get(lookup_grade, CEMENT_DATA["OPC 43"])

    cement_str = f"\n\n**CEMENT STRENGTH ANALYSIS**\n"
    cement_str += f"Material Selected: {brand} ({grade})\n"
    cement_str += f"28-Day Compressive Strength: {cement_info['strength']} MPa [{cement_info['category']}]\n"
    cement_str += f"Recommended Applications: {', '.join(cement_info['applications'])}\n"
    cement_str += f"Engineering Remarks: {cement_info['remark']}"

    # Simulate dynamic AI model responses
    defects = [
        {"name": "Concrete Cracking", "risk": "medium", "desc": "Surface micro-fractures tracking stress vectors.", "min_h": 65, "max_h": 85},
        {"name": "Spalling & Delamination", "risk": "high", "desc": "Severe localized concrete spalling exposing rebar.", "min_h": 40, "max_h": 60},
        {"name": "Efflorescence / Water Seepage", "risk": "low", "desc": "Minor salt deposits due to water ingress.", "min_h": 80, "max_h": 90},
        {"name": "Structural Deformation", "risk": "high", "desc": "Abnormal deflection or structural bowing detected.", "min_h": 30, "max_h": 50},
        {"name": "Healthy Surface", "risk": "low", "desc": "No major structural anomalies detected.", "min_h": 92, "max_h": 100}
    ]
    
    import random
    import hashlib
    from PIL import Image, ImageFilter, ImageStat
    import io
    
    # Create deterministic seed based on image contents
    img_hash = hashlib.md5(img_bytes).hexdigest()
    random.seed(img_hash)

    defect = random.choice(defects)
    
    try:
        pil_img = Image.open(io.BytesIO(img_bytes)).convert("L")
        edges = pil_img.filter(ImageFilter.FIND_EDGES)
        stat = ImageStat.Stat(edges)
        edge_intensity = stat.mean[0]
        
        if edge_intensity > 20:
            defect_name = random.choice(["Concrete Cracking", "Spalling & Delamination", "Structural Deformation"])
            defect = next(d for d in defects if d["name"] == defect_name)
        elif edge_intensity < 8:
            defect = next(d for d in defects if d["name"] == "Healthy Surface")
    except Exception:
        pass
    health_score = random.randint(defect["min_h"], defect["max_h"])
    confidence = round(random.uniform(75.0, 98.9), 1)

    boxes = []
    if defect["name"] != "Healthy Surface":
        num_boxes = random.randint(2, 6)
        for _ in range(num_boxes):
            bx = random.randint(5, 70)
            by = random.randint(5, 70)
            bw = random.randint(15, min(40, 95 - bx))
            bh = random.randint(15, min(40, 95 - by))
            boxes.append({
                "x": bx, "y": by, "w": bw, "h": bh,
                "label": defect["name"],
                "confidence": round(random.uniform(max(50.0, confidence - 15.0), confidence), 1)
            })

    encoded_source = f"data:image/jpeg;base64,{base64.b64encode(img_bytes).decode()}"
    report_data = {
        "risk_level": defect["risk"],
        "risk_desc": defect["desc"],
        "primary_defect": defect["name"],
        "health": health_score,
        "image_b64": encoded_source,
        "boxes": boxes,
        "probabilities": [
            {"label": defect["name"], "prob": confidence, "severity": defect["risk"]},
            {"label": "Secondary Anomaly", "prob": round(random.uniform(5.0, 25.0), 1), "severity": "low"}
        ],
        "specs": {
            "edge_density": f"{round(random.uniform(0.1, 0.6), 3)} px⁻¹",
            "luminance": f"{random.randint(90, 180)} cd/m²",
            "rgb": [str(random.randint(90, 150)), str(random.randint(90, 150)), str(random.randint(90, 150))],
            "model": "StructScan Core (Deterministic Simulation)"
        },
        "report": f"**STRUCTURAL DIAGNOSTIC REVIEWS**\nDiagnostic pass complete. {defect['desc']}" + cement_str
    }
    
    # Reset seed so we don't affect global random state
    random.seed()
    import json
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT OR REPLACE INTO analyses 
        (project_id, risk_level, risk_desc, primary_defect, health, image_b64, boxes_json, probabilities_json, specs_json, report_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        project_id,
        report_data["risk_level"],
        report_data["risk_desc"],
        report_data["primary_defect"],
        report_data["health"],
        report_data["image_b64"],
        json.dumps(report_data["boxes"]),
        json.dumps(report_data["probabilities"]),
        json.dumps(report_data["specs"]),
        report_data["report"]
    ))
    conn.commit()
    conn.close()

    return jsonify(report_data), 200

# ==============================================================================
# Cement Strength API
# ==============================================================================
CEMENT_DATA = {
    "OPC 33": {
        "strength": "33",
        "category": "Standard Strength",
        "applications": ["Plastering", "Masonry Work", "Residential Construction"],
        "remark": "OPC 33 grade cement provides adequate baseline compressive strength."
    },
    "OPC 43": {
        "strength": "43",
        "category": "Medium-High Strength",
        "applications": ["RCC Structures", "Slabs", "Beams", "Columns"],
        "remark": "OPC 43 grade delivers a robust 43 MPa compressive strength after 28 days."
    },
    "OPC 53": {
        "strength": "53",
        "category": "High Strength",
        "applications": ["High-Rise Buildings", "Bridges", "Industrial Structures", "Heavy Load Bearing Elements"],
        "remark": "OPC 53 grade achieves rapid and high compressive strength."
    },
    "PPC": {
        "strength": "33-53",
        "category": "Durable Concrete",
        "applications": ["Dams", "Marine Structures", "Mass Concreting", "Long-Life Construction"],
        "remark": "Portland Pozzolana Cement (PPC) offers superior resistance to sulfate attacks."
    },
    "PSC": {
        "strength": "33-53",
        "category": "High Durability Concrete",
        "applications": ["Coastal Structures", "Foundations", "Sewage Treatment Plants", "Aggressive Environmental Conditions"],
        "remark": "Portland Slag Cement (PSC) features excellent durability against chloride."
    }
}

@app.route('/api/cement/strength', methods=['POST'])
def cement_strength():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid request payload."}), 400
            
        brand = data.get('brand', '').strip()
        grade = data.get('grade', '').strip()
        
        if not brand or not grade:
            return jsonify({"error": "Both brand and grade must be provided."}), 400
            
        lookup_grade = grade
        if "OPC 33" in grade: lookup_grade = "OPC 33"
        elif "OPC 43" in grade: lookup_grade = "OPC 43"
        elif "OPC 53" in grade: lookup_grade = "OPC 53"
        elif "PPC" in grade: lookup_grade = "PPC"
        elif "PSC" in grade: lookup_grade = "PSC"
        
        if lookup_grade not in CEMENT_DATA:
            return jsonify({"error": "Invalid cement grade selected."}), 400
            
        result = CEMENT_DATA[lookup_grade]
        
        response_data = {
            "brand": brand,
            "grade": grade,
            "strength": result["strength"],
            "category": result["category"],
            "applications": result["applications"],
            "remark": result["remark"]
        }
        return jsonify(response_data), 200
    except Exception as e:
        print(f"Error processing cement request: {e}")
        return jsonify({"error": "An internal processing error occurred."}), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)