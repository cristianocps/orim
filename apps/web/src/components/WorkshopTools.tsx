import { useState, useEffect, useRef } from 'react';
import { Timer, Vote, ThumbsUp, X, Play, Pause, RotateCcw } from 'lucide-react';
import './WorkshopTools.css';

interface WorkshopToolsProps {
  onTimerStart: (seconds: number) => void;
  onVote: (targetId: string) => void;
}

export function WorkshopTools({ onTimerStart, onVote }: WorkshopToolsProps) {
  const [showTimer, setShowTimer] = useState(false);
  const [showVote, setShowVote] = useState(false);
  const [timerValue, setTimerValue] = useState(5);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, timeLeft]);

  const startTimer = () => {
    setTimeLeft(timerValue * 60);
    setIsRunning(true);
    onTimerStart(timerValue * 60);
  };

  const pauseTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <div className="workshop-tools">
        <button
          className={`workshop-btn ${showTimer || timeLeft > 0 ? 'active' : ''}`}
          onClick={() => {
            setShowTimer(!showTimer);
            setShowVote(false);
          }}
          title="Timer"
        >
          <Timer size={18} />
          {timeLeft > 0 && (
            <span className="timer-badge">{formatTime(timeLeft)}</span>
          )}
        </button>
        <button
          className={`workshop-btn ${showVote ? 'active' : ''}`}
          onClick={() => {
            setShowVote(!showVote);
            setShowTimer(false);
          }}
          title="Votação"
        >
          <Vote size={18} />
        </button>
      </div>

      {showTimer && (
        <div className="workshop-panel timer-panel">
          <div className="panel-header">
            <h3>Timer</h3>
            <button className="panel-close" onClick={() => setShowTimer(false)}>
              <X size={14} />
            </button>
          </div>
          {timeLeft > 0 ? (
            <div className="timer-display">
              <div className="timer-countdown">{formatTime(timeLeft)}</div>
              <div className="timer-controls">
                {isRunning ? (
                  <button onClick={pauseTimer}>
                    <Pause size={16} />
                  </button>
                ) : (
                  <button onClick={() => setIsRunning(true)}>
                    <Play size={16} />
                  </button>
                )}
                <button onClick={resetTimer}>
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="timer-setup">
              <div className="timer-presets">
                {[1, 3, 5, 10, 15, 30].map((min) => (
                  <button
                    key={min}
                    className={`timer-preset ${timerValue === min ? 'active' : ''}`}
                    onClick={() => setTimerValue(min)}
                  >
                    {min} min
                  </button>
                ))}
              </div>
              <button className="timer-start-btn" onClick={startTimer}>
                <Play size={16} />
                Iniciar timer
              </button>
            </div>
          )}
        </div>
      )}

      {showVote && (
        <div className="workshop-panel vote-panel">
          <div className="panel-header">
            <h3>Votação</h3>
            <button className="panel-close" onClick={() => setShowVote(false)}>
              <X size={14} />
            </button>
          </div>
          <div className="vote-info">
            <p>Selecione um objeto e clique no botão de voto para votar.</p>
          </div>
          <button className="vote-action-btn" onClick={() => onVote('demo')}>
            <ThumbsUp size={16} />
            Votar no selecionado
          </button>
        </div>
      )}
    </>
  );
}
