import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { useOnClickOutside } from "../hooks/useOnClickOutside.js";
import { cn } from "../utils/cn.js";
import {
  FaBars,
  FaBell,
  FaBriefcase,
  FaComments,
  FaHome,
  FaMoon,
  FaSun,
  FaTimes,
  FaUser,
  FaCertificate,
} from "react-icons/fa";
import { useAuth } from "../context/AuthContext.jsx";
import styles from "./Navbar.module.css";
import logoLight from "../../img/Logo_white.png";
import logoDark from "../../img/Logo_black.png";
import { dismissNotification, pollPlatformNotifications } from "../utils/platformNotifications.js";
import { playNotificationSound, unlockNotificationAudio } from "../utils/notificationSound.js";
import { useNotifySocket } from "../hooks/useNotifySocket.js";

/** id задания из маршрута вида /jobs/12 или /jobs/12#... */
function jobIdFromJobsPath(routeOrPath) {
  if (!routeOrPath || typeof routeOrPath !== "string") return null;
  const pathOnly = routeOrPath.split("#")[0].split("?")[0];
  const m = pathOnly.match(/\/jobs\/(\d+)/);
  return m ? m[1] : null;
}

function mergeWorkerPushNotifications(list, payload) {
  if (!payload?.event) return list;
  const jid = payload?.job_id != null ? String(payload.job_id) : "";
  if (!jid) return list;
  const titleRaw = (payload.job_title || "").trim();
  const titleQuoted = titleRaw ? `«${titleRaw}»` : `задание №${jid}`;
  if (payload.event === "revision_requested") {
    const has = list.some(
      (n) =>
        n.type === "REVISION_REQUESTED" &&
        (String(n.id).startsWith(`revision:${jid}:`) ||
          String(n.route || "").startsWith(`/jobs/${jid}`)),
    );
    if (!has) {
      return [
        ...list,
        {
          id: `revision:push:${jid}:${Date.now()}`,
          type: "REVISION_REQUESTED",
          title: "Работа на доработке",
          detail: `По заданию ${titleQuoted} заказчик вернул результат на доработку.`,
          route: `/jobs/${jid}#job-submit-work`,
          dismissOnly: false,
        },
      ];
    }
  }
  if (payload.event === "released_from_job") {
    const has = list.some(
      (n) =>
        n.type === "ASSIGNEE_RELEASED" &&
        (String(n.id).startsWith(`released:${jid}:`) ||
          String(n.route || "").startsWith(`/jobs/${jid}`)),
    );
    if (!has) {
      return [
        ...list,
        {
          id: `released:push:${jid}:${Date.now()}`,
          type: "ASSIGNEE_RELEASED",
          title: "Вас сняли с задания",
          detail: `Заказчик снял вас с задания ${titleQuoted}.`,
          route: `/jobs/${jid}`,
          dismissOnly: false,
        },
      ];
    }
  }
  if (payload.event === "worker_assigned") {
    const has = list.some(
      (n) =>
        n.type === "ASSIGNED" &&
        (String(n.id) === `assigned:${jid}` ||
          String(n.id).startsWith(`assigned:push:${jid}:`) ||
          String(n.route || "").startsWith(`/jobs/${jid}`)),
    );
    if (!has) {
      return [
        ...list,
        {
          id: `assigned:push:${jid}:${Date.now()}`,
          type: "ASSIGNED",
          title: "Вас выбрали исполнителем",
          detail: `Задание ${titleQuoted}. Откройте страницу — описание задания и форма отправки результата ниже.`,
          route: `/jobs/${jid}#job-submit-work`,
          dismissOnly: false,
        },
      ];
    }
  }
  if (payload.event === "work_submitted") {
    const has = list.some(
      (n) =>
        n.type === "WORK_SUBMITTED" &&
        (String(n.id).startsWith(`work-submitted:${jid}`) ||
          String(n.route || "").startsWith(`/jobs/${jid}`)),
    );
    if (!has) {
      return [
        ...list,
        {
          id: `work-submitted:push:${jid}:${Date.now()}`,
          type: "WORK_SUBMITTED",
          title: "Результат на проверке",
          detail: `Исполнитель сдал ${titleQuoted} — проверьте и примите работу`,
          route: `/jobs/${jid}#job-result-review`,
          dismissOnly: false,
        },
      ];
    }
  }
  return list;
}

function appendPersistedPushFromPrev(nextList, prevList) {
  const out = [...nextList];
  for (const p of prevList) {
    const pid = String(p.id);
    if (
      !pid.startsWith("revision:push:") &&
      !pid.startsWith("released:push:") &&
      !pid.startsWith("assigned:push:") &&
      !pid.startsWith("work-submitted:push:")
    )
      continue;
    const jobBase = (p.route || "").split("#")[0];
    if (!jobBase) continue;
    const superseded = out.some(
      (o) =>
        o.type === p.type &&
        ((o.route || "").split("#")[0] === jobBase || String(o.route || "").startsWith(jobBase)),
    );
    if (!superseded) out.push(p);
  }
  return out;
}

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { toggleTheme, isDark } = useTheme();
  const isNarrow = useMediaQuery("(max-width: 768px)");
  const { user, token, logout, switchRole } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const notificationsDropdownRef = useRef(null);

  useNotifySocket(token, (payload) => {
    if (
      payload?.event === "chat_message" ||
      payload?.event === "new_application" ||
      payload?.event === "revision_requested" ||
      payload?.event === "released_from_job" ||
      payload?.event === "worker_assigned" ||
      payload?.event === "work_submitted"
    ) {
      unlockNotificationAudio();
      playNotificationSound();
      if (user && token) {
        pollPlatformNotifications(user, token)
          .then((next) => {
            setNotifications((prev) => {
              const merged = appendPersistedPushFromPrev(
                mergeWorkerPushNotifications(next, payload),
                prev,
              );
              previousNotifyIdsRef.current = new Set(merged.map((n) => n.id));
              return merged;
            });
          })
          .catch(() => {});
      }
    }
  });

  const close = () => {
    setOpen(false);
    setProfileOpen(false);
    setNotificationsOpen(false);
  };

  useEffect(() => {
    if (!isNarrow) setOpen(false);
  }, [isNarrow]);

  useEffect(() => {
    if (!isNarrow || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isNarrow, open]);

  useEffect(() => {
    const once = () => {
      unlockNotificationAudio();
      document.removeEventListener("pointerdown", once);
    };
    document.addEventListener("pointerdown", once, { passive: true });
    return () => document.removeEventListener("pointerdown", once);
  }, []);

  const themeSwitch = (
    <button
      type="button"
      className={styles.themeSwitch}
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
    >
      <span className={styles.themeSwitchInner}>
        <span className={styles.themeSwitchIcon} aria-hidden>
          <FaSun />
        </span>
        <span className={cn(styles.themeSwitchTrack, isDark && styles.themeSwitchTrackOn)} aria-hidden>
          <span className={cn(styles.themeSwitchThumb, isDark && styles.themeSwitchThumbOn)} />
        </span>
        <span className={styles.themeSwitchIcon} aria-hidden>
          <FaMoon />
        </span>
      </span>
    </button>
  );

  const handleRoleSwitch = async (event) => {
    const role = event.target.value;
    try {
      await switchRole(role);
    } catch (error) {
      console.error(error);
    }
  };

  const dashboardErrorLogged = useRef(false);
  const previousNotifyIdsRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      previousNotifyIdsRef.current = null;
      return;
    }

    previousNotifyIdsRef.current = null;
    dashboardErrorLogged.current = false;
    let isUnmounted = false;
    const loadNotifications = async () => {
      try {
        const next = await pollPlatformNotifications(user, token);
        if (isUnmounted) return;
        dashboardErrorLogged.current = false;

        setNotifications((prev) => {
          const merged = appendPersistedPushFromPrev(next, prev);
          const prevIds = previousNotifyIdsRef.current;
          if (prevIds !== null) {
            const hasNew = merged.some((n) => !prevIds.has(n.id));
            if (hasNew) playNotificationSound();
          }
          previousNotifyIdsRef.current = new Set(merged.map((n) => n.id));
          return merged;
        });
      } catch (error) {
        if (!dashboardErrorLogged.current) {
          console.error(error);
          dashboardErrorLogged.current = true;
        }
        if (!isUnmounted) setNotifications([]);
      }
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 8000);
    return () => {
      isUnmounted = true;
      clearInterval(interval);
    };
  }, [user, token]);

  useOnClickOutside(() => {
    setProfileOpen(false);
    setNotificationsOpen(false);
  }, profileDropdownRef, notificationsDropdownRef);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setNotificationsOpen(false);
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className={styles.header}>
      <div className={cn(styles.headerContainer, isNarrow && styles.headerContainerMobile)}>
        <img src={isDark ? logoDark : logoLight} className={styles.logo} alt="Логотип" />
        <nav
          className={cn(
            styles.nav,
            isNarrow && !open && styles.navHiddenMobile,
            isNarrow && open && styles.navMobilePanel,
          )}
        >
          <div
            className={cn(
              isNarrow && open ? styles.navMobileInner : styles.navDesktopBypass,
            )}
          >
          <div className={styles.navClusterLeft}>
            <Link to="/" onClick={close} className={styles.navLink}>
              <FaHome />
              Главная
            </Link>
            {(!user || user.role === "worker") && (
              <Link to="/jobs" onClick={close} className={styles.navLink}>
                <FaBriefcase />
                Задания
              </Link>
            )}
            {(!user || user.role === "employer") && (
              <Link to="/post-job" onClick={close} className={styles.navLink}>
                <FaBriefcase />
                Разместить
              </Link>
            )}
            <Link to="/about" onClick={close} className={styles.navLink}>
              О нас
            </Link>
          </div>
          <div className={styles.navClusterRight}>
            {user?.role === "worker" ? (
              <Link to="/my-applications" onClick={close} className={styles.navLink}>
                <FaBriefcase />
                Мои отклики
              </Link>
            ) : null}
            <Link to="/chat" onClick={close} className={styles.navLink}>
              <FaComments />
              Чат
            </Link>
            {user ? (
              <Link to="/calendar" onClick={close} className={styles.navLink}>
                Календарь
              </Link>
            ) : null}
            {user?.is_moderator ? (
              <Link to="/moderation" onClick={close} className={styles.navLink}>
                Модерация
              </Link>
            ) : null}
            <Link to="/reviews" onClick={close} className={styles.navLink}>
              <FaUser />
              Отзывы
            </Link>
            {user ? (
              <div className={cn(styles.navAuth, isNarrow && styles.navAuthMobile)}>
                <div className={styles.dropdownWrap} ref={notificationsDropdownRef}>
                <button
                  className={styles.notificationButton}
                  type="button"
                  onClick={() => {
                    unlockNotificationAudio();
                    setNotificationsOpen((prev) => !prev);
                    setProfileOpen(false);
                  }}
                >
                  <FaBell />
                  {notifications.length > 0 && <span className={styles.unreadDot}>{notifications.length}</span>}
                </button>
                {notificationsOpen && (
                  <div className={styles.dropdownMenu}>
                    <h4>Уведомления</h4>
                    {notifications.length === 0 && <p className="muted-text">Новых уведомлений нет</p>}
                    {notifications.map((item) => (
                      <button
                        key={item.id}
                        className={styles.notificationItem}
                        onClick={() => {
                          if (item.dismissOnly) {
                            dismissNotification(user.id, item.id);
                            setNotifications((prev) => prev.filter((n) => n.id !== item.id));
                            return;
                          }
                          if (item.route) {
                            const hardRefreshTypes =
                              item.type === "ASSIGNED" ||
                              item.type === "REVISION_REQUESTED" ||
                              item.type === "WORK_SUBMITTED";
                            const destJobId = jobIdFromJobsPath(item.route);
                            const hereJobId = jobIdFromJobsPath(location.pathname);
                            if (hardRefreshTypes && destJobId && destJobId === hereJobId) {
                              const hashPart = item.route.includes("#")
                                ? item.route.split("#").slice(1).join("#")
                                : "";
                              if (hashPart) window.location.hash = hashPart;
                              window.location.reload();
                              close();
                              return;
                            }
                            navigate(item.route);
                          }
                          close();
                        }}
                        type="button"
                      >
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </button>
                    ))}
                  </div>
                )}
                </div>

                <div className={styles.dropdownWrap} ref={profileDropdownRef}>
                <button
                  className={styles.profileButton}
                  type="button"
                  onClick={() => {
                    setProfileOpen((prev) => !prev);
                    setNotificationsOpen(false);
                  }}
                >
                  <FaUser />
                  <span className={styles.profileButtonLabel}>{user.username}</span>
                  {user.profile?.is_verified ? (
                    <span className={styles.verifiedNavBadge} title="Верифицированный профиль" aria-hidden>
                      <FaCertificate />
                    </span>
                  ) : null}
                </button>
                {profileOpen && (
                  <div className={styles.dropdownMenu}>
                    <Link to="/profile" onClick={close} className={styles.dropdownLink}>
                      Профиль
                    </Link>
                    <label className={styles.dropdownField}>
                      <span>Роль</span>
                      <select value={user.role} onChange={handleRoleSwitch} className={styles.roleSelect}>
                        <option value="worker">Исполнитель</option>
                        <option value="employer">Работодатель</option>
                      </select>
                    </label>
                    <button className={styles.dropdownButton} onClick={logout} type="button">
                      Выйти
                    </button>
                  </div>
                )}
                </div>
                {themeSwitch}
              </div>
            ) : (
              <div className={cn(styles.navAuth, isNarrow && styles.navAuthMobile)}>
                <Link to="/login" onClick={close} className={styles.navLink}>
                  Вход
                </Link>
                <Link to="/register" onClick={close} className="primary-button ghost">
                  Регистрация
                </Link>
                {themeSwitch}
              </div>
            )}
          </div>
          </div>
        </nav>
        <div className={styles.actions}>
          <button
            className={cn(styles.mobileMenuButton, isNarrow && styles.mobileMenuButtonVisible)}
            onClick={() => setOpen((value) => !value)}
            type="button"
            aria-expanded={isNarrow ? open : undefined}
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
          >
            {open ? <FaTimes /> : <FaBars />}
          </button>
        </div>
      </div>
      {isNarrow && open ? (
        <button type="button" className={styles.mobileBackdrop} aria-label="Закрыть меню" onClick={close} />
      ) : null}
    </header>
  );
};

export default Navbar;
