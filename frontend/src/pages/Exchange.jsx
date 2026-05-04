import styles from "./Exchange.module.css";

const Exchange = () => (
  <main className={`page ${styles.root}`}>
    <section className="card">
      <h2>Торги (биржа)</h2>
      <p className="muted-text">
        Раздел для аукционных заданий: исполнители подают ставки, работодатель выбирает оффер.
      </p>
      <p className="muted-text">
        Сейчас добавлена основа страницы, следующий этап — модели ставок и история торгов.
      </p>
    </section>
  </main>
);

export default Exchange;
