import os
import io
import uuid
import base64
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from ultralytics import YOLO

app = FastAPI()

# In-memory mock database
DB_USERS = {}
DB_PROJECTS = {}

# Load YOLO model
try:
    # Try the new classification model first
    model_path = r"C:\Users\Lenovo\runs\classify\custom_yolo_classifier-2\weights\best.pt"
    if os.path.exists(model_path):
        YOLO_MODEL = YOLO(model_path)
        IS_CLASSIFIER = True
        print(f"Loaded CUSTOM classification model from {model_path}")
    else:
        # Fall back to default object detection model
        YOLO_MODEL = YOLO("yolov8n.pt") 
        IS_CLASSIFIER = False
        print("Loaded DEFAULT YOLO model (custom model still training)")
except Exception as e:
    print("Failed to load YOLO model:", e)
    YOLO_MODEL = None

class UserRegister(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

@app.post("/api/auth/register")
def register(user: UserRegister):
    token = str(uuid.uuid4())
    user_obj = {"id": token, "name": user.name, "email": user.email}
    DB_USERS[token] = user_obj
    return {"token": token, "user": user_obj}

@app.post("/api/auth/login")
def login(user: UserLogin):
    token = str(uuid.uuid4())
    user_obj = {"id": token, "name": "Demo User", "email": user.email}
    DB_USERS[token] = user_obj
    return {"token": token, "user": user_obj}

@app.get("/api/projects")
def get_projects(request: Request):
    auth = request.headers.get("Authorization")
    if not auth:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return list(DB_PROJECTS.values())

@app.post("/api/projects")
async def create_project(request: Request):
    proj = await request.json()
    pid = str(uuid.uuid4())
    new_proj = proj.copy()
    new_proj["id"] = pid
    new_proj["last_analysis"] = None
    DB_PROJECTS[pid] = new_proj
    return new_proj

@app.post("/api/projects/{proj_id}/analyze")
async def analyze_project(proj_id: str, file: UploadFile = File(...)):
    if proj_id not in DB_PROJECTS:
        raise HTTPException(status_code=404, detail="Project not found")
        
    contents = await file.read()
    
    import cv2
    import numpy as np
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if YOLO_MODEL is None:
        raise HTTPException(status_code=500, detail="AI Model not loaded")
        
    results = YOLO_MODEL.predict(img)
    result = results[0]
    
    analysis = {
        "health": 100,
        "risk_level": "low",
        "primary_defect": "None detected",
        "risk_desc": "Structure appears intact based on AI scan.",
        "image_b64": "",
        "boxes": [],
        "probabilities": [],
        "specs": {
            "edge_density": "Normal",
            "luminance": "Avg",
            "rgb": [128, 128, 128],
            "model": "YOLOv8 Custom" if IS_CLASSIFIER else "YOLOv8 Default"
        },
        "report": "AI visual diagnostics completed. No critical anomalies found in this specific image view."
    }
    
    if IS_CLASSIFIER:
        # It's a classification model
        probs = result.probs.data.tolist()
        names = result.names
        
        prob_objs = []
        for i, p in enumerate(probs):
            prob_objs.append({"label": names[i], "prob": p * 100, "severity": "high" if p > 0.5 else "low"})
            
        prob_objs.sort(key=lambda x: x["prob"], reverse=True)
        analysis["probabilities"] = prob_objs[:4]
        
        top_class = prob_objs[0]
        if top_class["prob"] > 50:
            analysis["primary_defect"] = top_class["label"]
            analysis["risk_level"] = "high"
            analysis["health"] = max(0, 100 - int(top_class["prob"]))
            analysis["risk_desc"] = f"Detected {top_class['label']} with {top_class['prob']:.1f}% confidence."
            analysis["report"] = f"**Critical finding**: The AI classifier strongly detected **{top_class['label']}**.\n\nRecommended to send a physical inspector."
            
        # Provide base64 image
        _, buffer = cv2.imencode('.jpg', img)
        analysis["image_b64"] = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')
        
    else:
        # It's an object detection model (fallback)
        if len(result.boxes) > 0:
            analysis["risk_level"] = "high"
            analysis["health"] = max(10, 100 - len(result.boxes)*20)
            
            top_box = result.boxes[0]
            cls_name = result.names[int(top_box.cls[0].item())]
            
            analysis["primary_defect"] = cls_name
            analysis["risk_desc"] = f"Detected {len(result.boxes)} objects. Primary: {cls_name}."
            
            for box in result.boxes:
                b = box.xyxy[0].tolist() 
                h, w, _ = img.shape
                bx = (b[0]/w)*100
                by = (b[1]/h)*100
                bw = ((b[2]-b[0])/w)*100
                bh = ((b[3]-b[1])/h)*100
                
                analysis["boxes"].append({
                    "x": bx, "y": by, "w": bw, "h": bh,
                    "label": result.names[int(box.cls[0].item())],
                    "confidence": int(float(box.conf[0].item())*100)
                })
                
        # Annotated image with boxes
        annotated = result.plot()
        _, buffer = cv2.imencode('.jpg', annotated)
        analysis["image_b64"] = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

    DB_PROJECTS[proj_id]["last_analysis"] = analysis
    return analysis

# Serve static files manually to handle root routes to Templates
@app.get("/{path:path}")
def serve_static(path: str):
    if path == "":
        path = "index.html"
        
    # Check if file exists in root (app.js, styles.css)
    root_path = os.path.join(os.path.dirname(__file__), path)
    if os.path.exists(root_path) and os.path.isfile(root_path):
        return FileResponse(root_path)
        
    # Check if file exists in Templates
    template_path = os.path.join(os.path.dirname(__file__), "Templates", path)
    if os.path.exists(template_path) and os.path.isfile(template_path):
        return FileResponse(template_path)
        
    raise HTTPException(status_code=404, detail="File not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
