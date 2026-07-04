export const scenarios = [
  {
    id: 1,
    name: 'Чтение облачных метаданных AWS',
    category: 'Облако',
    description:
      'Атакующий заставляет сервер обратиться к внутреннему IP 169.254.169.254 — это эндпойнт метаданных AWS. Оттуда можно получить временные IAM-ключи, которые дают доступ к S3, DynamoDB и другим сервисам.',
    placeholder: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/admin-role',
    matchUrl: (url) =>
      url.includes('169.254.169.254') || url.includes('metadata'),
    emulatedResponse: (url) => {
      if (url.includes('iam/security-credentials')) {
        return {
          Code: 'Success',
          LastUpdated: '2024-12-01T10:00:00Z',
          Type: 'AWS-HMAC',
          AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          Token: 'FQoGZXIvYXdzEGMaDNuOEXAMPLE==',
          Expiration: '2024-12-01T16:00:00Z',
        };
      }
      if (url.includes('meta-data/ami-id')) {
        return 'ami-0abcdef1234567890';
      }
      if (url.includes('meta-data/local-ipv4')) {
        return '10.0.1.42';
      }
      return { status: 404, error: 'Not Found', message: 'Указанный путь метаданных не найден' };
    },
    explanation:
      'В AWS каждые 6 часов автоматически генерируются временные ключи для роли EC2-инстанса. Если приложение уязвимо к SSRF, атакующий может получить эти ключи и использовать их для доступа к облачным ресурсам — даже если приложение не хранит никаких секретов явно.',
    severity: 'critical',
  },
  {
    id: 2,
    name: 'Доступ к внутренней админ-панели (localhost)',
    category: 'Внутренние сервисы',
    description:
      'Атакующий использует URL вида http://localhost/admin или http://127.0.0.1:8080/manage для доступа к внутренним панелям управления, которые недоступны извне.',
    placeholder: 'http://localhost:8080/admin/users',
    matchUrl: (url) =>
      url.includes('localhost') || url.includes('127.0.0.1'),
    emulatedResponse: (url) => {
      if (url.includes('/admin') || url.includes('/manage')) {
        return {
          status: 200,
          page: 'Admin Panel',
          users: [
            { id: 1, username: 'admin', role: 'superadmin', email: 'admin@company.internal' },
            { id: 2, username: 'db_user', role: 'dba', email: 'dba@company.internal' },
            { id: 3, username: 'svc_backup', role: 'service', email: 'backup@company.internal' },
          ],
          sessions: 42,
          warning: 'Панель управления доступна без дополнительной аутентификации из внутренней сети',
        };
      }
      if (url.includes(':8080') || url.includes(':3000')) {
        return {
          status: 200,
          service: 'Internal API Gateway',
          version: '2.1.0',
          endpoints: ['/api/v1/users', '/api/v1/config', '/api/v1/debug', '/health'],
          notice: 'Debug endpoint is enabled',
        };
      }
      return { status: 404, error: 'Service not found on specified port' };
    },
    explanation:
      'Многие внутренние сервисы (админ-панели, API-шлюзы, monitoring) слушают только на localhost/127.0.0.1, потому что разработчики считают это достаточной защитой. Но SSRF позволяет атакующему «прыгнуть» через уязвимый сервер прямо к этим сервисам, минуя сетевые экраны.',
    severity: 'high',
  },
  {
    id: 3,
    name: 'Чтение локальных файлов (file://)',
    category: 'Файловая система',
    description:
      'Некоторые библиотеки HTTP-клиентов поддерживают протокол file://. Атакующий может использовать это для чтения файлов с сервера: /etc/passwd, конфигурации, ключей.',
    placeholder: 'file:///etc/passwd',
    matchUrl: (url) => url.startsWith('file://'),
    emulatedResponse: (url) => {
      if (url.includes('/etc/passwd')) {
        return `root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
appuser:x:1000:1000:Application User:/home/appuser:/bin/bash
postgres:x:109:117:PostgreSQL:/var/lib/postgresql:/bin/bash`;
      }
      if (url.includes('/etc/shadow')) {
        return { status: 403, error: 'Permission denied' };
      }
      if (url.includes('.env') || url.includes('config') || url.includes('secret')) {
        return `DB_HOST=10.0.1.10
DB_USER=app_user
DB_PASS=Sup3rS3cretP@ssw0rd!
AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
REDIS_URL=redis://10.0.1.20:6379
JWT_SECRET=eyJhbGciOiJIUzI1NiJ9...`;
      }
      return { status: 404, error: 'File not found' };
    },
    explanation:
      'Протокол file:// позволяет читать файлы из локальной файловой системы. Если сервер использует библиотеку, которая его поддерживает (например, некоторые версии cURL, Python requests с определёнными настройками, Java HttpURLConnection), атакующий может прочитать конфигурационные файлы, хеши паролей, SSH-ключи и другое. Чтение /etc/passwd даёт информацию о пользователях системы, а .env — доступ к секретам приложения.',
    severity: 'high',
  },
  {
    id: 4,
    name: 'Сканирование внутренних портов',
    category: 'Разведка',
    description:
      'Атакующий может определить, какие порты открыты на внутреннем сервере, по времени ответа или коду ошибки при обращении к разным портам.',
    placeholder: 'http://192.168.1.1:3306',
    matchUrl: (url) => {
      const portMatch = url.match(/:(\d+)/);
      if (portMatch) {
        const port = parseInt(portMatch[1], 10);
        return port !== 80 && port !== 443;
      }
      return false;
    },
    emulatedResponse: (url) => {
      const portMatch = url.match(/:(\d+)/);
      if (!portMatch) return { status: 400, error: 'No port specified' };

      const port = parseInt(portMatch[1], 10);
      const knownPorts = {
        22: { service: 'SSH', version: 'OpenSSH 8.9', banner: 'SSH-2.0-OpenSSH_8.9' },
        3306: { service: 'MySQL', version: '8.0.35', response: 'J\u00005.7.42-log\u0000...protocol mismatch' },
        5432: { service: 'PostgreSQL', version: '15.4', response: 'PostgreSQL 15.4 protocol negotiation' },
        6379: { service: 'Redis', version: '7.2.3', banner: '# Redis version=7.2.3' },
        8080: { service: 'HTTP (Tomcat/Jetty)', version: 'Apache Tomcat/9.0.85' },
        27017: { service: 'MongoDB', version: '7.0.4', response: 'MongoDB server version: 7.0.4' },
        9200: { service: 'Elasticsearch', version: '8.11.1', info: 'Elasticsearch cluster: production' },
      };

      if (knownPorts[port]) {
        return {
          status: 200,
          found: true,
          port,
          ...knownPorts[port],
          note: 'Сервис ответил — порт открыт и доступен из сети уязвимого сервера',
        };
      }

      return {
        status: 'connection refused',
        found: false,
        port,
        note: 'Соединение отклонено — порт закрыт или сервис не запущен',
      };
    },
    explanation:
      'Путём перебора портов (например, 22, 3306, 5432, 6379, 8080, 27017) и анализа ответов атакующий может составить карту внутренней сети: какие базы данных, кэши, веб-серверы и другие сервисы работают на сервере. Это сильно упрощает дальнейшую атаку, потому что атакующий точно знает, куда наносить следующий удар.',
    severity: 'medium',
  },
  {
    id: 5,
    name: 'Обход через DNS Rebinding',
    category: 'Продвинутые техники',
    description:
      'Атакующий регистрирует домен, который в первый запрос резолвится на публичный IP (проходит проверку), а во второй — на внутренний IP (127.0.0.1 или 169.254.169.254).',
    placeholder: 'http://evil.rebind.attacker.com/reset-password',
    matchUrl: (url) => url.includes('rebind') || url.includes('attacker.com'),
    emulatedResponse: (url) => {
      return {
        dns_log: [
          { request: 1, timestamp: '10:00:00.001', domain: 'evil.rebind.attacker.com', resolved: '93.184.216.34', note: 'Публичный IP — проверка пройдена' },
          { request: 2, timestamp: '10:00:00.150', domain: 'evil.rebind.attacker.com', resolved: '169.254.169.254', note: 'Внутренний IP — запрос отправлен на метаданные AWS' },
        ],
        filter_result: 'PASS — IP не в блоклисте (93.184.216.34)',
        actual_target: '169.254.169.254/latest/meta-data/',
        response: {
          Code: 'Success',
          AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          Token: 'FQoGZXIvYXdzEGMaDNuO..."',
        },
        explanation: 'Сервер проверил IP первого DNS-запроса, но фактический HTTP-запрос ушёл на IP второго разрешения. Фильтр обойдён.',
      };
    },
    explanation:
      'DNS Rebinding — это техника, при которой DNS-сервер атакующего возвращает разные IP-адреса для быстрых последовательных запросов. Защита проверяет первый запрос и видит «безопасный» публичный IP, но когда сервер фактически выполняет HTTP-запрос, DNS уже возвращает внутренний адрес. Это один из самых сложных векторов для защиты, потому что стандартные блоклисты IP-адресов не помогают.',
    severity: 'critical',
  },
];

export function findMatchingScenario(url) {
  const trimmed = url.trim();
  for (const scenario of scenarios) {
    if (scenario.matchUrl(trimmed)) {
      return scenario;
    }
  }
  return null;
}

export function getEmulatedResponse(url) {
  const scenario = findMatchingScenario(url);
  if (!scenario) {
    return {
      found: false,
      status: 404,
      error: 'Not Found',
      message: 'Ответ сервера: 404 Not Found (эмулировано). Указанный URL не соответствует ни одному известному вектору SSRF-атаки.',
      hint: 'Попробуйте: http://169.254.169.254/latest/meta-data/, http://localhost/admin, file:///etc/passwd',
    };
  }
  const response = scenario.emulatedResponse(url);
  return {
    found: true,
    scenarioName: scenario.name,
    scenarioId: scenario.id,
    severity: scenario.severity,
    category: scenario.category,
    data: response,
  };
}