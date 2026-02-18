"use client"

import type React from "react"

import NextImage from "next/image"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useIsMobile } from "@/hooks/use-mobile"

const OFFSET_ARRAY = [-0.02, 0.01, -0.01, 0.02] as const
const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val))

const TURBULENCE_SEED = 1
const INITIAL_SVG_CONTENT = `
  <path d="M50,50 L150,50 L150,150 L50,150 Z" fill="#3498db" stroke="#2980b9" strokeWidth="2"/>
  <circle cx="100" cy="100" r="30" fill="#e74c3c" stroke="#c0392b" strokeWidth="2"/>
  <line x1="60" y1="60" x2="140" y2="140" stroke="#f1c40f" strokeWidth="3"/>
`
const FRAME_DEFAULT_DURATION_MS = 1000
const FRAME_DURATION_MIN_MS = 300
const FRAME_DURATION_MAX_MS = 5000
const FRAME_DURATION_STEP_MS = 100
const FRAME_DURATION_MIN_SECONDS = FRAME_DURATION_MIN_MS / 1000
const FRAME_DURATION_MAX_SECONDS = FRAME_DURATION_MAX_MS / 1000
const FRAME_DURATION_STEP_SECONDS = FRAME_DURATION_STEP_MS / 1000

const SUPPORTED_RASTER_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".avif",
]
const CANVAS_FRAME_MIN_WIDTH = 220
const CANVAS_FRAME_DESKTOP_MAX_RATIO = 0.6
const CANVAS_RESIZE_HANDLE_WIDTH = 18
const CANVAS_HEIGHT = 511

type OverlayScope = "none" | "artboard" | "viewport"
type OverlaySlot = "A" | "B"
type MobileSliderKey = "tremor" | "intensity" | "boiling"

type FrameLayer = {
  id: string
  name: string
  content: string
  originalWidth: number
  originalHeight: number
  durationMs: number
}

type OverlayImage = {
  src: string
  name: string
  width: number
  height: number
}

type OverlaySettings = {
  scope: OverlayScope
  slot: OverlaySlot
  opacity: number
}

type OverlayPersistedState = {
  settings: OverlaySettings
  images: Partial<Record<OverlaySlot, OverlayImage>>
}

const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  scope: "none",
  slot: "A",
  opacity: 0.35,
}

export default function SVGBoilingAnimation() {
  const DESIGN_WIDTH = 393
  const DESIGN_HEIGHT = 852
  const DESIGN_PADDING = 16
  const VIEWPORT_SCALE_MAX = Math.min(
    744 / (DESIGN_WIDTH + DESIGN_PADDING * 2),
    1133 / (DESIGN_HEIGHT + DESIGN_PADDING * 2)
  )
  const CANVAS_AREA_WIDTH = 315
  const CANVAS_AREA_HEIGHT = 445
  const CANVAS_VIEWBOX_WIDTH = 315
  const CANVAS_VIEWBOX_HEIGHT = 445
  const CANVAS_UPLOAD_MAX_WIDTH = 310
  const CANVAS_LEFT = 30
  const CANVAS_WIDTH = 350
  const KNOB_PANEL_TOP = 559
  const KNOB_PANEL_LEFT = 30
  const KNOB_PANEL_WIDTH = 333
  const LAYER_PANEL_WIDTH = 333
  const LAYER_PANEL_SIDE_GAP = 10
  const LAYER_PANEL_SIDE_LEFT = KNOB_PANEL_LEFT + KNOB_PANEL_WIDTH + LAYER_PANEL_SIDE_GAP
  const LAYER_PANEL_TOP = 700
  const LAYER_PANEL_SPACING = 8
  const LAYER_PANEL_TOOLBAR_GAP = 8
  const TOOLBAR_TOP = 802
  const TREMOR_MIN = 0.001
  const TREMOR_MAX = 0.0845
  const TREMOR_DEFAULT = 0.0013
  const INTENSITY_MIN = 1.0
  const INTENSITY_MAX = 33.8
  const INTENSITY_DEFAULT = 1.3
  const ANIMATION_SCALE_DEFAULT = 0.26
  const ANIMATION_SCALE_MIN = 0.01
  const ANIMATION_SCALE_MAX = 1.3
  const isMobile = useIsMobile()
  const [viewportScale, setViewportScale] = useState(1)
  const [canvasFrameWidth, setCanvasFrameWidth] = useState(CANVAS_WIDTH)
  const [frameRemainingMs, setFrameRemainingMs] = useState(FRAME_DEFAULT_DURATION_MS)
  const [selectedMobileSlider, setSelectedMobileSlider] = useState<MobileSliderKey>("tremor")
  const acceptedFrameUploadTypes = useMemo(
    () => [
      ".svg",
      ...SUPPORTED_RASTER_EXTENSIONS,
    ].join(","),
    [],
  )
  const mobileSliderTabs: Array<{ key: MobileSliderKey; label: string }> = [
    { key: "tremor", label: "떨림 강도" },
    { key: "intensity", label: "세기 강도" },
    { key: "boiling", label: "보일링 폭" },
  ]
  const scaledSize = (px: number, scale = viewportScale) => Math.round(px * scale)
  const vwp = (px: number) => `${scaledSize(px)}px`
  const vhp = (px: number) => `${scaledSize(px)}px`
  const PANEL_WIDTH = vwp(LAYER_PANEL_WIDTH)
  const KNOB_PANEL_LEFT_PX_STYLE = vwp(KNOB_PANEL_LEFT)
  const CANVAS_SCALE = canvasFrameWidth / CANVAS_WIDTH
  const CANVAS_WIDTH_PX_STYLE = vwp(canvasFrameWidth)
  const CANVAS_HEIGHT_PX = Math.round(CANVAS_HEIGHT * CANVAS_SCALE)
  const CANVAS_AREA_WIDTH_PX = Math.round(CANVAS_AREA_WIDTH * CANVAS_SCALE)
  const CANVAS_AREA_HEIGHT_PX = Math.round(CANVAS_AREA_HEIGHT * CANVAS_SCALE)
  const CANVAS_AREA_LEFT_PX = Math.round(3 * CANVAS_SCALE)
  const CANVAS_AREA_TOP_PX = Math.round(10 * CANVAS_SCALE)
  const CANVAS_BG_RIGHT_OFFSET_PX = Math.round(10 * CANVAS_SCALE)
  const CANVAS_BG_BOTTOM_OFFSET_PX = Math.round(30 * CANVAS_SCALE)
  const KNOB_PANEL_TOP_PX = scaledSize(KNOB_PANEL_TOP)
  const LAYER_PANEL_TOP_PX = scaledSize(LAYER_PANEL_TOP)
  const LAYER_PANEL_SIDE_LEFT_PX = scaledSize(LAYER_PANEL_SIDE_LEFT)
  const LAYER_PANEL_SIDE_GAP_PX = scaledSize(LAYER_PANEL_TOOLBAR_GAP)
  const TOOLBAR_TOP_PX = scaledSize(TOOLBAR_TOP)
  const KNOB_PANEL_TOP_PX_STYLE = `${KNOB_PANEL_TOP_PX}px`
  const [isLayerPanelSideLayout, setIsLayerPanelSideLayout] = useState(false)
  const LAYER_PANEL_CURRENT_LEFT_PX = isLayerPanelSideLayout
    ? LAYER_PANEL_SIDE_LEFT_PX
    : scaledSize(KNOB_PANEL_LEFT)
  const LAYER_PANEL_CURRENT_TOP_PX = isLayerPanelSideLayout
    ? KNOB_PANEL_TOP_PX
    : LAYER_PANEL_TOP_PX
  const LAYER_PANEL_TOP_PX_STYLE = `${LAYER_PANEL_CURRENT_TOP_PX}px`
  const LAYER_PANEL_LEFT_PX_STYLE = `${LAYER_PANEL_CURRENT_LEFT_PX}px`
  const LAYER_PANEL_MAX_HEIGHT_PX = Math.max(
    scaledSize(90),
    TOOLBAR_TOP_PX - LAYER_PANEL_CURRENT_TOP_PX - LAYER_PANEL_SIDE_GAP_PX,
  )
  const TOOLBAR_TOP_PX_STYLE = vhp(TOOLBAR_TOP)
  const LAYER_PANEL_MAX_HEIGHT_STYLE = `${LAYER_PANEL_MAX_HEIGHT_PX}px`
  const scaledPadding = Math.round(DESIGN_PADDING * viewportScale)
  const scaledDesignWidth = Math.round(DESIGN_WIDTH * viewportScale)
  const scaledDesignHeight = Math.round(DESIGN_HEIGHT * viewportScale)
  const [showOverlayPanel, setShowOverlayPanel] = useState(false)
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>(DEFAULT_OVERLAY_SETTINGS)
  const [overlayImages, setOverlayImages] = useState<Partial<Record<OverlaySlot, OverlayImage>>>({})
  const overlayOpacity = clamp(overlaySettings.opacity, 0, 1)
  const activeOverlayImage = overlayImages[overlaySettings.slot]
  const overlaySrc = activeOverlayImage?.src
  const overlaySize = {
    width: activeOverlayImage?.width ?? DESIGN_WIDTH,
    height: activeOverlayImage?.height ?? DESIGN_HEIGHT,
  }
  const overlayFileInputRef = useRef<HTMLInputElement>(null)
  const overlayTargetSlotRef = useRef<OverlaySlot>(DEFAULT_OVERLAY_SETTINGS.slot)
  const [animationScale, setAnimationScale] = useState(ANIMATION_SCALE_DEFAULT)
  const [animationSpeed, setAnimationSpeed] = useState(100) // milliseconds
  const [isAnimating, setIsAnimating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [frameLayers, setFrameLayers] = useState<FrameLayer[]>([
    {
      id: "default-layer",
      name: "기본 도형",
      content: INITIAL_SVG_CONTENT,
      originalWidth: 200,
      originalHeight: 200,
      durationMs: FRAME_DEFAULT_DURATION_MS,
    },
  ])
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0)
  const [svgContent, setSvgContent] = useState(INITIAL_SVG_CONTENT)
  const [originalWidth, setOriginalWidth] = useState(200)
  const [originalHeight, setOriginalHeight] = useState(200)
  const [scaledViewBox, setScaledViewBox] = useState("0 0 200 200")
  const svgMarkup = useMemo(
    () => ({
      __html: svgContent,
    }),
    [svgContent],
  )
  const currentFrameLayer = frameLayers[currentFrameIndex] ?? frameLayers[0] ?? null
  const currentFrameDurationMs = clamp(
    currentFrameLayer?.durationMs ?? FRAME_DEFAULT_DURATION_MS,
    FRAME_DURATION_MIN_MS,
    FRAME_DURATION_MAX_MS,
  )
  const currentFrameDurationSeconds = currentFrameDurationMs / 1000
  const formatDurationSeconds = (durationMs: number) => (Math.max(0, durationMs) / 1000).toFixed(1)
  const sliderDurationStep = FRAME_DURATION_STEP_SECONDS
  const sliderDurationMin = FRAME_DURATION_MIN_SECONDS
  const sliderDurationMax = FRAME_DURATION_MAX_SECONDS
  
  const [tremorValue, setTremorValue] = useState(TREMOR_DEFAULT)
  const [intensityValue, setIntensityValue] = useState(INTENSITY_DEFAULT)
  const tremorValueRef = useRef(TREMOR_DEFAULT)
  const intensityValueRef = useRef(INTENSITY_DEFAULT)
  const animationScaleRef = useRef(ANIMATION_SCALE_DEFAULT)

  const animatedSvgRef = useRef<SVGSVGElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const animationIntervalRef = useRef<number | null>(null)
  const frameAdvanceTimeoutRef = useRef<number | null>(null)
  const frameRemainingIntervalRef = useRef<number | null>(null)
  const frameDeadlineRef = useRef<number | null>(null)
  const currentIndexRef = useRef(0)
  const canvasResizeStartXRef = useRef(0)
  const canvasResizeStartWidthRef = useRef(CANVAS_WIDTH)
  const hasManualCanvasWidthRef = useRef(false)
  const canvasFrameDragPointerIdRef = useRef<number | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shouldShow = params.has("overlay") || params.has("debugOverlay")
    if (!shouldShow) return

    setShowOverlayPanel(true)

    try {
      const raw = localStorage.getItem("boling:ui-overlay")
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown

      if (!parsed || typeof parsed !== "object") return
      const maybeState = parsed as Partial<OverlayPersistedState>

      const parsedSettings = maybeState.settings
      const parsedImages = maybeState.images

      const nextScope =
        parsedSettings?.scope === "none" ||
        parsedSettings?.scope === "artboard" ||
        parsedSettings?.scope === "viewport"
          ? parsedSettings.scope
          : DEFAULT_OVERLAY_SETTINGS.scope

      const nextSlot =
        parsedSettings?.slot === "A" || parsedSettings?.slot === "B"
          ? parsedSettings.slot
          : DEFAULT_OVERLAY_SETTINGS.slot

      const nextOpacity =
        typeof parsedSettings?.opacity === "number"
          ? clamp(parsedSettings.opacity, 0, 1)
          : DEFAULT_OVERLAY_SETTINGS.opacity

      setOverlaySettings({ scope: nextScope, slot: nextSlot, opacity: nextOpacity })

      if (parsedImages && typeof parsedImages === "object") {
        const nextImages: Partial<Record<OverlaySlot, OverlayImage>> = {}

        for (const slot of ["A", "B"] as const) {
          const maybeImage = (parsedImages as Partial<Record<OverlaySlot, unknown>>)[slot]
          if (!maybeImage || typeof maybeImage !== "object") continue

          const image = maybeImage as Partial<OverlayImage>
          if (
            typeof image.src === "string" &&
            typeof image.name === "string" &&
            typeof image.width === "number" &&
            typeof image.height === "number"
          ) {
            nextImages[slot] = {
              src: image.src,
              name: image.name,
              width: image.width,
              height: image.height,
            }
          }
        }

        setOverlayImages(nextImages)
      }
    } catch (error) {
      console.error("Failed to load overlay settings:", error)
    }
  }, [])

  useEffect(() => {
    if (!showOverlayPanel) return
    try {
      const nextState: OverlayPersistedState = {
        settings: overlaySettings,
        images: overlayImages,
      }
      localStorage.setItem("boling:ui-overlay", JSON.stringify(nextState))
    } catch (error) {
      console.error("Failed to persist overlay settings:", error)
    }
  }, [overlayImages, overlaySettings, showOverlayPanel])

  const openOverlayFilePicker = useCallback((slot: OverlaySlot) => {
    overlayTargetSlotRef.current = slot
    overlayFileInputRef.current?.click()
  }, [])

  const isSvgFile = useCallback((file: File) => {
    const normalizedType = (file.type || "").toLowerCase()
    const normalizedName = file.name.toLowerCase()
    return normalizedType === "image/svg+xml" || normalizedName.endsWith(".svg")
  }, [])

  const isRasterFile = useCallback((file: File) => {
    const normalizedType = (file.type || "").toLowerCase()
    const normalizedName = file.name.toLowerCase()

    if (normalizedType && normalizedType !== "image/svg+xml") {
      return normalizedType.startsWith("image/")
    }

    return SUPPORTED_RASTER_EXTENSIONS.some((extension) => normalizedName.endsWith(extension))
  }, [])

  const parseFrameViewport = useCallback((width: string | null, height: string | null, viewBox: string | null) => {
    const parsedWidth = width ? Number.parseFloat(width) : NaN
    const parsedHeight = height ? Number.parseFloat(height) : NaN
    let nextWidth = Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : NaN
    let nextHeight = Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : NaN

    if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight)) {
      const box = viewBox?.trim()
      const parsedBox = box
        ? box
            .split(" ")
            .map((value) => Number.parseFloat(value))
            .filter((value) => Number.isFinite(value))
        : []

      if (parsedBox.length === 4) {
        nextWidth = parsedBox[2]
        nextHeight = parsedBox[3]
      }
    }

    return {
      width: Number.isFinite(nextWidth) && nextWidth > 0 ? Math.round(nextWidth) : 200,
      height: Number.isFinite(nextHeight) && nextHeight > 0 ? Math.round(nextHeight) : 200,
    }
  }, [])

  const createFrameLayerFromSvg = useCallback((file: File, content: string): FrameLayer | null => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, "image/svg+xml")
    const svgElement = doc.querySelector("svg")

    if (!svgElement) return null

    const { width, height } = parseFrameViewport(
      svgElement.getAttribute("width"),
      svgElement.getAttribute("height"),
      svgElement.getAttribute("viewBox"),
    )

    const innerHtml = svgElement.innerHTML.trim()

    if (!innerHtml) return null

    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
      name: file.name,
      content: innerHtml,
      originalWidth: width,
      originalHeight: height,
      durationMs: FRAME_DEFAULT_DURATION_MS,
    }
  }, [parseFrameViewport])

  const createFrameLayerFromRaster = useCallback(async (file: File): Promise<FrameLayer | null> => {
    const ImageTracer = (await import("imagetracerjs")).default
    const reader = new FileReader()

    return await new Promise<FrameLayer | null>((resolve) => {
      reader.onload = (event) => {
        const fileResult = event.target?.result
        if (typeof fileResult !== "string") {
          resolve(null)
          return
        }

        const imgElement = document.createElement("img")

        imgElement.onload = () => {
          let scaledWidth = imgElement.width
          let scaledHeight = imgElement.height

          if (imgElement.width > CANVAS_UPLOAD_MAX_WIDTH) {
            const scaleRatio = CANVAS_UPLOAD_MAX_WIDTH / imgElement.width
            scaledWidth = CANVAS_UPLOAD_MAX_WIDTH
            scaledHeight = Math.round(imgElement.height * scaleRatio)
          }

          const canvas = document.createElement("canvas")
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            resolve(null)
            return
          }

          canvas.width = scaledWidth
          canvas.height = scaledHeight
          ctx.drawImage(imgElement, 0, 0, scaledWidth, scaledHeight)

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

          const svgString = ImageTracer.imagedataToSVG(imageData, {
            ltres: 1,
            qtres: 1,
            pathomit: 8,
            rightangleenhance: true,
            colorsampling: 1,
            numberofcolors: 16,
            mincolorratio: 0.02,
            colorquantcycles: 3,
            scale: 1,
            strokewidth: 1,
            blurradius: 0,
            blurdelta: 20,
          })

          const doc = new DOMParser().parseFromString(svgString, "image/svg+xml")
          const svgElement = doc.querySelector("svg")

          if (!svgElement) {
            resolve(null)
            return
          }

          const content = svgElement.innerHTML.trim()
          if (!content) {
            resolve(null)
            return
          }

          resolve({
            id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
            name: file.name,
            content,
            originalWidth: scaledWidth,
            originalHeight: scaledHeight,
            durationMs: FRAME_DEFAULT_DURATION_MS,
          })
        }

        imgElement.onerror = () => {
          resolve(null)
        }

        imgElement.src = fileResult
      }

      reader.onerror = () => {
        resolve(null)
      }

      reader.readAsDataURL(file)
    })
  }, [CANVAS_UPLOAD_MAX_WIDTH])

  const addFrameLayer = useCallback((nextLayer: FrameLayer) => {
    setFrameLayers((prev) => {
      const next = [...prev, nextLayer]
      const nextIndex = next.length - 1
      setCurrentFrameIndex(nextIndex)
      return next
    })
  }, [])

  const handleOverlayFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    const slot = overlayTargetSlotRef.current
    const reader = new FileReader()

    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") return

      const img = new Image()
      img.onload = () => {
        const next: OverlayImage = {
          src: result,
          name: file.name,
          width: img.width,
          height: img.height,
        }

        setOverlayImages((prev) => ({
          ...prev,
          [slot]: next,
        }))

        setOverlaySettings((prev) => ({
          ...prev,
          slot,
        }))
      }

      img.onerror = () => {
        console.error("Failed to read overlay image")
      }

      img.src = result
    }

    reader.onerror = () => {
      console.error("Failed to read overlay file")
    }

    reader.readAsDataURL(file)
  }, [])

  const handleResize = useCallback(() => {
    const widthScale = window.innerWidth / (DESIGN_WIDTH + DESIGN_PADDING * 2)
    const heightScale = window.innerHeight / (DESIGN_HEIGHT + DESIGN_PADDING * 2)
    const nextScale = Math.min(widthScale, heightScale, VIEWPORT_SCALE_MAX)
    const nextDesignWidth = Math.round(DESIGN_WIDTH * nextScale)
    const layerPanelSideLeft = Math.round(LAYER_PANEL_SIDE_LEFT * nextScale)
    const layerPanelWidth = Math.round(LAYER_PANEL_WIDTH * nextScale)
    const layerPanelGap = Math.round(12 * nextScale)
    const contentLeftOffset = (window.innerWidth - nextDesignWidth) / 2
    const hasSideLayout =
      contentLeftOffset + layerPanelSideLeft + layerPanelWidth + layerPanelGap <= window.innerWidth

    const nextCanvasMaxWidth = Math.max(
      CANVAS_FRAME_MIN_WIDTH,
      isMobile
        ? Math.floor(window.innerWidth / nextScale - DESIGN_PADDING * 2)
        : Math.floor((window.innerWidth * CANVAS_FRAME_DESKTOP_MAX_RATIO) / nextScale),
    )

    setCanvasFrameWidth((previousWidth) => {
      if (hasManualCanvasWidthRef.current) {
        return clamp(previousWidth, CANVAS_FRAME_MIN_WIDTH, nextCanvasMaxWidth)
      }

      return Math.max(CANVAS_FRAME_MIN_WIDTH, nextCanvasMaxWidth)
    })

    setIsLayerPanelSideLayout(hasSideLayout)
    setViewportScale(nextScale)
  }, [
    DESIGN_HEIGHT,
    DESIGN_PADDING,
    DESIGN_WIDTH,
    LAYER_PANEL_SIDE_LEFT,
    LAYER_PANEL_WIDTH,
    VIEWPORT_SCALE_MAX,
    isMobile,
  ])

  const getCanvasMaxUnits = useCallback(
    (nextScale = viewportScale, mobileMode = isMobile) => {
    if (mobileMode) {
      return Math.max(
        CANVAS_FRAME_MIN_WIDTH,
        Math.floor(window.innerWidth / nextScale - DESIGN_PADDING * 2),
      )
    }

      return Math.max(
        CANVAS_FRAME_MIN_WIDTH,
        Math.floor((window.innerWidth * CANVAS_FRAME_DESKTOP_MAX_RATIO) / nextScale),
      )
    },
    [isMobile, viewportScale],
  )

  useEffect(() => {

    handleResize()
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [handleResize])

  const handleCanvasResizeMove = useCallback(
    (event: PointerEvent) => {
      if (canvasFrameDragPointerIdRef.current !== event.pointerId) return

      const deltaX = event.clientX - canvasResizeStartXRef.current
      const deltaUnits = Math.round(deltaX / viewportScale)
      const maxUnits = getCanvasMaxUnits(viewportScale, isMobile)

      setCanvasFrameWidth(
        clamp(
          canvasResizeStartWidthRef.current + deltaUnits,
          CANVAS_FRAME_MIN_WIDTH,
          maxUnits,
        ),
      )
    },
    [getCanvasMaxUnits, isMobile, viewportScale],
  )

  const handleCanvasResizeEnd = useCallback(() => {
    const pointerId = canvasFrameDragPointerIdRef.current
    if (pointerId === null) return

    window.removeEventListener("pointermove", handleCanvasResizeMove)
    window.removeEventListener("pointerup", handleCanvasResizeEnd)
    window.removeEventListener("pointercancel", handleCanvasResizeEnd)
    canvasFrameDragPointerIdRef.current = null
  }, [handleCanvasResizeMove])

  const handleCanvasResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMobile) return

      event.preventDefault()
      hasManualCanvasWidthRef.current = true
      canvasFrameDragPointerIdRef.current = event.pointerId
      canvasResizeStartXRef.current = event.clientX
      canvasResizeStartWidthRef.current = canvasFrameWidth

      if (canvasFrameDragPointerIdRef.current !== null) {
        window.addEventListener("pointermove", handleCanvasResizeMove)
        window.addEventListener("pointerup", handleCanvasResizeEnd)
        window.addEventListener("pointercancel", handleCanvasResizeEnd)
      }
    },
    [canvasFrameWidth, handleCanvasResizeEnd, handleCanvasResizeMove, isMobile],
  )

  const applyFilters = useCallback(() => {
    const svg = animatedSvgRef.current
    if (!svg) return

    // Clear existing filters
    const existingDefs = svg.querySelector("defs")
    if (existingDefs) {
      existingDefs.remove()
    }

    // Create new filter definitions
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs")
    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter")
    filter.setAttribute("id", "boilingFilter")
    filter.setAttribute("x", "-50%")
    filter.setAttribute("y", "-50%")
    filter.setAttribute("width", "200%")
    filter.setAttribute("height", "200%")

    const turbulence = document.createElementNS("http://www.w3.org/2000/svg", "feTurbulence")
    turbulence.setAttribute("type", "turbulence")
    turbulence.setAttribute("baseFrequency", Math.max(0.0001, tremorValue).toString()) // 항상 양수 유지
    turbulence.setAttribute("numOctaves", "2")
    turbulence.setAttribute("seed", TURBULENCE_SEED.toString())
    turbulence.setAttribute("result", "noise")

    const displacement = document.createElementNS("http://www.w3.org/2000/svg", "feDisplacementMap")
    displacement.setAttribute("in", "SourceGraphic")
    displacement.setAttribute("in2", "noise")
    displacement.setAttribute("scale", intensityValue.toString())
    displacement.setAttribute("xChannelSelector", "R")
    displacement.setAttribute("yChannelSelector", "G")

    filter.appendChild(turbulence)
    filter.appendChild(displacement)
    defs.appendChild(filter)
    svg.insertBefore(defs, svg.firstChild)

    // Apply filter to all drawable elements including groups
    const drawableElements = svg.querySelectorAll("path, rect, circle, ellipse, line, polyline, polygon, g, text, image, use")
    drawableElements.forEach((el) => {
      // Skip if element is already inside a filtered group
      if (!el.closest('[filter*="boilingFilter"]')) {
        el.setAttribute("filter", "url(#boilingFilter)")
      }
    })

    // If no specific elements found, apply to the entire content
    if (drawableElements.length === 0) {
      const allElements = svg.children
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i]
        if (el.tagName !== "defs") {
          el.setAttribute("filter", "url(#boilingFilter)")
        }
      }
    }
  }, [tremorValue, intensityValue]) // tremorValue와 intensityValue를 의존성으로 사용

  const updateAnimation = useCallback(() => {
    const svg = animatedSvgRef.current
    if (!svg) return

    const currentTremorValue = tremorValueRef.current
    const currentIntensityValue = intensityValueRef.current

    const offset = OFFSET_ARRAY[currentIndexRef.current]
    let newBaseFrequency = currentTremorValue + offset * animationScaleRef.current

    // 항상 양수 유지
    newBaseFrequency = Math.max(0.0001, newBaseFrequency)

    const turbulence = svg.querySelector("feTurbulence")
    const displacement = svg.querySelector("feDisplacementMap")

    if (turbulence) {
      turbulence.setAttribute("baseFrequency", newBaseFrequency.toString())
    }
    if (displacement) {
      displacement.setAttribute("scale", currentIntensityValue.toString())
    }

    currentIndexRef.current = (currentIndexRef.current + 1) % OFFSET_ARRAY.length
  }, [])

  const syncFilterValues = useCallback((nextTremorValue: number, nextIntensityValue: number) => {
    const svg = animatedSvgRef.current
    if (!svg) return

    const turbulence = svg.querySelector("feTurbulence")
    const displacement = svg.querySelector("feDisplacementMap")

    if (turbulence) {
      turbulence.setAttribute("baseFrequency", Math.max(0.0001, nextTremorValue).toString())
    }
    if (displacement) {
      displacement.setAttribute("scale", Math.max(INTENSITY_MIN, nextIntensityValue).toString())
    }
  }, [INTENSITY_MIN])

  const startAnimation = useCallback(() => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current)
    }
    animationIntervalRef.current = window.setInterval(updateAnimation, animationSpeed)
    setIsAnimating(true)
  }, [animationSpeed, updateAnimation])

  const resetValues = () => {
    tremorValueRef.current = TREMOR_DEFAULT
    intensityValueRef.current = INTENSITY_DEFAULT
    animationScaleRef.current = ANIMATION_SCALE_DEFAULT
    setTremorValue(TREMOR_DEFAULT)
    setIntensityValue(INTENSITY_DEFAULT)
    setAnimationScale(ANIMATION_SCALE_DEFAULT)
    setAnimationSpeed(100)
    syncFilterValues(TREMOR_DEFAULT, INTENSITY_DEFAULT)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    resetValues()
    const file = input.files?.[0]
    if (!file) return

    if (isSvgFile(file)) {
      const reader = new FileReader()

      reader.onload = (uploadEvent) => {
        const content = uploadEvent.target?.result
        if (typeof content !== "string") return

        const nextLayer = createFrameLayerFromSvg(file, content)
        if (!nextLayer) return

        addFrameLayer(nextLayer)
      }

      reader.onerror = () => {
        console.error("Error reading SVG file")
      }

      reader.readAsText(file)
      input.value = ""
      return
    }

    if (isRasterFile(file)) {
      try {
        const nextLayer = await createFrameLayerFromRaster(file)
        if (nextLayer) {
          addFrameLayer(nextLayer)
        }
      } catch (error) {
        console.error("Error converting image to SVG:", error)
      }
      input.value = ""
      return
    }

    console.error("Unsupported file type:", file.type || file.name)
    input.value = ""
  }

  const exportAsGIF = async () => {
    setIsExporting(true)

    try {
      // Dynamic import to avoid SSR issues
      const { default: GIF } = await import("gif.js")

      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: 300,
        height: 300,
        workerScript: "/gif.worker.js",
      })

      // Create a separate SVG element for GIF generation (don't affect the main animation)
      const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
      tempSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg")
      tempSvg.setAttribute("viewBox", scaledViewBox)
      tempSvg.setAttribute("width", "300")
      tempSvg.setAttribute("height", "300")
      tempSvg.setAttribute("preserveAspectRatio", "xMidYMid meet")
      tempSvg.innerHTML = svgContent

      // Apply filters to temp SVG
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs")
      const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter")
      filter.setAttribute("id", "tempBoilingFilter")
      filter.setAttribute("x", "-50%")
      filter.setAttribute("y", "-50%")
      filter.setAttribute("width", "200%")
      filter.setAttribute("height", "200%")

      const turbulence = document.createElementNS("http://www.w3.org/2000/svg", "feTurbulence")
      turbulence.setAttribute("type", "turbulence")
      turbulence.setAttribute("baseFrequency", Math.max(0.0001, tremorValue).toString()) // 항상 양수 유지
      turbulence.setAttribute("numOctaves", "2")
      turbulence.setAttribute("seed", TURBULENCE_SEED.toString())
      turbulence.setAttribute("result", "noise")

      const displacement = document.createElementNS("http://www.w3.org/2000/svg", "feDisplacementMap")
      displacement.setAttribute("in", "SourceGraphic")
      displacement.setAttribute("in2", "noise")
      displacement.setAttribute("scale", intensityValue.toString())
      displacement.setAttribute("xChannelSelector", "R")
      displacement.setAttribute("yChannelSelector", "G")

      filter.appendChild(turbulence)
      filter.appendChild(displacement)
      defs.appendChild(filter)
      tempSvg.insertBefore(defs, tempSvg.firstChild)

      // Apply filter to all drawable elements including groups in temp SVG
      const drawableElements = tempSvg.querySelectorAll("path, rect, circle, ellipse, line, polyline, polygon, g, text, image, use")
      drawableElements.forEach((el) => {
        if (!el.closest('[filter*="tempBoilingFilter"]')) {
          el.setAttribute("filter", "url(#tempBoilingFilter)")
        }
      })

      // If no specific elements found, apply to the entire content
      if (drawableElements.length === 0) {
        const allElements = tempSvg.children
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i]
          if (el.tagName !== "defs") {
            el.setAttribute("filter", "url(#tempBoilingFilter)")
          }
        }
      }

      const canvas = document.createElement("canvas")
      canvas.width = 300
      canvas.height = 300
      const ctx = canvas.getContext("2d")
      if (!ctx) return

        // Create only 3 frames for GIF (3fps pattern)
        const frameCount = 3
        const selectedOffsets = [OFFSET_ARRAY[0], OFFSET_ARRAY[1], OFFSET_ARRAY[2]] // Use first 3 offsets

      // Helper function to wait for next animation frame
      const waitForFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

      // Helper function to wait for specified time
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

      for (let i = 0; i < frameCount; i++) {
        const offset = selectedOffsets[i]
        let newBaseFrequency = tremorValue + offset * animationScale

        // 항상 양수 유지
        newBaseFrequency = Math.max(0.0001, newBaseFrequency)

        // Update turbulence and displacement in temp SVG
        const tempTurbulence = tempSvg.querySelector("feTurbulence")
        const tempDisplacement = tempSvg.querySelector("feDisplacementMap")
        if (tempTurbulence) {
          tempTurbulence.setAttribute("baseFrequency", newBaseFrequency.toString())
        }
        if (tempDisplacement) {
          tempDisplacement.setAttribute("scale", intensityValue.toString())
        }

        // Wait for DOM to update
        await waitForFrame()
        await wait(50) // Additional wait to ensure rendering

        // Convert temp SVG to canvas
        const svgData = new XMLSerializer().serializeToString(tempSvg)
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
        const url = URL.createObjectURL(svgBlob)

        const imgElement = document.createElement("img")
        imgElement.crossOrigin = "anonymous"

        await new Promise<void>((resolve, reject) => {
          imgElement.onload = () => {
            try {
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              // 흰색 배경을 300x300 영역에만 적용
              ctx.fillStyle = "white"
              ctx.fillRect(0, 0, 300, 300)
              // SVG를 300x300 영역에 맞춰 그림
              ctx.drawImage(imgElement, 0, 0, 300, 300)

              // Add frame to GIF
              gif.addFrame(canvas, { delay: animationSpeed, copy: true })
              URL.revokeObjectURL(url)
              resolve()
            } catch (error) {
              reject(error)
            }
          }
          imgElement.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error("Failed to load image"))
          }
            imgElement.src = url
        })

        // Update progress
        console.log(`Processing frame ${i + 1}/${frameCount}`)
      }

      gif.on("finished", (blob: Blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "boiling-animation.gif"
        a.click()
        URL.revokeObjectURL(url)
        setIsExporting(false)
      })

      gif.on("progress", (p: number) => {
        console.log(`GIF rendering progress: ${Math.round(p * 100)}%`)
      })

      gif.render()
    } catch (error) {
      console.error("Error exporting GIF:", error)
      setIsExporting(false)
    }
  }

  // Calculate scaled viewBox when dimensions change
  useEffect(() => {
    const maxWidth = CANVAS_VIEWBOX_WIDTH // 최대 허용 너비
    const viewBoxHeight = CANVAS_VIEWBOX_HEIGHT // ViewBox 높이
    let scaledWidth = originalWidth
    let scaledHeight = originalHeight
    
    if (originalWidth > maxWidth) {
      const scaleRatio = maxWidth / originalWidth
      scaledWidth = maxWidth
      scaledHeight = originalHeight * scaleRatio
    }
    
    // Calculate centered position within ViewBox
    const offsetX = (maxWidth - scaledWidth) / 2
    const offsetY = (viewBoxHeight - scaledHeight) / 2
    
    // Create viewBox that centers the content within the ViewBox dimensions
    const newScaledViewBox = `${-offsetX} ${-offsetY} ${maxWidth} ${viewBoxHeight}`
    setScaledViewBox(newScaledViewBox)
  }, [originalWidth, originalHeight])

  useEffect(() => {
    if (frameLayers.length === 0) {
      return
    }

    const clampedIndex = Math.min(currentFrameIndex, frameLayers.length - 1)
    if (clampedIndex !== currentFrameIndex) {
      setCurrentFrameIndex(clampedIndex)
      return
    }

    const activeLayer = frameLayers[clampedIndex]
    if (!activeLayer) return

    if (svgContent !== activeLayer.content) {
      setSvgContent(activeLayer.content)
    }
    if (originalWidth !== activeLayer.originalWidth) {
      setOriginalWidth(activeLayer.originalWidth)
    }
    if (originalHeight !== activeLayer.originalHeight) {
      setOriginalHeight(activeLayer.originalHeight)
    }
  }, [currentFrameIndex, frameLayers, svgContent, originalWidth, originalHeight])

  useEffect(() => {
    if (frameRemainingIntervalRef.current) {
      clearInterval(frameRemainingIntervalRef.current)
      frameRemainingIntervalRef.current = null
    }
    if (frameAdvanceTimeoutRef.current) {
      clearTimeout(frameAdvanceTimeoutRef.current)
      frameAdvanceTimeoutRef.current = null
    }

    if (frameLayers.length <= 1) {
      setFrameRemainingMs(currentFrameDurationMs)
      frameDeadlineRef.current = null
      return
    }

    frameDeadlineRef.current = performance.now() + currentFrameDurationMs
    setFrameRemainingMs(currentFrameDurationMs)

    frameRemainingIntervalRef.current = window.setInterval(() => {
      if (frameDeadlineRef.current === null) return

      const nextRemainingMs = frameDeadlineRef.current - performance.now()
      setFrameRemainingMs(Math.max(0, nextRemainingMs))
    }, 50)

    frameAdvanceTimeoutRef.current = window.setTimeout(() => {
      setCurrentFrameIndex((prev) => {
        if (frameLayers.length === 0) return 0
        if (prev >= frameLayers.length - 1) return 0
        return prev + 1
      })
    }, currentFrameDurationMs)

    return () => {
      if (frameRemainingIntervalRef.current) {
        clearInterval(frameRemainingIntervalRef.current)
        frameRemainingIntervalRef.current = null
      }
      if (frameAdvanceTimeoutRef.current) {
        clearTimeout(frameAdvanceTimeoutRef.current)
        frameAdvanceTimeoutRef.current = null
      }
    }
  }, [currentFrameDurationMs, frameLayers, currentFrameIndex])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  // SVG 콘텐츠 변경 시 필터 적용
  useEffect(() => {
    if (animatedSvgRef.current) {
      applyFilters()
    }
  }, [svgContent, applyFilters])

  // 컴포넌트 마운트 시 초기 설정 (마운트 시 1회만 실행)
  useEffect(() => {
    // 초기 필터 적용
    const timer = setTimeout(() => {
      applyFilters()
    }, 100) // DOM이 완전히 렌더링된 후 적용

    // 애니메이션 시작
    startAnimation()

    return () => {
      clearTimeout(timer)
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current)
        animationIntervalRef.current = null
      }
      if (frameAdvanceTimeoutRef.current) {
        clearTimeout(frameAdvanceTimeoutRef.current)
        frameAdvanceTimeoutRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isAnimating) {
      startAnimation()
    }
  }, [animationSpeed, isAnimating, startAnimation])

  const handleTremorChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = clamp(Number(event.target.value), TREMOR_MIN, TREMOR_MAX)
    tremorValueRef.current = nextValue
    setTremorValue(nextValue)
    syncFilterValues(nextValue, intensityValueRef.current)
  }, [syncFilterValues])

  const handleIntensityChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = clamp(Number(event.target.value), INTENSITY_MIN, INTENSITY_MAX)
    intensityValueRef.current = nextValue
    setIntensityValue(nextValue)
    syncFilterValues(tremorValueRef.current, nextValue)
  }, [syncFilterValues])

  const handleAnimationScaleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = clamp(Number(event.target.value), ANIMATION_SCALE_MIN, ANIMATION_SCALE_MAX)
    animationScaleRef.current = nextValue
    setAnimationScale(nextValue)
  }, [])

  const activeMobileSlider = useMemo(
    () =>
      selectedMobileSlider === "tremor"
        ? {
            label: "떨림 강도",
            value: tremorValue,
            min: TREMOR_MIN,
            max: TREMOR_MAX,
            step: 0.001,
            displayValue: tremorValue.toFixed(4),
            onChange: handleTremorChange,
            ariaLabel: "떨림 강도 슬라이더",
          }
        : selectedMobileSlider === "intensity"
          ? {
              label: "세기 강도",
              value: intensityValue,
              min: INTENSITY_MIN,
              max: INTENSITY_MAX,
              step: 0.1,
              displayValue: intensityValue.toFixed(1),
              onChange: handleIntensityChange,
              ariaLabel: "세기 강도 슬라이더",
            }
          : {
              label: "보일링 폭",
              value: animationScale,
              min: ANIMATION_SCALE_MIN,
              max: ANIMATION_SCALE_MAX,
              step: 0.01,
              displayValue: animationScale.toFixed(2),
              onChange: handleAnimationScaleChange,
              ariaLabel: "보일링 애니메이션 폭 슬라이더",
            },
    [
      animationScale,
      selectedMobileSlider,
      handleAnimationScaleChange,
      handleIntensityChange,
      handleTremorChange,
      intensityValue,
      tremorValue,
    ],
  )

  const handleFrameSelect = useCallback((frameId: string) => {
    const nextIndex = frameLayers.findIndex((frame) => frame.id === frameId)
    if (nextIndex === -1) return
    setCurrentFrameIndex(nextIndex)
  }, [frameLayers])

  const handleFrameDurationChange = useCallback((frameId: string, value: string) => {
    const nextValue = clamp(
      Math.round(Number(value) * 1000),
      FRAME_DURATION_MIN_MS,
      FRAME_DURATION_MAX_MS,
    )

    setFrameLayers((prev) =>
      prev.map((frame) => {
        if (frame.id !== frameId) return frame
        return { ...frame, durationMs: nextValue }
      }),
    )
  }, [])

  const handleFrameRemove = useCallback((frameId: string) => {
    setFrameLayers((prev) => {
      if (prev.length <= 1) return prev

      const next = prev.filter((frame) => frame.id !== frameId)
      const removedIndex = prev.findIndex((frame) => frame.id === frameId)

      if (removedIndex === -1) {
        return prev
      }

      if (removedIndex < currentFrameIndex) {
        setCurrentFrameIndex((prevIndex) => Math.max(0, prevIndex - 1))
      } else if (removedIndex === currentFrameIndex) {
        setCurrentFrameIndex(Math.min(removedIndex, next.length - 1))
      }

      return next
    })
  }, [currentFrameIndex])

  return (
      <div style={{
        minHeight: '100dvh',
        backgroundColor: '#FFB784',
        display: 'grid',
        placeItems: 'center',
        padding: `${scaledPadding}px`,
        overflow: 'hidden',
        fontFamily: 'Ownglyph_ParkDaHyun, sans-serif',
      }}>
        {showOverlayPanel && overlaySettings.scope === 'viewport' && overlaySrc ? (
          <NextImage
            src={overlaySrc}
            alt=""
            aria-hidden="true"
            width={overlaySize.width}
            height={overlaySize.height}
            style={{
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100dvh',
              objectFit: 'contain',
              opacity: overlayOpacity,
              pointerEvents: 'none',
              zIndex: 9998,
            }}
          />
        ) : null}

        {showOverlayPanel ? (
          <div
            style={{
              position: 'fixed',
              left: 12,
              top: 12,
              zIndex: 9999,
              width: 260,
              padding: 12,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(0,0,0,0.15)',
              boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
              fontSize: 12,
              lineHeight: 1.2,
              color: '#111',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Overlay</div>

            <label style={{ display: 'block', marginBottom: 10 }}>
              <div style={{ marginBottom: 4, opacity: 0.8 }}>Scope</div>
              <select
                value={overlaySettings.scope}
                onChange={(e) => {
                  const nextScope = e.target.value
                  if (nextScope === 'none' || nextScope === 'artboard' || nextScope === 'viewport') {
                    setOverlaySettings((prev) => ({ ...prev, scope: nextScope }))
                  }
                }}
                style={{ width: '100%', padding: '6px 8px' }}
              >
                <option value="none">Off</option>
                <option value="artboard">Artboard</option>
                <option value="viewport">Viewport</option>
              </select>
            </label>

            <label style={{ display: 'block', marginBottom: 10 }}>
              <div style={{ marginBottom: 6, opacity: 0.8 }}>Reference images</div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => openOverlayFilePicker('A')}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.2)',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Load A
                </button>
                <button
                  type="button"
                  onClick={() => openOverlayFilePicker('B')}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.2)',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Load B
                </button>
              </div>

              <select
                value={overlaySettings.slot}
                onChange={(e) => {
                  const nextSlot = e.target.value
                  if (nextSlot === 'A' || nextSlot === 'B') {
                    setOverlaySettings((prev) => ({ ...prev, slot: nextSlot }))
                  }
                }}
                style={{ width: '100%', padding: '6px 8px' }}
              >
                <option value="A">Use A {overlayImages.A ? `(${overlayImages.A.name})` : '(empty)'}</option>
                <option value="B">Use B {overlayImages.B ? `(${overlayImages.B.name})` : '(empty)'}</option>
              </select>

              <div style={{ marginTop: 6, opacity: 0.7 }}>
                Active: {activeOverlayImage ? `${activeOverlayImage.name} (${activeOverlayImage.width}x${activeOverlayImage.height})` : 'none'}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    const slot = overlaySettings.slot
                    setOverlayImages((prev) => {
                      const next = { ...prev }
                      delete next[slot]
                      return next
                    })
                  }}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.2)',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Clear active
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOverlaySettings(DEFAULT_OVERLAY_SETTINGS)
                    setOverlayImages({})
                    try {
                      localStorage.removeItem('boling:ui-overlay')
                    } catch (error) {
                      console.error('Failed to clear overlay cache:', error)
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.2)',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
              </div>
            </label>

            <label style={{ display: 'block' }}>
              <div style={{ marginBottom: 6, opacity: 0.8 }}>
                Opacity <span style={{ opacity: 0.7 }}>({Math.round(overlayOpacity * 100)}%)</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={overlayOpacity}
                onChange={(e) => {
                  const next = clamp(Number(e.target.value), 0, 1)
                  setOverlaySettings((prev) => ({ ...prev, opacity: next }))
                }}
                style={{ width: '100%' }}
              />
            </label>
          </div>
        ) : null}

        {showOverlayPanel ? (
          <input
            ref={overlayFileInputRef}
            type="file"
            accept="image/*"
            onChange={handleOverlayFileChange}
            style={{ display: 'none' }}
          />
        ) : null}

        <div style={{
          width: `${scaledDesignWidth}px`,
          height: `${scaledDesignHeight}px`,
          position: 'relative',
        }}>
          {showOverlayPanel && overlaySettings.scope === 'artboard' && overlaySrc ? (
            <NextImage
              src={overlaySrc}
              alt=""
              aria-hidden="true"
              width={overlaySize.width}
              height={overlaySize.height}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                opacity: overlayOpacity,
                pointerEvents: 'none',
                zIndex: 9998,
              }}
            />
          ) : null}
      {/* Canvas Area */}
      <div style={{
        position: 'absolute',
        left: `${scaledSize(CANVAS_LEFT)}px`,
        top: vhp(65),
        width: CANVAS_WIDTH_PX_STYLE,
        height: `${CANVAS_HEIGHT_PX}px`,
      }}>
        <NextImage src="/svg/Rectangle-267.svg" alt="Canvas background" width={378} height={519} style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          zIndex: 0,
          right: `${CANVAS_BG_RIGHT_OFFSET_PX}px`,
          bottom: `${CANVAS_BG_BOTTOM_OFFSET_PX}px`,
        }} />
        {isMobile ? null : (
          <div
            onPointerDown={handleCanvasResizeStart}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: `${vwp(CANVAS_RESIZE_HANDLE_WIDTH)}`,
              height: '100%',
              cursor: 'ew-resize',
              zIndex: 2,
              touchAction: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '3px',
                height: '40px',
                borderRadius: '999px',
                background: 'rgba(0, 0, 0, 0.55)',
                opacity: 0.8,
              }}
            />
          </div>
        )}
        <div style={{
          position: 'absolute',
          left: `${CANVAS_AREA_LEFT_PX}px`,
          top: `${CANVAS_AREA_TOP_PX}px`,
          width: `${CANVAS_AREA_WIDTH_PX}px`,
          height: `${CANVAS_AREA_HEIGHT_PX}px`,
          zIndex: 1
        }}>
          <svg
            ref={animatedSvgRef}
            xmlns="http://www.w3.org/2000/svg"
            viewBox={scaledViewBox}
            width={CANVAS_AREA_WIDTH.toString()}
            height={CANVAS_AREA_HEIGHT.toString()}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: '100%' }}
            dangerouslySetInnerHTML={svgMarkup}
          />
        </div>
      </div>
      
      <div style={{
        position: 'absolute',
        left: KNOB_PANEL_LEFT_PX_STYLE,
        top: KNOB_PANEL_TOP_PX_STYLE,
        width: PANEL_WIDTH,
        display: 'flex',
        flexDirection: 'column',
        gap: vhp(14),
      }}>
        {isMobile ? (
          <>
            <div
              style={{
                display: 'flex',
                gap: vwp(6),
              }}
            >
              {mobileSliderTabs.map((tab) => {
                const isSelected = tab.key === selectedMobileSlider
                return (
                  <button
                    type="button"
                    key={tab.key}
                    onClick={() => setSelectedMobileSlider(tab.key)}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      border: isSelected ? '2px solid #E74C3C' : '1px solid rgba(0, 0, 0, 0.35)',
                      background: isSelected ? 'rgba(231, 76, 60, 0.2)' : '#fff',
                      color: '#222',
                      padding: `${vwp(6)} ${vwp(10)}`,
                      fontSize: vwp(12),
                      fontWeight: isSelected ? 700 : 400,
                      lineHeight: 1,
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: vwp(10),
              color: 'rgb(0, 0, 0)',
            }}>
              <div style={{ fontSize: vwp(18), whiteSpace: 'nowrap' }}>{activeMobileSlider.label} :</div>
              <input
                type="range"
                min={activeMobileSlider.min}
                max={activeMobileSlider.max}
                step={activeMobileSlider.step}
                value={activeMobileSlider.value}
                onChange={activeMobileSlider.onChange}
                aria-label={activeMobileSlider.ariaLabel}
                style={{
                  flex: 1,
                  accentColor: '#FF6A6A',
                }}
              />
              <div style={{ fontSize: vwp(18), width: vwp(62), textAlign: 'right', fontWeight: 'bold' }}>
                {activeMobileSlider.displayValue}
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: vwp(10),
              color: 'rgb(0, 0, 0)',
            }}>
              <div style={{ fontSize: vwp(18), whiteSpace: 'nowrap' }}>떨림 강도 :</div>
              <input
                type="range"
                min={TREMOR_MIN}
                max={TREMOR_MAX}
                step={0.001}
                value={tremorValue}
                onChange={handleTremorChange}
                aria-label="떨림 강도 슬라이더"
                style={{
                  flex: 1,
                  accentColor: '#FF6A6A',
                }}
              />
              <div style={{ fontSize: vwp(18), width: vwp(62), textAlign: 'right', fontWeight: 'bold' }}>
                {tremorValue.toFixed(4)}
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: vwp(10),
              color: 'rgb(0, 0, 0)',
            }}>
              <div style={{ fontSize: vwp(18), whiteSpace: 'nowrap' }}>세기 강도 :</div>
              <input
                type="range"
                min={INTENSITY_MIN}
                max={INTENSITY_MAX}
                step={0.1}
                value={intensityValue}
                onChange={handleIntensityChange}
                aria-label="세기 강도 슬라이더"
                style={{
                  flex: 1,
                  accentColor: '#FF6A6A',
                }}
              />
              <div style={{ fontSize: vwp(18), width: vwp(62), textAlign: 'right', fontWeight: 'bold' }}>
                {intensityValue.toFixed(1)}
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: vwp(10),
              color: 'rgb(0, 0, 0)',
            }}>
              <div style={{
                fontSize: vwp(18),
                whiteSpace: 'nowrap',
              }}>
                보일링 폭 :
              </div>
              <input
                type="range"
                min={ANIMATION_SCALE_MIN}
                max={ANIMATION_SCALE_MAX}
                step={0.01}
                value={animationScale}
                onChange={handleAnimationScaleChange}
                aria-label="보일링 애니메이션 폭"
                style={{
                  flex: 1,
                  accentColor: '#FF6A6A',
                }}
              />
              <div style={{
                fontSize: vwp(18),
                width: vwp(45),
                textAlign: 'right',
                fontWeight: 'bold',
              }}>
                {animationScale.toFixed(2)}
              </div>
            </div>
          </>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          left: LAYER_PANEL_LEFT_PX_STYLE,
          top: LAYER_PANEL_TOP_PX_STYLE,
          width: PANEL_WIDTH,
          maxHeight: LAYER_PANEL_MAX_HEIGHT_STYLE,
          display: 'flex',
          flexDirection: 'column',
          gap: vhp(10),
          color: 'rgb(0, 0, 0)',
        }}
      >
        <div style={{
          fontSize: vwp(18),
          fontWeight: 700,
        }}>
          이미지 레이어
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: vhp(8),
          overflowY: 'auto',
          paddingRight: 4,
        }}
        >
          {frameLayers.map((frame, index) => {
            const isActive = index === currentFrameIndex

            return (
              <button
                type="button"
                key={frame.id}
                onClick={() => handleFrameSelect(frame.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  borderRadius: 10,
                  border: isActive ? '2px solid #e74c3c' : '1px solid rgba(0,0,0,0.25)',
                  background: isActive ? 'rgba(255, 255, 255, 0.92)' : '#fff',
                  padding: `${vwp(6)} ${vwp(8)}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: vhp(6),
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: vwp(8),
                  fontWeight: 700,
                }}>
                  <span style={{ fontSize: vwp(13) }}>
                    {index + 1}. {frame.name}
                  </span>
                  <span style={{ fontSize: vwp(11), opacity: 0.65 }}>
                    {frame.originalWidth}x{frame.originalHeight}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: vwp(6),
                }}>
                  <span style={{ fontSize: vwp(11), opacity: 0.75 }}>
                    체류시간 (초)
                  </span>
                  <input
                    type="range"
                    min={sliderDurationMin}
                    max={sliderDurationMax}
                    step={sliderDurationStep}
                    value={frame.durationMs / 1000}
                    onChange={(event) => {
                      event.stopPropagation()
                      handleFrameDurationChange(frame.id, event.target.value)
                    }}
                    style={{
                      flex: 1,
                      accentColor: '#FF6A6A',
                    }}
                  />
                  <span style={{ minWidth: vwp(44), textAlign: 'right', fontSize: vwp(11) }}>
                    {formatDurationSeconds(frame.durationMs)}s
                  </span>
                  {isActive ? (
                    <span style={{ minWidth: vwp(56), textAlign: 'right', fontSize: vwp(11), opacity: 0.8 }}>
                      {`${formatDurationSeconds(frameRemainingMs)}초`}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      handleFrameRemove(frame.id)
                    }}
                    disabled={frameLayers.length <= 1}
                    style={{
                      width: vwp(36),
                      height: vwp(22),
                      borderRadius: 6,
                      border: '1px solid rgba(0,0,0,0.25)',
                      background: '#fff',
                      cursor: frameLayers.length <= 1 ? 'not-allowed' : 'pointer',
                      opacity: frameLayers.length <= 1 ? 0.5 : 1,
                    }}
                  >
                    X
                  </button>
                </div>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%',
            padding: `${vwp(6)} ${vwp(8)}`,
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.35)',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          + 레이어 추가
        </button>
      </div>

      {/* 하단 툴바 */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: TOOLBAR_TOP_PX_STYLE,
        width: '100%',
        height: vhp(50),
        backgroundColor: '#303030',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: vwp(16),
        paddingRight: vwp(16)
      }}>
        <button
          type="button"
          className="toolbar-button"
          style={{
            width: vwp(32),
            height: vwp(32),
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => fileInputRef.current?.click()}
          title="첨부"
          aria-label="첨부 파일 업로드"
        >
          <NextImage src="/svg/Paperclip.svg" alt="첨부" width={32} height={32} style={{ width: vwp(32), height: vwp(32) }} />
        </button>
        
        <button
          type="button"
          className="toolbar-button"
          disabled={isExporting}
          style={{
            width: vwp(32),
            height: vwp(32),
            cursor: isExporting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isExporting ? 0.5 : 1,
          }}
          onClick={() => {
            if (isExporting) return
            exportAsGIF()
          }}
          title="GIF 저장"
          aria-label="GIF 파일로 저장"
        >
          <NextImage src="/svg/UploadSimple.svg" alt="업로드" width={32} height={32} style={{ width: vwp(32), height: vwp(32) }} />
        </button>
        
      </div>

      {/* 숨겨진 파일 입력 */}
      <input ref={fileInputRef} type="file" accept={acceptedFrameUploadTypes} onChange={handleFileUpload} style={{ display: 'none' }} />
    </div>
    </div>
  )
}
