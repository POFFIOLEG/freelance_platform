import { useEffect, useState } from "react";
import styles from "./Chat.module.css";
import { useAuth } from "../context/AuthContext.jsx";
import { chatApi, jobApi } from "../api/client.js";

const Chat = () => {
  const { user, token } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadJobs = async () => {
      if (!token) return;
      try {
        const dashboard = await jobApi.dashboard(token);
        const jobOptions = [...(dashboard.owned || []), ...(dashboard.assigned || [])];
        setJobs(jobOptions);
      } catch (err) {
        setError(err.message);
      }
    };
    loadJobs();
  }, [token]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedJob || !token) return;
      setLoading(true);
      try {
        const items = await chatApi.list(selectedJob, token);
        setMessages(items);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadMessages();
  }, [selectedJob, token]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!message.trim() || !selectedJob) return;
    try {
      await chatApi.send(
        selectedJob,
        {
          text: message.trim(),
        },
        token,
      );
      setMessage("");
      const items = await chatApi.list(selectedJob, token);
      setMessages(items);
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
    <div className={`page chat-page ${styles.root}`}>
      <div className="card chat-card">
        <div className="card-header">
          <div>
            <h2>Чат по заданиям</h2>
            <p className="muted-text">
              Общайтесь по заданиям, делитесь файлами и комментируйте прогресс.
            </p>
          </div>
          <select
            value={selectedJob}
            onChange={(event) => setSelectedJob(event.target.value)}
            className="job-select"
          >
            <option value="">Выберите задание</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title} • {job.status}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="error-text">{error}</p>}
        {!selectedJob && <p className="muted-text">Сначала выберите задание в выпадающем списке.</p>}
        {selectedJob && (
          <>
            <div className="messages-container">
              {loading && <p>Загружаем сообщения...</p>}
              {!loading && messages.length === 0 && (
                <p className="muted-text">Сообщений пока нет. Начните диалог.</p>
              )}
              {messages.map((item) => (
                <div
                  key={item.id}
                  className={`message ${item.sender.id === user.id ? "message-own" : ""}`}
                >
                  <div className="message-meta">
                    <strong>{item.sender.username}</strong>
                    <span>
                      {new Date(item.created_at).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
            <form className="chat-form" onSubmit={handleSend}>
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
      </div>
    </div>
  );
};

export default Chat;

