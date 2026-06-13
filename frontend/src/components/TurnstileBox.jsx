import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Alert } from "antd";

const TURNSTILE_SITE_KEY =
  process.env.REACT_APP_CYCLOME_TURNSTILE_SITE_KEY ||
  "0x4AAAAAADjaY1VgY--UPyOk";
const TURNSTILE_ACTION = "turnstile-spin-v1";

const TurnstileBox = forwardRef(function TurnstileBox(
  { disabled = false, onToken },
  ref,
) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [error, setError] = useState("");

  useImperativeHandle(ref, () => ({
    reset() {
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.reset(widgetIdRef.current);
      }
      onToken("");
    },
  }));

  useEffect(() => {
    let stopped = false;
    let attempts = 0;
    let retryTimer = null;

    const renderWidget = () => {
      if (stopped) return;
      if (!TURNSTILE_SITE_KEY) {
        setError("Verification is not configured.");
        return;
      }
      if (window.turnstile && containerRef.current && widgetIdRef.current === null) {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: TURNSTILE_ACTION,
          callback(token) {
            setError("");
            onToken(token || "");
          },
          "expired-callback"() {
            onToken("");
          },
          "error-callback"() {
            onToken("");
            setError("Verification failed. Try again.");
          },
        });
        return;
      }
      if (attempts < 80) {
        attempts += 1;
        retryTimer = setTimeout(renderWidget, 250);
      } else {
        setError("Verification failed to load.");
      }
    };

    renderWidget();

    return () => {
      stopped = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [onToken]);

  return (
    <div style={{ opacity: disabled ? 0.55 : 1 }}>
      <div ref={containerRef} />
      {error ? (
        <Alert
          type="error"
          showIcon
          message={error}
          style={{ marginTop: 12 }}
        />
      ) : null}
    </div>
  );
});

export default TurnstileBox;
