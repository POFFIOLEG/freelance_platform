import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaBars, FaBriefcase, FaComments, FaHome, FaMoon, FaSun, FaTimes, FaUser } from "react-icons/fa";
import { useAuth } from "../context/AuthContext.jsx";
import styles from "./Navbar.module.css";
import logoLight from "../../img/Logo_white.png";
import logoDark from "../../img/Logo_black.png";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const { user, logout } = useAuth();

  const close = () => setOpen(false);
  const isDark = theme === "dark";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerContainer}>
        <img 
          src={isDark ? logoDark : logoLight}
          className={styles.logo}
          alt="Логотип"
          />
        <nav className={`${styles.nav} ${open ? styles.mobileMenu : ""}`}>
          <Link to="/" onClick={close} className={styles.navLink}>
            <FaHome />
            Главная
          </Link>
          <Link to="/jobs" onClick={close} className={styles.navLink}>
            <FaBriefcase />
            Задания
          </Link>
          <Link to="/post-job" onClick={close} className={styles.navLink}>
            <FaBriefcase />
            Разместить
          </Link>
          <Link to="/chat" onClick={close} className={styles.navLink}>
            <FaComments />
            Чат
          </Link>
          <Link to="/reviews" onClick={close} className={styles.navLink}>
            <FaUser />
            Отзывы
          </Link>
          {user ? (
            <div className={styles.navAuth}>
              <Link to="/dashboard" onClick={close} className={styles.navLink}>
                Кабинет
              </Link>
              <Link to="/profile" onClick={close} className={styles.navLink}>
                {user.username}
              </Link>
              <button className={styles.textButton} onClick={() => logout()} type="button">
                Выйти
              </button>
            </div>
          ) : (
            <div className={styles.navAuth}>
              <Link to="/login" onClick={close} className={styles.navLink}>
                Вход
              </Link>
              <Link to="/register" onClick={close} className="primary-button ghost">
                Регистрация
              </Link>
            </div>
          )}
        </nav>
         <div className={styles.actions}>
          <button className={styles.themeButton} onClick={toggleTheme} type="button">
            {isDark ? <FaSun /> : <FaMoon />}
            {isDark ? "Светлая" : "Темная"}
          </button>
          <button className={styles.mobileMenuButton} onClick={() => setOpen((value) => !value)} type="button">
            {open ? <FaTimes /> : <FaBars />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
