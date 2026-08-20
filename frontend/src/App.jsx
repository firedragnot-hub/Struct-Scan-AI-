import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Activity, 
  Layers, 
  MapPin, 
  Calendar, 
  Database, 
  User, 
  LogOut, 
  Plus, 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  Compass, 
  Settings, 
  Info,
  Sun,
  Moon,
  Printer,
  ChevronRight
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [activeTab, setActiveTab] = useState('projects'); // 'projects' | 'cement' | 'profile'
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [toasts, setToasts] = useState([]);
  
  // Auth Form State
  const [isLogin, setIsLogin] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');

  // Modals
  const [showNewProjModal, setShowNewProjModal] = useState(false);
  
  // New Project Form
  const [newProjName, setNewProjName] = useState('');
  const [newProjLoc, setNewProjLoc] = useState('');
  const [newProjType, setNewProjType] = useState('Concrete Column');
  const [newProjAge, setNewProjAge] = useState('10');
  const [newProjBrand, setNewProjBrand] = useState('UltraTech');
  const [newProjComposition, setNewProjComposition] = useState('OPC 43');
  const [newProjZone, setNewProjZone] = useState('Zone A - Foundations');
  const [newProjNotes, setNewProjNotes] = useState('');
  
  // Cement Form State
  const [cementBrand, setCementBrand] = useState('Ambuja');
  const [cementGrade, setCementGrade] = useState('OPC 53');
  const [cementResult, setCementResult] = useState(null);

  // Profile Form
  const [profileName, setProfileName] = useState('');
  const [profilePassword, setProfilePassword] = useState('');

  // Upload/Inference state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hoveredBox, setHoveredBox] = useState(null);

  // Toast Helper
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Theme Toggler
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load User from Local Storage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
  }, [token]);

  // Fetch Projects once authenticated
  useEffect(() => {
    if (user && token) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        if (data.length > 0 && !currentProject) {
          setCurrentProject(data[0]);
        }
      }
    } catch (e) {
      showToast('Error loading projects.', 'error');
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    const url = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin 
      ? { email: authEmail, password: authPassword }
      : { name: authName, email: authEmail, password: authPassword };
      
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed');
        return;
      }
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setProfileName(data.user.name);
      showToast(`Welcome back, ${data.user.name}!`, 'success');
    } catch (err) {
      setAuthError('Connection error to Flask backend.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setProjects([]);
    setCurrentProject(null);
    showToast('Logged out successfully.');
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjName || !newProjLoc || !newProjBrand) {
      showToast('Please fill all mandatory fields.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newProjName,
          location: newProjLoc,
          structure_type: newProjType,
          age_years: newProjAge + ' years',
          material_brand: newProjBrand,
          material_amount: 'Standard Mix',
          material_composition: newProjComposition,
          inspection_zone: newProjZone,
          notes: newProjNotes
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Inspection project created successfully.', 'success');
        setShowNewProjModal(false);
        setProjects(prev => [data, ...prev]);
        setCurrentProject(data);
        // Reset fields
        setNewProjName('');
        setNewProjLoc('');
        setNewProjNotes('');
      } else {
        showToast(data.error || 'Error creating project', 'error');
      }
    } catch (err) {
      showToast('Connection error.', 'error');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentProject) return;

    const formData = new FormData();
    formData.append('file', file);
    setIsAnalyzing(true);
    showToast('Starting YOLOv26 inference & diagnostic generation...', 'info');

    try {
      const res = await fetch(`/api/projects/${currentProject.id}/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showToast('YOLOv26 analysis completed successfully!', 'success');
        // Update current project state with results
        const updatedProj = { ...currentProject, last_analysis: data };
        setCurrentProject(updatedProj);
        setProjects(prev => prev.map(p => p.id === currentProject.id ? updatedProj : p));
      } else {
        showToast(data.error || 'Analysis failed', 'error');
      }
    } catch (err) {
      showToast('Network error running model.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const queryCementStrength = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/cement/strength', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: cementBrand, grade: cementGrade })
      });
      const data = await res.json();
      if (res.ok) {
        setCementResult(data);
        showToast('Cement compressive strength retrieved.', 'success');
      } else {
        showToast(data.error || 'Lookup failed', 'error');
      }
    } catch (err) {
      showToast('Network error.', 'error');
    }
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: profileName, password: profilePassword })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Profile updated successfully.', 'success');
        setUser(prev => ({ ...prev, name: profileName }));
        setProfilePassword('');
      } else {
        showToast(data.error || 'Failed to update profile.', 'error');
      }
    } catch (err) {
      showToast('Connection error.', 'error');
    }
  };

  // Get color code based on risk level
  const getRiskBadgeClass = (risk) => {
    if (!risk) return 'badge-neutral';
    switch(risk.toLowerCase()) {
      case 'critical': return 'badge-critical';
      case 'high': return 'badge-high';
      case 'medium': return 'badge-medium';
      case 'low': return 'badge-low';
      default: return 'badge-neutral';
    }
  };

  return (
    <div className="app-root">
      {/* Toast Render */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <nav className="nav glass">
        <div className="container nav-inner">
          <div className="brand">
            <div className="brand-mark">S</div>
            <div className="brand-name">Struct-Scan <em>AI</em></div>
          </div>

          <div className="nav-links">
            {user ? (
              <>
                <button 
                  onClick={() => setActiveTab('projects')} 
                  className={`nav-item ${activeTab === 'projects' ? 'active' : ''}`}
                >
                  <Activity size={16} /> Inspections
                </button>
                <button 
                  onClick={() => setActiveTab('cement')} 
                  className={`nav-item ${activeTab === 'cement' ? 'active' : ''}`}
                >
                  <Database size={16} /> Cement Database
                </button>
                <button 
                  onClick={() => setActiveTab('profile')} 
                  className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                >
                  <User size={16} /> Profile
                </button>
                
                <div className="nav-separator"></div>

                <div className="user-badge">
                  <div className="avatar">{user.name[0].toUpperCase()}</div>
                  <span className="username">{user.name}</span>
                </div>

                <button onClick={handleLogout} className="btn-icon" title="Sign Out">
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <span className="nav-guest-label">YOLOv26 Diagnostic Portal</span>
            )}
            
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
              className="btn-icon"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-layout">
        {!user ? (
          /* Auth / Landing View */
          <div className="auth-landing-container reveal">
            <div className="landing-hero">
              <h1 className="hero-title">Civil Vision Defects Diagnosis</h1>
              <p className="hero-subtitle">
                Inspect building structural soundness instantly with our <strong>YOLOv26 Real-Time AI model</strong>. 
                Identify cracks, spalling, and rebar corrosion with structural engineer accuracy.
              </p>
              <div className="hero-features">
                <div className="feat-pill"><Shield size={14} /> iOS & Web Ready</div>
                <div className="feat-pill"><Activity size={14} /> 12 Defect Classifiers</div>
                <div className="feat-pill"><Layers size={14} /> Grad-CAM Heatmaps</div>
              </div>
            </div>

            <div className="auth-card glass">
              <div className="auth-header">
                <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>
                <p>{isLogin ? 'Enter your engineer details' : 'Register a new inspector ID'}</p>
              </div>

              {authError && <div className="auth-error-banner"><AlertTriangle size={16} /> {authError}</div>}

              <form onSubmit={handleAuth} className="auth-form">
                {!isLogin && (
                  <div className="form-group">
                    <label>Full Name</label>
                    <input 
                      type="text" 
                      placeholder="Jane Doe" 
                      value={authName} 
                      onChange={e => setAuthName(e.target.value)} 
                      required 
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    placeholder="inspector@structscan.ai" 
                    value={authEmail} 
                    onChange={e => setAuthEmail(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={authPassword} 
                    onChange={e => setAuthPassword(e.target.value)} 
                    required 
                  />
                </div>

                <button type="submit" className="btn-primary">
                  {isLogin ? 'Access System' : 'Create Inspector Profile'}
                </button>
              </form>

              <div className="auth-switch">
                <button onClick={() => { setIsLogin(!isLogin); setAuthError(''); }}>
                  {isLogin ? "Don't have an account? Sign up" : 'Already registered? Sign in'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Logged In Dashboard views */
          <div className="container dashboard-container reveal">
            {activeTab === 'projects' && (
              <div className="workspace-grid">
                {/* Left Side: Projects Panel */}
                <div className="projects-panel glass">
                  <div className="panel-header">
                    <h3>Inspection Projects</h3>
                    <button className="btn-add" onClick={() => setShowNewProjModal(true)}>
                      <Plus size={16} /> New
                    </button>
                  </div>

                  <div className="projects-list">
                    {projects.length === 0 ? (
                      <div className="empty-state">
                        <Compass size={32} />
                        <p>No inspection logs created yet.</p>
                      </div>
                    ) : (
                      projects.map(proj => {
                        const lastAnalysis = proj.last_analysis;
                        return (
                          <div 
                            key={proj.id} 
                            onClick={() => setCurrentProject(proj)}
                            className={`project-list-card ${currentProject?.id === proj.id ? 'active' : ''}`}
                          >
                            <div className="card-top">
                              <h4 className="proj-title">{proj.name}</h4>
                              {lastAnalysis && (
                                <span className={`risk-badge ${getRiskBadgeClass(lastAnalysis.risk_level)}`}>
                                  {lastAnalysis.risk_level}
                                </span>
                              )}
                            </div>
                            <p className="proj-meta"><MapPin size={12} /> {proj.location}</p>
                            <div className="card-footer">
                              <span className="struct-type-label">{proj.structure_type}</span>
                              {lastAnalysis && <span className="health-percentage">{lastAnalysis.health}% Health</span>}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Side: Details / Inspection View */}
                <div className="inspection-viewer glass">
                  {currentProject ? (
                    <div className="viewer-inner">
                      {/* Project Meta Header */}
                      <div className="viewer-header">
                        <div>
                          <h2>{currentProject.name}</h2>
                          <div className="meta-row">
                            <span><MapPin size={14} /> {currentProject.location}</span>
                            <span><Layers size={14} /> {currentProject.structure_type}</span>
                            <span><Calendar size={14} /> Age: {currentProject.age_years}</span>
                          </div>
                        </div>
                        {currentProject.last_analysis && (
                          <button onClick={() => window.print()} className="btn-secondary">
                            <Printer size={16} /> Print Report
                          </button>
                        )}
                      </div>

                      <div className="project-notes">
                        <h5>Inspection Context / Notes</h5>
                        <p>{currentProject.notes || "No context notes provided for this structure."}</p>
                      </div>

                      {/* Analysis Block */}
                      <div className="analysis-workspace">
                        {!currentProject.last_analysis ? (
                          /* Upload Screen */
                          <div className="upload-screen">
                            {isAnalyzing ? (
                              <div className="analyzing-state">
                                <div className="spinner"></div>
                                <h4>YOLOv26 Feature Extraction...</h4>
                                <p>Running neural vision passes, locating cracks, and estimating compaction quality.</p>
                              </div>
                            ) : (
                              <label className="drag-upload-label">
                                <Upload size={48} />
                                <h3>Upload Inspection Photo</h3>
                                <p>Drag and drop or click to choose JPEG/PNG image for YOLOv26 defect diagnosis</p>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={handleImageUpload} 
                                  style={{ display: 'none' }} 
                                />
                              </label>
                            )}
                          </div>
                        ) : (
                          /* Analysis Results Screen */
                          <div className="results-grid">
                            {/* Interactive Bounding Box Canvas Overlay */}
                            <div className="image-analysis-box">
                              <div className="image-wrapper">
                                <img 
                                  src={currentProject.last_analysis.image_b64} 
                                  alt="Inspected Structure" 
                                  className="inspected-img" 
                                />
                                {/* Render Bounding Boxes */}
                                {currentProject.last_analysis.boxes.map((box, idx) => (
                                  <div 
                                    key={idx}
                                    className={`bbox-overlay ${hoveredBox === idx ? 'hovered' : ''}`}
                                    style={{
                                      left: `${box.x}%`,
                                      top: `${box.y}%`,
                                      width: `${box.w}%`,
                                      height: `${box.h}%`
                                    }}
                                    onMouseEnter={() => setHoveredBox(idx)}
                                    onMouseLeave={() => setHoveredBox(null)}
                                  >
                                    <span className="bbox-label">
                                      {box.label} ({box.confidence}%)
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <span className="vision-system-tag">Interactive YOLOv26 Vision Output Overlay</span>
                            </div>

                            {/* Metrics Panel */}
                            <div className="metrics-side-panel">
                              <div className="health-metric-card">
                                <h3>Structural Health</h3>
                                <div className="score-display">
                                  <span className="score-value">{currentProject.last_analysis.health}</span>
                                  <span className="score-max">/100</span>
                                </div>
                                <div className="progress-bar-bg">
                                  <div 
                                    className="progress-bar-fill"
                                    style={{ 
                                      width: `${currentProject.last_analysis.health}%`,
                                      background: currentProject.last_analysis.health > 80 ? 'var(--success)' : (currentProject.last_analysis.health > 50 ? 'var(--warn)' : 'var(--danger)')
                                    }}
                                  ></div>
                                </div>
                              </div>

                              <div className="defect-probabilities-card">
                                <h4>Vision Detections</h4>
                                <div className="probabilities-list">
                                  {currentProject.last_analysis.probabilities.map((p, idx) => (
                                    <div 
                                      key={idx} 
                                      className={`prob-item ${hoveredBox === idx ? 'active' : ''}`}
                                      onMouseEnter={() => setHoveredBox(idx)}
                                      onMouseLeave={() => setHoveredBox(null)}
                                    >
                                      <div className="prob-label">
                                        <span>{p.label}</span>
                                        <span>{p.prob}%</span>
                                      </div>
                                      <div className="prob-bar-bg">
                                        <div className="prob-bar-fill" style={{ width: `${p.prob}%` }}></div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="specs-card">
                                <h4>Engineering Specs</h4>
                                <div className="specs-list">
                                  <div className="spec-row">
                                    <span>Edge Density</span>
                                    <strong>{currentProject.last_analysis.specs.edge_density}</strong>
                                  </div>
                                  <div className="spec-row">
                                    <span>Luminance</span>
                                    <strong>{currentProject.last_analysis.specs.luminance}</strong>
                                  </div>
                                  <div className="spec-row">
                                    <span>RGB Balance</span>
                                    <strong>{currentProject.last_analysis.specs.rgb?.join(', ')}</strong>
                                  </div>
                                  <div className="spec-row">
                                    <span>Core Model</span>
                                    <strong>{currentProject.last_analysis.specs.model}</strong>
                                  </div>
                                  <div className="spec-row">
                                    <span>Demolish Recommended</span>
                                    <strong style={{ color: currentProject.last_analysis.specs.demolish === 'Yes' ? 'var(--danger)' : 'var(--success)' }}>
                                      {currentProject.last_analysis.specs.demolish}
                                    </strong>
                                  </div>
                                  <div className="spec-row">
                                    <span>Est. Repair Cost</span>
                                    <strong>{currentProject.last_analysis.specs.cost}</strong>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Full Report Area */}
                            <div className="diagnostic-report-section">
                              <h3>Diagnostic Report</h3>
                              <pre className="report-markdown">
                                {currentProject.last_analysis.report}
                              </pre>
                            </div>
                            
                            {/* Re-upload / Clear analysis */}
                            <div className="analysis-actions">
                              <label className="btn-secondary">
                                <Upload size={14} /> Analyze Another Photo
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={handleImageUpload} 
                                  style={{ display: 'none' }} 
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="no-project-selected">
                      <Compass size={48} />
                      <h3>Select a Project</h3>
                      <p>Select a project from the left panel or create a new one to begin defect scanning.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cement Grade tab */}
            {activeTab === 'cement' && (
              <div className="cement-strength-workspace container-sm">
                <div className="card-header-with-icon">
                  <Database size={24} />
                  <h2>Indian Cement Compressive Strength Database</h2>
                </div>
                <p className="tab-desc">
                  Select cement category (OPC 33, 43, 53, PPC, PSC) to verify standard compressive strength yields at 28 days.
                </p>

                <div className="cement-layout-grid">
                  <form onSubmit={queryCementStrength} className="cement-form glass">
                    <div className="form-group">
                      <label>Cement Brand</label>
                      <input 
                        type="text" 
                        value={cementBrand} 
                        onChange={e => setCementBrand(e.target.value)} 
                        placeholder="e.g. ACC, UltraTech, Ambuja" 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Cement Grade</label>
                      <select value={cementGrade} onChange={e => setCementGrade(e.target.value)}>
                        <option value="OPC 33">OPC 33 (Standard Strength)</option>
                        <option value="OPC 43">OPC 43 (Medium-High Strength)</option>
                        <option value="OPC 53">OPC 53 (High Strength)</option>
                        <option value="PPC">PPC (Portland Pozzolana Cement)</option>
                        <option value="PSC">PSC (Portland Slag Cement)</option>
                      </select>
                    </div>

                    <button type="submit" className="btn-primary">Query Strength Specs</button>
                  </form>

                  {cementResult && (
                    <div className="cement-results-card glass reveal">
                      <h3>{cementResult.brand} — {cementResult.grade}</h3>
                      <div className="strength-display">
                        <span className="strength-value">{cementResult.strength}</span>
                        <span className="strength-unit">MPa</span>
                      </div>
                      <p className="cement-category-tag">Strength Category: {cementResult.category}</p>
                      
                      <div className="cement-applications">
                        <h5>Standard Recommended Applications:</h5>
                        <ul>
                          {cementResult.applications?.map((app, idx) => (
                            <li key={idx}>{app}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="cement-remarks">
                        <h5>Remarks:</h5>
                        <p>{cementResult.remark}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Profile Settings tab */}
            {activeTab === 'profile' && (
              <div className="profile-workspace container-sm">
                <div className="card-header-with-icon">
                  <Settings size={24} />
                  <h2>Inspector Profile Settings</h2>
                </div>
                
                <form onSubmit={updateProfile} className="profile-form glass">
                  <div className="form-group">
                    <label>Inspector Name</label>
                    <input 
                      type="text" 
                      value={profileName} 
                      onChange={e => setProfileName(e.target.value)} 
                      required 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>New Password (leave blank to keep current)</label>
                    <input 
                      type="password" 
                      value={profilePassword} 
                      onChange={e => setProfilePassword(e.target.value)} 
                      placeholder="••••••••"
                    />
                  </div>

                  <button type="submit" className="btn-primary">Update Profile</button>
                </form>
              </div>
            )}
          </div>
        )}
      </main>

      {/* New Project Modal */}
      {showNewProjModal && (
        <div className="modal-overlay">
          <div className="modal-content glass reveal">
            <div className="modal-header">
              <h3>Create Inspection Project</h3>
              <button onClick={() => setShowNewProjModal(false)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateProject} className="modal-form">
              <div className="form-group">
                <label>Structure / Project Name*</label>
                <input 
                  type="text" 
                  value={newProjName} 
                  onChange={e => setNewProjName(e.target.value)} 
                  placeholder="e.g. Sector-4 Flyover Pillar 12" 
                  required 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Location / City*</label>
                  <input 
                    type="text" 
                    value={newProjLoc} 
                    onChange={e => setNewProjLoc(e.target.value)} 
                    placeholder="e.g. Mumbai, Maharashtra" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Structure Type</label>
                  <select value={newProjType} onChange={e => setNewProjType(e.target.value)}>
                    <option value="Concrete Column">Concrete Column</option>
                    <option value="Concrete Beam">Concrete Beam</option>
                    <option value="Slab / Deck">Slab / Deck</option>
                    <option value="Retaining Wall">Retaining Wall</option>
                    <option value="Masonry / Brick Arch">Masonry / Brick Arch</option>
                    <option value="Steel Truss">Steel Truss</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Age (years)</label>
                  <input 
                    type="number" 
                    value={newProjAge} 
                    onChange={e => setNewProjAge(e.target.value)} 
                    placeholder="10" 
                  />
                </div>
                <div className="form-group">
                  <label>Inspection Zone</label>
                  <input 
                    type="text" 
                    value={newProjZone} 
                    onChange={e => setNewProjZone(e.target.value)} 
                    placeholder="e.g. Zone B - Underdeck" 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Cement Brand*</label>
                  <input 
                    type="text" 
                    value={newProjBrand} 
                    onChange={e => setNewProjBrand(e.target.value)} 
                    placeholder="e.g. UltraTech, ACC" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Cement Grade</label>
                  <select value={newProjComposition} onChange={e => setNewProjComposition(e.target.value)}>
                    <option value="OPC 33">OPC 33 (Standard Strength)</option>
                    <option value="OPC 43">OPC 43 (Medium-High Strength)</option>
                    <option value="OPC 53">OPC 53 (High Strength)</option>
                    <option value="PPC">PPC (Pozzolana Cement)</option>
                    <option value="PSC">PSC (Slag Cement)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Structural context / inspection notes</label>
                <textarea 
                  value={newProjNotes} 
                  onChange={e => setNewProjNotes(e.target.value)} 
                  placeholder="Note down any visual distress, load conditions, environmental exposure details..." 
                  rows={3}
                ></textarea>
              </div>

              <button type="submit" className="btn-primary">Initialize Project Log</button>
            </form>
          </div>
        </div>
      )}

      {/* Styled JSX for Premium UI Aesthetics */}
      <style>{`
        /* --- Premium Design Tokens CSS --- */
        .app-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg);
          color: var(--ink);
        }

        .main-layout {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        /* --- Navbar Styles --- */
        .nav {
          position: sticky;
          top: 0;
          z-index: 100;
          border-bottom: 1px solid var(--line);
        }
        .nav-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          font-size: 18px;
        }
        .brand-mark {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--ink);
          color: var(--bg-elev);
          display: grid;
          place-items: center;
          font-family: var(--font-display);
          font-weight: bold;
          font-size: 18px;
        }
        .brand-name em {
          font-family: var(--font-display);
          font-style: italic;
          color: var(--accent);
          font-weight: 500;
        }
        .nav-links {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          font-size: 14px;
          font-weight: 500;
          border-radius: var(--radius-sm);
          color: var(--muted);
          transition: all 0.2s;
        }
        .nav-item:hover, .nav-item.active {
          color: var(--ink);
          background: var(--bg-soft);
        }
        .nav-separator {
          width: 1px;
          height: 20px;
          background: var(--line);
        }
        .user-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 10px;
          border-radius: 20px;
          background: var(--bg-soft);
          font-size: 13px;
          font-weight: 600;
        }
        .avatar {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--accent);
          color: #fff;
          display: grid;
          place-items: center;
          font-size: 11px;
        }
        .btn-icon {
          padding: 8px;
          border-radius: 50%;
          color: var(--muted);
          display: grid;
          place-items: center;
          transition: all 0.2s;
        }
        .btn-icon:hover {
          color: var(--ink);
          background: var(--bg-soft);
        }
        .nav-guest-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--muted);
          padding: 4px 10px;
          border: 1px dashed var(--line-strong);
          border-radius: 12px;
        }

        /* --- Landing Page Styles --- */
        .auth-landing-container {
          max-width: 1000px;
          margin: 60px auto;
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 60px;
          padding: 0 28px;
          align-items: center;
        }
        .landing-hero {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .hero-title {
          font-size: 48px;
          line-height: 1.1;
          color: var(--ink);
        }
        .hero-subtitle {
          font-size: 18px;
          color: var(--muted);
          line-height: 1.6;
        }
        .hero-subtitle strong {
          color: var(--ink);
        }
        .hero-features {
          display: flex;
          gap: 12px;
          margin-top: 10px;
        }
        .feat-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 12px;
          background: var(--bg-tint);
          border-radius: 20px;
          border: 1px solid var(--line);
        }

        /* --- Auth Card --- */
        .auth-card {
          padding: 36px;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
        }
        .auth-header {
          margin-bottom: 24px;
        }
        .auth-header h2 {
          font-size: 26px;
          margin-bottom: 4px;
        }
        .auth-header p {
          font-size: 14px;
          color: var(--muted);
        }
        .auth-error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: var(--danger-soft);
          color: var(--danger);
          border-radius: var(--radius-sm);
          font-size: 13px;
          margin-bottom: 20px;
          font-weight: 500;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-group label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
        }
        .btn-primary {
          margin-top: 10px;
          background: var(--accent);
          color: white;
          padding: 12px;
          font-size: 15px;
          font-weight: 600;
          border-radius: var(--radius-sm);
          transition: opacity 0.2s;
          text-align: center;
        }
        .btn-primary:hover {
          opacity: 0.9;
        }
        .btn-secondary {
          background: var(--bg-soft);
          color: var(--ink);
          border: 1px solid var(--line);
          padding: 10px 18px;
          font-size: 14px;
          font-weight: 600;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .btn-secondary:hover {
          background: var(--bg-tint);
        }
        .auth-switch {
          margin-top: 20px;
          text-align: center;
        }
        .auth-switch button {
          font-size: 13px;
          color: var(--muted);
          font-weight: 500;
          text-decoration: underline;
        }
        .auth-switch button:hover {
          color: var(--ink);
        }

        /* --- Dashboard Workspace Layout --- */
        .dashboard-container {
          margin: 32px auto;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .workspace-grid {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 32px;
          flex: 1;
        }

        /* --- Projects Left Panel --- */
        .projects-panel {
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          max-height: calc(100vh - 120px);
          overflow: hidden;
        }
        .panel-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--line);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .panel-header h3 {
          font-size: 18px;
          font-weight: 600;
        }
        .btn-add {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--ink);
          color: var(--bg-elev);
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 600;
          border-radius: var(--radius-sm);
        }
        .projects-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: var(--muted);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .empty-state p {
          font-size: 13px;
        }
        .project-list-card {
          padding: 16px;
          background: var(--bg-elev);
          border-radius: var(--radius-sm);
          border: 1px solid var(--line);
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .project-list-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
          border-color: var(--line-strong);
        }
        .project-list-card.active {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 8px;
        }
        .proj-title {
          font-size: 14px;
          font-weight: 600;
          line-height: 1.3;
        }
        .proj-meta {
          font-size: 12px;
          color: var(--muted);
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 12px;
        }
        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          font-weight: 600;
        }
        .struct-type-label {
          color: var(--muted);
          background: var(--bg-tint);
          padding: 2px 8px;
          border-radius: 10px;
        }
        .health-percentage {
          color: var(--success);
        }
        .risk-badge {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .badge-critical { background: var(--danger-soft); color: var(--danger); }
        .badge-high { background: var(--danger-soft); color: var(--danger); }
        .badge-medium { background: var(--warn-soft); color: var(--warn); }
        .badge-low { background: var(--success-soft); color: var(--success); }
        .badge-neutral { background: var(--bg-soft); color: var(--muted); }

        /* --- Right Side Inspection Viewer --- */
        .inspection-viewer {
          border-radius: var(--radius-lg);
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          min-height: calc(100vh - 120px);
          overflow-y: auto;
        }
        .viewer-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid var(--line);
          padding-bottom: 20px;
        }
        .viewer-header h2 {
          font-size: 28px;
          margin-bottom: 8px;
        }
        .meta-row {
          display: flex;
          gap: 16px;
          font-size: 13px;
          color: var(--muted);
        }
        .meta-row span {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .project-notes {
          background: var(--bg-tint);
          padding: 16px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          line-height: 1.6;
        }
        .project-notes h5 {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
          margin-bottom: 4px;
        }
        
        /* --- Upload Screen --- */
        .upload-screen {
          border: 2px dashed var(--line-strong);
          border-radius: var(--radius-lg);
          padding: 60px 40px;
          display: flex;
          justify-content: center;
          align-items: center;
          text-align: center;
          background: var(--bg-tint);
          transition: border-color 0.2s;
        }
        .drag-upload-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          cursor: pointer;
        }
        .drag-upload-label h3 {
          font-size: 18px;
          font-weight: 600;
        }
        .drag-upload-label p {
          font-size: 13px;
          color: var(--muted);
        }
        .analyzing-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid var(--line);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* --- Analysis Results Screen --- */
        .results-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 32px;
        }
        .image-analysis-box {
          position: relative;
          background: #000;
          border-radius: var(--radius-lg);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .image-wrapper {
          position: relative;
          width: 100%;
          line-height: 0;
        }
        .inspected-img {
          width: 100%;
          height: auto;
          display: block;
        }
        .bbox-overlay {
          position: absolute;
          border: 2px solid var(--accent);
          background: rgba(255, 91, 31, 0.15);
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
          cursor: pointer;
          transition: all 0.2s;
        }
        .bbox-overlay.hovered {
          border-color: #fff;
          background: rgba(255, 255, 255, 0.25);
          z-index: 10;
        }
        .bbox-label {
          position: absolute;
          top: -22px;
          left: -2px;
          background: var(--accent);
          color: white;
          padding: 2px 6px;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
          border-radius: 4px 4px 0 0;
        }
        .vision-system-tag {
          padding: 10px 16px;
          background: #111;
          color: #888;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* --- Side Panel Specs / Probs --- */
        .metrics-side-panel {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .health-metric-card {
          background: var(--bg-elev);
          border-radius: var(--radius-sm);
          padding: 20px;
          border: 1px solid var(--line);
        }
        .health-metric-card h3 {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
          margin-bottom: 12px;
        }
        .score-display {
          display: flex;
          align-items: baseline;
          margin-bottom: 8px;
        }
        .score-value {
          font-size: 42px;
          font-family: var(--font-display);
          font-weight: bold;
          line-height: 1;
        }
        .score-max {
          font-size: 14px;
          color: var(--muted);
        }
        .progress-bar-bg {
          height: 6px;
          background: var(--bg-soft);
          border-radius: 3px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          border-radius: 3px;
        }
        .defect-probabilities-card {
          background: var(--bg-elev);
          border-radius: var(--radius-sm);
          padding: 20px;
          border: 1px solid var(--line);
        }
        .defect-probabilities-card h4 {
          font-size: 13px;
          margin-bottom: 16px;
          color: var(--muted);
        }
        .probabilities-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .prob-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 4px;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .prob-item.active {
          background: var(--bg-soft);
        }
        .prob-label {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 600;
        }
        .prob-bar-bg {
          height: 4px;
          background: var(--bg-soft);
          border-radius: 2px;
          overflow: hidden;
        }
        .prob-bar-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 2px;
        }
        .specs-card {
          background: var(--bg-elev);
          border-radius: var(--radius-sm);
          padding: 20px;
          border: 1px solid var(--line);
        }
        .specs-card h4 {
          font-size: 13px;
          margin-bottom: 16px;
          color: var(--muted);
        }
        .specs-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .spec-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          border-bottom: 1px solid var(--line);
          padding-bottom: 8px;
        }
        .spec-row span {
          color: var(--muted);
        }
        .spec-row strong {
          color: var(--ink);
        }

        /* --- Report Display Area --- */
        .diagnostic-report-section {
          grid-column: span 2;
          background: var(--bg-elev);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 32px;
        }
        .diagnostic-report-section h3 {
          font-size: 20px;
          margin-bottom: 20px;
        }
        .report-markdown {
          white-space: pre-wrap;
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.7;
          color: var(--ink-2);
        }
        .analysis-actions {
          grid-column: span 2;
          display: flex;
          justify-content: flex-end;
        }

        /* --- Cement Grade Calculator Tab --- */
        .cement-strength-workspace {
          padding: 40px 0;
        }
        .card-header-with-icon {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .tab-desc {
          color: var(--muted);
          font-size: 14px;
          margin-bottom: 32px;
        }
        .cement-layout-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 32px;
        }
        .cement-form {
          padding: 28px;
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .cement-results-card {
          padding: 32px;
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .strength-display {
          display: flex;
          align-items: baseline;
        }
        .strength-value {
          font-size: 56px;
          font-family: var(--font-display);
          font-weight: bold;
          line-height: 1;
        }
        .strength-unit {
          font-size: 18px;
          color: var(--muted);
          margin-left: 6px;
        }
        .cement-category-tag {
          font-size: 12px;
          font-weight: 700;
          color: var(--accent);
        }
        .cement-applications h5, .cement-remarks h5 {
          font-size: 12px;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }
        .cement-applications ul {
          margin: 0;
          padding-left: 20px;
          font-size: 14px;
        }
        .cement-applications li {
          margin-bottom: 4px;
        }
        .cement-remarks p {
          font-size: 14px;
          line-height: 1.6;
        }

        /* --- Profile settings --- */
        .profile-workspace {
          padding: 40px 0;
        }
        .profile-form {
          padding: 32px;
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* --- Modal Overlays --- */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(10, 10, 10, 0.4);
          backdrop-filter: blur(4px);
          display: grid;
          place-items: center;
          z-index: 1000;
        }
        .modal-content {
          width: 100%;
          max-width: 600px;
          padding: 32px;
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-lg);
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .modal-header h3 {
          font-size: 20px;
        }
        .btn-close {
          padding: 6px;
          border-radius: 50%;
          color: var(--muted);
          transition: background 0.2s;
        }
        .btn-close:hover {
          background: var(--bg-soft);
          color: var(--ink);
        }
        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        /* --- Printing Report Styles --- */
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }
          .nav, .projects-panel, .analysis-actions, .specs-card, .vision-system-tag, .btn-icon, .btn-secondary {
            display: none !important;
          }
          .workspace-grid {
            display: block !important;
          }
          .inspection-viewer {
            padding: 0 !important;
            min-height: auto !important;
          }
          .bbox-overlay {
            border-color: #000 !important;
          }
          .bbox-label {
            background: #000 !important;
          }
          .diagnostic-report-section {
            border: none !important;
            padding: 0 !important;
            margin-top: 40px;
          }
        }
      `}</style>
    </div>
  );
}
