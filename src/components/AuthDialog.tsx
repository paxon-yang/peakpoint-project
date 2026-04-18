import { FormEvent } from "react";
import { TranslationKey } from "../i18n";
import { Language } from "../types";

type AuthMode = "login" | "register";

interface AuthDialogProps {
  open: boolean;
  mode: AuthMode;
  language: Language;
  email: string;
  password: string;
  loading: boolean;
  errorMessage?: string;
  successMessage?: string;
  t: (key: TranslationKey) => string;
  onClose: () => void;
  onModeChange: (nextMode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}

export const AuthDialog = ({
  open,
  mode,
  language,
  email,
  password,
  loading,
  errorMessage,
  successMessage,
  t,
  onClose,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onSubmit
}: AuthDialogProps) => {
  if (!open) return null;

  const isLogin = mode === "login";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="auth-modal-backdrop" onMouseDown={onClose}>
      <div className="auth-modal-card" onMouseDown={(event) => event.stopPropagation()}>
        <div className="auth-modal-header">
          <h3>{isLogin ? t("authDialogLoginTitle") : t("authDialogRegisterTitle")}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={t("cancel")}>
            x
          </button>
        </div>
        <form className="auth-modal-form" onSubmit={handleSubmit}>
          <label>
            {t("email")}
            <input
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder={language === "zh" ? "name@company.com" : "name@company.com"}
            />
          </label>
          <label>
            {t("password")}
            <input
              type="password"
              value={password}
              autoComplete={isLogin ? "current-password" : "new-password"}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder={language === "zh" ? "至少 6 位" : "At least 6 characters"}
            />
          </label>
          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
          {successMessage ? <p className="success-text">{successMessage}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? (language === "zh" ? "处理中..." : "Processing...") : isLogin ? t("authSubmitLogin") : t("authSubmitRegister")}
          </button>
        </form>
        <button
          className="auth-switch-btn"
          onClick={() => onModeChange(isLogin ? "register" : "login")}
          type="button"
          disabled={loading}
        >
          {isLogin ? t("authSwitchToRegister") : t("authSwitchToLogin")}
        </button>
      </div>
    </div>
  );
};


