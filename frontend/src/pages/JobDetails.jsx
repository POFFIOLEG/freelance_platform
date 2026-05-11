import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { jobApi, reviewApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getApplicationStatusLabel, getSubmissionStatusLabel } from "../utils/jobStatusUi.js";
import styles from "./JobDetails.module.css";

const JobDetails = () => {
  const { jobId } = useParams();
  const location = useLocation();
  const { token, user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: null, message: "" });
  const [applyText, setApplyText] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [contestOpen, setContestOpen] = useState(false);
  const [contestComment, setContestComment] = useState("");
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitUrl, setSubmitUrl] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [reviewSubmission, setReviewSubmission] = useState(null);
  const [approving, setApproving] = useState(false);
  const [dealReviews, setDealReviews] = useState([]);
  const [dealReviewRating, setDealReviewRating] = useState(5);
  const [dealReviewComment, setDealReviewComment] = useState("");
  const [dealReviewSaving, setDealReviewSaving] = useState(false);

  const reloadJob = useCallback(async () => {
    const data = await jobApi.get(jobId, token);
    setJob(data);
    return data;
  }, [jobId, token]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await reloadJob();
      } catch (error) {
        setStatus({ type: "error", message: error.message });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [reloadJob]);

  useEffect(() => {
    if (loading || !job) return;
    const id = (location.hash || "").replace(/^#/, "");
    if (!id) return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading, job, location.hash, submissionsLoading, submissions.length]);

  const isOwner =
    Boolean(user && job?.employer && Number(job.employer.id) === Number(user.id));
  const showWorkerActions = Boolean(user?.role === "worker" && !isOwner);
  const isAssignedWorker =
    Boolean(
      user &&
        job?.assigned_to &&
        Number(job.assigned_to.id) === Number(user.id),
    );
  const showSubmitWork =
    showWorkerActions &&
    isAssignedWorker &&
    (job.status === "in_progress" || job.status === "open");

  useEffect(() => {
    if (!isOwner || !token) {
      setApplications([]);
      return;
    }
    let cancelled = false;
    setApplicationsLoading(true);
    jobApi
      .applications(jobId, token)
      .then((list) => {
        if (!cancelled) setApplications(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setApplications([]);
      })
      .finally(() => {
        if (!cancelled) setApplicationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner, token, jobId, job?.assigned_to?.id, job?.status]);

  useEffect(() => {
    if (!isOwner || !token) {
      setSubmissions([]);
      return;
    }
    let cancelled = false;
    setSubmissionsLoading(true);
    jobApi
      .submissions(jobId, token)
      .then((list) => {
        if (!cancelled) setSubmissions(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setSubmissions([]);
      })
      .finally(() => {
        if (!cancelled) setSubmissionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner, token, jobId, job?.status]);

  useEffect(() => {
    if (!reviewSubmission) return;
    const onKey = (e) => {
      if (e.key === "Escape") setReviewSubmission(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reviewSubmission]);

  useEffect(() => {
    if (!token || job?.status !== "completed") {
      setDealReviews([]);
      return;
    }
    if (!isOwner && !isAssignedWorker) {
      setDealReviews([]);
      return;
    }
    let cancelled = false;
    reviewApi
      .list({ job: jobId }, token)
      .then((list) => {
        if (!cancelled) setDealReviews(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setDealReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, jobId, job?.status, isOwner, isAssignedWorker]);

  const submitApply = async () => {
    try {
      await jobApi.apply(jobId, { cover_letter: applyText, expected_budget: 0 }, token);
      setStatus({ type: "success", message: "Отклик отправлен" });
      setApplyText("");
      await reloadJob();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  const submitBid = async () => {
    if (!bidAmount) {
      setStatus({ type: "error", message: "Укажите сумму ставки" });
      return;
    }
    try {
      await jobApi.placeBid(jobId, { amount: Number(bidAmount), message: bidMessage }, token);
      setStatus({ type: "success", message: "Ставка отправлена" });
      setBidAmount("");
      setBidMessage("");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  const submitContest = async () => {
    try {
      await jobApi.apply(jobId, { cover_letter: contestComment, expected_budget: 0 }, token);
      setStatus({ type: "success", message: "Работы отправлены на конкурс" });
      setContestComment("");
      setContestOpen(false);
      await reloadJob();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  const submitWorkResult = async () => {
    if (!token) return;
    try {
      await jobApi.submitResult(
        jobId,
        { message: submitMessage, deliverable_url: submitUrl || "" },
        token,
      );
      setStatus({ type: "success", message: "Результат отправлен заказчику" });
      setSubmitMessage("");
      setSubmitUrl("");
      await reloadJob();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  const handleAssign = async (applicationId) => {
    if (!token) return;
    try {
      await jobApi.assign(jobId, applicationId, token);
      setStatus({ type: "success", message: "Исполнитель назначен" });
      await reloadJob();
      const list = await jobApi.applications(jobId, token);
      setApplications(Array.isArray(list) ? list : []);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  const handleApproveSubmission = async (submissionId) => {
    if (!token) return;
    setApproving(true);
    try {
      await jobApi.approveSubmission(jobId, submissionId, token);
      setStatus({ type: "success", message: "Результат принят, задание завершено" });
      setReviewSubmission(null);
      await reloadJob();
      const subList = await jobApi.submissions(jobId, token);
      setSubmissions(Array.isArray(subList) ? subList : []);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setApproving(false);
    }
  };

  const submitDealReview = async () => {
    if (!token) return;
    setDealReviewSaving(true);
    try {
      await reviewApi.create(
        {
          job: Number(jobId),
          rating: Number(dealReviewRating),
          comment: dealReviewComment.trim(),
        },
        token,
      );
      setStatus({ type: "success", message: "Отзыв сохранён" });
      setDealReviewComment("");
      const list = await reviewApi.list({ job: jobId }, token);
      setDealReviews(Array.isArray(list) ? list : []);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setDealReviewSaving(false);
    }
  };

  const submissionFileName = (url) => {
    try {
      const u = new URL(url);
      const base = u.pathname.split("/").filter(Boolean).pop() || "materials";
      return decodeURIComponent(base.split("?")[0] || "file");
    } catch {
      return "file";
    }
  };

  if (loading) return <div className="page"><div className="card">Загрузка...</div></div>;
  if (!job) return <div className="page"><div className="card">Задание не найдено</div></div>;

  const canAssign =
    isOwner && !job.assigned_to && (job.status === "open" || job.status === "draft");

  const pendingSubmissions = submissions.filter(
    (s) => String(s.status).toLowerCase() !== "approved",
  );
  const showEmployerReview =
    isOwner && (job.status === "submitted" || pendingSubmissions.length > 0);

  const canConfirmReviewSubmission =
    !!reviewSubmission &&
    job.status === "submitted" &&
    String(reviewSubmission.status).toLowerCase() === "sent";

  const myDealReview =
    user && dealReviews.find((r) => Number(r.reviewer?.id) === Number(user.id));
  const partnerDealReview =
    user &&
    dealReviews.find(
      (r) =>
        Number(r.reviewee?.id) === Number(user.id) &&
        Number(r.reviewer?.id) !== Number(user.id),
    );
  const showDealReviewBlock =
    job.status === "completed" && token && (isOwner || isAssignedWorker);

  const workerAlreadyApplied =
    showWorkerActions &&
    !isAssignedWorker &&
    Boolean(job.my_application_status);

  const cannotApplyAsWorker =
    showWorkerActions &&
    !isAssignedWorker &&
    (job.status !== "open" || Boolean(job.assigned_to));

  const reviewWindowHint = (() => {
    if (!job.completed_at) return null;
    const close = new Date(job.completed_at);
    const end = new Date(close.getTime() + 14 * 86400000);
    if (Number.isNaN(end.getTime())) return null;
    if (Date.now() > end.getTime()) return "Срок для отзыва (14 дней после закрытия контракта) истёк.";
    return `Отзыв можно оставить до ${end.toLocaleString("ru-RU")} (14 дней с момента закрытия).`;
  })();

  return (
    <div className={`page ${styles.root}`}>
      <div className="card">
        <h2>{job.title}</h2>
        <p>{job.description}</p>
        <p className="muted-text">Опубликовано: {new Date(job.created_at).toLocaleDateString("ru-RU")}</p>
        <div className={styles.topLinks}>
          <Link to="/jobs">Посмотреть другие {job.is_contest ? "конкурсы" : "вакансии"}</Link>
          <span className="error-text">Пожаловаться</span>
        </div>

        {isOwner && (
          <section id="job-management" className={styles.formSection}>
            <h3>Управление заданием</h3>
            {job.assigned_to && (
              <p>
                <strong>Исполнитель:</strong> {job.assigned_to.username}
              </p>
            )}
            {applicationsLoading && <p className="muted-text">Загружаем отклики…</p>}
            {!applicationsLoading && applications.length === 0 && (
              <p className="muted-text">Пока нет откликов на это задание.</p>
            )}
            {applications.map((app) => (
              <div key={app.id} className={styles.applicationRow}>
                <div>
                  <strong>{app.worker?.username || "Исполнитель"}</strong>
                  <p className="muted-text">{app.cover_letter || "—"}</p>
                  <span className={styles.appStatus}>
                    Статус отклика: {getApplicationStatusLabel(app.status)}
                  </span>
                </div>
                {canAssign && app.status === "sent" && (
                  <button className="primary-button" type="button" onClick={() => handleAssign(app.id)}>
                    Назначить исполнителем
                  </button>
                )}
              </div>
            ))}
          </section>
        )}

        {showEmployerReview && (
          <section id="job-result-review" className={styles.formSection}>
            <h3>Проверка результата</h3>
            {job.status === "submitted" && (
              <p className={styles.reviewBanner}>
                Исполнитель отправил работу на проверку. Ознакомьтесь с материалами и примите результат.
              </p>
            )}
            {submissionsLoading && <p className="muted-text">Загружаем материалы…</p>}
            {!submissionsLoading && submissions.length === 0 && (
              <p className="muted-text">Пока нет отправленных работ.</p>
            )}
            {pendingSubmissions.map((sub) => (
              <div key={sub.id} className={styles.submissionCard}>
                <p>
                  <strong>{sub.worker?.username || "Исполнитель"}</strong>
                  <span className={styles.appStatus}>
                    {" "}
                    · {getSubmissionStatusLabel(sub.status)}
                  </span>
                </p>
                <p className="muted-text">
                  {sub.created_at &&
                    `Отправлено: ${new Date(sub.created_at).toLocaleString("ru-RU")}`}
                </p>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setReviewSubmission(sub)}
                >
                  Проверить результат
                </button>
              </div>
            ))}
            {!submissionsLoading &&
              submissions.length > 0 &&
              pendingSubmissions.length === 0 && (
                <p className="muted-text">Все отправленные версии обработаны.</p>
              )}
          </section>
        )}

        {showSubmitWork && (
          <section className={styles.formSection}>
            <h3>Отправить результат заказчику</h3>
            <textarea
              rows={5}
              placeholder="Описание выполненной работы"
              value={submitMessage}
              onChange={(e) => setSubmitMessage(e.target.value)}
            />
            <input
              type="url"
              placeholder="Ссылка на материалы (необязательно)"
              value={submitUrl}
              onChange={(e) => setSubmitUrl(e.target.value)}
            />
            <button className="primary-button" type="button" onClick={submitWorkResult}>
              Отправить на проверку
            </button>
          </section>
        )}

        {showWorkerActions && !isAssignedWorker && cannotApplyAsWorker && (
          <section className={styles.formSection}>
            <p className="muted-text">
              {job.assigned_to
                ? "Исполнитель по этому заданию уже выбран. Новые отклики не принимаются."
                : "Набор по этому заданию закрыт — откликнуться нельзя."}
            </p>
          </section>
        )}

        {showWorkerActions && !isAssignedWorker && !cannotApplyAsWorker && job.is_exchange ? (
          <section className={styles.formSection}>
            <h3>Сделать ставку</h3>
            <input
              type="number"
              placeholder="Укажите сумму ставки"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
            />
            <textarea
              rows={4}
              placeholder="Комментарий к ставке"
              value={bidMessage}
              onChange={(e) => setBidMessage(e.target.value)}
            />
            <button className="primary-button" type="button" onClick={submitBid}>
              Сделать ставку
            </button>
          </section>
        ) : showWorkerActions && !isAssignedWorker && !cannotApplyAsWorker && job.is_contest ? (
          <section className={styles.formSection}>
            {workerAlreadyApplied ? (
              <>
                <h3>Участие в конкурсе</h3>
                <p className="muted-text">
                  Статус заявки:{" "}
                  <strong>{getApplicationStatusLabel(job.my_application_status)}</strong>
                </p>
                <button
                  type="button"
                  disabled
                  className={`primary-button ${styles.appliedButton}`}
                >
                  Откликнулись
                </button>
              </>
            ) : !contestOpen ? (
              <button className="primary-button" type="button" onClick={() => setContestOpen(true)}>
                Принять участие в конкурсе
              </button>
            ) : (
              <>
                <h3>Ваши конкурсные работы</h3>
                <div className={styles.uploadGrid}>
                  <label className={styles.uploadCell}><input type="file" hidden /><span>+</span></label>
                  <label className={styles.uploadCell}><input type="file" hidden /><span>+</span></label>
                  <label className={styles.uploadCell}><input type="file" hidden /><span>+</span></label>
                </div>
                <textarea
                  rows={4}
                  placeholder="Комментарий"
                  value={contestComment}
                  onChange={(e) => setContestComment(e.target.value)}
                />
                <label className={styles.checkbox}><input type="checkbox" /> Запретить комментарии под моей работой</label>
                <div className={styles.actions}>
                  <button className="primary-button" type="button" onClick={submitContest}>
                    Отправить работы на конкурс
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setContestOpen(false)}>
                    Отменить добавление
                  </button>
                </div>
              </>
            )}
          </section>
        ) : showWorkerActions && !isAssignedWorker && !cannotApplyAsWorker ? (
          <section className={styles.formSection}>
            <h3>Ваш отклик</h3>
            {workerAlreadyApplied ? (
              <>
                <p className="muted-text">
                  Статус:{" "}
                  <strong>{getApplicationStatusLabel(job.my_application_status)}</strong>
                </p>
                <button type="button" disabled className={`primary-button ${styles.appliedButton}`}>
                  Откликнулись
                </button>
              </>
            ) : (
              <>
                <textarea
                  rows={6}
                  maxLength={5000}
                  value={applyText}
                  onChange={(e) => setApplyText(e.target.value)}
                />
                <p className="muted-text">Текстовый файл PDF, DOC, ODT, TXT, RTF объемом до 5 МБ</p>
                <button className="primary-button" type="button" onClick={submitApply}>
                  Отправить отклик
                </button>
              </>
            )}
          </section>
        ) : !isOwner && !user ? (
          <p className="muted-text">
            <Link to="/login">Войдите</Link>, чтобы откликнуться на задание.
          </p>
        ) : null}

        {showDealReviewBlock && (
          <section id="deal-review" className={styles.formSection}>
            <h3>Отзыв по завершённой сделке</h3>
            <p className="muted-text">
              Отзыв доступен только после закрытия контракта, в течение 14 дней. Публикация двусторонняя:
              текст и оценка второго участника станут видны после того, как оба оставят отзыв, либо по
              истечении этого срока. В профиле показывается публичная оценка со сглаживанием; подозрительные
              отзывы получают меньший вес.
            </p>
            {reviewWindowHint && <p className="muted-text">{reviewWindowHint}</p>}
            {myDealReview ? (
              <div className="muted-text">
                <p>
                  Ваша оценка: <strong>{myDealReview.rating}/5</strong>
                  {myDealReview.comment ? ` — ${myDealReview.comment}` : ""}
                </p>
                {myDealReview.publication_status === "pending_mate" && (
                  <p>
                    Отзыв будет опубликован в профиле у контрагента после взаимной отправки или по
                    истечении 14 дней.
                  </p>
                )}
              </div>
            ) : (
              <>
                <p>
                  {isOwner
                    ? `Оцените исполнителя ${job.assigned_to?.username || ""}`
                    : `Оцените заказчика ${job.employer?.username || ""}`}
                </p>
                <label className={styles.reviewRatingLabel}>
                  Оценка (1–5)
                  <select
                    value={dealReviewRating}
                    onChange={(e) => setDealReviewRating(Number(e.target.value))}
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <textarea
                  rows={4}
                  placeholder="Комментарий (необязательно)"
                  value={dealReviewComment}
                  onChange={(e) => setDealReviewComment(e.target.value)}
                />
                <button
                  className="primary-button"
                  type="button"
                  disabled={dealReviewSaving}
                  onClick={submitDealReview}
                >
                  {dealReviewSaving ? "Отправка…" : "Отправить отзыв"}
                </button>
              </>
            )}
            {partnerDealReview && partnerDealReview.rating != null ? (
              <p className={styles.partnerReviewNote}>
                Вас оценили: <strong>{partnerDealReview.rating}/5</strong>
                {partnerDealReview.comment ? ` — ${partnerDealReview.comment}` : ""}
              </p>
            ) : partnerDealReview && partnerDealReview.publication_pending ? (
              <p className="muted-text">
                Второй участник уже оставил отзыв — содержимое станет видно после взаимной публикации.
              </p>
            ) : (
              dealReviews.length > 0 &&
              myDealReview && (
                <p className="muted-text">Второй участник сделки ещё не оставил отзыв.</p>
              )
            )}
          </section>
        )}

        {status.message && <p className={status.type === "error" ? "error-text" : "success-text"}>{status.message}</p>}
      </div>

      {reviewSubmission && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => !approving && setReviewSubmission(null)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="review-modal-title" className={styles.modalTitle}>
              Проверка выполненной работы
            </h3>
            <p className="muted-text">
              <strong>Исполнитель:</strong> {reviewSubmission.worker?.username || "—"}
            </p>
            <p className="muted-text">
              <strong>Статус:</strong> {getSubmissionStatusLabel(reviewSubmission.status)}
            </p>
            {reviewSubmission.created_at && (
              <p className="muted-text">
                <strong>Отправлено:</strong>{" "}
                {new Date(reviewSubmission.created_at).toLocaleString("ru-RU")}
              </p>
            )}

            <div className={styles.modalSection}>
              <h4 className={styles.modalSectionTitle}>Описание работы</h4>
              <div className={styles.modalBodyScroll}>
                <p className={styles.submissionMessageFull}>
                  {reviewSubmission.message?.trim() || "Текст не указан."}
                </p>
              </div>
            </div>

            {reviewSubmission.deliverable_url ? (
              <div className={styles.modalSection}>
                <h4 className={styles.modalSectionTitle}>Материалы</h4>
                <p className="muted-text">
                  Ссылка на файл или архив. При необходимости откройте в браузере или сохраните на устройство.
                </p>
                <div className={styles.modalFileActions}>
                  <a
                    className="secondary-button"
                    href={reviewSubmission.deliverable_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Открыть в новой вкладке
                  </a>
                  <a
                    className="primary-button"
                    href={reviewSubmission.deliverable_url}
                    download={submissionFileName(reviewSubmission.deliverable_url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Скачать файл
                  </a>
                </div>
                <p className={styles.modalUrlHint}>
                  {reviewSubmission.deliverable_url}
                </p>
              </div>
            ) : (
              <p className="muted-text">Исполнитель не приложил отдельную ссылку на файлы.</p>
            )}

            <div className={styles.modalFooter}>
              <button
                className="secondary-button"
                type="button"
                disabled={approving}
                onClick={() => setReviewSubmission(null)}
              >
                Отмена
              </button>
              {canConfirmReviewSubmission && (
                <button
                  className="primary-button"
                  type="button"
                  disabled={approving}
                  onClick={() => handleApproveSubmission(reviewSubmission.id)}
                >
                  {approving ? "Подтверждаем…" : "Подтвердить выполнение"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetails;
