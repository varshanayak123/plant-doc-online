import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import {
  Upload,
  ImagePlus,
  X,
  ScanLine,
  ArrowRight,
  LoaderCircle,
  FlaskConical,
  Leaf,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeading, DemoNotice } from "@/components/agro/site-shell";
import { Result } from "@/components/agro/result";
import { useLanguage } from "@/lib/i18n";
import { pageHead } from "@/lib/metadata";
import {
  analyzeImage,
  uploadImage,
  validateImage,
  isLowConfidence,
  type Prediction,
} from "@/services/diseaseDetection";
import { createThumbnail, getGuestToken } from "@/services/scanHistory";
import sample from "@/assets/tomato-leaf.jpg";
export const Route = createFileRoute("/detect")({
  head: () =>
    pageHead(
      "Detect Disease",
      "Upload a crop leaf photo for an AI-powered disease screening with symptoms and prevention tips.",
    ),
  component: Detect,
});
function Detect() {
  const { t } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const uploadVersion = useRef(0);
  const resultPanel = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<"uploading" | "analyzing">("uploading");
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function receive(file?: File) {
    if (!file || busy) return;
    const version = ++uploadVersion.current;
    setError("");
    if (!validateImage(file)) {
      setError("invalidFile");
      return;
    }
    setPreparing(true);
    try {
      const source = URL.createObjectURL(file);
      try {
        const thumbnail = await createThumbnail(source);
        if (!alive.current || version !== uploadVersion.current) return;
        setPhoto(thumbnail);
        setFileName(file.name);
        setPrediction(null);
        setSaved(null);
      } finally {
        URL.revokeObjectURL(source);
      }
    } catch {
      if (alive.current && version === uploadVersion.current) setError("badImage");
    } finally {
      if (alive.current && version === uploadVersion.current) setPreparing(false);
    }
    if (input.current) input.current.value = "";
  }
  function remove() {
    ++uploadVersion.current;
    setPreparing(false);
    setPhoto(null);
    setPrediction(null);
    setSaved(null);
    setError("");
    if (input.current) input.current.value = "";
  }
  async function analyze() {
    if (!photo || busy || preparing) return;
    setBusy(true);
    setPrediction(null);
    setError("");
    if (window.matchMedia("(max-width: 760px)").matches)
      resultPanel.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    try {
      const guest = getGuestToken();
      let path = uploadedPath;
      if (!path) {
        setStage("uploading");
        const image = photo.startsWith("data:") ? photo : await createThumbnail(photo);
        const up = await uploadImage(guest, image);
        if (!alive.current) return;
        if (!up.ok) {
          setError(up.error);
          return;
        }
        path = up.path;
        setUploadedPath(path);
      }
      setStage("analyzing");
      const res = await analyzeImage(guest, path, fileName);
      if (!alive.current) return;
      if (!res.ok) {
        if (res.error === "notLeaf") setUploadedPath(null);
        setError(res.error);
        return;
      }
      setPrediction(res.prediction);
      setSaved(res.saved);
      setUploadedPath(null);
    } catch {
      if (alive.current) setError("aiUnavailable");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <main className="container page-main">
      <PageHeading title="detect" description="detectDesc" />
      <DemoNotice />
      <div className="detection-grid">
        <section className="tool-panel">
          <div className="panel-title">
            <h2>{t("leafImage")}</h2>
            <ImagePlus size={19} className="text-primary" />
          </div>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label={t("choose")}
            onChange={(e) => receive(e.target.files?.[0])}
            disabled={busy || preparing}
          />
          {photo ? (
            <>
              <img
                src={photo}
                width={480}
                height={480}
                className="preview-image"
                alt={t("leafImage")}
              />
              <div className="file-row">
                <Leaf size={15} />
                <span>{photo === sample ? t("sample") : fileName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("change")}
                  title={t("change")}
                  onClick={remove}
                  disabled={busy || preparing}
                >
                  <X />
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => input.current?.click()}
                disabled={busy || preparing}
              >
                <ImagePlus />
                {t("replaceImage")}
              </Button>
            </>
          ) : (
            <>
              <div
                className={`dropzone ${dragging ? "dragging" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={t("choose")}
                onClick={() => input.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    input.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  receive(e.dataTransfer.files[0]);
                }}
              >
                <div className="step-icon">
                  <Upload size={28} />
                </div>
                <strong>{t("drag")}</strong>
                <p>{t("or")}</p>
                <span className="text-primary font-semibold text-xs flex gap-2 items-center">
                  {t("choose")}
                  <ArrowRight size={14} />
                </span>
                <p>{t("formats")}</p>
              </div>
              <Button
                variant="link"
                className="w-full mt-3 text-xs"
                onClick={() => {
                  ++uploadVersion.current;
                  setPhoto(sample);
                  setFileName(t("sample"));
                  setError("");
                  setPrediction(null);
                  setSaved(null);
                }}
                disabled={busy || preparing}
              >
                <Leaf />
                {t("trySample")}
              </Button>
            </>
          )}
          {preparing && (
            <p role="status" className="upload-status">
              <LoaderCircle size={15} className="animate-spin" />
              {t("preparing")}
            </p>
          )}
          {error && (
            <p role="alert" className="error-message">
              {t(error as "invalidFile")}
            </p>
          )}
          {error && error !== "invalidFile" && error !== "badImage" && photo && (
            <Button variant="outline" className="w-full mt-3" onClick={analyze} disabled={busy}>
              <ScanLine />
              {t("retry")}
            </Button>
          )}
          <Button
            size="lg"
            className="analyze-button h-12"
            disabled={!photo || busy || preparing}
            onClick={analyze}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <ScanLine />}
            {t(busy ? stage : "analyze")}
          </Button>
        </section>
        <section
          ref={resultPanel}
          className="tool-panel result-panel"
          aria-live="polite"
          aria-busy={busy}
        >
          <div className="panel-title">
            <h2>{t("result")}</h2>
            <FlaskConical size={19} className="text-muted-foreground" />
          </div>
          {prediction ? (
            <>
              <Result prediction={prediction} />
              <p className="text-xs text-muted-foreground mt-6">
                {t(saved ? "saved" : "notSaved")}
              </p>
              {isLowConfidence(prediction) && (
                <Button className="retry-button" onClick={() => input.current?.click()}>
                  <Upload />
                  {t("retryImage")}
                </Button>
              )}
              <div className="result-actions">
                <Button variant="outline" onClick={remove}>
                  <ImagePlus />
                  {t("newScan")}
                </Button>
                <Button variant="ghost" asChild>
                  <Link to="/history">
                    <History />
                    {t("viewHistory")}
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <div className="result-empty">
              <div className="step-icon">
                {busy ? (
                  <LoaderCircle size={24} className="animate-spin" />
                ) : (
                  <ScanLine size={24} />
                )}
              </div>
              <h3>{t(busy ? "analyzing" : "awaiting")}</h3>
              <p>{t(busy ? "analyzingDesc" : "awaitingDesc")}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
