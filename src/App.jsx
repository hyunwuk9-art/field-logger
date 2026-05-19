import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pqpdztruyeisrqzrtooe.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxcGR6dHJ1eWVpc3JxenJ0b29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NjM0OTEsImV4cCI6MjA5NDEzOTQ5MX0.8PmYvA69apifozwXxW4YT3v0qGkN-2HDFkNdjekoxCQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const USERS = [
  { id: "A", name: "김현욱", color: "#1D9E75", bg: "#E1F5EE" },
  { id: "B", name: "김근식", color: "#185FA5", bg: "#E6F1FB" },
];
const CATEGORIES = ["치수 측정", "현장 확인", "자재 발주", "공정 관리", "기타"];
const UNITS = ["mm", "cm", "m", "kg", "ton", "ea", "%"];

function formatTime(date) {
  return new Date(date).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("ko-KR", {
    month: "long", day: "numeric", weekday: "short",
  });
}
function formatDateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}
function rowToRecord(row) {
  const user = USERS.find((u) => u.id === row.user_id) || USERS[0];
  let width = "", height = "", depth = "", memo = row.memo || "", unit = "mm", sketch = "";
  if (memo.startsWith("__DIM__|")) {
    const parts = memo.split("|");
    width = parts[1] || "";
    height = parts[2] || "";
    depth = parts[3] || "";
    memo = parts[4] || "";
    unit = parts[5] || "mm";
    sketch = parts[6] || "";
  }
  let photoUrls = [];
  if (row.has_photo && row.photo_name) {
    photoUrls = row.photo_name.split("||").filter(Boolean);
  }
  return {
    id: row.id, user, category: row.category,
    width, height, depth, memo, unit, sketch,
    photoUrls,
    hasPhoto: row.has_photo,
    date: row.created_at,
  };
}

async function compressImage(file, maxWidth = 1200, quality = 0.75) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => resolve(new File([blob], file.name, { type: "image/jpeg" })),
          "image/jpeg", quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function SketchPad({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const history = useRef([]);
  const [penColor, setPenColor] = useState("#1a1a1a");
  const [penSize, setPenSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  };

  const saveHistory = () => {
    history.current.push(canvasRef.current.toDataURL());
    if (history.current.length > 30) history.current.shift();
  };

  const start = (e) => {
    e.preventDefault();
    saveHistory();
    drawing.current = true;
    lastPos.current = getPos(e, canvasRef.current);
  };

  const move = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = isEraser ? "#fafafa" : penColor;
    ctx.lineWidth = isEraser ? penSize * 5 : penSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const end = (e) => { e.preventDefault(); drawing.current = false; };

  const undo = () => {
    if (history.current.length === 0) return;
    const prev = history.current.pop();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = prev;
  };

  const clear = () => {
    saveHistory();
    canvasRef.current.getContext("2d").clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const save = () => onSave(canvasRef.current.toDataURL("image/png"));

  const colors = ["#1a1a1a", "#e24b4a", "#185FA5", "#1D9E75", "#f59e0b", "#7c3aed"];
  const sizes = [2, 4, 8, 14];

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "#1a1a2e", zIndex: 200, display: "flex", flexDirection: "column",
    }}>
      <div style={{
        background: "#16213e", padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        borderBottom: "1px solid #0f3460",
      }}>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, marginRight: 4 }}>✏️ 스케치</span>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {colors.map((c) => (
            <button key={c} onClick={() => { setPenColor(c); setIsEraser(false); }}
              style={{
                width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer",
                border: penColor === c && !isEraser ? "3px solid #fff" : "2px solid rgba(255,255,255,0.2)",
              }} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 4 }}>
          {sizes.map((s) => (
            <button key={s} onClick={() => { setPenSize(s); setIsEraser(false); }}
              style={{
                width: 30, height: 30, borderRadius: "50%", cursor: "pointer",
                background: penSize === s && !isEraser ? "#fff" : "rgba(255,255,255,0.1)",
                border: penSize === s && !isEraser ? "2px solid #0F6E56" : "2px solid transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              <div style={{ width: s, height: s, borderRadius: "50%", background: penSize === s && !isEraser ? "#1a1a2e" : "#aaa" }} />
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button onClick={() => setIsEraser(!isEraser)}
            style={{
              padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 12, cursor: "pointer", fontWeight: 600,
              background: isEraser ? "#fff" : "rgba(255,255,255,0.1)",
              color: isEraser ? "#1a1a2e" : "#ccc",
            }}>
            지우개
          </button>
          <button onClick={undo}
            style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.1)", color: "#ccc", fontSize: 12, cursor: "pointer" }}>
            ↩ 되돌리기
          </button>
          <button onClick={clear}
            style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "rgba(226,75,74,0.2)", color: "#e24b4a", fontSize: 12, cursor: "pointer" }}>
            전체 지우기
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
        <canvas
          ref={canvasRef} width={800} height={600}
          style={{
            background: "#fafafa", borderRadius: 8,
            touchAction: "none", cursor: isEraser ? "cell" : "crosshair",
            maxWidth: "100%", maxHeight: "100%",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
      </div>

      <div style={{
        background: "#16213e", padding: "12px 16px",
        display: "flex", gap: 10, borderTop: "1px solid #0f3460",
      }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: "14px", borderRadius: 10, border: "none", background: "rgba(255,255,255,0.1)", color: "#ccc", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          취소
        </button>
        <button onClick={save}
          style={{ flex: 2, padding: "14px", borderRadius: 10, border: "none", background: "#0F6E56", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          ✓ 저장
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(USERS[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [depth, setDepth] = useState("");
  const [unit, setUnit] = useState("mm");
  const [memo, setMemo] = useState("");
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [sketch, setSketch] = useState("");
  const [showSketch, setShowSketch] = useState(false);
  const [activeTab, setActiveTab] = useState("input");
  const [mainMode, setMainMode] = useState("records");
  const [scheduleView, setScheduleView] = useState("list");
  const [schedules, setSchedules] = useState([]);
  const [schTitle, setSchTitle] = useState("");
  const [schDate, setSchDate] = useState(new Date().toISOString().slice(0, 10));
  const [schMemo, setSchMemo] = useState("");
  const [schSaving, setSchSaving] = useState(false);
  const [showSchForm, setShowSchForm] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedCalDate, setSelectedCalDate] = useState("");
  const [schDeleteConfirm, setSchDeleteConfirm] = useState(null);
  const [filterDate, setFilterDate] = useState("");
  const [expandedImg, setExpandedImg] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fileRef = useRef(null);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("field_records")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const mapped = await Promise.all(
        data.map(async (row) => {
          const rec = rowToRecord(row);
          if (rec.hasPhoto && rec.photoUrls.length > 0) {
            const urls = await Promise.all(
              rec.photoUrls.map(async (name) => {
                if (name.startsWith("http")) return name;
                const { data: urlData } = supabase.storage.from("photos").getPublicUrl(name);
                return urlData?.publicUrl || "";
              })
            );
            rec.photoUrls = urls.filter(Boolean);
          }
          return rec;
        })
      );
      setRecords(mapped);
    } catch (e) {
      setError("불러오기 실패: " + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); fetchSchedules(); }, []);

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .order("schedule_date", { ascending: true });
      if (error) throw error;
      setSchedules(data || []);
    } catch (e) {
      console.error("일정 로드 실패:", e.message);
    }
  };const handleAddSchedule = async () => {
    if (!schTitle.trim() || !schDate) return;
    setSchSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from("schedules").insert({
        title: schTitle.trim(),
        schedule_date: schDate,
        memo: schMemo.trim(),
        done: false,
        user_id: currentUser.id,
        user_name: currentUser.name,
      });
      if (error) throw error;
      setSchTitle("");
      setSchMemo("");
      setSchDate(new Date().toISOString().slice(0, 10));
      setShowSchForm(false);
      await fetchSchedules();
    } catch (e) {
      setError("일정 저장 실패: " + e.message);
    }
    setSchSaving(false);
  };

  const toggleScheduleDone = async (id, currentDone) => {
    try {
      const { error } = await supabase
        .from("schedules")
        .update({ done: !currentDone })
        .eq("id", id);
      if (error) throw error;
      setSchedules((prev) => prev.map((s) => s.id === id ? { ...s, done: !currentDone } : s));
    } catch (e) {
      setError("완료 처리 실패: " + e.message);
    }
  };

  const handleDeleteSchedule = async (id) => {
    try {
      const { error } = await supabase.from("schedules").delete().eq("id", id);
      if (error) throw error;
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      setSchDeleteConfirm(null);
    } catch (e) {
      setError("일정 삭제 실패: " + e.message);
    }
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setPhotoFiles((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreviews((prev) => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removePhoto = (index) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      let photoNames = [];
      for (const file of photoFiles) {
        const compressed = await compressImage(file);
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("photos")
          .upload(fileName, compressed, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        photoNames.push(fileName);
      }

      const memoStr = `__DIM__|${width}|${height}|${depth}|${memo}|${unit}|${sketch}`;

      const { error: dbErr } = await supabase.from("field_records").insert({
        user_id: currentUser.id,
        user_name: currentUser.name,
        category,
        memo: memoStr,
        has_photo: photoNames.length > 0,
        photo_name: photoNames.join("||"),
      });
      if (dbErr) throw dbErr;

      setWidth(""); setHeight(""); setDepth("");
      setMemo(""); setSketch("");
      setPhotoFiles([]); setPhotoPreviews([]);
      setUnit("mm"); setCategory(CATEGORIES[0]);

      await fetchRecords();
      setActiveTab("list");
    } catch (e) {
      setError("저장 실패: " + e.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from("field_records").delete().eq("id", id);
      if (error) throw error;
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirm(null);
    } catch (e) {
      setError("삭제 실패: " + e.message);
    }
  };

  const canSubmit = !saving && (width || height || depth || memo || photoFiles.length > 0 || sketch);

  const grouped = {};
  records.forEach((rec) => {
    const key = formatDateKey(rec.date);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(rec);
  });
  const allDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const filteredKeys = filterDate ? allDates.filter((d) => d === filterDate) : allDates;

  const inputStyle = {
    width: "100%", padding: "14px", borderRadius: 10,
    border: "1.5px solid #dde1e7", fontSize: 15, background: "#fff",
    color: "#1a1a1a",
    boxSizing: "border-box", outline: "none", fontFamily: "inherit",
    WebkitTextFillColor: "#1a1a1a",
    colorScheme: "light",
  };
  const labelStyle = {
    fontSize: 13, fontWeight: 700, color: "#444",
    marginBottom: 8, display: "block",
  };

  return (
    <div style={{
      fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
      background: "#f4f6fa", minHeight: "100vh", maxWidth: 480, margin: "0 auto",
    }}>

      <div style={{
        background: "#0F6E56", padding: "14px 18px",
        position: "sticky", top: 0, zIndex: 50,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>📋 Field Logger</div>
            <div style={{ color: "#a8dfc9", fontSize: 11, marginTop: 1 }}>현장 기록 앱</div>
          </div>
          <div style={{
            display: "flex", background: "rgba(255,255,255,0.15)",
            borderRadius: 10, padding: 3, gap: 3,
          }}>
            {USERS.map((u) => (
              <button key={u.id} onClick={() => setCurrentUser(u)}
                style={{
                  padding: "7px 14px", borderRadius: 8, border: "none",
                  background: currentUser.id === u.id ? "#fff" : "transparent",
                  color: currentUser.id === u.id ? u.color : "rgba(255,255,255,0.8)",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                {u.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e6e9ef" }}>
        {[["records", "📋 현장 기록"], ["schedules", "📅 일정"]].map(([m, label]) => (
          <button key={m} onClick={() => setMainMode(m)}
            style={{
              flex: 1, padding: "14px", border: "none", background: "transparent",
              color: mainMode === m ? "#0F6E56" : "#999",
              fontSize: 15, fontWeight: 800,
              borderBottom: mainMode === m ? "3px solid #0F6E56" : "3px solid transparent",
              cursor: "pointer",
            }}>
            {label}
          </button>
        ))}
      </div>

      {mainMode === "records" && (
      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e6e9ef" }}>
        {[["input", "✏️ 기록 입력"], ["list", "📋 기록 목록"]].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: "13px", border: "none", background: "transparent",
              color: activeTab === tab ? "#0F6E56" : "#999",
              fontSize: 14, fontWeight: 700,
              borderBottom: activeTab === tab ? "3px solid #0F6E56" : "3px solid transparent",
              cursor: "pointer",
            }}>
            {label}
          </button>
        ))}
      </div>
      )}

      {error && (
        <div style={{
          margin: "12px 16px", padding: "12px 16px",
          background: "#fff5f5", border: "1px solid #fecaca",
          borderRadius: 10, color: "#e24b4a", fontSize: 13,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#e24b4a", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {showSketch && (
        <SketchPad
          onSave={(d) => { setSketch(d); setShowSketch(false); }}
          onCancel={() => setShowSketch(false)}
        />
      )}

      {expandedImg && (
        <div onClick={() => setExpandedImg("")}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.92)", zIndex: 300,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}>
          <img src={expandedImg} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }} />
        </div>
      )}

      {deleteConfirm && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", zIndex: 250,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 320 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>정말 삭제할까요?</div>
            <div style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>삭제 후 복구할 수 없습니다.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid #dde1e7", background: "#fff", fontSize: 14, cursor: "pointer" }}>
                취소
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#e24b4a", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {mainMode === "records" && activeTab === "input" && (
        <div style={{ padding: "16px 16px 60px" }}>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>카테고리</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)}
                  style={{
                    padding: "8px 14px", borderRadius: 100,
                    border: "2px solid " + (category === c ? "#0F6E56" : "#dde1e7"),
                    background: category === c ? "#E1F5EE" : "#fff",
                    color: category === c ? "#0F6E56" : "#555",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>치수</label>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {UNITS.map((u) => (
                  <button key={u} onClick={() => setUnit(u)}
                    style={{
                      padding: "4px 9px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                      border: "1.5px solid " + (unit === u ? "#0F6E56" : "#dde1e7"),
                      background: unit === u ? "#0F6E56" : "#fff",
                      color: unit === u ? "#fff" : "#666", fontWeight: 600,
                    }}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[["W 가로", width, setWidth], ["H 세로", height, setHeight], ["D 깊이", depth, setDepth]].map(([ph, val, set]) => (
                <input key={ph} placeholder={ph} value={val} onChange={(e) => set(e.target.value)}
                  type="number" style={{ ...inputStyle, textAlign: "center", padding: "12px 8px" }} />
              ))}
            </div>
            {(width || height || depth) && (
              <div style={{ marginTop: 8, textAlign: "center", fontSize: 13, color: "#0F6E56", fontWeight: 600 }}>
                {[width, height, depth].filter(Boolean).join(" × ")} {unit}
              </div>
            )}
          </div><div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>스케치</label>
            <button onClick={() => setShowSketch(true)}
              style={{
                width: "100%", padding: "16px", borderRadius: 12,
                border: "2px dashed " + (sketch ? "#0F6E56" : "#adb5c2"),
                background: sketch ? "#E1F5EE" : "#fff",
                color: sketch ? "#0F6E56" : "#888",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>
              {sketch ? "✏️ 스케치 완료 — 클릭해서 수정" : "✏️ 스케치 그리기 (전체화면)"}
            </button>
            {sketch && (
              <div style={{ marginTop: 8, position: "relative" }}>
                <img src={sketch} onClick={() => setShowSketch(true)}
                  style={{ width: "100%", borderRadius: 10, border: "1px solid #dde1e7", cursor: "pointer" }} />
                <button onClick={() => setSketch("")}
                  style={{
                    position: "absolute", top: 8, right: 8,
                    background: "#e24b4a", border: "none", borderRadius: 6,
                    padding: "4px 10px", color: "#fff", fontSize: 12, cursor: "pointer",
                  }}>
                  삭제
                </button>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>메모</label>
            <textarea
              placeholder="현장 상황, 특이사항 등을 입력하세요"
              value={memo} onChange={(e) => setMemo(e.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>
              사진
              {photoFiles.length > 0 && (
                <span style={{ color: "#0F6E56", marginLeft: 6 }}>({photoFiles.length}장 선택됨)</span>
              )}
            </label>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhotoChange} style={{ display: "none" }} />
            <button onClick={() => fileRef.current.click()}
              style={{
                width: "100%", padding: "16px", borderRadius: 12,
                border: "2px dashed " + (photoFiles.length > 0 ? "#0F6E56" : "#adb5c2"),
                background: photoFiles.length > 0 ? "#E1F5EE" : "#fff",
                color: photoFiles.length > 0 ? "#0F6E56" : "#888",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>
              📷 사진 추가 (여러 장 동시 선택 가능)
            </button>
            {photoPreviews.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
                {photoPreviews.map((preview, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <img src={preview}
                      style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, border: "1px solid #dde1e7", display: "block" }} />
                    <button onClick={() => removePhoto(i)}
                      style={{
                        position: "absolute", top: 4, right: 4,
                        background: "#e24b4a", border: "none", borderRadius: "50%",
                        width: 22, height: 22, color: "#fff", fontSize: 14,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        lineHeight: 1,
                      }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{
              width: "100%", padding: "18px", borderRadius: 14, border: "none",
              background: canSubmit ? "#0F6E56" : "#ccc",
              color: "#fff", fontSize: 17, fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}>
            {saving ? "저장 중..." : "✓ 기록 저장"}
          </button>
          {!canSubmit && !saving && (
            <div style={{ textAlign: "center", fontSize: 12, color: "#aaa", marginTop: 8 }}>
              치수, 메모, 스케치, 사진 중 하나 이상 입력하세요
            </div>
          )}
        </div>
      )}

      {mainMode === "records" && activeTab === "list" && (
        <div style={{ padding: "16px 16px 60px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 14, color: "#666", fontWeight: 600 }}>
              총 {records.length}건
            </div>
            <button onClick={fetchRecords} disabled={loading}
              style={{
                padding: "8px 16px", borderRadius: 10,
                border: "1.5px solid #dde1e7", background: "#fff",
                color: "#555", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
              {loading ? "로딩 중..." : "🔄 새로고침"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <button onClick={() => setFilterDate("")}
              style={{
                padding: "7px 14px", borderRadius: 100, whiteSpace: "nowrap",
                border: "2px solid " + (!filterDate ? "#0F6E56" : "#dde1e7"),
                background: !filterDate ? "#E1F5EE" : "#fff",
                color: !filterDate ? "#0F6E56" : "#666",
                fontSize: 13, cursor: "pointer",
              }}>
              전체
            </button>
            {allDates.map((d) => (
              <button key={d} onClick={() => setFilterDate(d)}
                style={{
                  padding: "7px 14px", borderRadius: 100, whiteSpace: "nowrap",
                  border: "2px solid " + (filterDate === d ? "#0F6E56" : "#dde1e7"),
                  background: filterDate === d ? "#E1F5EE" : "#fff",
                  color: filterDate === d ? "#0F6E56" : "#666",
                  fontSize: 13, cursor: "pointer",
                }}>
                {new Date(d).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
              </button>
            ))}
          </div>

          {loading && <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa" }}>불러오는 중...</div>}
          {!loading && filteredKeys.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa" }}>기록이 없습니다</div>
          )}

          {!loading && filteredKeys.map((dateKey) => (
            <div key={dateKey}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 10px" }}>
                <div style={{ height: 1, flex: 1, background: "#dde1e7" }} />
                <div style={{
                  background: "#0F6E56", color: "#fff",
                  borderRadius: 100, padding: "4px 14px", fontSize: 12, fontWeight: 700,
                }}>
                  {formatDate(dateKey)}
                </div>
                <div style={{ height: 1, flex: 1, background: "#dde1e7" }} />
              </div>

              <div style={{ position: "relative", paddingLeft: 28 }}>
                <div style={{ position: "absolute", left: 10, top: 0, bottom: 0, width: 2, background: "#dde1e7" }} />
                {grouped[dateKey].map((rec) => (
                  <div key={rec.id} style={{ position: "relative", marginBottom: 14 }}>
                    <div style={{
                      position: "absolute", left: -24, top: 18,
                      width: 12, height: 12, borderRadius: "50%",
                      background: rec.user.color, border: "2px solid #f4f6fa",
                    }} />
                    <div style={{
                      background: "#fff", borderRadius: 14,
                      border: "1px solid #e6e9ef", padding: "14px 16px",
                      borderLeft: "4px solid " + rec.user.color,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: rec.user.color }}>{rec.user.name}</span>
                          <span style={{ fontSize: 11, color: "#aaa" }}>{formatTime(rec.date)}</span>
                        </div>
                        <button onClick={() => setDeleteConfirm(rec.id)}
                          style={{
                            background: "#fff0f0", border: "none", borderRadius: 8,
                            padding: "5px 10px", color: "#e24b4a", fontSize: 12, cursor: "pointer",
                          }}>
                          🗑 삭제
                        </button>
                      </div>

                      <span style={{
                        display: "inline-block", background: "#f4f6fa", color: "#555",
                        fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "3px 10px", marginBottom: 10,
                      }}>
                        {rec.category}
                      </span>

                      {(rec.width || rec.height || rec.depth) && (
                        <div style={{
                          background: "#f0fdf8", borderRadius: 8, padding: "10px 14px",
                          marginBottom: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
                        }}>
                          {rec.width && <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "#5DCAA5" }}>가로(W)</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "#0F6E56" }}>{rec.width}</div>
                          </div>}
                          {rec.width && rec.height && <div style={{ color: "#aaa", fontSize: 16 }}>×</div>}
                          {rec.height && <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "#5DCAA5" }}>세로(H)</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "#0F6E56" }}>{rec.height}</div>
                          </div>}
                          {rec.depth && <div style={{ color: "#aaa", fontSize: 16 }}>×</div>}
                          {rec.depth && <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "#5DCAA5" }}>깊이(D)</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "#0F6E56" }}>{rec.depth}</div>
                          </div>}
                          <div style={{ fontSize: 13, color: "#5DCAA5", fontWeight: 700 }}>{rec.unit}</div>
                        </div>
                      )}

                      {rec.sketch && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>✏️ 스케치</div>
                          <img src={rec.sketch} onClick={() => setExpandedImg(rec.sketch)}
                            style={{ width: "100%", borderRadius: 8, border: "1px solid #dde1e7", cursor: "pointer" }} />
                        </div>
                      )}

                      {rec.memo && (
                        <p style={{ fontSize: 14, color: "#333", lineHeight: 1.6, margin: "0 0 10px" }}>
                          {rec.memo}
                        </p>
                      )}

                      {rec.photoUrls && rec.photoUrls.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
                            📷 사진 ({rec.photoUrls.length}장)
                          </div>
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: rec.photoUrls.length === 1 ? "1fr" : "repeat(2, 1fr)",
                            gap: 6,
                          }}>
                            {rec.photoUrls.map((url, i) => (
                              <img key={i} src={url} onClick={() => setExpandedImg(url)}
                                style={{
                                  width: "100%", borderRadius: 8,
                                  border: "1px solid #dde1e7", cursor: "pointer",
                                  aspectRatio: rec.photoUrls.length === 1 ? "auto" : "1",
                                  objectFit: rec.photoUrls.length === 1 ? "contain" : "cover",
                                  maxHeight: rec.photoUrls.length === 1 ? 220 : undefined,
                                  display: "block",
                                }} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}{mainMode === "schedules" && (
        <SchedulesView
          schedules={schedules}
          users={USERS}
          currentUser={currentUser}
          scheduleView={scheduleView}
          setScheduleView={setScheduleView}
          showSchForm={showSchForm}
          setShowSchForm={setShowSchForm}
          schTitle={schTitle} setSchTitle={setSchTitle}
          schDate={schDate} setSchDate={setSchDate}
          schMemo={schMemo} setSchMemo={setSchMemo}
          schSaving={schSaving}
          handleAddSchedule={handleAddSchedule}
          toggleScheduleDone={toggleScheduleDone}
          calMonth={calMonth} setCalMonth={setCalMonth}
          selectedCalDate={selectedCalDate} setSelectedCalDate={setSelectedCalDate}
          schDeleteConfirm={schDeleteConfirm} setSchDeleteConfirm={setSchDeleteConfirm}
          handleDeleteSchedule={handleDeleteSchedule}
          inputStyle={inputStyle} labelStyle={labelStyle}
        />
      )}

      {mainMode === "records" && activeTab === "list" && (
        <button onClick={() => setActiveTab("input")}
          style={{
            position: "fixed", bottom: 24, right: 24,
            width: 60, height: 60, borderRadius: "50%",
            background: "#0F6E56", color: "#fff", fontSize: 28,
            border: "none", cursor: "pointer",
            boxShadow: "0 4px 20px rgba(15,110,86,0.45)", zIndex: 100,
          }}>
          +
        </button>
      )}

      {mainMode === "schedules" && !showSchForm && (
        <button onClick={() => setShowSchForm(true)}
          style={{
            position: "fixed", bottom: 24, right: 24,
            width: 60, height: 60, borderRadius: "50%",
            background: "#0F6E56", color: "#fff", fontSize: 28,
            border: "none", cursor: "pointer",
            boxShadow: "0 4px 20px rgba(15,110,86,0.45)", zIndex: 100,
          }}>
          +
        </button>
      )}
    </div>
  );
}

function SchedulesView(props) {
  const {
    schedules, users, scheduleView, setScheduleView,
    showSchForm, setShowSchForm,
    schTitle, setSchTitle, schDate, setSchDate, schMemo, setSchMemo,
    schSaving, handleAddSchedule, toggleScheduleDone,
    calMonth, setCalMonth, selectedCalDate, setSelectedCalDate,
    schDeleteConfirm, setSchDeleteConfirm, handleDeleteSchedule,
    inputStyle, labelStyle,
  } = props;

  const getUser = (id) => users.find((u) => u.id === id) || users[0];

  const [year, month] = calMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = new Date().toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, ymd });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const changeMonth = (delta) => {
    let y = year, m = month + delta;
    if (m === 0) { m = 12; y -= 1; }
    else if (m === 13) { m = 1; y += 1; }
    setCalMonth(`${y}-${String(m).padStart(2, "0")}`);
    setSelectedCalDate("");
  };

  const schedulesByDate = {};
  schedules.forEach((s) => {
    if (!schedulesByDate[s.schedule_date]) schedulesByDate[s.schedule_date] = [];
    schedulesByDate[s.schedule_date].push(s);
  });

  const selectedSchedules = selectedCalDate ? (schedulesByDate[selectedCalDate] || []) : [];

  return (
    <div style={{ padding: "16px 16px 80px" }}>
      <div style={{
        display: "flex", background: "#fff", borderRadius: 10,
        padding: 3, marginBottom: 16, gap: 3,
        border: "1px solid #e6e9ef",
      }}>
        {[["list", "📋 리스트"], ["calendar", "📅 캘린더"]].map(([v, label]) => (
          <button key={v} onClick={() => setScheduleView(v)}
            style={{
              flex: 1, padding: "10px", border: "none", borderRadius: 8,
              background: scheduleView === v ? "#0F6E56" : "transparent",
              color: scheduleView === v ? "#fff" : "#666",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
            {label}
          </button>
        ))}
      </div>

      {showSchForm && (
        <div style={{
          background: "#fff", borderRadius: 14, padding: 18,
          border: "1.5px solid #0F6E56", marginBottom: 16,
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0F6E56", marginBottom: 14 }}>
            ➕ 새 일정 추가
          </div>

          <label style={labelStyle}>제목</label>
          <input value={schTitle} onChange={(e) => setSchTitle(e.target.value)}
            placeholder="예: 자재 발주 마감"
            style={{ ...inputStyle, marginBottom: 12 }} />

          <label style={labelStyle}>날짜</label>
          <input type="date" value={schDate} onChange={(e) => setSchDate(e.target.value)}
            style={{ ...inputStyle, marginBottom: 12 }} />

          <label style={labelStyle}>메모 (선택)</label>
          <textarea value={schMemo} onChange={(e) => setSchMemo(e.target.value)}
            placeholder="상세 내용을 입력하세요" rows={3}
            style={{ ...inputStyle, resize: "none", lineHeight: 1.6, marginBottom: 14 }} />

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setShowSchForm(false); setSchTitle(""); setSchMemo(""); }}
              style={{
                flex: 1, padding: "14px", borderRadius: 10,
                border: "1.5px solid #dde1e7", background: "#fff",
                color: "#555", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>
              취소
            </button>
            <button onClick={handleAddSchedule}
              disabled={!schTitle.trim() || !schDate || schSaving}
              style={{
                flex: 2, padding: "14px", borderRadius: 10, border: "none",
                background: (schTitle.trim() && schDate && !schSaving) ? "#0F6E56" : "#ccc",
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: (schTitle.trim() && schDate && !schSaving) ? "pointer" : "not-allowed",
              }}>
              {schSaving ? "저장 중..." : "✓ 일정 저장"}
            </button>
          </div>
        </div>
      )}

      {schDeleteConfirm && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", zIndex: 250,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 320 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>일정을 삭제할까요?</div>
            <div style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>삭제 후 복구할 수 없습니다.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setSchDeleteConfirm(null)}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid #dde1e7", background: "#fff", fontSize: 14, cursor: "pointer" }}>
                취소
              </button>
              <button onClick={() => handleDeleteSchedule(schDeleteConfirm)}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#e24b4a", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {scheduleView === "calendar" && (
        <div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 12, background: "#fff", borderRadius: 10, padding: "8px 12px",
            border: "1px solid #e6e9ef",
          }}>
            <button onClick={() => changeMonth(-1)}
              style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: "4px 12px", color: "#0F6E56" }}>
              ‹
            </button>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#333" }}>
              {year}년 {month}월
            </div>
            <button onClick={() => changeMonth(1)}
              style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: "4px 12px", color: "#0F6E56" }}>
              ›
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
            {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
              <div key={d} style={{
                textAlign: "center", fontSize: 12, fontWeight: 700, padding: "6px 0",
                color: i === 0 ? "#e24b4a" : i === 6 ? "#185FA5" : "#666",
              }}>
                {d}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} />;
              const daySchedules = schedulesByDate[cell.ymd] || [];
              const isToday = cell.ymd === today;
              const isSelected = cell.ymd === selectedCalDate;
              const weekday = i % 7;
              return (
                <button key={i} onClick={() => setSelectedCalDate(isSelected ? "" : cell.ymd)}
                  style={{
                    aspectRatio: "1", padding: "4px",
                    background: isSelected ? "#0F6E56" : isToday ? "#E1F5EE" : "#fff",
                    color: isSelected ? "#fff" : weekday === 0 ? "#e24b4a" : weekday === 6 ? "#185FA5" : "#333",
                    borderRadius: 8, cursor: "pointer",
                    border: isToday && !isSelected ? "1.5px solid #0F6E56" : "1px solid #e6e9ef",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
                    fontSize: 13, fontWeight: 600, gap: 2,
                  }}>
                  <div>{cell.day}</div>
                  {daySchedules.length > 0 && (
                    <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                      {daySchedules.slice(0, 3).map((s, j) => (
                        <div key={j} style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: isSelected ? "#fff" : s.done ? "#ccc" : getUser(s.user_id).color,
                        }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedCalDate && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "#333" }}>
                📅 {new Date(selectedCalDate + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
              </div>
              {selectedSchedules.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#aaa", fontSize: 13, background: "#fff", borderRadius: 10 }}>
                  이 날 일정이 없습니다
                </div>
              ) : (
                selectedSchedules.map((s) => (
                  <ScheduleItem key={s.id} s={s}
                    getUser={getUser}
                    toggleScheduleDone={toggleScheduleDone}
                    setSchDeleteConfirm={setSchDeleteConfirm}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {scheduleView === "list" && (
        <div>
          {schedules.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa" }}>
              일정이 없습니다. + 버튼으로 추가하세요!
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F6E56", marginBottom: 8 }}>
                할 일 ({schedules.filter((s) => !s.done).length})
              </div>
              {schedules.filter((s) => !s.done).length === 0 && (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#aaa", fontSize: 13, background: "#fff", borderRadius: 10, marginBottom: 16 }}>
                  모든 일정이 완료됐어요! 🎉
                </div>
              )}
              {schedules.filter((s) => !s.done).map((s) => (
                <ScheduleItem key={s.id} s={s}
                  getUser={getUser}
                  toggleScheduleDone={toggleScheduleDone}
                  setSchDeleteConfirm={setSchDeleteConfirm}
                />
              ))}

              {schedules.filter((s) => s.done).length > 0 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#999", margin: "20px 0 8px" }}>
                    완료됨 ({schedules.filter((s) => s.done).length})
                  </div>
                  {schedules.filter((s) => s.done).map((s) => (
                    <ScheduleItem key={s.id} s={s}
                      getUser={getUser}
                      toggleScheduleDone={toggleScheduleDone}
                      setSchDeleteConfirm={setSchDeleteConfirm}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ScheduleItem({ s, getUser, toggleScheduleDone, setSchDeleteConfirm }) {
  const u = getUser(s.user_id);
  return (
    <div style={{
      background: "#fff", borderRadius: 12,
      border: "1px solid #e6e9ef", padding: "12px 14px",
      marginBottom: 8, borderLeft: "4px solid " + (s.done ? "#ccc" : u.color),
      display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <button onClick={() => toggleScheduleDone(s.id, s.done)}
        style={{
          minWidth: 24, height: 24, borderRadius: 6,
          border: "2px solid " + (s.done ? "#0F6E56" : "#ccc"),
          background: s.done ? "#0F6E56" : "#fff",
          color: "#fff", fontSize: 14, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 0, marginTop: 2,
        }}>
        {s.done ? "✓" : ""}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 700,
          color: s.done ? "#aaa" : "#333",
          textDecoration: s.done ? "line-through" : "none",
          wordBreak: "break-word",
        }}>
          {s.title}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: u.color, fontWeight: 700 }}>{u.name}</span>
          <span style={{ fontSize: 11, color: "#aaa" }}>·</span>
          <span style={{ fontSize: 12, color: "#666" }}>
            {new Date(s.schedule_date + "T00:00:00").toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" })}
          </span>
        </div>
        {s.memo && (
          <div style={{
            fontSize: 13, color: s.done ? "#bbb" : "#555",
            marginTop: 6, lineHeight: 1.5,
            textDecoration: s.done ? "line-through" : "none",
            wordBreak: "break-word",
          }}>
            {s.memo}
          </div>
        )}
      </div>
      <button onClick={() => setSchDeleteConfirm(s.id)}
        style={{
          background: "none", border: "none", color: "#e24b4a",
          fontSize: 16, cursor: "pointer", padding: "4px 6px",
        }}>
        🗑
      </button>
    </div>
  );
}
