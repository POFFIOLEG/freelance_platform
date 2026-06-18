export const getJobCardStatus = (status) => {
  const s = status || "open";
  if (s === "completed" || s === "cancelled") {
    return { label: "Закрыто", group: "closed" };
  }
  if (s === "disputed") {
    return { label: "Спор", group: "disputed" };
  }
  if (s === "in_progress" || s === "submitted") {
    return { label: "Исполнитель определён", group: "assigned" };
  }
  return { label: "Открыто", group: "open" };
};

const APPLICATION_LABELS = {
  sent: "Отправлен",
  shortlisted: "В шорт-листе",
  rejected: "Отклонён",
  accepted: "Принят",
};

export const getApplicationStatusLabel = (status) => {
  if (!status) return "";
  const key = String(status).toLowerCase();
  return APPLICATION_LABELS[key] || status;
};

const SUBMISSION_LABELS = {
  sent: "На проверке",
  needs_changes: "Нужны правки",
  approved: "Принят заказчиком",
};

export const getSubmissionStatusLabel = (status) => {
  if (!status) return "";
  const key = String(status).toLowerCase();
  return SUBMISSION_LABELS[key] || status;
};
