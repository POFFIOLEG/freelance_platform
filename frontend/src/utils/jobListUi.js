/** Вкладки типа списка заданий (заказы / биржа / конкурсы) */
export const JOB_LIST_TYPE_TABS = [
  { id: "order", label: "Заказы" },
  { id: "exchange", label: "Биржа" },
  { id: "contest", label: "Розыгрыши" },
];

/** Подпись и флаги для основной кнопки действия в карточке списка */
export function getJobListCardActionState(job, user) {
  const workerResponded = user?.role === "worker" && Boolean(job.my_application_status);
  const workerApplicationsClosed =
    user?.role === "worker" && (job.status !== "open" || Boolean(job.assigned_to));
  const primaryCta = job.is_exchange
    ? "Сделать ставку"
    : job.is_contest
      ? "Принять участие"
      : "Откликнуться";
  const primaryLabel = workerApplicationsClosed
    ? job.assigned_to
      ? "Исполнитель выбран"
      : "Набор закрыт"
    : workerResponded
      ? "Откликнулись"
      : primaryCta;
  return { primaryLabel, workerResponded, workerApplicationsClosed };
}
