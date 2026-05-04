
import styles from "./Home.module.css";

const highlights = [
  {
    title: "Быстрый старт",
    description: "Создайте аккаунт и начните работу за пару минут с готовыми подсказками и профилем.",
  },
  {
    title: "Управление задачами",
    description: "Публикуйте задания, назначайте исполнителей и отслеживайте прогресс по статусам.",
  },
  {
    title: "Умный поиск",
    description: "Фильтруйте вакансии по категориям, статусу и локации, отправляйте отклики в пару кликов.",
  },
  {
    title: "Чат в стиле мессенджера",
    description: "Список диалогов слева, активный чат справа, синхронные сообщения и непрочитанные.",
  },
  {
    title: "Результаты и отзывы",
    description: "Подтверждайте выполнение, закрывайте отклики и обменивайтесь отзывами после завершения.",
  },
];

const Home = () => (
  <main className={`page home-page ${styles.root}`}>
    <section className="card hero">
      <div>
        <p className="badge">Платформа для работодателей и специалистов</p>
        <h1>Единое пространство для задач, диалогов и результата</h1>
        <p className="muted-text">
          Taskora помогает закрывать задачи прозрачно: публикация задания, отклики, назначение,
          чат, проверка результата и отзывы в одном процессе.
        </p>
        <div className="hero-actions">
          <a className="primary-button" href="/register">
            Создать аккаунт
          </a>
          <a className="secondary-button" href="/jobs">
            Найти задания
          </a>
        </div>
      </div>
    </section>
    <section className="card highlights">
      <h2>Основные возможности</h2>
      <div className="highlights-grid">
        {highlights.map((item) => (
          <article key={item.title} className="highlight-card">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  </main>
);

export default Home;
