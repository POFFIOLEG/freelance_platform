import { useEffect, useState } from "react";
import styles from "./Chat.module.css";
import { useAuth } from "../context/AuthContext.jsx";
import { chatApi, jobApi } from "../api/client.js";

const READ_STATE_KEY = "chat:last-seen";

const toMillis = (value) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatTime = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Chat = () => {
  const { user, token } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [messagesByJob, setMessagesByJob] = useState({});
  const [unreadByJob, setUnreadByJob] = useState({});
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const readStorageKey = `${READ_STATE_KEY}:${user?.id || "anonymous"}`;
  const [lastSeenByJob, setLastSeenByJob] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(readStorageKey) || "{}");
    } catch {
      return {};
    }
  });

  const selectedMessages = selectedJob ? messagesByJob[selectedJob] || [] : [];
  const selectedJobDetails = jobs.find((job) => String(job.id) === selectedJob);
  const filteredJobs = jobs.filter((job) => {
    const q = search.trim().toLowerCase();
    return !q || job.title.toLowerCase().includes(q);
  });

  useEffect(() => {
    const loadJobs = async () => {
      if (!token) return;
      try {
        const dashboard = await jobApi.dashboard(token);
        setJobs([...(dashboard.owned || []), ...(dashboard.assigned || [])]);
      } catch (err) {
        setError(err.message);
      }
    };
    loadJobs();
  }, [token]);

  useEffect(() => {
    if (!user) return;
    try {
      setLastSeenByJob(JSON.parse(localStorage.getItem(readStorageKey) || "{}"));
    } catch {
      setLastSeenByJob({});
    }
  }, [readStorageKey, user]);

  useEffect(() => {
    if (!selectedJob && jobs.length > 0) {
      setSelectedJob(String(jobs[0].id));
    }
  }, [jobs, selectedJob]);

  const recalculateUnread = (jobId, messages, readMap = lastSeenByJob) => {
    if (!jobId) return;
    const lastSeen = toMillis(readMap[jobId]);
    const unread = messages.filter(
      (item) => item.sender.id !== user?.id && toMillis(item.created_at) > lastSeen,
    ).length;
    setUnreadByJob((prev) => ({ ...prev, [jobId]: unread }));
  };

  const fetchMessages = async (jobId, { setLoad = false } = {}) => {
    if (!jobId || !token) return [];
    if (setLoad) setLoading(true);
    try {
      const items = await chatApi.list(jobId, token);
      const key = String(jobId);
      setMessagesByJob((prev) => ({ ...prev, [key]: items }));
      recalculateUnread(key, items);
      return items;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      if (setLoad) setLoading(false);
    }
  };

  const markChatAsRead = (jobId, messages) => {
    if (!jobId) return;
    const latest = messages?.length ? messages[messages.length - 1]?.created_at : null;
    setLastSeenByJob((prev) => {
      const next = { ...prev, [jobId]: latest || prev[jobId] || new Date().toISOString() };
      localStorage.setItem(readStorageKey, JSON.stringify(next));
      return next;
    });
    setUnreadByJob((prev) => ({ ...prev, [jobId]: 0 }));
  };

  useEffect(() => {
    if (!selectedJob || !token) return;
    fetchMessages(selectedJob, { setLoad: true });
  }, [selectedJob, token]);

  useEffect(() => {
    if (!selectedJob) return;
    markChatAsRead(selectedJob, selectedMessages);
  }, [selectedJob, selectedMessages]);

  useEffect(() => {
    if (!jobs.length) return;
    jobs.forEach((job) => {
      const key = String(job.id);
      recalculateUnread(key, messagesByJob[key] || [], lastSeenByJob);
    });
  }, [jobs, messagesByJob, lastSeenByJob]);

  useEffect(() => {
    if (!jobs.length || !token) return;
    let cancelled = false;

    const refreshAll = async () => {
      const result = await Promise.all(
        jobs.map(async (job) => {
          const items = await fetchMessages(job.id);
          return { id: String(job.id), items };
        }),
      );
      if (cancelled) return;
      const nextMap = {};
      result.forEach(({ id, items }) => {
        nextMap[id] = items;
      });
      setMessagesByJob((prev) => ({ ...prev, ...nextMap }));
    };

    refreshAll();
    const interval = setInterval(refreshAll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobs, token]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!message.trim() || !selectedJob) return;
    try {
      await chatApi.send(selectedJob, { text: message.trim() }, token);
      setMessage("");
      const items = await fetchMessages(selectedJob);
      markChatAsRead(selectedJob, items);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!user) {
    return (
      <div className={`page ${styles.root}`}>
        <div className="card">
          <h2>Чат по заданиям</h2>
          <p>Авторизуйтесь и выберите задание для общения.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`page ${styles.root}`}>
      <div className={`card ${styles.chatShell}`}>
        <aside className={styles.chatList}>
          <div className={styles.chatListHeader}>
            <h2>Чаты</h2>
            <p className="muted-text">Выберите задание для переписки.</p>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск чата"
              className={styles.searchInput}
            />
          </div>
          <div className={styles.chatListItems}>
            {jobs.length === 0 && <p className="muted-text">Пока нет доступных чатов.</p>}
            {filteredJobs.map((job) => {
              const value = String(job.id);
              const isActive = value === selectedJob;
              const jobMessages = messagesByJob[value] || [];
              const lastMessage = jobMessages[jobMessages.length - 1];
              const unreadCount = unreadByJob[value] || 0;
              return (
                <button
                  key={job.id}
                  className={`${styles.chatListItem} ${isActive ? styles.chatListItemActive : ""}`}
                  onClick={() => setSelectedJob(value)}
                  type="button"
                >
                  <div className={styles.chatItemTop}>
                    <strong>{job.title}</strong>
                    {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount}</span>}
                  </div>
                  <div className={styles.chatItemBottom}>
                    <span className="muted-text">
                      {lastMessage?.text ? lastMessage.text : "Пока нет сообщений"}
                    </span>
                    <span className="muted-text">{formatTime(lastMessage?.created_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={styles.chatPane}>
          <div className={styles.chatPaneHeader}>
            <h3>Чат по заданию</h3>
            {selectedJob && (
              <span className="muted-text">{selectedJobDetails?.title || "Выбранный чат"}</span>
            )}
          </div>
          {error && <p className="error-text">{error}</p>}
          {!selectedJob && <p className="muted-text">Сначала выберите чат в левой колонке.</p>}
          {selectedJob && (
            <>
              <div className={styles.messagesContainer}>
                {loading && <p>Загружаем сообщения...</p>}
                {!loading && selectedMessages.length === 0 && (
                  <p className="muted-text">Сообщений пока нет. Начните диалог.</p>
                )}
                {selectedMessages.map((item) => (
                  <div
                    key={item.id}
                    className={`${styles.messageRow} ${item.sender.id === user.id ? styles.messageOwnRow : ""}`}
                  >
                    <div className={`${styles.messageBubble} ${item.sender.id === user.id ? styles.messageOwn : ""}`}>
                      <div className={styles.messageMeta}>
                        <strong>{item.sender.username}</strong>
                        <span>{formatTime(item.created_at)}</span>
                      </div>
                      <p>{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form className={styles.chatForm} onSubmit={handleSend}>
                <textarea
                  rows={3}
                  placeholder="Ваше сообщение"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <button className="primary-button" disabled={!message.trim()}>
                  Отправить
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default Chat;

