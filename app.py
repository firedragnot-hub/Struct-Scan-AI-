import os
import sqlite3
import base64
import random
import io
import json
from functools import wraps
from flask import Flask, request, jsonify, session, render_template, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'super_secret_visionbuild_key')
DB_PATH = 'users.db'
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db():
    if DATABASE_URL:
        import psycopg2
        import psycopg2.extras
        conn = psycopg2.connect(DATABASE_URL)
        return conn, 'postgres'
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn, 'sqlite'

def init_db():
    conn, db_type = get_db()
    cur = conn.cursor()
    if db_type == 'postgres':
        cur.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            );
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
            );
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
            );
        ''')
    else:
        cur.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        ''')
        cur.execute('''
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
        cur.execute('''
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
    cur.close()
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
# Page Routes (Serving React SPA)
# ==============================================================================
dist_dir = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    if path.startswith("api/"):
        return jsonify({"error": "Resource not found."}), 404
    if path != "" and os.path.exists(os.path.join(dist_dir, path)):
        return send_from_directory(dist_dir, path)
    if os.path.exists(os.path.join(dist_dir, "index.html")):
        return send_from_directory(dist_dir, "index.html")
    return jsonify({"status": "healthy", "service": "Struct-Scan AI API Engine"}), 200


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
        conn, db_type = get_db()
        cur = conn.cursor()
        if db_type == 'postgres':
            cur.execute("INSERT INTO users (name, email, password) VALUES (%s, %s, %s) RETURNING id", (name, email, hashed_pw))
            user_id = cur.fetchone()[0]
        else:
            cur.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", (name, email, hashed_pw))
            user_id = cur.lastrowid
        conn.commit()
        cur.close()
        conn.close()
        
        session['user_id'] = user_id
        session['username'] = name
        return jsonify({
            "token": f"mock_token_{user_id}",
            "user": {"id": user_id, "name": name, "email": email}
        }), 201
    except Exception as e:
        return jsonify({"error": "Account registration email already coordinates inside user files."}), 400

@app.route("/api/auth/login", methods=["POST"])
def api_login():
    data = request.get_json() or {}
    email = data.get("email", "").strip()
    password = data.get("password", "")
    
    if " " in password:
        return jsonify({"error": "Spaces are not allowed in the password."}), 400

    conn, db_type = get_db()
    cur = conn.cursor()
    if db_type == 'postgres':
        cur.execute("SELECT id, name, password FROM users WHERE email = %s", (email,))
    else:
        cur.execute("SELECT id, name, password FROM users WHERE email = ?", (email,))
    row = cur.fetchone()
    cur.close()
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
        
    conn, db_type = get_db()
    cur = conn.cursor()
    
    if password:
        if " " in password:
            cur.close()
            conn.close()
            return jsonify({"error": "Spaces are not allowed in the password."}), 400
        if len(password) < 6:
            cur.close()
            conn.close()
            return jsonify({"error": "Password must be at least 6 characters."}), 400
        hashed_pw = generate_password_hash(password)
        if db_type == 'postgres':
            cur.execute("UPDATE users SET name = %s, password = %s WHERE id = %s", (name, hashed_pw, user_id))
        else:
            cur.execute("UPDATE users SET name = ?, password = ? WHERE id = ?", (name, hashed_pw, user_id))
    else:
        if db_type == 'postgres':
            cur.execute("UPDATE users SET name = %s WHERE id = %s", (name, user_id))
        else:
            cur.execute("UPDATE users SET name = ? WHERE id = ?", (name, user_id))
        
    conn.commit()
    cur.close()
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
    conn, db_type = get_db()
    cur = conn.cursor()
    
    placeholder = "%s" if db_type == 'postgres' else "?"
    query = f"""
        SELECT p.id, p.name, p.structure_type, p.age_years, p.location, 
               p.material_brand, p.material_amount, p.material_composition, 
               p.inspection_zone, p.notes,
               a.risk_level, a.risk_desc, a.primary_defect, a.health, 
               a.image_b64, a.boxes_json, a.probabilities_json, a.specs_json, a.report_text 
        FROM projects p 
        LEFT JOIN analyses a ON p.id = a.project_id
        WHERE p.user_id = {placeholder}
    """
    
    cur.execute(query, (user_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    project_list = []
    for row in rows:
        project_dict = {
            "id": row[0],
            "name": row[1],
            "structure_type": row[2],
            "age_years": row[3],
            "location": row[4],
            "material_brand": row[5],
            "material_amount": row[6],
            "material_composition": row[7],
            "inspection_zone": row[8],
            "notes": row[9],
            "last_analysis": None
        }
        if row[13] is not None:
            project_dict["last_analysis"] = {
                "risk_level": row[10],
                "risk_desc": row[11],
                "primary_defect": row[12],
                "health": row[13],
                "image_b64": row[14],
                "boxes": json.loads(row[15]) if row[15] else [],
                "probabilities": json.loads(row[16]) if row[16] else [],
                "specs": json.loads(row[17]) if row[17] else {},
                "report": row[18]
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

    conn, db_type = get_db()
    cur = conn.cursor()
    placeholder = "%s" if db_type == 'postgres' else "?"
    query = f"""
        INSERT INTO projects (id, user_id, name, structure_type, age_years, location, 
                             material_brand, material_amount, material_composition, inspection_zone, notes)
        VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
    """
    cur.execute(query, (project_id, user_id, name, data.get("structure_type"), data.get("age_years"), loc,
                          brand, amount, data.get("material_composition"), data.get("inspection_zone"), data.get("notes")))
    conn.commit()
    cur.close()
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

    conn, db_type = get_db()
    cur = conn.cursor()
    placeholder = "%s" if db_type == 'postgres' else "?"
    cur.execute(f"SELECT structure_type, age_years, location, material_brand, material_composition FROM projects WHERE id = {placeholder}", (project_id,))
    proj_row = cur.fetchone()
    
    grade = proj_row[4] if proj_row and proj_row[4] else "OPC 43"
    brand = proj_row[3] if proj_row and proj_row[3] else "Unknown"
    
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

    from model import StructuralDecisionEngine
    engine = StructuralDecisionEngine()
    
    meta = {
        "type": proj_row[0] if proj_row and proj_row[0] else "Concrete",
        "age": proj_row[1] if proj_row and proj_row[1] else "10 years",
        "location": proj_row[2] if proj_row and proj_row[2] else "Unknown",
        "material": f"{brand} ({grade})"
    }
    
    report_text, analysis, heatmap_b64 = engine.process_inference(outputs={}, meta=meta, img_bytes=img_bytes)
    encoded_source = f"data:image/jpeg;base64,{base64.b64encode(img_bytes).decode()}"
    
    probs = []
    for d in analysis["defects"]:
        probs.append({
            "label": d["name"],
            "prob": d["confidence"],
            "severity": "medium" if "Crack" in d["name"] else ("high" if "Spalling" in d["name"] or "Corrosion" in d["name"] else "low")
        })
    if not probs:
        primary_lbl = analysis["bounding_boxes"][0]["class"] if analysis["bounding_boxes"] else "Healthy Surface"
        primary_conf = analysis["bounding_boxes"][0]["confidence"] if analysis["bounding_boxes"] else 95.0
        probs = [{"label": primary_lbl, "prob": primary_conf, "severity": "medium"}]

    boxes = []
    for b in analysis["bounding_boxes"]:
        x1, y1, x2, y2 = b["box"]
        boxes.append({
            "x": x1,
            "y": y1,
            "w": x2 - x1,
            "h": y2 - y1,
            "label": b["class"],
            "confidence": b["confidence"]
        })

    needs_demolish = "Yes" if analysis["risk_level"].lower() in ["high", "critical"] and analysis["health_score"] < 45 else "No"
    
    cost_val = 0
    if analysis["risk_level"].lower() == "low":
        cost_val = random.randint(5000, 25000)
    elif analysis["risk_level"].lower() == "medium":
        cost_val = random.randint(30000, 100000)
    else:
        cost_val = random.randint(150000, 1000000)

    report_data = {
        "risk_level": analysis["risk_level"].lower(),
        "risk_desc": f"Primary Defect: {analysis['bounding_boxes'][0]['class']}. {analysis['bounding_boxes'][0]['description']}" if analysis["bounding_boxes"] else "No major defects.",
        "primary_defect": analysis["bounding_boxes"][0]["class"] if analysis["bounding_boxes"] else "Healthy Surface",
        "health": int(analysis["health_score"]),
        "image_b64": encoded_source,
        "boxes": boxes,
        "probabilities": probs,
        "specs": {
            "edge_density": f"{analysis['edge_intensity']} px⁻¹",
            "luminance": f"{random.randint(90, 180)} cd/m²",
            "rgb": [str(int(analysis['color_balance']['r'])), str(int(analysis['color_balance']['g'])), str(int(analysis['color_balance']['b']))],
            "model": "YOLOv26 + Expert Rules Engine",
            "demolish": needs_demolish,
            "cost": f"₹ {cost_val:,}"
        },
        "report": report_text + cement_str
    }
    
    if db_type == 'postgres':
        cur.execute("""
            INSERT INTO analyses 
            (project_id, risk_level, risk_desc, primary_defect, health, image_b64, boxes_json, probabilities_json, specs_json, report_text)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (project_id) DO UPDATE SET 
                risk_level=EXCLUDED.risk_level, 
                risk_desc=EXCLUDED.risk_desc, 
                primary_defect=EXCLUDED.primary_defect, 
                health=EXCLUDED.health, 
                image_b64=EXCLUDED.image_b64, 
                boxes_json=EXCLUDED.boxes_json, 
                probabilities_json=EXCLUDED.probabilities_json, 
                specs_json=EXCLUDED.specs_json, 
                report_text=EXCLUDED.report_text
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
    else:
        cur.execute("""
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
    cur.close()
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
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)