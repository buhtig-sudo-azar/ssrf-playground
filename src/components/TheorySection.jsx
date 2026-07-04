import { useState } from 'react';
import {
  IoAlertCircle, IoGlobe, IoLockClosed, IoServer,
  IoChevronDown, IoChevronUp, IoOpen,
  IoShieldCheckmark, IoFlame, IoWarning
} from 'react-icons/io5';
import './TheorySection.css';

const WHERE_FOUND = [
  {
    name: 'Загрузка файлов по URL',
    short: 'Функция «Загрузить изображение по ссылке»',
    desc: 'Одна из самых частых причин SSRF. Приложение предлагает пользователю загрузить изображение, документ или видео по URL-адресу. Сервер скачивает файл и сохраняет его. Если нет проверки, куда именно сервер ходит, атакующий подставляет внутренний адрес вместо ссылки на файл. Этот вектор был использован в знаменитой атаке на Capital One (2019), когда через функцию загрузки получили доступ к AWS-метаданным.',
    code: 'app.post("/fetch-image", (req, res) => {\n  const url = req.body.url; // пользователь вводит URL\n  const image = await fetch(url);   // сервер делает запрос\n  res.send(image);\n});',
  },
  {
    name: 'Webhook и callback URL',
    short: 'Пользователь указывает URL для обратного вызова',
    desc: 'Многие сервисы (платёжные системы, интеграции, уведомления) позволяют пользователю указать URL, на который сервис отправит HTTP-запрос при наступлении события. Это называется webhook или callback. Если атакующий может указать этот URL, он может направить запрос на внутренний адрес сервера. Например, при оплате через платёжную систему указать callback URL = http://127.0.0.1:8080/admin — и платёжная система «проксирует» запрос.',
    code: 'app.post("/subscribe", (req, res) => {\n  const callback = req.body.callback_url; // пользователь вводит\n  await fetch(callback, {          // сервер отправляет запрос\n    method: "POST",\n    body: JSON.stringify(event)\n  });\n});',
  },
  {
    name: 'Генерация PDF из URL',
    short: 'Конвертация HTML-страницы в PDF через headless-браузер',
    desc: 'Инструменты вроде wkhtmltopdf, Puppeteer или Playwright конвертируют веб-страницу в PDF. Если URL передаётся пользователем, headless-браузер может посетить любой адрес, включая внутренние. Более того, многие из этих инструментов поддерживают протокол file://, что позволяет читать файлы с сервера. Это комбинированный вектор: SSRF + чтение файлов.',
    code: 'app.post("/generate-pdf", (req, res) => {\n  const url = req.body.url;  // пользователь вводит\n  const pdf = await puppeteer.pdf(url); // headless-браузер идёт по URL\n  res.send(pdf);\n});',
  },
  {
    name: 'URL-превью и фавиконки',
    short: 'Сервис показывает превью ссылки (как в Telegram или Slack)',
    desc: 'Когда вы отправляете ссылку в мессенджер, он показывает превью: заголовок, описание, картинку. Для этого сервер мессенджера посещает URL. Если атакующий контролирует отправляемый URL, он может заставить сервер посетить внутренний адрес. Это касается не только мессенджеров, но и любых сервисов, которые показывают Open Graph теги или скачивают фавиконки.',
    code: 'app.post("/preview", (req, res) => {\n  const url = req.body.url;\n  const page = await fetch(url);\n  const title = parseOgTitle(page);\n  res.json({ title });\n});',
  },
  {
    name: 'Импорт/экспорт данных по URL',
    short: 'Функции «Импортировать из URL» в SaaS-сервисах',
    desc: 'Многие SaaS-сервисы позволяют импортировать данные по URL: импорт CSV из ссылки, загрузка конфигурации из внешнего источника, синхронизация с внешним API. Если URL принимается от пользователя без валидации, это SSRF-вектор. Даже если URL должен быть из определённого домена (например, api.partner.com), атакующий может зарегистрировать подобный домен или использовать уязвимости DNS.',
    code: 'app.post("/import-csv", (req, res) => {\n  const url = req.body.csv_url;\n  const data = await fetch(url);  // скачивает откуда угодно\n  await parseAndSave(data);\n  res.json({ imported: true });\n});',
  },
];

const ATTACK_FLOW = [
  {
    step: 1,
    label: 'Атакующий',
    icon: <IoGlobe />,
    color: 'var(--accent-color)',
    detail: 'Отправляет crafted-запрос с опасным URL на уязвимый сервер'
  },
  {
    step: 2,
    label: 'Уязвимый сервер',
    icon: <IoServer />,
    color: 'var(--warning-color)',
    detail: 'Получает URL от пользователя и делает HTTP-запрос по нему без проверки'
  },
  {
    step: 3,
    label: 'Внутренний ресурс',
    icon: <IoLockClosed />,
    color: 'var(--danger-color)',
    detail: 'Возвращает конфиденциальные данные, потому что запрос пришёл от «своего» сервера'
  },
];

const REAL_BREACHES = [
  {
    year: '2019',
    company: 'Capital One',
    impact: '106 млн клиентов, ущерб $190M+',
    desc: 'Через SSRF на веб-приложении атакующая получила IAM-ключи из AWS метаданных и скачала данные клиентов из S3. Одна из крупнейших утечек данных в истории.',
  },
  {
    year: '2021',
    company: 'Microsoft Exchange (ProxyLogon)',
    impact: 'Тысячи серверов по всему миру',
    desc: 'Уязвимость в Microsoft Exchange позволяла выполнять SSRF на внутренние сервисы почтового сервера. Использовалась для установки веб-шеллов и кражи почты.',
  },
  {
    year: '2023',
    company: 'Multiple Cloud Providers',
    impact: 'Продемонстрирована уязвимость всех блоклистов',
    desc: 'Исследователи показали, что DNS Rebinding позволяет обойти SSRF-защиту любого облачного провайдера, включая AWS, GCP и Azure.',
  },
];

export default function TheorySection() {
  const [expandedItem, setExpandedItem] = useState(null);

  const toggleItem = (index) => {
    setExpandedItem(expandedItem === index ? null : index);
  };

  return (
    <section className="theory" id="theory">
      <h2 className="theory__heading">Что такое SSRF?</h2>

      <div className="theory__card">
        <p className="theory__definition">
          <strong>Server-Side Request Forgery (SSRF)</strong> — это уязвимость веб-приложений,
          при которой атакующий заставляет сервер выполнить HTTP-запрос по адресу, который выбирает
          сам атакующий. Ключевое слово — <strong>Server-Side</strong>: запрос делает сервер, а не браузер
          атакующего. Это значит, что запрос идёт из <strong>внутренней сети</strong>, минуя все
          внешние защитные экраны.
        </p>
        <p className="theory__definition">
          Представьте: у вас есть дом с охраной на входе. Снаружи никого не пускают. Но внутри дома
          есть служебный коридор, который ведёт в комнату с сейфом. Секретарь (сервер) имеет доступ
          к этому коридору. Если злоумышленник убедит секретаря «пройди по этому адресу», секретарь
          откроет сейф и принесёт содержимое — потому что для него это нормальный запрос.
        </p>
        <p className="theory__definition">
          SSRF находится на <strong>10-м месте</strong> в списке OWASP Top-10 (2021) уязвимостей
          веб-приложений. Она особенно опасна в облачных средах (AWS, GCP, Azure), где внутренние
          сервисы доверяют запросам из той же сети.
        </p>
      </div>

      <h3 className="theory__subheading">
        <IoFlame className="theory__subheading-icon" style={{ color: 'var(--danger-color)' }} />
        Почему SSRF опасен? Реальные взломы
      </h3>
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
        <IoWarning className="theory__subheading-icon" style={{ color: 'var(--warning-color)' }} />
        Где встречается SSRF в реальном коде?
      </h3>
      <p className="theory__section-intro">
        Ниже — пять самых частых мест, где возникает SSRF. Нажмите на каждый, чтобы увидеть
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

      <h3 className="theory__subheading">
        <IoShieldCheckmark className="theory__subheading-icon" style={{ color: 'var(--success-color)' }} />
        Как защититься от SSRF?
      </h3>
      <div className="theory__protection-card">
        <div className="theory__protection-grid">
          <div className="theory__protection-item">
            <h4 className="theory__protection-title">1. Белый список URL</h4>
            <p>
              Вместо того чтобы блокировать «плохие» адреса (чёрный список), разрешите только
              конкретные домены. Например, если функция загружает изображения, разрешите только
              <code>https://images.example.com</code>. Все остальные URL отклоняйте. Это
              самый эффективный метод, потому что он не зависит от знаний атакующего.
            </p>
          </div>
          <div className="theory__protection-item">
            <h4 className="theory__protection-title">2. Проверка после DNS-резолвинга</h4>
            <p>
              Проверяйте IP-адрес <strong>после</strong> DNS-запроса, а не до. Используйте
              библиотеки, которые дают вам контроль над резолвингом. Это защищает от DNS
              Rebinding: даже если DNS вернёт другой IP при фактическом запросе, вы проверите
              IP перед отправкой данных.
            </p>
          </div>
          <div className="theory__protection-item">
            <h4 className="theory__protection-title">3. Ограничение протоколов</h4>
            <p>
              Разрешите только <code>http://</code> и <code>https://</code>. Отключите
              поддержку <code>file://</code>, <code>gopher://</code>, <code>ftp://</code> и
              других протоколов в HTTP-клиенте. В cURL это делается опцией <code>CURLOPT_PROTOCOLS</code>.
            </p>
          </div>
          <div className="theory__protection-item">
            <h4 className="theory__protection-title">4. Сетевая изоляция</h4>
            <p>
              Запустите сервер, который делает запросы, в отдельной сети (VPC, subnet) без
              доступа к внутренним сервисам. Даже если SSRF произошёл, сервер не сможет
              достучаться до админ-панели или метаданных. В AWS это называется «VPC endpoint
              для метаданных» или «IMDSv2».
            </p>
          </div>
          <div className="theory__protection-item">
            <h4 className="theory__protection-title">5. Используйте IMDSv2 в AWS</h4>
            <p>
              Включите Instance Metadata Service v2 — она требует токен, который получается через
              PUT-запрос. Простой GET-запрос к 169.254.169.254 больше не работает. Это блокирует
              самый опасный вектор — чтение облачных метаданных.
            </p>
          </div>
          <div className="theory__protection-item">
            <h4 className="theory__protection-title">6. Не используйте сырой ввод</h4>
            <p>
              Если возможно, вообще не позволяйте пользователю указывать полный URL. Вместо
              этого используйте идентификаторы: пользователь выбирает «изображение №42» из
              списка, а сервер сам знает, откуда его брать. Если URL необходим — валидируйте
              его на уровне библиотеки, а не регулярными выражениями.
            </p>
          </div>
        </div>
      </div>

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
            <span className="theory__link-desc">Официальное описание уязвимости от OWASP</span>
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
            <span className="theory__link-desc">Подробное руководство с лабораторными работами</span>
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
            <span className="theory__link-desc">Чеклист по защите от SSRF</span>
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
            <span className="theory__link-desc">Учебник с примерами на JavaScript, векторы атак и методы защиты</span>
          </div>
        </a>
      </div>
    </section>
  );
}