import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { FaPaperclip } from "react-icons/fa";
import { jobApi, reviewApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getApplicationStatusLabel, getSubmissionStatusLabel } from "../utils/jobStatusUi.js";
import styles from "./JobDetails.module.css";

const MAX_APPLY_LEN = 5000;
const MAX_SUBMIT_ATTACH = 8;

function parseDeliverableUrls(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
}

function submissionsVisibleToEmployer(job, submissions) {
  const wid = job?.assigned_to?.id;
  if (wid == null || !Array.isArray(submissions)) return submissions;
  const assigneeSubs = submissions.filter((s) => Number(s.worker?.id) === Number(wid));
  if (assigneeSubs.length === 0) return submissions;
  const latest = assigneeSubs.reduce((best, s) => {
    if (!best) return s;
    const ta = new Date(s.created_at).getTime();
    const tb = new Date(best.created_at).getTime();
    return ta >= tb ? s : best;
  }, null);
  if (!latest) return submissions;
  const latestId = Number(latest.id);
  return submissions.filter(
    (s) => Number(s.worker?.id) !== Number(wid) || Number(s.id) === latestId,
  );
}

const JobDetails = () => {
  const { jobId } = useParams();
  const location = useLocation();
  const { token, user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: null, message: "" });
  const [applyText, setApplyText] = useState("");
  const [applyBudget, setApplyBudget] = useState("");
  const [applySaving, setApplySaving] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [contestOpen, setContestOpen] = useState(false);
  const [contestComment, setContestComment] = useState("");
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitAttachFiles, setSubmitAttachFiles] = useState([]);
  const [submitAttachMenuOpen, setSubmitAttachMenuOpen] = useState(false);
  const submitAttachMenuRef = useRef(null);
  const submitPhotoInputRef = useRef(null);
  const submitDocInputRef = useRef(null);
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [reviewSubmission, setReviewSubmission] = useState(null);
  const [reviewAction, setReviewAction] = useState(null);
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [dealReviews, setDealReviews] = useState([]);
  const [dealReviewRating, setDealReviewRating] = useState(5);
  const [dealReviewComment, setDealReviewComment] = useState("");
  const [dealReviewSaving, setDealReviewSaving] = useState(false);
  const [milestones, setMilestones] = useState([]);
  const [specHistory, setSpecHistory] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDue, setMilestoneDue] = useState("");
  const [disputeSummary, setDisputeSummary] = useState("");
  const [disputeResolve, setDisputeResolve] = useState("");
  const [arbDecision, setArbDecision] = useState("");

  const reviewBusy = Boolean(reviewAction);

  const disputeStatusRu = {
    open: "Открыт",
    escalated: "На арбитраже",
    resolved: "Закрыт",
  };
  const activeOpenDispute = disputes.find((d) => d.status === "open");
  const activeEscalatedDispute = disputes.find((d) => d.status === "escalated");

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
    if (!jobId || !token) return undefined;
    const onLive = (e) => {
      const p = e?.detail;
      if (!p?.job_id || String(p.job_id) !== String(jobId)) return;
      const allowed = new Set([
        "worker_assigned",
        "work_submitted",
        "revision_requested",
        "released_from_job",
      ]);
      if (!p.event || !allowed.has(p.event)) return;
      reloadJob().catch(() => {});
    };
    window.addEventListener("job-notify-live", onLive);
    return () => window.removeEventListener("job-notify-live", onLive);
  }, [jobId, token, reloadJob]);

  useEffect(() => {
    if (loading || !job) return;
    const id = (location.hash || "").replace(/^#/, "");
    if (!id) return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading, job, location.hash, submissionsLoading, submissions.length]);

  useEffect(() => {
    if (!submitAttachMenuOpen) return;
    const onDoc = (e) => {
      if (submitAttachMenuRef.current && !submitAttachMenuRef.current.contains(e.target)) {
        setSubmitAttachMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [submitAttachMenuOpen]);

  const addSubmitAttachFiles = (fileList) => {
    const arr = Array.from(fileList || []).filter(Boolean);
    if (arr.length === 0) return;
    setSubmitAttachFiles((prev) => {
      const next = [...prev];
      for (const f of arr) {
        if (next.length >= MAX_SUBMIT_ATTACH) break;
        const dup = next.some((x) => x.name === f.name && x.size === f.size);
        if (!dup) next.push(f);
      }
      return next;
    });
  };

  const clearSubmitAttachments = () => {
    setSubmitAttachFiles([]);
    if (submitPhotoInputRef.current) submitPhotoInputRef.current.value = "";
    if (submitDocInputRef.current) submitDocInputRef.current.value = "";
  };

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
    (job?.status === "in_progress" || job?.status === "open" || job?.status === "submitted");

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
    if (!reviewSubmission) {
      setRejectFeedback("");
      return;
    }
    setRejectFeedback("");
  }, [reviewSubmission?.id]);

  useEffect(() => {
    if (!reviewSubmission || reviewBusy) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setReviewSubmission(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reviewSubmission, reviewBusy]);

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

  useEffect(() => {
    if (!token || !jobId || !job || !user) return;
    const employer = Number(job.employer?.id) === Number(user.id);
    const assigned = Number(job.assigned_to?.id) === Number(user.id);
    const isArb = Boolean(user.is_arbitrator);
    const partyWithAssignee = Boolean(job.assigned_to) && (employer || assigned);
    if (!partyWithAssignee && !isArb) {
      setMilestones([]);
      setSpecHistory([]);
      setDisputes([]);
      return;
    }
    let cancelled = false;
    if (partyWithAssignee) {
      Promise.all([
        jobApi.milestones(jobId, token).catch(() => []),
        jobApi.specHistory(jobId, token).catch(() => []),
        jobApi.disputes(jobId, token).catch(() => []),
      ]).then(([m, s, d]) => {
        if (cancelled) return;
        setMilestones(Array.isArray(m) ? m : []);
        setSpecHistory(Array.isArray(s) ? s : []);
        setDisputes(Array.isArray(d) ? d : []);
      });
    } else if (isArb) {
      jobApi
        .disputes(jobId, token)
        .then((d) => {
          if (cancelled) return;
          setDisputes(Array.isArray(d) ? d : []);
        })
        .catch(() => {
          if (!cancelled) setDisputes([]);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [token, jobId, job?.id, job?.employer?.id, job?.assigned_to?.id, user?.id, user?.is_arbitrator]);

  const employerReviewSubmissions = useMemo(() => {
    if (!job) return [];
    return submissionsVisibleToEmployer(job, submissions);
  }, [job, submissions]);

  const pendingSubmissions = useMemo(
    () =>
      employerReviewSubmissions.filter(
        (s) => String(s.status).toLowerCase() !== "approved",
      ),
    [employerReviewSubmissions],
  );

  const submitApply = async () => {
    const budgetNum = applyBudget === "" ? 0 : Number(applyBudget);
    if (Number.isNaN(budgetNum) || budgetNum < 0) {
      setStatus({ type: "error", message: "Сумма в отклике не может быть отрицательной." });
      return;
    }
    setApplySaving(true);
    try {
      await jobApi.apply(jobId, { cover_letter: applyText, expected_budget: budgetNum }, token);
      setStatus({ type: "success", message: "Отклик отправлен" });
      setApplyText("");
      setApplyBudget("");
      await reloadJob();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setApplySaving(false);
    }
  };

  const submitBid = async () => {
    if (!bidAmount) {
      setStatus({ type: "error", message: "Укажите сумму ставки" });
      return;
    }
    const amt = Number(bidAmount);
    if (Number.isNaN(amt) || amt < 0) {
      setStatus({ type: "error", message: "Ставка не может быть отрицательной." });
      return;
    }
    try {
      await jobApi.placeBid(jobId, { amount: amt, message: bidMessage }, token);
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
    const msg = submitMessage.trim();
    const url = submitUrl.trim();
    const hasFiles = submitAttachFiles.length > 0;
    if (!msg && !hasFiles && !url) {
      setStatus({
        type: "error",
        message: "Укажите описание работы, ссылку на материалы или прикрепите файл.",
      });
      return;
    }
    try {
      if (hasFiles) {
        const fd = new FormData();
        fd.append("message", msg || (url ? `Материалы: ${url}` : "Файлы во вложении."));
        if (url) fd.append("deliverable_url", url);
        submitAttachFiles.forEach((f) => fd.append("deliverable_file", f));
        await jobApi.submitResult(jobId, fd, token);
      } else {
        await jobApi.submitResult(
          jobId,
          {
            message: msg || (url ? "Материалы по ссылке ниже." : "Результат отправлен."),
            deliverable_url: url,
          },
          token,
        );
      }
      setStatus({ type: "success", message: "Результат отправлен заказчику" });
      setSubmitMessage("");
      setSubmitUrl("");
      clearSubmitAttachments();
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
    setReviewAction("approve");
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
      setReviewAction(null);
    }
  };

  const handleRejectSubmission = async (submissionId) => {
    if (!token) return;
    setReviewAction("reject");
    try {
      await jobApi.rejectSubmission(
        jobId,
        submissionId,
        { feedback: rejectFeedback.trim() },
        token,
      );
      setStatus({ type: "success", message: "Работа возвращена исполнителю на доработку" });
      setReviewSubmission(null);
      await reloadJob();
      const subList = await jobApi.submissions(jobId, token);
      setSubmissions(Array.isArray(subList) ? subList : []);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setReviewAction(null);
    }
  };

  const handleReleaseAssignee = async () => {
    if (!token) return;
    const ok = window.confirm(
      "Снять текущего исполнителя и снова открыть задание для откликов? " +
        "Текущий исполнитель больше не будет назначен; другие кандидаты снова смогут участвовать в отборе.",
    );
    if (!ok) return;
    setReviewAction("release");
    try {
      await jobApi.releaseAssignee(jobId, token);
      setStatus({ type: "success", message: "Исполнитель снят, задание снова в открытом поиске" });
      setReviewSubmission(null);
      await reloadJob();
      const subList = await jobApi.submissions(jobId, token);
      setSubmissions(Array.isArray(subList) ? subList : []);
      const apps = await jobApi.applications(jobId, token);
      setApplications(Array.isArray(apps) ? apps : []);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setReviewAction(null);
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
        </div>

        {job.moderation_status === "pending" && isOwner && (
          <p className="muted-text">
            Задание на модерации. После проверки оно станет видно в общем списке.
          </p>
        )}
        {job.moderation_status === "rejected" && isOwner && (
          <p className="error-text">Задание отклонено модерацией. {job.moderation_note || ""}</p>
        )}

        {job.assigned_to && (isOwner || isAssignedWorker) && (
          <section className={`${styles.formSection} ${styles.workflowPanel}`}>
            <h3 className={styles.workflowPanelTitle}>Этапы и история ТЗ</h3>
            <h4 className={styles.workflowSubTitle}>Этапы (milestones)</h4>
            <ul className={styles.workflowList}>
              {milestones.map((m) => (
                <li key={m.id} className={styles.workflowListItem}>
                  <div className={styles.workflowListMain}>
                    <span className={styles.workflowMilestoneTitle}>{m.title}</span>
                    {m.due_date ? (
                      <span className={styles.workflowMuted}>до {m.due_date}</span>
                    ) : null}
                    {m.is_completed ? <span className={styles.workflowDone}>✓ Выполнено</span> : null}
                  </div>
                  {!m.is_completed && (isOwner || isAssignedWorker) ? (
                    <button
                      type="button"
                      className={`secondary-button ${styles.workflowListBtn}`}
                      onClick={async () => {
                        try {
                          await jobApi.completeMilestone(jobId, m.id, token);
                          const next = await jobApi.milestones(jobId, token);
                          setMilestones(Array.isArray(next) ? next : []);
                        } catch (e) {
                          setStatus({ type: "error", message: e.message });
                        }
                      }}
                    >
                      Отметить выполненным
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {isOwner && (
              <div className={styles.workflowAddRow}>
                <input
                  className={styles.workflowInput}
                  placeholder="Название этапа"
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                />
                <input
                  className={styles.workflowDate}
                  type="date"
                  value={milestoneDue}
                  onChange={(e) => setMilestoneDue(e.target.value)}
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={async () => {
                    if (!milestoneTitle.trim()) {
                      setStatus({ type: "error", message: "Укажите название этапа." });
                      return;
                    }
                    try {
                      await jobApi.createMilestone(
                        jobId,
                        { title: milestoneTitle.trim(), due_date: milestoneDue || null },
                        token,
                      );
                      setMilestoneTitle("");
                      setMilestoneDue("");
                      const next = await jobApi.milestones(jobId, token);
                      setMilestones(Array.isArray(next) ? next : []);
                    } catch (e) {
                      setStatus({ type: "error", message: e.message });
                    }
                  }}
                >
                  Добавить этап
                </button>
              </div>
            )}
            <h4 className={styles.workflowSubTitle}>История правок описания (ТЗ)</h4>
            {specHistory.length === 0 && <p className="muted-text">Правок ещё не было.</p>}
            <ul className={styles.workflowHistory}>
              {specHistory.map((rev) => (
                <li key={rev.id} className={styles.workflowHistoryItem}>
                  <span className={styles.workflowHistoryDate}>
                    {new Date(rev.created_at).toLocaleString("ru-RU")}
                  </span>
                  <span className={styles.workflowHistorySnippet}>
                    {(rev.previous_description || "").slice(0, 160)}
                    {(rev.previous_description || "").length > 160 ? "…" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {((job.assigned_to && (isOwner || isAssignedWorker)) ||
          (user?.is_arbitrator && job.status === "disputed")) && (
          <section className={`${styles.formSection} ${styles.workflowPanel}`}>
            <h3 className={styles.workflowPanelTitle}>Спор и арбитраж</h3>
            {disputes.length > 0 && (
              <ul className={styles.disputeList}>
                {disputes.map((d) => (
                  <li key={d.id} className={styles.disputeListItem}>
                    <strong className={styles.disputeStatus}>
                      {disputeStatusRu[d.status] || d.status}
                    </strong>
                    <p className={styles.disputeSummary}>{d.summary?.slice(0, 240) || "—"}</p>
                    {d.arbitrator_decision ? (
                      <p className={styles.disputeArb}>
                        Решение арбитра: {d.arbitrator_decision.slice(0, 200)}
                        {d.arbitrator_decision.length > 200 ? "…" : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {(isOwner || isAssignedWorker) && job.status !== "disputed" && (
              <div className={styles.disputeOpenRow}>
                <textarea
                  className={styles.disputeTextarea}
                  placeholder="Описание спора"
                  value={disputeSummary}
                  onChange={(e) => setDisputeSummary(e.target.value)}
                  rows={3}
                />
                <div className={styles.disputeActions}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={async () => {
                      try {
                        await jobApi.openDispute(jobId, disputeSummary, token);
                        setDisputeSummary("");
                        await reloadJob();
                        const d = await jobApi.disputes(jobId, token);
                        setDisputes(Array.isArray(d) ? d : []);
                      } catch (e) {
                        setStatus({ type: "error", message: e.message });
                      }
                    }}
                  >
                    Открыть спор
                  </button>
                </div>
              </div>
            )}
            {job.status === "disputed" && activeOpenDispute && (isOwner || isAssignedWorker) && (
              <div className={styles.disputeResolveBlock}>
                <textarea
                  className={styles.disputeTextarea}
                  placeholder="Итог спора / договорённости (только пока спор не передан арбитру)"
                  value={disputeResolve}
                  onChange={(e) => setDisputeResolve(e.target.value)}
                  rows={3}
                />
                <div className={styles.disputeBtnRow}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={async () => {
                      try {
                        await jobApi.resolveDispute(jobId, disputeResolve, token);
                        setDisputeResolve("");
                        await reloadJob();
                        const d = await jobApi.disputes(jobId, token);
                        setDisputes(Array.isArray(d) ? d : []);
                      } catch (e) {
                        setStatus({ type: "error", message: e.message });
                      }
                    }}
                  >
                    Закрыть спор по соглашению
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={async () => {
                      try {
                        await jobApi.escalateDispute(jobId, token);
                        await reloadJob();
                        const d = await jobApi.disputes(jobId, token);
                        setDisputes(Array.isArray(d) ? d : []);
                        setStatus({ type: "success", message: "Спор передан арбитру." });
                      } catch (e) {
                        setStatus({ type: "error", message: e.message });
                      }
                    }}
                  >
                    Передать арбитру
                  </button>
                </div>
              </div>
            )}
            {user?.is_arbitrator && activeEscalatedDispute && (
              <div className={styles.disputeArbBlock}>
                <textarea
                  className={styles.disputeTextarea}
                  placeholder="Решение арбитра (обязательно)"
                  value={arbDecision}
                  onChange={(e) => setArbDecision(e.target.value)}
                  rows={4}
                />
                <div className={styles.disputeActions}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={async () => {
                      try {
                        await jobApi.arbitrateDispute(jobId, arbDecision, token);
                        setArbDecision("");
                        await reloadJob();
                        const d = await jobApi.disputes(jobId, token);
                        setDisputes(Array.isArray(d) ? d : []);
                        setStatus({ type: "success", message: "Решение зафиксировано." });
                      } catch (e) {
                        setStatus({ type: "error", message: e.message });
                      }
                    }}
                  >
                    Вынести решение
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

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
                  <div className={styles.applicationWorkerLine}>
                    <strong>{app.worker?.username || "Исполнитель"}</strong>
                    {app.worker?.id != null ? (
                      <Link className="link-button" to={`/u/${app.worker.id}/portfolio`}>
                        Профиль и портфолио
                      </Link>
                    ) : null}
                  </div>
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
            {job.status === "in_progress" &&
              submissions.some((s) => String(s.status).toLowerCase() === "needs_changes") && (
                <p className={styles.reviewBanner}>
                  Работа возвращена на доработку. После новой отправки исполнителем снова откройте проверку
                  результата.
                </p>
              )}
            {submissionsLoading && <p className="muted-text">Загружаем материалы…</p>}
            {!submissionsLoading && employerReviewSubmissions.length === 0 && (
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
              employerReviewSubmissions.length > 0 &&
              pendingSubmissions.length === 0 && (
                <p className="muted-text">Все отправленные версии обработаны.</p>
              )}
          </section>
        )}

        {showSubmitWork && (
          <section id="job-submit-work" className={`${styles.formSection} ${styles.workflowPanel}`}>
            <div className={styles.submitResultHeader}>
              <h3 className={styles.workflowPanelTitle}>Отправить результат заказчику</h3>
              <div className={styles.submitAttachWrap} ref={submitAttachMenuRef}>
                <button
                  type="button"
                  className={styles.submitAttachToggle}
                  onClick={() => setSubmitAttachMenuOpen((o) => !o)}
                  title="Прикрепить файлы"
                  aria-expanded={submitAttachMenuOpen}
                  aria-haspopup="true"
                >
                  <FaPaperclip aria-hidden />
                </button>
                {submitAttachMenuOpen ? (
                  <div className={styles.submitAttachMenu} role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.submitAttachMenuItem}
                      onClick={() => {
                        setSubmitAttachMenuOpen(false);
                        submitPhotoInputRef.current?.click();
                      }}
                    >
                      Фото
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.submitAttachMenuItem}
                      onClick={() => {
                        setSubmitAttachMenuOpen(false);
                        submitDocInputRef.current?.click();
                      }}
                    >
                      Документ
                    </button>
                  </div>
                ) : null}
                <input
                  ref={submitPhotoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className={styles.hiddenFileInput}
                  onChange={(e) => {
                    addSubmitAttachFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={submitDocInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,.odt,.ods,image/*"
                  multiple
                  className={styles.hiddenFileInput}
                  onChange={(e) => {
                    addSubmitAttachFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            {submitAttachFiles.length > 0 ? (
              <div className={styles.submitAttachChips}>
                {submitAttachFiles.map((f, idx) => (
                  <span key={`${f.name}-${idx}`} className={styles.submitAttachChip}>
                    {f.name}
                    <button
                      type="button"
                      className={styles.submitAttachChipRemove}
                      onClick={() =>
                        setSubmitAttachFiles((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label="Убрать файл"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button type="button" className="link-button" onClick={clearSubmitAttachments}>
                  Очистить всё
                </button>
              </div>
            ) : null}
            <p className={styles.submitAttachHint}>
              До {MAX_SUBMIT_ATTACH} файлов, каждый до 10 МБ. Можно добавить ссылку на облако.
            </p>
            <div className={styles.submitComposeRow}>
              <textarea
                className={styles.submitComposeTextarea}
                rows={5}
                placeholder="Описание выполненной работы"
                value={submitMessage}
                onChange={(e) => setSubmitMessage(e.target.value)}
              />
            </div>
            <label className={styles.submitUrlLabel}>
              Ссылка на материалы (необязательно)
              <input
                type="url"
                placeholder="https://…"
                value={submitUrl}
                onChange={(e) => setSubmitUrl(e.target.value)}
              />
            </label>
            <div className={styles.submitResultActions}>
              <button className="primary-button" type="button" onClick={submitWorkResult}>
                Отправить на проверку
              </button>
            </div>
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
          <section id="job-apply" className={styles.formSection}>
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
              <div className={styles.applyBlock}>
                <div className={styles.applyTextareaWrap}>
                  <textarea
                    className={styles.applyTextarea}
                    rows={10}
                    maxLength={MAX_APPLY_LEN}
                    value={applyText}
                    onChange={(e) => setApplyText(e.target.value)}
                    placeholder="Сопроводительный текст"
                  />
                  <span className={styles.applyCounter}>
                    {applyText.length} / {MAX_APPLY_LEN}
                  </span>
                </div>
                <label className={styles.applyBudgetLabel}>
                  Ожидаемая сумма (₽)
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={applyBudget}
                    onChange={(e) => setApplyBudget(e.target.value)}
                    placeholder="0"
                  />
                </label>
                <div className={styles.applySubmitRow}>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={applySaving}
                    onClick={submitApply}
                  >
                    {applySaving ? "Отправка…" : "Отправить отклик"}
                  </button>
                </div>
              </div>
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
          onClick={() => !reviewBusy && setReviewSubmission(null)}
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

            {(() => {
              const materialUrls = parseDeliverableUrls(reviewSubmission.deliverable_url);
              const raw = (reviewSubmission.deliverable_url || "").trim();
              if (materialUrls.length > 0) {
                return (
                  <div className={styles.modalSection}>
                    <h4 className={styles.modalSectionTitle}>Материалы</h4>
                    <p className="muted-text">
                      Ссылки на файлы или загруженные материалы. Откройте в браузере или сохраните на устройство.
                    </p>
                    <ul className={styles.deliverableLinkList}>
                      {materialUrls.map((u, idx) => (
                        <li key={u + idx} className={styles.deliverableLinkRow}>
                          <span className={styles.deliverableLinkName}>Материал {idx + 1}</span>
                          <div className={styles.modalFileActions}>
                            <a className="secondary-button" href={u} target="_blank" rel="noreferrer">
                              Открыть
                            </a>
                            <a
                              className="primary-button"
                              href={u}
                              download={submissionFileName(u)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Скачать
                            </a>
                          </div>
                          <p className={styles.modalUrlHint}>{u}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }
              if (raw) {
                return (
                  <div className={styles.modalSection}>
                    <h4 className={styles.modalSectionTitle}>Материалы</h4>
                    <p className={styles.modalBodyScroll}>{raw}</p>
                  </div>
                );
              }
              return (
                <p className="muted-text">Исполнитель не приложил отдельную ссылку на файлы.</p>
              );
            })()}

            {canConfirmReviewSubmission && (
              <div className={styles.reviewDecisionCard}>
                <p className={styles.reviewDecisionHint}>
                  Доступно при каждой новой сдаче: можно принять работу, вернуть на доработку с комментарием или
                  снять исполнителя и снова открыть задание для других.
                </p>
                <label className={styles.modalFeedbackLabel}>
                  Комментарий для исполнителя при возврате на доработку (необязательно)
                  <textarea
                    className={styles.modalFeedbackTextarea}
                    rows={3}
                    maxLength={1000}
                    value={rejectFeedback}
                    onChange={(e) => setRejectFeedback(e.target.value)}
                    placeholder="Что именно нужно исправить или доработать"
                    disabled={reviewBusy}
                  />
                </label>
                <div className={styles.reviewDecisionActions}>
                  <button
                    className={styles.modalDangerButton}
                    type="button"
                    disabled={reviewBusy}
                    onClick={handleReleaseAssignee}
                  >
                    {reviewAction === "release" ? "Сохранение…" : "Отказаться от исполнителя"}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={reviewBusy}
                    onClick={() => handleRejectSubmission(reviewSubmission.id)}
                  >
                    {reviewAction === "reject" ? "Отправка…" : "Вернуть на доработку"}
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={reviewBusy}
                    onClick={() => handleApproveSubmission(reviewSubmission.id)}
                  >
                    {reviewAction === "approve" ? "Подтверждаем…" : "Подтвердить выполнение"}
                  </button>
                </div>
              </div>
            )}

            <div className={styles.modalFooter}>
              <button
                className="secondary-button"
                type="button"
                disabled={reviewBusy}
                onClick={() => !reviewBusy && setReviewSubmission(null)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetails;
