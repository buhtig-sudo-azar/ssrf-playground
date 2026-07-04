import { useState, useEffect, useRef, useCallback } from 'react';
import { IoSend, IoRefresh, IoChevronDown, IoChevronUp, IoAlertCircle, IoCheckmarkCircle, IoWarning, IoBook, IoFlame } from 'react-icons/io5';
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
  const [showSteps, setShowSteps] = useState(false);
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
    setShowSteps(false);
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
    setShowSteps(false);
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
    setShowSteps(false);
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
        Здесь вы можете <strong>самостоятельно попробовать</strong> каждый вектор SSRF-атаки
        в безопасной эмулированной среде. Выберите сценарий, прочитайте пояснение перед отправкой,
        нажмите «Отправить запрос» и изучите результат. Под каждым ответом есть детальный разбор:
        что произошло, почему это опасно, и реальный пример из жизни.
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

      {/* Pre-explanation (before sending) */}
      <div className="sandbox__pre-explanation">
        <div className="sandbox__pre-explanation-header">
          <IoBook className="sandbox__pre-icon" />
          <span>Перед тем как нажать «Отправить» — прочитайте, что произойдёт:</span>
        </div>
        <p className="sandbox__pre-text">{selectedScenario?.preExplanation}</p>
      </div>

      {/* Input */}
      <div className="sandbox__input-group">
        <label htmlFor="url-input" className="sandbox__label">
          URL, который сервер получит от атакующего:
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
            <span>{loading ? 'Выполняю...' : 'Отправить запрос'}</span>
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
            <h3 className="sandbox__response-title">Ответ «сервера» (эмулировано)</h3>
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
                  fontSize: '0.85rem',
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
                  fontSize: '0.85rem',
                  margin: 0,
                }}
              >
                {formatResponse(response.data)}
              </SyntaxHighlighter>
            )}
          </div>

          {/* Response Annotation */}
          {response.responseAnnotation && (
            <div className="sandbox__annotation">
              <IoAlertCircle className="sandbox__annotation-icon" />
              <div>
                <strong>Разбор ответа:</strong>
                <p>{response.responseAnnotation}</p>
              </div>
            </div>
          )}

          {!response.found && response.hint && (
            <p className="sandbox__hint">{response.hint}</p>
          )}

          {/* Step by step toggle */}
          {response.found && response.stepByStep && (
            <>
              <button
                className="sandbox__explanation-toggle"
                onClick={() => setShowSteps(!showSteps)}
                aria-expanded={showSteps}
              >
                <span>Пошаговый разбор атаки</span>
                {showSteps ? <IoChevronUp /> : <IoChevronDown />}
              </button>
              {showSteps && (
                <div className="sandbox__steps">
                  {response.stepByStep.map((step, idx) => (
                    <div key={idx} className="sandbox__step">
                      <span className="sandbox__step-num">{idx + 1}</span>
                      <p className="sandbox__step-text">{step}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Real world example */}
          {response.found && response.realWorldExample && (
            <div className="sandbox__realworld">
              <IoFlame className="sandbox__realworld-icon" />
              <div>
                <strong>Реальный случай:</strong>
                <p>{response.realWorldExample}</p>
              </div>
            </div>
          )}

          {/* Explanation toggle */}
          <button
            className="sandbox__explanation-toggle"
            onClick={() => setShowExplanation(!showExplanation)}
            aria-expanded={showExplanation}
          >
            <span>Подробное объяснение уязвимости</span>
            {showExplanation ? <IoChevronUp /> : <IoChevronDown />}
          </button>

          {showExplanation && (
            <div className="sandbox__explanation">
              {response.found && response.explanation ? (
                <p>{response.explanation}</p>
              ) : (
                <p>
                  Указанный URL не соответствует ни одному из известных векторов атаки.
                  В реальном сценарии сервер вернул бы ошибку или содержимое запрошенного ресурса.
                  Попробуйте выбрать один из сценариев в выпадающем списке выше, чтобы увидеть
                  детальный разбор атаки с пояснениями.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}