import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

type SignaturePadFieldProps = {
  label: string
  value: string
  onChange: (dataUrl: string) => void
}

function SignaturePadField({ label, value, onChange }: SignaturePadFieldProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!value) {
      return
    }
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }
    const image = new Image()
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
    }
    image.src = value
  }, [value])

  const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return { x: 0, y: 0 }
    }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    }
  }

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    isDrawingRef.current = true
    lastPointRef.current = getPoint(event)
    canvas.setPointerCapture(event.pointerId)
  }

  const stopDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    isDrawingRef.current = false
    lastPointRef.current = null
    onChange(canvas.toDataURL('image/png'))
    canvas.releasePointerCapture(event.pointerId)
  }

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return
    }
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }
    const currentPoint = getPoint(event)
    const previousPoint = lastPointRef.current ?? currentPoint
    context.lineWidth = 2
    context.lineCap = 'round'
    context.strokeStyle = '#111827'
    context.beginPath()
    context.moveTo(previousPoint.x, previousPoint.y)
    context.lineTo(currentPoint.x, currentPoint.y)
    context.stroke()
    lastPointRef.current = currentPoint
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }
    context.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <div className="space-y-2 rounded-lg border border-base-300 p-3">
      <p className="text-sm font-medium">{label}</p>
      <canvas
        ref={canvasRef}
        width={900}
        height={220}
        className="h-36 w-full rounded border border-base-300 bg-white touch-none"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
      />
      <button type="button" className="btn btn-ghost btn-xs" onClick={clearSignature}>
        {t('public.youthWizard.signature.clear')}
      </button>
    </div>
  )
}

export default SignaturePadField
