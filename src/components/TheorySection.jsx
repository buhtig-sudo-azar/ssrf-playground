import { useState } from 'react';
import { IoAlertCircle, IoGlobe, IoLockClosed, IoServer, IoChevronDown, IoChevronUp, IoLink, IoOpen } from 'react-icons/io5';
import './TheorySection.css';

const WHERE_FOUND = [
  { name: 'Прокси-серверы и URL-фечеры', desc: 'Приложение принимает URL и делает запрос от имени сервера' },
  { name: 'Импорт по URL', desc: 'Функции загрузки изображений, PDF, XML по ссылке' },
  { name: 'Webhooks (callback URL)', desc: 'Пользователь указывает URL для обратного вызова' },
  { name: 'PDF-генераторы', desc: 'Конвертация HTML-страницы в PDF через headless-браузер' },
  { name: 'Аналитика и пре-рендер', desc: 'Сервисы, которые посещают указанную ссылку для превью' },
];

const ATTACK_FLOW = [
  { step: 1, label: 'Атакующий', icon: <IoGlobe />, color: 'var(--accent-color)' },
  { step: 2, label: 'Уязвимый сервер', icon: <IoServer />, color: 'var(--warning-color)' },
  { step: 3, label: 'Внутренний ресурс', icon: <IoLockClosed />, color: 'var(--danger-color)' },
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
          <strong>Server-Side Request Forgery (SSRF)</strong> — это уязвимость, при которой атакующий
          заставляет серверное приложение выполнять HTTP-запросы по адресу, который выбирает сам атакующий.
          Сервер выступает в роли <strong>прокси</strong>: он отправляет запрос от своего имени и возвращает
          ответ атакующему. Это позволяет обойти firewall и получить доступ к внутренним сервисам,
          которые не доступны напрямую из интернета.
        </p>
      </div>

      <h3 className="theory__subheading">Аналогия «на пальцах»</h3>
      <div className="theory__analogy-card">
        <div className="theory__analogy">
          <p>
            Представьте, что вы — <strong>секретарь</strong> в офисе. Ваша работа — когда кто-то
            просит: «Сделайте копию этого документа», вы идёте к копировальному аппарату и
            приносите копию.
          </p>
          <p>
            Но представьте, что вместо документа вам дают <strong>URL-адрес</strong> и говорят:
            «Зайдите по этому адресу и принесите то, что там лежит». Вы — доверчивый
            секретарь — идёте по этому адресу и приносите ответ.
          </p>
          <p>
            Если злоумышленник вместо публичного сайта укажет адрес <code>http://127.0.0.1/admin</code>,
            вы пойдёте в <strong>комнату начальника</strong> (которая закрыта для посторонних) и
            принесёте оттуда конфиденциальные документы. Вы-то имеете доступ, а злоумышленник — нет,
            но через вас он его получает.
          </p>
          <div className="theory__analogy-highlight">
            <IoAlertCircle className="theory__analogy-icon" />
            <span>
              Именно так работает SSRF: <strong>сервер</strong> — это секретарь, а
              <strong> злоумышленник</strong> — это человек, который даёт ему «плохой» адрес.
            </span>
          </div>
        </div>
      </div>

      <h3 className="theory__subheading">Схема атаки</h3>
      <div className="theory__attack-flow">
        {ATTACK_FLOW.map((item, idx) => (
          <div key={item.step} className="theory__flow-item">
            <div
              className="theory__flow-node"
              style={{ borderColor: item.color }}
            >
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

      <h3 className="theory__subheading">Где встречается SSRF?</h3>
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
              <span className="theory__where-name">{item.name}</span>
              {expandedItem === idx ? (
                <IoChevronUp className="theory__where-chevron" />
              ) : (
                <IoChevronDown className="theory__where-chevron" />
              )}
            </button>
            {expandedItem === idx && (
              <div className="theory__where-desc">
                <p>{item.desc}</p>
                <p>
                  Пример: функция «Импортировать изображение по URL» — если она
                  скачивает файл с сервера, то атакующий может указать
                  <code>http://169.254.169.254/...</code> вместо изображения.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <h3 className="theory__subheading">Полезные ссылки</h3>
      <div className="theory__links">
        <a
          href="https://owasp.org/www-community/attacks/Server_Side_Request_Forgery"
          target="_blank"
          rel="noopener noreferrer"
          className="theory__link"
        >
          <IoOpen />
          <span>OWASP — Server-Side Request Forgery</span>
        </a>
        <a
          href="https://portswigger.net/web-security/ssrf"
          target="_blank"
          rel="noopener noreferrer"
          className="theory__link"
        >
          <IoOpen />
          <span>PortSwigger — SSRF</span>
        </a>
        <a
          href="https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html"
          target="_blank"
          rel="noopener noreferrer"
          className="theory__link"
        >
          <IoOpen />
          <span>OWASP — SSRF Prevention Cheat Sheet</span>
        </a>
      </div>
    </section>
  );
}