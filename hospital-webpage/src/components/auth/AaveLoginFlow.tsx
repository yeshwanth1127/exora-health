import { HospitalLogo } from '../common/HospitalLogo';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUpRight } from 'lucide-react';

export type LoginStep = 'welcome' | 'otp' | 'password' | 'customize' | 'success';

interface AaveLoginFlowProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: LoginStep;
  brandTitle?: string;
  welcomeDescription?: string;
  welcomeNote?: string;
}

const AVATAR_THEMES = [
  { bg: '#E5E7EB', face: '#CBD0D8' },
  { bg: '#eef7f2', face: '#154734' },
  { bg: '#E0F2FE', face: '#38BDF8' },
  { bg: '#FEF3C7', face: '#F59E0B' },
];

export const AaveLoginFlow: React.FC<AaveLoginFlowProps> = ({
  isOpen,
  onClose,
  initialStep = 'welcome',
  brandTitle = 'Sri Lakshmi Hospital',
  welcomeDescription = 'Explore the proposed patient sign-in experience.',
  welcomeNote = 'Patient accounts are not available yet. This does not create an account or connect to medical records.',
}) => {
  const [step, setStep] = useState<LoginStep>(initialStep);
  const [identifier, setIdentifier] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [activeOtpIndex, setActiveOtpIndex] = useState(0);
  const [password, setPassword] = useState('');
  const [accountName, setAccountName] = useState('My Account');
  const [avatarIndex, setAvatarIndex] = useState(0);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleResendOtp = () => {
    setOtpDigits(['', '', '', '', '', '']);
    setActiveOtpIndex(0);
    otpInputRefs.current[0]?.focus();
  };

  // OTP Input logic
  const handleOtpChange = (index: number, value: string) => {
    // Take only the last entered char if multiple, or first if single
    const cleanVal = value.replace(/[^0-9]/g, '');
    const char = cleanVal.slice(-1);

    const nextDigits = [...otpDigits];
    nextDigits[index] = char;
    setOtpDigits(nextDigits);

    if (char && index < 5) {
      setActiveOtpIndex(index + 1);
      otpInputRefs.current[index + 1]?.focus();
    }

    // If all digits entered, auto-advance to set password step
    if (char && index === 5 && nextDigits.every((d) => d !== '')) {
      setTimeout(() => {
        setStep('password');
      }, 300);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const nextDigits = [...otpDigits];
        nextDigits[index - 1] = '';
        setOtpDigits(nextDigits);
        setActiveOtpIndex(index - 1);
        otpInputRefs.current[index - 1]?.focus();
      } else {
        const nextDigits = [...otpDigits];
        nextDigits[index] = '';
        setOtpDigits(nextDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      setActiveOtpIndex(index - 1);
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      setActiveOtpIndex(index + 1);
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (!pastedData) return;

    const nextDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      nextDigits[i] = pastedData[i] || '';
    }
    setOtpDigits(nextDigits);

    const nextFocusIndex = Math.min(pastedData.length, 5);
    setActiveOtpIndex(nextFocusIndex);
    otpInputRefs.current[nextFocusIndex]?.focus();

    if (pastedData.length === 6) {
      setTimeout(() => {
        setStep('password');
      }, 300);
    }
  };

  const handleFinishLogin = () => {
    // No authentication provider is connected yet.
    setStep('success');
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  // Allow external navigation or testing via custom event
  useEffect(() => {
    const handleStepEvent = (e: CustomEvent) => {
      if (!e.detail) return;
      if (e.detail === 'welcome-empty') {
        setStep('welcome');
        setIdentifier('');
      } else if (e.detail === 'welcome-active') {
        setStep('welcome');
        setIdentifier('8217286695');
      } else if (['welcome', 'otp', 'password', 'customize', 'success'].includes(e.detail)) {
        setStep(e.detail as LoginStep);
      }
    };
    window.addEventListener('set-login-step' as any, handleStepEvent);
    return () => window.removeEventListener('set-login-step' as any, handleStepEvent);
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-white overflow-y-auto flex flex-col justify-between selection:bg-[#154734]/20 selection:text-[#121212] [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Helvetica,Arial,sans-serif]"
      >
        {/* Subtle Close Button top-right */}
        <div className="fixed top-4 right-4 z-20">
          <button
            onClick={onClose}
            aria-label="Close login"
            className="size-11 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-900 flex items-center justify-center transition cursor-pointer"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* Central Interactive Content Area */}
        <main className="w-full flex-1 flex flex-col items-center justify-center px-4 pt-20 pb-8 sm:py-20">
          <div className="w-full max-w-[400px] flex flex-col items-center text-center">
            <p role="status" className="mb-6 rounded-xl border border-[#dce9df] bg-[#eef5eb] px-4 py-3 text-sm text-[#315943]">Sample sign-in only. No SMS is sent, no account is created, and no password is saved. Please use sample details.</p>
            
            {/* ========================================================= */}
            {/* STEP 1 & 1B: WELCOME TO AAVE ACCOUNT                      */}
            {/* ========================================================= */}
            {step === 'welcome' && (
              <motion.div
                key="welcome-step"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="w-full flex flex-col items-center"
              >
                {/* Medical Clinic Emblem matching exact dimensions */}
                <div className="mb-6 flex justify-center items-center">
                  <HospitalLogo className="size-12" />
                </div>

                {/* Title & Subtitle */}
                <h1 className="text-[22px] sm:text-[24px] font-semibold text-[#121212] tracking-tight leading-tight">
                  Welcome to {brandTitle}
                </h1>
                <p className="text-[15px] text-[#71717A] mt-1.5 font-normal">
                  {welcomeDescription}
                </p>

                {/* Form Inputs Container */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (identifier.trim()) {
                      setStep('otp');
                    }
                  }}
                  className="w-full mt-7 flex flex-col items-center"
                >
                  {/* Email or Phone Number Input */}
                  <div className="w-full relative">
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Mobile Number or Patient ID"
                      className={`w-full h-[52px] px-4 rounded-[14px] text-[15px] font-normal transition-all outline-none ${
                        identifier.trim()
                          ? 'bg-[#fcfbf9] text-[#121212] border-2 border-[#154734] shadow-[0_0_0_3px_rgba(139,142,255,0.12)]'
                          : 'bg-[#f6f4ef] text-[#121212] border-2 border-transparent placeholder-[#9CA3AF] focus:bg-[#fcfbf9] focus:border-[#154734] focus:shadow-[0_0_0_3px_rgba(139,142,255,0.12)]'
                      }`}
                    />
                  </div>

                  {/* Dynamic Transition between Step 1 (Empty) and Step 1b (Filled) */}
                  <AnimatePresence mode="wait">
                    {!identifier.trim() ? (
                      /* Step 1 Initial: Helper Note */
                      <motion.p
                        key="initial-note"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-[13px] sm:text-[14px] text-[#71717A] mt-7"
                      >
                        {welcomeNote}
                      </motion.p>
                    ) : (
                      /* Step 1b Active: Continue Button & SMS Disclaimer */
                      <motion.div
                        key="active-cta"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.18 }}
                        className="w-full flex flex-col items-center mt-4"
                      >
                        <button
                          type="submit"
                          className="w-full h-[50px] bg-[#154734] hover:bg-[#7D80FA] active:scale-[0.99] text-white font-medium text-[15px] rounded-[14px] shadow-xs transition cursor-pointer flex items-center justify-center"
                        >
                          Continue
                        </button>

                        <p className="text-[13px] text-[#71717A] leading-relaxed text-center mt-5 px-3">
                          This demo uses a sample code. No SMS is sent and no medical records are accessed.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>
              </motion.div>
            )}

            {/* ========================================================= */}
            {/* STEP 2: VERIFICATION CODE (OTP)                           */}
            {/* ========================================================= */}
            {step === 'otp' && (
              <motion.div
                key="otp-step"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="w-full flex flex-col items-center"
              >
                {/* Smartphone Badge Icon */}
                <div className="size-13 sm:size-14 rounded-full bg-[#eef7f2] flex items-center justify-center mb-6">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#7C75FA"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="14" height="20" x="5" y="2" rx="3" ry="3" />
                    <path d="M12 18h.01" strokeWidth="2.5" />
                  </svg>
                </div>

                <h1 className="text-[22px] sm:text-[24px] font-semibold text-[#121212] tracking-tight leading-tight">
                  Try the demo verification step
                </h1>
                <p className="text-[15px] text-[#71717A] mt-1.5 font-normal">
                  No text was sent. Enter any six digits to continue.
                </p>

                {/* 6 Digit Input Group: [0][0][0] - [0][0][0] */}
                <div className="flex items-center justify-center gap-2 sm:gap-2.5 mt-8 w-full">
                  {/* First 3 Digits */}
                  {[0, 1, 2].map((idx) => {
                    const isFocused = activeOtpIndex === idx;
                    const val = otpDigits[idx];
                    return (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpInputRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={val}
                        placeholder="0"
                        onFocus={() => setActiveOtpIndex(idx)}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        onPaste={handleOtpPaste}
                        className={`min-w-0 flex-1 max-w-11 h-14 sm:max-w-13 sm:h-15 text-center text-xl sm:text-2xl font-semibold rounded-[16px] outline-none transition-all placeholder-[#CBD0D8] ${
                          isFocused
                            ? 'border-2 border-[#154734] bg-[#fcfbf9] text-[#121212] shadow-[0_0_0_3px_rgba(139,142,255,0.14)]'
                            : 'border-2 border-transparent bg-[#f6f4ef] text-[#121212]'
                        }`}
                      />
                    );
                  })}

                  {/* Middle Hyphen */}
                  <span className="text-[#374151] text-lg font-medium select-none px-0.5">
                    -
                  </span>

                  {/* Last 3 Digits */}
                  {[3, 4, 5].map((idx) => {
                    const isFocused = activeOtpIndex === idx;
                    const val = otpDigits[idx];
                    return (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpInputRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={val}
                        placeholder="0"
                        onFocus={() => setActiveOtpIndex(idx)}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        onPaste={handleOtpPaste}
                        className={`min-w-0 flex-1 max-w-11 h-14 sm:max-w-13 sm:h-15 text-center text-xl sm:text-2xl font-semibold rounded-[16px] outline-none transition-all placeholder-[#CBD0D8] ${
                          isFocused
                            ? 'border-2 border-[#154734] bg-[#fcfbf9] text-[#121212] shadow-[0_0_0_3px_rgba(139,142,255,0.14)]'
                            : 'border-2 border-transparent bg-[#f6f4ef] text-[#121212]'
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Resend Action */}
                <div className="mt-8 text-[14px] text-[#71717A] flex items-center justify-center gap-1">
                  <span>Want to try again?</span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="font-semibold text-[#121212] hover:underline transition cursor-pointer"
                  >
                    Reset demo code
                  </button>
                </div>
              </motion.div>
            )}

            {/* ========================================================= */}
            {/* STEP 3: SET PASSWORD                                     */}
            {/* ========================================================= */}
            {step === 'password' && (
              <motion.div
                key="password-step"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="w-full flex flex-col items-center"
              >
                {/* Lock Badge Icon */}
                <div className="size-13 sm:size-14 rounded-full bg-[#eef7f2] flex items-center justify-center mb-6">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#7C75FA"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="16" height="11" x="4" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>

                <h1 className="text-[22px] sm:text-[24px] font-semibold text-[#121212] tracking-tight leading-tight">
                  Sample password step
                </h1>
                <p className="text-[15px] text-[#71717A] mt-1.5 font-normal">
                  Use a sample password to explore this screen. Do not enter a real password.
                </p>

                {/* Password Input with 1:1 Autofill Key Capsule */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (password.length >= 8) {
                      setStep('customize');
                    }
                  }}
                  className="w-full mt-7 flex flex-col items-center"
                >
                  <div className="w-full relative flex items-center">
                    <input
                      type="password"
                      autoComplete="off"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      autoFocus
                      className="w-full h-[54px] pl-4 pr-16 rounded-[14px] text-[15px] font-normal transition-all outline-none bg-[#fcfbf9] text-[#121212] border-2 border-[#154734] shadow-[0_0_0_3px_rgba(139,142,255,0.12)] placeholder-[#9CA3AF]"
                    />

                    {/* Right Autofill Key Badge: Pill with key + down chevron */}
                    <div className="absolute right-3 flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#E4E4E7] text-[#3F3F46] select-none pointer-events-none">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7 14C5.9 14 5 13.1 5 12C5 10.9 5.9 10 7 10C8.1 10 9 10.9 9 12C9 13.1 8.1 14 7 14ZM12.6 10C11.8 7.6 9.6 6 7 6C3.7 6 1 8.7 1 12C1 15.3 3.7 18 7 18C9.6 18 11.8 16.4 12.6 14H16V18H20V14H23V10H12.6Z" />
                      </svg>
                      <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>

                  {/* Requirements Explanation (2 lines) */}
                  <p className="text-[13px] sm:text-[14px] text-[#71717A] leading-relaxed text-center mt-4 max-w-[340px]">
                    Min. 8 characters including an upper and lowercase letter, digit and a symbol.
                  </p>

                  {/* Continue Button (revealed on typing) */}
                  {password.length > 0 && (
                    <button
                      type="submit"
                      className="w-full h-[50px] bg-[#154734] hover:bg-[#7D80FA] active:scale-[0.99] text-white font-medium text-[15px] rounded-[14px] shadow-xs transition cursor-pointer mt-5 flex items-center justify-center"
                    >
                      Continue
                    </button>
                  )}
                </form>
              </motion.div>
            )}

            {/* ========================================================= */}
            {/* STEP 4: CUSTOMIZE YOUR ACCOUNT                            */}
            {/* ========================================================= */}
            {step === 'customize' && (
              <motion.div
                key="customize-step"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="w-full flex flex-col items-center"
              >
                {/* Pencil Badge Icon */}
                <div className="size-13 sm:size-14 rounded-full bg-[#eef7f2] flex items-center justify-center mb-6">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#7C75FA"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                </div>

                <h1 className="text-[22px] sm:text-[24px] font-semibold text-[#121212] tracking-tight leading-tight">
                  Customize your Patient Profile
                </h1>
                <p className="text-[15px] text-[#71717A] mt-1.5 font-normal">
                  Choose your care avatar and patient name
                </p>

                {/* Big Avatar Card (1:1 with media_1790052883983.png) */}
                <div className="w-full h-[210px] sm:h-[230px] rounded-[24px] border border-[#E5E7EB] bg-white mt-6 flex items-center justify-center relative select-none">
                  <div className="relative group cursor-pointer" onClick={() => setAvatarIndex((i) => (i + 1) % 4)}>
                    {/* Big Circular Avatar Placeholder */}
                    <div
                      style={{ backgroundColor: AVATAR_THEMES[avatarIndex].bg }}
                      className="size-[136px] rounded-full flex items-center justify-center transition-all group-hover:scale-[1.01]"
                    >
                      {/* Character Face */}
                      <svg
                        width="84"
                        height="64"
                        viewBox="0 0 84 64"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="select-none transition-colors"
                      >
                        <path
                          d="M14 50C14 26 26.5 12 42 12C57.5 12 70 26 70 50"
                          stroke={AVATAR_THEMES[avatarIndex].face}
                          strokeWidth="11"
                          strokeLinecap="round"
                        />
                        <circle cx="31" cy="46" r="6" fill={AVATAR_THEMES[avatarIndex].face} />
                        <circle cx="53" cy="46" r="6" fill={AVATAR_THEMES[avatarIndex].face} />
                      </svg>
                    </div>

                    {/* Bottom-right Three Dots Badge Button */}
                    <div className="absolute bottom-0 right-0 size-8 rounded-full bg-white border border-[#E5E7EB] shadow-xs flex items-center justify-center text-[#71717A] hover:text-[#121212] transition">
                      <span className="text-[12px] tracking-widest font-bold leading-none mb-0.5 text-stone-500">•••</span>
                    </div>
                  </div>
                </div>

                {/* Account Name Input Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleFinishLogin();
                  }}
                  className="w-full mt-6 flex flex-col items-start text-left"
                >
                  <label className="text-[14px] font-medium text-[#374151] mb-2 pl-0.5">
                    Patient Name
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Patient Name"
                    className="w-full h-[52px] px-4 rounded-[14px] text-[15px] font-normal bg-[#f6f4ef] text-[#121212] border-2 border-transparent placeholder-[#9CA3AF] focus:bg-[#fcfbf9] focus:border-[#154734] focus:shadow-[0_0_0_3px_rgba(139,142,255,0.12)] transition outline-none"
                  />

                  {/* Continue Button */}
                  <button
                    type="submit"
                    className="w-full h-[52px] bg-[#154734] hover:bg-[#7D80FA] active:scale-[0.99] text-white font-medium text-[15px] rounded-[14px] shadow-xs transition cursor-pointer mt-5 flex items-center justify-center"
                  >
                    Continue
                  </button>
                </form>

                {/* Skip for now Action */}
                <div className="mt-6 text-[14px] text-[#71717A] flex items-center justify-center gap-1.5">
                  <span>Don't want to customize right now?</span>
                  <button
                    type="button"
                    onClick={handleFinishLogin}
                    className="font-medium text-[#121212] underline underline-offset-2 hover:text-black transition cursor-pointer"
                  >
                    Skip for now
                  </button>
                </div>
              </motion.div>
            )}

            {/* ========================================================= */}
            {/* STEP 5: SUCCESS STATE                                     */}
            {/* ========================================================= */}
            {step === 'success' && (
              <motion.div
                key="success-step"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full py-12 flex flex-col items-center"
              >
                <div className="size-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                  <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#121212]">Sample sign-in complete</h2>
                <p className="text-stone-500 mt-2 text-sm">No account was created or signed in.</p>
              </motion.div>
            )}

          </div>
        </main>

        {/* Bottom Floating Pill & Footer Navigation Links */}
        <footer className="w-full flex flex-col items-center px-4 pb-6 pt-2">
          {/* Capsule Banner: Hospital Clinic Locations */}
          <div className="inline-flex items-center justify-between gap-3 sm:gap-4 pl-4 sm:pl-5 pr-2 py-1.5 rounded-full border border-stone-200/80 bg-white shadow-xs max-w-[440px] w-full mb-6">
            <span className="text-[13px] sm:text-[14px] font-normal text-[#121212] tracking-tight">
              Explore our clinic locations
            </span>
            <a
              href="/?page=locations"
              onClick={(e) => {
                e.preventDefault();
                onClose();
                window.location.assign('/?page=locations');
              }}
              className="inline-flex items-center gap-1 bg-[#f6f4ef] hover:bg-[#EAEAF0] text-[#121212] text-xs sm:text-[13px] font-medium px-3 py-1.5 rounded-full transition cursor-pointer shrink-0"
            >
              View Clinics <ArrowUpRight className="size-3.5" />
            </a>
          </div>

          {/* Links: Clinical Standards • Patient Privacy • Terms of Care */}
          <div className="flex items-center justify-center gap-3 text-[13px] text-[#71717A] select-none">
            <a href="/?page=faq" className="hover:text-[#121212] transition">
              FAQs
            </a>
            <span className="text-stone-300 text-[10px]">•</span>
            <a href="/?page=legal&doc=privacy" className="hover:text-[#121212] transition">
              Patient Privacy
            </a>
            <span className="text-stone-300 text-[10px]">•</span>
            <a href="/?page=legal&doc=terms" className="hover:text-[#121212] transition">
              Terms of Care
            </a>
          </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
};
