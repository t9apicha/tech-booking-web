'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, saveSession } from '@/lib/supabase';
import {
  Wrench,
  User,
  ShieldCheck,
  Mail,
  Lock,
  Phone,
  MapPin,
  Wind,
  Droplets,
  Zap,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface Province {
  ProvinceID: string;
  ProvinceName: string;
}

interface ServiceCategory {
  CategoryID: string;
  MainCategory: string;
  CategoryName: string;
  CategoryPrice: number;
}

export default function AuthPage() {
  const router = useRouter();
  const [role, setRole] = useState<'customer' | 'technician' | 'admin'>('customer');
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [address, setAddress] = useState('');
  const [selectedMainTrade, setSelectedMainTrade] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    async function loadMasterData() {
      const { data: provData } = await db.from('Provinces').select('*');
      if (provData) setProvinces(provData);

      const { data: catData } = await db.from('ServiceCategories').select('*');
      if (catData) setCategories(catData as ServiceCategory[]);
    }
    loadMasterData();
  }, []);

  const mainCategories = Array.from(
    new Set(categories.map((c) => c.MainCategory).filter(Boolean))
  );

  const subCategories = categories.filter((c) => c.MainCategory === selectedMainTrade);

  const toggleSubCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleRoleSwitch = (nextRole: 'customer' | 'technician' | 'admin') => {
    setRole(nextRole);
    setAlert(null);
    if (nextRole === 'admin') {
      setMode('login');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);

    const cleanEmail = email.trim();

    if (role === 'customer') {
      const { data, error } = await db
        .from('Customers')
        .select('*')
        .eq('CustomerEmail', cleanEmail)
        .eq('CustomerPassword', password)
        .single();

      setLoading(false);
      if (error || !data) {
        setAlert({ type: 'error', text: 'อีเมลหรือรหัสผ่านลูกค้าไม่ถูกต้อง' });
        return;
      }
      saveSession('customer', data);
      router.push('/customer');
    } else if (role === 'technician') {
      const { data, error } = await db
        .from('Technicians')
        .select('*')
        .eq('TechnicianEmail', cleanEmail)
        .eq('TechnicianPassword', password)
        .single();

      setLoading(false);
      if (error || !data) {
        setAlert({ type: 'error', text: 'อีเมลหรือรหัสผ่านช่างไม่ถูกต้อง' });
        return;
      }
      if (!data.approved) {
        setAlert({
          type: 'error',
          text: 'บัญชีช่างของคุณอยู่ระหว่างรอผู้ดูแลระบบตรวจสอบและอนุมัติ',
        });
        return;
      }
      saveSession('technician', data);
      router.push('/technician');
    } else {
      const { data, error } = await db
        .from('Admins')
        .select('*')
        .eq('AdminEmail', cleanEmail)
        .eq('AdminPassword', password)
        .single();

      setLoading(false);
      if (error || !data) {
        setAlert({ type: 'error', text: 'อีเมลหรือรหัสผ่านผู้ดูแลระบบไม่ถูกต้อง' });
        return;
      }
      saveSession('admin', data);
      router.push('/admin');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    if (role === 'technician' && selectedCategoryIds.length === 0) {
      setAlert({ type: 'error', text: 'กรุณาเลือกบริการที่รับทำอย่างน้อย 1 รายการ' });
      return;
    }

    setLoading(true);
    const cleanEmail = email.trim();

    if (role === 'customer') {
      const { data: exist } = await db
        .from('Customers')
        .select('CustomerID')
        .eq('CustomerEmail', cleanEmail)
        .maybeSingle();

      if (exist) {
        setLoading(false);
        setAlert({ type: 'error', text: 'อีเมลนี้ถูกใช้งานในระบบแล้ว' });
        return;
      }

      const newId = `CUS${Math.floor(1000 + Math.random() * 9000)}`;
      const { error } = await db.from('Customers').insert([
        {
          CustomerID: newId,
          CustomerName: fullName.trim(),
          CustomerEmail: cleanEmail,
          CustomerPassword: password,
          CustomerPhone: phone.trim(),
          ProvinceID: provinceId,
        },
      ]);

      setLoading(false);
      if (error) {
        setAlert({ type: 'error', text: `สมัครสมาชิกไม่สำเร็จ: ${error.message}` });
        return;
      }

      setAlert({
        type: 'success',
        text: 'สมัครสมาชิกลูกค้าสำเร็จ! กรุณาเข้าสู่ระบบเพื่อใช้งาน',
      });
      setMode('login');
      setPassword('');
    } else if (role === 'technician') {
      const { data: exist } = await db
        .from('Technicians')
        .select('TechnicianID')
        .eq('TechnicianEmail', cleanEmail)
        .maybeSingle();

      if (exist) {
        setLoading(false);
        setAlert({ type: 'error', text: 'อีเมลนี้ถูกใช้งานในระบบแล้ว' });
        return;
      }

      const newTechId = `TECH${Math.floor(1000 + Math.random() * 9000)}`;
      const { error: techErr } = await db.from('Technicians').insert([
        {
          TechnicianID: newTechId,
          TechnicianName: fullName.trim(),
          TechnicianEmail: cleanEmail,
          TechnicianPassword: password,
          TechnicianPhone: phone.trim(),
          ProvinceID: provinceId,
          CategoryID: selectedCategoryIds[0],
          Address: address.trim(),
          approved: false,
        },
      ]);

      if (techErr) {
        setLoading(false);
        setAlert({ type: 'error', text: `ลงทะเบียนช่างไม่สำเร็จ: ${techErr.message}` });
        return;
      }

      const serviceLinks = selectedCategoryIds.map((catId) => ({
        TechnicianID: newTechId,
        CategoryID: catId,
      }));
      await db.from('TechnicianServices').insert(serviceLinks);

      setLoading(false);
      setAlert({
        type: 'success',
        text: 'ลงทะเบียนช่างสำเร็จ! กรุณารอแอดมินกดอนุมัติบัญชีก่อนเข้าสู่ระบบ',
      });
      setMode('login');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden grid lg:grid-cols-12">
        {/* ฝั่งซ้าย: Brand Showcase Panel */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2.5 bg-white/10 border border-white/15 px-3.5 py-2 rounded-2xl backdrop-blur-sm mb-8">
              <div className="p-1.5 bg-blue-500 rounded-lg">
                <Wrench className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm tracking-wide">TECH BOOKING</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold leading-snug">
              ระบบจองช่างซ่อมออนไลน์
              <span className="block text-blue-300 mt-1 text-xl sm:text-2xl font-semibold">
                ราคามาตรฐาน โปร่งใส ตรวจสอบได้
              </span>
            </h1>

            <p className="text-slate-300 text-sm mt-4 leading-relaxed">
              เชื่อมต่อลูกค้ากับช่างฝีมือที่ผ่านการคัดกรองในพื้นที่ของคุณ นัดหมายวัน-เวลาที่สะดวกได้ทันที
            </p>

            {/* หมวดงานหลัก */}
            <div className="mt-8 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                หมวดหมู่บริการหลัก
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-white/10 border border-white/10 rounded-2xl p-3 text-center">
                  <Wind className="w-5 h-5 text-sky-300 mx-auto mb-1" />
                  <span className="text-xs font-medium">งานแอร์</span>
                </div>
                <div className="bg-white/10 border border-white/10 rounded-2xl p-3 text-center">
                  <Droplets className="w-5 h-5 text-blue-300 mx-auto mb-1" />
                  <span className="text-xs font-medium">งานประปา</span>
                </div>
                <div className="bg-white/10 border border-white/10 rounded-2xl p-3 text-center">
                  <Zap className="w-5 h-5 text-amber-300 mx-auto mb-1" />
                  <span className="text-xs font-medium">งานไฟฟ้า</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-8 mt-8 border-t border-white/10 space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>แสดงราคามาตรฐานชัดเจนก่อนตัดสินใจจอง</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>ช่างทุกคนผ่านการตรวจสอบและอนุมัติตัวตน</span>
            </div>
          </div>
        </div>

        {/* ฝั่งขวา: ฟอร์ม Login / Register */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            <div className="mb-6">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-2">
                <Sparkles className="w-3.5 h-3.5" /> ยินดีต้อนรับเข้าสู่ระบบ
              </span>
              <h2 className="text-2xl font-bold text-slate-800">
                {mode === 'login' ? 'เข้าสู่ระบบบัญชีของคุณ' : 'สร้างบัญชีผู้ใช้งานใหม่'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                เลือกประเภทผู้ใช้งานด้านล่างเพื่อดำเนินการต่อ
              </p>
            </div>

            {/* Role Selector */}
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => handleRoleSwitch('customer')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  role === 'customer'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-4 h-4" /> ลูกค้า
              </button>
              <button
                type="button"
                onClick={() => handleRoleSwitch('technician')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  role === 'technician'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wrench className="w-4 h-4" /> ช่างซ่อม
              </button>
              <button
                type="button"
                onClick={() => handleRoleSwitch('admin')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  role === 'admin'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4" /> แอดมิน
              </button>
            </div>

            {/* Alert Box */}
            {alert && (
              <div
                className={`flex items-start gap-2.5 p-3.5 rounded-2xl text-xs sm:text-sm mb-5 border ${
                  alert.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {alert.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{alert.text}</span>
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    อีเมลผู้ใช้งาน
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    รหัสผ่าน
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 rounded-xl text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-60 ${
                    role === 'technician'
                      ? 'bg-teal-600 hover:bg-teal-700'
                      : role === 'admin'
                      ? 'bg-slate-800 hover:bg-slate-900'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>เข้าสู่ระบบ</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {role !== 'admin' && (
                  <p className="text-center text-xs text-slate-500 pt-2">
                    ยังไม่มีบัญชีผู้ใช้งานใช่ไหม?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setAlert(null);
                      }}
                      className="text-blue-600 font-semibold hover:underline"
                    >
                      สมัครสมาชิกใหม่ที่นี่
                    </button>
                  </p>
                )}
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ชื่อ - นามสกุล
                    </label>
                    <input
                      type="text"
                      maxLength={30}
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="สมชาย ใจดี"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      เบอร์โทรศัพท์ (10 หลัก)
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        maxLength={10}
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0812345678"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      อีเมล
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      รหัสผ่าน
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="ตั้งรหัสผ่าน"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    จังหวัด{role === 'technician' ? 'พื้นที่ให้บริการ' : ''}
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <select
                      required
                      value={provinceId}
                      onChange={(e) => setProvinceId(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- เลือกจังหวัด --</option>
                      {provinces.map((p) => (
                        <option key={p.ProvinceID} value={p.ProvinceID}>
                          {p.ProvinceName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {role === 'technician' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        สายงานหลักของช่าง
                      </label>
                      <select
                        required
                        value={selectedMainTrade}
                        onChange={(e) => {
                          setSelectedMainTrade(e.target.value);
                          setSelectedCategoryIds([]);
                        }}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">-- เลือกสายงานช่าง --</option>
                        {mainCategories.map((mc) => (
                          <option key={mc} value={mc}>
                            {mc}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedMainTrade && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          เลือกบริการที่รับทำ (เลือกได้หลายข้อ)
                        </label>
                        <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 max-h-36 overflow-y-auto">
                          {subCategories.map((sub) => {
                            const checked = selectedCategoryIds.includes(sub.CategoryID);
                            return (
                              <label
                                key={sub.CategoryID}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs cursor-pointer transition ${
                                  checked
                                    ? 'bg-teal-50 border-teal-500 text-teal-900 font-semibold'
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleSubCategory(sub.CategoryID)}
                                    className="rounded text-teal-600"
                                  />
                                  {sub.CategoryName}
                                </span>
                                <span className="text-slate-500">
                                  {sub.CategoryPrice.toLocaleString()} ฿
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        ที่อยู่ปัจจุบัน / จุดประจำงาน
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="ระบุเขต/อำเภอ ถนน..."
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 rounded-xl text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-60 ${
                    role === 'technician'
                      ? 'bg-teal-600 hover:bg-teal-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {role === 'technician' ? 'ส่งข้อมูลสมัครเป็นช่าง' : 'ยืนยันการสมัครสมาชิก'}
                </button>

                <p className="text-center text-xs text-slate-500 pt-1">
                  มีบัญชีอยู่แล้ว?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setAlert(null);
                    }}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    กลับไปหน้าเข้าสู่ระบบ
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}