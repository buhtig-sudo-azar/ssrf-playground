import { useState } from 'react';
import {
  IoAlertCircle, IoGlobe, IoLockClosed, IoServer,
  IoChevronDown, IoChevronUp, IoOpen,
  IoShieldCheckmark, IoFlame, IoWarning,
  IoSwapHorizontal, IoEyeOff, IoCode, IoFlash
} from 'react-icons/io5';
import './TheorySection.css';

const REAL_BREACHES = [
  {
    year: '2019',
    company: 'Capital One',
    impact: '106 млн клиентов, ущерб $190M+',
    desc: 'Через SSRF на WAF атакующая Paige Thompson получила IAM-ключи из AWS метаданных (169.254.169.254) и скачала данные клиентов из S3. Одна из крупнейших утечек данных в истории, приведшая к штрафам на сотни миллионов долларов и массовой миграции на IMDSv2.',
  },
  {
    year: '2021',
    company: 'Microsoft Exchange (ProxyLogon)',
    impact: 'Тысячи серверов, Hafnium APT',
    desc: 'Цепочка уязвимостей ProxyLogon включала SSRF на внутренние сервисы Exchange. Группа Hafnium использовала это для установки веб-шеллов и кражи почты. По оценкам, было скомпрометировано более 30 000 организаций в США.',
  },
  {
    year: '2025',
    company: 'Oracle EBS (CVE-2025-61882)',
    impact: 'CVSS 9.8, Cl0p ransomware, CISA KEV',
    desc: 'Критическая SSRF-уязвимость в Oracle E-Business Suite, эксплуатируемая группой Cl0p с августа 2025. Позволяет цепочкой SSRF + CRLF + XSLT получить RCE. CISA обязала федеральные агентства пропатчить до 27 октября 2025. Продемонстрировала эволюцию SSRF от утечки данных до RCE.',
  },
  {
    year: '2024',
    company: 'Отраслевая статистика',
    impact: 'Рост атак на 452% (SonicWall 2025)',
    desc: 'Согласно отчёту SonicWall Cyber Threat Report 2025, количество SSRF-атак выросло на 452% с 2023 по 2024 год. Рост связан с массовым переходом на облачную инфраструктуру и появлением AI-инструментов автоматизации, которые снижают порог входа для атакующих.',
  },
];

const ATTACK_FLOW = [
  {
    step: 1,
    label: 'Атакующий',
    icon: <IoGlobe />,
    color: 'var(--accent-color)',
    detail: 'Отправляет crafted-запрос с опасным URL на уязвимый сервер. URL содержит внутренний адрес (127.0.0.1, 169.254.169.254, file:///etc/passwd).'
  },
  {
    step: 2,
    label: 'Уязвимый сервер',
    icon: <IoServer />,
    color: 'var(--warning-color)',
    detail: 'Получает URL от пользователя и делает HTTP-запрос по нему без проверки. Запрос исходит из внутренней сети, минуя firewall.'
  },
  {
    step: 3,
    label: 'Внутренний ресурс',
    icon: <IoLockClosed />,
    color: 'var(--danger-color)',
    detail: 'Возвращает конфиденциальные данные, потому что запрос пришёл от «своего» сервера. Доверительные отношения (trust relationship) — корень проблемы.'
  },
];

const SSRF_TYPES = [
  {
    name: 'Basic SSRF (прямой)',
    icon: <IoEye />,
    color: 'var(--warning-color)',
    desc: 'Атакующий видит содержимое ответа от внутреннего ресурса. Сервер возвращает тело ответа напрямую. Это самый простой для обнаружения тип — в ответе видны данные внутренних сервисов, метаданные облака, файлы.',
    example: 'Приложение загружает изображение по URL и показывает его пользователю. Атакующий указывает http://localhost/admin — видит панель управления.',
    detectability: 'Легко обнаружить по ответу, но часто упускается из-за отсутствия мониторинга исходящих запросов.',
  },
  {
    name: 'Blind SSRF (слепой)',
    icon: <IoEyeOff />,
    color: 'var(--danger-color)',
    desc: 'Сервер не возвращает содержимое ответа. Атакующий знает только, что запрос был выполнен (по статус-коду, времени ответа или через OOB-канал). Это более сложный, но и более опасный тип — сложнее для обнаружения, но эффект тот же.',
    example: 'Вебхук: сервер отправляет POST на указанный URL, но не показывает ответ. Атакующий использует OOB-сервер (Burp Collaborator) для подтверждения.',
    detectability: 'Сложно обнаружить — в логах приложения нет подозрительных ответов. Требует мониторинга исходящих DNS/HTTP-запросов.',
  },
  {
    name: 'Semi-blind SSRF',
    icon: <IoFlash />,
    color: 'var(--info-color)',
    desc: 'Сервер возвращает часть информации: статус-код, заголовки, размер ответа, или обобщённое сообщение об ошибке. Атакующий может делать выводы по этим косвенным признакам. Например, разное время ответа для открытых и закрытых портов.',
    example: 'Функция «проверить доступность URL» возвращает «доступен» / «недоступен». Атакующий использует это для порт-сканирования: доступен = порт открыт.',
    detectability: 'Средняя сложность обнаружения. Нужен анализ паттернов исходящих запросов (частота, целевые IP, нестандартные порты).',
  },
];

const SSRF_VS_CSRF = [
  { aspect: 'Кто делает запрос', ssrf: 'Сервер (backend)', csrf: 'Браузер (фронтенд)' },
  { aspect: 'Куда направлен запрос', ssrf: 'На внутренние ресурсы сервера', csrf: 'На тот же сайт (от имени пользователя)' },
  { aspect: 'Цель атаки', ssrf: 'Доступ к внутренним сервисам, файлам, метаданным', csrf: 'Выполнение действий от имени аутентифицированного пользователя' },
  { aspect: 'Защита', ssrf: 'Фильтрация URL, whitelist, сетевая изоляция', csrf: 'CSRF-токены, SameSite cookies, проверка Origin/Referer' },
  { aspect: 'Влияние', ssrf: 'Утечка данных, RCE (через цепочку), компрометация облака', csrf: 'Нежелательные действия: смена пароля, перевод денег, удаление данных' },
  { aspect: 'OWASP Top-10', ssrf: 'A10:2021 (SSRF)', csrf: 'A01:2021 (Broken Access Control — включает CSRF)' },
];

const WHERE_FOUND = [
  {
    name: 'Загрузка файлов по URL',
    short: 'Функция «Загрузить изображение по ссылке»',
    desc: 'Одна из самых частых причин SSRF. Приложение предлагает пользователю загрузить изображение, документ или видео по URL-адресу. Сервер скачивает файл и сохраняет его. Если нет проверки, куда именно сервер ходит, атакующий подставляет внутренний адрес. Этот вектор использован в атаке на Capital One (2019), когда через WAF-функцию загрузки получили доступ к AWS-метаданным и скачали данные 106 млн клиентов из S3.',
    code: 'app.post("/fetch-image", (req, res) => {\n  const url = req.body.url; // пользователь вводит URL\n  const image = await fetch(url);   // сервер делает запрос\n  res.send(image);\n});',
  },
  {
    name: 'Webhook и callback URL',
    short: 'Пользователь указывает URL для обратного вызова',
    desc: 'Многие сервисы (платёжные системы, CI/CD, интеграции, уведомления) позволяют пользователю указать URL, на который сервис отправит HTTP-запрос при наступлении события. Если атакующий может указать этот URL, он может направить запрос на внутренний адрес. Например, при оплате указать callback URL = http://127.0.0.1:8080/admin. Платёжная система «проксирует» запрос на внутренний сервис.',
    code: 'app.post("/subscribe", (req, res) => {\n  const callback = req.body.callback_url;\n  await fetch(callback, {\n    method: "POST",\n    body: JSON.stringify(event)\n  });\n});',
  },
  {
    name: 'Генерация PDF из URL',
    short: 'Конвертация HTML-страницы в PDF (Puppeteer, wkhtmltopdf)',
    desc: 'Инструменты вроде wkhtmltopdf, Puppeteer или Playwright конвертируют веб-страницу в PDF по URL. Headless-браузер поддерживает множество протоколов (http, https, file) и может посетить любой адрес. Это комбинированный вектор: SSRF + чтение файлов + потенциальный XSS при рендеринге HTML. Уязвимость file:// через wkhtmltopdf — классика SSRF-эксплуатации.',
    code: 'app.post("/generate-pdf", (req, res) => {\n  const url = req.body.url;\n  const pdf = await puppeteer.pdf(url);\n  res.send(pdf);\n});',
  },
  {
    name: 'URL-превью и Open Graph',
    short: 'Сервис показывает превью ссылки (Telegram, Slack, мессенджеры)',
    desc: 'Когда вы отправляете ссылку в мессенджер, сервер посещает URL для получения заголовка, описания и картинки (Open Graph теги). Если атакующий контролирует отправляемый URL, он может заставить сервер посетить внутренний адрес. Затрагивает не только мессенджеры, но и любые сервисы с URL-превью: соцсети, CRM-системы, таск-трекеры с авто-превью ссылок.',
    code: 'app.post("/preview", (req, res) => {\n  const url = req.body.url;\n  const page = await fetch(url);\n  const og = parseOpenGraph(page);\n  res.json({ title: og.title, image: og.image });\n});',
  },
  {
    name: 'Импорт/экспорт данных по URL',
    short: 'Функции «Импортировать из URL» в SaaS',
    desc: 'Многие SaaS-сервисы позволяют импортировать данные по URL: CSV из ссылки, конфигурация из внешнего источника, синхронизация с API. Если URL принимается без валидации, это SSRF-вектор. Даже whitelist доменов можно обойти через DNS Rebinding или URL-parsing inconsistency.',
    code: 'app.post("/import-csv", (req, res) => {\n  const url = req.body.csv_url;\n  const data = await fetch(url);\n  await parseAndSave(data);\n  res.json({ imported: true });\n});',
  },
  {
    name: 'PDF/HTML рендеринг и конвертация',
    short: 'Сервисы конвертации документов',
    desc: 'Онлайн-сервисы конвертации (HTML в PDF, Markdown в HTML, скриншоты страниц) часто принимают URL от пользователя. Библиотеки рендеринга (wkhtmltopdf, Prince, WeasyPrint) поддерживают file:// и другие протоколы. Кроме SSRF, это открывает путь к SSRF + XSS цепочкам, когда рендеринг HTML выполняет JavaScript в контексте внутреннего сервера.',
    code: 'app.post("/convert", (req, res) => {\n  const url = req.body.url;\n  const pdf = await wkhtmltopdf(url);\n  res.contentType("application/pdf");\n  res.send(pdf);\n});',
  },
  {
    name: 'Системы CI/CD и DevOps',
    short: 'Jenkins, GitLab CI, GitHub Actions с пользовательскими URL',
    desc: 'Системы непрерывной интеграции часто выполняют действия по URL из пользовательского ввода: клонирование репозитория, загрузка артефактов, вызов webhook. В 2021 году критическая SSRF-уязвимость в Jenkins (CVE-2024-23897) позволяла читать файлы через CLI. GitLab Runner может быть скомпрометирован через SSRF в job-конфигурации. Эти системы имеют высокий уровень привилегий в инфраструктуре.',
    code: '// Jenkins Pipeline с пользовательским URL\npipeline {\n  stages {\n    stage("Build") {\n      steps {\n        sh "curl ${params.REPO_URL}/build.sh | bash"\n      }\n    }\n  }\n}',
  },
];

const BYPASS_TECHNIQUES = [
  { technique: 'URL-encoding', payload: 'http://%31%32%37%2e%30%2e%30%2e%31', description: 'URL-кодирование символов IP-адреса', bypasses: 'Чёрные списки со строковым сравнением' },
  { technique: 'Double URL-encoding', payload: 'http://%25%36%31%25%32%37%25%32%65%25%30%25%32%65%25%30%25%32%65%25%31', description: 'Двойное URL-кодирование', bypasses: 'Фильтры, декодирующие только один раз' },
  { technique: 'IPv6 loopback', payload: 'http://[::]:8080/ или http://[0000::1]/', description: 'IPv6-адрес localhost', bypasses: 'Фильтры, проверяющие только IPv4' },
  { technique: 'IPv4-mapped IPv6', payload: 'http://[::ffff:127.0.0.1]/', description: 'IPv4-адрес, встроенный в IPv6', bypasses: 'Фильтры, не обрабатывающие IPv6' },
  { technique: 'Hex IP', payload: 'http://0x7f000001/', description: '127.0.0.1 в шестнадцатеричном формате', bypasses: 'Строковые чёрные списки' },
  { technique: 'Octal IP', payload: 'http://0177.0.0.1/', description: '127.0.0.1 в восьмеричном формате', bypasses: 'Строковые чёрные списки' },
  { technique: 'Decimal IP', payload: 'http://2130706433/', description: '127.0.0.1 в десятичном формате', bypasses: 'Строковые чёрные списки' },
  { technique: 'Shortened IP', payload: 'http://127.1/ или http://127.0.1/', description: 'Сокращённая запись (нули опущены)', bypasses: 'Точные совпадения в фильтре' },
  { technique: 'CIDR range', payload: 'http://127.127.127.127/', description: 'Любой IP из диапазона 127.0.0.0/8', bypasses: 'Фильтры, блокирующие только 127.0.0.1' },
  { technique: 'DNS wildcard', payload: 'http://company.127.0.0.1.nip.io/', description: 'nip.io резолвит IP из поддомена', bypasses: 'Фильтры доменов, не проверяющие DNS' },
  { technique: 'URL credentials', payload: 'http://127.0.0.1@allowed-domain.com/', description: 'Хост до @ используется как реальный', bypasses: 'Whitelist-фильтры доменов' },
  { technique: 'URL fragment', payload: 'http://allowed-domain.com#@127.0.0.1/', description: 'Фрагмент после # обрабатывается по-разному', bypasses: 'Whitelist + naive URL parsing' },
  { technique: '0.0.0.0', payload: 'http://0.0.0.0:8080/', description: 'Unspecified address, часто = localhost', bypasses: 'Фильтры, не блокирующие 0.0.0.0' },
  { technique: 'DNS Rebinding', payload: 'http://rebind.evil.com/', description: 'DNS возвращает разные IP при разных запросах', bypasses: 'Все IP-основанные фильтры' },
  { technique: 'Open redirect', payload: 'http://allowed.com/redirect?url=http://127.0.0.1', description: 'Редирект на внутренний адрес', bypasses: 'Whitelist + HTTP client следует редиректам' },
];

const PROTOCOL_TABLE = [
  { protocol: 'http://', risk: 'Средний', desc: 'Стандартный SSRF-вектор. Доступ к внутренним HTTP-сервисам, админ-панелям, API.' },
  { protocol: 'https://', risk: 'Средний', desc: 'То же, что http, но с TLS. Не добавляет защиты — сертификаты внутренних сервисов часто самоподписанные.' },
  { protocol: 'file://', risk: 'Высокий', desc: 'Чтение локальных файлов: /etc/passwd, .env, SSH-ключи, конфигурации. Не требует сетевого соединения.' },
  { protocol: 'gopher://', risk: 'Критический', desc: 'Отправка произвольных TCP-данных. Позволяет атаковать Redis, Memcached, SMTP. Может привести к RCE.' },
  { protocol: 'dict://', risk: 'Высокий', desc: 'Упрощённая версия gopher. Отправка команд в Redis и другие текстовые протоколы.' },
  { protocol: 'ftp://', risk: 'Средний', desc: 'Доступ к FTP-серверам. Может быть использован для чтения/записи файлов и сканирования портов.' },
  { protocol: 'ldap://', risk: 'Высокий', desc: 'Доступ к LDAP/Active Directory. Утечка учётных данных, структура organisational unit.' },
  { protocol: 'tftp://', risk: 'Средний', desc: 'Trivial FTP. Часто используется для загрузки конфигураций на сетевое оборудование.' },
  { protocol: 'sftp://', risk: 'Средний', desc: 'SSH File Transfer Protocol. Доступ к файлам через SSH, если есть учётные данные.' },
  { protocol: 'netdoc://', risk: 'Средний', desc: 'Java-specific протокол. Аналог file:// для Java-приложений (URLConnection).' },
];

export default function TheorySection() {
  const [expandedItem, setExpandedItem] = useState(null);
  const [activeTab, setActiveTab] = useState('theory');

  const toggleItem = (index) => {
    setExpandedItem(expandedItem === index ? null : index);
  };

  const tabs = [
    { id: 'theory', label: 'Теория' },
    { id: 'types', label: 'Типы SSRF' },
    { id: 'bypass', label: 'Обходы' },
    { id: 'protection', label: 'Защита' },
  ];

  return (
    <section className="theory" id="theory">
      <h2 className="theory__heading">Что такое SSRF?</h2>

      {/* Stats bar */}
      <div className="theory__stats">
        <div className="theory__stat">
          <span className="theory__stat-value">#10</span>
          <span className="theory__stat-label">OWASP Top-10 2021</span>
        </div>
        <div className="theory__stat">
          <span className="theory__stat-value">+452%</span>
          <span className="theory__stat-label">Рост атак (2023-2024)</span>
        </div>
        <div className="theory__stat">
          <span className="theory__stat-value">$190M+</span>
          <span className="theory__stat-label">Ущерб Capital One</span>
        </div>
        <div className="theory__stat">
          <span className="theory__stat-value">CVSS 9.8</span>
          <span className="theory__stat-label">Oracle EBS 2025</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="theory__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`theory__tab ${activeTab === tab.id ? 'theory__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: Theory */}
      {activeTab === 'theory' && (
        <>
          <div className="theory__card">
            <p className="theory__definition">
              <strong>Server-Side Request Forgery (SSRF)</strong> — это уязвимость веб-приложений,
              при которой атакующий заставляет сервер выполнить HTTP-запрос по адресу, который выбирает
              сам атакующий. Ключевое слово — <strong>Server-Side</strong>: запрос делает сервер, а не браузер
              атакующего. Это значит, что запрос идёт из <strong>внутренней сети</strong>, минуя все
              внешние защитные экраны. Уязвимость эксплуатирует <strong>отношения доверия (trust relationships)</strong> между
              сервером и внутренними системами: внутренние сервисы доверяют запросам от «своего» сервера, даже если
              инициатором запроса был внешний атакующий.
            </p>
            <p className="theory__definition">
              SSRF особенно опасна в облачных средах (AWS, GCP, Azure), где внутренние сервисы
              доверяют запросам из той же сети. Метаданные облака (AWS IMDS, GCP metadata, Azure IMDS)
              предоставляют временные учётные данные, конфигурацию и сетевые настройки — всё это
              доступно через SSRF. По данным OWASP, SSRF заняла 10-е место в Top-10 (2021) и
              была #1 в community survey, что отражает рост значимости этой уязвимости.
            </p>
          </div>

          <h3 className="theory__subheading">
            <IoFlame className="theory__subheading-icon" style={{ color: 'var(--danger-color)' }} />
            Почему SSRF опасен? Реальные инциденты
          </h3>
          <p className="theory__section-intro">
            SSRF — не теоретическая угроза. Ниже — реальные инциденты, которые привели к утечкам миллионов
            записей, штрафам на сотни миллионов долларов и компрометации критической инфраструктуры.
          </p>
          <div className="theory__breaches">
            {REAL_BREACHES.map((b, idx) => (
              <div key={idx} className="theory__breach-card">
                <div className="theory__breach-header">
                  <span className="theory__breach-year">{b.year}</span>
                  <span className="theory__breach-company">{b.company}</span>
                </div>
                <p className="theory__breach-impact">{b.impact}</p>
                <p className="theory__breach-desc">{b.desc}</p>
              </div>
            ))}
          </div>

          <h3 className="theory__subheading">Аналогия «на пальцах»</h3>
          <div className="theory__analogy-card">
            <div className="theory__analogy">
              <p>
                Представьте, что вы — <strong>секретарь</strong> в крупной компании. Ваша задача —
                когда кто-то приносит вам бумажку с адресом, вы идёте по этому адресу, берёте то,
                что там лежит, и приносите обратно. Обычно это работает нормально: приносят адрес
                архива — вы несёте папку с документами.
              </p>
              <p>
                Но однажды приходит человек и пишет адрес: <code>«Комната №1, Сейф директора»</code>.
                Вы, как добросовестный секретарь, идёте в эту комнату (которую охрана на входе
                в здание никогда не пустит постороннего) и приносите содержимое сейфа. Человек
                забирает документы и уходит. Вы даже не понимаете, что что-то пошло не так —
                вы же просто выполнили свою работу.
              </p>
              <p>
                В мире веб-приложений: <strong>вы (секретарь)</strong> — это сервер,
                <strong> бумажка с адресом</strong> — это URL, который передаёт пользователь, а
                <strong> комната с сейфом</strong> — это внутренние сервисы (админ-панель, база данных,
                облачные метаданные). Охрана на входе (firewall) пропускает только внешние запросы,
                но сервер — уже внутри, у него есть доступ ко всему.
              </p>
              <div className="theory__analogy-highlight">
                <IoAlertCircle className="theory__analogy-icon" />
                <span>
                  Проблема не в том, что сервер делает запросы — это нормальная функция.
                  Проблема в том, что <strong>сервер не проверяет, куда именно</strong> он ходит.
                  Он доверяет пользователю так же, как секретарь доверяет бумажке с адресом.
                  А внутренние сервисы доверяют серверу — и это создаёт цепочку доверия,
                  которую атакующий эксплуатирует.
                </span>
              </div>
            </div>
          </div>

          <h3 className="theory__subheading">Пошаговая схема атаки</h3>
          <div className="theory__attack-flow">
            {ATTACK_FLOW.map((item, idx) => (
              <div key={item.step} className="theory__flow-item">
                <div
                  className="theory__flow-node"
                  style={{ borderColor: item.color }}
                >
                  <span className="theory__flow-step-num">{item.step}</span>
                  <span className="theory__flow-icon" style={{ color: item.color }}>
                    {item.icon}
                  </span>
                  <span className="theory__flow-label">{item.label}</span>
                </div>
                {idx < ATTACK_FLOW.length - 1 && (
                  <div className="theory__flow-arrow">
                    <IoChevronDown size={20} color="var(--path-arrow)" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="theory__flow-details">
            {ATTACK_FLOW.map((item) => (
              <div key={item.step} className="theory__flow-detail">
                <span className="theory__flow-detail-num" style={{ color: item.color }}>
                  Шаг {item.step}
                </span>
                <span className="theory__flow-detail-text">{item.detail}</span>
              </div>
            ))}
          </div>

          <h3 className="theory__subheading">
            <IoSwapHorizontal className="theory__subheading-icon" style={{ color: 'var(--info-color)' }} />
            SSRF vs CSRF — в чём разница?
          </h3>
          <p className="theory__section-intro">
            SSRF и CSRF часто путают из-за схожих аббревиатур, но это принципиально разные уязвимости.
            SSRF заставляет <strong>сервер</strong> делать запросы, а CSRF заставляет <strong>браузер жертвы</strong> отправлять
            запросы. Ниже — детальное сравнение.
          </p>
          <div className="theory__comparison">
            <div className="theory__comparison-header">
              <span className="theory__comparison-aspect">Аспект</span>
              <span className="theory__comparison-ssrf">SSRF</span>
              <span className="theory__comparison-csrf">CSRF</span>
            </div>
            {SSRF_VS_CSRF.map((row, idx) => (
              <div key={idx} className={`theory__comparison-row ${idx % 2 === 0 ? 'theory__comparison-row--alt' : ''}`}>
                <span className="theory__comparison-aspect">{row.aspect}</span>
                <span className="theory__comparison-ssrf">{row.ssrf}</span>
                <span className="theory__comparison-csrf">{row.csrf}</span>
              </div>
            ))}
          </div>

          <h3 className="theory__subheading">
            <IoWarning className="theory__subheading-icon" style={{ color: 'var(--warning-color)' }} />
            Где встречается SSRF в реальном коде?
          </h3>
          <p className="theory__section-intro">
            Ниже — семь самых частых мест, где возникает SSRF. Нажмите на каждый, чтобы увидеть
            реальный пример уязвимого кода и объяснение, как атакующий его эксплуатирует.
          </p>
          <div className="theory__where-list">
            {WHERE_FOUND.map((item, idx) => (
              <div
                key={idx}
                className={`theory__where-item ${expandedItem === idx ? 'theory__where-item--expanded' : ''}`}
              >
                <button
                  className="theory__where-header"
                  onClick={() => toggleItem(idx)}
                  aria-expanded={expandedItem === idx}
                >
                  <div className="theory__where-header-left">
                    <span className="theory__where-num">{idx + 1}</span>
                    <div>
                      <span className="theory__where-name">{item.name}</span>
                      <span className="theory__where-short">{item.short}</span>
                    </div>
                  </div>
                  {expandedItem === idx ? (
                    <IoChevronUp className="theory__where-chevron" />
                  ) : (
                    <IoChevronDown className="theory__where-chevron" />
                  )}
                </button>
                {expandedItem === idx && (
                  <div className="theory__where-body">
                    <p className="theory__where-desc">{item.desc}</p>
                    <div className="theory__code-block">
                      <div className="theory__code-label">Уязвимый код (пример):</div>
                      <pre><code>{item.code}</code></pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* TAB: Types */}
      {activeTab === 'types' && (
        <>
          <h3 className="theory__subheading">
            <IoEyeOff className="theory__subheading-icon" style={{ color: 'var(--danger-color)' }} />
            Типы SSRF-атак
          </h3>
          <p className="theory__section-intro">
            Не все SSRF одинаковы. В зависимости от того, видит ли атакующий ответ, выделяют три типа.
            Тип определяет метод обнаружения и сложность эксплуатации.
          </p>
          <div className="theory__types-grid">
            {SSRF_TYPES.map((t, idx) => (
              <div key={idx} className="theory__type-card" style={{ borderTopColor: t.color }}>
                <div className="theory__type-header">
                  <span className="theory__type-icon" style={{ color: t.color }}>{t.icon}</span>
                  <h4 className="theory__type-name">{t.name}</h4>
                </div>
                <p className="theory__type-desc">{t.desc}</p>
                <div className="theory__type-example">
                  <strong>Пример:</strong> {t.example}
                </div>
                <div className="theory__type-detect">
                  <strong>Обнаружение:</strong> {t.detectability}
                </div>
              </div>
            ))}
          </div>

          <h3 className="theory__subheading">
            <IoCode className="theory__subheading-icon" style={{ color: 'var(--primary-color)' }} />
            Протоколы эксплуатации
          </h3>
          <p className="theory__section-intro">
            SSRF не ограничивается HTTP/HTTPS. Разные протоколы открывают разные векторы атаки.
            file:// читает файлы, gopher:// отправляет произвольные TCP-данные (ведёт к RCE),
            dict:// interacts с текстовыми протоколами. Отключение поддержки не-HTTP протоколов —
            базовый шаг защиты.
          </p>
          <div className="theory__protocol-table">
            <div className="theory__protocol-header">
              <span>Протокол</span>
              <span>Уровень риска</span>
              <span>Описание</span>
            </div>
            {PROTOCOL_TABLE.map((p, idx) => (
              <div key={idx} className={`theory__protocol-row ${idx % 2 === 0 ? 'theory__protocol-row--alt' : ''}`}>
                <span className="theory__protocol-name"><code>{p.protocol}</code></span>
                <span className={`theory__protocol-risk theory__protocol-risk--${p.risk.toLowerCase().includes('крит') ? 'critical' : p.risk.toLowerCase().includes('выс') ? 'high' : 'medium'}`}>{p.risk}</span>
                <span className="theory__protocol-desc">{p.desc}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* TAB: Bypass */}
      {activeTab === 'bypass' && (
        <>
          <h3 className="theory__subheading">
            <IoFlash className="theory__subheading-icon" style={{ color: 'var(--warning-color)' }} />
            Техники обхода SSRF-фильтров
          </h3>
          <p className="theory__section-intro">
            Ни одна SSRF-защита на основе чёрных или белых списков не является надёжной на 100%.
            Инconsistency в URL-парсинге между валидатором и HTTP-клиентом — фундаментальная проблема.
            Ниже — 15 проверенных техник обхода из реальных bug bounty отчётов и CTF.
          </p>
          <div className="theory__bypass-table">
            <div className="theory__bypass-header">
              <span>Техника</span>
              <span>Payload</span>
              <span>Описание</span>
              <span>Обходит</span>
            </div>
            {BYPASS_TECHNIQUES.map((b, idx) => (
              <div key={idx} className={`theory__bypass-row ${idx % 2 === 0 ? 'theory__bypass-row--alt' : ''}`}>
                <span className="theory__bypass-technique">{b.technique}</span>
                <span className="theory__bypass-payload"><code>{b.payload}</code></span>
                <span className="theory__bypass-description">{b.description}</span>
                <span className="theory__bypass-target">{b.bypasses}</span>
              </div>
            ))}
          </div>
          <div className="theory__bypass-note">
            <IoAlertCircle className="theory__bypass-note-icon" />
            <div>
              <strong>Ключевой вывод:</strong> Единственная надёжная защита — whitelist конкретных доменов
              с DNS-pinining (resolving до IP, проверка IP, и использование того же IP для соединения,
              без повторного DNS-запроса). Чёрные списки IP и строковые проверки URL всегда обходимы.
            </div>
          </div>
        </>
      )}

      {/* TAB: Protection */}
      {activeTab === 'protection' && (
        <>
          <h3 className="theory__subheading">
            <IoShieldCheckmark className="theory__subheading-icon" style={{ color: 'var(--success-color)' }} />
            Как защититься от SSRF?
          </h3>
          <p className="theory__section-intro">
            Защита от SSRF требует многоуровневого подхода (defense in depth). Ни один метод
            не является достаточным сам по себе. Комбинируйте несколько слоёв для максимальной защиты.
          </p>
          <div className="theory__protection-card">
            <div className="theory__protection-grid">
              <div className="theory__protection-item">
                <h4 className="theory__protection-title">1. Whitelist доменов с DNS-pinining</h4>
                <p>
                  Вместо блокирования «плохих» адресов (чёрный список), разрешите только
                  конкретные домены. Разрешите, например, только
                  <code>https://images.example.com</code>. Все остальные URL отклоняйте.
                  <strong> Критически важно:</strong> делайте DNS-запрос самостоятельно,
                  проверьте полученный IP, и используйте этот IP для соединения (DNS pinning).
                  Не позволяйте HTTP-клиенту делать свой DNS-запрос — это защищает от DNS Rebinding.
                </p>
              </div>
              <div className="theory__protection-item">
                <h4 className="theory__protection-title">2. Ограничение протоколов</h4>
                <p>
                  Разрешите только <code>http://</code> и <code>https://</code>. Отключите
                  поддержку <code>file://</code>, <code>gopher://</code>, <code>dict://</code>, <code>ftp://</code> и
                  всех других протоколов в HTTP-клиенте. В cURL: <code>CURLOPT_PROTOCOLS</code>.
                  В Python requests: проверяйте scheme перед запросом. В Java: ограничьте URI schemes.
                  Это блокирует атаки через gopher:// (Redis RCE) и file:// (чтение файлов).
                </p>
              </div>
              <div className="theory__protection-item">
                <h4 className="theory__protection-title">3. Сетевая изоляция (VPC / egress)</h4>
                <p>
                  Запустите сервер, который делает исходящие запросы, в отдельной сети (VPC, subnet)
                  без доступа к внутренним сервисам и метаданным облака. Даже если SSRF произошёл,
                  сервер не сможет достучаться до админ-панели или метаданных. В AWS это «VPC endpoint
                  для метаданных» или полностью отключённый IMDS. Используйте egress-фильтры на firewall
                  для ограничения исходящих подключений.
                </p>
              </div>
              <div className="theory__protection-item">
                <h4 className="theory__protection-title">4. Включите IMDSv2 (AWS) / Equivalent</h4>
                <p>
                  В AWS включите Instance Metadata Service v2 — она требует PUT-запрос для получения
                  токена, а затем токен передаётся в GET-запросе. Простой GET к 169.254.169.254 больше
                  не работает. Это блокирует самый опасный вектор — чтение облачных метаданных.
                  Аналогичные настройки есть в GCP (metadata token) и Azure (managed identity).
                </p>
              </div>
              <div className="theory__protection-item">
                <h4 className="theory__protection-title">5. Используйте выделенный HTTP-клиент</h4>
                <p>
                  Используйте библиотеку, которая не поддерживает не-HTTP протоколы по умолчанию
                  и позволяет контролировать DNS-резолвинг. Примеры: Python <code>httpx</code> вместо <code>requests</code>,
                  Go <code>net/http</code> с кастомным Dialer, Java <code>OkHttp</code> с Dns resolver.
                  Никогда не используйте сырой ввод URL — если возможно, используйте идентификаторы
                  вместо полных URL (пользователь выбирает «изображение №42» из списка).
                </p>
              </div>
              <div className="theory__protection-item">
                <h4 className="theory__protection-title">6. Мониторинг и обнаружение</h4>
                <p>
                  Внедрите мониторинг исходящих запросов: логируйте все URL, IP и порты, к которым
                  обращается сервер. Настраивте алерты на запросы к 169.254.169.254, 127.0.0.1,
                  10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16. Используйте NDR (Network Detection
                  and Response) для выявления аномальных исходящих соединений от веб-серверов.
                  Мониторинг — последний рубеж обороны, когда всё остальное не сработало.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Links — always visible */}
      <h3 className="theory__subheading">Полезные ссылки для углублённого изучения</h3>
      <div className="theory__links">
        <a
          href="https://owasp.org/www-community/attacks/Server_Side_Request_Forgery"
          target="_blank"
          rel="noopener noreferrer"
          className="theory__link"
        >
          <IoOpen />
          <div>
            <span className="theory__link-title">OWASP — SSRF</span>
            <span className="theory__link-desc">Официальное описание уязвимости от OWASP Foundation</span>
          </div>
        </a>
        <a
          href="https://portswigger.net/web-security/ssrf"
          target="_blank"
          rel="noopener noreferrer"
          className="theory__link"
        >
          <IoOpen />
          <div>
            <span className="theory__link-title">PortSwigger — SSRF</span>
            <span className="theory__link-desc">Лучшее в мире руководство с бесплатными лабораториями</span>
          </div>
        </a>
        <a
          href="https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html"
          target="_blank"
          rel="noopener noreferrer"
          className="theory__link"
        >
          <IoOpen />
          <div>
            <span className="theory__link-title">OWASP — Prevention Cheat Sheet</span>
            <span className="theory__link-desc">Чеклист по защите от SSRF от авторитетного источника</span>
          </div>
        </a>
        <a
          href="https://learn.snyk.io/lesson/ssrf-server-side-request-forgery"
          target="_blank"
          rel="noopener noreferrer"
          className="theory__link"
        >
          <IoOpen />
          <div>
            <span className="theory__link-title">Snyk — Что такое SSRF</span>
            <span className="theory__link-desc">Учебник с примерами на JavaScript, векторы и защита</span>
          </div>
        </a>
        <a
          href="https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Server%20Side%20Request%20Forgery/README.md"
          target="_blank"
          rel="noopener noreferrer"
          className="theory__link"
        >
          <IoOpen />
          <div>
            <span className="theory__link-title">PayloadsAllTheThings — SSRF</span>
            <span className="theory__link-desc">Полный список payloads, техник обхода и методологии</span>
          </div>
        </a>
      </div>
    </section>
  );
}