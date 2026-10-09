import { Leaf, ShieldCheck, CircleAlert, FlaskConical, ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { isLowConfidence, type Prediction } from "@/services/diseaseDetection";
export function Result({ prediction }: { prediction: Prediction }) {
  const { t, language } = useLanguage();
  const low = isLowConfidence(prediction);
  const tr = (v: Prediction["crop"]) => v[language] || v.en;
  return (
    <div className={`animate-enter ${low ? "result-low" : ""}`}>
      <span className="eyebrow">
        <FlaskConical size={13} />
        {t("simulated")}
      </span>
      <p className="text-xs text-muted-foreground mt-5">
        {t("crop")} · {tr(prediction.crop)}
      </p>
      <p className="result-label">{t("possibleDisease")}</p>
      <h2 className="result-disease">{tr(prediction.disease)}</h2>
      <div className="confidence-row">
        <span>{t("confidence")}</span>
        <strong>{prediction.confidence}%</strong>
      </div>
      <div className="confidence-track">
        <progress max={100} value={prediction.confidence} aria-label={t("confidence")} />
      </div>
      {low && (
        <div className="demo-notice mb-0" role="status">
          <CircleAlert className="shrink-0" size={18} />
          <div>
            <h3 className="font-semibold mb-1">{t("lowBadge")}</h3>
            <p>{t("lowMessage")}</p>
          </div>
        </div>
      )}
      <div className="result-list">
        <h3>
          <Leaf size={16} className="text-primary" />
          {t("symptoms")}
        </h3>
        {prediction.symptoms.length ? (
          <ul>
            {prediction.symptoms.map((s, i) => (
              <li key={i}>{tr(s)}</li>
            ))}
          </ul>
        ) : (
          <p className="result-copy">{t("notDetermined")}</p>
        )}
      </div>
      <div className="result-list">
        <h3>
          <ShieldCheck size={16} className="text-primary" />
          {t("prevention")}
        </h3>
        {prediction.prevention.length && !low ? (
          <ul>
            {prediction.prevention.map((s, i) => (
              <li key={i}>{tr(s)}</li>
            ))}
          </ul>
        ) : (
          <p className="result-copy">{t("lowPrevention")}</p>
        )}
      </div>
      <div className="result-list result-next-step">
        <h3>
          <ArrowRight size={16} className="text-primary" />
          {t("nextStep")}
        </h3>
        <p className="result-copy">{tr(prediction.nextStep)}</p>
      </div>
    </div>
  );
}
