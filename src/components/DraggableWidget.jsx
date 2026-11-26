import { useState, useRef, useEffect, useCallback } from 'react';
import { GripHorizontal } from 'lucide-react';
import { getViewportSize, toPixelLayout, toViewportLayout } from '../utils/layoutService';

/**
 * DraggableWidget
 * Makes any component freely draggable AND resizable across the viewport.
 * Strictly enforces content-aware minWidth / minHeight limits so widgets
 * cannot shrink smaller than their content to introduce unwanted scroll.
 */
const DraggableWidget = ({
  id,
  title = '',
  layout,
  defaultLayout,
  viewport = getViewportSize(),
  onLayoutChange,
  children,
  className = '',
  minWidth: propMinWidth,
  minHeight: propMinHeight,
  draggable = true,
  resizable = true,
}) => {
  const nodeRef = useRef(null);

  // Content-aware min limits (constrained by available viewport)
  const maxAvailableViewportWidth = Math.max(100, viewport.width - 20);
  const rawMinWidth = propMinWidth ?? layout?.minWidth ?? defaultLayout?.minWidth ?? 120;
  const minWidth = Math.min(rawMinWidth, maxAvailableViewportWidth);
  const minHeight = propMinHeight ?? layout?.minHeight ?? defaultLayout?.minHeight ?? 60;
  const pixelLayout = toPixelLayout(layout ?? defaultLayout, viewport);

  // Initialize position and size clamped to min limits and viewport
  const initWidth = Math.min(maxAvailableViewportWidth, Math.max(minWidth, pixelLayout?.width ?? 300));
  const initHeight = Math.max(minHeight, pixelLayout?.height ?? 120);

  const [currentPos, setCurrentPos] = useState({
    x: pixelLayout?.x ?? 50,
    y: pixelLayout?.y ?? 50,
  });

  const [currentSize, setCurrentSize] = useState({
    width: initWidth,
    height: initHeight,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Synchronous refs to prevent stale closure bugs in mouse events
  const posRef = useRef(currentPos);
  const sizeRef = useRef(currentSize);
  posRef.current = currentPos;
  sizeRef.current = currentSize;

  // Drag tracking
  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  // Resize tracking
  const resizeRef = useRef({
    isResizing: false,
    direction: 'se',
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    initialW: 0,
    initialH: 0,
  });

  // Keep within viewport bounds with responsive width clamping
  const clampPos = useCallback((x, y, width, height) => {
    const maxAvailW = Math.max(100, viewport.width - 20);
    const safeW = Math.min(width, maxAvailW);
    const maxX = Math.max(10, viewport.width - safeW - 10);
    const maxY = Math.max(10, viewport.height - height - 10);
    return {
      x: Math.max(10, Math.min(x, maxX)),
      y: Math.max(10, Math.min(y, maxY)),
    };
  }, [viewport.width, viewport.height]);

  // Recalculate from viewport fractions whenever the window or saved layout changes.
  useEffect(() => {
    if (!dragRef.current.isDragging && !resizeRef.current.isResizing) {
      const safeW = Math.min(maxAvailableViewportWidth, Math.max(minWidth, pixelLayout.width));
      const safeH = Math.max(minHeight, pixelLayout.height);
      const safePos = clampPos(pixelLayout.x, pixelLayout.y, safeW, safeH);
      posRef.current = safePos;
      sizeRef.current = { width: safeW, height: safeH };
      setCurrentPos(safePos);
      setCurrentSize(sizeRef.current);
    }
  }, [pixelLayout.x, pixelLayout.y, pixelLayout.width, pixelLayout.height, minWidth, minHeight, maxAvailableViewportWidth, clampPos]);

  // --- DRAG HANDLERS ---
  const handleDragStart = (clientX, clientY, target) => {
    if (!draggable) return;
    if (target.closest('button:not([data-widget-move]), a, input, textarea, select, [data-no-drag="true"], .resize-handle')) {
      return;
    }

    dragRef.current = {
      isDragging: true,
      startX: clientX,
      startY: clientY,
      initialX: posRef.current.x,
      initialY: posRef.current.y,
    };
    setIsDragging(true);
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    handleDragStart(e.clientX, e.clientY, e.target);
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    if (touch) {
      handleDragStart(touch.clientX, touch.clientY, e.target);
    }
  };

  // --- RESIZE HANDLERS ---
  const handleResizeStart = (e, direction) => {
    e.stopPropagation();
    e.preventDefault();

    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;

    resizeRef.current = {
      isResizing: true,
      direction,
      startX: clientX,
      startY: clientY,
      initialX: posRef.current.x,
      initialY: posRef.current.y,
      initialW: sizeRef.current.width,
      initialH: sizeRef.current.height,
    };
    setIsResizing(true);
  };

  // --- GLOBAL MOVE & UP LISTENERS ---
  useEffect(() => {
    if (!draggable && !resizable) return;
    const handleMove = (clientX, clientY) => {
      // 1. Resizing
      if (resizeRef.current.isResizing) {
        const deltaX = clientX - resizeRef.current.startX;
        const deltaY = clientY - resizeRef.current.startY;
        const dir = resizeRef.current.direction;

        let newW = resizeRef.current.initialW;
        let newH = resizeRef.current.initialH;
        let newX = resizeRef.current.initialX;

        // Resize Right / East
        if (dir === 'e' || dir === 'se') {
          const maxW = Math.max(minWidth, viewport.width - newX - 10);
          newW = Math.max(minWidth, Math.min(resizeRef.current.initialW + deltaX, maxW));
        }

        // Resize Left / West (Allows expanding wider to the left!)
        if (dir === 'w' || dir === 'sw') {
          const potentialW = resizeRef.current.initialW - deltaX;
          const maxW = resizeRef.current.initialX + resizeRef.current.initialW - 10;
          const clampedW = Math.max(minWidth, Math.min(potentialW, maxW));
          newW = clampedW;
          newX = resizeRef.current.initialX + (resizeRef.current.initialW - clampedW);
          newX = Math.max(10, newX);
          posRef.current.x = newX;
          setCurrentPos((prev) => ({ ...prev, x: newX }));
        }

        // Resize Down / South
        if (dir === 's' || dir === 'se' || dir === 'sw') {
          const maxH = Math.max(minHeight, viewport.height - posRef.current.y - 10);
          newH = Math.max(minHeight, Math.min(resizeRef.current.initialH + deltaY, maxH));
        }

        const roundedW = Math.round(newW);
        const roundedH = Math.round(newH);
        sizeRef.current = { width: roundedW, height: roundedH };
        setCurrentSize({ width: roundedW, height: roundedH });
        return;
      }

      // 2. Dragging
      if (dragRef.current.isDragging) {
        const deltaX = clientX - dragRef.current.startX;
        const deltaY = clientY - dragRef.current.startY;

        const nextX = dragRef.current.initialX + deltaX;
        const nextY = dragRef.current.initialY + deltaY;

        const clamped = clampPos(nextX, nextY, sizeRef.current.width, sizeRef.current.height);
        posRef.current = clamped;
        setCurrentPos(clamped);
      }
    };

    const handleMouseMove = (e) => {
      if (dragRef.current.isDragging || resizeRef.current.isResizing) {
        handleMove(e.clientX, e.clientY);
      }
    };

    const handleTouchMove = (e) => {
      if ((dragRef.current.isDragging || resizeRef.current.isResizing) && e.touches[0]) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleEnd = () => {
      let layoutChanged = false;

      if (dragRef.current.isDragging) {
        dragRef.current.isDragging = false;
        setIsDragging(false);
        layoutChanged = true;
      }

      if (resizeRef.current.isResizing) {
        resizeRef.current.isResizing = false;
        setIsResizing(false);
        layoutChanged = true;
      }

      if (layoutChanged && onLayoutChange) {
        onLayoutChange(id, toViewportLayout({
          x: posRef.current.x,
          y: posRef.current.y,
          width: Math.max(minWidth, sizeRef.current.width),
          height: Math.max(minHeight, sizeRef.current.height),
        }, viewport));
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [clampPos, id, minHeight, minWidth, onLayoutChange, viewport, draggable, resizable]);

  const handleKeyboardLayout = (event) => {
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction || event.altKey || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    event.stopPropagation();
    const [dx, dy] = direction.map(value => value * 10);
    let size = sizeRef.current;
    let position = posRef.current;
    if (event.shiftKey && resizable) {
      size = {
        width: Math.max(minWidth, Math.min(size.width + dx, viewport.width - position.x - 10)),
        height: Math.max(minHeight, Math.min(size.height + dy, viewport.height - position.y - 10)),
      };
    } else if (!event.shiftKey && draggable) {
      position = clampPos(position.x + dx, position.y + dy, size.width, size.height);
    }
    posRef.current = position;
    sizeRef.current = size;
    setCurrentPos(position);
    setCurrentSize(size);
    onLayoutChange?.(id, toViewportLayout({ ...position, ...size }, viewport));
  };

  return (
    <div
      ref={nodeRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{
        position: 'absolute',
        left: `${currentPos.x}px`,
        top: `${currentPos.y}px`,
        width: `${currentSize.width}px`,
        maxWidth: 'calc(100vw - 20px)',
        height: `${currentSize.height}px`,
        maxHeight: 'calc(100vh - 20px)',
        boxSizing: 'border-box',
        zIndex: isDragging || isResizing ? 45 : 20,
        touchAction: draggable || resizable ? 'none' : 'auto',
        willChange: isDragging || isResizing ? 'left, top, width, height' : 'auto',
        isolation: 'isolate',
      }}
      className={`group/widget transition-shadow duration-150 ${
        isDragging
          ? 'cursor-grabbing ring-2 ring-blue-400/60 shadow-2xl scale-[1.005]'
          : isResizing
          ? 'ring-2 ring-blue-500/80 shadow-2xl'
          : ''
      } ${className}`}
    >
      {/* Move Pill Handle on Top (Visible on hover when draggable is enabled) */}
      {draggable && (
        <button type="button" data-widget-move="true" onKeyDown={handleKeyboardLayout}
          aria-label={`Move ${title || 'widget'} with arrow keys; resize with Shift and arrow keys`}
          title="Arrow keys to move; Shift + arrow keys to resize"
          className="drag-handle absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover/widget:opacity-100 group-focus-within/widget:opacity-100 focus:opacity-100 transition-opacity duration-200 z-30 cursor-grab active:cursor-grabbing flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/75 hover:bg-black/95 border border-white/20 text-white/70 hover:text-white text-[11px] font-medium shadow-md backdrop-blur-xs select-none pointer-events-auto">
          <GripHorizontal size={12} />
          <span>{title ? `Move ${title}` : 'Move'}</span>
        </button>
      )}

      {/* Widget Content (Full size of draggable frame) */}
      <div className={`w-full h-full relative select-text ${className}`}>
        {children}
      </div>

      {/* Resizing Handles */}
      {resizable && (
        <>
          {/* Left Edge Resize Handle (w) */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'w')}
            onTouchStart={(e) => handleResizeStart(e, 'w')}
            className="resize-handle absolute top-3 bottom-3 left-0 w-2.5 cursor-w-resize z-30 rounded-l-full hover:bg-blue-400/30 transition-colors"
            title="Resize width (left)"
          />

          {/* Right Edge Resize Handle (e) */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'e')}
            onTouchStart={(e) => handleResizeStart(e, 'e')}
            className="resize-handle absolute top-3 bottom-3 right-0 w-2.5 cursor-e-resize z-30 rounded-r-full hover:bg-blue-400/30 transition-colors"
            title="Resize width (right)"
          />

          {/* Bottom Edge Resize Handle (s) */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 's')}
            onTouchStart={(e) => handleResizeStart(e, 's')}
            className="resize-handle absolute bottom-0 left-3 right-3 h-2.5 cursor-s-resize z-30 rounded-b-full hover:bg-blue-400/30 transition-colors"
            title="Resize height"
          />

          {/* Bottom-Left Corner Resize Handle (sw) */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
            onTouchStart={(e) => handleResizeStart(e, 'sw')}
            className="resize-handle absolute bottom-0 left-0 w-5 h-5 cursor-sw-resize z-40 rounded-bl-2xl flex items-end justify-start p-1 pointer-events-auto group/corner"
            title="Resize widget"
          />

          {/* Bottom-Right Corner Resize Handle (se) */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'se')}
            onTouchStart={(e) => handleResizeStart(e, 'se')}
            className="resize-handle absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-40 rounded-br-2xl flex items-end justify-end p-1 pointer-events-auto group/corner"
            title="Resize widget"
          >
            {/* Visual Grip Indicator (Visible on hover) */}
            <svg
              className="w-3.5 h-3.5 text-white/30 group-hover/widget:text-white/80 group-hover/corner:text-blue-400 transition-colors"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="10" y1="2" x2="2" y2="10" />
              <line x1="10" y1="6" x2="6" y2="10" />
              <line x1="10" y1="10" x2="10" y2="10" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
};

export default DraggableWidget;
