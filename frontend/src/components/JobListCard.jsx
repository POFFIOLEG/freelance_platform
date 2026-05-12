import { getJobCardStatus } from "../utils/jobStatusUi.js";
import { getJobListCardActionState } from "../utils/jobListUi.js";
import { cn } from "../utils/cn.js";

export default function JobListCard({ job, user, favorites, styles, onToggleFavorite, onOpen }) {
  const cardStatus = getJobCardStatus(job.status);
  const { primaryLabel, workerResponded, workerApplicationsClosed } = getJobListCardActionState(job, user);

  return (
    <article className={styles.jobRow}>
      <div className={styles.jobMain}>
        <h4>{job.title}</h4>
        <p className="muted-text">{job.category || "Без категории"}</p>
        <p className={styles.jobSnippet}>{job.description}</p>
        <div className={styles.jobMeta}>
          <span>
            <strong>Бюджет:</strong> {Number(job.budget_min || 0).toLocaleString("ru-RU")} -{" "}
            {Number(job.budget_max || 0).toLocaleString("ru-RU")} ₽
          </span>
          <span>
            <strong>Локация:</strong> {job.city || job.location || "Любая"}
          </span>
          <span>
            <strong>Отклики:</strong> {job.applications_count || 0}
          </span>
        </div>
      </div>
      <div className={styles.jobActions}>
        <span className={cn("status-pill", styles.statusPill, styles[`statusGroup_${cardStatus.group}`])}>
          {cardStatus.label}
        </span>
        <button className={cn("secondary-button", styles.actionButton)} type="button" onClick={() => onToggleFavorite(job.id)}>
          {favorites.includes(job.id) ? "В избранном" : "В избранное"}
        </button>
        <button
          className={cn(
            workerApplicationsClosed ? "secondary-button" : "primary-button",
            styles.actionButton,
            workerResponded && !workerApplicationsClosed && styles.actionButtonApplied,
            workerApplicationsClosed && styles.actionButtonClosed,
          )}
          type="button"
          onClick={() => onOpen(job.id)}
        >
          {primaryLabel}
        </button>
      </div>
    </article>
  );
}
