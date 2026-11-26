'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db, getSession, saveSession, clearSession } from '@/lib/supabase';
import {
  Wrench,
  Wind,
  Droplets,
  Zap,
  Calendar,
  Clock,
  Star,
  MapPin,
  Phone,
  LogOut,
  QrCode,
  CheckCircle2,
  Loader2,
  CreditCard,
  User,
  UserCog,
  KeyRound,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  Hash,
} from 'lucide-react';

interface CustomerUser {
  CustomerID: string;
  CustomerName: string;
  CustomerEmail: string;
  CustomerPhone: string;
  ProvinceID: string;
}

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

interface SlotItem {
  SlotID: number;
  WorkDate: string;
  StartTime: string;
  EndTime: string;
  IsBooked: boolean;
}

interface TechnicianServiceLink {
  CategoryID: string;
  ServiceCategories: {
    MainCategory: string;
    CategoryName: string;
  } | null;
}

interface TechnicianItem {
  TechnicianID: string;
  TechnicianName: string;
  TechnicianPhone: string;
  Address: string;
  TechnicianSlots: SlotItem[];
  Reviews: { Rating: number }[];
  TechnicianServices?: TechnicianServiceLink[];
}

interface JobRecord {
  JobID: string;
  TechnicianID: string;
  ServiceAddress: string;
  ProblemDetail: string;
  Status: string;
  PaymentStatus: string;
  PaymentAmount: number;
  Technicians: { TechnicianName: string; TechnicianPhone: string } | null;
  TechnicianSlots: { WorkDate: string; StartTime: string; EndTime: string } | null;
  Reviews: { ReviewID: number; Rating: number }[];
}

export default function CustomerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [activeTab, setActiveTab] = useState<'book' | 'jobs' | 'profile'>('book');
  const [profileSubTab, setProfileSubTab] = useState<'info' | 'password'>('info');

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedMainCategory, setSelectedMainCategory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [technicians, setTechnicians] = useState<TechnicianItem[]>([]);
  const [searchingTech, setSearchingTech] = useState(false);

  const [chosenTech, setChosenTech] = useState<{ id: string; name: string } | null>(null);
  const [chosenSlot, setChosenSlot] = useState<{ id: number; label: string } | null>(null);
  const [serviceAddress, setServiceAddress] = useState('');
  const [problemDetail, setProblemDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [myJobs, setMyJobs] = useState<JobRecord[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Profile Info States
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editProvince, setEditProvince] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [infoFeedback, setInfoFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Password Change States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [pwFeedback, setPwFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Modals
  const [payJob, setPayJob] = useState<JobRecord | null>(null);
  const [reviewJob, setReviewJob] = useState<JobRecord | null>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    const session = getSession<CustomerUser>('customer');
    if (!session) {
      router.push('/');
      return;
    }
    setUser(session);
    setSelectedProvince(session.ProvinceID || '');
    setEditName(session.CustomerName || '');
    setEditPhone(session.CustomerPhone || '');
    setEditProvince(session.ProvinceID || '');

    async function loadInitial() {
      const { data: provs } = await db.from('Provinces').select('*');
      if (provs) setProvinces(provs);
      const { data: cats } = await db.from('ServiceCategories').select('*');
      if (cats) setCategories(cats as ServiceCategory[]);
    }
    loadInitial();
  }, [router]);

  const mainCategories = Array.from(
    new Set(categories.map((c) => c.MainCategory).filter(Boolean))
  );

  const subCategories = categories.filter((c) => c.MainCategory === selectedMainCategory);

  useEffect(() => {
    async function findTechnicians() {
      if (!selectedProvince || !selectedMainCategory || !selectedCategory) {
        setTechnicians([]);
        return;
      }
      setSearchingTech(true);
      setChosenTech(null);
      setChosenSlot(null);

      const { data: matchedLinks } = await db
        .from('TechnicianServices')
        .select('TechnicianID')
        .eq('CategoryID', selectedCategory);

      const techIds = (matchedLinks || []).map((item) => item.TechnicianID);

      if (techIds.length === 0) {
        setTechnicians([]);
        setSearchingTech(false);
        return;
      }

      const { data } = await db
        .from('Technicians')
        .select(
          '*, TechnicianSlots(*), Reviews(Rating), TechnicianServices(CategoryID, ServiceCategories(MainCategory, CategoryName))'
        )
        .in('TechnicianID', techIds)
        .eq('ProvinceID', selectedProvince)
        .eq('approved', true);

      setTechnicians((data as TechnicianItem[]) || []);
      setSearchingTech(false);
    }
    findTechnicians();
  }, [selectedProvince, selectedMainCategory, selectedCategory]);

  const loadMyJobs = useCallback(async () => {
    if (!user) return;
    setLoadingJobs(true);
    const { data } = await db
      .from('Jobs')
      .select(
        '*, Technicians(TechnicianName, TechnicianPhone), TechnicianSlots(WorkDate, StartTime, EndTime), Reviews(ReviewID, Rating)'
      )
      .eq('CustomerID', user.CustomerID)
      .order('CreatedAt', { ascending: false });

    setMyJobs((data as JobRecord[]) || []);
    setLoadingJobs(false);
  }, [user]);

  useEffect(() => {
    if (activeTab === 'jobs') {
      loadMyJobs();
    }
  }, [activeTab, loadMyJobs]);

  const currentCategoryObj = categories.find((c) => c.CategoryID === selectedCategory);

  const getMainCategoryIcon = (name: string) => {
    if (name.includes('แอร์')) return <Wind className="w-6 h-6" />;
    if (name.includes('ประปา')) return <Droplets className="w-6 h-6" />;
    if (name.includes('ไฟ')) return <Zap className="w-6 h-6" />;
    return <Wrench className="w-6 h-6" />;
  };

  // บันทึกข้อมูลส่วนตัวลูกค้า
  const handleSaveCustomerInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setInfoFeedback(null);

    const { data, error } = await db
      .from('Customers')
      .update({
        CustomerName: editName.trim(),
        CustomerPhone: editPhone.trim(),
        ProvinceID: editProvince,
      })
      .eq('CustomerID', user.CustomerID)
      .select('*')
      .single();

    setSavingProfile(false);

    if (error || !data) {
      setInfoFeedback({
        type: 'error',
        text: `บันทึกข้อมูลไม่สำเร็จ: ${error?.message || 'ไม่พบข้อมูลผู้ใช้'}`,
      });
      return;
    }

    const updatedUser = data as CustomerUser;
    setUser(updatedUser);
    setSelectedProvince(updatedUser.ProvinceID);
    saveSession('customer', data);
    setInfoFeedback({
      type: 'success',
      text: 'อัปเดตข้อมูลส่วนตัวเรียบร้อยแล้ว',
    });
  };

  // เปลี่ยนรหัสผ่านลูกค้า (ตรวจสอบรหัสเดิมก่อน)
  const handleChangeCustomerPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPwFeedback(null);

    if (newPassword.length < 4) {
      setPwFeedback({
        type: 'error',
        text: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwFeedback({
        type: 'error',
        text: 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน',
      });
      return;
    }

    if (currentPassword === newPassword) {
      setPwFeedback({
        type: 'error',
        text: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน',
      });
      return;
    }

    setSavingPassword(true);

    // ตรวจสอบรหัสผ่านปัจจุบันในฐานข้อมูล
    const { data: verifyData, error: verifyError } = await db
      .from('Customers')
      .select('CustomerID')
      .eq('CustomerID', user.CustomerID)
      .eq('CustomerPassword', currentPassword)
      .single();

    if (verifyError || !verifyData) {
      setSavingPassword(false);
      setPwFeedback({
        type: 'error',
        text: 'รหัสผ่านปัจจุบันไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
      });
      return;
    }

    const { error: updateError } = await db
      .from('Customers')
      .update({ CustomerPassword: newPassword })
      .eq('CustomerID', user.CustomerID);

    setSavingPassword(false);

    if (updateError) {
      setPwFeedback({
        type: 'error',
        text: `เปลี่ยนรหัสผ่านไม่สำเร็จ: ${updateError.message}`,
      });
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwFeedback({
      type: 'success',
      text: 'เปลี่ยนรหัสผ่านใหม่สำเร็จเรียบร้อยแล้ว',
    });
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !chosenTech || !chosenSlot || !currentCategoryObj) return;
    setSubmitting(true);

    const jobId = `JOB${Date.now().toString().slice(-6)}`;

    const { error: jobError } = await db.from('Jobs').insert([
      {
        JobID: jobId,
        CustomerID: user.CustomerID,
        TechnicianID: chosenTech.id,
        SlotID: chosenSlot.id,
        ServiceAddress: serviceAddress.trim(),
        ProblemDetail: `[${currentCategoryObj.MainCategory} - ${currentCategoryObj.CategoryName}] ${problemDetail.trim()}`,
        Status: 'รอดำเนินการ',
        PaymentStatus: 'รอชำระเงิน',
        PaymentAmount: currentCategoryObj.CategoryPrice,
      },
    ]);

    if (jobError) {
      alert('เกิดข้อผิดพลาดในการจอง: ' + jobError.message);
      setSubmitting(false);
      return;
    }

    await db.from('TechnicianSlots').update({ IsBooked: true }).eq('SlotID', chosenSlot.id);

    setSubmitting(false);
    setServiceAddress('');
    setProblemDetail('');
    setChosenTech(null);
    setChosenSlot(null);
    setActiveTab('jobs');
  };

  const handleConfirmPayment = async () => {
    if (!payJob) return;
    setSubmitting(true);
    await db
      .from('Jobs')
      .update({ PaymentStatus: 'ชำระแล้ว', PaymentMethod: 'QR Code' })
      .eq('JobID', payJob.JobID);

    setSubmitting(false);
    setPayJob(null);
    loadMyJobs();
  };

  const handleConfirmReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reviewJob) return;
    setSubmitting(true);

    await db.from('Reviews').insert([
      {
        JobID: reviewJob.JobID,
        CustomerID: user.CustomerID,
        TechnicianID: reviewJob.TechnicianID,
        Rating: ratingScore,
        Comment: reviewComment.trim(),
      },
    ]);

    setSubmitting(false);
    setReviewJob(null);
    setReviewComment('');
    setRatingScore(5);
    loadMyJobs();
  };

  const handleLogout = () => {
    clearSession();
    router.push('/');
  };

  if (!user) return null;

  const userProvinceName =
    provinces.find((p) => p.ProvinceID === user.ProvinceID)?.ProvinceName || 'ไม่ระบุจังหวัด';
  const avatarInitial = user.CustomerName?.trim().charAt(0) || 'C';

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-800">
      {/* Navbar */}
      <header className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-6 py-4 shadow-md">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-sm">
              <Wrench className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">ระบบจ้างช่างออนไลน์</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveTab('profile');
                setInfoFeedback(null);
                setPwFeedback(null);
              }}
              className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/25 px-3.5 py-1.5 rounded-xl text-sm font-medium transition"
              title="จัดการโปรไฟล์และรหัสผ่าน"
            >
              <span className="w-6 h-6 rounded-full bg-white text-blue-700 font-bold text-xs flex items-center justify-center">
                {avatarInitial}
              </span>
              <span>{user.CustomerName}</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-blue-900/60 hover:bg-blue-950 px-3.5 py-1.5 rounded-xl text-sm transition"
            >
              <LogOut className="w-4 h-4" /> ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {/* เมนูหลัก */}
        <div className="inline-flex flex-wrap gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm mb-6">
          <button
            onClick={() => setActiveTab('book')}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition ${
              activeTab === 'book'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            + จ้างช่างใหม่
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition ${
              activeTab === 'jobs'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            รายการจ้างงาน & สถานะ
          </button>
          <button
            onClick={() => {
              setActiveTab('profile');
              setInfoFeedback(null);
              setPwFeedback(null);
            }}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <UserCog className="w-4 h-4" /> ตั้งค่าบัญชีและโปรไฟล์
          </button>
        </div>

        {/* หน้า 1: จ้างช่างใหม่ */}
        {activeTab === 'book' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-4">
                1. เลือกพื้นที่และประเภทช่างที่ต้องการ
              </h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  จังหวัดที่ต้องการรับบริการ
                </label>
                <select
                  value={selectedProvince}
                  onChange={(e) => setSelectedProvince(e.target.value)}
                  className="w-full md:w-1/2 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- เลือกจังหวัด --</option>
                  {provinces.map((p) => (
                    <option key={p.ProvinceID} value={p.ProvinceID}>
                      {p.ProvinceName}
                    </option>
                  ))}
                </select>
              </div>

              <label className="block text-sm font-medium text-slate-700 mb-2">
                กดเลือกประเภทช่าง
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {mainCategories.map((mc) => {
                  const isActive = selectedMainCategory === mc;
                  return (
                    <button
                      key={mc}
                      type="button"
                      onClick={() => {
                        setSelectedMainCategory(mc);
                        setSelectedCategory('');
                        setChosenTech(null);
                        setChosenSlot(null);
                      }}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition ${
                        isActive
                          ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm'
                          : 'border-slate-200 hover:border-blue-300 text-slate-700 bg-white'
                      }`}
                    >
                      <div
                        className={`p-2.5 rounded-lg ${
                          isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {getMainCategoryIcon(mc)}
                      </div>
                      <div>
                        <div className="font-bold text-base">{mc}</div>
                        <div className="text-xs text-slate-500">คลิกเพื่อเลือกบริการ</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedMainCategory && (
              <div className="border-t border-slate-200 pt-6">
                <h2 className="text-lg font-bold text-slate-800 mb-3">
                  2. เลือกบริการของ{selectedMainCategory}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {subCategories.map((sub) => {
                    const isSelected = selectedCategory === sub.CategoryID;
                    return (
                      <button
                        key={sub.CategoryID}
                        type="button"
                        onClick={() => setSelectedCategory(sub.CategoryID)}
                        className={`p-4 rounded-xl border text-left transition ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                            : 'border-slate-200 hover:border-blue-400 bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="font-semibold text-sm">{sub.CategoryName}</div>
                        <div
                          className={`text-sm font-bold mt-1 ${
                            isSelected ? 'text-blue-100' : 'text-blue-600'
                          }`}
                        >
                          {sub.CategoryPrice.toLocaleString()} บาท
                        </div>
                      </button>
                    );
                  })}
                </div>

                {currentCategoryObj && (
                  <div className="mt-4 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 font-semibold text-center text-sm">
                    บริการที่เลือก: {currentCategoryObj.MainCategory} (
                    {currentCategoryObj.CategoryName}) — ราคามาตรฐาน{' '}
                    {currentCategoryObj.CategoryPrice.toLocaleString()} บาท
                  </div>
                )}
              </div>
            )}

            {selectedProvince && selectedMainCategory && selectedCategory && (
              <div className="border-t border-slate-200 pt-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4">
                  3. เลือกช่างและตารางเวลาที่ว่าง
                </h2>
                {searchingTech ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin" /> กำลังค้นหาช่างในพื้นที่...
                  </div>
                ) : technicians.length === 0 ? (
                  <p className="text-slate-500 bg-slate-50 p-4 rounded-xl">
                    ยังไม่มีช่างที่รับงาน &ldquo;{currentCategoryObj?.CategoryName}&rdquo; ในจังหวัดนี้
                  </p>
                ) : (
                  <div className="space-y-4">
                    {technicians.map((tech) => {
                      const avgRating =
                        tech.Reviews?.length > 0
                          ? (
                              tech.Reviews.reduce((acc, r) => acc + r.Rating, 0) /
                              tech.Reviews.length
                            ).toFixed(1)
                          : 'ยังไม่มีรีวิว';
                      const availableSlots = (tech.TechnicianSlots || []).filter((s) => !s.IsBooked);
                      const skillNames = (tech.TechnicianServices || [])
                        .map((ts) => ts.ServiceCategories?.CategoryName)
                        .filter(Boolean);

                      return (
                        <div
                          key={tech.TechnicianID}
                          className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition"
                        >
                          <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                            <div>
                              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                                {tech.TechnicianName}
                                <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                  {avgRating}
                                </span>
                              </h3>
                              <p className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="w-3.5 h-3.5" /> {tech.TechnicianPhone}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" /> {tech.Address}
                                </span>
                              </p>
                              {skillNames.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                  <span className="text-xs text-slate-500">งานที่รับทำ:</span>
                                  {skillNames.map((skill, idx) => (
                                    <span
                                      key={idx}
                                      className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-md font-medium"
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-3">
                            <p className="text-xs font-medium text-slate-600 mb-2">
                              เลือกวันและช่วงเวลาที่ว่าง:
                            </p>
                            {availableSlots.length === 0 ? (
                              <span className="text-xs text-red-500">ไม่มีคิวว่างในขณะนี้</span>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {availableSlots.map((slot) => {
                                  const timeLabel = `${slot.StartTime.slice(0, 5)} - ${slot.EndTime.slice(0, 5)}`;
                                  const isSelected = chosenSlot?.id === slot.SlotID;
                                  return (
                                    <button
                                      key={slot.SlotID}
                                      type="button"
                                      onClick={() => {
                                        setChosenTech({
                                          id: tech.TechnicianID,
                                          name: tech.TechnicianName,
                                        });
                                        setChosenSlot({
                                          id: slot.SlotID,
                                          label: `${slot.WorkDate} (${timeLabel})`,
                                        });
                                      }}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                                        isSelected
                                          ? 'bg-blue-600 text-white border-blue-600'
                                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-blue-50'
                                      }`}
                                    >
                                      <Calendar className="w-3.5 h-3.5" />
                                      {slot.WorkDate} | {timeLabel}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {chosenTech && chosenSlot && (
              <form
                onSubmit={handleConfirmBooking}
                className="border-t border-slate-200 pt-6 space-y-4"
              >
                <h2 className="text-lg font-bold text-slate-800">4. ยืนยันรายละเอียดหน้างาน</h2>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
                  คุณเลือก: <strong>{chosenTech.name}</strong> | นัดหมาย:{' '}
                  <strong>{chosenSlot.label}</strong>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ที่อยู่สำหรับให้ช่างเข้าไปซ่อม
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={serviceAddress}
                    onChange={(e) => setServiceAddress(e.target.value)}
                    placeholder="ระบุบ้านเลขที่ ซอย ถนน จุดสังเกต..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    อาการเสีย / รายละเอียดปัญหา
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={problemDetail}
                    onChange={(e) => setProblemDetail(e.target.value)}
                    placeholder="ระบุอาการเสียเพิ่มเติม..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  ยืนยันการจ้างงาน
                </button>
              </form>
            )}
          </div>
        )}

        {/* หน้า 2: รายการจ้างงาน */}
        {activeTab === 'jobs' && (
          <div className="space-y-4">
            {loadingJobs ? (
              <div className="bg-white p-8 rounded-2xl text-center text-slate-500">
                กำลังโหลดรายการจ้างงาน...
              </div>
            ) : myJobs.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center text-slate-500">
                ยังไม่มีประวัติการจ้างงาน
              </div>
            ) : (
              myJobs.map((job) => (
                <div
                  key={job.JobID}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-2"
                >
                  <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3">
                    <span className="font-bold text-slate-800">รหัสงาน: {job.JobID}</span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                      สถานะงาน: {job.Status}
                    </span>
                  </div>
                  <p className="text-sm">
                    <strong>ช่างผู้รับงาน:</strong> {job.Technicians?.TechnicianName || '-'} (โทร:{' '}
                    {job.Technicians?.TechnicianPhone || '-'})
                  </p>
                  <p className="text-sm flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <strong>วัน-เวลานัดหมาย:</strong>{' '}
                    {job.TechnicianSlots
                      ? `${job.TechnicianSlots.WorkDate} (${job.TechnicianSlots.StartTime.slice(0, 5)} - ${job.TechnicianSlots.EndTime.slice(0, 5)})`
                      : '-'}
                  </p>
                  <p className="text-sm">
                    <strong>รายละเอียดงาน:</strong> {job.ProblemDetail}
                  </p>
                  <p className="text-sm">
                    <strong>ค่าบริการ:</strong> {job.PaymentAmount.toLocaleString()} บาท —{' '}
                    <span
                      className={
                        job.PaymentStatus === 'ชำระแล้ว'
                          ? 'text-emerald-600 font-semibold'
                          : 'text-amber-600 font-semibold'
                      }
                    >
                      {job.PaymentStatus}
                    </span>
                  </p>

                  <div className="pt-3 flex gap-3">
                    {job.Status === 'เสร็จสิ้น' && job.PaymentStatus === 'รอชำระเงิน' && (
                      <button
                        onClick={() => setPayJob(job)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition"
                      >
                        <CreditCard className="w-4 h-4" /> ชำระเงิน (
                        {job.PaymentAmount.toLocaleString()} บาท)
                      </button>
                    )}

                    {job.PaymentStatus === 'ชำระแล้ว' &&
                      (!job.Reviews || job.Reviews.length === 0) && (
                        <button
                          onClick={() => setReviewJob(job)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition"
                        >
                          <Star className="w-4 h-4" /> ให้คะแนนรีวิวช่าง
                        </button>
                      )}

                    {job.Reviews && job.Reviews.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-sm text-emerald-600 font-medium">
                        <CheckCircle2 className="w-4 h-4" /> รีวิวแล้ว ({job.Reviews[0].Rating} ดาว)
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* หน้า 3: ตั้งค่าโปรไฟล์และเปลี่ยนรหัสผ่าน (ดีไซน์ 2 คอลัมน์ แยกส่วนชัดเจน) */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* คอลัมน์ซ้าย: การ์ดสรุปโปรไฟล์และเมนูย่อย */}
            <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="h-24 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700" />
              <div className="px-6 pb-6">
                <div className="-mt-11 mb-3 flex items-end justify-between">
                  <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-md">
                    <div className="w-full h-full rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-2xl font-bold">
                      {avatarInitial}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                    <ShieldCheck className="w-3.5 h-3.5" /> บัญชีลูกค้า
                  </span>
                </div>

                <h2 className="text-lg font-bold text-slate-800">{user.CustomerName}</h2>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {user.CustomerEmail}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5" /> รหัสสมาชิก
                    </span>
                    <span className="font-mono font-semibold text-slate-700">
                      {user.CustomerID}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> เบอร์ติดต่อ
                    </span>
                    <span className="font-medium text-slate-700">{user.CustomerPhone}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> พื้นที่จังหวัด
                    </span>
                    <span className="font-medium text-slate-700">{userProvinceName}</span>
                  </div>
                </div>

                {/* เมนูย่อยแยกส่วน: ข้อมูลส่วนตัว vs เปลี่ยนรหัสผ่าน */}
                <div className="mt-6 pt-4 border-t border-slate-100 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileSubTab('info');
                      setInfoFeedback(null);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                      profileSubTab === 'info'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>ข้อมูลส่วนตัว</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileSubTab('password');
                      setPwFeedback(null);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                      profileSubTab === 'password'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>เปลี่ยนรหัสผ่าน</span>
                  </button>
                </div>
              </div>
            </div>

            {/* คอลัมน์ขวา: เนื้อหาฟอร์มตามเมนูย่อยที่เลือก */}
            <div className="lg:col-span-8">
              {profileSubTab === 'info' ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
                  <div className="flex items-center gap-3 pb-5 mb-6 border-b border-slate-100">
                    <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                      <UserCog className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">แก้ไขข้อมูลส่วนตัว</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        อัปเดตชื่อ เบอร์โทรศัพท์ และจังหวัดที่อยู่ของคุณ ข้อมูลจะมีผลทันทีหลังบันทึก
                      </p>
                    </div>
                  </div>

                  {infoFeedback && (
                    <div
                      className={`flex items-center gap-2.5 p-3.5 rounded-xl text-sm mb-5 border ${
                        infoFeedback.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}
                    >
                      {infoFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{infoFeedback.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveCustomerInfo} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          ชื่อ - นามสกุล
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type="text"
                            maxLength={30}
                            required
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          เบอร์โทรศัพท์ (10 หลัก)
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type="text"
                            maxLength={10}
                            required
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          จังหวัดที่อยู่
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <select
                            required
                            value={editProvince}
                            onChange={(e) => setEditProvince(e.target.value)}
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          อีเมลเข้าสู่ระบบ (ไม่สามารถแก้ไขได้)
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type="email"
                            disabled
                            value={user.CustomerEmail}
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-60"
                      >
                        {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                        บันทึกข้อมูลส่วนตัว
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
                  <div className="flex items-center gap-3 pb-5 mb-6 border-b border-slate-100">
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                      <KeyRound className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">เปลี่ยนรหัสผ่าน</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยันตัวตนก่อนตั้งรหัสผ่านใหม่
                      </p>
                    </div>
                  </div>

                  {pwFeedback && (
                    <div
                      className={`flex items-center gap-2.5 p-3.5 rounded-xl text-sm mb-5 border ${
                        pwFeedback.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}
                    >
                      {pwFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{pwFeedback.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangeCustomerPassword} className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        รหัสผ่านปัจจุบัน
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPw ? 'text' : 'password'}
                          required
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="กรอกรหัสผ่านปัจจุบัน"
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPw((prev) => !prev)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                        >
                          {showCurrentPw ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        รหัสผ่านใหม่
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPw ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="อย่างน้อย 4 ตัวอักษร"
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw((prev) => !prev)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                        >
                          {showNewPw ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        ยืนยันรหัสผ่านใหม่อีกครั้ง
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPw ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPw((prev) => !prev)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                        >
                          {showConfirmPw ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-red-500 mt-1">รหัสผ่านใหม่ทั้งสองช่องยังไม่ตรงกัน</p>
                      )}
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={savingPassword}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-60"
                      >
                        {savingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                        อัปเดตรหัสผ่านใหม่
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal ชำระเงิน QR Code */}
      {payJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="inline-flex p-3 bg-blue-50 text-blue-600 rounded-full">
              <QrCode className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold">สแกน QR Code เพื่อชำระเงิน</h3>
            <p className="text-sm text-slate-600">
              ยอดชำระสุทธิ:{' '}
              <strong className="text-xl text-blue-600">
                {payJob.PaymentAmount.toLocaleString()} บาท
              </strong>
            </p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=PromptPay-${payJob.JobID}-${payJob.PaymentAmount}`}
              alt="QR Payment"
              className="mx-auto rounded-xl border border-slate-200 p-2"
            />
            <button
              onClick={handleConfirmPayment}
              disabled={submitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition"
            >
              {submitting ? 'กำลังบันทึก...' : 'ยืนยันการชำระเงินแล้ว'}
            </button>
            <button
              onClick={() => setPayJob(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-xl transition"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}

      {/* Modal ให้คะแนนรีวิว */}
      {reviewJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleConfirmReview}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-800">ให้คะแนนและรีวิวช่าง</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                คะแนนความพึงพอใจ (1 - 5 ดาว)
              </label>
              <select
                value={ratingScore}
                onChange={(e) => setRatingScore(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white"
              >
                <option value={5}>5 ดาว - ดีมาก</option>
                <option value={4}>4 ดาว - ดี</option>
                <option value={3}>3 ดาว - ปานกลาง</option>
                <option value={2}>2 ดาว - พอใช้</option>
                <option value={1}>1 ดาว - ควรปรับปรุง</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ความคิดเห็นเพิ่มเติม
              </label>
              <textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="ช่างทำงานเรียบร้อย ตรงเวลา..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewJob(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold"
              >
                {submitting ? 'กำลังส่ง...' : 'ส่งรีวิว'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}