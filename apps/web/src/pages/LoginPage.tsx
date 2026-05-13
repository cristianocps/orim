import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import './LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, name, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message ?? 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">O</div>
          <h1>Orim</h1>
        </div>
        <h2>{isRegister ? 'Criar conta' : 'Entrar'}</h2>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="login-field">
              <label>Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="login-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="login-field">
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Carregando…' : isRegister ? 'Criar conta' : 'Entrar'}
          </button>
        </form>
        <p className="login-toggle">
          {isRegister ? 'Já tem conta?' : 'Não tem conta?'}{' '}
          <button
            type="button"
            className="text-link"
            onClick={() => setIsRegister((v) => !v)}
          >
            {isRegister ? 'Entrar' : 'Criar conta'}
          </button>
        </p>
      </div>
    </div>
  );
}
