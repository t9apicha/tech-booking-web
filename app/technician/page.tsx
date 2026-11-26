'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db, getSession, saveSession, clearSession } from '@/lib/supabase';
import {
  Wrench,
  Calendar,
  Clock,
  Star,
  LogOut,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  UserCog,
  AlertCircle,
  MapPin,
  Phone,
  User,
  KeyRound,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  Hash,
} from 'lucide-react';

interface PendingProfileData {
  TechnicianName: string;
  TechnicianPhone: string;
  ProvinceID: string;
  ProvinceName: string;
  Address: string;
  TechnicianPassword?: string;
  CategoryIDs: string[];
  ServiceNames: string[];
  requestedAt: string;
}

interface TechnicianUser {
  TechnicianID: string;
  TechnicianName: string;
  TechnicianEmail: string;
  TechnicianPhone: string;
  ProvinceID: string;
  CategoryID: string;
  Address: string;
  approved: boolean;
  pending_profile?: PendingProfileData | null;
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

interface TechJob {
  JobID: string;
  SlotID: number | null;
  ServiceAddress: string;
  ProblemDetail: string;
  Status: string;
  PaymentStatus: string;
  PaymentAmount: number;
  Customers: { CustomerName: string; CustomerPhone: string } | null;
  TechnicianSlots: { WorkDate: string; StartTime: string; EndTime: string } | null;
}

interface SlotItem {
  SlotID: number;
  WorkDate: string;
  StartTime: string;
  EndTime: string;
  IsBooked: boolean;
}

interface ReviewItem {
  ReviewID: number;
  Rating: number;
  Comment: string;
  CreatedAt: string;
  Customers: { CustomerName: string } | null;
}

export default function TechnicianDashboard() {
  const router = useRouter();
  const [tech, setTech] = useState<TechnicianUser | null>(null);
  const [activeTab, setActiveTab] = useState<'jobs' | 'slots' | 'reviews' | 'profile'>('jobs');
  const [profileSubTab, setProfileSubTab] = useState<'info' | 'password'>('info');

  const [jobs, setJobs] = useState<TechJob[]>([]);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [currentServiceIds, setCurrentServiceIds] = useState<string[]>([]);

  // Slot form
  const [workDate, setWorkDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [loading, setLoading] = useState(false);

  // Profile Info Edit states
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editProvince, setEditProvince] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [infoFeedback, setInfoFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Password Change states
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

  const loadAllData = useCallback(async (techId: string) => {
    const { data: freshTech } = await db
      .from('Technicians')
      .select('*')
      .eq('TechnicianID', techId)
      .single();

    if (freshTech) {
      const t = freshTech as TechnicianUser;
      setTech(t);
      saveSession('technician', freshTech);
      setEditName(t.TechnicianName || '');
      setEditPhone(t.TechnicianPhone || '');
      setEditProvince(t.ProvinceID || '');
      setEditAddress(t.Address || '');
    }

    const { data: provData } = await db.from('Provinces').select('*');
    if (provData) setProvinces(provData);

    const { data: catData } = await db.from('ServiceCategories').select('*');
    if (catData) setCategories(catData as ServiceCategory[]);

    const { data: linkData } = await db
      .from('TechnicianServices')
      .select('CategoryID')
      .eq('TechnicianID', techId);
    if (linkData) {
      const ids = linkData.map((item) => item.CategoryID);
      setCurrentServiceIds(ids);
      setEditCategoryIds(ids);
    }

    const { data: jobData } = await db
      .from('Jobs')
      .select(
        '*, Customers(CustomerName, CustomerPhone), TechnicianSlots(WorkDate, StartTime, EndTime)'
      )
      .eq('TechnicianID', techId)
      .order('CreatedAt', { ascending: false });
    if (jobData) setJobs(jobData as TechJob[]);

    const { data: slotData } = await db
      .from('TechnicianSlots')
      .select('*')
      .eq('TechnicianID', techId)
      .order('WorkDate', { ascending: true });
    if (slotData) setSlots(slotData as SlotItem[]);

    const { data: revData } = await db
      .from('Reviews')
      .select('*, Customers(CustomerName)')
      .eq('TechnicianID', techId)
      .order('CreatedAt', { ascending: false });
    if (revData) setReviews(revData as ReviewItem[]);
  }, []);

  useEffect(() => {
    const session = getSession<TechnicianUser>('technician');
    if (!session) {
      router.push('/');
      return;
    }
    setTech(session);
    loadAllData(session.TechnicianID);
  }, [router, loadAllData]);

  const handleUpdateJobStatus = async (job: TechJob, nextStatus: string) => {
    const payload: Record<string, unknown> = { Status: nextStatus };
    if (nextStatus === 'เริ่มงาน') payload.StartedAt = new Date().toISOString();
    if (nextStatus === 'เสร็จสิ้น') payload.CompletedAt = new Date().toISOString();

    await db.from('Jobs').update(payload).eq('JobID', job.JobID);

    if (nextStatus === 'ยกเลิก' && job.SlotID) {
      await db.from('TechnicianSlots').update({ IsBooked: false }).eq('SlotID', job.SlotID);
    }

    if (tech) loadAllData(tech.TechnicianID);
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tech || !workDate) return;
    setLoading(true);

    await db.from('TechnicianSlots').insert([
      {
        TechnicianID: tech.TechnicianID,
        WorkDate: workDate,
        StartTime: `${startTime}:00+07`,
        EndTime: `${endTime}:00+07`,
        IsBooked: false,
      },
    ]);

    setLoading(false);
    setWorkDate('');
    loadAllData(tech.TechnicianID);
  };

  const handleDeleteSlot = async (slotId: number) => {
    await db.from('TechnicianSlots').delete().eq('SlotID', slotId);
    if (tech) loadAllData(tech.TechnicianID);
  };

  const toggleEditCategory = (catId: string) => {
    setEditCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  // ส่งคำขอแก้ไขข้อมูลส่วนตัวและงานที่รับทำ (ผสานกับคำขอเดิมหากมี)
  const handleSubmitProfileInfoRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tech) return;
    setInfoFeedback(null);

    if (editCategoryIds.length === 0) {
      setInfoFeedback({
        type: 'error',
        text: 'กรุณาเลือกบริการที่รับทำอย่างน้อย 1 รายการ',
      });
      return;
    }

    setSavingProfile(true);

    const provObj = provinces.find((p) => p.ProvinceID === editProvince);
    const serviceNames = categories
      .filter((c) => editCategoryIds.includes(c.CategoryID))
      .map((c) => c.CategoryName);

    const pendingPayload: PendingProfileData = {
      TechnicianName: editName.trim(),
      TechnicianPhone: editPhone.trim(),
      ProvinceID: editProvince,
      ProvinceName: provObj?.ProvinceName || '-',
      Address: editAddress.trim(),
      CategoryIDs: editCategoryIds,
      ServiceNames: serviceNames,
      requestedAt: new Date().toISOString(),
    };

    if (tech.pending_profile?.TechnicianPassword) {
      pendingPayload.TechnicianPassword = tech.pending_profile.TechnicianPassword;
    }

    const { error } = await db
      .from('Technicians')
      .update({ pending_profile: pendingPayload })
      .eq('TechnicianID', tech.TechnicianID);

    setSavingProfile(false);

    if (error) {
      setInfoFeedback({
        type: 'error',
        text: `ส่งคำขอไม่สำเร็จ: ${error.message}`,
      });
      return;
    }

    setInfoFeedback({
      type: 'success',
      text: 'ส่งคำขอแก้ไขข้อมูลส่วนตัวเรียบร้อยแล้ว กรุณารอแอดมินตรวจสอบและกดยืนยัน',
    });
    loadAllData(tech.TechnicianID);
  };

  // ส่งคำขอเปลี่ยนรหัสผ่านช่าง (ตรวจสอบรหัสเดิมก่อน และรอแอดมินอนุมัติ)
  const handleSubmitPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tech) return;
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

    // ตรวจสอบรหัสผ่านปัจจุบันกับฐานข้อมูล
    const { data: verifyData, error: verifyError } = await db
      .from('Technicians')
      .select('TechnicianID')
      .eq('TechnicianID', tech.TechnicianID)
      .eq('TechnicianPassword', currentPassword)
      .single();

    if (verifyError || !verifyData) {
      setSavingPassword(false);
      setPwFeedback({
        type: 'error',
        text: 'รหัสผ่านปัจจุบันไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
      });
      return;
    }

    const existing = tech.pending_profile;
    const baseProvinceId = existing?.ProvinceID || tech.ProvinceID;
    const baseProvinceName =
      existing?.ProvinceName ||
      provinces.find((p) => p.ProvinceID === tech.ProvinceID)?.ProvinceName ||
      '-';
    const baseCategoryIds = existing?.CategoryIDs || currentServiceIds;
    const baseServiceNames =
      existing?.ServiceNames ||
      categories
        .filter((c) => currentServiceIds.includes(c.CategoryID))
        .map((c) => c.CategoryName);

    const pendingPayload: PendingProfileData = {
      TechnicianName: existing?.TechnicianName || tech.TechnicianName,
      TechnicianPhone: existing?.TechnicianPhone || tech.TechnicianPhone,
      ProvinceID: baseProvinceId,
      ProvinceName: baseProvinceName,
      Address: existing?.Address || tech.Address,
      CategoryIDs: baseCategoryIds,
      ServiceNames: baseServiceNames,
      TechnicianPassword: newPassword,
      requestedAt: new Date().toISOString(),
    };

    const { error } = await db
      .from('Technicians')
      .update({ pending_profile: pendingPayload })
      .eq('TechnicianID', tech.TechnicianID);

    setSavingPassword(false);

    if (error) {
      setPwFeedback({
        type: 'error',
        text: `ส่งคำขอเปลี่ยนรหัสผ่านไม่สำเร็จ: ${error.message}`,
      });
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwFeedback({
      type: 'success',
      text: 'ส่งคำขอเปลี่ยนรหัสผ่านเรียบร้อยแล้ว รหัสผ่านใหม่จะมีผลเมื่อแอดมินกดยืนยัน',
    });
    loadAllData(tech.TechnicianID);
  };

  const handleCancelPendingRequest = async () => {
    if (!tech) return;
    setSavingProfile(true);
    await db
      .from('Technicians')
      .update({ pending_profile: null })
      .eq('TechnicianID', tech.TechnicianID);
    setSavingProfile(false);
    setInfoFeedback(null);
    setPwFeedback(null);
    loadAllData(tech.TechnicianID);
  };

  const handleLogout = () => {
    clearSession();
    router.push('/');
  };

  if (!tech) return null;

  const primaryCatObj = categories.find(
    (c) => c.CategoryID === (currentServiceIds[0] || tech.CategoryID)
  );
  const myTradeName = primaryCatObj?.MainCategory || 'ช่างซ่อมทั่วไป';
  const tradeSubCategories = primaryCatObj?.MainCategory
    ? categories.filter((c) => c.MainCategory === primaryCatObj.MainCategory)
    : categories;

  const techProvinceName =
    provinces.find((p) => p.ProvinceID === tech.ProvinceID)?.ProvinceName || '-';
  const avatarInitial = tech.TechnicianName?.trim().charAt(0) || 'T';

  const completedCount = jobs.filter((j) => j.Status === 'เสร็จสิ้น').length;
  const cancelledCount = jobs.filter((j) => j.Status === 'ยกเลิก').length;
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.Rating, 0) / reviews.length).toFixed(1)
      : '-';

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-800">
      {/* Header */}
      <header className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-6 py-4 shadow-md">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-sm">
              <Wrench className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">ระบบจัดการงานช่าง</span>
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
              <span className="w-6 h-6 rounded-full bg-white text-teal-700 font-bold text-xs flex items-center justify-center">
                {avatarInitial}
              </span>
              <span>{tech.TechnicianName}</span>
              {tech.pending_profile && (
                <span className="bg-amber-400 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  รออนุมัติแก้ไข
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-teal-900/60 hover:bg-teal-950 px-3.5 py-1.5 rounded-xl text-sm transition"
            >
              <LogOut className="w-4 h-4" /> ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {/* Tabs */}
        <div className="inline-flex flex-wrap gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm mb-6">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition ${
              activeTab === 'jobs'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            รายการงานที่ได้รับ ({jobs.length})
          </button>
          <button
            onClick={() => setActiveTab('slots')}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition ${
              activeTab === 'slots'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            จัดการตารางวัน-เวลาว่าง ({slots.length})
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition ${
              activeTab === 'reviews'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            สถิติและผลรีวิว
          </button>
          <button
            onClick={() => {
              setActiveTab('profile');
              setInfoFeedback(null);
              setPwFeedback(null);
            }}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <UserCog className="w-4 h-4" /> ตั้งค่าบัญชีและโปรไฟล์
          </button>
        </div>

        {/* Tab 1: Jobs */}
        {activeTab === 'jobs' && (
          <div className="space-y-4">
            {jobs.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center text-slate-500 border border-slate-200">
                ยังไม่มีรายการงานจากลูกค้า
              </div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.JobID}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-2.5"
                >
                  <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3">
                    <span className="font-bold text-slate-800">รหัสงาน: {job.JobID}</span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">
                      สถานะ: {job.Status}
                    </span>
                  </div>

                  <p className="text-sm">
                    <strong>ลูกค้า:</strong> {job.Customers?.CustomerName || '-'} (
                    <Phone className="w-3.5 h-3.5 inline" /> {job.Customers?.CustomerPhone || '-'})
                  </p>
                  <p className="text-sm flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <strong>นัดหมาย:</strong>{' '}
                    {job.TechnicianSlots
                      ? `${job.TechnicianSlots.WorkDate} (${job.TechnicianSlots.StartTime.slice(0, 5)} - ${job.TechnicianSlots.EndTime.slice(0, 5)})`
                      : '-'}
                  </p>
                  <p className="text-sm flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>สถานที่หน้างาน:</strong> {job.ServiceAddress}
                    </span>
                  </p>
                  <p className="text-sm">
                    <strong>รายละเอียดงาน:</strong> {job.ProblemDetail}
                  </p>
                  <p className="text-sm">
                    <strong>ค่าบริการ:</strong> {job.PaymentAmount.toLocaleString()} บาท (
                    {job.PaymentStatus})
                  </p>

                  {job.Status !== 'เสร็จสิ้น' && job.Status !== 'ยกเลิก' && (
                    <div className="pt-3 flex flex-wrap gap-2">
                      {job.Status === 'รอดำเนินการ' && (
                        <button
                          onClick={() => handleUpdateJobStatus(job, 'กำลังเดินทาง')}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition"
                        >
                          อัปเดต: กำลังเดินทาง
                        </button>
                      )}
                      {(job.Status === 'รอดำเนินการ' || job.Status === 'กำลังเดินทาง') && (
                        <button
                          onClick={() => handleUpdateJobStatus(job, 'เริ่มงาน')}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl transition"
                        >
                          อัปเดต: เริ่มงาน
                        </button>
                      )}
                      {job.Status === 'เริ่มงาน' && (
                        <button
                          onClick={() => handleUpdateJobStatus(job, 'เสร็จสิ้น')}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition"
                        >
                          อัปเดต: เสร็จสิ้นงาน
                        </button>
                      )}
                      <button
                        onClick={() => handleUpdateJobStatus(job, 'ยกเลิก')}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-xl transition"
                      >
                        ยกเลิกงาน
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Slots */}
        {activeTab === 'slots' && (
          <div className="grid md:grid-cols-3 gap-6">
            <form
              onSubmit={handleAddSlot}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit"
            >
              <h2 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-600" /> เพิ่มวัน-เวลาว่างรับงาน
              </h2>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">วันที่</label>
                <input
                  type="date"
                  required
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">เวลาเริ่ม</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">เวลาสิ้นสุด</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition"
              >
                {loading ? 'กำลังบันทึก...' : 'เพิ่มคิวว่าง'}
              </button>
            </form>

            <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="font-bold text-base text-slate-800 mb-4">ตารางเวลาว่างของคุณ</h2>
              {slots.length === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่ได้เพิ่มวัน-เวลาว่าง</p>
              ) : (
                <div className="space-y-2.5">
                  {slots.map((s) => (
                    <div
                      key={s.SlotID}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <div className="flex items-center gap-3 text-sm">
                        <Calendar className="w-4 h-4 text-teal-600" />
                        <span className="font-semibold">{s.WorkDate}</span>
                        <span>
                          {s.StartTime.slice(0, 5)} - {s.EndTime.slice(0, 5)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {s.IsBooked ? (
                          <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2.5 py-1 rounded-full">
                            ถูกจองแล้ว
                          </span>
                        ) : (
                          <>
                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full">
                              ว่าง
                            </span>
                            <button
                              onClick={() => handleDeleteSlot(s.SlotID)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="ลบช่วงเวลานี้"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Reviews & Stats */}
        {activeTab === 'reviews' && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-sm">
                  <span>งานที่เสร็จสิ้น</span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-3xl font-bold text-emerald-600 mt-2">{completedCount}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-sm">
                  <span>งานที่ยกเลิก</span>
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-3xl font-bold text-red-500 mt-2">{cancelledCount}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-sm">
                  <span>คะแนนรีวิวเฉลี่ย</span>
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                </div>
                <p className="text-3xl font-bold text-slate-800 mt-2">{avgRating}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="font-bold text-base text-slate-800">ความคิดเห็นจากลูกค้า</h3>
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มีรีวิว</p>
              ) : (
                reviews.map((r) => (
                  <div key={r.ReviewID} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">
                        {r.Customers?.CustomerName || 'ลูกค้า'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> {r.Rating} / 5
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{r.Comment || '-'}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 4: ตั้งค่าบัญชีและโปรไฟล์ช่าง (ดีไซน์ 2 คอลัมน์ แยกส่วนชัดเจน) */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* คอลัมน์ซ้าย: การ์ดสรุปโปรไฟล์ช่างและเมนูย่อย */}
            <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="h-24 bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700" />
              <div className="px-6 pb-6">
                <div className="-mt-11 mb-3 flex items-end justify-between">
                  <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-md">
                    <div className="w-full h-full rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center text-2xl font-bold">
                      {avatarInitial}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 rounded-full">
                    <ShieldCheck className="w-3.5 h-3.5" /> {myTradeName}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-slate-800">{tech.TechnicianName}</h2>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {tech.TechnicianEmail}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5" /> รหัสช่าง
                    </span>
                    <span className="font-mono font-semibold text-slate-700">
                      {tech.TechnicianID}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> เบอร์ติดต่อ
                    </span>
                    <span className="font-medium text-slate-700">{tech.TechnicianPhone}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> พื้นที่จังหวัด
                    </span>
                    <span className="font-medium text-slate-700">{techProvinceName}</span>
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
                        ? 'bg-teal-50 text-teal-700 border border-teal-200 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>ข้อมูลส่วนตัวและบริการ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileSubTab('password');
                      setPwFeedback(null);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                      profileSubTab === 'password'
                        ? 'bg-teal-50 text-teal-700 border border-teal-200 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>เปลี่ยนรหัสผ่าน</span>
                  </button>
                </div>
              </div>
            </div>

            {/* คอลัมน์ขวา: เนื้อหาฟอร์ม */}
            <div className="lg:col-span-8 space-y-5">
              {/* แบนเนอร์แจ้งคำขอที่รอแอดมินยืนยันอยู่ */}
              {tech.pending_profile && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-2 text-sm shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      มีคำขอแก้ไขโปรไฟล์ที่กำลังรอแอดมินกดยืนยัน
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelPendingRequest}
                      disabled={savingProfile}
                      className="text-xs text-red-600 hover:underline font-semibold"
                    >
                      ยกเลิกคำขอนี้
                    </button>
                  </div>
                  <div className="text-xs text-amber-900 grid sm:grid-cols-2 gap-1.5 pl-5 pt-1">
                    <p>
                      <strong>ชื่อที่ขอเปลี่ยน:</strong> {tech.pending_profile.TechnicianName}
                    </p>
                    <p>
                      <strong>เบอร์โทร:</strong> {tech.pending_profile.TechnicianPhone}
                    </p>
                    <p>
                      <strong>จังหวัด:</strong> {tech.pending_profile.ProvinceName}
                    </p>
                    <p>
                      <strong>บริการที่รับทำ:</strong>{' '}
                      {tech.pending_profile.ServiceNames?.join(', ') || '-'}
                    </p>
                    <p className="sm:col-span-2">
                      <strong>ที่อยู่:</strong> {tech.pending_profile.Address}
                    </p>
                    {tech.pending_profile.TechnicianPassword && (
                      <p className="sm:col-span-2 text-amber-800 font-semibold">
                        * มีรายการขอเปลี่ยนรหัสผ่านใหม่รวมอยู่ด้วย
                      </p>
                    )}
                  </div>
                </div>
              )}

              {profileSubTab === 'info' ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
                  <div className="flex items-center gap-3 pb-5 mb-6 border-b border-slate-100">
                    <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600">
                      <UserCog className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">
                        แก้ไขข้อมูลส่วนตัวและงานที่รับทำ
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        หลังจากกรอกข้อมูลและกดส่งคำขอ ข้อมูลใหม่จะมีผลเมื่อแอดมินตรวจสอบและอนุมัติแล้ว
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

                  <form onSubmit={handleSubmitProfileInfoRequest} className="space-y-5">
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
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          จังหวัดพื้นที่ให้บริการ
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <select
                            required
                            value={editProvince}
                            onChange={(e) => setEditProvince(e.target.value)}
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                            value={tech.TechnicianEmail}
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        บริการที่รับทำในสายงาน{myTradeName} (เลือกได้หลายรายการ)
                      </label>
                      <div className="grid sm:grid-cols-2 gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        {tradeSubCategories.map((sub) => {
                          const checked = editCategoryIds.includes(sub.CategoryID);
                          return (
                            <label
                              key={sub.CategoryID}
                              className={`flex items-center justify-between p-2.5 rounded-lg border text-sm cursor-pointer transition ${
                                checked
                                  ? 'bg-teal-50 border-teal-500 text-teal-900 font-medium'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-teal-300'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleEditCategory(sub.CategoryID)}
                                  className="rounded text-teal-600 focus:ring-teal-500"
                                />
                                {sub.CategoryName}
                              </span>
                              <span className="text-xs text-slate-500">
                                {sub.CategoryPrice.toLocaleString()} ฿
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        ที่อยู่ปัจจุบัน
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-60"
                      >
                        {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                        ส่งคำขอแก้ไขข้อมูลส่วนตัว
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
                        กรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่ เพื่อส่งคำขออนุมัติเปลี่ยนรหัสผ่านไปยังแอดมิน
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

                  <form onSubmit={handleSubmitPasswordRequest} className="space-y-4 max-w-md">
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
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                        className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-60"
                      >
                        {savingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                        ส่งคำขอเปลี่ยนรหัสผ่าน
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}