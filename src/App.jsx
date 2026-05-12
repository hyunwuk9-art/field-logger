import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pqpdztruyeisrqzrtooe.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxcGR6dHJ1eWVpc3JxenJ0b29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NjM0OTEsImV4cCI6MjA5NDEzOTQ5MX0.8PmYvA69apifozwXxW4YT3v0qGkN-2HDFkNdjekoxCQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const USERS = [
  { id: "A", name: "작업자 A", color: "#1D9E75", bg: "#E1F5EE" },
  { id: "B", name: "작업자 B", color: "#185FA5", bg: "#E6F1FB" },
];
const CATEGORIES = ["치수 측정", "자재 확인", "안전 점검", "공정 현황", "기타"];
const UNITS = ["mm", "cm", "m", "kg", "ton", "ea", "%"];

function formatTime(date) {
  return new Date(date).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}
function formatDateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}
function rowToRecord(row) {
  const user = USERS.find((u) => u.id === row.user_id) || USERS[0];
  let width = "", height = "", depth = "", memo = row.memo, unit = "mm", sketch = "";
  if (row.memo.startsWith("__DIM__|")) {
    const parts = row.memo.split("|");
    width = parts[1] || ""; height = parts[2] || ""; depth = parts[3] || "";
    memo = parts[4] || ""; unit = parts[5] || "mm"; sketch = parts[6] || "";
  }
  return { id: row.id, user, category: row.category, width, height, depth, memo, unit, sketch, hasPhoto: row.has_photo, photoName: row.photo_name, date: row.created_at };
}

function SketchPad({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current;
    lastPos.current = getPos(e, canvas);
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
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();
    lastPos.current = pos;
  };
  const end = (e) => { e.preventDefault(); drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const save = () => {
    const canvas = canvasRef.current;
    const data = canvas.toDataURL("image/png");
    onSave(data);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 16, width: "100%", maxWidth: 440 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12, color: "#111" }}>스케치 그리기</div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>손가락으로 자유롭게 그려주세요</div>
        <canvas ref={canvasRef} width={400} height={300}
          style={{ width: "100%", height: 280, border: "2px solid #dde1e7", borderRadius: 10, background: "#fafafa", touchAction: "none", cursor: "crosshair" }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={clear} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid #dde1e7", background: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>지우기</button>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#f4f6fa", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>취소</button>
          <button onClick={save} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#0F6E56", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>저장</button>
        </div>
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
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoName, setPhotoName] = useState("");
  const [sketch, setSketch] = useState("");
  const [showSketch, setShowSketch] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [activeTab, setActiveTab] = useState("input");
  const [expandedSketch, setExpandedSketch] = useState(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: err } = await supabase.from("field_records").select("*").order("created_at", { ascending: false });
      if (err) throw err;
      setRecords((data || []).map(rowToRecord));
    } catch (e) { setError("불러오기 실패: " + e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchRecords();
    const channel = supabase.channel("field_records_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "field_records" },
        (payload) => { setRecords((prev) => [rowToRecord(payload.new), ...prev]); })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchRecords]);

  const handleSubmit = useCallback(async () => {
    if (!memo.trim() && !width.trim() && !height.trim() && !depth.trim()) return;
    setSaving(true); setError(null);
    try {
      const { error: err } = await supabase.from("field_records").insert({
        user_id: currentUser.id, user_name: currentUser.name, category,
        value: "",
        unit: "",
        memo: "__DIM__|" + width.trim() + "|" + height.trim() + "|" + depth.trim() + "|" + memo.trim() + "|" + unit + "|" + sketch,
        has_photo: hasPhoto, photo_name: photoName,
      });
      if (err) throw err;
      setWidth(""); setHeight(""); setDepth(""); setMemo(""); setSketch(""); setHasPhoto(false); setPhotoName("");
      setActiveTab("list");
    } catch (e) { setError("저장 실패: " + e.message); }
    finally { setSaving(false); }
  }, [currentUser, category, width, height, depth, unit, memo, sketch, hasPhoto, photoName]);

  const handlePhotoSim = () => {
    const names = ["현장_전경.jpg", "실측_사진.jpg", "자재_확인.jpg", "안전_점검.jpg"];
    setHasPhoto(true); setPhotoName(names[Math.floor(Math.random() * names.length)]);
  };

  const grouped = records.reduce((acc, r) => {
    const k = formatDateKey(r.date);
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});
  const allDates = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));
  const filteredKeys = allDates.filter((k) => !filterDate || k === filterDate);
  const canSubmit = (memo.trim() || width.trim() || height.trim() || depth.trim()) && !saving;

  const labelStyle = { display: "block", fontSize: 13, fontWeight: 700, color: "#555", marginBottom: 8 };
  const inputStyle = { width: "100%", boxSizing: "border-box", padding: "14px 16px", fontSize: 16, borderRadius: 10, border: "1.5px solid #dde1e7", background: "#fff", color: "#111", outline: "none", marginBottom: 8, fontFamily: "inherit" };

  return (
    <div style={{ fontFamily: "sans-serif", background: "#f4f6fa", minHeight: "100vh", maxWidth: 480, margin: "0 auto" }}>
      {showSketch && <SketchPad onSave={(data) => { setSketch(data); setShowSketch(false); }} onCancel={() => setShowSketch(false)} />}
      {expandedSketch && (
        <div onClick={() => setExpandedSketch(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <img src={expandedSketch} style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 12 }} />
        </div>
      )}

      <div style={{ background: "#0F6E56", color: "#fff", padding: "16px 20px 12px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>현장 기록 시스템</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Field Logger</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {USERS.map((u) => (
              <button key={u.id} onClick={() => setCurrentUser(u)}
                style={{ padding: "8px 14px", borderRadius: 100, border: "none", background: currentUser.id === u.id ? "#fff" : "rgba(255,255,255,0.2)", color: currentUser.id === u.id ? "#0F6E56" : "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {u.name}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
          {[{ key: "input", label: "기록 입력" }, { key: "list", label: "목록 (" + records.length + ")" }].map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: activeTab === t.key ? "#fff" : "rgba(255,255,255,0.15)", color: activeTab === t.key ? "#0F6E56" : "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: "#fcebeb", color: "#a32d2d", padding: "12px 16px", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#a32d2d", cursor: "pointer" }}>X</button>
        </div>
      )}

      {activeTab === "input" && (
        <div style={{ padding: "16px 16px 40px" }}>
          <div style={{ background: currentUser.bg, border: "2px solid " + currentUser.color, borderRadius: 12, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: currentUser.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>{currentUser.id}</div>
            <div>
              <div style={{ fontSize: 12, color: currentUser.color, fontWeight: 600 }}>현재 작성자</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{currentUser.name}</div>
            </div>
          </div>

          <label style={labelStyle}>분류</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                style={{ padding: "12px 4px", borderRadius: 10, border: "2px solid " + (category === c ? "#0F6E56" : "#dde1e7"), background: category === c ? "#E1F5EE" : "#fff", color: category === c ? "#0F6E56" : "#555", fontWeight: category === c ? 700 : 400, fontSize: 13, cursor: "pointer" }}>
                {c}
              </button>
            ))}
          </div>

          <label style={labelStyle}>실측 수치</label>
          <div style={{ marginBottom: 8 }}>
            <select value={unit} onChange={(e) => setUnit(e.target.value)}
              style={{ padding: "10px 12px", fontSize: 14, borderRadius: 10, border: "1.5px solid #dde1e7", background: "#fff", fontFamily: "inherit", marginBottom: 8 }}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
            {[["가로 (W)", width, setWidth], ["세로 (H)", height, setHeight], ["높이 (D)", depth, setDepth]].map(([label, val, setter]) => (
              <div key={label}>
                <div style={{ fontSize: 12, color: "#888", textAlign: "center", marginBottom: 4 }}>{label}</div>
                <input type="number" placeholder="0" value={val} onChange={(e) => setter(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "14px 8px", fontSize: 16, borderRadius: 10, border: "1.5px solid #dde1e7", background: "#fff", color: "#111", outline: "none", textAlign: "center", fontFamily: "inherit" }} />
              </div>
            ))}
          </div>

          <label style={labelStyle}>스케치 (비정형 치수 참조용)</label>
          <button onClick={() => setShowSketch(true)}
            style={{ width: "100%", padding: "18px", borderRadius: 12, border: "2px dashed " + (sketch ? "#0F6E56" : "#adb5c2"), background: sketch ? "#E1F5EE" : "#fff", color: sketch ? "#0F6E56" : "#888", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 4 }}>
            {sketch ? "스케치 완료 (탭하여 수정)" : "스케치 그리기"}
          </button>
          {sketch && (
            <div style={{ marginBottom: 12 }}>
              <img src={sketch} style={{ width: "100%", borderRadius: 10, border: "1px solid #dde1e7" }} onClick={() => setShowSketch(true)} />
              <button onClick={() => setSketch("")} style={{ fontSize: 12, color: "#e24b4a", background: "none", border: "none", cursor: "pointer", marginTop: 4 }}>X 스케치 제거</button>
            </div>
          )}

          <label style={labelStyle}>메모</label>
          <textarea placeholder="현장 상황, 특이사항 등을 입력하세요" value={memo} onChange={(e) => setMemo(e.target.value)} rows={4} style={{ ...inputStyle, resize: "none", lineHeight: 1.6, marginBottom: 16 }} />

          <label style={labelStyle}>사진</label>
          <button onClick={handlePhotoSim}
            style={{ width: "100%", padding: "18px", borderRadius: 12, border: "2px dashed " + (hasPhoto ? "#0F6E56" : "#adb5c2"), background: hasPhoto ? "#E1F5EE" : "#fff", color: hasPhoto ? "#0F6E56" : "#888", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 4 }}>
            {hasPhoto ? "사진첨부: " + photoName : "사진 업로드 (탭하여 시뮬레이션)"}
          </button>
          {hasPhoto && <button onClick={() => { setHasPhoto(false); setPhotoName(""); }} style={{ fontSize: 12, color: "#e24b4a", background: "none", border: "none", cursor: "pointer", marginBottom: 8 }}>X 사진 제거</button>}

          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ width: "100%", marginTop: 16, padding: "20px", borderRadius: 14, border: "none", background: canSubmit ? "#0F6E56" : "#ccc", color: "#fff", fontSize: 18, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed" }}>
            {saving ? "저장 중..." : "기록 저장"}
          </button>
        </div>
      )}

      {activeTab === "list" && (
        <div style={{ padding: "16px 16px 40px" }}>
          <button onClick={fetchRecords} disabled={loading}
            style={{ width: "100%", marginBottom: 14, padding: "12px", borderRadius: 10, border: "1.5px solid #dde1e7", background: "#fff", color: "#555", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            {loading ? "불러오는 중..." : "새로고침"}
          </button>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <button onClick={() => setFilterDate("")}
              style={{ padding: "8px 14px", borderRadius: 100, border: "2px solid " + (!filterDate ? "#0F6E56" : "#dde1e7"), background: !filterDate ? "#E1F5EE" : "#fff", color: !filterDate ? "#0F6E56" : "#666", fontSize: 13, cursor: "pointer" }}>전체</button>
            {allDates.map((d) => (
              <button key={d} onClick={() => setFilterDate(d)}
                style={{ padding: "8px 14px", borderRadius: 100, border: "2px solid " + (filterDate === d ? "#0F6E56" : "#dde1e7"), background: filterDate === d ? "#E1F5EE" : "#fff", color: filterDate === d ? "#0F6E56" : "#666", fontSize: 13, cursor: "pointer" }}>
                {new Date(d).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
              </button>
            ))}
          </div>

          {loading && <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa" }}>불러오는 중...</div>}
          {!loading && filteredKeys.length === 0 && <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa" }}>기록이 없습니다</div>}

          {!loading && filteredKeys.map((dateKey) => (
            <div key={dateKey}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 10px" }}>
                <div style={{ height: 1, flex: 1, background: "#dde1e7" }} />
                <div style={{ background: "#0F6E56", color: "#fff", borderRadius: 100, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>{formatDate(dateKey)}</div>
                <div style={{ height: 1, flex: 1, background: "#dde1e7" }} />
              </div>
              <div style={{ position: "relative", paddingLeft: 28 }}>
                <div style={{ position: "absolute", left: 10, top: 0, bottom: 0, width: 2, background: "#dde1e7" }} />
                {grouped[dateKey].map((rec) => (
                  <div key={rec.id} style={{ position: "relative", marginBottom: 14 }}>
                    <div style={{ position: "absolute", left: -24, top: 16, width: 12, height: 12, borderRadius: "50%", background: rec.user.color, border: "2px solid #fff" }} />
                    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e6e9ef", padding: "14px 16px", borderLeft: "4px solid " + rec.user.color }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: rec.user.color }}>{rec.user.name}</span>
                        <span style={{ fontSize: 11, color: "#aaa" }}>{formatTime(rec.date)}</span>
                      </div>
                      <span style={{ display: "inline-block", background: "#f4f6fa", color: "#555", fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 10px", marginBottom: 8 }}>{rec.category}</span>

                      {(rec.width || rec.height || rec.depth) && (
                        <div style={{ background: "#f0fdf8", borderRadius: 8, padding: "10px 14px", marginBottom: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                          {rec.width && <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: "#5DCAA5" }}>가로(W)</div><div style={{ fontSize: 20, fontWeight: 800, color: "#0F6E56" }}>{rec.width}</div></div>}
                          {rec.width && rec.height && <div style={{ color: "#aaa" }}>x</div>}
                          {rec.height && <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: "#5DCAA5" }}>세로(H)</div><div style={{ fontSize: 20, fontWeight: 800, color: "#0F6E56" }}>{rec.height}</div></div>}
                          {rec.depth && <div style={{ color: "#aaa" }}>x</div>}
                          {rec.depth && <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: "#5DCAA5" }}>높이(D)</div><div style={{ fontSize: 20, fontWeight: 800, color: "#0F6E56" }}>{rec.depth}</div></div>}
                          <div style={{ fontSize: 12, color: "#5DCAA5", fontWeight: 600 }}>{rec.unit}</div>
                        </div>
                      )}

                      {rec.sketch && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>스케치</div>
                          <img src={rec.sketch} onClick={() => setExpandedSketch(rec.sketch)}
                            style={{ width: "100%", borderRadius: 8, border: "1px solid #dde1e7", cursor: "pointer" }} />
                          <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>탭하면 크게 볼 수 있어요</div>
                        </div>
                      )}

                      {rec.memo && <p style={{ fontSize: 14, color: "#333", lineHeight: 1.6, margin: 0 }}>{rec.memo}</p>}
                      {rec.hasPhoto && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff8e6", borderRadius: 8, padding: "8px 12px", marginTop: 8 }}>
                          <span style={{ fontSize: 12, color: "#ba7517", fontWeight: 600 }}>사진: {rec.photoName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "list" && (
        <button onClick={() => setActiveTab("input")}
          style={{ position: "fixed", bottom: 24, right: 24, width: 60, height: 60, borderRadius: "50%", background: "#0F6E56", color: "#fff", fontSize: 28, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(15,110,86,0.4)", zIndex: 100 }}>
          +
        </button>
      )}
    </div>
  );
}