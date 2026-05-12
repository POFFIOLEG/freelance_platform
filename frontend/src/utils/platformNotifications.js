import { jobApi, chatApi, reviewApi } from "../api/client.js";

const storageKey = (userId) => `platform_notify_v3_${String(userId)}`;

const defaultState = () => ({
  jobSnapshots: {},
  appliedSnapshots: {},
  assignedSnapshots: {},
  releaseCounts: {},
  chatLastByJob: {},
  dismissed: {},
});

export function readNotifyState(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      jobSnapshots: parsed.jobSnapshots || {},
      appliedSnapshots: parsed.appliedSnapshots || {},
      assignedSnapshots: parsed.assignedSnapshots || {},
      releaseCounts: parsed.releaseCounts || {},
      chatLastByJob: parsed.chatLastByJob || {},
      dismissed: parsed.dismissed || {},
    };
  } catch {
    return defaultState();
  }
}

export function writeNotifyState(userId, state) {
  localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export function dismissNotification(userId, notificationId) {
  const s = readNotifyState(userId);
  s.dismissed[notificationId] = true;
  writeNotifyState(userId, s);
}

/**
 * Собирает актуальные уведомления (отклик, назначение, чат, сдача работы, доработка, снятие исполнителя, отзыв).
 * Обновляет снимки в localStorage.
 */
export async function pollPlatformNotifications(user, token) {
  const uid = Number(user.id);
  const uidKey = String(user.id);
  const prev = readNotifyState(uidKey);
  const next = {
    jobSnapshots: { ...prev.jobSnapshots },
    appliedSnapshots: { ...prev.appliedSnapshots },
    assignedSnapshots: { ...(prev.assignedSnapshots || {}) },
    releaseCounts: { ...(prev.releaseCounts || {}) },
    chatLastByJob: { ...prev.chatLastByJob },
    dismissed: { ...prev.dismissed },
  };

  const items = [];
  const dashboard = await jobApi.dashboard(token);

  for (const job of dashboard.owned || []) {
    const id = String(job.id);
    const cur = {
      applications_count: Number(job.applications_count || 0),
      status: job.status,
      assigned_to_id: job.assigned_to?.id != null ? Number(job.assigned_to.id) : null,
      submissions_count: Number(job.submissions_count || 0),
    };
    const old = next.jobSnapshots[id];
    if (!old) {
      next.jobSnapshots[id] = {
        ...cur,
        lastSeenApplicationsCount: cur.applications_count,
      };
    } else {
      let lastSeen = old.lastSeenApplicationsCount ?? old.applications_count ?? 0;
      if (cur.applications_count > lastSeen) {
        items.push({
          id: `app:${id}:${cur.applications_count}`,
          type: "NEW_APPLICATION",
          title: "Новый отклик",
          detail: `По заданию «${job.title}»`,
          route: `/jobs/${id}#job-management`,
          dismissOnly: false,
        });
        lastSeen = cur.applications_count;
      }
      if (old.status !== "submitted" && cur.status === "submitted") {
        items.push({
          id: `work-submitted:${id}`,
          type: "WORK_SUBMITTED",
          title: "Результат на проверке",
          detail: `Исполнитель сдал «${job.title}» — проверьте и примите работу`,
          route: `/jobs/${id}#job-result-review`,
          dismissOnly: false,
        });
      }
      next.jobSnapshots[id] = {
        ...cur,
        lastSeenApplicationsCount: lastSeen,
      };
    }
  }

  if (user.role === "worker") {
    for (const job of dashboard.applied || []) {
      const id = String(job.id);
      const assignedId = job.assigned_to?.id != null ? Number(job.assigned_to.id) : null;
      const cur = {
        assigned_to_id: assignedId,
        my_application_status: job.my_application_status,
        job_status: job.status,
      };
      const old = next.appliedSnapshots[id];
      if (!old) {
        next.appliedSnapshots[id] = cur;
      } else {
        const wasMe = old.assigned_to_id === uid;
        const nowMe = cur.assigned_to_id === uid;
        if (!wasMe && nowMe && !next.dismissed[`assigned:${id}`]) {
          items.push({
            id: `assigned:${id}`,
            type: "ASSIGNED",
            title: "Вас выбрали исполнителем",
            detail: `Задание «${job.title}» — откройте страницу и отправьте результат, когда будет готово.`,
            route: `/jobs/${id}#job-submit-work`,
            dismissOnly: false,
          });
        }
        next.appliedSnapshots[id] = cur;
      }
    }

    const assignedList = dashboard.assigned || [];
    const currentAssignedIds = new Set(assignedList.map((j) => String(j.id)));
    const assignedSnapshots = { ...next.assignedSnapshots };

    for (const id of Object.keys(assignedSnapshots)) {
      if (currentAssignedIds.has(id)) continue;
      const snap = assignedSnapshots[id];
      delete assignedSnapshots[id];
      const st = snap?.job_status;
      if (!st || st === "completed" || st === "cancelled") continue;
      const rc = (next.releaseCounts[id] || 0) + 1;
      next.releaseCounts[id] = rc;
      const titleText = snap.title ? `«${snap.title}»` : `Задание #${id}`;
      items.push({
        id: `released:${id}:${rc}`,
        type: "ASSIGNEE_RELEASED",
        title: "Вас сняли с задания",
        detail: `Заказчик снял вас с задания ${titleText}. Сделка по этому заданию для вас закрыта.`,
        route: `/jobs/${id}`,
        dismissOnly: false,
      });
    }

    for (const job of assignedList) {
      const id = String(job.id);
      const cur = {
        job_status: job.status,
        title: job.title,
        my_latest_submission_status: job.my_latest_submission_status ?? null,
      };
      const old = assignedSnapshots[id];
      const latestOld = old?.my_latest_submission_status
        ? String(old.my_latest_submission_status).toLowerCase()
        : null;
      const latestCur = cur.my_latest_submission_status
        ? String(cur.my_latest_submission_status).toLowerCase()
        : null;
      const revisionByJobStatus =
        old && old.job_status === "submitted" && cur.job_status === "in_progress";
      const revisionBySubmission =
        old && latestOld === "sent" && latestCur === "needs_changes";
      if (revisionByJobStatus || revisionBySubmission) {
        const ver = String(job.updated_at ?? job.id);
        items.push({
          id: `revision:${id}:${ver}`,
          type: "REVISION_REQUESTED",
          title: "Работа на доработке",
          detail: `По заданию «${job.title}» заказчик вернул результат на доработку.`,
          route: `/jobs/${id}#job-submit-work`,
          dismissOnly: false,
        });
      }
      assignedSnapshots[id] = cur;
    }
    next.assignedSnapshots = assignedSnapshots;
  } else {
    next.assignedSnapshots = {};
  }

  const partyById = new Map();
  for (const j of [...(dashboard.owned || []), ...(dashboard.assigned || [])]) {
    partyById.set(String(j.id), j);
  }

  for (const job of partyById.values()) {
    if (job.status !== "completed") continue;
    if (next.dismissed[`review:${job.id}`]) continue;
    try {
      const reviews = await reviewApi.list({ job: job.id }, token);
      const mine = (reviews || []).some((r) => Number(r.reviewer?.id) === uid);
      if (!mine) {
        items.push({
          id: `review:${job.id}`,
          type: "REVIEW",
          title: "Оставьте отзыв",
          detail: `По завершённой сделке «${job.title}»`,
          route: `/jobs/${job.id}#deal-review`,
          dismissOnly: false,
        });
      }
    } catch {
      /* ignore */
    }
  }

  const chatJobIds = new Set();
  for (const j of [...(dashboard.owned || []), ...(dashboard.assigned || [])]) {
    if (!j?.assigned_to?.id) continue;
    chatJobIds.add(String(j.id));
  }

  for (const jobId of chatJobIds) {
    let last = null;
    try {
      const list = await chatApi.list(jobId, token);
      if (list?.length) last = list[list.length - 1];
    } catch {
      continue;
    }
    if (!last) continue;

    const prevLastId = prev.chatLastByJob[jobId];
    if (prevLastId === undefined || prevLastId === null) {
      next.chatLastByJob[jobId] = last.id;
      continue;
    }
    if (last.id !== prevLastId && Number(last.sender?.id) !== uid) {
      const j = partyById.get(jobId);
      items.push({
        id: `chat:${jobId}:${last.id}`,
        type: "CHAT",
        title: "Новое сообщение в чате",
        detail: j ? `«${j.title}»` : "Переписка по заданию",
        route: `/chat?job=${jobId}`,
        dismissOnly: false,
      });
    }
    next.chatLastByJob[jobId] = last.id;
  }

  writeNotifyState(uidKey, next);

  return items.filter((item) => !next.dismissed[item.id]);
}
