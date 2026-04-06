import styles from "./JobCard.module.css";

const statusLabels = {
  draft: "Черновик",
  open: "Открыто",
  in_progress: "В работе",
  submitted: "На проверке",
  completed: "Завершено",
  cancelled: "Отменено",
};

const formatBudget = (min, max) => {
  const format = (value) =>
    Number(value || 0).toLocaleString("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    });
  if (min && max) return `${format(min)} — ${format(max)}`;
  if (min) return `от ${format(min)}`;
  if (max) return `до ${format(max)}`;
  return "Не указан";
};

const JobCard = ({ job, children }) => (
  <article className={`job-card ${styles.root}`}>
    <div className="job-card-header">
      <div>
        <h4>{job.title}</h4>
        <p className="muted-text">{job.category || "Без категории"}</p>
      </div>
      <span className={`status-pill status-${job.status}`}>{statusLabels[job.status] || job.status}</span>
    </div>
    <p>{job.description}</p>
    <div className="job-card-meta">
      <div>
        <p className="muted-text">Бюджет</p>
        <strong>{formatBudget(job.budget_min, job.budget_max)}</strong>
      </div>
      <div>
        <p className="muted-text">Локация</p>
        <strong>{job.location || "Любая"}</strong>
      </div>
      <div>
        <p className="muted-text">Дедлайн</p>
        <strong>{job.deadline || "Не указан"}</strong>
      </div>
    </div>
    {job.skills_required?.length > 0 && (
      <div className="skills-list">
        {job.skills_required.map((skill) => (
          <span key={skill}>{skill}</span>
        ))}
      </div>
    )}
    <div className="job-card-footer">
      <div>
        <p className="muted-text">Работодатель</p>
        <strong>{job.employer?.username}</strong>
      </div>
      <div>
        <p className="muted-text">Отклики</p>
        <strong>{job.applications_count}</strong>
      </div>
    </div>
    {children && <div className="job-card-extra">{children}</div>}
  </article>
);

export default JobCard;

