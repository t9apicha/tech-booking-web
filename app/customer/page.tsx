'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db, getSession, clearSession } from '@/lib/supabase';
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
} from 'lucide-react';

interface CustomerUser {
  CustomerID: string;
  CustomerName: string;
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

interface TechnicianItem {
  TechnicianID: string;
  TechnicianName: string;
  TechnicianPhone: string;
  Address: string;
  TechnicianSlots: SlotItem[];
  Reviews: { Rating: number }[];
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
  const [activeTab, setActiveTab] = useState<'book' | 'jobs'>('book');

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

    async function loadInitial() {
      const { data: provs } = await db.from('Provinces').select('*');
      if (provs) setProvinces(provs);
      const { data: cats } = await db.from('ServiceCategories').select('*');
      if (cats) setCategories(cats as ServiceCategory[]);
    }
    loadInitial();
  }, [router]);

  // ดึงหมวดหมู่ช่างหลัก (ช่างแอร์, ช่างประปา, ช่างไฟฟ้า)
  const mainCategories = Array.from(
    new Set(categories.map((c) => c.MainCategory).filter(Boolean))
  );

  // กรองรายการบริการย่อยภายใต้หมวดหมู่หลักที่เลือก
  const subCategories = categories.filter((c) => c.MainCategory === selectedMainCategory);

  // ค้นหาช่างทั้งหมดในจังหวัดนั้นที่อยู่ในสายงานหลักเดียวกัน (เช่น ช่างแอร์ทุกคนรับงานย่อยในหมวดแอร์ได้)
  useEffect(() => {
    async function findTechnicians() {
      if (!selectedProvince || !selectedMainCategory || !selectedCategory) {
        setTechnicians([]);
        return;
      }
      setSearchingTech(true);
      setChosenTech(null);
      setChosenSlot(null);

      const relatedCategoryIds = categories
        .filter((c) => c.MainCategory === selectedMainCategory)
        .map((c) => c.CategoryID);

      const { data } = await db
        .from('Technicians')
        .select('*, TechnicianSlots(*), Reviews(Rating)')
        .eq('ProvinceID', selectedProvince)
        .in('CategoryID', relatedCategoryIds)
        .eq('approved', true);

      setTechnicians((data as TechnicianItem[]) || []);
      setSearchingTech(false);
    }
    findTechnicians();
  }, [selectedProvince, selectedMainCategory, selectedCategory, categories]);

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Navbar */}
      <header className="bg-blue-700 text-white px-6 py-4 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Wrench className="w-6 h-6" />
            <span className="font-bold text-lg">ระบบจ้างช่างออนไลน์</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-blue-100">สวัสดี, {user.CustomerName}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-blue-800 hover:bg-blue-900 px-3 py-1.5 rounded-lg text-sm transition"
            >
              <LogOut className="w-4 h-4" /> ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {/* เมนูสลับหน้า */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('book')}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition ${
              activeTab === 'book'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            + จ้างช่างใหม่
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition ${
              activeTab === 'jobs'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            รายการจ้างงาน & สถานะ
          </button>
        </div>

        {activeTab === 'book' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            {/* ขั้นตอน 1: เลือกจังหวัด และ ประเภทช่างหลัก */}
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
                  className="w-full md:w-1/2 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white"
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

            {/* ขั้นตอน 2: เลือกบริการย่อยภายใต้ประเภทช่างที่เลือก */}
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
                    บริการที่เลือก: {currentCategoryObj.MainCategory} ({currentCategoryObj.CategoryName}) — ราคามาตรฐาน {currentCategoryObj.CategoryPrice.toLocaleString()} บาท
                  </div>
                )}
              </div>
            )}

            {/* ขั้นตอน 3: เลือกช่างและคิวเวลาว่าง */}
            {selectedProvince && selectedMainCategory && selectedCategory && (
              <div className="border-t border-slate-200 pt-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4">
                  3. เลือก{selectedMainCategory}และตารางเวลาที่ว่าง
                </h2>
                {searchingTech ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin" /> กำลังค้นหาช่างในพื้นที่...
                  </div>
                ) : technicians.length === 0 ? (
                  <p className="text-slate-500 bg-slate-50 p-4 rounded-xl">
                    ยังไม่มี{selectedMainCategory}ที่เปิดให้บริการในจังหวัดนี้
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

            {/* ขั้นตอน 4: กรอกที่อยู่และอาการเสีย */}
            {chosenTech && chosenSlot && (
              <form onSubmit={handleConfirmBooking} className="border-t border-slate-200 pt-6 space-y-4">
                <h2 className="text-lg font-bold text-slate-800">4. ยืนยันรายละเอียดหน้างาน</h2>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
                  คุณเลือก: <strong>{chosenTech.name}</strong> | นัดหมาย: <strong>{chosenSlot.label}</strong>
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
        ) : (
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
                        <CreditCard className="w-4 h-4" /> ชำระเงิน ({job.PaymentAmount.toLocaleString()} บาท)
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
              <label className="block text-sm font-medium text-slate-700 mb-1">ความคิดเห็นเพิ่มเติม</label>
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