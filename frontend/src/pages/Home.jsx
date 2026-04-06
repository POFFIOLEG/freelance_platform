
import styles from "./Home.module.css";

const highlights = [
  {
    title: "Регистрация и профиль",
    description: "Создайте аккаунт работодателя или исполнителя и заполните профиль навыков.",
  },
  {
    title: "Размещение заданий",
    description: "Формируйте четкие ТЗ, указывайте бюджет, сроки и требуемые навыки.",
  },
  {
    title: "Поиск работы",
    description: "Фильтруйте задания по категориям, локациям и статусу, отправляйте отклики.",
  },
  {
    title: "Чат и контроль",
    description: "Обсуждайте детали, управляйте статусами задач, отслеживайте результаты.",
  },
  {
    title: "Результаты и отзывы",
    description: "Исполнители отправляют результаты, работодатели подтверждают и оставляют фидбек.",
  },
];

const Home = () => (
  <main className={`page home-page ${styles.root}`}>
    <section className="card hero">
      <div>
        <p className="badge">Платформа для работодателей и специалистов</p>
        <h1>Свяжите задачу и результат в одной платформе</h1>
        <p className="muted-text">
          Управляйте полным циклом сотрудничества: от публикации задания до подтверждения работы и
          сбора отзывов. Построено на React, Django и Postgres.
        </p>
        <div className="hero-actions">
          <a className="primary-button" href="/register">
            Начать бесплатно
          </a>
          <a className="secondary-button" href="/jobs">
            Смотреть задания
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
