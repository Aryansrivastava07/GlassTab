import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

const getWidgetStorageKey = (widgetId) => `landing_widget_store_${widgetId}`;

const readWidgetStorage = (widgetId) => {
  try {
    const raw = localStorage.getItem(getWidgetStorageKey(widgetId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeWidgetStorageKey = (widgetId, key, value) => {
  try {
    const existing = readWidgetStorage(widgetId);
    existing[key] = value;
    localStorage.setItem(getWidgetStorageKey(widgetId), JSON.stringify(existing));
  } catch (err) {
    console.warn('Widget local storage write failed:', err);
  }
};

const executeBackgroundFetch = async (url, options = {}) => {
  const isExtension = typeof window !== 'undefined' && Boolean(window.chrome?.runtime?.sendMessage);

  if (isExtension) {
    const bgRes = await new Promise((resolve) => {
      window.chrome.runtime.sendMessage(
        { type: 'WIDGET_FETCH', url, options },
        (response) => {
          if (window.chrome.runtime.lastError || !response) {
            resolve({
              ok: false,
              status: 0,
              via: 'bg-runtime-err',
              error: window.chrome.runtime.lastError?.message || 'Background proxy unavailable',
            });
          } else {
            resolve({ ...response, via: 'bg' });
          }
        }
      );
    });

    if (bgRes.ok || (bgRes.status && bgRes.status > 0)) {
      return bgRes;
    }

    // Fallback: try direct fetch from extension page (index.html)
    try {
      const res = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers,
        body: options.method && options.method !== 'GET' ? options.body : undefined,
      });
      const text = await res.text();
      return {
        ok: res.ok,
        status: res.status,
        text,
        fromCache: false,
        fetchedAt: Date.now(),
        via: 'page-fallback',
      };
    } catch (pageErr) {
      return {
        ok: false,
        status: 0,
        error: `${bgRes.error || 'Failed'} (ext-bg: ${bgRes.via}, page: ${pageErr.message}). Check edge://extensions -> Details -> Site access = On all sites (or Remove & Load unpacked).`,
      };
    }
  }

  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers,
      body: options.method && options.method !== 'GET' ? options.body : undefined,
    });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      text,
      fromCache: false,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: `${err.message} (not running as extension)`,
    };
  }
};

const executeSpeedTest = async (optionsOrActiveTest = true) => {
  const opts =
    typeof optionsOrActiveTest === 'object' && optionsOrActiveTest !== null
      ? optionsOrActiveTest
      : { activeTest: optionsOrActiveTest !== false };
  const activeTest = opts.activeTest !== false;
  const bytes = Math.min(2000000, Math.max(100000, Number(opts.bytes) || 500000));

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const baseInfo = {
    online: navigator.onLine,
    effectiveType: conn?.effectiveType || '4g',
    downlinkHintMbps: conn?.downlink ?? null,
    rttHintMs: conn?.rtt ?? null,
  };

  if (typeof window !== 'undefined' && window.chrome?.runtime?.sendMessage) {
    return new Promise((resolve) => {
      window.chrome.runtime.sendMessage(
        { type: 'WIDGET_SPEED_TEST', activeTest, bytes },
        (response) => {
          if (window.chrome.runtime.lastError || !response || !response.ok) {
            resolve({
              ...baseInfo,
              pingMs: baseInfo.rttHintMs,
              downloadMbps: baseInfo.downlinkHintMbps,
              measuredAt: Date.now(),
              note: response?.error || 'Using browser connection estimate',
            });
          } else {
            resolve({ ...baseInfo, ...response });
          }
        }
      );
    });
  }

  // Fallback for Vite dev mode
  return {
    ...baseInfo,
    pingMs: baseInfo.rttHintMs ?? 24,
    downloadMbps: baseInfo.downlinkHintMbps ?? null,
    measuredAt: Date.now(),
  };
};

const getBatteryStatus = async () => {
  if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
    const battery = await navigator.getBattery();
    return {
      supported: true,
      level: Math.round((battery.level ?? 1) * 100),
      charging: Boolean(battery.charging),
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime,
    };
  }
  return { supported: false, level: null, charging: false };
};

const CustomWidgetFrame = ({
  widget,
  width = 360,
  height = 210,
  showControls = false,
  onEdit,
  onDelete,
  onLog,
}) => {
  const iframeRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [sandboxReady, setSandboxReady] = useState(false);
  const [mirrorActive, setMirrorActive] = useState(false);
  const [mirrorOpts, setMirrorOpts] = useState({
    flip: true,
    filter: 'none',
    zoom: 1,
  });

  const sandboxSrc =
    typeof window !== 'undefined' && window.chrome?.runtime?.getURL
      ? window.chrome.runtime.getURL('widget-sandbox.html')
      : '/widget-sandbox.html';

  const stopMirrorStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setMirrorActive(false);
  };

  const startMirrorStream = async (options = {}) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera API not available in this browser context.');
    }
    if (!streamRef.current) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    }
    setMirrorOpts((prev) => ({ ...prev, ...options }));
    setMirrorActive(true);
    return { active: true };
  };

  useEffect(() => {
    if (mirrorActive && videoRef.current && streamRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [mirrorActive]);

  useEffect(() => {
    return () => {
      stopMirrorStream();
    };
  }, []);

  const sendInit = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: 'INIT_WIDGET',
        widgetId: widget.id,
        code: widget.code || '',
        width,
        height,
        initialStorage: readWidgetStorage(widget.id),
      },
      '*'
    );
  };

  useEffect(() => {
    const replyRpc = (reqId, result, error = null) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'WIDGET_RPC_RESULT', reqId, result, error },
        '*'
      );
    };

    const handleMessage = async (event) => {
      const iframeWin = iframeRef.current?.contentWindow;
      if (!iframeWin || event.source !== iframeWin) return;

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'SANDBOX_READY') {
        setSandboxReady(true);
        sendInit();
      } else if (data.type === 'WIDGET_STORAGE_SET') {
        writeWidgetStorageKey(widget.id, data.key, data.value);
      } else if (data.type === 'WIDGET_FETCH') {
        const result = await executeBackgroundFetch(data.url, data.options);
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'WIDGET_FETCH_RESULT', reqId: data.reqId, ...result },
          '*'
        );
      } else if (data.type === 'WIDGET_BATTERY_GET') {
        try {
          const info = await getBatteryStatus();
          replyRpc(data.reqId, info);
        } catch (err) {
          replyRpc(data.reqId, null, err.message);
        }
      } else if (data.type === 'WIDGET_SPEED_TEST') {
        try {
          const speed = await executeSpeedTest({
            activeTest: data.activeTest,
            bytes: data.bytes,
          });
          replyRpc(data.reqId, speed);
        } catch (err) {
          replyRpc(data.reqId, null, err.message);
        }
      } else if (data.type === 'WIDGET_MIRROR_CMD') {
        try {
          if (data.action === 'start') {
            const res = await startMirrorStream(data.options || {});
            replyRpc(data.reqId, res);
          } else if (data.action === 'stop') {
            stopMirrorStream();
            replyRpc(data.reqId, { active: false });
          } else if (data.action === 'options') {
            setMirrorOpts((prev) => ({ ...prev, ...(data.options || {}) }));
            replyRpc(data.reqId, { ok: true });
          }
        } catch (err) {
          replyRpc(data.reqId, null, err.message || 'Camera permission denied');
        }
      } else if (data.type === 'WIDGET_LOG' && onLog) {
        onLog(data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.id]);

  // Re-initialize whenever code changes
  useEffect(() => {
    stopMirrorStream();
    if (sandboxReady) {
      sendInit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.code, widget.id, sandboxReady]);

  // Notify resize cleanly without reloading script state
  useEffect(() => {
    if (sandboxReady) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'WIDGET_RESIZE', width, height },
        '*'
      );
    }
  }, [width, height, sandboxReady]);

  return (
    <div
      className="relative w-full h-full group overflow-hidden rounded-2xl"
      style={{
        backgroundColor: 'var(--glass-widgets-bg, rgba(10, 12, 18, 0.55))',
        backdropFilter: 'blur(var(--glass-widgets-blur, 10px))',
        WebkitBackdropFilter: 'blur(var(--glass-widgets-blur, 10px))',
        border: '1px solid rgba(255, 255, 255, 0.12)',
      }}
    >
      {/* Live Camera Mirror Layer (rendered behind transparent widget UI) */}
      {mirrorActive && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{
            transform: `${mirrorOpts.flip ? 'scaleX(-1)' : ''} scale(${mirrorOpts.zoom || 1})`,
            filter: mirrorOpts.filter || 'none',
          }}
        />
      )}

      {/* Quick edit/delete actions on hover */}
      {showControls && (onEdit || onDelete) && (
        <div
          className="
            absolute top-2 right-2 z-20 flex items-center gap-1
            opacity-0 group-hover:opacity-100 transition-opacity duration-150
            bg-black/70 backdrop-blur-md border border-white/15 rounded-lg p-1 shadow-lg
          "
        >
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(widget)}
              className="p-1 text-gray-300 hover:text-blue-400 hover:bg-white/10 rounded transition cursor-pointer"
              title="Edit Widget Code"
            >
              <Pencil size={12} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(widget.id)}
              className="p-1 text-gray-300 hover:text-red-400 hover:bg-white/10 rounded transition cursor-pointer"
              title="Remove Widget"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={sandboxSrc}
        title={widget.name || 'Custom Widget'}
        sandbox="allow-scripts allow-forms allow-popups allow-modals"
        className="relative z-10 w-full h-full border-0 bg-transparent block"
      />
    </div>
  );
};

export default CustomWidgetFrame;
