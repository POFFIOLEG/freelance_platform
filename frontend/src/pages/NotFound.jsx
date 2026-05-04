import { Link } from "react-router-dom";
import styles from "./NotFound.module.css";

const NotFound = () => (
  <main className={`page ${styles.root}`}>
    <section className={`card ${styles.center}`}>
      <h2>404 — страница не найдена</h2>
      <p className="muted-text">Возможно, ссылка устарела или была введена с ошибкой.</p>
      <div className={styles.actions}>
        <Link to="/" className="primary-button">
          На главную
        </Link>
        <Link to="/jobs" className="secondary-button">
          К заданиям
        </Link>
      </div>
    </section>
  </main>
);

export default NotFound;
