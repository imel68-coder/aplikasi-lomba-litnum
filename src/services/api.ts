import { initialQuestions, initialStages, initialStudents } from '../seedData';
import { 
  AnswerSubmission, 
  AppDatabaseState, 
  LeaderboardRank, 
  Question, 
  StageId, 
  Student, 
  StudentProgress 
} from '../types';

// Storage keys for local persistence & offline/Netlify standalone capability
const LOCAL_DB_KEY = 'gelora26_offline_db_v2';
const CUSTOM_SERVER_KEY = 'gelora26_custom_server_url';

export function getCustomServerUrl(): string {
  try {
    return localStorage.getItem(CUSTOM_SERVER_KEY) || '';
  } catch {
    return '';
  }
}

export function setCustomServerUrl(url: string) {
  try {
    if (!url.trim()) {
      localStorage.removeItem(CUSTOM_SERVER_KEY);
    } else {
      localStorage.setItem(CUSTOM_SERVER_KEY, url.trim().replace(/\/+$/, ''));
    }
  } catch (e) {
    console.error('Failed to save custom server URL', e);
  }
}

export function getApiBase(): string {
  const custom = getCustomServerUrl();
  if (custom) return custom;
  return '';
}

// Track whether the backend server is reachable
let isServerOnline = true;

export function getServerStatus(): boolean {
  return isServerOnline;
}

// ==========================================
// LOCAL DATABASE STORAGE ENGINE (For Netlify / Offline)
// ==========================================

export function loadLocalDatabase(): AppDatabaseState {
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.students && parsed.questions && parsed.stages) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading local database, resetting to seed data', e);
  }

  const initialState: AppDatabaseState = {
    stages: initialStages,
    students: initialStudents,
    questions: initialQuestions,
    submissions: [],
    studentProgress: {},
    adminPassword: 'admin',
    activeStageId: 'penyisihan',
    announcement: 'Selamat datang di Lomba Literasi dan Numerasi GELORA 26 SMPN 26 Sijunjung! Junjung tinggi kejujuran dan sportivitas.'
  };

  saveLocalDatabase(initialState);
  return initialState;
}

export function saveLocalDatabase(db: AppDatabaseState) {
  try {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
    dispatchLocalSyncEvent('STATE_UPDATED', { activeStageId: db.activeStageId });
  } catch (e) {
    console.error('Failed to save local database', e);
  }
}

// Broadcast updates across browser tabs (for Netlify / Standalone mode)
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('gelora26_channel');
  }
} catch {
  // ignore
}

function dispatchLocalSyncEvent(type: string, data: any) {
  const eventPayload = { type, data, timestamp: Date.now() };
  try {
    broadcastChannel?.postMessage(eventPayload);
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gelora26_local_sync', { detail: eventPayload }));
  }
}

// Compute stage leaderboard client-side
export function computeLocalStageLeaderboard(db: AppDatabaseState, stageId: StageId): LeaderboardRank[] {
  const hierarchy: StageId[] = ['penyisihan', 'top30', 'semifinal', 'final'];
  const targetStageIndex = hierarchy.indexOf(stageId);

  const validStudents = db.students.filter(s => {
    const studentStageIndex = hierarchy.indexOf(s.qualifiedStage);
    return studentStageIndex >= targetStageIndex;
  });

  const studentStats: Record<string, { totalScore: number; totalAnswered: number; correctCount: number; lastSubmitTime: number }> = {};
  validStudents.forEach(st => {
    studentStats[st.id] = { totalScore: 0, totalAnswered: 0, correctCount: 0, lastSubmitTime: 0 };
  });

  (db.submissions || [])
    .filter(sub => sub.stageId === stageId)
    .forEach(sub => {
      if (!studentStats[sub.studentId]) {
        studentStats[sub.studentId] = { totalScore: 0, totalAnswered: 0, correctCount: 0, lastSubmitTime: 0 };
      }
      studentStats[sub.studentId].totalScore += sub.scoreEarned;
      studentStats[sub.studentId].totalAnswered += 1;
      if (sub.isCorrect) {
        studentStats[sub.studentId].correctCount += 1;
      }
      if (sub.submittedAt > studentStats[sub.studentId].lastSubmitTime) {
        studentStats[sub.studentId].lastSubmitTime = sub.submittedAt;
      }
    });

  const ranked: LeaderboardRank[] = validStudents
    .map(st => {
      const stats = studentStats[st.id] || { totalScore: 0, totalAnswered: 0, correctCount: 0, lastSubmitTime: 0 };
      return {
        rank: 1,
        studentId: st.id,
        noPeserta: st.noPeserta,
        nama: st.nama,
        sekolah: st.sekolah,
        totalScore: Math.round(stats.totalScore * 10) / 10,
        totalAnswered: stats.totalAnswered,
        correctCount: stats.correctCount,
        lastSubmitTime: stats.lastSubmitTime
      };
    })
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      if (a.lastSubmitTime && b.lastSubmitTime) return a.lastSubmitTime - b.lastSubmitTime;
      return a.noPeserta.localeCompare(b.noPeserta);
    });

  ranked.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  return ranked;
}

// Timeout helper for resilient network calls
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 2500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ==========================================
// CORE APPLICATION API METHODS (Dual-Mode Server & Netlify Standalone)
// ==========================================

export async function fetchAppState(): Promise<{
  activeStageId: StageId;
  stages: Record<StageId, any>;
  students: Student[];
  questions: Question[];
  submissions: AnswerSubmission[];
  announcement?: string;
  leaderboard: LeaderboardRank[];
}> {
  const apiBase = getApiBase();

  // Try fetching from server first
  try {
    const res = await fetchWithTimeout(`${apiBase}/api/state`, {}, 2500);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      isServerOnline = true;
      // Sync local database with latest server state as cache
      saveLocalDatabase({
        stages: data.stages,
        students: data.students,
        questions: data.questions,
        submissions: data.submissions || [],
        studentProgress: {},
        adminPassword: 'admin',
        activeStageId: data.activeStageId,
        announcement: data.announcement
      });
      return data;
    }
  } catch {
    // Server is unreachable, seamlessly fall back to local storage
  }

  isServerOnline = false;
  const localDb = loadLocalDatabase();
  const localLeaderboard = computeLocalStageLeaderboard(localDb, localDb.activeStageId);

  return {
    activeStageId: localDb.activeStageId,
    stages: localDb.stages,
    students: localDb.students,
    questions: localDb.questions,
    submissions: localDb.submissions || [],
    announcement: localDb.announcement,
    leaderboard: localLeaderboard
  };
}

export async function loginUser(
  role: 'admin' | 'student',
  payload: { noPeserta?: string; pin?: string; password?: string }
): Promise<{ success: boolean; role: 'admin' | 'student'; user: any }> {
  const apiBase = getApiBase();

  // If server was available, try server login
  if (isServerOnline) {
    try {
      const res = await fetchWithTimeout(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, ...payload }),
      }, 3000);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
      if (!res.ok && contentType.includes('application/json')) {
        const errData = await res.json();
        throw new Error(errData.message || 'Login gagal');
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('abort')) {
        throw err;
      }
      // If network failure, fall back to local verification below
      isServerOnline = false;
    }
  }

  // Local verification (Netlify / Offline mode)
  const db = loadLocalDatabase();

  if (role === 'admin') {
    const pass = (payload.password || '').trim();
    if (pass === db.adminPassword || pass === 'admin' || pass === 'gelora26') {
      return {
        success: true,
        role: 'admin',
        user: { id: 'admin_1', nama: 'Panitia Lomba GELORA 26', role: 'admin' }
      };
    }
    throw new Error('Password Panitia salah. (Default: admin / gelora26)');
  }

  if (role === 'student') {
    const inputNo = (payload.noPeserta || '').trim().toLowerCase();
    const student = db.students.find(s => s.noPeserta.trim().toLowerCase() === inputNo);
    if (!student) {
      throw new Error(`Nomor Peserta "${payload.noPeserta}" tidak ditemukan. Cek daftar nomor peserta.`);
    }

    const inputPin = (payload.pin || '').trim();
    if (inputPin && student.pin && inputPin !== student.pin && inputPin !== '1234') {
      throw new Error('PIN Peserta tidak cocok. (Default: 1234)');
    }

    return {
      success: true,
      role: 'student',
      user: student
    };
  }

  throw new Error('Role tidak valid');
}

export async function submitStudentAnswer(payload: {
  studentId: string;
  stageId: StageId;
  questionId: string;
  answer: any;
}): Promise<{
  success: boolean;
  isCorrect: boolean;
  scoreEarned: number;
  totalScore: number;
  currentRank: number;
  totalParticipants: number;
  topLeaderboard: LeaderboardRank[];
}> {
  const apiBase = getApiBase();

  if (isServerOnline) {
    try {
      const res = await fetchWithTimeout(`${apiBase}/api/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, 3500);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      isServerOnline = false;
    }
  }

  // Local processing (Netlify Standalone Engine)
  const db = loadLocalDatabase();
  const question = db.questions.find(q => q.id === payload.questionId);
  const student = db.students.find(s => s.id === payload.studentId);

  if (!question || !student) {
    throw new Error('Soal atau Siswa tidak ditemukan');
  }

  let isCorrect = false;
  let scoreEarned = 0;
  const maxPoints = question.points || 10;

  if (question.type === 'pg_single') {
    const correct = question.correctOptionIds?.[0];
    if (payload.answer === correct) {
      isCorrect = true;
      scoreEarned = maxPoints;
    }
  } else if (question.type === 'pg_complex') {
    const studentSelected: string[] = Array.isArray(payload.answer) ? payload.answer : [];
    const correctIds: string[] = question.correctOptionIds || [];
    const correctCount = studentSelected.filter(id => correctIds.includes(id)).length;
    const wrongCount = studentSelected.filter(id => !correctIds.includes(id)).length;

    if (wrongCount === 0 && correctCount === correctIds.length) {
      isCorrect = true;
      scoreEarned = maxPoints;
    } else if (correctCount > 0 && wrongCount <= 1) {
      const ratio = Math.max(0, (correctCount - wrongCount * 0.5) / correctIds.length);
      scoreEarned = Math.round(ratio * maxPoints * 10) / 10;
      isCorrect = scoreEarned >= (maxPoints * 0.6);
    }
  } else if (question.type === 'true_false') {
    const statements = question.trueFalseStatements || [];
    let matchCount = 0;
    statements.forEach(st => {
      if (payload.answer && payload.answer[st.id] === st.correctAnswer) {
        matchCount++;
      }
    });
    if (statements.length > 0) {
      const ratio = matchCount / statements.length;
      scoreEarned = Math.round(ratio * maxPoints * 10) / 10;
      isCorrect = matchCount === statements.length;
    }
  } else if (question.type === 'matching') {
    const pairs = question.matchingPairs || [];
    let matchCount = 0;
    pairs.forEach(p => {
      if (payload.answer && payload.answer[p.id] === p.response) {
        matchCount++;
      }
    });
    if (pairs.length > 0) {
      const ratio = matchCount / pairs.length;
      scoreEarned = Math.round(ratio * maxPoints * 10) / 10;
      isCorrect = matchCount === pairs.length;
    }
  }

  if (!db.submissions) db.submissions = [];
  const existingIndex = db.submissions.findIndex(
    sub => sub.studentId === payload.studentId && sub.stageId === payload.stageId && sub.questionId === payload.questionId
  );

  const submission: AnswerSubmission = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    studentId: payload.studentId,
    stageId: payload.stageId,
    questionId: payload.questionId,
    type: question.type,
    answer: payload.answer,
    isCorrect,
    scoreEarned,
    submittedAt: Date.now()
  };

  if (existingIndex >= 0) {
    db.submissions[existingIndex] = submission;
  } else {
    db.submissions.push(submission);
  }

  if (!db.studentProgress) db.studentProgress = {};
  const progressKey = `${payload.studentId}_${payload.stageId}`;
  if (!db.studentProgress[progressKey]) {
    db.studentProgress[progressKey] = {
      studentId: payload.studentId,
      stageId: payload.stageId,
      completedQuestionIds: [payload.questionId],
      totalScore: scoreEarned,
      isFinished: false
    };
  } else {
    const prog = db.studentProgress[progressKey];
    if (!prog.completedQuestionIds.includes(payload.questionId)) {
      prog.completedQuestionIds.push(payload.questionId);
    }
    prog.totalScore = db.submissions
      .filter(s => s.studentId === payload.studentId && s.stageId === payload.stageId)
      .reduce((sum, s) => sum + s.scoreEarned, 0);
  }

  saveLocalDatabase(db);

  const updatedLeaderboard = computeLocalStageLeaderboard(db, payload.stageId);
  const myRankEntry = updatedLeaderboard.find(r => r.studentId === payload.studentId);
  const currentRank = myRankEntry ? myRankEntry.rank : 1;
  const totalScore = myRankEntry ? myRankEntry.totalScore : scoreEarned;

  dispatchLocalSyncEvent('SUBMISSION_RECEIVED', {
    studentId: payload.studentId,
    stageId: payload.stageId,
    studentName: student.nama,
    scoreEarned,
    newTotalScore: totalScore,
    rank: currentRank,
    leaderboard: updatedLeaderboard
  });

  return {
    success: true,
    isCorrect,
    scoreEarned,
    totalScore,
    currentRank,
    totalParticipants: updatedLeaderboard.length,
    topLeaderboard: updatedLeaderboard.slice(0, 5)
  };
}

export async function finishStudentStage(studentId: string, stageId: StageId): Promise<{
  success: boolean;
  myRank?: LeaderboardRank;
  leaderboard: LeaderboardRank[];
}> {
  const apiBase = getApiBase();

  if (isServerOnline) {
    try {
      const res = await fetchWithTimeout(`${apiBase}/api/finish-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, stageId }),
      }, 3500);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      isServerOnline = false;
    }
  }

  const db = loadLocalDatabase();
  const progressKey = `${studentId}_${stageId}`;
  if (!db.studentProgress) db.studentProgress = {};

  if (db.studentProgress[progressKey]) {
    db.studentProgress[progressKey].isFinished = true;
    db.studentProgress[progressKey].finishedAt = Date.now();
  } else {
    db.studentProgress[progressKey] = {
      studentId,
      stageId,
      completedQuestionIds: [],
      totalScore: 0,
      isFinished: true,
      finishedAt: Date.now()
    };
  }

  saveLocalDatabase(db);
  const finalLeaderboard = computeLocalStageLeaderboard(db, stageId);
  const myRank = finalLeaderboard.find(r => r.studentId === studentId);

  dispatchLocalSyncEvent('STUDENT_FINISHED', {
    studentId,
    stageId,
    finalRank: myRank?.rank || 1,
    totalScore: myRank?.totalScore || 0
  });

  return {
    success: true,
    myRank,
    leaderboard: finalLeaderboard
  };
}

export async function fetchLeaderboard(stageId: StageId): Promise<LeaderboardRank[]> {
  const apiBase = getApiBase();

  if (isServerOnline) {
    try {
      const res = await fetchWithTimeout(`${apiBase}/api/leaderboard/${stageId}`, {}, 2500);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      isServerOnline = false;
    }
  }

  const db = loadLocalDatabase();
  return computeLocalStageLeaderboard(db, stageId);
}

// ==========================================
// PANITIA (ADMIN) API CALLS
// ==========================================

export async function adminActivateStage(stageId: StageId) {
  const apiBase = getApiBase();

  if (isServerOnline) {
    try {
      const res = await fetchWithTimeout(`${apiBase}/api/admin/stage/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId }),
      }, 3000);
      if (res.ok) return await res.json();
    } catch {
      isServerOnline = false;
    }
  }

  const db = loadLocalDatabase();
  Object.keys(db.stages).forEach(k => {
    db.stages[k as StageId].isActive = (k === stageId);
  });
  db.activeStageId = stageId;
  saveLocalDatabase(db);
  dispatchLocalSyncEvent('STAGE_ACTIVATED', { activeStageId: stageId, stage: db.stages[stageId] });
  return { success: true, activeStageId: stageId, stages: db.stages };
}

export async function adminPromoteStudents(fromStageId: StageId, toStageId: StageId, quota?: number) {
  const apiBase = getApiBase();

  if (isServerOnline) {
    try {
      const res = await fetchWithTimeout(`${apiBase}/api/admin/stage/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromStageId, toStageId, quota }),
      }, 3000);
      if (res.ok) return await res.json();
    } catch {
      isServerOnline = false;
    }
  }

  const db = loadLocalDatabase();
  const ranked = computeLocalStageLeaderboard(db, fromStageId);
  const passingCount = quota || (toStageId === 'top30' ? 30 : toStageId === 'semifinal' ? 10 : 3);
  const promotedStudents = ranked.slice(0, passingCount);
  const promotedIds = promotedStudents.map(s => s.studentId);

  db.students.forEach(st => {
    if (promotedIds.includes(st.id)) {
      st.qualifiedStage = toStageId;
      st.status = 'lolos';
    } else if (st.qualifiedStage === fromStageId) {
      st.status = 'gugur';
    }
  });

  saveLocalDatabase(db);
  dispatchLocalSyncEvent('STUDENTS_PROMOTED', {
    fromStageId,
    toStageId,
    promotedCount: promotedIds.length,
    promotedNames: promotedStudents.map(p => p.nama)
  });

  return { success: true, promotedCount: promotedIds.length, promotedStudents };
}

export async function adminSaveQuestion(question: Partial<Question>) {
  const isEdit = !!question.id && !question.id.startsWith('new_');
  const apiBase = getApiBase();

  if (isServerOnline) {
    try {
      const url = isEdit ? `${apiBase}/api/admin/questions/${question.id}` : `${apiBase}/api/admin/questions`;
      const res = await fetchWithTimeout(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(question),
      }, 3000);
      if (res.ok) return await res.json();
    } catch {
      isServerOnline = false;
    }
  }

  const db = loadLocalDatabase();
  if (isEdit) {
    const idx = db.questions.findIndex(q => q.id === question.id);
    if (idx >= 0) {
      db.questions[idx] = { ...db.questions[idx], ...question } as Question;
    }
  } else {
    const newQ: Question = {
      ...(question as Question),
      id: question.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    };
    db.questions.push(newQ);
  }
  saveLocalDatabase(db);
  return { success: true, question };
}

export async function adminDeleteQuestion(id: string) {
  const apiBase = getApiBase();

  if (isServerOnline) {
    try {
      const res = await fetchWithTimeout(`${apiBase}/api/admin/questions/${id}`, { method: 'DELETE' }, 3000);
      if (res.ok) return await res.json();
    } catch {
      isServerOnline = false;
    }
  }

  const db = loadLocalDatabase();
  db.questions = db.questions.filter(q => q.id !== id);
  saveLocalDatabase(db);
  return { success: true };
}

export async function adminSaveStudent(student: Partial<Student>) {
  const isEdit = !!student.id && !student.id.startsWith('new_');
  const apiBase = getApiBase();

  if (isServerOnline) {
    try {
      const url = isEdit ? `${apiBase}/api/admin/students/${student.id}` : `${apiBase}/api/admin/students`;
      const res = await fetchWithTimeout(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student),
      }, 3000);
      if (res.ok) return await res.json();
    } catch {
      isServerOnline = false;
    }
  }

  const db = loadLocalDatabase();
  if (isEdit) {
    const idx = db.students.findIndex(s => s.id === student.id);
    if (idx >= 0) {
      db.students[idx] = { ...db.students[idx], ...student } as Student;
    }
  } else {
    const newStudent: Student = {
      ...(student as Student),
      id: student.id || `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      qualifiedStage: student.qualifiedStage || 'penyisihan',
      status: student.status || 'aktif'
    };
    db.students.push(newStudent);
  }
  saveLocalDatabase(db);
  return { success: true, student };
}

export async function adminDeleteStudent(id: string) {
  const apiBase = getApiBase();

  if (isServerOnline) {
    try {
      const res = await fetchWithTimeout(`${apiBase}/api/admin/students/${id}`, { method: 'DELETE' }, 3000);
      if (res.ok) return await res.json();
    } catch {
      isServerOnline = false;
    }
  }

  const db = loadLocalDatabase();
  db.students = db.students.filter(s => s.id !== id);
  if (db.submissions) {
    db.submissions = db.submissions.filter(sub => sub.studentId !== id);
  }
  saveLocalDatabase(db);
  return { success: true };
}

export async function adminBulkSeedStudents() {
  const apiBase = getApiBase();

  if (isServerOnline) {
    try {
      const res = await fetchWithTimeout(`${apiBase}/api/admin/students/bulk-seed`, { method: 'POST' }, 3000);
      if (res.ok) return await res.json();
    } catch {
      isServerOnline = false;
    }
  }

  const db = loadLocalDatabase();
  const sampleNames = [
    'Alifia Rahma', 'Bagas Pratama', 'Citra Dewi', 'Doni Kurniawan',
    'Elsa Novita', 'Fajar Ramadhan', 'Gita Permata', 'Hendra Saputra',
    'Indah Wulandari', 'Joko Susilo', 'Khadijah Putri', 'Lukman Hakim',
    'Maya Anggraini', 'Naufal Akbar', 'Olivia Maharani', 'Putra Utama',
    'Qonita Azzahra', 'Rian Hidayat', 'Salsabila Putri', 'Taufik Ismail'
  ];
  const schools = [
    'SMP Negeri 26 Sijunjung', 'SMP Negeri 1 Sijunjung', 'SMP Negeri 2 Sijunjung',
    'SMP Negeri 7 Sijunjung', 'MTsN 1 Sijunjung'
  ];

  const newGenerated: Student[] = sampleNames.map((name, i) => {
    const num = db.students.length + i + 1;
    const formattedNum = num < 10 ? `00${num}` : num < 100 ? `0${num}` : `${num}`;
    return {
      id: `std_gen_${Date.now()}_${i}`,
      noPeserta: `G26-${formattedNum}`,
      nama: name,
      sekolah: schools[i % schools.length],
      kelas: `VIII ${String.fromCharCode(65 + (i % 4))}`,
      pin: '1234',
      qualifiedStage: 'penyisihan',
      status: 'aktif'
    };
  });

  db.students.push(...newGenerated);
  saveLocalDatabase(db);
  return { success: true, addedCount: newGenerated.length, total: db.students.length };
}

export async function adminResetProgress(stageId: string = 'all') {
  const apiBase = getApiBase();

  if (isServerOnline) {
    try {
      const res = await fetchWithTimeout(`${apiBase}/api/admin/reset-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId }),
      }, 3000);
      if (res.ok) return await res.json();
    } catch {
      isServerOnline = false;
    }
  }

  const db = loadLocalDatabase();
  if (stageId && stageId !== 'all') {
    db.submissions = (db.submissions || []).filter(s => s.stageId !== stageId);
    if (db.studentProgress) {
      Object.keys(db.studentProgress).forEach(k => {
        if (k.endsWith(`_${stageId}`)) delete db.studentProgress[k];
      });
    }
  } else {
    db.submissions = [];
    db.studentProgress = {};
    db.students.forEach(st => {
      st.qualifiedStage = 'penyisihan';
      st.status = 'aktif';
    });
  }
  saveLocalDatabase(db);
  dispatchLocalSyncEvent('STATE_RESET', { stageId });
  return { success: true };
}

// Backup & Restore utilities
export function exportDatabaseBackup(): string {
  const db = loadLocalDatabase();
  return JSON.stringify(db, null, 2);
}

export function importDatabaseBackup(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.stages || !parsed.students || !parsed.questions) {
      throw new Error('Format database backup tidak valid.');
    }
    saveLocalDatabase(parsed);
    dispatchLocalSyncEvent('STATE_UPDATED', { activeStageId: parsed.activeStageId });
    return true;
  } catch (err: any) {
    console.error('Import failed', err);
    throw new Error(err.message || 'File JSON tidak valid.');
  }
}

// Real-Time Event Listener with SSE + BroadcastChannel + Local Polling
export function subscribeToRealtimeUpdates(onEvent: (event: { type: string; data: any }) => void) {
  let eventSource: EventSource | null = null;
  let pollingTimer: any = null;
  const apiBase = getApiBase();

  function connectSSE() {
    try {
      eventSource = new EventSource(`${apiBase}/api/realtime/stream`);

      eventSource.addEventListener('CONNECTED', (e: any) => {
        isServerOnline = true;
        onEvent({ type: 'CONNECTED', data: JSON.parse(e.data || '{}') });
      });

      eventSource.addEventListener('SUBMISSION_RECEIVED', (e: any) => {
        onEvent({ type: 'SUBMISSION_RECEIVED', data: JSON.parse(e.data || '{}') });
      });

      eventSource.addEventListener('STAGE_ACTIVATED', (e: any) => {
        onEvent({ type: 'STAGE_ACTIVATED', data: JSON.parse(e.data || '{}') });
      });

      eventSource.addEventListener('STUDENTS_PROMOTED', (e: any) => {
        onEvent({ type: 'STUDENTS_PROMOTED', data: JSON.parse(e.data || '{}') });
      });

      eventSource.addEventListener('STATE_UPDATED', (e: any) => {
        onEvent({ type: 'STATE_UPDATED', data: JSON.parse(e.data || '{}') });
      });

      eventSource.addEventListener('STATE_RESET', (e: any) => {
        onEvent({ type: 'STATE_RESET', data: JSON.parse(e.data || '{}') });
      });

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
      };
    } catch {
      // SSE not available (e.g. Netlify static mode)
    }
  }

  connectSSE();

  // Listen to cross-tab BroadcastChannel events (Netlify / offline mode)
  const handleBroadcast = (e: MessageEvent) => {
    if (e.data && e.data.type) {
      onEvent(e.data);
    }
  };
  broadcastChannel?.addEventListener('message', handleBroadcast);

  // Listen to window custom event on the same tab
  const handleLocalEvent = (e: Event) => {
    const customEvent = e as CustomEvent;
    if (customEvent.detail) {
      onEvent(customEvent.detail);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('gelora26_local_sync', handleLocalEvent);
  }

  // Periodic polling fallback every 5 seconds
  pollingTimer = setInterval(async () => {
    try {
      const state = await fetchAppState();
      onEvent({ type: 'POLL_SYNC', data: state });
    } catch {
      // silent
    }
  }, 5000);

  return () => {
    if (eventSource) eventSource.close();
    if (pollingTimer) clearInterval(pollingTimer);
    broadcastChannel?.removeEventListener('message', handleBroadcast);
    if (typeof window !== 'undefined') {
      window.removeEventListener('gelora26_local_sync', handleLocalEvent);
    }
  };
}
