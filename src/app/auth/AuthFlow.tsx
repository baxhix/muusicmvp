'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthSuccessMap from './AuthSuccessMap';
import styles from './auth.module.css';

type Method = 'email' | 'phone' | 'google' | 'apple';
type Mode = 'signup' | 'login';
type Step = 'method' | 'identifier' | 'otp' | 'profile' | 'terms' | 'success';

const SIGNUP_STEPS: Step[] = ['method', 'otp', 'profile', 'terms', 'success'];
const LOGIN_STEPS: Step[] = ['method', 'success'];

export default function AuthFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const initialMode = (params.get('mode') === 'login' ? 'login' : 'signup') as Mode;

  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>('method');
  const [method, setMethod] = useState<Method | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedMinor, setAgreedMinor] = useState(false);
  const [shareLocation, setShareLocation] = useState(true);
  const [resendIn, setResendIn] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const stepsList = mode === 'signup' ? SIGNUP_STEPS : LOGIN_STEPS;
  const stepIdx = stepsList.indexOf(step);

  const tryExit = useCallback(() => {
    const dirty =
      step !== 'method' &&
      step !== 'success' &&
      (identifier.length > 0 || name.length > 0 || otp.some(Boolean));
    if (!dirty || window.confirm('Tem certeza que quer sair? Você vai perder o progresso.')) {
      router.push('/');
    }
  }, [step, identifier, name, otp, router]);

  // ESC closes
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') tryExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tryExit]);

  // Resend countdown
  useEffect(() => {
    if (step !== 'otp') return;
    setResendIn(30);
    const id = setInterval(() => {
      setResendIn((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [step, identifier]);

  // Focus first OTP box when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      const t = setTimeout(() => otpRefs.current[0]?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [step]);

  const age = useMemo(() => {
    if (!birthdate) return null;
    const d = new Date(birthdate);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
    return a;
  }, [birthdate]);

  const isMinor = age !== null && age < 18 && age >= 13;
  const tooYoung = age !== null && age < 13;

  const maskedIdentifier = useMemo(() => {
    if (method === 'email') {
      const [user, domain] = identifier.split('@');
      if (!user || !domain) return identifier;
      const masked =
        user.length <= 2
          ? user[0] + '*'
          : user[0] + '*'.repeat(Math.max(1, user.length - 2)) + user.slice(-1);
      return `${masked}@${domain}`;
    }
    if (method === 'phone') {
      const digits = identifier.replace(/\D/g, '');
      if (digits.length < 4) return identifier;
      return '••• ••' + digits.slice(-4).replace(/(\d{2})(\d{2})/, '$1-$2');
    }
    return identifier;
  }, [identifier, method]);

  const goBack = () => {
    setError(null);
    const idx = stepsList.indexOf(step);
    if (idx > 0) setStep(stepsList[idx - 1]);
    else tryExit();
  };

  const goNext = () => {
    setError(null);
    const idx = stepsList.indexOf(step);
    if (idx < stepsList.length - 1) setStep(stepsList[idx + 1]);
  };

  const pickMethod = (m: Method) => {
    setMethod(m);
    if (m === 'google' || m === 'apple') {
      if (mode === 'signup') {
        setIdentifier(`${m}-mock@fanverse.app`);
        setStep('profile');
      } else {
        finishAuth();
      }
      return;
    }
    setStep('identifier');
  };

  const validateIdentifier = (): boolean => {
    if (method === 'email') {
      const ok = /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(identifier.trim());
      if (!ok) {
        setError('Esse e-mail não parece válido. Pode conferir?');
        return false;
      }
    } else if (method === 'phone') {
      const digits = identifier.replace(/\D/g, '');
      if (digits.length < 10) {
        setError('Número incompleto. Não esqueça do DDD.');
        return false;
      }
    }
    return true;
  };

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    setIdentifier(formatted);
    setError(null);
  };

  const handleOtpChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    setError(null);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    text.split('').forEach((d, idx) => (next[idx] = d));
    setOtp(next);
    otpRefs.current[Math.min(text.length, 5)]?.focus();
  };

  const validateOtp = (): boolean => {
    if (otp.join('').length < 6) {
      setError('Código incompleto. Faltam alguns dígitos.');
      return false;
    }
    return true;
  };

  const validateProfile = (): boolean => {
    if (name.trim().length < 2) {
      setError('Precisamos de um nome pra te chamar.');
      return false;
    }
    if (!birthdate) {
      setError('Sua data de nascimento é obrigatória.');
      return false;
    }
    if (tooYoung) {
      setError('Você precisa ter pelo menos 13 anos pra usar o Fanverse.');
      return false;
    }
    return true;
  };

  const validateTerms = (): boolean => {
    if (!agreedTerms) {
      setError('Precisamos do seu OK nos termos pra continuar.');
      return false;
    }
    if (isMinor && !agreedMinor) {
      setError('Confirme a autorização do responsável pra seguir.');
      return false;
    }
    return true;
  };

  const finishAuth = () => {
    const user = {
      id: `mock-${Date.now()}`,
      method,
      identifier,
      name: name || 'Fã Anônimo',
      birthdate,
      age,
      tier: isMinor ? 'youth' : 'adult',
      createdAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem('fanverse:user', JSON.stringify(user));
      // Conta nova → garantir que o onboarding apareça na primeira entrada no /app
      if (mode === 'signup') {
        localStorage.removeItem('fanverse:onboardingDone');
      }
    } catch {
      /* ignore */
    }
    setStep('success');
  };

  const handlePrimary = () => {
    if (step === 'method') {
      setMethod('email');
      if (!validateIdentifier()) return;
      if (mode === 'login') {
        if (!password.trim()) {
          setError('Digite sua senha.');
          return;
        }
        finishAuth();
        return;
      }
      goNext();
      return;
    }
    if (step === 'otp') {
      if (!validateOtp()) return;
      if (mode === 'login') {
        finishAuth();
        return;
      }
      goNext();
      return;
    }
    if (step === 'profile') {
      if (!validateProfile()) return;
      goNext();
      return;
    }
    if (step === 'terms') {
      if (!validateTerms()) return;
      finishAuth();
      return;
    }
    if (step === 'success') {
      router.push('/app');
    }
  };

  const resend = () => {
    if (resendIn > 0) return;
    setResendIn(30);
    setOtp(['', '', '', '', '', '']);
    otpRefs.current[0]?.focus();
  };

  // ── Renderers ──

  const switchMode = () => {
    setMode(mode === 'signup' ? 'login' : 'signup');
    setError(null);
    setPassword('');
    setForgotSent(false);
    setShowPassword(false);
  };

  const renderMethod = () => (
    <div className={styles.stepWrap}>
      <span className={styles.eyebrow}>{mode === 'signup' ? 'Criar conta' : 'Entrar'}</span>
      <h1 className={styles.title}>
        {mode === 'signup' ? 'Bem-vindo ao Fanverse' : 'Que bom te ver de novo'}
      </h1>
      <p className={styles.subtitle}>
        {mode === 'signup'
          ? 'Vamos enviar um código pra confirmar que é você.'
          : 'Entre com seu e-mail e senha pra continuar.'}
      </p>

      <div className={styles.field}>
        <label className={styles.label}>E-mail</label>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          className={`${styles.input} ${error ? styles.inputError : ''}`}
          placeholder="voce@email.com"
          autoFocus
          value={identifier}
          onChange={(e) => {
            setMethod('email');
            setIdentifier(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handlePrimary()}
        />
      </div>

      {mode === 'login' && (
        <div className={styles.field}>
          <label className={styles.label}>Senha</label>
          <div className={styles.passwordWrap}>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className={`${styles.input} ${styles.passwordInput} ${error ? styles.inputError : ''}`}
              placeholder="Sua senha"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handlePrimary()}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          <div className={styles.forgotRow}>
            <button
              type="button"
              className={styles.forgotBtn}
              onClick={() => {
                if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(identifier.trim())) {
                  setError('Digite seu e-mail antes pra recuperar a senha.');
                  return;
                }
                setForgotSent(true);
              }}
            >
              Esqueci a senha
            </button>
          </div>
          {forgotSent && (
            <span className={styles.forgotConfirm}>
              Enviamos um link pra <strong>{identifier}</strong>. Confira sua caixa de entrada.
            </span>
          )}
        </div>
      )}

      {error && <span className={styles.errorMsg}>{error}</span>}

      <div className={styles.divider}>ou</div>

      <div className={styles.methodList}>
        <button className={styles.methodBtn} onClick={() => pickMethod('google')}>
          <span className={styles.methodIcon}><IconGoogle /></span>
          Continuar com Google
          <span className={styles.methodChevron}><IconChevron /></span>
        </button>
        <button className={styles.methodBtn} onClick={() => pickMethod('apple')}>
          <span className={styles.methodIcon}><IconApple /></span>
          Continuar com Apple
          <span className={styles.methodChevron}><IconChevron /></span>
        </button>
      </div>

      <div className={styles.altLink}>
        {mode === 'signup' ? 'Já tem conta? ' : 'Primeira vez aqui? '}
        <button className={styles.altLinkBtn} onClick={switchMode}>
          {mode === 'signup' ? 'Entrar' : 'Criar conta'}
        </button>
      </div>
    </div>
  );

  const renderIdentifier = () => (
    <div className={styles.stepWrap}>
      <span className={styles.eyebrow}>Passo {stepIdx + 1} de {stepsList.length}</span>
      <h1 className={styles.title}>{method === 'email' ? 'Qual seu e-mail?' : 'Qual seu número?'}</h1>
      <p className={styles.subtitle}>
        {method === 'email'
          ? 'Vamos enviar um código pra confirmar que é você.'
          : 'Vamos mandar um SMS com o código de 6 dígitos.'}
      </p>

      <div className={styles.field}>
        <label className={styles.label}>{method === 'email' ? 'E-mail' : 'Telefone'}</label>
        {method === 'email' ? (
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            className={`${styles.input} ${error ? styles.inputError : ''}`}
            placeholder="voce@email.com"
            autoFocus
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handlePrimary()}
          />
        ) : (
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            className={`${styles.input} ${error ? styles.inputError : ''}`}
            placeholder="(11) 91234-5678"
            autoFocus
            value={identifier}
            onChange={handlePhoneChange}
            onKeyDown={(e) => e.key === 'Enter' && handlePrimary()}
          />
        )}
        {error && <span className={styles.errorMsg}>{error}</span>}
      </div>
    </div>
  );

  const renderOtp = () => (
    <div className={styles.stepWrap}>
      <span className={styles.eyebrow}>Passo {stepIdx + 1} de {stepsList.length}</span>
      <h1 className={styles.title}>Digite o código</h1>
      <p className={styles.subtitle}>
        Enviamos pra <strong>{maskedIdentifier}</strong>. Chegou?
      </p>

      <div className={styles.otpRow}>
        {otp.map((v, i) => (
          <input
            key={i}
            ref={(el) => {
              otpRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            className={`${styles.otpBox} ${v ? styles.otpFilled : ''}`}
            value={v}
            onChange={(e) => handleOtpChange(i, e.target.value)}
            onKeyDown={(e) => handleOtpKey(i, e)}
            onPaste={handleOtpPaste}
            aria-label={`Dígito ${i + 1}`}
          />
        ))}
      </div>

      {error && <span className={styles.errorMsg}>{error}</span>}

      <div className={styles.otpResend}>
        <span>Não chegou?</span>
        <button className={styles.otpResendBtn} disabled={resendIn > 0} onClick={resend}>
          {resendIn > 0 ? `Reenviar em ${resendIn}s` : 'Reenviar código'}
        </button>
      </div>

      <span className={styles.helpMsg}>
        Dica do preview: qualquer 6 dígitos serve aqui.
      </span>
    </div>
  );

  const renderProfile = () => (
    <div className={styles.stepWrap}>
      <span className={styles.eyebrow}>Passo {stepIdx + 1} de {stepsList.length}</span>
      <h1 className={styles.title}>Como te chamamos?</h1>
      <p className={styles.subtitle}>É como sua tribo vai te encontrar.</p>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label className={styles.label}>Nome</label>
          <input
            type="text"
            autoComplete="name"
            className={styles.input}
            placeholder="Ex: Diógenis Silva"
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Data de nascimento</label>
          <input
            type="date"
            autoComplete="bday"
            className={styles.input}
            value={birthdate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              setBirthdate(e.target.value);
              setError(null);
            }}
          />
        </div>

        {isMinor && (
          <div className={styles.minorBadge}>
            <IconShield />
            <div>
              <strong>Conta jovem detectada.</strong> Você tem menos de 18 — algumas
              funcionalidades vão funcionar diferente. A gente te explica no próximo passo.
            </div>
          </div>
        )}

        {error && <span className={styles.errorMsg}>{error}</span>}
      </div>
    </div>
  );

  const renderTerms = () => (
    <div className={styles.stepWrap}>
      <span className={styles.eyebrow}>Passo {stepIdx + 1} de {stepsList.length}</span>
      <h1 className={styles.title}>Quase lá.</h1>
      <p className={styles.subtitle}>Levamos sua privacidade a sério. Dá uma olhada:</p>

      {isMinor && (
        <div className={styles.termsCard}>
          <div className={styles.termsCardTitle}>
            <IconShield /> Conta jovem · funcionalidades restritas
          </div>
          Para te proteger, ajustamos algumas coisas:
          <ul className={styles.termsCardList}>
            <li>Chat privado desligado</li>
            <li>Conteúdos sensíveis bloqueados</li>
            <li>Localização aproximada (cidade, não bairro)</li>
            <li>Compras dentro do app desativadas</li>
          </ul>
          <div className={styles.termsCardFoot}>
            Você ainda descobre o que o mundo está ouvindo, curte artistas, cria playlists
            e participa das missões.
          </div>
        </div>
      )}

      <label className={styles.checkRow}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={agreedTerms}
          onChange={(e) => {
            setAgreedTerms(e.target.checked);
            setError(null);
          }}
        />
        <span className={styles.checkLabel}>
          Li e aceito os <u>Termos de Uso</u> e a <u>Política de Privacidade</u> do Fanverse.
        </span>
      </label>

      {isMinor && (
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={agreedMinor}
            onChange={(e) => {
              setAgreedMinor(e.target.checked);
              setError(null);
            }}
          />
          <span className={styles.checkLabel}>
            Confirmo que tenho autorização do meu <u>responsável legal</u> pra usar o app.
          </span>
        </label>
      )}

      {error && <span className={styles.errorMsg}>{error}</span>}
    </div>
  );

  const renderSuccess = () => {
    const firstName = (name.split(' ')[0] || 'fã').trim();
    return (
      <div className={`${styles.stepWrap} ${styles.successWrap}`}>
        <div className={styles.successText}>
          <div className={styles.successCheck}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className={styles.title}>Pronto, {firstName}!</h1>
          <p className={styles.subtitle} style={{ marginTop: 0 }}>
            Achamos uma comunidade pulsando perto de você.
          </p>
        </div>

        <div className={styles.fanverseCard}>
          <div className={styles.fanverseCover}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ana-castela-box.jpg" alt="Ana Castela" />
          </div>

          <span className={styles.fanverseName}>Ana Castela</span>

          <div className={styles.fanverseStats}>
            <div className={styles.fanverseStat}>
              <span className={styles.fanverseStatNum}>12.847</span>
              <span className={styles.fanverseStatLabel}>fãs online</span>
            </div>
            <div className={styles.fanverseStat}>
              <span className={styles.fanverseStatNum}>142</span>
              <span className={styles.fanverseStatLabel}>comunidades</span>
            </div>
          </div>

          <div className={styles.locationRow}>
            <div className={styles.locationCopy}>
              <div className={styles.locationTitle}>
                <IconPin /> Compartilhar minha localização
              </div>
              <div className={styles.locationSub}>
                Nunca mostraremos a sua posição exata — mostramos pontos aleatórios
                num raio de <strong>25 km</strong> da cidade onde você está.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={shareLocation}
              aria-label="Compartilhar localização"
              className={`${styles.toggle} ${shareLocation ? styles.toggleOn : ''}`}
              onClick={() => {
                const next = !shareLocation;
                setShareLocation(next);
                try {
                  const raw = localStorage.getItem('fanverse:user');
                  if (raw) {
                    const u = JSON.parse(raw);
                    u.shareLocation = next;
                    localStorage.setItem('fanverse:user', JSON.stringify(u));
                  }
                } catch { /* ignore */ }
              }}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>

          <button
            type="button"
            className={styles.fanverseCta}
            onClick={() => router.push('/app?fanverse=ana-castela')}
          >
            Entrar nesse Fanverse
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // ── Step content ──
  let content: React.ReactNode = null;
  if (step === 'method') content = renderMethod();
  else if (step === 'identifier') content = renderIdentifier();
  else if (step === 'otp') content = renderOtp();
  else if (step === 'profile') content = renderProfile();
  else if (step === 'terms') content = renderTerms();
  else if (step === 'success') content = renderSuccess();

  // ── Footer primary label ──
  const primaryLabel = (() => {
    if (step === 'method') return mode === 'login' ? 'Entrar' : 'Enviar código';
    if (step === 'identifier') return method === 'email' ? 'Enviar código' : 'Enviar SMS';
    if (step === 'otp') return mode === 'login' ? 'Entrar' : 'Verificar';
    if (step === 'profile') return 'Continuar';
    if (step === 'terms') return mode === 'login' ? 'Entrar' : 'Criar minha conta';
    if (step === 'success') return null;
    return 'Continuar';
  })();

  const isSuccess = step === 'success';

  return (
    <div className={`${styles.page} ${isSuccess ? styles.successPageBg : ''}`}>
      {isSuccess && <AuthSuccessMap />}
      <header className={styles.topBar}>
        <button
          className={styles.iconBtn}
          onClick={goBack}
          aria-label={stepIdx === 0 ? 'Voltar pro início' : 'Voltar passo'}
          disabled={step === 'success'}
        >
          <IconArrowLeft />
        </button>

        <div className={styles.brand} aria-hidden="true">
          <span className={styles.brandDot} />
          <span>Fanverse</span>
        </div>

        <button
          className={styles.iconBtn}
          onClick={tryExit}
          aria-label="Cancelar e sair"
          disabled={step === 'success'}
        >
          <IconClose />
        </button>
      </header>

      <div
        className={styles.progress}
        aria-label={`Passo ${stepIdx + 1} de ${stepsList.length}`}
      >
        {stepsList.map((s, i) => (
          <span
            key={s}
            className={`${styles.dot} ${
              i === stepIdx ? styles.dotActive : i < stepIdx ? styles.dotDone : ''
            }`}
          />
        ))}
      </div>

      <main className={`${styles.main} ${isSuccess ? styles.successMain : ''}`}>{content}</main>

      {primaryLabel && (
        <footer className={styles.footer}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handlePrimary}>
            {primaryLabel}
          </button>
          {step !== 'success' && stepIdx > 0 && (
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={goBack}>
              Voltar
            </button>
          )}
        </footer>
      )}
    </div>
  );
}

/* ──────────────── Icons ──────────────── */

function IconMail() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="18" r="0.9" fill="currentColor" />
    </svg>
  );
}
function IconGoogle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.04h5.4c-.23 1.25-.93 2.31-1.99 3.02v2.51h3.22c1.88-1.74 2.97-4.3 2.97-7.44z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.22-2.51c-.89.6-2.04.96-3.4.96-2.61 0-4.83-1.76-5.62-4.13H3.05v2.59C4.7 19.78 8.07 22 12 22z" fill="#34A853" />
      <path d="M6.38 13.89c-.2-.6-.32-1.24-.32-1.89s.12-1.29.32-1.89V7.52H3.05A9.99 9.99 0 0 0 2 12c0 1.62.39 3.15 1.05 4.48l3.33-2.59z" fill="#FBBC05" />
      <path d="M12 5.98c1.47 0 2.78.5 3.82 1.49l2.86-2.86C16.95 2.99 14.69 2 12 2 8.07 2 4.7 4.22 3.05 7.52l3.33 2.59C7.17 7.74 9.39 5.98 12 5.98z" fill="#EA4335" />
    </svg>
  );
}
function IconApple() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.37 12.7c.02 2.49 2.18 3.32 2.2 3.33-.02.05-.34 1.17-1.13 2.32-.68.99-1.39 1.98-2.51 2-1.1.02-1.45-.65-2.7-.65s-1.64.63-2.68.67c-1.08.04-1.9-1.07-2.59-2.06-1.4-2.02-2.47-5.71-1.03-8.2.71-1.24 1.99-2.02 3.37-2.04 1.06-.02 2.06.71 2.7.71.65 0 1.86-.88 3.13-.75.53.02 2.02.21 2.97 1.62-.08.05-1.78 1.04-1.76 3.05zM14.45 5.46c.57-.69.96-1.65.86-2.6-.83.03-1.83.55-2.42 1.24-.53.61-.99 1.59-.87 2.52.92.07 1.86-.47 2.43-1.16z" />
    </svg>
  );
}
function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M12 3l8 3v5.5c0 4.5-3.4 8.5-8 9.5-4.6-1-8-5-8-9.5V6l8-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
