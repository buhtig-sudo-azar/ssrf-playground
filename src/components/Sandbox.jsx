import { useState, useEffect, useRef, useCallback } from 'react';
import { IoSend, IoRefresh, IoChevronDown, IoChevronUp, IoAlertCircle, IoCheckmarkCircle, IoWarning } from 'react-icons/io5';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { useTheme } from '../contexts/ThemeContext';
import { scenarios, getEmulatedResponse } from '../data/ssrfScenarios';
import './Sandbox.css';

SyntaxHighlighter.registerLanguage('json', json);

const SEVERITY_MAP = {
  critical: { label: 'Критический', color: 'var(--danger-color)', icon: <IoAlertCircle /> },
  high: { label: 'Высокий', color: 'var(--warning-color)', icon: <IoWarning /> },
  medium: { label: 'Средний', color: 'var(--info-color)', icon: <IoCheckmarkCircle /> },
  low: { label: 'Низкий', color: 'var(--success-color)', icon: <IoCheckmarkCircle /> },
};

export default function Sandbox() {
  const { theme } = useTheme();
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0].id);
  const [url, setUrl] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showFlow, setShowFlow] = useState(false);
  const [requestStage, setRequestStage] = useState(0);
  const responseRef = useRef(null);
  const timeoutRef = useRef(null);

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId);
  const severity = response?.severity ? SEVERITY_MAP[response.severity] : null;

  const handleScenarioChange = useCallback((e) => {
    const id = parseInt(e.target.value, 10);
    setSelectedScenarioId(id);
    const scenario = scenarios.find((s) => s.id === id);
    if (scenario) {
      setUrl(scenario.placeholder);
    }
    setResponse(null);
    setShowExplanation(false);
    setShowFlow(false);
    setRequestStage(0);
  }, []);

  useEffect(() => {
    if (selectedScenario) {
      setUrl(selectedScenario.placeholder);
    }
  }, [selectedScenario]);

  const handleSubmit = useCallback(() => {
    if (!url.trim() || loading) return;

    setLoading(true);
    setResponse(null);
    setShowExplanation(false);
    setShowFlow(true);
    setRequestStage(1);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      setRequestStage(2);

      timeoutRef.current = setTimeout(() => {
        setRequestStage(3);

        timeoutRef.current = setTimeout(() => {
          const result = getEmulatedResponse(url.trim());
          setResponse(result);
          setLoading(false);
          setRequestStage(4);
        }, 400);
      }, 400);
    }, 500);
  }, [url, loading]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleReset = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setResponse(null);
    setLoading(false);
    setShowExplanation(false);
    setShowFlow(false);
    setRequestStage(0);
  }, []);

  useEffect(() => {
    if (response && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [response]);

  const formatResponse = (data) => {
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  };

  const highlightStyle = theme === 'dark' ? atomOneDark : atomOneLight;

  return (
    <section className="sandbox" id="sandbox">
      <h2 className="sandbox__heading">Интерактивная песочница</h2>
      <p className="sandbox__intro">
        Выберите сценарий атаки, нажмите «Отправить запрос» и наблюдайте,
        как уязвимый сервер обрабатывает ваш запрос.
      </p>

      {/* Scenario Selector */}
      <div className="sandbox__selector">
        <label htmlFor="scenario-select" className="sandbox__label">
          Сценарий атаки:
        </label>
        <select
          id="scenario-select"
          className="sandbox__select"
          value={selectedScenarioId}
          onChange={handleScenarioChange}
        >
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              [{s.category}] {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Scenario Description */}
      <div className="sandbox__scenario-info">
        <p className="sandbox__scenario-desc">{selectedScenario?.description}</p>
      </div>

      {/* Input */}
      <div className="sandbox__input-group">
        <label htmlFor="url-input" className="sandbox__label">
          URL для отправки с сервера:
        </label>
        <div className="sandbox__input-row">
          <input
            id="url-input"
            type="text"
            className="sandbox__input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Введите URL..."
            disabled={loading}
            aria-label="URL для SSRF-запроса"
          />
          <button
            className="sandbox__btn sandbox__btn--primary"
            onClick={handleSubmit}
            disabled={loading || !url.trim()}
            aria-label="Отправить запрос"
          >
            {loading ? (
              <span className="sandbox__spinner" />
            ) : (
              <IoSend />
            )}
            <span>{loading ? 'Отправка...' : 'Отправить запрос'}</span>
          </button>
          {response && (
            <button
              className="sandbox__btn sandbox__btn--secondary"
              onClick={handleReset}
              aria-label="Сбросить"
            >
              <IoRefresh />
            </button>
          )}
        </div>
      </div>

      {/* Attack Flow Animation */}
      {showFlow && (
        <div className="sandbox__flow">
          <div className={`sandbox__flow-step ${requestStage >= 1 ? 'sandbox__flow-step--active' : ''} ${requestStage >= 2 ? 'sandbox__flow-step--done' : ''}`}>
            <span className="sandbox__flow-dot" />
            <span className="sandbox__flow-text">Атакующий отправляет URL</span>
          </div>
          <div className="sandbox__flow-line" />
          <div className={`sandbox__flow-step ${requestStage >= 2 ? 'sandbox__flow-step--active' : ''} ${requestStage >= 3 ? 'sandbox__flow-step--done' : ''}`}>
            <span className="sandbox__flow-dot" />
            <span className="sandbox__flow-text">Сервер выполняет запрос</span>
          </div>
          <div className="sandbox__flow-line" />
          <div className={`sandbox__flow-step ${requestStage >= 3 ? 'sandbox__flow-step--active' : ''} ${requestStage >= 4 ? 'sandbox__flow-step--done' : ''}`}>
            <span className="sandbox__flow-dot" />
            <span className="sandbox__flow-text">Внутренний ресурс отвечает</span>
          </div>
        </div>
      )}

      {/* Response */}
      {response && (
        <div className="sandbox__response" ref={responseRef}>
          <div className="sandbox__response-header">
            <h3 className="sandbox__response-title">Ответ сервера</h3>
            {severity && (
              <span
                className="sandbox__severity"
                style={{ color: severity.color, borderColor: severity.color }}
              >
                {severity.icon}
                {severity.label}
              </span>
            )}
          </div>

          {response.found && (
            <div className="sandbox__response-meta">
              <span className="sandbox__meta-badge">{response.category}</span>
              <span className="sandbox__meta-scenario">{response.scenarioName}</span>
            </div>
          )}

          <div className="sandbox__response-body">
            {typeof response.data === 'string' ? (
              <SyntaxHighlighter
                language="text"
                style={highlightStyle}
                customStyle={{
                  borderRadius: 8,
                  padding: 16,
                  fontSize: '0.88rem',
                  margin: 0,
                }}
              >
                {response.data}
              </SyntaxHighlighter>
            ) : (
              <SyntaxHighlighter
                language="json"
                style={highlightStyle}
                customStyle={{
                  borderRadius: 8,
                  padding: 16,
                  fontSize: '0.88rem',
                  margin: 0,
                }}
              >
                {formatResponse(response.data)}
              </SyntaxHighlighter>
            )}
          </div>

          {!response.found && response.hint && (
            <p className="sandbox__hint">{response.hint}</p>
          )}

          {/* Explanation toggle */}
          <button
            className="sandbox__explanation-toggle"
            onClick={() => setShowExplanation(!showExplanation)}
            aria-expanded={showExplanation}
          >
            <span>Показать объяснение</span>
            {showExplanation ? <IoChevronUp /> : <IoChevronDown />}
          </button>

          {showExplanation && (
            <div className="sandbox__explanation">
              {response.found && selectedScenario?.explanation ? (
                <p>{selectedScenario.explanation}</p>
              ) : (
                <p>
                  Указанный URL не соответствует ни одному из известных векторов атаки.
                  В реальном сценарии сервер вернул бы ошибку или содержимое запрошенного ресурса.
                  Попробуйте один из примеров выше, чтобы увидеть, как работает SSRF.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}