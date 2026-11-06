import React, { useState } from 'react';
import { LogIn, Sparkles, User, ShieldCheck, School, Trophy, Award, BookOpen, Calculator, CheckCircle2, Globe, Wifi } from 'lucide-react';
import { Student } from '../types';
import { loginUser, getServerStatus } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: any, role: 'admin' | 'student') => void;
  students: Student[];
  activeStageName: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  students,
  activeStageName
}) => {
  const [activeTab, setActiveTab] = useState<'student' | 'admin'>('student');
  const [noPeserta, setNoPeserta] = useState('');
  const [pin, setPin] = useState('1234');
  const [adminPassword, setAdminPassword] = useState('admin');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQuickSelect, setShowQuickSelect] = useState(false);

  const bannerImageUrl = '/assets/aistudio/WhatsApp_Image_2026-11-04_at_10.53.59_691c768a.jpeg';

  const handleStudentLogin = async (customNo?: string, customPin?: string) => {
    setErrorMsg('');
    setLoading(true);
    const targetNo = customNo || noPeserta;
    const targetPin = customPin || pin;

    try {
      const res = await loginUser('student', {
        noPeserta: targetNo.trim(),
        pin: targetPin.trim()
      });
      onLoginSuccess(res.user, 'student');
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat masuk');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (customPass?: string) => {
    setErrorMsg('');
    setLoading(true);
    const targetPass = customPass || adminPassword;

    try {
      const res = await loginUser('admin', {
        password: targetPass.trim()
      });
      onLoginSuccess(res.user, 'admin');
    } catch (err: any) {
      setErrorMsg(err.message || 'Password panitia salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      {/* Background Image (Attachment) with Deep Overlay */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat scale-105 transition-transform duration-1000"
        style={{ backgroundImage: `url(${bannerImageUrl})` }}
      />
      
      {/* Dynamic gradient overlay to ensure perfect contrast and vibrancy */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-950/85 via-sky-900/80 to-indigo-950/90 backdrop-blur-md" />

      {/* Decorative animated glow orbs */}
      <div className="fixed -top-24 -left-24 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="fixed -bottom-24 -right-24 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none animate-pulse delay-1000" />

      {/* Main Container */}
      <div className="relative w-full max-w-xl z-10">
        
        {/* Banner Graphic Header Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden mb-5">
          {/* Top Banner Image Preview Header */}
          <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-sky-200">
            <img 
              src={bannerImageUrl} 
              alt="GELORA 26 Banner" 
              className="w-full h-full object-cover object-center filter saturate-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-4 sm:p-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-slate-900 text-xs font-bold rounded-full w-fit shadow-md">
                <Trophy className="w-3.5 h-3.5" />
                <span>Babak Aktif: {activeStageName}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide mt-1 drop-shadow-md">
                GELORA 26 <span className="text-amber-400">Gebyar Literasi & Numerasi</span>
              </h1>
              <p className="text-xs sm:text-sm text-sky-100 flex items-center gap-1.5 font-medium">
                <School className="w-4 h-4 text-amber-300" />
                SMP Negeri 26 Sijunjung • Real-Time Cloud CBT
              </p>
            </div>
          </div>

          {/* Role Tabs */}
          <div className="p-4 sm:p-6 pt-4">
            <div className="flex items-center justify-between mb-3.5 px-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Sistem Siap Digunakan (Netlify & Offline Ready)</span>
              </span>
              <span className="text-[11px] font-mono text-slate-500">GELORA 26</span>
            </div>

            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 border border-slate-200">
              <button
                type="button"
                onClick={() => { setActiveTab('student'); setErrorMsg(''); }}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'student'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Peserta Siswa</span>
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('admin'); setErrorMsg(''); }}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'admin'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Panitia Lomba</span>
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm rounded-xl flex items-start gap-2 animate-shake">
                <span className="font-bold">Perhatian:</span> {errorMsg}
              </div>
            )}

            {/* SISWA LOGIN FORM */}
            {activeTab === 'student' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleStudentLogin();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Nomor Peserta Ujian
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Contoh: G26-001"
                      value={noPeserta}
                      onChange={(e) => setNoPeserta(e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 font-semibold tracking-wider outline-none text-sm transition"
                    />
                    <span className="absolute right-3 top-3 text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">
                      G26-XXX
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    PIN Masuk (4 Digit)
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="PIN Ujian (Default: 1234)"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 font-mono tracking-widest outline-none text-sm transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    PIN standar bawaan adalah <span className="font-mono font-bold text-slate-600">1234</span>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !noPeserta}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-sm sm:text-base transition disabled:opacity-50"
                >
                  <LogIn className="w-5 h-5" />
                  <span>{loading ? 'Memverifikasi...' : 'Mulai Kerjakan Soal'}</span>
                </button>

                {/* Quick Test Demo Dropdown for Evaluator convenience */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowQuickSelect(!showQuickSelect)}
                    className="w-full py-2 px-3 text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center justify-center gap-1.5 hover:bg-blue-50 rounded-lg transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{showQuickSelect ? 'Tutup Pilihan Cepat' : 'Pilih Cepat Peserta Uji Coba (1 Klik Masuk)'}</span>
                  </button>

                  {showQuickSelect && (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                      {students.slice(0, 6).map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            setNoPeserta(st.noPeserta);
                            setPin(st.pin || '1234');
                            handleStudentLogin(st.noPeserta, st.pin || '1234');
                          }}
                          className="p-2 text-left bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition text-xs shadow-sm"
                        >
                          <div className="font-bold text-slate-800 truncate">{st.nama}</div>
                          <div className="text-slate-500 text-[11px] flex justify-between">
                            <span className="font-mono text-blue-600 font-semibold">{st.noPeserta}</span>
                            <span>{st.kelas}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            )}

            {/* PANITIA LOGIN FORM */}
            {activeTab === 'admin' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAdminLogin();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Password Administrator / Panitia
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Masukkan password panitia"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-900 font-semibold outline-none text-sm transition"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Password default panitia adalah <span className="font-mono font-bold text-amber-600">admin</span> atau <span className="font-mono font-bold text-amber-600">gelora26</span>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !adminPassword}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.99] text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 text-sm sm:text-base transition disabled:opacity-50"
                >
                  <ShieldCheck className="w-5 h-5 text-slate-950" />
                  <span>{loading ? 'Memverifikasi...' : 'Masuk Dashboard Panitia'}</span>
                </button>

                <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900">
                  <div className="font-bold flex items-center gap-1.5 mb-1 text-amber-800">
                    <CheckCircle2 className="w-4 h-4 text-amber-600" />
                    <span>Fitur Pengelolaan Panitia Lengkap:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-amber-950">
                    <li>Kelola Data Siswa & Tambah Peserta Baru</li>
                    <li>Kelola Soal (PG Tunggal, PG Kompleks, Benar/Salah, Menjodohkan)</li>
                    <li>Atur Babak (Penyisihan, 30 Besar, Semifinal, Final) & Skor</li>
                    <li>Pantau Live Skor Real-Time Cloud & Mode Proyektor Layar Penuh</li>
                  </ul>
                </div>
              </form>
            )}

            {/* Feature Badges */}
            <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                <BookOpen className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                <span className="text-[10px] font-bold text-slate-600 block">Literasi AKM</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                <Calculator className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                <span className="text-[10px] font-bold text-slate-600 block">Numerasi Kuantan</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                <Trophy className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                <span className="text-[10px] font-bold text-slate-600 block">4 Babak Juara</span>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Credit */}
        <div className="text-center text-white/80 text-xs drop-shadow">
          <p className="font-medium">© GELORA 26 • SMP Negeri 26 Sijunjung, Sumatera Barat</p>
          <p className="text-[11px] text-white/60 mt-0.5">Sistem Ujian Terintegrasi Cloud & Peringkat Real-Time</p>
        </div>

      </div>
    </div>
  );
};
