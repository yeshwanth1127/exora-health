import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { authApi } from '../../lib/auth';

export type LoginStep = 'welcome' | 'otp' | 'password' | 'customize' | 'success';

interface AaveLoginFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (userData: { identifier: string; name: string }) => void;
  initialStep?: LoginStep;
  brandTitle?: string;
  welcomeDescription?: string;
  welcomeNote?: string;
}

export function AaveLoginFlow({ isOpen, onClose, onLoginSuccess,
  brandTitle = 'Avocado Patient Portal',
  welcomeDescription = 'Sign in to access your appointments, Virtual OPD, medical records, and care team.',
  welcomeNote = 'Use the email address registered with the hospital.',
}: AaveLoginFlowProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const actor = await authApi.login(email, password);
      if (actor.role !== 'patient') throw new Error('Use a patient account on this portal.');
      onLoginSuccess?.({ identifier: email, name: actor.display_name });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.');
    } finally { setLoading(false); }
  };

  return <AnimatePresence>{isOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-[#f6f4ef] grid place-items-center p-5">
    <button onClick={onClose} aria-label="Close login" className="absolute top-6 right-6 size-10 rounded-full bg-white border grid place-items-center"><X className="size-4" /></button>
    <motion.form initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onSubmit={submit} className="w-full max-w-md bg-white border border-[#dfe5df] rounded-[28px] p-8 sm:p-10 shadow-xl">
      <div className="size-12 rounded-2xl bg-[#154734] text-white grid place-items-center"><ShieldCheck className="size-6" /></div>
      <h1 className="mt-6 text-3xl font-semibold">{brandTitle}</h1>
      <p className="mt-2 text-sm leading-6 text-[#66756d]">{welcomeDescription}</p>
      <label className="block mt-7 text-sm font-semibold">Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" autoFocus required className="mt-2 w-full h-12 rounded-xl border px-4 font-normal" /></label>
      <label className="block mt-4 text-sm font-semibold">Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required className="mt-2 w-full h-12 rounded-xl border px-4 font-normal" /></label>
      {error && <p role="alert" className="mt-4 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
      <button disabled={loading} className="mt-5 w-full h-12 rounded-xl bg-[#154734] text-white font-semibold flex justify-center items-center gap-2 disabled:opacity-60">{loading && <Loader2 className="size-4 animate-spin" />}Sign in</button>
      <p className="mt-5 text-xs text-[#718078]">{welcomeNote} Contact the hospital if you need account activation or recovery.</p>
    </motion.form>
  </motion.div>}</AnimatePresence>;
}
