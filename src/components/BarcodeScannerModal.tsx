import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import {
  X,
  Camera,
  CameraOff,
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  Upload,
  ScanBarcode,
  Keyboard,
} from 'lucide-react'

interface BarcodeScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScan: (barcode: string) => void
  title?: string
}

function playScanBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1760, ctx.currentTime) // High beep ~1760Hz
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
  } catch {
    // Audio context may not be allowed without user interaction or in quiet mode
  }
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([60, 40, 60])
    } catch {
      // Ignore vibration error
    }
  }
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Barcode',
}: BarcodeScannerModalProps) {
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(true)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([])
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0)
  const [manualInput, setManualInput] = useState('')
  const [showManual, setShowManual] = useState(false)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scannerContainerId = 'barcode-scanner-viewfinder'

  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    const scanner = new Html5Qrcode(scannerContainerId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
      verbose: false,
    })
    scannerRef.current = scanner

    const startScanner = async () => {
      setIsStarting(true)
      setCameraError(null)

      try {
        const availableDevices = await Html5Qrcode.getCameras()
        if (isMounted) {
          setCameras(availableDevices)
        }

        const cameraConfig = availableDevices.length > 0
          ? { deviceId: availableDevices[currentCameraIndex % availableDevices.length].id }
          : { facingMode: 'environment' }

        await scanner.start(
          cameraConfig,
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const width = Math.min(viewfinderWidth * 0.85, 340)
              const height = Math.min(viewfinderHeight * 0.5, 180)
              return { width: Math.floor(width), height: Math.floor(height) }
            },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            playScanBeep()
            triggerHaptic()
            onScan(decodedText.trim())
            onClose()
          },
          () => {
            // Frame scanned without barcode, no-op
          }
        )

        if (isMounted) {
          setIsStarting(false)
          try {
            const capabilities = scanner.getRunningTrackCapabilities() as { torch?: boolean }
            setTorchAvailable(!!capabilities?.torch)
          } catch {
            setTorchAvailable(false)
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return
        setIsStarting(false)
        const msg = err instanceof Error ? err.message : 'Unable to access camera'
        setCameraError(
          msg.includes('NotAllowedError') || msg.includes('Permission')
            ? 'Camera permission denied. Please allow camera access in your browser settings or upload an image.'
            : `Camera error: ${msg}`
        )
      }
    }

    // Small delay to ensure DOM element is ready
    const timer = setTimeout(() => {
      startScanner()
    }, 100)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      isMounted = false
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
      if (scanner.isScanning) {
        scanner.stop().then(() => scanner.clear()).catch(() => {})
      } else {
        try {
          scanner.clear()
        } catch {
          // ignore
        }
      }
    }
  }, [isOpen, currentCameraIndex, onClose, onScan])

  const toggleTorch = async () => {
    if (!scannerRef.current || !torchAvailable) return
    try {
      const nextTorch = !torchOn
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
      })
      setTorchOn(nextTorch)
    } catch {
      // Torch toggle failed
    }
  }

  const switchCamera = () => {
    if (cameras.length > 1) {
      setCurrentCameraIndex((prev) => (prev + 1) % cameras.length)
    }
  }

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !scannerRef.current) return
    try {
      setCameraError(null)
      const decoded = await scannerRef.current.scanFile(file, true)
      playScanBeep()
      triggerHaptic()
      onScan(decoded.trim())
      onClose()
    } catch {
      setCameraError('Could not detect any barcode in the selected photo. Please ensure barcode is clear and well-lit.')
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualInput.trim()) return
    playScanBeep()
    triggerHaptic()
    onScan(manualInput.trim())
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-800 max-w-md w-full overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
              <ScanBarcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">{title}</h3>
              <p className="text-xs text-slate-400">Point phone camera at product barcode</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Container */}
        <div className="relative bg-black flex-1 min-h-[300px] flex items-center justify-center overflow-hidden">
          {/* HTML5 QR Code Mount Node */}
          <div id={scannerContainerId} className="w-full h-full min-h-[300px]" />

          {/* Aiming Overlay */}
          {!cameraError && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              <div className="relative w-64 sm:w-72 h-36 border-2 border-blue-400/80 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center justify-center overflow-hidden">
                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />

                {/* Animated Laser Scanning Line */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-pulse" />
              </div>
              <p className="text-[11px] text-slate-300 font-medium tracking-wide mt-3 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                Align barcode within the rectangle
              </p>
            </div>
          )}

          {/* Starting Loader */}
          {isStarting && !cameraError && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3">
              <Camera className="w-8 h-8 text-blue-400 animate-pulse" />
              <p className="text-sm font-medium text-slate-300">Starting camera...</p>
            </div>
          )}

          {/* Camera Error / Permission Fallback */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-900 p-6 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                <CameraOff className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-200 text-sm mb-1">Camera Unavailable</h4>
              <p className="text-xs text-slate-400 max-w-xs mb-5">{cameraError}</p>
              <div className="flex flex-col gap-2.5 w-full max-w-xs">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
                >
                  <Upload className="w-4 h-4" />
                  Upload Photo with Barcode
                </button>
                <button
                  type="button"
                  onClick={() => setShowManual(true)}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Keyboard className="w-4 h-4" />
                  Enter Barcode Manually
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Camera Controls (Torch, Switch Camera, Photo Upload, Manual Input) */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {torchAvailable && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  torchOn
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="Toggle Torch/Flash"
              >
                {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                <span className="hidden sm:inline">{torchOn ? 'Torch On' : 'Torch'}</span>
              </button>
            )}

            {cameras.length > 1 && (
              <button
                type="button"
                onClick={switchCamera}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Switch Camera"
              >
                <SwitchCamera className="w-4 h-4" />
                <span className="hidden sm:inline">Flip</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Upload photo of barcode"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowManual(!showManual)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Keyboard className="w-4 h-4" />
            <span>{showManual ? 'Hide Input' : 'Type Barcode'}</span>
          </button>
        </div>

        {/* Manual Barcode Fallback Drawer */}
        {showManual && (
          <form
            onSubmit={handleManualSubmit}
            className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="e.g. 5702017161914"
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              autoFocus
            />
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs transition-colors"
            >
              Apply
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
