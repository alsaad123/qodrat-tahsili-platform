import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Scissors, Check, X, ZoomIn, ZoomOut, RotateCcw, Image as ImageIcon, Sparkles, Upload } from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceImage?: string;
  sourceImages?: string[];
  questionId: string;
  questionIndex: number;
  onCropSaved: (questionId: string, croppedDataUrl: string) => void;
}

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  onClose,
  sourceImage,
  sourceImages,
  questionId,
  questionIndex,
  onCropSaved,
}) => {
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const imagesList = sourceImages && sourceImages.length > 0 ? sourceImages : (sourceImage ? [sourceImage] : []);
  const [activeImage, setActiveImage] = useState<string | undefined>(imagesList[0] || sourceImage);
  const [cropBox, setCropBox] = useState<CropBox | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (imagesList.length > 0 && selectedPageIndex < imagesList.length) {
      setActiveImage(imagesList[selectedPageIndex]);
    } else if (sourceImage) {
      setActiveImage(sourceImage);
    }
  }, [selectedPageIndex, sourceImages, sourceImage]);

  // Suggest default crop box for Question 12 & 13 if source image exists
  useEffect(() => {
    if (!isOpen || !imageRef.current) return;
    
    // Auto-suggest preset based on question index (12 or 13)
    if (questionIndex === 12) {
      // Question 12 drawing preset (tangent circles in left column)
      setCropBox({ x: 3, y: 46, w: 46, h: 16 });
    } else if (questionIndex === 13) {
      // Question 13 drawing preset (overlapping circles in left column)
      setCropBox({ x: 3, y: 64, w: 46, h: 17 });
    } else {
      setCropBox({ x: 10, y: 20, w: 40, h: 25 });
    }
  }, [isOpen, questionIndex, activeImage]);

  // Update preview whenever crop box changes
  const updateCropPreview = useCallback(() => {
    if (!cropBox || !imageRef.current) {
      setPreviewDataUrl(null);
      return;
    }

    const img = imageRef.current;
    if (!img.naturalWidth || !img.naturalHeight) return;

    try {
      const sx = Math.max(0, (cropBox.x / 100) * img.naturalWidth);
      const sy = Math.max(0, (cropBox.y / 100) * img.naturalHeight);
      const sw = Math.min(img.naturalWidth - sx, (cropBox.w / 100) * img.naturalWidth);
      const sh = Math.min(img.naturalHeight - sy, (cropBox.h / 100) * img.naturalHeight);

      if (sw < 5 || sh < 5) return;

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/png', 0.95);
      setPreviewDataUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate crop preview:', err);
    }
  }, [cropBox]);

  useEffect(() => {
    updateCropPreview();
  }, [updateCropPreview, cropBox, activeImage]);

  // Listen to paste event (Ctrl+V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                setActiveImage(event.target.result as string);
                setCropBox({ x: 5, y: 5, w: 90, h: 90 });
              }
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  // Mouse / Touch Selection Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setIsSelecting(true);
    setStartPoint({ x, y });
    setCropBox({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !startPoint || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const currentY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    const left = Math.min(startPoint.x, currentX);
    const top = Math.min(startPoint.y, currentY);
    const width = Math.abs(currentX - startPoint.x);
    const height = Math.abs(currentY - startPoint.y);

    setCropBox({ x: left, y: top, w: width, h: height });
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    setStartPoint(null);
  };

  const handleApplyPreset = (type: 'q12' | 'q13' | 'full') => {
    if (type === 'q12') {
      setCropBox({ x: 2, y: 45, w: 48, h: 17 });
    } else if (type === 'q13') {
      setCropBox({ x: 2, y: 63, w: 48, h: 18 });
    } else {
      setCropBox({ x: 5, y: 5, w: 90, h: 90 });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setActiveImage(event.target.result as string);
        setCropBox({ x: 5, y: 5, w: 90, h: 90 });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (previewDataUrl) {
      onCropSaved(questionId, previewDataUrl);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[#3b4cb8] border border-indigo-100 flex items-center justify-center shadow-xs">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span>أداة قص ونسخ الرسمة لسؤال رقم ({questionIndex})</span>
                <span className="text-[11px] font-semibold text-[#3b4cb8] bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  نسخ ولصق مباشر
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                حدد بالماوس أو اللمس فوق الرسمة في الورقة لقصها وإدراجها كصورة للسؤال، أو الصق صورة بالضغط على (Ctrl + V).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Page Switcher Tabs if multiple pages exist */}
        {imagesList.length > 1 && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-slate-500 shrink-0">اختر صفحة الورقة:</span>
            <div className="flex items-center gap-1.5">
              {imagesList.map((_, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => {
                    setSelectedPageIndex(pIdx);
                    setActiveImage(imagesList[pIdx]);
                    setCropBox({ x: 5, y: 5, w: 90, h: 90 });
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    selectedPageIndex === pIdx
                      ? 'bg-[#3b4cb8] text-white border-[#3b4cb8] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  صفحة ({pIdx + 1})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="px-4 py-2.5 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 text-[11px] font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> اختصارات سريعة:
            </span>
            <button
              type="button"
              onClick={() => handleApplyPreset('q12')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer border text-xs font-medium ${
                questionIndex === 12
                  ? 'bg-[#3b4cb8] text-white border-[#3b4cb8] font-bold shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              رسمة سؤال 12 (دائرتين متماستين)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('q13')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer border text-xs font-medium ${
                questionIndex === 13
                  ? 'bg-[#3b4cb8] text-white border-[#3b4cb8] font-bold shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              رسمة سؤال 13 (دائرتين متداخلتين)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('full')}
              className="px-2.5 py-1 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer text-xs font-medium"
            >
              تحديد كامل
            </button>
          </div>

          {/* Upload / Replace source image & Zoom controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer text-xs font-medium shadow-xs"
            >
              <Upload className="w-3 h-3 text-[#3b4cb8]" />
              <span>تحميل صورة أخرى</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-slate-600 shadow-xs">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.2))}
                className="hover:text-slate-900 p-0.5 cursor-pointer"
                title="تصغير"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] w-8 text-center font-mono">{Math.round(zoomLevel * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(2.5, prev + 0.2))}
                className="hover:text-slate-900 p-0.5 cursor-pointer"
                title="تكبير"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                className="hover:text-slate-900 p-0.5 cursor-pointer"
                title="إعادة ضبط"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Work Area */}
        <div className="flex-1 overflow-auto p-4 flex flex-col lg:flex-row gap-4 items-start justify-center min-h-[360px] bg-slate-50/60">
          
          {/* Sheet Canvas / Viewer */}
          <div className="w-full lg:flex-1 flex flex-col items-center justify-center">
            {activeImage ? (
              <div 
                ref={containerRef}
                className="relative overflow-auto border-2 border-slate-200 rounded-xl bg-white shadow-inner max-h-[58vh] select-none cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                <img
                  ref={imageRef}
                  src={activeImage}
                  alt="ورقة الأسئلة"
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
                  className="max-w-full block pointer-events-none transition-transform duration-75"
                  onLoad={updateCropPreview}
                />

                {/* Selection Box Overlay */}
                {cropBox && cropBox.w > 0 && cropBox.h > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${cropBox.x}%`,
                      top: `${cropBox.y}%`,
                      width: `${cropBox.w}%`,
                      height: `${cropBox.h}%`,
                      border: '2px solid #3b4cb8',
                      backgroundColor: 'rgba(59, 76, 184, 0.18)',
                      boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.45)',
                      pointerEvents: 'none'
                    }}
                  >
                    <div className="absolute -top-6 right-0 bg-[#3b4cb8] text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                      منطقة الرسمة المحددة
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-8 border-2 border-dashed border-slate-300 rounded-2xl w-full bg-white">
                <ImageIcon className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-700 font-semibold mb-1">لا توجد ورقة ممسوحة محملة حالياً</p>
                <p className="text-xs text-slate-500 mb-3">يمكنك لصق صورة مباشرة (Ctrl + V) أو رفع ملف صورة</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-[#3b4cb8] hover:bg-[#312e81] text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors"
                >
                  اختيار صورة من الجهاز
                </button>
              </div>
            )}
          </div>

          {/* Live Preview Panel */}
          <div className="w-full lg:w-72 bg-white border border-slate-200 rounded-xl p-3.5 shrink-0 flex flex-col shadow-xs">
            <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
              <span>معاينة الرسمة المقصوصة:</span>
              {previewDataUrl && (
                <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">جاهزة للحفظ</span>
              )}
            </h4>

            <div className="h-44 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center p-2 overflow-hidden mb-3">
              {previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt="المعاينة"
                  className="max-h-full max-w-full object-contain rounded shadow-sm bg-white"
                />
              ) : (
                <span className="text-xs text-slate-400 text-center">
                  اسحب بالمؤشر لتحديد منطقة الرسمة
                </span>
              )}
            </div>

            <div className="mt-auto space-y-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!previewDataUrl}
                className="w-full py-2.5 bg-[#3b4cb8] hover:bg-[#312e81] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>اعتماد ولصق الرسمة في السؤال</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <span>💡 نصيحة: يمكنك أيضاً التقاط لقطة شاشة والضغط على (Ctrl + V) للصقها مباشرة في هذه النافذة.</span>
          <span className="font-mono text-slate-400">سؤال {questionIndex}</span>
        </div>

      </div>
    </div>
  );
};
