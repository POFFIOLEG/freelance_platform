import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { authApi } from "../api/client.js";
import { CATEGORIES } from "../constants/categories.js";
import styles from "./PortfolioWorkWizard.module.css";

const CATEGORY_OPTIONS = Object.keys(CATEGORIES);
const MAX_TITLE = 120;
const MAX_DESC = 1500;
const MAX_GALLERY = 4;
const MAX_TOOLS = 20;

function PortfolioWorkWizard({ token, onAdded, scrollAnchorRef }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");

  const [title, setTitle] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const [category, setCategory] = useState("");
  const [placement, setPlacement] = useState("last");
  const [sortManual, setSortManual] = useState(0);
  const [toolDraft, setToolDraft] = useState("");
  const [tools, setTools] = useState([]);

  const coverInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setStep(1);
    setLocalError("");
    setTitle("");
    setCoverFile(null);
    setGalleryFiles([]);
    setDescription("");
    setLink("");
    setVideoUrl("");
    setCategory("");
    setPlacement("last");
    setSortManual(0);
    setToolDraft("");
    setTools([]);
  }, []);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview("");
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const addGallery = useCallback((files) => {
    const arr = Array.from(files || []).filter(Boolean);
    if (arr.length === 0) return;
    setGalleryFiles((prev) => {
      const next = [...prev];
      for (const f of arr) {
        if (next.length >= MAX_GALLERY) break;
        next.push(f);
      }
      return next;
    });
  }, []);

  const validateStep = (n) => {
    setLocalError("");
    if (n === 1) {
      if (!title.trim()) {
        setLocalError("Укажите название работы.");
        return false;
      }
      if (title.trim().length > MAX_TITLE) {
        setLocalError(`Название не длиннее ${MAX_TITLE} символов.`);
        return false;
      }
    }
    if (n === 2) {
      if (description.length > MAX_DESC) {
        setLocalError(`Описание не длиннее ${MAX_DESC} символов.`);
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(3, s + 1));
  };

  const back = () => {
    setLocalError("");
    setStep((s) => Math.max(1, s - 1));
  };

  const addTool = () => {
    const t = toolDraft.trim();
    if (!t) return;
    if (tools.length >= MAX_TOOLS) {
      setLocalError(`Не более ${MAX_TOOLS} навыков и инструментов.`);
      return;
    }
    if (tools.includes(t)) {
      setToolDraft("");
      return;
    }
    setTools((prev) => [...prev, t.slice(0, 200)]);
    setToolDraft("");
    setLocalError("");
  };

  const publish = async () => {
    if (!validateStep(1) || !validateStep(2)) {
      setStep(1);
      return;
    }
    setSaving(true);
    setLocalError("");
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", description);
      fd.append("link", link.trim());
      fd.append("video_url", videoUrl.trim());
      fd.append("category", category);
      fd.append("placement", placement);
      if (placement === "manual") {
        fd.append("sort_order_manual", String(Math.max(0, Number(sortManual) || 0)));
      }
      fd.append("tools_skills", JSON.stringify(tools));
      if (coverFile) fd.append("image", coverFile);
      galleryFiles.forEach((f) => fd.append("gallery", f));

      const item = await authApi.portfolioCreate(fd, token);
      onAdded?.(item);
      close();
    } catch (e) {
      const msg = e.message || "Не удалось сохранить.";
      setLocalError(msg);
    } finally {
      setSaving(false);
    }
  };

  const openWithScroll = () => {
    setOpen(true);
    const el = scrollAnchorRef?.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  };

  if (!token) return null;

  const stepLabels = [
    { n: 1, label: "Название и файлы" },
    { n: 2, label: "Описание" },
    { n: 3, label: "Категория и навыки" },
  ];

  return (
    <>
      <button type="button" className="secondary-button" onClick={openWithScroll}>
        Добавить пример работы
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
        <div
          className={`${styles.overlay} ${styles.overlayVisible}`}
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div
            className={`${styles.dialog} ${styles.dialogEnter}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="portfolio-wizard-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <h2 id="portfolio-wizard-title" className={styles.title}>
                Добавление примера работы
              </h2>
              <button type="button" className={styles.closeBtn} aria-label="Закрыть" onClick={close}>
                ×
              </button>
            </div>

            <div className={styles.body}>
              <nav className={styles.steps} aria-label="Шаги">
                {stepLabels.map(({ n, label }) => (
                  <div
                    key={n}
                    className={`${styles.stepItem} ${step === n ? styles.stepItemActive : ""} ${
                      step > n ? styles.stepItemDone : ""
                    }`}
                  >
                    <span
                      className={`${styles.stepIcon} ${step > n ? styles.stepIconDone : ""}`}
                      aria-hidden
                    >
                      {step > n ? "✓" : ""}
                    </span>
                    <span>{label}</span>
                  </div>
                ))}
              </nav>

              <div className={styles.main}>
                {localError ? (
                  <p className={`error-text ${styles.error}`}>{localError}</p>
                ) : null}

                {step === 1 && (
                  <>
                    <div className={styles.field}>
                      <label htmlFor="pw-title">Название работы</label>
                      <input
                        id="pw-title"
                        value={title}
                        maxLength={MAX_TITLE}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Краткое название проекта"
                      />
                      <div className={styles.counter}>
                        {title.length} / {MAX_TITLE}
                      </div>
                    </div>

                    <div className={styles.field}>
                      <label>Обложка</label>
                      <div className={styles.coverRow}>
                        <div className={styles.coverPreview}>
                          {coverPreview ? (
                            <>
                              <img src={coverPreview} alt="" />
                              <button
                                type="button"
                                className={styles.coverRemove}
                                aria-label="Удалить обложку"
                                onClick={() => {
                                  setCoverFile(null);
                                  if (coverInputRef.current) coverInputRef.current.value = "";
                                }}
                              >
                                ×
                              </button>
                            </>
                          ) : (
                            <span className={styles.hint} style={{ padding: "2rem 0.5rem", display: "block" }}>
                              Превью
                            </span>
                          )}
                        </div>
                        <div className={styles.coverActions}>
                          <p className={styles.hint}>
                            Файл до 10 МБ. Форматы: jpg, png или webp. Рекомендуемый размер не менее 600×600 px,
                            соотношение сторон 1:1.
                          </p>
                          <input
                            ref={coverInputRef}
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                            className={styles.hiddenInput}
                            id="pw-cover"
                            onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                          />
                          <button
                            type="button"
                            className={styles.btnPrimary}
                            onClick={() => coverInputRef.current?.click()}
                          >
                            {coverFile ? "Заменить изображение" : "Выбрать обложку"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className={styles.field}>
                      <label>Файлы, иллюстрирующие работу</label>
                      <p className={styles.hint}>
                        До четырёх файлов, каждый до 10 МБ: jpg, jpeg, png, gif, mp4, webm.
                      </p>
                      <input
                        ref={galleryInputRef}
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm"
                        className={styles.hiddenInput}
                        id="pw-gallery"
                        onChange={(e) => {
                          addGallery(e.target.files);
                          if (galleryInputRef.current) galleryInputRef.current.value = "";
                        }}
                      />
                      <div
                        className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ""}`}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          setDragActive(true);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setDragActive(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragActive(false);
                          addGallery(e.dataTransfer.files);
                        }}
                      >
                        <p>Перетащите файлы сюда или выберите с диска</p>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => galleryInputRef.current?.click()}
                        >
                          Выбрать файлы
                        </button>
                        {galleryFiles.length > 0 ? (
                          <ul className={styles.galleryList}>
                            {galleryFiles.map((f, i) => (
                              <li key={`${f.name}-${i}`} className={styles.galleryChip}>
                                <span>{f.name}</span>
                                <button
                                  type="button"
                                  aria-label="Убрать файл"
                                  onClick={() => setGalleryFiles((prev) => prev.filter((_, j) => j !== i))}
                                >
                                  ×
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className={styles.field}>
                      <label htmlFor="pw-desc">Описание работы</label>
                      <textarea
                        id="pw-desc"
                        rows={10}
                        value={description}
                        maxLength={MAX_DESC}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Расскажите, для кого вы делали работу, на какие особенности заказчик должен обратить внимание, какие результаты были достигнуты"
                      />
                      <div className={styles.counter}>
                        {description.length} / {MAX_DESC}
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="pw-link">Ссылка</label>
                      <input
                        id="pw-link"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="https://"
                        inputMode="url"
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="pw-video">Видео</label>
                      <input
                        id="pw-video"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="YouTube, RuTube, Vimeo…"
                      />
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <div className={styles.field}>
                      <label htmlFor="pw-cat">Раздел портфолио</label>
                      <select
                        id="pw-cat"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="">Специализация</option>
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <span id="pw-place-label">Позиция работы в списке</span>
                      <div className={styles.radioGroup} role="group" aria-labelledby="pw-place-label">
                        <label className={styles.radioRow}>
                          <input
                            type="radio"
                            name="placement"
                            checked={placement === "last"}
                            onChange={() => setPlacement("last")}
                          />
                          Последняя
                        </label>
                        <label className={styles.radioRow}>
                          <input
                            type="radio"
                            name="placement"
                            checked={placement === "first"}
                            onChange={() => setPlacement("first")}
                          />
                          Первая
                        </label>
                        <label className={styles.radioRow}>
                          <input
                            type="radio"
                            name="placement"
                            checked={placement === "manual"}
                            onChange={() => setPlacement("manual")}
                          />
                          Указать вручную
                        </label>
                      </div>
                      {placement === "manual" ? (
                        <label style={{ marginTop: "0.5rem" }}>
                          Порядок (число)
                          <input
                            type="number"
                            min={0}
                            value={sortManual}
                            onChange={(e) => setSortManual(Number(e.target.value))}
                          />
                        </label>
                      ) : null}
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="pw-tools">Инструменты и навыки</label>
                      <p className={styles.hint}>
                        До {MAX_TOOLS} пунктов: программы и навыки, которые использовали для этой работы.
                      </p>
                      <div className={styles.tagInputRow}>
                        <input
                          id="pw-tools"
                          value={toolDraft}
                          onChange={(e) => setToolDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault();
                              addTool();
                            }
                          }}
                          placeholder="Например, Figma (необязательно)"
                        />
                        <button type="button" className={styles.btnSecondary} onClick={addTool}>
                          Добавить
                        </button>
                      </div>
                      <div className={styles.tagInputRow}>
                        {tools.map((t, ti) => (
                          <span key={`${ti}-${t}`} className={styles.tag}>
                            {t}
                            <button
                              type="button"
                              aria-label={`Удалить ${t}`}
                              onClick={() => setTools((prev) => prev.filter((x) => x !== t))}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={styles.footer}>
              {step > 1 ? (
                <button type="button" className={styles.btnSecondary} onClick={back} disabled={saving}>
                  Назад
                </button>
              ) : (
                <span />
              )}
              {step < 3 ? (
                <button type="button" className={styles.btnPrimary} onClick={next}>
                  Продолжить
                </button>
              ) : (
                <button type="button" className={styles.btnPrimary} onClick={publish} disabled={saving}>
                  {saving ? "Публикация…" : "Опубликовать"}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}

export default PortfolioWorkWizard;
