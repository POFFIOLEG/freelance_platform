import styles from "./About.module.css";

const About = () => (
  <main className={`page ${styles.root}`}>
    <section className="card">
      <h2>О нас</h2>
      <p className="muted-text">
        Taskora объединяет работодателей и исполнителей в одном месте: от публикации задания до
        сдачи результата, проверки и отзывов.
      </p>
    </section>
    <section className="card">
      <h3>Что мы делаем</h3>
      <ul className={styles.list}>
        <li>Подбор заданий и исполнителей по ролям.</li>
        <li>Управление статусами и прозрачный процесс работы.</li>
        <li>Встроенный чат и история взаимодействия.</li>
        <li>Система отзывов по завершенным задачам.</li>
      </ul>
    </section>
  </main>
);

export default About;
