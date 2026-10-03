import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Calendar, Clock, Star, MessageSquare, ShieldCheck } from 'lucide-react';
import { doctors } from '../../data/doctors';
import { departments } from '../../data/departments';
import { Doctor } from '../../types';
import { hospitalInfo } from '../../data/hospitalInfo';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedDoctorId?: string;
  preselectedPackageName?: string;
  preselectedDate?: string;
  preselectedSlot?: string;
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({ 
  isOpen, 
  onClose, 
  preselectedDoctorId,
  preselectedPackageName,
  preselectedDate,
  preselectedSlot,
}) => {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(
    doctors.find(d => d.id === preselectedDoctorId) || doctors[0]
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    preselectedDate || new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [selectedSlot, setSelectedSlot] = useState<string>(preselectedSlot || '10:30 AM');
  const [consultationType, setConsultationType] = useState<'In-person' | 'Virtual Video'>('Virtual Video');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [reason, setReason] = useState(preselectedPackageName ? `Health Check: ${preselectedPackageName}` : '');
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (preselectedPackageName) {
      setReason(`Health Check: ${preselectedPackageName}`);
    }
  }, [preselectedPackageName]);

  useEffect(() => {
    if (preselectedDate) setSelectedDate(preselectedDate);
    if (preselectedSlot) setSelectedSlot(preselectedSlot);
  }, [preselectedDate, preselectedSlot]);

  useEffect(() => {
    if (preselectedDoctorId) {
      const doc = doctors.find(d => d.id === preselectedDoctorId);
      if (doc) setSelectedDoctor(doc);
    }
  }, [preselectedDoctorId]);

  if (!isOpen) return null;

  const filteredDoctors = selectedDepartment === 'all'
    ? doctors
    : doctors.filter(d => d.departmentId === selectedDepartment);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  const handleSendWhatsAppConfirmation = () => {
    if (!selectedDoctor) return;
    const msg = `Appointment Confirmation Request:
Patient: ${patientName || 'Patient'}
Phone: ${patientPhone}
Doctor: ${selectedDoctor.name} (${selectedDoctor.departmentName})
Type: ${consultationType}
Date: ${selectedDate} at ${selectedSlot}
Reason: ${reason || 'General Consultation'}`;
    const url = `https://wa.me/${hospitalInfo.whatsappNumber}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-[#154734] px-6 py-5 text-white flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">Book a Doctor Consultation</div>
            <div className="text-xs text-emerald-200">Avocado Health Verified Specialists</div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {isSubmitted ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-stone-900">Appointment Confirmed!</h3>
              <p className="text-sm text-stone-600 max-w-md mx-auto">
                Your appointment with <span className="font-semibold text-stone-800">{selectedDoctor?.name}</span> is scheduled for <span className="font-semibold text-stone-800">{selectedDate}</span> at <span className="font-semibold text-stone-800">{selectedSlot}</span> ({consultationType}).
              </p>

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 max-w-md mx-auto text-left text-xs space-y-1.5 text-emerald-950">
                <div><span className="font-semibold">Patient Name:</span> {patientName}</div>
                <div><span className="font-semibold">Phone:</span> {patientPhone}</div>
                <div><span className="font-semibold">Consultation Fee:</span> ₹{selectedDoctor?.consultationFee}</div>
                <div><span className="font-semibold">Location / Room:</span> {selectedDoctor?.roomNumber}</div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
                <button
                  onClick={handleSendWhatsAppConfirmation}
                  className="bg-[#25D366] hover:bg-[#20ba59] text-white px-6 py-2.5 rounded-full font-semibold text-xs inline-flex items-center justify-center gap-2 shadow-md transition"
                >
                  <MessageSquare className="w-4 h-4 fill-current" />
                  Send to WhatsApp
                </button>
                <button
                  onClick={() => {
                    setIsSubmitted(false);
                    onClose();
                  }}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-800 px-6 py-2.5 rounded-full font-semibold text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {preselectedPackageName && (
                <div className="bg-[#eaf3ed] border border-emerald-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-[#154734]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div>
                      <span className="font-semibold">Selected Health Check: </span>
                      <span className="font-bold">{preselectedPackageName}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-white px-2.5 py-0.5 rounded-full border border-emerald-300 text-emerald-800 shrink-0">
                    Health Package
                  </span>
                </div>
              )}

              {/* Consultation Type Toggle */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                  1. Choose Consultation Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setConsultationType('Virtual Video')}
                    className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 ${
                      consultationType === 'Virtual Video'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      📱
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-stone-900">Online Video Visit</div>
                      <div className="text-[11px] text-stone-500">From home on your phone/laptop</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConsultationType('In-person')}
                    className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 ${
                      consultationType === 'In-person'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#eef7f2] text-[#154734] flex items-center justify-center font-bold">
                      🏥
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-stone-900">Hospital In-Person</div>
                      <div className="text-[11px] text-stone-500">Physical OPD consultation</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Department Filter & Doctor Selection */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                  2. Select Specialty & Doctor
                </label>
                
                {/* Specialty Badges */}
                <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setSelectedDepartment('all')}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
                      selectedDepartment === 'all'
                        ? 'bg-[#154734] text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    All Specialties
                  </button>
                  {departments.map((dept) => (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => setSelectedDepartment(dept.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
                        selectedDepartment === dept.id
                          ? 'bg-[#154734] text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {dept.name.split('&')[0]}
                    </button>
                  ))}
                </div>

                {/* Doctor Selection Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3 max-h-48 overflow-y-auto p-1">
                  {filteredDoctors.map((doc) => {
                    const isSelected = selectedDoctor?.id === doc.id;
                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDoctor(doc)}
                        className={`p-3 rounded-2xl border cursor-pointer transition flex items-center gap-3 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                            : 'border-stone-200 hover:border-stone-300 bg-white'
                        }`}
                      >
                        <img
                          src={doc.image}
                          alt={doc.name}
                          className="w-12 h-12 rounded-full object-cover border border-emerald-200 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-stone-900 truncate">{doc.name}</div>
                          <div className="text-[11px] text-emerald-700 truncate">{doc.departmentName}</div>
                          <div className="flex items-center gap-2 text-[10px] text-stone-500 mt-0.5">
                            <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                              <Star className="w-3 h-3 fill-current" /> {doc.rating}
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-stone-700">₹{doc.consultationFee}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Date & Time Slot Picker */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                  3. Select Date & Slot
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-stone-500 mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Date
                    </div>
                    <input
                      type="date"
                      required
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <div className="text-[11px] text-stone-500 mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Time Slot
                    </div>
                    <select
                      value={selectedSlot}
                      onChange={(e) => setSelectedSlot(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
                    >
                      {selectedDoctor?.timeSlots.map((slot) => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Patient Details */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                  4. Patient Contact
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Full Name *"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Phone / WhatsApp Number *"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Primary symptom or reason for visit (e.g. flu, rash, joint pain)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full mt-2 px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              {/* Submit CTA */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-full text-xs font-medium text-stone-600 hover:bg-stone-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-7 py-2.5 rounded-full text-xs font-semibold text-white bg-[#154734] hover:bg-[#103828] shadow-lg hover:shadow-xl transition"
                >
                  Confirm Appointment
                </button>
              </div>

            </form>
          )}
        </div>

      </div>
    </div>
  );
};
