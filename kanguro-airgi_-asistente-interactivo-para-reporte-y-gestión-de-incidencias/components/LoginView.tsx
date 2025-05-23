

import React, { useState, useEffect } from 'react';
import { KanguroLogo, ExclamationTriangleIcon } from './Icons';
import { KANGURO_LOGO_URL, BRAND_BLUE } from '../constants';

interface LoginViewProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onRegister: (name: string, email: string, pass: string) => Promise<void>; // New prop for registration
  loginError: string | null;
  isLoading: boolean;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegister, loginError, isLoading }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(loginError);

  useEffect(() => {
    setCurrentError(loginError);
  }, [loginError]);

  const clearForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setCurrentError(null);
  }

  const handleToggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    clearForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentError(null);

    if (!email.trim() || !password.trim()) {
      setCurrentError("Por favor, ingresa tu email y contraseña.");
      return;
    }
    const emailClean = email.toLowerCase().trim();
    if (!emailClean.endsWith('@kanguro.com')) {
      setCurrentError("Por favor, usa un email de Kanguro (@kanguro.com).");
      return;
    }

    if (isRegisterMode) {
      if (!name.trim()) {
        setCurrentError("Por favor, ingresa tu nombre completo.");
        return;
      }
      if (password !== confirmPassword) {
        setCurrentError("Las contraseñas no coinciden.");
        return;
      }
      if (password.length < 6) {
        setCurrentError("La contraseña debe tener al menos 6 caracteres.");
        return;
      }
      setInternalLoading(true);
      try {
        await onRegister(name.trim(), emailClean, password);
        // onAuthStateChanged in App.tsx should handle login after successful registration
      } catch (error: any) {
        setCurrentError(error.message || "Error durante el registro.");
      } finally {
        setInternalLoading(false);
      }
    } else {
      setInternalLoading(true);
      try {
        await onLogin(emailClean, password);
      } catch (error: any) { // Should be handled by loginError prop, but for safety
        setCurrentError(error.message || "Error de inicio de sesión.");
      } finally {
        setInternalLoading(false);
      }
    }
  };

  const effectiveIsLoading = isLoading || internalLoading;

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4 text-center">
      <KanguroLogo imageUrl={KANGURO_LOGO_URL} height={56} className="mb-5" />
      <h1 className="text-xl font-bold text-slate-800 mb-2">
        {isRegisterMode ? 'Crear Cuenta en AIRGI' : 'Iniciar Sesión en AIRGI'}
      </h1>
      <p className="text-sm text-slate-600 mb-6 max-w-xs">
        {isRegisterMode ? 'Completa tus datos para registrarte.' : 'Usa tus credenciales de Kanguro.'}
      </p>

      {currentError && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-xs flex items-start max-w-xs mx-auto">
          <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0 text-red-500" />
          <span><strong className="font-semibold">Error:</strong> {currentError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full max-w-xs bg-white p-5 rounded-xl shadow-xl">
        {isRegisterMode && (
          <div className="mb-3">
            <label htmlFor="name" className="block text-xs font-medium text-slate-700 mb-1 text-left">
              Nombre Completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre completo"
              required
              disabled={effectiveIsLoading}
              className="w-full p-2.5 bg-white text-slate-800 border border-slate-300 rounded-lg shadow-sm focus:ring-1 focus:border-transparent text-xs placeholder-slate-400 disabled:bg-slate-50"
              style={{ borderColor:BRAND_BLUE, outlineColor:BRAND_BLUE }}
              onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${BRAND_BLUE}`}
              onBlur={(e) => e.target.style.boxShadow = '0 0 0 0px transparent'}
            />
          </div>
        )}
        <div className="mb-3">
          <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1 text-left">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu.email@kanguro.com"
            required
            disabled={effectiveIsLoading}
            className="w-full p-2.5 bg-white text-slate-800 border border-slate-300 rounded-lg shadow-sm focus:ring-1 focus:border-transparent text-xs placeholder-slate-400 disabled:bg-slate-50"
            style={{ borderColor:BRAND_BLUE, outlineColor:BRAND_BLUE }}
            onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${BRAND_BLUE}`}
            onBlur={(e) => e.target.style.boxShadow = '0 0 0 0px transparent'}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="password" className="block text-xs font-medium text-slate-700 mb-1 text-left">
            Contraseña <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              required
              disabled={effectiveIsLoading}
              className="w-full p-2.5 bg-white text-slate-800 border border-slate-300 rounded-lg shadow-sm focus:ring-1 focus:border-transparent text-xs placeholder-slate-400 disabled:bg-slate-50"
              style={{ borderColor:BRAND_BLUE, outlineColor:BRAND_BLUE }}
              onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${BRAND_BLUE}`}
              onBlur={(e) => e.target.style.boxShadow = '0 0 0 0px transparent'}
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)} 
              className="absolute inset-y-0 right-0 px-3 text-xs text-slate-500 hover:text-blue-600 disabled:opacity-50"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              disabled={effectiveIsLoading}
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>
        {isRegisterMode && (
          <div className="mb-4">
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-700 mb-1 text-left">
              Confirmar Contraseña <span className="text-red-500">*</span>
            </label>
            <input
              type={showPassword ? "text" : "password"}
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirma tu contraseña"
              required
              disabled={effectiveIsLoading}
              className="w-full p-2.5 bg-white text-slate-800 border border-slate-300 rounded-lg shadow-sm focus:ring-1 focus:border-transparent text-xs placeholder-slate-400 disabled:bg-slate-50"
              style={{ borderColor:BRAND_BLUE, outlineColor:BRAND_BLUE }}
              onFocus={(e) => e.target.style.boxShadow = `0 0 0 1px ${BRAND_BLUE}`}
              onBlur={(e) => e.target.style.boxShadow = '0 0 0 0px transparent'}
            />
          </div>
        )}
        <button
          type="submit"
          disabled={effectiveIsLoading || !email.trim() || !password.trim() || (isRegisterMode && (!name.trim() || !confirmPassword.trim()))}
          className="w-full font-semibold py-2.5 px-3 rounded-lg shadow-md transition-colors text-white flex items-center justify-center text-sm disabled:opacity-60"
          style={{ backgroundColor: (effectiveIsLoading || !email.trim() || !password.trim() || (isRegisterMode && (!name.trim() || !confirmPassword.trim()))) ? '#9DB2BF' : BRAND_BLUE }}
        >
          {effectiveIsLoading ? (isRegisterMode ? 'Registrando...' : 'Accediendo...') : (isRegisterMode ? 'Registrarse' : 'Acceder')}
        </button>
      </form>
      <button 
        onClick={handleToggleMode}
        className="text-xs text-blue-600 hover:text-blue-800 mt-4 disabled:opacity-50"
        disabled={effectiveIsLoading}
      >
        {isRegisterMode ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
      </button>
       <p className="text-[10px] text-slate-400 mt-3">
        Solo para personal autorizado de Kanguro.
      </p>
    </div>
  );
};

export default LoginView;