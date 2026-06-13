window.api = async function(url, options = {}) {
  // Use mock token for now since backend doesn't properly implement JWT auth,
  // but it does use Flask session which is automatic via cookies.
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const token = localStorage.getItem("token");
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(url, { ...options, headers });
  
  // Handle empty responses
  if (res.status === 204) return null;
  
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
        data = { error: "Server error or Flask is not running on this URL. Please ensure you are running `python app.py` and accessing it via http://127.0.0.1:5000." };
      } else {
        data = { error: "Invalid response format from server" };
      }
    }
  }

  if (!res.ok) {
    const error = new Error(data.error || "An error occurred");
    error.status = res.status;
    throw error;
  }
  return data;
};

window.Auth = {
  setSession: (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  },
  getUser: () => {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
  },
  getToken: () => localStorage.getItem("token"),
  clear: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },
  requireAuth: () => {
    if (!localStorage.getItem("token")) {
      window.location.href = "/login";
      return false;
    }
    return true;
  },
  redirectIfAuthed: () => {
    if (localStorage.getItem("token")) {
      window.location.href = "/dashboard";
    }
  }
};

window.toast = (msg, type = "info") => {
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.textContent = msg;
  document.body.appendChild(t);
  
  // Trigger reflow
  t.offsetHeight;
  t.classList.add("show");
  
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, 3000);
};

window.initials = (name) => {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
};

window.initReveal = () => {
  const reveals = document.querySelectorAll('.reveal');
  reveals.forEach((r, i) => {
    setTimeout(() => {
      r.classList.add('in');
    }, i * 100);
  });
};
