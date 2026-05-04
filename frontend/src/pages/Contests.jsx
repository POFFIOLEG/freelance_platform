import styles from "./Contests.module.css";

const Contests = () => (
  <main className={`page ${styles.root}`}>
    <section className="card">
      <h2>Розыгрыши исполнителей</h2>
      <p className="muted-text">
        Здесь работодатель сможет запускать конкурсный выбор исполнителя по заявкам.
      </p>
      <p className="muted-text">
        Этап 1: интерфейс-заготовка. Этап 2: рандомизация и правила отбора.
      </p>
    </section>
  </main>
);

export default Contests;
