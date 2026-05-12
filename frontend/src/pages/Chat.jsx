import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FaPaperclip } from "react-icons/fa";
import styles from "./Chat.module.css";
import { useAuth } from "../context/AuthContext.jsx";
import { chatApi, jobApi } from "../api/client.js";

const READ_STATE_KEY = "chat:last-seen";
const MAX_CHAT_FILES = 12;

function jobChatEligible(job) {
  return job?.assigned_to != null && job.assigned_to?.id != null;
}

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

const attachmentUrls = (item) => {
  if (Array.isArray(item.attachments) && item.attachments.length) return item.attachments;
  if (item.attachment) return [item.attachment];
  return [];
};

const Chat = () => {
  const { user, token } = useAuth();
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [messagesByJob, setMessagesByJob] = useState({});
  const [unreadByJob, setUnreadByJob] = useState({});
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [attachFiles, setAttachFiles] = useState([]);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const jobQueryHandledRef = useRef(undefined);
  const messagesScrollRef = useRef(null);
  const attachMenuRef = useRef(null);
  const photoInputRef = useRef(null);
  const docInputRef = useRef(null);

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

  const addAttachFiles = (fileList) => {
    const arr = Array.from(fileList || []).filter(Boolean);
    if (arr.length === 0) return;
    setAttachFiles((prev) => {
      const next = [...prev];
      for (const f of arr) {
        if (next.length >= MAX_CHAT_FILES) break;
        const dup = next.some((x) => x.name === f.name && x.size === f.size);
        if (!dup) next.push(f);
      }
      return next;
    });
  };

  useEffect(() => {
    const loadJobs = async () => {
      if (!token) return;
      try {
        const dashboard = await jobApi.dashboard(token);
        const merged = [...(dashboard.owned || []), ...(dashboard.assigned || [])];
        setJobs(merged.filter(jobChatEligible));
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
    if (!jobs.length) return;
    const fromQuery = searchParams.get("job");
    if (fromQuery && !jobs.some((j) => String(j.id) === String(fromQuery))) {
      jobQueryHandledRef.current = fromQuery;
      setSelectedJob("");
      setError("Чат по этому заданию недоступен: исполнитель не назначен или снят.");
      return;
    }
    const paramKey = fromQuery ?? "";
    const queryValid = Boolean(fromQuery && jobs.some((j) => String(j.id) === String(fromQuery)));
    const paramChanged = jobQueryHandledRef.current !== paramKey;

    if (queryValid && paramChanged) {
      jobQueryHandledRef.current = paramKey;
      setSelectedJob(String(fromQuery));
      return;
    }

    if (queryValid) {
      jobQueryHandledRef.current = paramKey;
      return;
    }

    jobQueryHandledRef.current = paramKey;
    setSelectedJob((prev) => {
      if (prev && jobs.some((j) => String(j.id) === prev)) return prev;
      return String(jobs[0].id);
    });
  }, [jobs, searchParams]);

  const recalculateUnread = (jobId, messages, readMap = lastSeenByJob) => {
    if (!jobId) return;
    const lastSeen = toMillis(readMap[jobId]);
    const unread = messages.filter(
      (item) => item.sender.id !== user?.id && toMillis(item.created_at) > lastSeen,
    ).length;
    setUnreadByJob((prev) => ({ ...prev, [jobId]: unread }));
  };

  const fetchMessages = async (jobId, { setLoad = false, silent403 = false } = {}) => {
    if (!jobId || !token) return [];
    if (setLoad) {
      setLoading(true);
      setError("");
    }
    try {
      const raw = await chatApi.list(jobId, token);
      const items = Array.isArray(raw) ? raw : raw?.results || [];
      const key = String(jobId);
      setMessagesByJob((prev) => ({ ...prev, [key]: items }));
      recalculateUnread(key, items);
      return items;
    } catch (err) {
      const is403 = err?.status === 403;
      if (is403) {
        setJobs((prev) => prev.filter((j) => String(j.id) !== String(jobId)));
        setMessagesByJob((prev) => {
          const k = String(jobId);
          const { [k]: _, ...rest } = prev;
          return rest;
        });
        setUnreadByJob((prev) => {
          const k = String(jobId);
          const { [k]: _, ...rest } = prev;
          return rest;
        });
        setSelectedJob((prev) => (prev === String(jobId) ? "" : prev));
        if (!silent403) {
          setError(err.message || "Чат по этому заданию недоступен.");
        }
        return [];
      }
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
          const items = await fetchMessages(String(job.id), { silent403: true });
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

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [selectedJob, selectedMessages.length, loading]);

  useEffect(() => {
    if (!attachMenuOpen) return;
    const onDoc = (e) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
        setAttachMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [attachMenuOpen]);

  const clearAttachments = () => {
    setAttachFiles([]);
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (docInputRef.current) docInputRef.current.value = "";
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if ((!message.trim() && attachFiles.length === 0) || !selectedJob) return;
    try {
      if (attachFiles.length > 0) {
        const fd = new FormData();
        fd.append("text", message.trim());
        attachFiles.forEach((f) => fd.append("attachments", f));
        await chatApi.send(selectedJob, fd, token);
      } else {
        await chatApi.send(selectedJob, { text: message.trim() }, token);
      }
      setMessage("");
      clearAttachments();
      const items = await fetchMessages(selectedJob);
      markChatAsRead(selectedJob, items);
    } catch (err) {
      setError(err.message);
    }
  };

  const lastLinePreview = (msg) => {
    if (!msg) return "Пока нет сообщений";
    const t = (msg.text || "").trim();
    const n = attachmentUrls(msg).length;
    if (t && n) return `${t.length > 48 ? `${t.slice(0, 48)}…` : t} · 📎${n}`;
    if (t) return t.length > 72 ? `${t.slice(0, 72)}…` : t;
    if (n) return `📎 ${n} ${n === 1 ? "файл" : n < 5 ? "файла" : "файлов"}`;
    return "Пока нет сообщений";
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
                    <span className="muted-text">{lastLinePreview(lastMessage)}</span>
                    <span className="muted-text">{formatTime(lastMessage?.created_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={styles.chatPane}>
          <div className={styles.chatPaneHeader}>
            <div className={styles.chatPaneHeaderText}>
              <h3>Чат по заданию</h3>
              {selectedJob ? (
                <span className="muted-text">{selectedJobDetails?.title || "Выбранный чат"}</span>
              ) : null}
            </div>
            {selectedJob ? (
              <div className={styles.attachWrap} ref={attachMenuRef}>
                <button
                  type="button"
                  className={styles.attachToggle}
                  onClick={() => setAttachMenuOpen((o) => !o)}
                  title="Прикрепить файлы"
                  aria-expanded={attachMenuOpen}
                  aria-haspopup="true"
                >
                  <FaPaperclip aria-hidden />
                </button>
                {attachMenuOpen ? (
                  <div className={styles.attachMenu} role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.attachMenuItem}
                      onClick={() => {
                        setAttachMenuOpen(false);
                        photoInputRef.current?.click();
                      }}
                    >
                      Фото
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.attachMenuItem}
                      onClick={() => {
                        setAttachMenuOpen(false);
                        docInputRef.current?.click();
                      }}
                    >
                      Документ
                    </button>
                  </div>
                ) : null}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className={styles.hiddenFile}
                  onChange={(e) => {
                    addAttachFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={docInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,.odt,.ods,image/*"
                  multiple
                  className={styles.hiddenFile}
                  onChange={(e) => {
                    addAttachFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            ) : null}
          </div>
          {error && <p className="error-text">{error}</p>}
          {!selectedJob && <p className="muted-text">Сначала выберите чат в левой колонке.</p>}
          {selectedJob && (
            <>
              <div className={styles.messagesScroll} ref={messagesScrollRef}>
                <div className={styles.messagesInner}>
                  {loading && <p className="muted-text">Загружаем сообщения...</p>}
                  {!loading && selectedMessages.length === 0 && (
                    <p className="muted-text">Сообщений пока нет. Начните диалог.</p>
                  )}
                  {selectedMessages.map((item) => {
                    const urls = attachmentUrls(item);
                    return (
                      <div
                        key={item.id}
                        className={`${styles.messageRow} ${item.sender.id === user.id ? styles.messageOwnRow : ""}`}
                      >
                        <div
                          className={`${styles.messageBubble} ${item.sender.id === user.id ? styles.messageOwn : ""}`}
                        >
                          <div className={styles.messageMeta}>
                            <strong>{item.sender.username}</strong>
                            <span>{formatTime(item.created_at)}</span>
                          </div>
                          {item.text ? <p>{item.text}</p> : null}
                          {urls.length > 0 ? (
                            <div className={styles.attachLinks}>
                              {urls.map((url, idx) => (
                                <a key={url + idx} href={url} target="_blank" rel="noreferrer">
                                  {urls.length > 1 ? `Вложение ${idx + 1}` : "Вложение"}
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <form className={styles.chatForm} onSubmit={handleSend}>
                {attachFiles.length > 0 ? (
                  <div className={styles.attachChips}>
                    {attachFiles.map((f, idx) => (
                      <span key={`${f.name}-${idx}`} className={styles.attachChip}>
                        {f.name}
                        <button
                          type="button"
                          className={styles.attachChipRemove}
                          onClick={() => setAttachFiles((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label="Убрать файл"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <button type="button" className="link-button" onClick={clearAttachments}>
                      Очистить всё
                    </button>
                  </div>
                ) : null}
                <div className={styles.composeRow}>
                  <textarea
                    rows={3}
                    className={styles.composeTextarea}
                    placeholder="Ваше сообщение"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                </div>
                <button
                  className="primary-button"
                  disabled={!message.trim() && attachFiles.length === 0}
                  type="submit"
                >
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
