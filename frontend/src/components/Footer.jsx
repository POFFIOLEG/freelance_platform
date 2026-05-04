import { Link } from "react-router-dom";
import styles from "./Footer.module.css";

const Footer = () => (
  <footer className={styles.root}>
    <div className={styles.inner}>
      <div>
        <strong>Taskora</strong>
        <p className="muted-text">Платформа для работодателей и исполнителей.</p>
      </div>
      <nav className={styles.links}>
        <Link to="/">Главная</Link>
        <Link to="/jobs">Задания</Link>
        <Link to="/chat">Чат</Link>
        <Link to="/about">О нас</Link>
      </nav>
    </div>
  </footer>
);

export default Footer;
