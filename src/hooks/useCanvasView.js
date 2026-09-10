import { useCallback, useEffect, useRef, useState } from 'react';

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2.5;

export function useCanvasView() {
  const [isPanning, setIsPanning] = useState(false);
  const [view, setView] = useState({ x: 40, y: 40, scale: 1 });
  const [hintFaded, setHintFaded] = useState(false);
  const chartRef = useRef(null);
  const viewportRef = useRef(null);
  const panStateRef = useRef(null);

  const centerTree = useCallback((scale = view.scale) => {
    const chartScroll = chartRef.current;
    const viewport = viewportRef.current;
    if (!chartScroll || !viewport) return;
    const rect = chartScroll.getBoundingClientRect();
    const contentW = viewport.offsetWidth;
    setView((current) => ({ ...current, x: Math.max(20, (rect.width - contentW * scale) / 2), y: 30, scale }));
  }, [view.scale]);

  const fitToScreen = useCallback(() => {
    const chartScroll = chartRef.current;
    const viewport = viewportRef.current;
    if (!chartScroll || !viewport) return;
    const rect = chartScroll.getBoundingClientRect();
    const contentW = viewport.offsetWidth;
    const contentH = viewport.offsetHeight;
    if (!contentW || !contentH) return;
    const scaleX = (rect.width - 60) / contentW;
    const scaleY = (rect.height - 60) / contentH;
    const nextScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(scaleX, scaleY, 1)));
    const x = Math.max(20, (rect.width - contentW * nextScale) / 2);
    setView({ x, y: 30, scale: nextScale });
  }, []);

  useEffect(() => {
    requestAnimationFrame(fitToScreen);
  }, [fitToScreen]);

  useEffect(() => {
    const onMouseMove = (event) => {
      if (!panStateRef.current) return;
      const { startX, startY, origX, origY } = panStateRef.current;
      setView((current) => ({ ...current, x: origX + (event.clientX - startX), y: origY + (event.clientY - startY) }));
    };
    const onMouseUp = () => {
      if (!panStateRef.current) return;
      panStateRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const zoomAt = (px, py, newScale) => {
    setView((current) => {
      const scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newScale));
      const contentX = (px - current.x) / current.scale;
      const contentY = (py - current.y) / current.scale;
      return { scale, x: px - contentX * scale, y: py - contentY * scale };
    });
  };

  const handleCanvasMouseDown = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('.node-card, .node-actions, .toggle-btn, #zoom-controls, #btn-legend, #legend-panel')) return;
    panStateRef.current = { startX: event.clientX, startY: event.clientY, origX: view.x, origY: view.y };
    setIsPanning(true);
    setHintFaded(true);
    event.preventDefault();
  };

  const handleWheel = (event) => {
    event.preventDefault();
    setHintFaded(true);
    const rect = chartRef.current.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const factor = Math.exp(-event.deltaY * 0.0015);
    zoomAt(mx, my, view.scale * factor);
  };

  return {
    view,
    isPanning,
    hintFaded,
    chartRef,
    viewportRef,
    centerTree,
    fitToScreen,
    zoomAt,
    handleCanvasMouseDown,
    handleWheel,
  };
}
